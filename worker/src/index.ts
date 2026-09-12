import { FatalError, NotFoundError, TransientError, UnauthorizedError } from '../../shared/errors.ts'
import type { AssortmentChunk, AssortmentResult } from '../../shared/assortment.ts'
import type { Candidate, Drink, DrinkPatch, LabelGuess, Preview, ScanResult, Stock, Tasting } from '../../shared/types.ts'
import { finishAssortment, getMirrored, isFresh, searchMirror, upsertAssortment } from './assortment.ts'
import { cached } from './cache.ts'
import { fetchCaviste, parseCavistePage, parseCavisteUrl } from './caviste.ts'
import { deleteDrink, deleteTasting, getDrink, insertDrink, insertTasting, listDrinks, listTastings, sanitize, sanitizeTasting, updateDrink } from './db.ts'
import { findByEan, normalizeEan, queries, rank, readLabel, searchOnce, searchProducts, validEan } from './scan.ts'
import { fetchStock } from './stock.ts'
import { fetchProduct, parseProductNumber, toPreview, type Product } from './systembolaget.ts'
import { fetchWine, findVivino, parseVivinoUrl, parseWinePage, queryFor, refreshVivino, vivinoDue, vivinoPatch, vivinoToPreview } from './vivino.ts'

// Grindkoden (beslut 2): en delad kod, skickad som Bearer, jämförd mot secreten GATE_CODE. Sitter här, aldrig bara i klienten.
// GEMINI_API_KEY och SB_API_KEY (2026-09-08) är secrets för skanningen: saknas Gemini svarar /api/scan 500 på foton,
// saknas Systembolagsnyckeln blir kandidatlistan tom och användaren får fylla i själv.
type GateEnv = Env & { GATE_CODE?: string; GEMINI_API_KEY?: string; SB_API_KEY?: string }

/** Nattens tak (beslut 23): så många produktsidor hämtas per körning. Rader som spegeln känner till kostar ingen sida och räknas inte. */
const NIGHTLY_CAP = 50
/** Cache API (2026-09-12): Systembolagets eget sök säger max-age=1800; lagret åldras fortare. */
const SEARCH_TTL = 1800
const STOCK_TTL = 600
/** Vivino: så många viner får nytt betyg per natt (saknat eller äldre än 30 dagar). */
const VIVINO_CAP = 20

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
      const message = error instanceof Error ? error.message : 'unknown error'
      return Response.json({ error: message }, { status, headers })
    }
  },

  async scheduled(_controller: ScheduledController, env: GateEnv): Promise<void> {
    await refreshAll(env.DB)
  },
} satisfies ExportedHandler<GateEnv>

async function route(request: Request, env: GateEnv): Promise<unknown> {
  const url = new URL(request.url)
  const { method } = request
  const path = url.pathname.replace(/\/$/, '')

  if (method === 'GET' && path === '/health') return { ok: true }
  if (!path.startsWith('/api/')) throw new NotFoundError('no such route')

  authenticate(request, env)

  if (method === 'GET' && path === '/api/ping') return null
  if (method === 'GET' && path === '/api/drinks') return { drinks: await listDrinks(env.DB) }
  if (method === 'POST' && path === '/api/drinks') return insertDrink(env.DB, await withVivino(sanitize(await request.json())))
  if (method === 'POST' && path === '/api/refresh-all') return refreshAll(env.DB)
  // Spegelimporten (migrering 0006): nattskriptet postar dumpen i bitar, sist done. Se worker/src/assortment.ts.
  if (method === 'POST' && path === '/api/assortment') return assortment(await request.json(), env.DB)
  if (method === 'POST' && path === '/api/scan') return scan(await request.json(), env)

  const single = path.match(/^\/api\/drinks\/(\d+)$/)
  if (single?.[1] && method === 'PATCH') return updateDrink(env.DB, Number(single[1]), sanitize(await request.json()))
  if (single?.[1] && method === 'DELETE') {
    await deleteDrink(env.DB, Number(single[1]))
    return null
  }

  // Drucken-logg (beslut 16). getDrink först, så en logg aldrig hamnar på ett id som inte är hushållets.
  const tastings = path.match(/^\/api\/drinks\/(\d+)\/tastings$/)
  if (tastings?.[1]) {
    const drink = await getDrink(env.DB, Number(tastings[1]))
    if (method === 'GET') return { tastings: (await listTastings(env.DB, drink.id)) satisfies Tasting[] }
    if (method === 'POST') return insertTasting(env.DB, drink.id, sanitizeTasting(await request.json()))
  }

  const tasting = path.match(/^\/api\/drinks\/(\d+)\/tastings\/(\d+)$/)
  if (tasting?.[1] && tasting[2] && method === 'DELETE') {
    const drink = await getDrink(env.DB, Number(tasting[1]))
    await deleteTasting(env.DB, drink.id, Number(tasting[2]))
    return null
  }

  const refresh = path.match(/^\/api\/drinks\/(\d+)\/refresh$/)
  if (refresh?.[1] && method === 'POST') return refreshDrink(env.DB, await getDrink(env.DB, Number(refresh[1])))

  if (method === 'GET' && path === '/api/systembolaget') {
    const number = parseProductNumber(url.searchParams.get('q') ?? '')
    return toPreview(await productOrMirror(env.DB, number))
  }

  // Sök på namn hos Systembolaget (BACKLOG P3, 2026-09-09). Samma sök som skanningen använder, men med användarens
  // egna ord och utan rankning: hen skrev frågan själv, så sökmotorns ordning är den bästa gissningen vi har.
  if (method === 'GET' && path === '/api/search') {
    const q = (url.searchParams.get('q') ?? '').trim()
    if (q === '') throw new FatalError('q is required')
    return { candidates: await cached(`search:${q.toLowerCase()}`, SEARCH_TTL, () => searchOrMirror(q, env)) satisfies Candidate[] }
  }

  // Lagersaldo i en butik (BACKLOG P3, 2026-09-09). Slås upp på Systembolagets interna produkt-id, inte artikelnumret;
  // gamla rader saknar det och fyller i det ur produktsidan vid första förfrågan.
  if (method === 'GET' && path === '/api/stock') {
    const store = url.searchParams.get('store') ?? ''
    const drink = await getDrink(env.DB, Number(url.searchParams.get('drink') ?? ''))
    if (!env.SB_API_KEY) throw new FatalError('SB_API_KEY is not configured', 500)
    const key = env.SB_API_KEY
    const productId = await productIdOf(env.DB, drink)
    return { store, ...(await cached(`stock:${store}:${productId}`, STOCK_TTL, () => fetchStock(store, productId, key))) } satisfies Stock
  }

  // Caviste-import via produktlänk (beslut 6). En låda innehåller flera viner, så svaret är en lista att välja ur.
  if (method === 'GET' && path === '/api/caviste') {
    const { number, url: page } = parseCavisteUrl(url.searchParams.get('q') ?? '')
    return { wines: parseCavistePage(await fetchCaviste(page), number, page) satisfies Preview[] }
  }

  if (method === 'GET' && path === '/api/vivino') {
    const { wineId, year } = parseVivinoUrl(url.searchParams.get('q') ?? '')
    return vivinoToPreview(parseWinePage(await fetchWine(wineId), wineId), wineId, year)
  }

  throw new NotFoundError('no such route')
}

function authenticate(request: Request, env: GateEnv): void {
  if (!env.GATE_CODE) throw new FatalError('GATE_CODE is not configured', 500)
  const header = request.headers.get('authorization') ?? ''
  const code = header.startsWith('Bearer ') ? header.slice(7) : ''
  if (code === '' || !timingSafeEqual(code, env.GATE_CODE)) throw new UnauthorizedError()
}

function timingSafeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder()
  const x = enc.encode(a)
  const y = enc.encode(b)
  if (x.byteLength !== y.byteLength) return false
  return crypto.subtle.timingSafeEqual(x, y)
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
async function scan(body: unknown, env: GateEnv): Promise<ScanResult> {
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
  return updateDrink(db, drink.id, patch)
}

/** Radens Systembolags-id, hämtat ur produktsidan och sparat första gången det behövs. Kastar för rader utan artikelnummer. */
async function productIdOf(db: D1Database, drink: Drink): Promise<string> {
  if (drink.sb_product_id) return drink.sb_product_id
  if (drink.source_kind !== 'systembolaget' || !drink.source_id) throw new FatalError('drink has no systembolaget number')
  const sb_product_id = toPreview(await productOrMirror(db, drink.source_id)).sb_product_id
  if (!sb_product_id) throw new FatalError('systembolaget gave no product id', 502)
  await updateDrink(db, drink.id, { sb_product_id })
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
  const patch: DrinkPatch = { price_current: preview.price_current, price_checked_at, availability: preview.availability, sb_product_id: preview.sb_product_id }
  // Ägda flaskor behåller sin årgång: Systembolaget säljer den nya, källaren har den gamla.
  if (!drink.owned) patch.vintage = preview.vintage
  return patch
}

/** En bit av dumpen in i spegeln, och på done: gamla rader bort och spegeln stämplad som färsk. */
async function assortment(body: unknown, db: D1Database): Promise<AssortmentResult> {
  if (typeof body !== 'object' || body === null) throw new FatalError('body must be an object')
  const { run, rows, done } = body as AssortmentChunk
  if (rows !== undefined && !Array.isArray(rows)) throw new FatalError('rows must be an array')
  const upserted = rows ? await upsertAssortment(db, run, rows) : 0
  if (done !== true) return { upserted }
  return { upserted, ...(await finishAssortment(db, run)) }
}

export async function refreshAll(db: D1Database): Promise<{ refreshed: number; mirrored: number; failed: number; vivino: number }> {
  const drinks = await listDrinks(db)
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
  for (const [number, rows] of byNumber) {
    try {
      const fromMirror = useMirror ? await mirroredFresh(db, number) : null
      if (!fromMirror && pages >= NIGHTLY_CAP) continue
      if (!fromMirror) pages++
      const fresh = fromMirror ?? (await fetchFresh(db, number))
      for (const row of rows) await updateDrink(db, row.id, refreshPatch(fresh, row))
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
      await updateDrink(db, row.id, await refreshVivino(row))
      vivino++
    } catch (error) {
      failed++
      console.error(`vivino ${row.id} failed`, error)
    }
  }
  return { refreshed, mirrored, failed, vivino }
}
