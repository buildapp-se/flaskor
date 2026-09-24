import { describe, expect, it } from 'vitest'
import type { Drink } from '../shared/types.ts'
import { compare, valueOf } from './sort.ts'

function drink(over: Partial<Drink>): Drink {
  return { id: 0, household_id: 1, kind: 'wine', owned: true, name: '', producer: null, vintage: null, country: null, region: null, category: null, style: null, grapes: null, volume_ml: null, alcohol: null, source_kind: 'manual', source_id: null, source_url: null, image_url: null, sb_product_id: null, sb_assortment: null, price_paid: null, price_current: null, price_checked_at: null, availability: 'unknown', count: 0, open_level: null, drink_from: null, drink_to: null, serve_temp: null, decant_hours: null, food: null, note: null, taste: null, vivino_rating: null, vivino_count: null, vivino_url: null, vivino_checked_at: null, rating: null, rating_url: null, last_drunk_on: null, last_rating: null, tasting_count: 0, created_at: '', updated_at: '', ...over }
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
  it('senast drucken sorterar på datum, aldrig druckna sist', () => {
    const drunk = [drink({ name: 'a', last_drunk_on: '2026-01-05' }), drink({ name: 'b' }), drink({ name: 'c', last_drunk_on: '2026-09-09' })]
    expect([...drunk].sort(compare('lastDrunk', 'desc')).map((d) => d.name)).toEqual(['c', 'a', 'b'])
    expect([...drunk].sort(compare('lastDrunk', 'asc')).map((d) => d.name)).toEqual(['a', 'c', 'b'])
  })
  it('värde är antal gånger pris, saknat pris räknas som noll', () => {
    expect(rows.map(valueOf)).toEqual([200, 300, 0])
  })
  it('sorterar på count (numeriskt)', () => {
    const counts = [drink({ name: 'c', count: 10 }), drink({ name: 'a', count: 2 }), drink({ name: 'b', count: 20 })]
    expect([...counts].sort(compare('count', 'asc')).map((d) => d.name)).toEqual(['a', 'c', 'b'])
    expect([...counts].sort(compare('count', 'desc')).map((d) => d.name)).toEqual(['b', 'c', 'a'])
  })
  it('sorterar på total', () => {
    const arr = [
      drink({ name: 'b', price_paid: 100, count: 2 }),
      drink({ name: 'nullPrice', price_paid: null, price_current: null, count: 5 }),
      drink({ name: 'a', price_paid: 300, count: 1 }),
    ]
    expect([...arr].sort(compare('total', 'desc')).map((d) => d.name)).toEqual(['a', 'b', 'nullPrice'])
    expect([...arr].sort(compare('total', 'asc')).map((d) => d.name)).toEqual(['b', 'a', 'nullPrice'])
  })
  it('sorterar på strängfält', () => {
    const arr = [drink({ name: 'c', country: 'Sverige', category: 'Rött', region: 'Skåne', grapes: 'Syrah' }), drink({ name: 'a', country: 'Frankrike', category: 'Vitt', region: 'Bordeaux', grapes: 'Merlot' })]
    expect([...arr].sort(compare('country', 'asc')).map((d) => d.name)).toEqual(['a', 'c'])
    expect([...arr].sort(compare('category', 'asc')).map((d) => d.name)).toEqual(['c', 'a'])
    expect([...arr].sort(compare('region', 'asc')).map((d) => d.name)).toEqual(['a', 'c'])
    expect([...arr].sort(compare('grapes', 'asc')).map((d) => d.name)).toEqual(['a', 'c'])
  })
  it('sorterar på serve_temp genom att parsa nummer', () => {
    const arr = [drink({ name: 'b', serve_temp: '8 °C' }), drink({ name: 'a', serve_temp: '16-18' })]
    expect([...arr].sort(compare('serve_temp', 'asc')).map((d) => d.name)).toEqual(['b', 'a'])
  })
  it('serve_temp utan siffror hamnar sist som saknat värde', () => {
    const arr = [drink({ name: 'rum', serve_temp: 'Rumstemperatur' }), drink({ name: 'b', serve_temp: '8 °C' }), drink({ name: 'a', serve_temp: '16-18' })]
    expect([...arr].sort(compare('serve_temp', 'asc')).map((d) => d.name)).toEqual(['b', 'a', 'rum'])
    expect([...arr].sort(compare('serve_temp', 'desc')).map((d) => d.name)).toEqual(['a', 'b', 'rum'])
  })
  it('sorterar på vivino, faller tillbaka på rating', () => {
    const arr = [drink({ name: 'c', vivino_rating: null, rating: null }), drink({ name: 'a', vivino_rating: 4.5, rating: null }), drink({ name: 'b', vivino_rating: null, rating: 4.0 })]
    expect([...arr].sort(compare('vivino', 'desc')).map((d) => d.name)).toEqual(['a', 'b', 'c'])
  })
  it('null-värden är stabila', () => {
    const arr = [drink({ name: 'null1', vintage: null }), drink({ name: 'null2', vintage: null }), drink({ name: 'a', vintage: 2022 })]
    expect([...arr].sort(compare('vintage', 'asc')).map((d) => d.name)).toEqual(['a', 'null1', 'null2'])
    expect([...arr].sort(compare('vintage', 'desc')).map((d) => d.name)).toEqual(['a', 'null1', 'null2'])
  })
})
