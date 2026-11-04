import { describe, expect, it } from 'vitest'
import { LONG_TEXT_MAX, sanitize, sanitizeTasting, TEXT_MAX, URL_MAX } from './sanitize.ts'

// Mutationstest 2026-11-04: varje fält i listan, varje gräns och varje felmeddelande låst här i klientens svit,
// eftersom Workerns svit (som också kör sanitize) inte går att köra under Stryker.

const TEXT = ['kind', 'name', 'producer', 'country', 'region', 'category', 'style', 'grapes', 'source_kind', 'source_id', 'sb_assortment', 'price_checked_at', 'availability', 'serve_temp', 'vivino_checked_at'] as const
const LONG = ['note', 'taste', 'food'] as const
const URLS = ['source_url', 'image_url', 'vivino_url', 'rating_url'] as const
const NUMBERS = ['vintage', 'volume_ml', 'alcohol', 'price_paid', 'price_current', 'count', 'open_level', 'drink_from', 'drink_to', 'decant_hours', 'vivino_rating', 'vivino_count', 'rating'] as const

const full = {
  kind: 'wine', owned: true, name: 'Barolo', producer: 'Colla', vintage: 2019, country: 'Italien', region: 'Piemonte', category: 'Rött vin',
  style: 'Stramt', grapes: 'Nebbiolo', volume_ml: 750, alcohol: 14.5, source_kind: 'systembolaget', source_id: '7120', source_url: 'https://www.systembolaget.se/7120',
  image_url: 'https://example.com/b.png', sb_product_id: '21955733', sb_assortment: 'BS', price_paid: 399, price_current: 419, price_checked_at: '2026-11-01',
  availability: 'in_stock', count: 2, open_level: 1, drink_from: 2027, drink_to: 2035, serve_temp: '16-18 °C', decant_hours: 2, food: 'Kalv', note: 'Fin',
  taste: 'Körsbär', vivino_rating: 4.2, vivino_count: 1200, vivino_url: 'https://www.vivino.com/w/1', vivino_checked_at: '2026-11-01', rating: 4, rating_url: 'http://example.com/r',
}

describe('sanitize: alla skrivbara fält', () => {
  it('släpper igenom varje känt fält oförändrat, owned som 1', () => {
    expect(sanitize(full)).toEqual({ ...full, owned: 1 })
  })
  it('owned falskt blir 0, och okända fält faller bort', () => {
    expect(sanitize({ owned: false, id: 7, household_id: 'x', created_at: 'nu' })).toEqual({ owned: 0 })
  })
  it('null går igenom i varje fält', () => {
    for (const key of [...TEXT, ...LONG, ...URLS, ...NUMBERS, 'owned', 'sb_product_id']) expect(sanitize({ [key]: null }), key).toEqual({ [key]: null })
  })
  it('sifferfälten nekar text, NaN och oändligt', () => {
    for (const key of NUMBERS) {
      expect(() => sanitize({ [key]: '5' }), key).toThrow(`${key} must be a number`)
      expect(() => sanitize({ [key]: Number.NaN }), key).toThrow(`${key} must be a number`)
      expect(() => sanitize({ [key]: Infinity }), key).toThrow(`${key} must be a number`)
    }
  })
  it('textfälten nekar tal', () => {
    for (const key of [...TEXT, ...LONG, ...URLS, 'sb_product_id']) expect(() => sanitize({ [key]: 5 }), key).toThrow(`${key} must be a string`)
  })
  it('owned måste vara sant eller falskt', () => {
    expect(() => sanitize({ owned: 1 })).toThrow('owned must be a boolean')
  })
  it('kroppen måste vara ett objekt', () => {
    for (const body of [null, 'x', 3, undefined]) expect(() => sanitize(body), String(body)).toThrow('body must be an object')
  })
})

describe('sanitize: längdtak', () => {
  it('vanlig text: exakt taket går, ett tecken till nekas', () => {
    for (const key of TEXT) {
      expect(sanitize({ [key]: 'a'.repeat(TEXT_MAX) }), key).toEqual({ [key]: 'a'.repeat(TEXT_MAX) })
      expect(() => sanitize({ [key]: 'a'.repeat(TEXT_MAX + 1) }), key).toThrow(`${key} must be at most ${TEXT_MAX} characters`)
    }
  })
  it('fritext: 4 000 tecken', () => {
    for (const key of LONG) {
      expect(sanitize({ [key]: 'a'.repeat(LONG_TEXT_MAX) }), key).toEqual({ [key]: 'a'.repeat(LONG_TEXT_MAX) })
      expect(() => sanitize({ [key]: 'a'.repeat(LONG_TEXT_MAX + 1) }), key).toThrow(`${key} must be at most ${LONG_TEXT_MAX} characters`)
    }
  })
  it('länkar: 500 tecken', () => {
    for (const key of URLS) {
      const at = 'https://e.se/' + 'a'.repeat(URL_MAX - 13)
      expect(sanitize({ [key]: at }), key).toEqual({ [key]: at })
      expect(() => sanitize({ [key]: at + 'a' }), key).toThrow(`${key} must be at most ${URL_MAX} characters`)
    }
  })
})

describe('sanitize: länkar och artikel-id', () => {
  it('länkfälten tar bara http och https från början', () => {
    for (const key of URLS) {
      for (const bad of ['javascript:alert(1)', 'data:text/html,x', 'xhttps://e.se', ' https://e.se']) {
        expect(() => sanitize({ [key]: bad }), `${key} ${bad}`).toThrow(`${key} must be an http(s) url`)
      }
      expect(sanitize({ [key]: 'http://e.se' }), key).toEqual({ [key]: 'http://e.se' })
    }
  })
  it('vanliga textfält behöver ingen länkform', () => {
    expect(sanitize({ name: 'javascript:' })).toEqual({ name: 'javascript:' })
  })
  it('sb_product_id är 1 till 12 siffror och inget annat', () => {
    expect(sanitize({ sb_product_id: '1' })).toEqual({ sb_product_id: '1' })
    expect(sanitize({ sb_product_id: '123456789012' })).toEqual({ sb_product_id: '123456789012' })
    for (const bad of ['', '1234567890123', '12/../x', 'x12', '12x', 'abc']) expect(() => sanitize({ sb_product_id: bad }), bad).toThrow('sb_product_id must be digits')
  })
  it('source_id följer inte artikel-id:ts regel', () => {
    expect(sanitize({ source_id: 'CAV0143' })).toEqual({ source_id: 'CAV0143' })
  })
})

describe('sanitizeTasting: gränser', () => {
  it('kroppen måste vara ett objekt', () => {
    for (const body of [null, 'x', 3]) expect(() => sanitizeTasting(body), String(body)).toThrow('body must be an object')
  })
  it('datumet har exakt formen ÅÅÅÅ-MM-DD', () => {
    for (const bad of ['x2026-11-04', '2026-11-04x', '26-11-04', 20261104]) expect(() => sanitizeTasting({ drunk_on: bad }), String(bad)).toThrow('drunk_on must be a date, YYYY-MM-DD')
    expect(() => sanitizeTasting({})).toThrow('drunk_on must be a date, YYYY-MM-DD')
    // En lista med ett datum blir rätt text vid regextestet; typkontrollen är det enda som stoppar den.
    expect(() => sanitizeTasting({ drunk_on: ['2026-11-04'] })).toThrow('drunk_on must be a date, YYYY-MM-DD')
  })
  it('betyget är ett heltal 1 till 5 eller saknas', () => {
    for (const rating of [1, 5]) expect(sanitizeTasting({ drunk_on: '2026-11-04', rating })).toEqual({ drunk_on: '2026-11-04', rating, note: null })
    for (const rating of [0, 6, 2.5, '3']) expect(() => sanitizeTasting({ drunk_on: '2026-11-04', rating }), String(rating)).toThrow('rating must be a whole number 1 to 5')
    expect(sanitizeTasting({ drunk_on: '2026-11-04', rating: null })).toEqual({ drunk_on: '2026-11-04', rating: null, note: null })
  })
  it('anteckningen är text upp till 4 000 tecken eller saknas', () => {
    const at = 'a'.repeat(LONG_TEXT_MAX)
    expect(sanitizeTasting({ drunk_on: '2026-11-04', note: at })).toEqual({ drunk_on: '2026-11-04', rating: null, note: at })
    expect(sanitizeTasting({ drunk_on: '2026-11-04', note: null })).toEqual({ drunk_on: '2026-11-04', rating: null, note: null })
    expect(() => sanitizeTasting({ drunk_on: '2026-11-04', note: at + 'a' })).toThrow(`note must be text of at most ${LONG_TEXT_MAX} characters`)
    expect(() => sanitizeTasting({ drunk_on: '2026-11-04', note: 5 })).toThrow(`note must be text of at most ${LONG_TEXT_MAX} characters`)
  })
})
