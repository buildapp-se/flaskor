import { readFileSync } from 'node:fs'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { FatalError, NotFoundError, TransientError } from '../shared/errors.ts'
import { fetchWine, findHit, findVivino, parseVivinoUrl, parseWinePage, plausible, queryFor, refreshVivino, tokens, vivinoDue, vivinoPatch, vivinoToPreview } from '../worker/src/vivino.ts'

const page = readFileSync('worker/test/fixtures/vivino-le-grappin.html', 'utf8')

describe('vivino', () => {
  it('läser första träffen ur söksidan', () => {
    expect(findHit(page)).toEqual({ rating: 4.2, count: 774, url: 'https://www.vivino.com/w/1661808', name: 'Le Grappin Savigny-lès-Beaune Rouge 2009' })
  })
  it('för få röster: Vivino skriver 0, vi sparar länken men inget betyg', () => {
    expect(findHit(page.replace('&quot;wine_ratings_average&quot;:4.2', '&quot;wine_ratings_average&quot;:0'))?.rating).toBeNull()
  })
  it('tom träfflista och sida utan lista ger null', () => {
    expect(findHit('<html>&quot;matches&quot;:[]}</html>')).toBeNull()
    expect(findHit('<html>inget här</html>')).toBeNull()
  })
  it('rimlighet: hälften av orden måste finnas, accenter och årgång ignoreras', () => {
    expect(plausible('Le Grappin Savigny-les-Beaune Rouge', 'Le Grappin Savigny-lès-Beaune Rouge 2020')).toBe(true)
    expect(plausible("Domaine Georges d'Ibry Excellence Blanc", "Domaine Georges d'Ibry Excellence Blanc 2023")).toBe(true)
    expect(plausible('Buondonno Chianti Classico', 'Castello di Ama Chianti Classico 2019')).toBe(true)
    expect(plausible('Testbubbel Brut', 'Château Margaux 2015')).toBe(false)
    expect(plausible('', 'x')).toBe(false)
  })
  it('sökstring: producent plus namn, inte dubblerad', () => {
    expect(queryFor({ name: 'Excellence Blanc', producer: 'Domaine Georges d’Ibry' })).toBe('Domaine Georges d’Ibry Excellence Blanc')
    expect(queryFor({ name: 'Le Grappin Beaune', producer: 'Le Grappin' })).toBe('Le Grappin Beaune')
    expect(queryFor({ name: 'Buondonno Chianti', producer: null })).toBe('Buondonno Chianti')
  })
  it('dags att hämta: vin utan datum eller äldre än 30 dagar, aldrig sprit', () => {
    const now = new Date('2026-09-06')
    const base = { kind: 'wine', vivino_checked_at: null } as Parameters<typeof vivinoDue>[0]
    expect(vivinoDue(base, now)).toBe(true)
    expect(vivinoDue({ ...base, vivino_checked_at: '2026-09-01T00:00:00Z' }, now)).toBe(false)
    expect(vivinoDue({ ...base, vivino_checked_at: '2026-07-01T00:00:00Z' }, now)).toBe(true)
    expect(vivinoDue({ ...base, kind: 'spirit' }, now)).toBe(false)
  })
})

describe('vivino-länk', () => {
  const wine = readFileSync('worker/test/fixtures/vivino-w-2379181.html', 'utf8')
  it('id och årgång ur länken, fel länk kastar', () => {
    expect(parseVivinoUrl('https://www.vivino.com/en/colombera-cascina-cottignano-bramaterra/w/2379181?year=2018&price_id=31367393')).toEqual({ wineId: '2379181', year: 2018 })
    expect(parseVivinoUrl('https://www.vivino.com/w/2379181')).toEqual({ wineId: '2379181', year: null })
    expect(() => parseVivinoUrl('https://www.systembolaget.se/produkt/vin/x-7562401/')).toThrow()
    expect(() => parseVivinoUrl('2379181')).toThrow()
  })
  it('vinsidan: producent, namn, typ, region, land, druvor, alkohol, bild, betyg, mat', () => {
    expect(parseWinePage(wine, '2379181')).toEqual({
      name: 'Colombera & Garella Cascina Cottignano Bramaterra',
      winery: 'Colombera & Garella',
      category: 'Rött vin',
      region: 'Bramaterra, Piemonte',
      country: 'Italien',
      grapes: 'Nebbiolo',
      alcohol: 13,
      image_url: 'https://images.vivino.com/thumbs/WUx5OY6ySgm20-1VhCsaXA_pb_x960.png',
      rating: 3.9,
      count: 1877,
      food: 'Beef, Lamb, Game (deer, venison), Poultry',
    })
  })
  it('fel id på sidan kastar NotFound', () => {
    expect(() => parseWinePage(wine, '1')).toThrow(/not on page/)
  })

  // En Vivino-länk rättad för hand ska överleva nattens omhämtning: förut sökte cronen på namnet igen
  // och skrev tillbaka fel vin. Nu hämtas betyget från just den sparade vinsidan.
  describe('refreshVivino', () => {
    afterEach(() => vi.unstubAllGlobals())

    it('hämtar från den sparade länken i stället för att söka på namnet', async () => {
      const calls: string[] = []
      vi.stubGlobal('fetch', async (url: string) => {
        calls.push(url)
        return new Response(wine)
      })
      const patch = await refreshVivino({ name: 'Helt fel namn', producer: null, vivino_url: 'https://www.vivino.com/w/2379181' })
      expect(calls).toEqual(['https://www.vivino.com/w/2379181'])
      expect(patch).toMatchObject({ vivino_rating: 3.9, vivino_count: 1877, vivino_url: 'https://www.vivino.com/w/2379181' })
    })

    it('utan sparad länk söker den på namnet som förut', async () => {
      const calls: string[] = []
      vi.stubGlobal('fetch', async (url: string) => {
        calls.push(url)
        return new Response(page)
      })
      await refreshVivino({ name: 'Le Grappin Bourgogne', producer: null, vivino_url: null })
      expect(calls[0]).toContain('search_term=')
    })

    it('ett tillfälligt fel på vinsidan kastas vidare; en oläsbar länk söker på namnet', async () => {
      vi.stubGlobal('fetch', async () => new Response('', { status: 503 }))
      await expect(refreshVivino({ name: 'x', producer: null, vivino_url: 'https://www.vivino.com/w/2379181' })).rejects.toBeInstanceOf(TransientError)
      const calls: string[] = []
      vi.stubGlobal('fetch', async (url: string) => {
        calls.push(url)
        return new Response(page)
      })
      vi.spyOn(console, 'error').mockImplementation(() => {})
      const now = new Date('2026-11-24T12:00:00Z')
      const patch = await refreshVivino({ name: 'Savigny-les-Beaune Rouge', producer: 'Le Grappin', vivino_url: 'https://example.com/w/1' }, now)
      expect(calls).toEqual(['https://www.vivino.com/sv/explore?search_term=Le%20Grappin%20Savigny-les-Beaune%20Rouge'])
      expect(patch).toEqual({ vivino_rating: 4.2, vivino_count: 774, vivino_url: 'https://www.vivino.com/w/1661808', vivino_checked_at: '2026-11-24T12:00:00.000Z' })
    })

    it('från den sparade länken stämplas hämtdatumet', async () => {
      vi.stubGlobal('fetch', async () => new Response(wine))
      const patch = await refreshVivino({ name: 'x', producer: null, vivino_url: 'https://www.vivino.com/w/2379181' }, new Date('2026-11-24T12:00:00Z'))
      expect(patch.vivino_checked_at).toBe('2026-11-24T12:00:00.000Z')
    })
  })
})

// Mutationstest 2026-11-24: grenarna som fixturerna inte når.
describe('vivino, kanterna', () => {
  const wine = readFileSync('worker/test/fixtures/vivino-w-2379181.html', 'utf8')
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('träff utan vin-id ger null', () => {
    expect(findHit(page.replace('&quot;wine&quot;:{&quot;id&quot;:1661808}', ''))).toBeNull()
  })

  it('sökord: gemener utan diakriter, minst tre tecken, inga årtal', () => {
    expect(tokens('Château Rosé ab 2019 12')).toEqual(['chateau', 'rose'])
  })

  it('rimlighet: exakt hälften räcker, under hälften inte', () => {
    expect(plausible('alpha beta', 'Alpha')).toBe(true)
    expect(plausible('alpha beta gamma', 'Alpha')).toBe(false)
  })

  it('producenten upprepas inte oavsett skiftläge', () => {
    expect(queryFor({ name: 'le grappin beaune', producer: 'Le Grappin' })).toBe('le grappin beaune')
  })

  it('dags att hämta: exakt 30 dagar är inte för gammalt', () => {
    const now = new Date('2026-09-06T00:00:00Z')
    const base = { kind: 'wine', vivino_checked_at: '2026-08-07T00:00:00Z' } as Parameters<typeof vivinoDue>[0]
    expect(vivinoDue(base, now)).toBe(false)
    expect(vivinoDue({ ...base, vivino_checked_at: '2026-08-06T23:59:59Z' }, now)).toBe(true)
  })

  it('ingen träff ger tomma fält men hämtdatum', () => {
    expect(vivinoPatch(null, new Date('2026-11-24T00:00:00Z'))).toEqual({ vivino_rating: null, vivino_count: null, vivino_url: null, vivino_checked_at: '2026-11-24T00:00:00.000Z' })
  })

  it('findVivino: svensk söksida, fel blir Transient, orimlig träff null', async () => {
    const calls: string[] = []
    vi.stubGlobal('fetch', async (url: string) => {
      calls.push(url)
      return new Response(page)
    })
    expect(await findVivino('Le Grappin Savigny')).toMatchObject({ rating: 4.2 })
    expect(calls).toEqual(['https://www.vivino.com/sv/explore?search_term=Le%20Grappin%20Savigny'])
    expect(await findVivino('Château Margaux')).toBeNull()
    vi.stubGlobal('fetch', async () => new Response('', { status: 429 }))
    await expect(findVivino('x')).rejects.toBeInstanceOf(TransientError)
    vi.stubGlobal('fetch', async () => {
      throw new Error('nät')
    })
    await expect(findVivino('x')).rejects.toBeInstanceOf(TransientError)
  })

  it('länken: underdomäner till vivino.com godtas, liknande värdar och dåliga årtal inte', () => {
    expect(parseVivinoUrl(' https://m.vivino.com/w/12 ')).toEqual({ wineId: '12', year: null })
    expect(() => parseVivinoUrl('https://notvivino.com/w/1')).toThrow(/not a vivino link/)
    expect(() => parseVivinoUrl('https://www.vivino.com/wines/1')).toThrow(/no wine id/)
    expect(parseVivinoUrl('https://www.vivino.com/w/1?year=20180').year).toBeNull()
    expect(parseVivinoUrl('https://www.vivino.com/w/1?year=U.V.').year).toBeNull()
  })

  it('vinsida utan producent, okänd typ och land, nollbetyg, ingen bild eller mat', () => {
    const html = '"wine":{"id":5,"name":"Bl\\u00e5 Druva","type_id":99,"region":{"id":1,"name":"","country":{"code":"xx","name":"Narnia"}},"statistics":{"status":"Normal","ratings_count":3,"ratings_average":0}}'
    expect(parseWinePage(html, '5')).toEqual({
      name: 'Blå Druva',
      winery: null,
      category: null,
      region: null,
      country: 'Narnia',
      grapes: null,
      alcohol: null,
      image_url: null,
      rating: null,
      count: 3,
      food: null,
    })
  })

  it('vinsida: starkvin, absolut bildadress före vinet, samma region en gång', () => {
    const html =
      '"bottle_large":"https://img.example/b.png","wine":{"id":6,"name":"Porto","type_id":7,"region":{"id":1,"name":"Douro"},"winery":{"id":2,"name":"Quinta"},"region":{"id":1,"name":"Douro"}}'
    expect(parseWinePage(html, '6')).toMatchObject({ name: 'Quinta Porto', category: 'Starkvin, söta viner', region: 'Douro', image_url: 'https://img.example/b.png', rating: null, count: null })
  })

  it('förhandsvisningen ur vinsidan: önskelistan, källa manual, årgång och länk', () => {
    const v = vivinoToPreview(parseWinePage(wine, '2379181'), '2379181', 2018, new Date('2026-11-24T00:00:00Z'))
    expect(v).toMatchObject({
      kind: 'wine',
      owned: false,
      name: 'Colombera & Garella Cascina Cottignano Bramaterra',
      producer: 'Colombera & Garella',
      vintage: 2018,
      category: 'Rött vin',
      source_kind: 'manual',
      availability: 'unknown',
      count: 0,
      vivino_rating: 3.9,
      vivino_count: 1877,
      vivino_url: 'https://www.vivino.com/w/2379181',
      vivino_checked_at: '2026-11-24T00:00:00.000Z',
    })
  })

  it('fetchWine: 404 NotFound, andra fel Transient, annars sidan', async () => {
    vi.stubGlobal('fetch', async () => new Response('', { status: 404 }))
    await expect(fetchWine('1')).rejects.toBeInstanceOf(NotFoundError)
    vi.stubGlobal('fetch', async () => new Response('', { status: 500 }))
    await expect(fetchWine('1')).rejects.toBeInstanceOf(TransientError)
    vi.stubGlobal('fetch', async () => {
      throw new Error('nät')
    })
    await expect(fetchWine('1')).rejects.toBeInstanceOf(TransientError)
    const calls: string[] = []
    vi.stubGlobal('fetch', async (url: string) => {
      calls.push(url)
      return new Response('sidan')
    })
    expect(await fetchWine('7')).toBe('sidan')
    expect(calls).toEqual(['https://www.vivino.com/w/7'])
  })
})

// Mutationstest 2026-11-24, andra rundan: sökblockets gränser, saknade fält och vinsidans kanter.
describe('vivino, gränserna', () => {
  const enc = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
  const hit = (name: string) => `{"wine":{"id":42},"name":"${name}","wine_ratings_average":4.1,"wine_ratings_count":12}`
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('träffens namn avkodas: apostrof och et-tecken', () => {
    expect(findHit(`<p>${enc(`"matches":[${hit("D'Arenberg & Co")}]`)}</p>`)?.name).toBe("D'Arenberg & Co")
  })

  it('bara sökblocket läses: inget före listan, inget efter en tom lista', () => {
    expect(findHit(enc(`"title":"x","name":"Sidans namn",`) + enc(`"matches":[${hit('Le Vin')}]`))?.name).toBe('Le Vin')
    expect(findHit(enc(hit('Annat vin')) + enc('"matches":[]'))).toBeNull()
    expect(findHit(enc('"matches":[]') + enc(`"recommended":[${hit('Annat vin')}]`))).toBeNull()
  })

  it('en träff utan namn, betyg eller antal ger null och kastar inte', () => {
    const full = hit('Le Vin')
    for (const cut of [',"name":"Le Vin"', ',"wine_ratings_average":4.1', ',"wine_ratings_count":12']) {
      expect(findHit(enc(`"matches":[${full.replace(cut, '')}]`))).toBeNull()
    }
  })

  it('sökord: tre tecken räcker, bara fyrsiffriga årtal stryks', () => {
    expect(tokens('Vin 2019 12345 cuvee2019 2019abc')).toEqual(['vin', '12345', 'cuvee2019', '2019abc'])
  })

  it('länken: skräp och lånade värdnamn nekas, vivino.com utan www godtas', () => {
    expect(() => parseVivinoUrl('inte en länk')).toThrow(FatalError)
    expect(() => parseVivinoUrl('https://vivino.com.evil.example/w/1')).toThrow(/not a vivino link/)
    expect(parseVivinoUrl('https://vivino.com/w/3')).toEqual({ wineId: '3', year: null })
  })

  it('vinsida: trasig escape behålls rå, bilden nära vinet, typ 24, tom region, flera druvor', () => {
    expect(parseWinePage('"wine":{"id":8,"name":"Bad \\q"}', '8').name).toBe('Bad \\q')
    const html =
      '"bottle_large":"//far.example/a.png"' +
      ' '.repeat(3100) +
      '"wine":{"id":9,"name":"N","type_id":24,"region":{"id":1,"name":""},"winery":{"id":2,"name":"W"},"region":{"id":3,"name":"Piemonte"},' +
      '"grapes":[{"id":1,"name":"Syrah"},{"id":2,"name":"Grenache"}],"bottle_large":"//near.example/b.png"}'
    expect(parseWinePage(html, '9')).toMatchObject({
      category: 'Starkvin, söta viner',
      region: 'Piemonte',
      grapes: 'Syrah, Grenache',
      image_url: 'https://near.example/b.png',
    })
  })

  it('refreshVivino: utan sparad länk inget fellogg; tillfälligt fel kastas även när söket skulle svara', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.stubGlobal('fetch', async () => new Response(page))
    await refreshVivino({ name: 'Le Grappin Savigny', producer: null, vivino_url: null })
    expect(log).not.toHaveBeenCalled()
    vi.stubGlobal('fetch', async (url: string) => (url.includes('/w/') ? new Response('', { status: 503 }) : new Response(page)))
    await expect(refreshVivino({ name: 'Le Grappin Savigny', producer: null, vivino_url: 'https://www.vivino.com/w/2379181' })).rejects.toBeInstanceOf(TransientError)
  })
})
