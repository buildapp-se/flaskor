// Spegeln av Systembolagets sortiment (migrering 0006, beslut 23). Källan är tredjepartsdumpen
// https://susbolaget.emrik.org/v1/products (C4illin/systembolaget-data): 100 MB JSON, 8 MB gzip, ny 03:00 varje natt.
// Hela filen i minnet tar 289 MB och Workern har 128, så den strömmas och delas upp i toppnivåobjekt (0,57 s CPU,
// 47 MB toppminne mätt 2026-09-12). Rader skrivs i batchar och det som inte längre finns i dumpen tas bort.
import { FatalError, NotFoundError, TransientError } from '../../shared/errors.ts'
import type { Candidate } from '../../shared/types.ts'
import { strip } from './scan.ts'
import { imageUrl, type Product } from './systembolaget.ts'

export const DUMP_URL = 'https://susbolaget.emrik.org/v1/products'
/** Spegeln räknas som färsk så här länge efter importen. Dumpen förnyas var 24:e timme, så 36 tål en missad natt. */
const FRESH_HOURS = 36
const ROWS_PER_STATEMENT = 20
const STATEMENTS_PER_BATCH = 50

/**
 * Delar en ström av JSON-text (en array av objekt) i färdiga toppnivåobjekt utan att hålla hela texten.
 * Strängmedveten: klamrar inne i strängar räknas inte. Skanningen återupptas efter bärtexten, annars räknas
 * klamrarna om per chunk och tiden blir kvadratisk (första försöket tog över två minuter på 100 MB).
 */
export function objectSplitter(): TransformStream<string, unknown> {
  let depth = 0
  let inString = false
  let escaped = false
  let start = -1
  let carry = ''
  return new TransformStream<string, unknown>({
    transform(chunk, controller) {
      const text = carry + chunk
      for (let i = carry.length; i < text.length; i++) {
        const ch = text[i]
        if (inString) {
          if (escaped) escaped = false
          else if (ch === '\\') escaped = true
          else if (ch === '"') inString = false
          continue
        }
        if (ch === '"') inString = true
        else if (ch === '{') {
          if (depth === 0) start = i
          depth++
        } else if (ch === '}') {
          depth--
          if (depth === 0) {
            controller.enqueue(JSON.parse(text.slice(start, i + 1)))
            start = -1
          }
        }
      }
      carry = start >= 0 ? text.slice(start) : ''
      if (start >= 0) start = 0
    },
  })
}

function str(v: unknown): string | null {
  return typeof v === 'string' && v.trim() !== '' ? v : null
}
function num(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}

/** Dumpens rad till vår Product. Fältnamnen är Systembolagets egna utom `price` (produktsidan säger `priceInclVat`) och `grapes` (lista, inte text). */
export function fromDump(raw: Record<string, unknown>): Product {
  if (typeof raw['productNumber'] !== 'string' || typeof raw['productNameBold'] !== 'string') throw new FatalError('dump row without number or name', 502)
  const grapes = raw['grapes']
  return {
    productId: String(raw['productId']),
    productNumber: raw['productNumber'],
    productNameBold: raw['productNameBold'],
    productNameThin: str(raw['productNameThin']),
    producerName: str(raw['producerName']),
    vintage: str(raw['vintage']),
    country: str(raw['country']),
    originLevel1: str(raw['originLevel1']),
    originLevel2: str(raw['originLevel2']),
    categoryLevel1: str(raw['categoryLevel1']),
    categoryLevel2: str(raw['categoryLevel2']),
    categoryLevel3: str(raw['categoryLevel3']),
    grapes: Array.isArray(grapes) ? str(grapes.filter((g) => typeof g === 'string').join(', ')) : str(grapes),
    priceInclVat: num(raw['price']),
    volume: num(raw['volume']),
    alcoholPercentage: num(raw['alcoholPercentage']),
    usage: str(raw['usage']),
    taste: str(raw['taste']),
    isTemporaryOutOfStock: raw['isTemporaryOutOfStock'] === true,
    isCompletelyOutOfStock: raw['isCompletelyOutOfStock'] === true,
    isDiscontinued: raw['isDiscontinued'] === true,
    hasImage: Array.isArray(raw['images']) && raw['images'].length > 0,
  }
}

/** Söktexten: namn och producent i gemener utan diakriter, så "Kahlúa" och "kahlua" är samma sak. */
export function searchText(p: Product): string {
  return strip([p.productNameBold, p.productNameThin, p.producerName].filter(Boolean).join(' ')).toLowerCase()
}

/** Sökord ur en fråga: gemener utan diakriter, bara bokstäver och siffror. Tomt när frågan inte bär något ord. */
export function searchTerms(query: string): string[] {
  return strip(query).toLowerCase().split(/[^a-z0-9]+/).filter(Boolean)
}

export interface ImportResult {
  rows: number
  removed: number
  imported_at: string
}

/** Strömmar dumpen in i sb_product. Rader som inte kom med i den här körningen tas bort. */
export async function importAssortment(db: D1Database, url = DUMP_URL): Promise<ImportResult> {
  let response: Response
  try {
    response = await fetch(url, { headers: { accept: 'application/json' } })
  } catch (error) {
    throw new TransientError(`dump unreachable: ${String(error)}`)
  }
  if (response.status === 429 || response.status >= 500) throw new TransientError(`dump answered ${response.status}`)
  if (!response.ok || !response.body) throw new FatalError(`dump answered ${response.status}`, 502)

  const imported_at = new Date().toISOString()
  const insert = db.prepare(
    `INSERT OR REPLACE INTO sb_product (number, search, json, updated_at) VALUES ${Array(ROWS_PER_STATEMENT).fill('(?, ?, ?, ?)').join(', ')}`,
  )
  let rows = 0
  let pending: unknown[] = []
  let statements: D1PreparedStatement[] = []
  const flush = async (): Promise<void> => {
    if (pending.length > 0) {
      // Sista satsen är kortare än de andra: en egen sats med rätt antal platser.
      const short = db.prepare(`INSERT OR REPLACE INTO sb_product (number, search, json, updated_at) VALUES ${Array(pending.length / 4).fill('(?, ?, ?, ?)').join(', ')}`)
      statements.push(short.bind(...pending))
      pending = []
    }
    if (statements.length > 0) await db.batch(statements)
    statements = []
  }

  const reader = response.body.pipeThrough(new TextDecoderStream()).pipeThrough(objectSplitter()).getReader()
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    const p = fromDump(value as Record<string, unknown>)
    pending.push(p.productNumber, searchText(p), JSON.stringify(p), imported_at)
    rows++
    if (pending.length === ROWS_PER_STATEMENT * 4) {
      statements.push(insert.bind(...pending))
      pending = []
      if (statements.length === STATEMENTS_PER_BATCH) await flush()
    }
  }
  await flush()
  if (rows === 0) throw new FatalError('dump held no products', 502)

  const removed = (await db.prepare('DELETE FROM sb_product WHERE updated_at < ?').bind(imported_at).run()).meta.changes
  await db.batch([
    db.prepare("INSERT OR REPLACE INTO sb_meta (key, value) VALUES ('imported_at', ?)").bind(imported_at),
    db.prepare("INSERT OR REPLACE INTO sb_meta (key, value) VALUES ('rows', ?)").bind(String(rows)),
  ])
  return { rows, removed, imported_at }
}

/** När spegeln senast fylldes, eller null om aldrig. */
export async function importedAt(db: D1Database): Promise<string | null> {
  const row = await db.prepare("SELECT value FROM sb_meta WHERE key = 'imported_at'").first<{ value: string }>()
  return row?.value ?? null
}

/** Sant när spegeln fylldes de senaste 36 timmarna. Äldre än så litar nattens uppdatering inte på den. */
export async function isFresh(db: D1Database, now = new Date()): Promise<boolean> {
  const at = await importedAt(db)
  return at !== null && now.getTime() - new Date(at).getTime() < FRESH_HOURS * 3600 * 1000
}

/** Produkten ur spegeln. Kastar NotFoundError när numret inte finns där (vilket inte bevisar att varan utgått). */
export async function getMirrored(db: D1Database, number: string): Promise<Product> {
  const row = await db.prepare('SELECT json FROM sb_product WHERE number = ?').bind(number).first<{ json: string }>()
  if (!row) throw new NotFoundError(`product ${number} not in mirror`)
  return JSON.parse(row.json) as Product
}

/** Samma form som Systembolagets sök ger, så klienten inte ser skillnad på källa. */
export function toCandidate(p: Product): Candidate {
  return {
    number: p.productNumber,
    name: [p.productNameBold, p.productNameThin].filter(Boolean).join(' '),
    producer: p.producerName,
    category: p.categoryLevel2,
    volume_ml: p.volume,
    price: p.priceInclVat,
    vintage: p.vintage ? Number(p.vintage) : null,
    image_url: p.hasImage ? imageUrl(p.productId) : null,
  }
}

/**
 * Sök i spegeln: alla ord måste finnas i namn eller producent, kortast namn först (närmast frågan).
 * ponytail: LIKE över 27 000 rader tar några millisekunder; FTS5 (finns i D1) är uppgraderingen om rankningen behöver bli bättre.
 */
export async function searchMirror(db: D1Database, query: string, limit = 10): Promise<Candidate[]> {
  const terms = searchTerms(query)
  if (terms.length === 0) return []
  const where = terms.map(() => 'search LIKE ?').join(' AND ')
  const { results } = await db
    .prepare(`SELECT json FROM sb_product WHERE ${where} ORDER BY length(search) LIMIT ?`)
    .bind(...terms.map((t) => `%${t}%`), limit)
    .all<{ json: string }>()
  return results.map((r) => toCandidate(JSON.parse(r.json) as Product))
}
