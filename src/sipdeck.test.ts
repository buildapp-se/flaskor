import { describe, expect, it } from 'vitest'
import { drinksLink, linkUrl } from './sipdeck.ts'

describe('länkar till Sipdeck', () => {
  it('kontextlänken bär radens fält och artikelnumret som produktreferens', () => {
    const url = drinksLink({ kind: 'spirit', name: 'Kahlúa & Co', producer: null, category: 'Likör', style: 'Kaffelikör', country: 'Mexiko', region: null, source_kind: 'systembolaget', source_id: '516' })
    expect(url.startsWith('https://buildapp.se/sipdeck/#/med/')).toBe(true)
    // Sipdeck läser allt efter #/med/ som en kodad frågesträng; ett snedstreck i den hade brutit rutten.
    const tail = url.split('#/med/')[1]!
    expect(tail).not.toContain('/')
    const q = new URLSearchParams(decodeURIComponent(tail))
    expect(Object.fromEntries(q)).toEqual({ n: 'Kahlúa & Co', k: 'spirit', c: 'Likör', s: 'Kaffelikör', o: 'Mexiko', ref: 'sb:516' })
  })

  it('en egen rad eller Caviste-rad ger ingen produktreferens', () => {
    const q = new URLSearchParams(decodeURIComponent(drinksLink({ kind: 'wine', name: 'Barolo', producer: 'Colla', category: 'Rött vin', style: null, country: 'Italien', region: 'Piemonte', source_kind: 'caviste', source_id: '143' }).split('#/med/')[1]!))
    expect(q.has('ref')).toBe(false)
    expect(q.get('r')).toBe('Piemonte')
  })

  it('kopplingskoden ligger i fragmentet', () => {
    expect(linkUrl('ab12')).toBe('https://buildapp.se/sipdeck/#/hemma/koppla/ab12')
  })
})
