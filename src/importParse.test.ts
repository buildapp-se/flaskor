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
  it('ingen/felaktig lista kastar rätt fel', () => {
    expect(() => parseImport('hej')).toThrow('no json list in text')
    expect(() => parseImport('[{trasig')).toThrow('no json list in text')
    expect(() => parseImport(']')).toThrow('no json list in text')
    expect(() => parseImport('][')).toThrow('no json list in text')
    expect(() => parseImport('[trasig]')).toThrow('json list does not parse')
    expect(() => parseImport('{"a":[1]}')).not.toThrow()
    expect(parseImport('[]')).toEqual([])
    expect(parseImport(' []')).toEqual([])
  })

  it('hoppar över null och icke-objekt i listan', () => {
    expect(parseImport('[null, 42, "text", true, {"namn":"Kvar"}]')).toEqual([
      { nr: null, name: 'Kvar', vintage: null, price: null, count: 1, kind: 'wine' },
    ])
  })

  it('stödjer alternativa fältnamn (artikelnummer, årgång, vintage, price, count, kind, spirit)', () => {
    expect(
      parseImport(
        JSON.stringify([
          { artikelnummer: '1234', namn: 'V1', årgång: 1900, price: 99, count: 4, kind: 'spirit' },
          { artikelnummer: '1234567', name: 'V2', vintage: 2100, pris: 250, antal: 0, typ: 'spirit' },
        ]),
      ),
    ).toEqual([
      { nr: '1234', name: 'V1', vintage: 1900, price: 99, count: 4, kind: 'spirit' },
      { nr: '1234567', name: 'V2', vintage: 2100, price: 250, count: 1, kind: 'spirit' },
    ])
  })

  it('validerar gränser för artikelnummer, årgång, antal och icke-ändliga tal', () => {
    expect(
      parseImport(
        '[{"nr":"123","namn":"Kort nr","argang":1899,"pris":1e500,"antal":-2},{"nr":"12345678","namn":"Långt nr","argang":2101,"antal":0}]',
      ),
    ).toEqual([
      { nr: null, name: 'Kort nr', vintage: null, price: null, count: 1, kind: 'wine' },
      { nr: null, name: 'Långt nr', vintage: null, price: null, count: 1, kind: 'wine' },
    ])
  })

  it('trimmar name/namn och hanterar engelsk name', () => {
    expect(parseImport('[{"name":"  Engelskt Namn  ", "antal": 1}]')).toEqual([
      { nr: null, name: 'Engelskt Namn', vintage: null, price: null, count: 1, kind: 'wine' }
    ])
    expect(parseImport('[{"namn":"  Svenskt Namn  ", "antal": 1}]')).toEqual([
      { nr: null, name: 'Svenskt Namn', vintage: null, price: null, count: 1, kind: 'wine' }
    ])
  })

  it('hanterar konstiga värden för siffror', () => {
    expect(parseImport('[{"namn":"D","pris":"123 kr"},{"namn":"E","pris":"  "},{"namn":"F","pris":"okänt"},{"namn":"G","pris":true},{"namn":"H","pris":"1..2"}]')).toEqual([
      { nr: null, name: 'D', vintage: null, price: 123, count: 1, kind: 'wine' },
      { nr: null, name: 'E', vintage: null, price: null, count: 1, kind: 'wine' },
      { nr: null, name: 'F', vintage: null, price: null, count: 1, kind: 'wine' },
      { nr: null, name: 'G', vintage: null, price: null, count: 1, kind: 'wine' },
      { nr: null, name: 'H', vintage: null, price: null, count: 1, kind: 'wine' }
    ])
  })
})
