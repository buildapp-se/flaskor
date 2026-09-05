import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { parseProductNumber, parseProductPage, splitUsage, toPreview } from '../worker/src/systembolaget.ts'

// Fixturerna är riktiga produktsidor hämtade med curl 2026-09-05 (worker/test/fixtures/).
const wine = readFileSync('worker/test/fixtures/7562401.html', 'utf8')
const spirit = readFileSync('worker/test/fixtures/1101.html', 'utf8')

describe('parseProductNumber', () => {
  it('tar ett rent nummer', () => expect(parseProductNumber(' 7562401 ')).toBe('7562401'))
  it('tar numret sist i en produktlänk, med och utan avslutande snedstreck', () => {
    expect(parseProductNumber('https://www.systembolaget.se/produkt/vin/chablis-premier-cru-7562401/')).toBe('7562401')
    expect(parseProductNumber('https://www.systembolaget.se/produkt/vin/x-7562401')).toBe('7562401')
  })
  it('kastar på skräp', () => {
    expect(() => parseProductNumber('abc')).toThrow()
    expect(() => parseProductNumber('https://www.systembolaget.se/sortiment/')).toThrow()
  })
})

describe('parseProductPage', () => {
  it('läser vinet ur __NEXT_DATA__', () => {
    const p = parseProductPage(wine)
    expect(p).toMatchObject({
      productId: '50303361',
      productNumber: '7562401',
      productNameBold: "Domaine Georges d'Ibry",
      productNameThin: 'Excellence Blanc',
      producerName: "Domaine Saint-Georges d'Ibry",
      vintage: '2023',
      country: 'Frankrike',
      categoryLevel1: 'Vin',
      categoryLevel2: 'Vitt vin',
      priceInclVat: 164,
      volume: 750,
      alcoholPercentage: 13,
      isDiscontinued: false,
    })
  })
  it('läser spriten', () => {
    const p = parseProductPage(spirit)
    expect(p).toMatchObject({ productNumber: '1101', productNameBold: 'Vanlig Vodka', categoryLevel1: 'Sprit', vintage: null, alcoholPercentage: 37.5 })
    expect(p.taste).toContain('vete')
  })
  it('kastar utan produkt', () => {
    expect(() => parseProductPage('<html></html>')).toThrow()
    expect(() => parseProductPage('<script id="__NEXT_DATA__" type="application/json">{"props":{}}</script>')).toThrow()
  })
})

describe('toPreview', () => {
  it('vin: namn, källa, bild och fönster från tumregeln', () => {
    const v = toPreview(parseProductPage(wine), new Date('2026-09-05T10:00:00Z'))
    expect(v.kind).toBe('wine')
    expect(v.owned).toBe(false)
    expect(v.name).toBe("Domaine Georges d'Ibry Excellence Blanc")
    expect(v.source_kind).toBe('systembolaget')
    expect(v.source_id).toBe('7562401')
    expect(v.source_url).toBe('https://www.systembolaget.se/produkt/vin/x-7562401/')
    expect(v.image_url).toBe('https://product-cdn.systembolaget.se/productimages/50303361/50303361_200.webp')
    expect(v.price_current).toBe(164)
    expect(v.availability).toBe('in_stock')
    // Vitt vin, 150 till 300 kr: +0 till +4 från 2023
    expect(v.drink_from).toBe(2023)
    expect(v.drink_to).toBe(2027)
  })
  it('sprit: kind spirit, inget fönster, usage till mat', () => {
    const v = toPreview(parseProductPage(spirit))
    expect(v.kind).toBe('spirit')
    expect(v.vintage).toBeNull()
    expect(v.drink_from).toBeNull()
    expect(v.drink_to).toBeNull()
    expect(v.food).toContain('snaps')
  })
})

describe('splitUsage', () => {
  it('bryter ut temperatur och mat', () => {
    expect(splitUsage('Serveras vid cirka 16-18°C till rätter av lamm- eller nötkött.')).toEqual({ serve_temp: '16-18', food: 'rätter av lamm- eller nötkött' })
    expect(splitUsage('Serveras vid 8°C som apéritif eller till skaldjur.')).toEqual({ serve_temp: '8', food: 'skaldjur' })
    expect(splitUsage(null)).toEqual({ serve_temp: null, food: null })
  })
})
