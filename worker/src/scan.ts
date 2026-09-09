import { FatalError, NotFoundError, TransientError } from '../../shared/errors.ts'
import type { Candidate, Kind, LabelGuess } from '../../shared/types.ts'
import { imageUrl } from './systembolaget.ts'
import { queryFor } from './vivino.ts'

// Streckkod och etikett (BACKLOG 37, 2026-09-08). Systembolaget känner inte till EAN (verifierat: textQuery på en
// streckkod ger noll träffar, barcode= och gtin= ignoreras), så vägen är: streckkod → Open Food Facts → namn, eller
// foto → Gemini → namn. Namnet söks sedan i Systembolagets sök-API med deras publika frontendnyckel (SB_API_KEY), och
// de bästa träffarna blir kandidater som användaren väljer bland. Hela raden hämtas sedan som vanligt via GET /api/systembolaget.

/** Flash-Lite räcker för att läsa ord från en etikett: cirka en sekund, inga tanketokens, högst gratiskvot. Reserv när den svarar 429/5xx. */
export const GEMINI_MODELS = ['gemini-3.5-flash-lite', 'gemini-flash-lite-latest'] as const
/** Klienten krymper till 1 280 px JPEG (200 till 400 kB). Större än så är ett fel i klienten, inte en större flaska. */
const MAX_IMAGE_CHARS = 3_000_000

// ── Streckkod ────────────────────────────────────────────────────────────────

/** Bara siffror; UPC-A (12) blir EAN-13 med en inledande nolla. */
export function normalizeEan(input: string): string {
  const digits = input.replace(/\D/g, '')
  return digits.length === 12 ? `0${digits}` : digits
}

/** EAN-8 eller EAN-13 med rätt kontrollsiffra. Fångar felläsningar innan de blir en sökning. */
export function validEan(digits: string): boolean {
  if (!/^(\d{8}|\d{13})$/.test(digits)) return false
  const d = digits.split('').map(Number)
  const check = d.pop()!
  // Vikterna växlar 3 och 1 räknat från höger, för både 8 och 13 siffror.
  const sum = d.reduce((acc, n, i) => acc + n * ((d.length - i) % 2 === 1 ? 3 : 1), 0)
  return (10 - (sum % 10)) % 10 === check
}

/** "70 cl", "700 ml", "0,75 l", "1 l" till milliliter. */
export function parseVolume(text: string | null | undefined): number | null {
  const m = text?.replace(',', '.').match(/([\d.]+)\s*(ml|cl|l)\b/i)
  if (!m) return null
  const n = Number(m[1])
  const unit = m[2]!.toLowerCase()
  if (!Number.isFinite(n) || n <= 0) return null
  return Math.round(unit === 'l' ? n * 1000 : unit === 'cl' ? n * 10 : n)
}

/** Open Food Facts kategorier till kind. ponytail: enkel ordmatchning, Systembolagets kategori avgör ändå när kandidaten hämtas. */
function kindOf(categories: string): Kind {
  const c = categories.toLowerCase()
  if (/\b(wine|vin|vino|wein)\b/.test(c)) return 'wine'
  if (/\b(beer|bière|bier|öl|cerveza|ale|lager|ipa|stout)\b/.test(c)) return 'beer'
  return 'spirit'
}

interface OffBody {
  status?: number
  product?: { product_name?: string; brands?: string; quantity?: string; categories?: string }
}

/** Namn, märke och volym för en streckkod hos Open Food Facts, eller null när koden är okänd där. */
export async function findByEan(ean: string): Promise<LabelGuess | null> {
  let response: Response
  try {
    response = await fetch(`https://world.openfoodfacts.org/api/v2/product/${ean}.json?fields=product_name,brands,quantity,categories`, {
      headers: { 'user-agent': 'Flaskor/1.0 (https://buildapp.se/flaskor)' },
    })
  } catch (error) {
    throw new TransientError(`openfoodfacts unreachable: ${String(error)}`)
  }
  if (response.status === 404) return null
  if (!response.ok) throw new TransientError(`openfoodfacts answered ${response.status}`)
  const body = (await response.json()) as OffBody
  const name = body.product?.product_name?.trim()
  if (body.status !== 1 || !name) return null
  return {
    kind: kindOf(body.product?.categories ?? ''),
    name,
    producer: body.product?.brands?.split(',')[0]?.trim() || null,
    category: null,
    vintage: null,
    volume_ml: parseVolume(body.product?.quantity),
    alcohol: null,
    ean,
  }
}

// ── Etikett via Gemini ───────────────────────────────────────────────────────

const PROMPT =
  'Läs etiketten på flaskan i bilden. Svara med JSON: kind (wine, spirit, beer eller other om bilden inte visar en dryck), ' +
  'producer (tillverkare, bryggeri eller destilleri), name (produktnamnet utan producenten), category (till exempel Whisky, Gin, Rom, ' +
  'Rött vin, Vitt vin, IPA), vintage (årgång för vin, annars null), volume_ml, alcohol (procent), ean (siffrorna under streckkoden ' +
  'om de syns, annars null). Gissa inte fält som inte syns i bilden: sätt null.'

const SCHEMA = {
  type: 'OBJECT',
  properties: {
    kind: { type: 'STRING', enum: ['wine', 'spirit', 'beer', 'other'] },
    producer: { type: 'STRING', nullable: true },
    name: { type: 'STRING' },
    category: { type: 'STRING', nullable: true },
    vintage: { type: 'INTEGER', nullable: true },
    volume_ml: { type: 'INTEGER', nullable: true },
    alcohol: { type: 'NUMBER', nullable: true },
    ean: { type: 'STRING', nullable: true },
  },
  required: ['kind', 'name'],
}

function str(v: unknown): string | null {
  return typeof v === 'string' && v.trim() !== '' ? v.trim() : null
}
function num(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v.replace(',', '.')))) return Number(v.replace(',', '.'))
  return null
}

/** Geminis JSON till en gissning. Kastar NotFoundError när bilden inte visade någon dryck. */
export function parseGuess(text: string): LabelGuess {
  let raw: unknown
  try {
    raw = JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1))
  } catch {
    throw new FatalError('gemini answered with something that is not json', 502)
  }
  const o = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>
  const kind = str(o['kind'])
  const name = str(o['name'])
  if (!name || kind === 'other' || (kind !== 'wine' && kind !== 'spirit' && kind !== 'beer')) throw new NotFoundError('no bottle on the picture')
  const vintage = num(o['vintage'])
  const ean = o['ean'] === null || o['ean'] === undefined ? null : normalizeEan(String(o['ean']))
  return {
    kind,
    name,
    producer: str(o['producer']),
    category: str(o['category']),
    vintage: vintage !== null && vintage >= 1900 && vintage <= 2100 ? Math.round(vintage) : null,
    volume_ml: num(o['volume_ml']),
    alcohol: num(o['alcohol']),
    ean: ean && validEan(ean) ? ean : null,
  }
}

interface GeminiBody {
  candidates?: { content?: { parts?: { text?: string }[] } }[]
}

/** Vad etiketten säger, läst av Gemini. Bilden är en data-URL (jpeg, png eller webp) från klienten. */
export async function readLabel(image: string, apiKey: string): Promise<LabelGuess> {
  if (image.length > MAX_IMAGE_CHARS) throw new FatalError('image too large', 413)
  const m = image.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/)
  if (!m) throw new FatalError('image must be a base64 data url (jpeg, png or webp)')
  const body = JSON.stringify({
    contents: [{ parts: [{ inline_data: { mime_type: m[1], data: m[2] } }, { text: PROMPT }] }],
    generationConfig: { responseMimeType: 'application/json', responseSchema: SCHEMA, temperature: 0 },
  })
  let last: TransientError | null = null
  for (const model of GEMINI_MODELS) {
    let response: Response
    try {
      response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: 'POST',
        headers: { 'x-goog-api-key': apiKey, 'content-type': 'application/json' },
        body,
      })
    } catch (error) {
      last = new TransientError(`gemini unreachable: ${String(error)}`)
      continue
    }
    // Kvot slut eller hög belastning: prova reservmodellen. Allt annat som inte är ok är vårt fel (nyckel, format) och kastar direkt.
    if (response.status === 429 || response.status >= 500) {
      last = new TransientError(`gemini ${model} answered ${response.status}`)
      continue
    }
    if (!response.ok) throw new FatalError(`gemini answered ${response.status}: ${(await response.text()).slice(0, 200)}`, 502)
    const text = ((await response.json()) as GeminiBody).candidates?.[0]?.content?.parts?.[0]?.text
    if (!text) throw new FatalError('gemini gave no text', 502)
    return parseGuess(text)
  }
  throw last ?? new TransientError('gemini unavailable')
}

// ── Systembolagets sök ───────────────────────────────────────────────────────

export function searchUrl(query: string): string {
  return `https://api-extern.systembolaget.se/sb-api-ecommerce/v1/productsearch/search?page=1&size=10&sortBy=Score&sortDirection=Ascending&textQuery=${encodeURIComponent(query)}`
}

/**
 * Produkttyper och fyllnadsord som står på etiketten men inte i Systembolagets namn.
 * Utan den här listan vinner "Jack Daniel's Tennessee Honey" över originalet "Jack Daniel's", eftersom etiketten
 * säger "Tennessee Whiskey" och originalet inte gör det (verifierat mot riktiga produkter 2026-09-08).
 * Orden tas bort från båda sidor, så ett märke som heter ett av dem tappar bara sin poäng, aldrig sin plats.
 */
const STOP = new Set([
  'whisky', 'whiskey', 'bourbon', 'scotch', 'tennessee', 'single', 'malt', 'blended', 'rye', 'gin', 'vodka', 'rom', 'rum', 'anejo',
  'tequila', 'mezcal', 'likor', 'liqueur', 'liquor', 'cream', 'coffee', 'kaffe', 'aperitivo', 'aperitif', 'bitter', 'bitters',
  'vin', 'wine', 'vino', 'wein', 'dry', 'london', 'old', 'years', 'year', 'ars', 'ano', 'anos', 'distillery', 'destilleri',
  'company', 'brothers', 'the', 'and', 'och', 'triple', 'sec', 'original', 'reserve', 'premium', 'edition', 'classic', 'extra',
  'fine', 'pure', 'natural', 'imported', 'produce', 'product',
])

/** Diakriter bort: Systembolagets sök ger noll träffar på "Kahlúa" men åtta på "Kahlua" (verifierat 2026-09-08). */
export function strip(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '')
}

/**
 * Jämförelseord: gemener utan diakriter, minst tre tecken eller ett rent en- till tvåsiffrigt tal, utan produkttypsord.
 * Talen måste med: "The Glenlivet 12 Years" och "21 Years Old" skiljs bara av siffran.
 */
export function terms(s: string): string[] {
  return strip(s)
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t !== '' && (t.length >= 3 || /^\d{1,2}$/.test(t)) && !/^(19|20)\d{2}$/.test(t) && !STOP.has(t))
}

/**
 * Sökfrågorna, från hela namnet till bara märket. Systembolagets sök kräver att alla ord finns, så ett fullständigt
 * etikettnamn ger ofta noll träffar ("Jack Daniel's Old No. 7 Tennessee Whiskey": 0, "Jack Daniel's": 13).
 * Alla körs och träffarna slås ihop, i stället för att stanna vid den första som svarar: den kan vara en dålig granne
 * ("Aperol Aperitivo" ger bara "Apéro Aperitif", medan "Aperol" ger rätt flaska).
 */
export function queries(guess: LabelGuess): string[] {
  const words = strip(queryFor(guess)).split(/\s+/).filter(Boolean)
  return [...new Set([words.join(' '), words.slice(0, 2).join(' '), words[0] ?? ''].filter((q) => q !== ''))]
}

interface SearchBody {
  products?: Record<string, unknown>[]
}

/**
 * Träffarna ur sök-API:ts svar. Bilden byggs av productId som på produktsidan (samma CDN, frilagd flaska), men bara
 * när produkten har en bild: `images` är tom för en del varor, och då är den gissade adressen en 404 som visas som
 * en trasig ruta i stället för designens platshållare (upptäckt i Patriks första skanning 2026-09-08).
 */
export function parseSearch(json: unknown): Candidate[] {
  const products = (json as SearchBody)?.products
  if (!Array.isArray(products)) throw new FatalError('systembolaget search answered without products', 502)
  return products
    .filter((p) => typeof p['productNumber'] === 'string' && typeof p['productNameBold'] === 'string')
    .map((p) => ({
      number: String(p['productNumber']),
      name: [p['productNameBold'], str(p['productNameThin'])].filter(Boolean).join(' '),
      producer: str(p['producerName']),
      category: str(p['categoryLevel2']),
      volume_ml: num(p['volume']),
      price: num(p['price']),
      vintage: num(p['vintage']),
      image_url: hasImage(p['images']) && p['productId'] !== undefined && p['productId'] !== null ? imageUrl(String(p['productId'])) : null,
    }))
}

/** Sant när Systembolaget faktiskt har ett flaskfoto för varan. */
export function hasImage(images: unknown): boolean {
  return Array.isArray(images) && images.length > 0
}

export async function searchOnce(query: string, apiKey: string): Promise<Candidate[]> {
  let response: Response
  try {
    response = await fetch(searchUrl(query), { headers: { 'ocp-apim-subscription-key': apiKey, accept: 'application/json' } })
  } catch (error) {
    throw new TransientError(`systembolaget search unreachable: ${String(error)}`)
  }
  if (response.status === 401 || response.status === 403) throw new FatalError('systembolaget search key rejected', 502)
  if (response.status === 429 || response.status >= 500) throw new TransientError(`systembolaget search answered ${response.status}`)
  if (!response.ok) throw new FatalError(`systembolaget search answered ${response.status}`, 502)
  return parseSearch(await response.json())
}

/**
 * Alla sökfrågor för gissningen, körda samtidigt och sammanslagna. Första träffen på ett artikelnummer vinner.
 * En enskild fråga får misslyckas: Systembolaget svarar 429 när flera flaskor skannas tätt (sett 2026-09-08), och
 * två frågor av tre räcker gott. Bara när ingen fråga gick fram kastas felet vidare.
 */
export async function searchProducts(guess: LabelGuess, apiKey: string): Promise<Candidate[]> {
  const rounds = await Promise.allSettled(queries(guess).map((q) => searchOnce(q, apiKey)))
  const ok = rounds.filter((r): r is PromiseFulfilledResult<Candidate[]> => r.status === 'fulfilled')
  if (ok.length === 0) {
    const first = rounds[0]
    throw first && first.status === 'rejected' ? first.reason : new TransientError('systembolaget search failed')
  }
  for (const r of rounds) if (r.status === 'rejected') console.error('search query failed', r.reason)
  const seen = new Set<string>()
  return ok.flatMap((r) => r.value).filter((c) => !seen.has(c.number) && seen.add(c.number))
}

/**
 * De tre bästa träffarna. Poängen är hur lika namnen är åt båda håll (Dice), inte hur många ord som råkar finnas i
 * kandidaten: annars vinner alltid den längsta produkten, eftersom fler ord ger fler chanser att träffa.
 * Kategorin väger tyngre än årgången: färgen på ett vin syns säkert på etiketten, årgången läses ofta fel
 * (2026-09-08 rankades Excellence Rosé före Blanc för att den delade den felästa årgången). Lika poäng: sökmotorns ordning.
 */
export function rank(candidates: Candidate[], guess: LabelGuess): Candidate[] {
  // Unika ord på båda sidor: producenten upprepar ofta märket ("The Absolut Company" plus "Absolut Vodka"),
  // och ett dubblerat ord ska varken belöna eller straffa en kandidat.
  const wanted = [...new Set(terms(queryFor(guess)))]
  const categoryWords = guess.category ? terms(guess.category) : []
  const score = (c: Candidate): number => {
    const have = [...new Set(terms(`${c.producer ?? ''} ${c.name}`))]
    const set = new Set(have)
    const shared = wanted.filter((t) => set.has(t)).length
    let s = wanted.length + have.length === 0 ? 0 : (20 * shared) / (wanted.length + have.length)
    if (guess.volume_ml !== null && c.volume_ml === guess.volume_ml) s += 2
    if (c.category && categoryWords.length > 0 && terms(c.category).some((t) => categoryWords.includes(t))) s += 2
    if (guess.vintage !== null && c.vintage === guess.vintage) s += 1
    return s
  }
  return candidates
    .map((c, i) => ({ c, s: score(c), i }))
    .sort((a, b) => b.s - a.s || a.i - b.i)
    .slice(0, 3)
    .map(({ c }) => c)
}
