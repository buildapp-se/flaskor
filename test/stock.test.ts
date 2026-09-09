import { describe, expect, it } from 'vitest'
import { parseStock, stockUrl, validStore } from '../worker/src/stock.ts'
import { parseTitle, storeId } from '../scripts/stores.ts'

// Svaret är klippt ur ett riktigt anrop 2026-09-09: butik 2401 (Umeå, Rådhusesplanaden), Absolut Vodka 700 ml.
const REAL = { productId: '164', storeId: '2401', shelf: '14-04-03', stock: 48, isInStoreAssortment: true }

describe('stock', () => {
  it('läser saldo, hyllplats och sortiment', () => {
    expect(parseStock(REAL)).toEqual({ stock: 48, shelf: '14-04-03', in_assortment: true })
  })

  it('tom hyllplats blir null, inte tom sträng', () => {
    expect(parseStock({ ...REAL, shelf: null, stock: 0, isInStoreAssortment: false })).toEqual({ stock: 0, shelf: null, in_assortment: false })
    expect(parseStock({ ...REAL, shelf: '' }).shelf).toBeNull()
  })

  it('kastar när svaret saknar saldo', () => {
    expect(() => parseStock({ storeId: '2401' })).toThrow(/without stock/)
  })

  it('släpper bara igenom fyrsiffriga butiksnummer i URL:en', () => {
    expect(validStore('2401')).toBe(true)
    expect(validStore('24')).toBe(false)
    expect(validStore('../../x')).toBe(false)
    expect(stockUrl('2401', '164')).toBe('https://api-extern.systembolaget.se/sb-api-ecommerce/v1/stockbalance/store/2401/164')
  })
})

describe('butikslistan', () => {
  it('tar butiksnumret ur sitemap-adressen', () => {
    expect(storeId('https://www.systembolaget.se/butiker-ombud/butik/vasterbottens-lan/umea/radhusesplanaden-6-e-2401/')).toBe('2401')
    expect(storeId('https://www.systembolaget.se/butiker-ombud/oppettider-helgdagar/')).toBeNull()
  })

  it('läser ort och adress med svenska tecken ur butikssidans titel', () => {
    // Slugen har tappat å och ä ("umea"), titeln har dem kvar. Två mellanslag efter kommat i originalet.
    expect(parseTitle('Rådhusesplanaden 6 E,  Umeå | Systembolaget')).toEqual({ city: 'Umeå', address: 'Rådhusesplanaden 6 E' })
    expect(() => parseTitle('Systembolaget')).toThrow(/oläsbar/)
  })
})
