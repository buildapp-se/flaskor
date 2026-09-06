import { describe, expect, it } from 'vitest'
import { parseImport } from './importParse.ts'

describe('bulkimport: läsa AI:ns svar', () => {
  it('ren lista', () => {
    expect(parseImport('[{"nr":"7562401","namn":"Excellence Blanc","argang":2023,"pris":164,"antal":2,"typ":"vin"}]')).toEqual([
      { nr: '7562401', name: 'Excellence Blanc', vintage: 2023, price: 164, count: 2, kind: 'wine' },
    ])
  })
  it('kodstaket, text runt om, nummer med mellanslag, tal som strängar, sprit', () => {
    const text = 'Här är listan:\n```json\n[{"nr":"75624 01","namn":"A","argang":"2019","pris":"1 125,50","antal":"3"},{"nr":null,"namn":"Absolut","typ":"sprit"}]\n```\nHoppas det hjälper!'
    expect(parseImport(text)).toEqual([
      { nr: '7562401', name: 'A', vintage: 2019, price: 1125.5, count: 3, kind: 'wine' },
      { nr: null, name: 'Absolut', vintage: null, price: null, count: 1, kind: 'spirit' },
    ])
  })
  it('rader utan namn hoppas över, orimlig årgång blir null', () => {
    expect(parseImport('[{"nr":"1"},{"namn":"B","argang":19}]')).toEqual([{ nr: null, name: 'B', vintage: null, price: null, count: 1, kind: 'wine' }])
  })
  it('ingen lista kastar', () => {
    expect(() => parseImport('hej')).toThrow()
    expect(() => parseImport('[{trasig')).toThrow()
    expect(() => parseImport('{"a":[1]}')).not.toThrow()
  })
})
