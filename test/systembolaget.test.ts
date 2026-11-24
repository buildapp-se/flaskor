import { readFileSync } from 'node:fs'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { NotFoundError, TransientError } from '../shared/errors.ts'
import { availabilityOf, fetchProduct, parseProductNumber, parseProductPage, splitUsage, toPreview, type Product } from '../worker/src/systembolaget.ts'

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

// Mutationstest 2026-11-24: grenarna fixturerna inte når (status, tillgänglighet, öl, saknad bild, fetch).
const product = (over: Partial<Product> = {}): Product => ({ ...parseProductPage(wine), ...over })

describe('kanterna', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('nummer: fyra till sju siffror rakt av, annars bara sist i en länk', () => {
    expect(parseProductNumber('1101')).toBe('1101')
    expect(() => parseProductNumber('123')).toThrow(/not a product number/)
    expect(() => parseProductNumber('12345678')).toThrow(/not a product number/)
    expect(() => parseProductNumber('https://www.systembolaget.se/produkt/vin/x-1234/')).toThrow(/no product number/)
    expect(() => parseProductNumber('https://www.systembolaget.se/produkt/vin/x-7562401/extra')).toThrow(/no product number/)
  })

  it('sida utan __NEXT_DATA__ är 502, utan produkt 404', () => {
    expect(() => parseProductPage('<html></html>')).toThrow(expect.objectContaining({ status: 502 }))
    expect(() => parseProductPage('<script id="__NEXT_DATA__">{"a":{"productNumber":"1"}}</script>')).toThrow(expect.objectContaining({ status: 404 }))
  })

  it('läser produkten djupt nere, tomma strängar och fel typer blir null', () => {
    const html = `<script id="__NEXT_DATA__" type="application/json">${JSON.stringify({
      props: { x: null, y: [1, { productId: 9, productNumber: '42', productNameBold: 'Öl', productNameThin: ' ', producerName: '', priceInclVat: 'dyr', volume: null, images: [], isDiscontinued: 'true' }] },
    })}</script>`
    expect(parseProductPage(html)).toMatchObject({
      productId: '9',
      productNumber: '42',
      productNameThin: null,
      producerName: null,
      priceInclVat: null,
      volume: null,
      hasImage: false,
      isDiscontinued: false,
    })
  })

  it('tillgänglighet: utgått före slutsåld före leverantör före centrallager', () => {
    const all = { isDiscontinued: true, isCompletelyOutOfStock: true, isSupplierTemporaryNotAvailable: true, isTemporaryOutOfStock: true }
    expect(availabilityOf(product(all))).toBe('discontinued')
    expect(availabilityOf(product({ ...all, isDiscontinued: false }))).toBe('sold_out')
    expect(availabilityOf(product({ ...all, isDiscontinued: false, isCompletelyOutOfStock: false }))).toBe('supplier_out')
    expect(availabilityOf(product({ isTemporaryOutOfStock: true }))).toBe('temporarily_out')
    expect(availabilityOf(product())).toBe('in_stock')
  })

  it('öl blir beer utan fönster; utan bild ingen gissad adress; ursprung i ordningen nivå 2, nivå 1', () => {
    const v = toPreview(product({ categoryLevel1: 'Öl', hasImage: false, originLevel1: 'Bourgogne', originLevel2: 'Chablis', productNameThin: null }))
    expect(v).toMatchObject({ kind: 'beer', image_url: null, region: 'Chablis, Bourgogne', name: "Domaine Georges d'Ibry", drink_from: null, drink_to: null, count: 0, owned: false })
    expect(toPreview(product({ originLevel1: null, originLevel2: null, productId: '' }))).toMatchObject({ region: null, sb_product_id: null, image_url: null })
    expect(toPreview(product({ vintage: null })).vintage).toBeNull()
  })

  it('usage utan temperatur och utan "till" sparas hel som mat; intervall med tankstreck', () => {
    expect(splitUsage('Passar som aperitif')).toEqual({ serve_temp: null, food: 'Passar som aperitif' })
    expect(splitUsage('Serveras vid 10 – 12 °C.')).toEqual({ serve_temp: '10-12', food: null })
    expect(splitUsage('Drick till ost')).toEqual({ serve_temp: null, food: 'ost' })
  })

  it('fetchProduct: bara siffror, 404 NotFound, 429 och 5xx Transient, annan 4xx Fatal 502', async () => {
    await expect(fetchProduct('1/../x')).rejects.toThrow(/digits/)
    const answer = (status: number) => vi.stubGlobal('fetch', async () => new Response('', { status }))
    answer(404)
    await expect(fetchProduct('1')).rejects.toBeInstanceOf(NotFoundError)
    answer(429)
    await expect(fetchProduct('1')).rejects.toBeInstanceOf(TransientError)
    answer(503)
    await expect(fetchProduct('1')).rejects.toBeInstanceOf(TransientError)
    answer(403)
    await expect(fetchProduct('1')).rejects.toThrow(expect.objectContaining({ name: 'FatalError', status: 502 }))
    vi.stubGlobal('fetch', async () => {
      throw new Error('nät')
    })
    await expect(fetchProduct('1')).rejects.toBeInstanceOf(TransientError)
    const urls: string[] = []
    vi.stubGlobal('fetch', async (url: string) => {
      urls.push(url)
      return new Response(spirit)
    })
    expect((await fetchProduct('1101')).productNumber).toBe('1101')
    expect(urls).toEqual(['https://www.systembolaget.se/produkt/vin/x-1101/'])
  })
})
