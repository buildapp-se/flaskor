import { readFileSync } from 'node:fs'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { NotFoundError, TransientError } from '../shared/errors.ts'
import { fetchCaviste, parseCavisteUrl, parseCavistePage, parseDecant, parseGrapes, parseHeading, text } from '../worker/src/caviste.ts'

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
  it('hämtar bara caviste.se och www.caviste.se, utan port, inloggning eller fråga (OWASP 2026-11-24)', () => {
    expect(() => parseCavisteUrl('https://intern.caviste.se/cav1')).toThrow(/not a caviste/)
    expect(() => parseCavisteUrl('https://www.caviste.se:8443/cav/cav0143/')).toThrow(/not a caviste/)
    expect(() => parseCavisteUrl('https://a:b@www.caviste.se/cav/cav0143/')).toThrow(/not a caviste/)
    expect(parseCavisteUrl(`${URL}?x=/cav1#y`).url).toBe(URL)
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

// Mutationstest 2026-11-24: grenarna som CAV0143 inte når.
describe('caviste, kanterna', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('text: taggar, radbrytningar, numeriska och namngivna entiteter, blanktecken', () => {
    expect(text('<p>A<br/>B&nbsp;&amp;&quot;C&quot;&#8211;D &hellip;  E</p>')).toBe('A B &"C"–D E')
  })

  it('rubrik: utan årgång, "fl.", pris med tusentalsmellanrum, pris 0 blir null', () => {
    expect(parseHeading('2 fl. Bourgogne Rouge - 1 250 kr')).toEqual({ count: 2, vintage: null, name: 'Bourgogne Rouge', price: 1250 })
    expect(parseHeading('1 flaska 2019 Gratis — 0 kr').price).toBeNull()
  })

  it('druvor: "och" och "från" avslutar, alkohol och ek räknas inte, dubbletter bort', () => {
    expect(parseGrapes('60% Syrah och 40% grenache från gamla stockar. 13,5% alkohol. 20% nya ek. 10% syrah.')).toBe('syrah, grenache')
  })

  it('karaffering med decimalkomma', () => {
    expect(parseDecant('Karafferas: 1,5 tim.')).toBe(1.5)
    expect(parseDecant('Karafferas: gärna.')).toBeNull()
  })

  it('en låda utan <em>: hela cellen är spec, ingen smaknot; okänd typ och ursprung blir null', () => {
    const html = `<p>CAV0007 innehåller 1 flaskor</p><table><tr><td><img srcset="https://www.caviste.se/wp-content/uploads/2022/01/CAV0007-x-300x1116.jpg 300w"><h4>1 flaska 2021 Testvin – 200 kr</h4><p>Cider. Normandie. 100% äpple. 5,5% alkohol. Drick: 2022–2024. Serveringstemp: 8 - 10 °C.</p></td></tr></table>`
    const [w] = parseCavistePage(html, '7', 'https://caviste.se/cav/cav0007/', new Date('2026-11-24T00:00:00Z'))
    expect(w).toMatchObject({
      name: 'Testvin',
      count: 1,
      vintage: 2021,
      price_current: 200,
      category: null,
      region: null,
      grapes: 'äpple',
      alcohol: 5.5,
      drink_from: 2022,
      drink_to: 2024,
      serve_temp: '8-10',
      taste: null,
      food: null,
      image_url: 'https://www.caviste.se/wp-content/uploads/2022/01/CAV0007-x.jpg',
      source_id: '7',
      source_url: 'https://caviste.se/cav/cav0007/',
      price_checked_at: '2026-11-24T00:00:00.000Z',
    })
  })

  it('tabell utan rader kastar', () => {
    expect(() => parseCavistePage('CAV0007 innehåller 2 flaskor<table></table>', '7', URL)).toThrow(/empty bottle table/)
  })

  it('fetchCaviste: följer inga omdirigeringar, 404 NotFound, annat fel Transient', async () => {
    const seen: RequestInit[] = []
    vi.stubGlobal('fetch', async (_url: string, init: RequestInit) => {
      seen.push(init)
      return new Response('sidan')
    })
    expect(await fetchCaviste(URL)).toBe('sidan')
    expect(seen[0]?.redirect).toBe('manual')
    vi.stubGlobal('fetch', async () => new Response('', { status: 404 }))
    await expect(fetchCaviste(URL)).rejects.toBeInstanceOf(NotFoundError)
    vi.stubGlobal('fetch', async () => new Response('', { status: 301 }))
    await expect(fetchCaviste(URL)).rejects.toBeInstanceOf(TransientError)
    vi.stubGlobal('fetch', async () => {
      throw new Error('nät')
    })
    await expect(fetchCaviste(URL)).rejects.toBeInstanceOf(TransientError)
  })
})
