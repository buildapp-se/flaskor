import { describe, expect, it } from 'vitest'
import type { Drink } from '../shared/types.ts'
import { compare, valueOf } from './sort.ts'

function drink(over: Partial<Drink>): Drink {
  return { id: 0, household_id: 1, kind: 'wine', owned: true, name: '', producer: null, vintage: null, country: null, region: null, category: null, style: null, grapes: null, volume_ml: null, alcohol: null, source_kind: 'manual', source_id: null, source_url: null, image_url: null, price_paid: null, price_current: null, price_checked_at: null, availability: 'unknown', count: 0, open_level: null, drink_from: null, drink_to: null, serve_temp: null, decant_hours: null, food: null, note: null, taste: null, vivino_rating: null, vivino_count: null, vivino_url: null, vivino_checked_at: null, created_at: '', updated_at: '', ...over }
}

describe('sortering (beslut 28)', () => {
  const rows = [drink({ name: 'Örjan', price_paid: 100, count: 2 }), drink({ name: 'Anna', price_paid: null, price_current: 300, count: 1 }), drink({ name: 'Ärla', price_paid: 200, count: 0 })]

  it('pris fallande, inköpspris före dagspris', () => {
    expect([...rows].sort(compare('price', 'desc')).map((d) => d.name)).toEqual(['Anna', 'Ärla', 'Örjan'])
    expect([...rows].sort(compare('price', 'asc')).map((d) => d.name)).toEqual(['Örjan', 'Ärla', 'Anna'])
  })
  it('svensk bokstavsordning', () => {
    expect([...rows].sort(compare('name', 'asc')).map((d) => d.name)).toEqual(['Anna', 'Ärla', 'Örjan'])
  })
  it('tomma värden sist oavsett riktning', () => {
    expect([...rows].sort(compare('vintage', 'asc')).map((d) => d.name)).toEqual(['Örjan', 'Anna', 'Ärla'])
    const withYear = [drink({ name: 'a', vintage: 2019 }), drink({ name: 'b' }), drink({ name: 'c', vintage: 2022 })]
    expect(withYear.sort(compare('vintage', 'desc')).map((d) => d.name)).toEqual(['c', 'a', 'b'])
  })
  it('värde är antal gånger pris, saknat pris räknas som noll', () => {
    expect(rows.map(valueOf)).toEqual([200, 300, 0])
  })
})
