import { SELF } from 'cloudflare:test'
import { describe, expect, it } from 'vitest'
import type { LabelGuess, ScanResult } from '../../shared/types.ts'
import { normalizeEan, parseGuess, parseSearch, parseVolume, rank, validEan } from '../src/scan.ts'
// Testerna kör inne i workerd utan filsystem, så fixturen importeras i stället för att läsas.
import fixture from './fixtures/sb-search-absolut.json'

const AUTH = { authorization: 'Bearer test-kod', 'content-type': 'application/json' }

function scan(body: unknown): Promise<Response> {
  return SELF.fetch('https://flaskor-api.test/api/scan', { method: 'POST', headers: AUTH, body: JSON.stringify(body) })
}

const absolut: LabelGuess = { kind: 'spirit', name: 'Absolut Vodka', producer: 'Absolut', category: 'Vodka', vintage: null, volume_ml: null, alcohol: 40, ean: null }

describe('streckkod', () => {
  it('kontrollsiffran avgör', () => {
    expect(validEan('7312040017034')).toBe(true)
    expect(validEan('96385074')).toBe(true)
    expect(validEan('7312040017035')).toBe(false)
    expect(validEan('123')).toBe(false)
  })
  it('UPC-A blir EAN-13, skräp rensas', () => {
    expect(normalizeEan('012345678905')).toBe('0012345678905')
    expect(normalizeEan('7312 0400 17034')).toBe('7312040017034')
  })
  it('volymer', () => {
    expect(parseVolume('1 l')).toBe(1000)
    expect(parseVolume('70 cl')).toBe(700)
    expect(parseVolume('700 ml')).toBe(700)
    expect(parseVolume('0,75 l')).toBe(750)
    expect(parseVolume('sex flaskor')).toBeNull()
    expect(parseVolume(undefined)).toBeNull()
  })
})

describe('Geminis svar', () => {
  it('läser fälten och tål text runt om', () => {
    const g = parseGuess('Här: {"kind":"wine","name":"Excellence","producer":"Domaine Saint-Georges d\'Ibry","vintage":"2024","volume_ml":750,"alcohol":null,"category":null,"ean":"7312040017034"} klart')
    expect(g.kind).toBe('wine')
    expect(g.vintage).toBe(2024)
    expect(g.volume_ml).toBe(750)
    expect(g.ean).toBe('7312040017034')
  })
  it('felläst streckkod slängs, ingen dryck ger 404', () => {
    expect(parseGuess('{"kind":"spirit","name":"Gin","ean":"7312040017035"}').ean).toBeNull()
    expect(() => parseGuess('{"kind":"other","name":"en katt"}')).toThrow('no bottle')
    expect(() => parseGuess('{"kind":"wine","name":""}')).toThrow('no bottle')
  })
})

describe('Systembolagets sök', () => {
  it('träffarna blir kandidater med bild ur productId', () => {
    const c = parseSearch(fixture)
    expect(c).toHaveLength(5)
    expect(c[0]).toMatchObject({ number: '8801', name: 'Absolut Vodka', volume_ml: 700, price: 253, category: 'Vodka & Okryddat brännvin' })
    expect(c[0]!.image_url).toBe('https://product-cdn.systembolaget.se/productimages/164/164_200.webp')
    expect(c[3]!.name).toBe('Absolut Five MIX')
  })
  it('volymen på etiketten lyfter rätt flaska, annars sökmotorns ordning', () => {
    const c = parseSearch(fixture)
    expect(rank(c, { ...absolut, volume_ml: 350 })[0]!.number).toBe('8802')
    expect(rank(c, absolut).map((x) => x.number)).toEqual(['8801', '8802', '8804'])
    expect(rank(c, { ...absolut, name: 'Elyx' })[0]!.number).toBe('8650801')
  })
  it('kategorin väger tyngre än årgången: vitt vin före rosé med rätt år', () => {
    const bas = { number: '', name: "Domaine Georges d'Ibry Excellence", producer: "Domaine Saint-Georges d'Ibry", volume_ml: 750, price: 164, image_url: null }
    const rose = { ...bas, number: '7011301', name: "Domaine Saint Georges d'Ibry Excellence Rosé", category: 'Rosévin', vintage: 2024 }
    const blanc = { ...bas, number: '7562401', name: "Domaine Georges d'Ibry Excellence Blanc", category: 'Vitt vin', vintage: 2023 }
    const guess: LabelGuess = { kind: 'wine', name: "Domaine Saint-Georges d'Ibry Excellence", producer: "Domaine Saint-Georges d'Ibry", category: 'Vitt vin', vintage: 2024, volume_ml: null, alcohol: null, ean: null }
    expect(rank([rose, blanc], guess)[0]!.number).toBe('7562401')
  })
})

describe('POST /api/scan', () => {
  it('streckkod: Open Food Facts ger namnet, Systembolaget kandidaterna', async () => {
    const r = await scan({ ean: '7312040017034' })
    expect(r.status, await r.clone().text()).toBe(200)
    const body = await r.json<ScanResult>()
    expect(body.via).toBe('barcode')
    expect(body.guess).toMatchObject({ name: 'Absolut Vodka', producer: 'Absolut', volume_ml: 1000, kind: 'spirit' })
    expect(body.candidates.map((c) => c.number)).toEqual(['8801', '8802', '8804'])
    expect(body.vivino_url).toBeNull()
  })
  it('okänd streckkod utan foto: 404, ogiltig: 400, tomt: 400', async () => {
    expect((await scan({ ean: '7312040099993' })).status).toBe(404)
    expect((await scan({ ean: '7312040017035' })).status).toBe(400)
    expect((await scan({})).status).toBe(400)
  })
  it('okänd streckkod med foto faller tillbaka på etiketten', async () => {
    const r = await scan({ ean: '7312040099993', image: 'data:image/jpeg;base64,AAAA' })
    expect(r.status).toBe(200)
    expect((await r.json<ScanResult>()).via).toBe('label')
  })
  it('foto: Gemini läser, Systembolaget söks', async () => {
    const r = await scan({ image: 'data:image/jpeg;base64,AAAA' })
    expect(r.status, await r.clone().text()).toBe(200)
    const body = await r.json<ScanResult>()
    expect(body.via).toBe('label')
    expect(body.guess.name).toBe('Absolut Vodka')
    expect(body.candidates).toHaveLength(3)
  })
  it('fel bildformat: 400', async () => {
    expect((await scan({ image: 'http://example.com/x.jpg' })).status).toBe(400)
  })
})
