// Spegeln av Systembolagets sortiment (migrering 0006, beslut 23). Källan är tredjepartsdumpen
// https://susbolaget.emrik.org/v1/products (C4illin/systembolaget-data): 100 MB JSON, 27 035 rader, ny 03:00 varje natt.
// Workern läser den inte själv: att strömma och parsa den kostade 2 s CPU för 9 000 rader i molnet och dog på
// Cloudflares fel 1102 (2026-09-12). I stället laddar scripts/assortment.ts ner den i GitHub Actions varje natt och
// postar den hit i bitar om 300 rader (shared/assortment.ts), så varje anrop är några millisekunder.
import { FatalError, NotFoundError } from '../../shared/errors.ts'
import type { AssortmentResult } from '../../shared/assortment.ts'
import type { Candidate } from '../../shared/types.ts'
import { strip } from './scan.ts'
import { imageUrl, type Product } from './systembolaget.ts'

/** Spegeln räknas som färsk så här länge efter importen. Dumpen förnyas var 24:e timme, så 36 tål en missad natt. */
const FRESH_HOURS = 36
const ROWS_PER_STATEMENT = 20
const MAX_ROWS_PER_CALL = 1000

function str(v: unknown): string | null {
  return typeof v === 'string' && v.trim() !== '' ? v : null
}
function num(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}

/** Dumpens rad till vår Product. Fältnamnen är Systembolagets egna utom `price` (produktsidan säger `priceInclVat`) och `grapes` (lista, inte text). */
export function fromDump(raw: unknown): Product {
  if (typeof raw !== 'object' || raw === null) throw new FatalError('dump row must be an object')
  const r = raw as Record<string, unknown>
  if (typeof r['productNumber'] !== 'string' || typeof r['productNameBold'] !== 'string') throw new FatalError('dump row without number or name')
  const grapes = r['grapes']
  return {
    productId: String(r['productId']),
    productNumber: r['productNumber'],
    productNameBold: r['productNameBold'],
    productNameThin: str(r['productNameThin']),
    producerName: str(r['producerName']),
    vintage: str(r['vintage']),
    country: str(r['country']),
    originLevel1: str(r['originLevel1']),
    originLevel2: str(r['originLevel2']),
    categoryLevel1: str(r['categoryLevel1']),
    categoryLevel2: str(r['categoryLevel2']),
    categoryLevel3: str(r['categoryLevel3']),
    grapes: Array.isArray(grapes) ? str(grapes.filter((g) => typeof g === 'string').join(', ')) : str(grapes),
    priceInclVat: num(r['price']),
    volume: num(r['volume']),
    alcoholPercentage: num(r['alcoholPercentage']),
    usage: str(r['usage']),
    taste: str(r['taste']),
    isTemporaryOutOfStock: r['isTemporaryOutOfStock'] === true,
    isCompletelyOutOfStock: r['isCompletelyOutOfStock'] === true,
    isDiscontinued: r['isDiscontinued'] === true,
    hasImage: Array.isArray(r['images']) && r['images'].length > 0,
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

/** Körningens id måste vara en riktig ISO-tid: det jämförs som text mot updated_at när gamla rader rensas. */
export function validRun(run: unknown): run is string {
  return typeof run === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/.test(run) && !Number.isNaN(Date.parse(run))
}

/** Skriver en bit av dumpen till spegeln, alla rader stämplade med körningen. Ger antalet rader. */
export async function upsertAssortment(db: D1Database, run: string, rows: unknown[]): Promise<number> {
  if (!validRun(run)) throw new FatalError('run must be an ISO timestamp')
  if (rows.length === 0) return 0
  if (rows.length > MAX_ROWS_PER_CALL) throw new FatalError(`at most ${MAX_ROWS_PER_CALL} rows per call`)
  const products = rows.map(fromDump)
  const statements: D1PreparedStatement[] = []
  for (let i = 0; i < products.length; i += ROWS_PER_STATEMENT) {
    const slice = products.slice(i, i + ROWS_PER_STATEMENT)
    const sql = `INSERT OR REPLACE INTO sb_product (number, search, json, updated_at) VALUES ${slice.map(() => '(?, ?, ?, ?)').join(', ')}`
    statements.push(db.prepare(sql).bind(...slice.flatMap((p) => [p.productNumber, searchText(p), JSON.stringify(p), run])))
  }
  await db.batch(statements)
  return products.length
}

/** Avslutar körningen: rader från äldre körningar bort, spegeln stämplad som färsk. Kastar om körningen inte skrev något. */
export async function finishAssortment(db: D1Database, run: string): Promise<Pick<AssortmentResult, 'rows' | 'removed'>> {
  if (!validRun(run)) throw new FatalError('run must be an ISO timestamp')
  const rows = (await db.prepare('SELECT count(*) AS n FROM sb_product WHERE updated_at = ?').bind(run).first<{ n: number }>())?.n ?? 0
  if (rows === 0) throw new FatalError('run wrote no rows, refusing to empty the mirror')
  const removed = (await db.prepare('DELETE FROM sb_product WHERE updated_at < ?').bind(run).run()).meta.changes
  await db.batch([
    db.prepare("INSERT OR REPLACE INTO sb_meta (key, value) VALUES ('imported_at', ?)").bind(run),
    db.prepare("INSERT OR REPLACE INTO sb_meta (key, value) VALUES ('rows', ?)").bind(String(rows)),
  ])
  return { rows, removed }
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
