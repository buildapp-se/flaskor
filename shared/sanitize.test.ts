import { describe, expect, it } from 'vitest'
import { sanitize } from './sanitize.ts'

// Samma gränser som tabellens CHECK och NOT NULL (migrering 0007): ett värde databasen nekar ska nekas här först,
// annars svarar Workern 500 och gästläget sparar en rad som aldrig går att ta med till ett konto.
describe('sanitize mot databasens gränser', () => {
  it('nekar null i kolumner som är NOT NULL', () => {
    for (const key of ['kind', 'owned', 'name', 'source_kind', 'availability', 'count']) {
      expect(() => sanitize({ [key]: null }), key).toThrow(`${key} must not be null`)
    }
  })
  it('släpper null i valfria kolumner', () => {
    expect(sanitize({ open_level: null, vintage: null, note: null })).toEqual({ open_level: null, vintage: null, note: null })
  })
  it('nekar okända värden i kind, source_kind och availability', () => {
    expect(() => sanitize({ kind: 'mjöd' })).toThrow('kind must be one of')
    expect(() => sanitize({ source_kind: 'vivino' })).toThrow('source_kind must be one of')
    expect(() => sanitize({ availability: 'kanske' })).toThrow('availability must be one of')
    expect(sanitize({ kind: 'beer', source_kind: 'caviste', availability: 'supplier_out' })).toEqual({ kind: 'beer', source_kind: 'caviste', availability: 'supplier_out' })
  })
  it('open_level är 1 till 4, count aldrig negativt', () => {
    for (const level of [0, 5, 2.5]) expect(() => sanitize({ open_level: level }), String(level)).toThrow('open_level must be one of')
    expect(sanitize({ open_level: 4 })).toEqual({ open_level: 4 })
    expect(() => sanitize({ count: -1 })).toThrow('count must not be negative')
    expect(sanitize({ count: 0 })).toEqual({ count: 0 })
  })
})
