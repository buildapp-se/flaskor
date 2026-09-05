import type { WindowState } from './types.ts'

/**
 * Pillerlogiken (beslut 12), räknad på dagens datum mot drink_from och drink_to.
 * unknown: fält saknas. wait: före 1 januari drink_from. past: efter 31 december drink_to.
 * soon: inom tolv månader före slutet, alltså kalenderåret drink_to. drink: annars.
 */
export function windowState(from: number | null, to: number | null, today = new Date()): WindowState {
  if (from === null || to === null) return 'unknown'
  const year = today.getFullYear()
  if (year < from) return 'wait'
  if (year > to) return 'past'
  if (year === to) return 'soon'
  return 'drink'
}

/**
 * Tumregeln (beslut 13): år räknade från årgången, nyckel på Systembolagets kategori (nivå 2) och pris.
 * Konstant i koden, skrivs alltid över för hand. Sprit och saknad årgång ger null.
 */
const RULE: Record<string, [[number, number], [number, number], [number, number]]> = {
  'Rött vin': [[0, 3], [1, 6], [2, 10]],
  'Vitt vin': [[0, 2], [0, 4], [1, 8]],
  'Rosévin': [[0, 2], [0, 2], [0, 3]],
  'Mousserande vin': [[0, 2], [0, 4], [1, 8]],
  'Starkvin, söta viner': [[0, 10], [0, 15], [0, 25]],
}

function ruleRow(category: string): [[number, number], [number, number], [number, number]] | null {
  const exact = RULE[category]
  if (exact) return exact
  // Systembolaget skriver starkvin och söta viner under flera nivå 2-namn ("Starkvin", "Dessertvin" o.s.v.).
  if (/starkvin|dessert|söt/i.test(category)) return RULE['Starkvin, söta viner']!
  return null
}

export function ruleOfThumb(
  kind: 'wine' | 'spirit',
  category: string | null,
  vintage: number | null,
  price: number | null,
): { drink_from: number; drink_to: number } | null {
  if (kind !== 'wine' || vintage === null || price === null || category === null) return null
  const row = ruleRow(category)
  if (!row) return null
  const band = price < 150 ? row[0] : price <= 300 ? row[1] : row[2]
  return { drink_from: vintage + band[0], drink_to: vintage + band[1] }
}
