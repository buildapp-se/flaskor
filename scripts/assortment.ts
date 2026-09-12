// Nattens spegelimport (migrering 0006, beslut 23). Körs av GitHub Actions (.github/workflows/assortment.yml)
// 03:30 svensk sommartid, och för hand med:
//   FLASKOR_GATE_CODE=<grindkoden> npm run assortment
//   FLASKOR_API=http://127.0.0.1:8787 för en lokal Worker.
// Laddar hela dumpen (100 MB, 8 MB gzip), skalar varje rad till fälten Workern läser och postar 300 rader åt gången
// till POST /api/assortment, sist ett avslutningsanrop som rensar gamla rader och stämplar spegeln som färsk.
// Workern får inte göra det här själv: parsningen kostade 2 s CPU för 9 000 rader och dog på fel 1102 (2026-09-12).
import { CHUNK_ROWS, DUMP_FIELDS, type AssortmentChunk, type AssortmentResult } from '../shared/assortment.ts'

const DUMP_URL = 'https://susbolaget.emrik.org/v1/products'
const api = (process.env['FLASKOR_API'] ?? 'https://flaskor-api.buildapp.se').replace(/\/$/, '')
const code = process.env['FLASKOR_GATE_CODE']
if (!code) {
  console.error('FLASKOR_GATE_CODE saknas')
  process.exit(2)
}

/** Bara fälten Workern läser: rå rad är 3,7 kB med bildbilagor, skalad cirka 500 byte. */
export function slim(raw: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const key of DUMP_FIELDS) if (key in raw) out[key] = raw[key]
  return out
}

async function post(body: AssortmentChunk): Promise<AssortmentResult> {
  const response = await fetch(`${api}/api/assortment`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${code}` },
    body: JSON.stringify(body),
  })
  if (!response.ok) throw new Error(`POST /api/assortment ${response.status}: ${await response.text()}`)
  return (await response.json()) as AssortmentResult
}

const started = Date.now()
const response = await fetch(DUMP_URL, { headers: { accept: 'application/json' } })
if (!response.ok) throw new Error(`dumpen svarade ${response.status}`)
const dump = (await response.json()) as Record<string, unknown>[]
if (!Array.isArray(dump) || dump.length < 10_000) throw new Error(`dumpen bar ${Array.isArray(dump) ? dump.length : 'inga'} rader, förväntade tiotusentals`)

const run = new Date().toISOString()
let sent = 0
for (let i = 0; i < dump.length; i += CHUNK_ROWS) {
  sent += (await post({ run, rows: dump.slice(i, i + CHUNK_ROWS).map(slim) })).upserted
}
const { rows, removed } = await post({ run, done: true })
if (rows !== dump.length) throw new Error(`spegeln har ${rows} rader men dumpen ${dump.length}`)
console.log(`ok: ${rows} rader speglade (${sent} skickade, ${removed} gamla borttagna) på ${Math.round((Date.now() - started) / 1000)} s, körning ${run}`)
