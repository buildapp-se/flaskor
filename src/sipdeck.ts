import type { Drink } from '../shared/types.ts'

// Länkarna till Sipdeck (ADR 0001). Flaskor skickar bara det som står på raden; vilken ingrediens flaskan är
// avgör Sipdeck med sina egna granskade regler, samma som kopplingen använder.
export const SIPDECK_URL = 'https://buildapp.se/sipdeck/'

/** "Se drinkar med det här i Sipdeck": fungerar utan konto och utan koppling. */
export function drinksLink(d: Pick<Drink, 'kind' | 'name' | 'producer' | 'category' | 'style' | 'country' | 'region' | 'source_kind' | 'source_id'>): string {
  const q = new URLSearchParams({ n: d.name, k: d.kind })
  for (const [key, value] of [['p', d.producer], ['c', d.category], ['s', d.style], ['o', d.country], ['r', d.region]] as const) if (value) q.set(key, value)
  if (d.source_kind === 'systembolaget' && d.source_id) q.set('ref', `sb:${d.source_id}`)
  return `${SIPDECK_URL}#/med/${encodeURIComponent(q.toString())}`
}

/** Engångskoden i adressens fragment: den skickas aldrig till en server på vägen dit. */
export function linkUrl(code: string): string {
  return `${SIPDECK_URL}#/hemma/koppla/${code}`
}
