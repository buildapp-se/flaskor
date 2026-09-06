import { FatalError } from '../shared/errors.ts'
import type { Kind } from '../shared/types.ts'

// Bulkimport (BACKLOG 40): AI:n svarar med en JSON-lista enligt prompten i strings.ts. Den här läsaren är förlåtande:
// kodstaket, text före och efter listan, artikelnummer med mellanslag, tal som strängar. Rader utan namn hoppas över.

export interface ImportedRow {
  nr: string | null
  name: string
  vintage: number | null
  price: number | null
  count: number
  kind: Kind
}

function num(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string') {
    const n = Number(v.replace(/\s/g, '').replace(',', '.').replace(/[^\d.-]/g, ''))
    return v.trim() !== '' && Number.isFinite(n) ? n : null
  }
  return null
}

export function parseImport(text: string): ImportedRow[] {
  const start = text.indexOf('[')
  const end = text.lastIndexOf(']')
  if (start === -1 || end === -1 || end < start) throw new FatalError('no json list in text')
  let items: unknown
  try {
    items = JSON.parse(text.slice(start, end + 1))
  } catch {
    throw new FatalError('json list does not parse')
  }
  if (!Array.isArray(items)) throw new FatalError('json is not a list')
  const rows: ImportedRow[] = []
  for (const item of items) {
    if (typeof item !== 'object' || item === null) continue
    const o = item as Record<string, unknown>
    const name = typeof o['namn'] === 'string' ? o['namn'].trim() : typeof o['name'] === 'string' ? o['name'].trim() : ''
    if (name === '') continue
    const rawNr = o['nr'] ?? o['artikelnummer'] ?? null
    const digits = rawNr === null || rawNr === undefined ? '' : String(rawNr).replace(/\D/g, '')
    const vintage = num(o['argang'] ?? o['årgång'] ?? o['vintage'])
    const count = num(o['antal'] ?? o['count'])
    const kind = String(o['typ'] ?? o['kind'] ?? 'vin').toLowerCase()
    rows.push({
      nr: /^\d{4,7}$/.test(digits) ? digits : null,
      name,
      vintage: vintage !== null && vintage >= 1900 && vintage <= 2100 ? Math.round(vintage) : null,
      price: num(o['pris'] ?? o['price']),
      count: count !== null && count >= 1 ? Math.round(count) : 1,
      kind: kind === 'sprit' || kind === 'spirit' ? 'spirit' : 'wine',
    })
  }
  return rows
}
