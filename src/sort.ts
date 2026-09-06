import type { Drink } from '../shared/types.ts'

// En sorteringsmekanism för listan och tabellen: nyckel plus riktning, tomma värden alltid sist (beslut 28).
export type SortKey = 'name' | 'vintage' | 'category' | 'country' | 'region' | 'grapes' | 'count' | 'price' | 'total' | 'windowEnd' | 'serve_temp' | 'decant' | 'food' | 'vivino' | 'open_level'
export type SortDir = 'asc' | 'desc'

/** Priset en rad räknas på: inköpspris, annars dagspris. */
export function priceOf(d: Drink): number | null {
  return d.price_paid ?? d.price_current
}

/** Vad raden är värd: antal gånger pris. Rader utan pris räknas som noll i summor. */
export function valueOf(d: Drink): number {
  return d.count * (priceOf(d) ?? 0)
}

export const SORT_VALUE: Record<SortKey, (d: Drink) => number | string | null> = {
  name: (d) => d.name,
  vintage: (d) => d.vintage,
  category: (d) => d.category,
  country: (d) => d.country,
  region: (d) => d.region,
  grapes: (d) => d.grapes,
  count: (d) => d.count,
  price: (d) => priceOf(d),
  total: (d) => (priceOf(d) === null ? null : valueOf(d)),
  windowEnd: (d) => d.drink_to,
  serve_temp: (d) => (d.serve_temp === null ? null : Number.parseInt(d.serve_temp, 10)),
  decant: (d) => d.decant_hours,
  food: (d) => d.food,
  vivino: (d) => d.vivino_rating,
  open_level: (d) => d.open_level,
}

/** Riktningen man vill ha först när nyckeln väljs: dyrast, flest, bäst betyg; annars stigande. */
export const DEFAULT_DIR: Partial<Record<SortKey, SortDir>> = { price: 'desc', total: 'desc', count: 'desc', vivino: 'desc' }

export function compare(key: SortKey, dir: SortDir): (a: Drink, b: Drink) => number {
  const value = SORT_VALUE[key]
  const sign = dir === 'asc' ? 1 : -1
  return (a, b) => {
    const x = value(a)
    const y = value(b)
    if (x === null && y === null) return 0
    if (x === null) return 1
    if (y === null) return -1
    const order = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), 'sv')
    return order * sign
  }
}
