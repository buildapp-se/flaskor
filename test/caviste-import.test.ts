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
    expect(seen[0]).toEqual({ headers: { 'user-agent': 'Mozilla/5.0 (compatible; flaskor/1.0; +https://buildapp.se/flaskor)', accept: 'text/html' }, redirect: 'manual' })
    vi.stubGlobal('fetch', async () => new Response('', { status: 404 }))
    await expect(fetchCaviste(URL)).rejects.toThrow(new NotFoundError(`caviste page ${URL} not found`))
    vi.stubGlobal('fetch', async () => new Response('', { status: 301 }))
    await expect(fetchCaviste(URL)).rejects.toThrow(new TransientError('caviste answered 301'))
    vi.stubGlobal('fetch', async () => {
      throw new Error('nät')
    })
    await expect(fetchCaviste(URL)).rejects.toThrow(new TransientError('caviste unreachable: Error: nät'))
  })
})

// Mutationstest 2026-11-24, andra varvet: varianter av sidans format som CAV0143 inte visar.
describe('caviste, formatvarianter', () => {
  const cell = (inner: string) => `<tr><td>${inner}</td></tr>`
  const box = (...rows: string[]) => `<p>cav0007 innehåller ${rows.length} flaskor</p><tr><td>meny</td></tr><table>${rows.join('')}</table>`
  const one = (row: string) => parseCavistePage(box(row), '7', URL)[0]!

  it('länkar: bara https och de två värdnamnen, hela värdnamnet', () => {
    expect(() => parseCavisteUrl('http://www.caviste.se/cav/cav0143/')).toThrow(/not a caviste/)
    expect(() => parseCavisteUrl('https://caviste.se.example.com/cav/cav0143/')).toThrow(/not a caviste/)
  })

  it('text: <br> utan snedstreck, entitet mitt i ord, kanter trimmas', () => {
    expect(text('  A<br>B<br />C&hellip;D  ')).toBe('A B C D')
  })

  it('rubrik: inga mellanslag runt bindestreck och kr, tvåsiffrigt antal, "6fl."', () => {
    expect(parseHeading('12 flaskor Barolo–1250kr')).toEqual({ count: 12, vintage: null, name: 'Barolo', price: 1250 })
    expect(parseHeading('6fl. Chablis - 300 kr').count).toBe(6)
  })

  it('rubrik som inte börjar med antalet, eller med [.pdf] mitt i, kastar med texten (högst 120 tecken)', () => {
    expect(() => parseHeading('Rubrik 3 flaskor Barolo – 100 kr')).toThrow(/not understood: Rubrik 3 flaskor Barolo – 100 kr$/)
    expect(() => parseHeading('Läs mer [.pdf]')).toThrow(/not understood: Läs mer$/)
    expect(() => parseHeading('A [.pdf] B')).toThrow(/not understood: A \[\.pdf\] B$/)
    expect(() => parseHeading('x'.repeat(200))).toThrow(new RegExp(`not understood: x{120}$`))
  })

  it('druvor: procent utan mellanslag eller med mellanslag före, sist i texten, alla ord som inte är druvor', () => {
    expect(parseGrapes('60%syrah, 40 % grenache, 10% gamay')).toBe('syrah, grenache, gamay')
    expect(parseGrapes('13% alcohol. 75% volym. 10% ny ek. 5% ek.')).toBeNull()
  })

  it('karaffering: utan mellanslag, tvåsiffrigt, två decimaler', () => {
    expect(parseDecant('Karafferas:2 tim.')).toBe(2)
    expect(parseDecant('Karafferas: 12 tim.')).toBe(12)
    expect(parseDecant('Karafferas: 1,25 tim.')).toBe(1.25)
  })

  it('med <em>: bara texten före sista </em> är spec, resten är smaknoten', () => {
    const w = one(cell('<h4 class="t">1 flaska Testvin – 200 kr</h4><p><em>Rött vin. AOC Bourgogne. 100% pinot noir. 13% alkohol.</em><br />Drick: 2030-2032. Passar till ost.</p>'))
    expect(w).toMatchObject({ category: 'Rött vin', region: 'AOC Bourgogne', alcohol: 13, drink_from: null, drink_to: null, taste: 'Drick: 2030-2032. Passar till ost.', food: 'ost' })
  })

  it('utan <em> och utan avslutande </td>: rubriken räknas inte in i specen', () => {
    const w = one('<tr><td><h4 class="t">1 flaska 2021 Testvin – 200 kr</h4>Rött vin. AOC Bourgogne. 12,25% alkohol. Drick:2030 - 2032. Serveringstemp: 16 C</tr>')
    expect(w).toMatchObject({ name: 'Testvin', category: 'Rött vin', region: 'AOC Bourgogne', alcohol: 12.25, drink_from: 2030, drink_to: 2032, serve_temp: '16' })
  })

  it('fält som saknas blir null; typ och ursprung måste stå först och sist', () => {
    const w = one(cell('<h4>1 flaska Testvin – 200 kr</h4>Vinlikör. Italien DOC.'))
    expect(w).toMatchObject({ owned: false, availability: 'unknown', category: null, region: null, alcohol: null, drink_from: null, drink_to: null, serve_temp: null, image_url: null, grapes: null, decant_hours: null })
  })

  it('temperatur och alkohol i varianter', () => {
    expect(one(cell('<h4>1 flaska X – 1 kr</h4>Rött vin. 13 % alkohol. Serveringstemp:16°C.'))).toMatchObject({ alcohol: 13, serve_temp: '16' })
    expect(one(cell('<h4>1 flaska X – 1 kr</h4>Rött vin. 13%alkohol. Serveringstemp: 16° C.'))).toMatchObject({ alcohol: 13, serve_temp: '16' })
  })

  it('maten: bara sista meningen, utan punkt, trimmad; ingen "till" ger null', () => {
    const food = (taste: string) => one(cell(`<h4>1 flaska X – 1 kr</h4><em>Rött vin.</em>${taste}`)).food
    expect(food('Passar till ost. Gott.')).toBeNull()
    expect(food('Passar till ost')).toBe('ost')
    expect(food('Passar till ost .')).toBe('ost')
    expect(food('Bara gott.')).toBeNull()
  })

  it('bilden: länken vinner över srcset, http går också, storlekssuffixet bort', () => {
    const img = (inner: string) => one(cell(`${inner}<h4>1 flaska X – 1 kr</h4>Rött vin.`)).image_url
    expect(img('<img srcset="https://www.caviste.se/wp-content/uploads/2022/01/CAV7-annan-300x900.jpg 300w"><a href="http://www.caviste.se/wp-content/uploads/2022/01/CAV7-flaska.jpg">bild</a>')).toBe(
      'http://www.caviste.se/wp-content/uploads/2022/01/CAV7-flaska.jpg',
    )
    expect(img('<a href="http://www.caviste.se/wp-content/uploads/2022/01/CAV7-flaska-300x900.jpg">bild</a>')).toBe('http://www.caviste.se/wp-content/uploads/2022/01/CAV7-flaska.jpg')
    expect(img('<img src="http://www.caviste.se/wp-content/uploads/2022/01/CAV7-b.jpg">')).toBe('http://www.caviste.se/wp-content/uploads/2022/01/CAV7-b.jpg')
  })

  it('en rad utan rubrik kastar som en oläslig rubrik', () => {
    expect(() => parseCavistePage(box(cell('ingen rubrik')), '7', URL)).toThrow(/not understood: $/)
  })
})
