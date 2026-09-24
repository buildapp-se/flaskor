import { FatalError, NotFoundError, TransientError } from '../../shared/errors.ts'
import type { AssortmentChunk, AssortmentResult } from '../../shared/assortment.ts'
import type { Candidate, Drink, DrinkPatch, LabelGuess, Preview, ScanResult, Stock, Tasting } from '../../shared/types.ts'
import { authenticate, type Identity } from './auth.ts'
import { finishAssortment, getMirrored, isFresh, searchMirror, upsertAssortment } from './assortment.ts'
import { cached } from './cache.ts'
import { fetchCaviste, parseCavistePage, parseCavisteUrl } from './caviste.ts'
import { deleteDrink, deleteTasting, exportHousehold, getDrink, importDrinks, insertDrink, insertTasting, listAllDrinks, listDrinks, listTastings, sanitize, sanitizeTasting, updateDrink } from './db.ts'
import { deleteAccount, getAccount, householdOf, joinHousehold, renameHousehold } from './household.ts'
import { findByEan, normalizeEan, queries, rank, readLabel, searchOnce, searchProducts, validEan } from './scan.ts'
import { fetchStock } from './stock.ts'
import { fetchProduct, parseProductNumber, toPreview, type Product } from './systembolaget.ts'
import { fetchWine, findVivino, parseVivinoUrl, parseWinePage, queryFor, refreshVivino, vivinoDue, vivinoPatch, vivinoToPreview } from './vivino.ts'

// Inloggning (beslut 2, 2026-09-15): Firebase ID-token per användare, eller grindkoden (secreten SERVICE_TOKEN) som tjänsteåtkomst
// till hushåll 1 för nattskriptet och skripten. Se worker/src/auth.ts och household.ts.
// GEMINI_API_KEY och SB_API_KEY (2026-09-08) är secrets för skanningen: saknas Gemini svarar /api/scan 500 på foton,
// saknas Systembolagsnyckeln blir kandidatlistan tom och användaren får fylla i själv.
type GateEnv = Env & { SERVICE_TOKEN?: string; GEMINI_API_KEY?: string; SB_API_KEY?: string }

/** Nattens tak (beslut 23): så många produktsidor hämtas per körning. Rader som spegeln känner till kostar ingen sida och räknas inte. */
const NIGHTLY_CAP = 50
/** Cache API (2026-09-12): Systembolagets eget sök säger max-age=1800; lagret åldras fortare. */
const SEARCH_TTL = 1800
const STOCK_TTL = 600
/** Vivino: så många viner får nytt betyg per natt (saknat eller äldre än 30 dagar). */
const VIVINO_CAP = 20
/** Tak på kroppen före JSON-tolkningen (OWASP 2026-09-16, A04). Ett foto får 3 MB, spegelbitarna 2 MB, allt annat 64 KB. */
const BODY_MAX = 65_536
const SCAN_BODY_MAX = 3_000_000
/** Spegelbitarna (300 rader) och testets överfulla bit: bara grindkoden når routen. */
const ASSORTMENT_BODY_MAX = 2_000_000
/** Geminis fria nivå är gemensam (~1 500 foton per dag): tak per konto och dygn, och ett globalt (OWASP 2026-09-16, A04). */
export const SCAN_DAILY = { perUid: 50, total: 1_200 }

export default {
  async fetch(request: Request, env: GateEnv): Promise<Response> {
    const origin = request.headers.get('origin')
    const headers = corsHeaders(origin, env.FRONTEND_ORIGINS)
    try {
      if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers })
      if (origin && !allowedOrigins(env.FRONTEND_ORIGINS).includes(origin)) throw new FatalError('origin not allowed', 403)
      const body = await route(request, env)
      if (body === null) return new Response(null, { status: 204, headers })
      return Response.json(body, { headers })
    } catch (error) {
      const status = error instanceof FatalError ? error.status : error instanceof TransientError ? 503 : 500
      if (status === 500) console.error(error)
      // Ett oväntat fel loggas men ekas inte: meddelandet kan bära SQL eller en leverantörs svar (OWASP 2026-09-16, låg).
      const message = status === 500 ? 'internal error' : error instanceof Error ? error.message : 'unknown error'
      return Response.json({ error: message }, { status, headers })
    }
  },

  async scheduled(_controller: ScheduledController, env: GateEnv): Promise<void> {
    await refreshAll(env.DB, { kind: 'service' })
  },
} satisfies ExportedHandler<GateEnv>

async function route(request: Request, env: GateEnv): Promise<unknown> {
  const url = new URL(request.url)
  const { method } = request
  const path = url.pathname.replace(/\/$/, '')

  if (method === 'GET' && path === '/health') return { ok: true }
  if (!path.startsWith('/api/')) throw new NotFoundError('no such route')

  // Utan konto (2026-09-15): gäster i appen får slå upp flaskor, men inget som läser eller skriver ett hushåll.
  // Taket räknas per IP-adress. Ett anrop med Authorization går alltid den vanliga vägen, så en trasig token ger 401.
  if (!request.headers.has('authorization') && method === 'GET' && ANONYMOUS_LOOKUPS.has(path)) {
    const { success } = await env.LOOKUP_LIMIT.limit({ key: `ip:${request.headers.get('cf-connecting-ip') ?? 'unknown'}` })
    if (!success) throw new FatalError('too many requests, wait a minute', 429)
    return lookup(path, url, env)
  }

  const who = await authenticate(request, env)
  const hh = await householdOf(env.DB, who)
  const user = (): Identity & { kind: 'user' } => {
    if (who.kind !== 'user') throw new FatalError('requires a signed-in account', 403)
    return who
  }

  if (method === 'GET' && path === '/api/ping') return null
  if (method === 'GET' && path === '/api/me') return getAccount(env.DB, who, hh)
  if (method === 'DELETE' && path === '/api/me') {
    await deleteAccount(env.DB, user(), hh)
    return null
  }
  if (method === 'PATCH' && path === '/api/household') {
    await renameHousehold(env.DB, hh, await readJson(request))
    return null
  }
  if (method === 'POST' && path === '/api/household/join') {
    // Samma snäva tak som skanningen: en inbjudningskod (och grindkoden) ska inte gå att gissa i en loop.
    await throttle(env.SCAN_LIMIT, who)
    await joinHousehold(env.DB, user(), hh, await readJson(request))
    return null
  }
  if (method === 'GET' && path === '/api/drinks') return { drinks: await listDrinks(env.DB, hh) }
  // Hela hushållet som en fil (2026-09-15): rader och alla avsmakningar i ett anrop.
  if (method === 'GET' && path === '/api/export') return exportHousehold(env.DB, hh)
  // En gästs lokala flaskor in i kontot (2026-09-15), i bitar om högst 40 rader och avsmakningar per anrop.
  if (method === 'POST' && path === '/api/drinks/import') {
    await throttle(env.LOOKUP_LIMIT, who)
    return { imported: await importDrinks(env.DB, hh, await readJson(request)) }
  }
  if (method === 'POST' && path === '/api/drinks') {
    await throttle(env.LOOKUP_LIMIT, who)
    return insertDrink(env.DB, hh, await withVivino(sanitize(await readJson(request))))
  }
  // Nattjobbet och spegelimporten rör alla hushåll och hela spegeln: bara grindkoden, aldrig ett konto.
  if (method === 'POST' && path === '/api/refresh-all') return refreshAll(env.DB, service(who))
  // Spegelimporten (migrering 0006): nattskriptet postar dumpen i bitar, sist done. Se worker/src/assortment.ts.
  if (method === 'POST' && path === '/api/assortment') return assortment(await readJson(request, ASSORTMENT_BODY_MAX), env.DB, service(who))
  if (method === 'POST' && path === '/api/scan') {
    await throttle(env.SCAN_LIMIT, who)
    return scan(await readJson(request, SCAN_BODY_MAX), env, who)
  }

  const single = path.match(/^\/api\/drinks\/(\d+)$/)
  if (single?.[1] && method === 'PATCH') return updateDrink(env.DB, hh, Number(single[1]), sanitize(await readJson(request)))
  if (single?.[1] && method === 'DELETE') {
    await deleteDrink(env.DB, hh, Number(single[1]))
    return null
  }

  // Drucken-logg (beslut 16). getDrink först, så en logg aldrig hamnar på ett id som inte är hushållets.
  const tastings = path.match(/^\/api\/drinks\/(\d+)\/tastings$/)
  if (tastings?.[1]) {
    const drink = await getDrink(env.DB, hh, Number(tastings[1]))
    if (method === 'GET') return { tastings: (await listTastings(env.DB, drink.id)) satisfies Tasting[] }
    if (method === 'POST') return insertTasting(env.DB, drink.id, sanitizeTasting(await readJson(request)))
  }

  const tasting = path.match(/^\/api\/drinks\/(\d+)\/tastings\/(\d+)$/)
  if (tasting?.[1] && tasting[2] && method === 'DELETE') {
    const drink = await getDrink(env.DB, hh, Number(tasting[1]))
    await deleteTasting(env.DB, drink.id, Number(tasting[2]))
    return null
  }

  // Allt nedan hämtar från Systembolaget, Vivino eller Caviste åt användaren: ett tak per konto (Rate Limiting-bindningen).
  await throttle(env.LOOKUP_LIMIT, who)

  const refresh = path.match(/^\/api\/drinks\/(\d+)\/refresh$/)
  if (refresh?.[1] && method === 'POST') return refreshDrink(env.DB, await getDrink(env.DB, hh, Number(refresh[1])))

  if (method === 'GET' && ANONYMOUS_LOOKUPS.has(path)) return lookup(path, url, env)

  // Lagersaldo i en butik (BACKLOG P3, 2026-09-09). Slås upp på Systembolagets interna produkt-id, inte artikelnumret;
  // gamla rader saknar det och fyller i det ur produktsidan vid första förfrågan.
  if (method === 'GET' && path === '/api/stock') {
    const store = url.searchParams.get('store') ?? ''
    const drink = await getDrink(env.DB, hh, Number(url.searchParams.get('drink') ?? ''))
    if (!env.SB_API_KEY) throw new FatalError('SB_API_KEY is not configured', 500)
    const key = env.SB_API_KEY
    const productId = await productIdOf(env.DB, drink)
    return { store, ...(await cached(`stock:${store}:${productId}`, STOCK_TTL, () => fetchStock(store, productId, key))) } satisfies Stock
  }

  throw new NotFoundError('no such route')
}

/** Uppslag som bara läser Systembolaget, Vivino, Caviste eller spegeln. Tillåtna utan konto, se route. */
const ANONYMOUS_LOOKUPS = new Set(['/api/systembolaget', '/api/search', '/api/caviste', '/api/vivino'])

async function lookup(path: string, url: URL, env: GateEnv): Promise<unknown> {
  if (path === '/api/systembolaget') {
    const number = parseProductNumber(url.searchParams.get('q') ?? '')
    return toPreview(await productOrMirror(env.DB, number))
  }
  // Sök på namn hos Systembolaget (BACKLOG P3, 2026-09-09). Samma sök som skanningen använder, men med användarens
  // egna ord och utan rankning: hen skrev frågan själv, så sökmotorns ordning är den bästa gissningen vi har.
  if (path === '/api/search') {
    const q = (url.searchParams.get('q') ?? '').trim()
    if (q === '') throw new FatalError('q is required')
    return { candidates: await cached(`search:${q.toLowerCase()}`, SEARCH_TTL, () => searchOrMirror(q, env)) satisfies Candidate[] }
  }
  // Caviste-import via produktlänk (beslut 6). En låda innehåller flera viner, så svaret är en lista att välja ur.
  if (path === '/api/caviste') {
    const { number, url: page } = parseCavisteUrl(url.searchParams.get('q') ?? '')
    return { wines: parseCavistePage(await fetchCaviste(page), number, page) satisfies Preview[] }
  }
  if (path === '/api/vivino') {
    const { wineId, year } = parseVivinoUrl(url.searchParams.get('q') ?? '')
    return vivinoToPreview(parseWinePage(await fetchWine(wineId), wineId), wineId, year)
  }
  throw new NotFoundError('no such route')
}

/** Kastar 403 för ett konto. Returnerar ett bevis som bara går att få med grindkoden, så routen inte kan glömma kollen. */
function service(who: Identity): { kind: 'service' } {
  if (who.kind !== 'service') throw new FatalError('requires the service code', 403)
  return who
}

/**
 * Ett tak per konto (Rate Limiting-bindningen, 2026-09-15). Grindkoden räknas inte: nattskriptet och seedskripten är betrodda.
 * ponytail: bindningen räknar per Cloudflare-plats och är ungefärlig; ett dygnstak på Gemini kräver lagring, lägg till om kvoten tar slut.
 */
async function throttle(limiter: RateLimit, who: Identity): Promise<void> {
  if (who.kind === 'service') return
  const { success } = await limiter.limit({ key: who.uid })
  if (!success) throw new FatalError('too many requests, wait a minute', 429)
}

/** Kroppen som JSON, avvisad före läsningen på content-length och efter på längden: en klient utan content-length får inte förbi taket. */
async function readJson(request: Request, max = BODY_MAX): Promise<unknown> {
  if (Number(request.headers.get('content-length') ?? 0) > max) throw new FatalError('body too large', 413)
  const text = await request.text()
  if (text.length > max) throw new FatalError('body too large', 413)
  try {
    return JSON.parse(text) as unknown
  } catch {
    throw new FatalError('body must be JSON')
  }
}

/**
 * Dagsräknare för fotoskanningar i sb_meta: en rad per konto och dygn och en global, gamla dygn städas när ett nytt börjar.
 * Kastar 429 över taket. Två skrivningar per foto: fotona är få, och Gemini-kvoten är den knappa resursen.
 */
export async function countScan(db: D1Database, uid: string, now = new Date(), limits = SCAN_DAILY): Promise<void> {
  const day = now.toISOString().slice(0, 10)
  const bump = (key: string) =>
    db.prepare("INSERT INTO sb_meta (key, value) VALUES (?, '1') ON CONFLICT (key) DO UPDATE SET value = CAST(value AS INTEGER) + 1 RETURNING CAST(value AS INTEGER) AS n").bind(key).first<number>('n')
  const total = (await bump(`scan:${day}:total`)) ?? 0
  if (total === 1) await db.prepare("DELETE FROM sb_meta WHERE key LIKE 'scan:%' AND key < ?").bind(`scan:${day}`).run()
  const mine = (await bump(`scan:${day}:${uid}`)) ?? 0
  if (mine > limits.perUid || total > limits.total) throw new FatalError('daily scan limit reached, try again tomorrow', 429)
}

function allowedOrigins(list: string): string[] {
  return list.split(',').map((s) => s.trim()).filter(Boolean)
}

function corsHeaders(origin: string | null, list: string): Record<string, string> {
  const allowed = origin && allowedOrigins(list).includes(origin) ? origin : ''
  return {
    'access-control-allow-origin': allowed,
    'access-control-allow-methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    'access-control-allow-headers': 'authorization, content-type',
    'access-control-max-age': '86400',
    vary: 'origin',
  }
}

/** Ett nytt vin får sitt Vivino-betyg direkt vid sparandet. Misslyckas hämtningen sparas raden ändå, utan betyg. */
async function withVivino(input: DrinkPatch): Promise<DrinkPatch> {
  if (input.kind !== 'wine' || typeof input.name !== 'string' || input.vivino_rating !== undefined) return input
  try {
    return { ...input, ...vivinoPatch(await findVivino(queryFor({ name: input.name, producer: input.producer ?? null }))) }
  } catch (error) {
    console.error('vivino lookup failed', error)
    return input
  }
}

/**
 * Streckkod eller etikett (BACKLOG 37): först en gissning om flaskan (Open Food Facts för streckkoden, Gemini för fotot),
 * sedan Systembolagets bästa träffar på namnet som kandidater. Vin utan träff får Vivinos vinsida så klienten kan hämta den.
 */
async function scan(body: unknown, env: GateEnv, who: Identity): Promise<ScanResult> {
  const { image, ean } = (typeof body === 'object' && body !== null ? body : {}) as { image?: unknown; ean?: unknown }
  if (typeof image !== 'string' && typeof ean !== 'string') throw new FatalError('image or ean required')
  let guess: LabelGuess | null = null
  let via: ScanResult['via'] = 'label'
  if (typeof ean === 'string' && ean.trim() !== '') {
    const code = normalizeEan(ean)
    if (!validEan(code)) throw new FatalError('not a valid barcode')
    guess = await findByEan(code)
    via = 'barcode'
  }
  if (!guess && typeof image === 'string' && image !== '') {
    if (!env.GEMINI_API_KEY) throw new FatalError('GEMINI_API_KEY is not configured', 500)
    await countScan(env.DB, who.kind === 'user' ? who.uid : 'service')
    guess = await readLabel(image, env.GEMINI_API_KEY)
    via = 'label'
  }
  if (!guess) throw new NotFoundError('unknown barcode')
  const candidates = rank(await scanSearchOrMirror(guess, env), guess)
  let vivino_url: string | null = null
  if (candidates.length === 0 && guess.kind === 'wine') {
    try {
      vivino_url = (await findVivino(queryFor(guess)))?.url ?? null
    } catch (error) {
      console.error('vivino lookup failed', error)
    }
  }
  return { guess, candidates, vivino_url, via }
}

/** Uppdatera-knappen: Systembolagets pris, tillgänglighet och (för önskelistan) årgång (beslut 23), och Vivinos betyg för vin. */
async function refreshDrink(db: D1Database, drink: Drink): Promise<Drink> {
  const patch: DrinkPatch = {}
  if (drink.source_kind === 'systembolaget' && drink.source_id) Object.assign(patch, refreshPatch(await fetchFresh(db, drink.source_id), drink))
  if (drink.kind === 'wine') Object.assign(patch, await refreshVivino(drink))
  if (Object.keys(patch).length === 0) throw new FatalError('nothing to refresh for this drink')
  return updateDrink(db, drink.household_id, drink.id, patch)
}

/** Radens Systembolags-id, hämtat ur produktsidan och sparat första gången det behövs. Kastar för rader utan artikelnummer. */
async function productIdOf(db: D1Database, drink: Drink): Promise<string> {
  if (drink.sb_product_id) return drink.sb_product_id
  if (drink.source_kind !== 'systembolaget' || !drink.source_id) throw new FatalError('drink has no systembolaget number')
  const sb_product_id = toPreview(await productOrMirror(db, drink.source_id)).sb_product_id
  if (!sb_product_id) throw new FatalError('systembolaget gave no product id', 502)
  await updateDrink(db, drink.household_id, drink.id, { sb_product_id })
  return sb_product_id
}

type Fresh = { gone: true } | { gone: false; preview: Preview }

async function fetchFresh(db: D1Database, number: string): Promise<Fresh> {
  try {
    return { gone: false, preview: toPreview(await productOrMirror(db, number)) }
  } catch (error) {
    // Sidan borta betyder att varan utgått. Allt annat (nätfel, 5xx) kastar vidare och lämnar raden orörd.
    if (error instanceof NotFoundError) return { gone: true }
    throw error
  }
}

// ── Spegeln som reserv (migrering 0006, beslut 23) ─────────────────────────────────────────────────────────────

/**
 * Produktsidan först, spegeln när sidan inte svarar (nätfel, 5xx, 429). En 404 är ett riktigt svar och går vidare
 * som den är: spegeln får inte återuppliva en vara Systembolaget tagit bort. Saknas numret även i spegeln kastas
 * sidans fel, inte spegelns, så felmeddelandet pekar på det som faktiskt gick sönder.
 */
async function productOrMirror(db: D1Database, number: string): Promise<Product> {
  try {
    return await fetchProduct(number)
  } catch (error) {
    if (error instanceof NotFoundError) throw error
    try {
      return await getMirrored(db, number)
    } catch {
      throw error
    }
  }
}

/** Systembolagets sök när nyckeln finns och svarar, annars spegeln. Nyckelfel (401/403) och 429 loggas, användaren får träffar ändå. */
async function searchOrMirror(q: string, env: GateEnv): Promise<Candidate[]> {
  if (!env.SB_API_KEY) return searchMirror(env.DB, q)
  try {
    return await searchOnce(q, env.SB_API_KEY)
  } catch (error) {
    console.error('systembolaget search failed, using mirror', error)
    return searchMirror(env.DB, q)
  }
}

/** Skanningens sök: alla frågor ur gissningen hos Systembolaget, annars samma frågor mot spegeln, sammanslagna som där. */
async function scanSearchOrMirror(guess: LabelGuess, env: GateEnv): Promise<Candidate[]> {
  if (env.SB_API_KEY) {
    try {
      return await searchProducts(guess, env.SB_API_KEY)
    } catch (error) {
      console.error('systembolaget scan search failed, using mirror', error)
    }
  }
  const seen = new Set<string>()
  const rounds = await Promise.all(queries(guess).map((q) => searchMirror(env.DB, q)))
  return rounds.flat().filter((c) => !seen.has(c.number) && seen.add(c.number))
}

/** Radens färska värden ur spegeln, eller null när spegeln inte känner numret (då får produktsidan avgöra om varan finns). */
async function mirroredFresh(db: D1Database, number: string): Promise<Fresh | null> {
  try {
    return { gone: false, preview: toPreview(await getMirrored(db, number)) }
  } catch (error) {
    if (error instanceof NotFoundError) return null
    throw error
  }
}

function refreshPatch(fresh: Fresh, drink: Drink): DrinkPatch {
  const price_checked_at = new Date().toISOString()
  if (fresh.gone) return { availability: 'discontinued', price_checked_at }
  const { preview } = fresh
  // sb_product_id kom till 2026-09-09: nattens körning fyller i det på gamla rader, så lagersaldot funkar utan extra hämtning.
  const patch: DrinkPatch = { price_current: preview.price_current, price_checked_at, availability: preview.availability, sb_product_id: preview.sb_product_id, sb_assortment: preview.sb_assortment }
  // Ägda flaskor behåller sin årgång: Systembolaget säljer den nya, källaren har den gamla.
  if (!drink.owned) patch.vintage = preview.vintage
  return patch
}

/** En bit av dumpen in i spegeln, och på done: gamla rader bort och spegeln stämplad som färsk. */
async function assortment(body: unknown, db: D1Database, _proof: { kind: 'service' }): Promise<AssortmentResult> {
  if (typeof body !== 'object' || body === null) throw new FatalError('body must be an object')
  const { run, rows, done, numbers } = body as AssortmentChunk
  if (rows !== undefined && !Array.isArray(rows)) throw new FatalError('rows must be an array')
  const upserted = rows ? await upsertAssortment(db, run, rows) : 0
  if (done !== true) return { upserted }
  return { upserted, ...(await finishAssortment(db, run, numbers)) }
}

export async function refreshAll(db: D1Database, _proof: { kind: 'service' }): Promise<{ refreshed: number; mirrored: number; failed: number; vivino: number; written: number }> {
  // ponytail: läser alla hushålls rader varje natt, linjärt med användarna; tak per hushåll när det blir tusentals.
  const drinks = await listAllDrinks(db)
  // En hämtning per artikelnummer, oavsett hur många rader som delar det (beslut 23).
  const byNumber = new Map<string, Drink[]>()
  for (const d of drinks) {
    if (d.source_kind !== 'systembolaget' || !d.source_id) continue
    byNumber.set(d.source_id, [...(byNumber.get(d.source_id) ?? []), d])
  }
  // Spegeln svarar för alla rader den känner, utan en enda produktsida; bara resten räknas mot taket (beslut 23).
  const useMirror = await isFresh(db)
  let refreshed = 0
  let mirrored = 0
  let failed = 0
  let pages = 0
  let written = 0
  for (const [number, rows] of byNumber) {
    try {
      const fromMirror = useMirror ? await mirroredFresh(db, number) : null
      if (!fromMirror && pages >= NIGHTLY_CAP) continue
      if (!fromMirror) pages++
      const fresh = fromMirror ?? (await fetchFresh(db, number))
      for (const row of rows) {
        const patch = refreshPatch(fresh, row)
        if (unchanged(patch, row)) continue
        await updateDrink(db, row.household_id, row.id, patch)
        written++
      }
      refreshed++
      if (fromMirror) mirrored++
    } catch (error) {
      failed++
      console.error(`refresh ${number} failed`, error)
    }
  }
  // Vivino: viner utan betyg eller med betyg äldre än 30 dagar, ett tak per natt så resten tas nästa natt.
  let vivino = 0
  for (const row of drinks.filter((d) => vivinoDue(d)).slice(0, VIVINO_CAP)) {
    try {
      await updateDrink(db, row.household_id, row.id, await refreshVivino(row))
      vivino++
    } catch (error) {
      failed++
      console.error(`vivino ${row.id} failed`, error)
    }
  }
  return { refreshed, mirrored, failed, vivino, written }
}

/** Så gammal får "Pris kollat" bli innan natten skriver raden bara för datumets skull. */
const STAMP_MAX_AGE_MS = 7 * 86_400_000

/**
 * Sant när nattens patch inte ändrar något utom kontrolldatumet, och datumet är färskare än en vecka (2026-09-24).
 * D1:s skrivkvot delas av hela Cloudflare-kontot, Sipdeck med: en skrivning per rad och natt växer linjärt med
 * användarna, så natten skriver bara ändringar, plus datumet en gång i veckan.
 */
export function unchanged(patch: DrinkPatch, row: Drink, now = Date.now()): boolean {
  const checked = row.price_checked_at ? Date.parse(row.price_checked_at) : NaN
  if (!(now - checked < STAMP_MAX_AGE_MS)) return false
  return (Object.keys(patch) as Array<keyof DrinkPatch>).every((k) => k === 'price_checked_at' || patch[k] === row[k as keyof Drink])
}
