import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { parseCavisteUrl, parseCavistePage, parseDecant, parseGrapes, parseHeading } from '../worker/src/caviste.ts'

// Riktig produktsida hämtad 2026-09-09: CAV0143, tre viner från Colombera & Garella.
const page = readFileSync('worker/test/fixtures/caviste-cav0143.html', 'utf8')
const URL = 'https://www.caviste.se/cav/cav0143-colombera-garella/'

describe('caviste-länken', () => {
  it('tar CAV-numret utan inledande nollor', () => {
    expect(parseCavisteUrl(URL).number).toBe('143')
    expect(parseCavisteUrl('https://caviste.se/cav/cav0007-nagot/').number).toBe('7')
  })
  it('kastar på andra sajter och på sidor utan CAV-nummer', () => {
    expect(() => parseCavisteUrl('https://www.systembolaget.se/produkt/vin/x-1101/')).toThrow(/not a caviste/)
    expect(() => parseCavisteUrl('https://www.caviste.se/om-oss/')).toThrow(/no cav number/)
    expect(() => parseCavisteUrl('bara text')).toThrow(/not a caviste/)
  })
})

describe('rubriken per vin', () => {
  it('läser antal, årgång, namn och pris', () => {
    expect(parseHeading('3 flaskor 2020 Colombera &amp; Garella Coste della Sesia &#8211; 155 kr/st <a href="x">[.pdf]</a>')).toEqual({
      count: 3,
      vintage: 2020,
      name: 'Colombera & Garella Coste della Sesia',
      price: 155,
    })
  })
  it('tål "1 flaska" och pris utan /st', () => {
    expect(parseHeading('1 flaska 2018 Lessona &#8211; 275 kr')).toMatchObject({ count: 1, price: 275, name: 'Lessona' })
  })
  it('kastar när rubriken inte ser ut som en flaskrad', () => {
    expect(() => parseHeading('Ytterligare information')).toThrow(/not understood/)
  })
})

describe('fältplock', () => {
  it('druvor utan andelar, i ordning och utan dubbletter', () => {
    expect(parseGrapes('70% nebbiolo, 15% vespolina & 15% croatina.')).toBe('nebbiolo, vespolina, croatina')
    expect(parseGrapes('100% nebbiolo.')).toBe('nebbiolo')
    expect(parseGrapes('Ingen procent här')).toBeNull()
  })
  it('karaffering i timmar, "Nej" blir ingen', () => {
    expect(parseDecant('Drick: 2022-2028. Karafferas: 1 tim.')).toBe(1)
    expect(parseDecant('Karafferas: Nej.')).toBeNull()
    expect(parseDecant('inget om karaffering')).toBeNull()
  })
})

describe('hela sidan', () => {
  const wines = parseCavistePage(page, '143', URL, new Date('2026-09-09T10:00:00Z'))

  it('ger lådans tre viner i sidans ordning', () => {
    expect(wines.map((w) => w.name)).toEqual([
      'Colombera & Garella Coste della Sesia',
      'Colombera & Garella Bramaterra',
      'Colombera & Garella Lessona',
    ])
  })

  it('första vinet får hela raden ur sidan', () => {
    const w = wines[0]!
    expect(w).toMatchObject({
      kind: 'wine',
      count: 3,
      vintage: 2020,
      price_current: 155,
      category: 'Rött vin',
      region: 'DOC Coste della Sesia',
      grapes: 'nebbiolo, vespolina, croatina',
      alcohol: 12.5,
      drink_from: 2021,
      drink_to: 2026,
      serve_temp: '16',
      decant_hours: null,
      source_kind: 'caviste',
      source_id: '143',
    })
    expect(w.image_url).toBe('https://www.caviste.se/wp-content/uploads/2021/11/CAV0143-webb-Sesia.jpg')
    expect(w.taste).toContain('Ren och frisk doft')
    expect(w.food).toContain('Tagliatelle')
  })

  it('varje vin får sin egen flaskbild, inte lådans gruppbild', () => {
    expect(wines.map((w) => w.image_url)).toEqual([
      'https://www.caviste.se/wp-content/uploads/2021/11/CAV0143-webb-Sesia.jpg',
      'https://www.caviste.se/wp-content/uploads/2021/11/CAV0143-webb-Bramaterra.jpg',
      'https://www.caviste.se/wp-content/uploads/2021/11/CAV0143-webb-Lessona.jpg',
    ])
  })

  it('karaffering läses per vin', () => {
    expect(wines.map((w) => w.decant_hours)).toEqual([null, 1, 1])
  })

  it('kastar när sidan inte har någon innehållstabell', () => {
    expect(() => parseCavistePage('<html><body>inget här</body></html>', '143', URL)).toThrow(/no bottle table/)
  })
})
