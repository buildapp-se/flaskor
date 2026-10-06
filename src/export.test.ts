import { afterEach, describe, expect, it, vi } from 'vitest'
import { blankDrink } from './local.ts'
import { exportName, toCsv, download, toJson, parseExport } from './export.ts'

describe('CSV för svensk Excel', () => {
  it('semikolon, decimalkomma, citat där det behövs, BOM först', () => {
    const d = { ...blankDrink('wine'), name: 'Château "Le" Pin; Pomerol', owned: true, count: 2, alcohol: 13.5, price_paid: 1299.5, note: 'rad ett\nrad två' }
    const csv = toCsv([d])
    expect(csv.startsWith('﻿Typ;Namn;')).toBe(true)
    const row = csv.split('\r\n')[1]!
    expect(row).toContain('Vin;"Château ""Le"" Pin; Pomerol";')
    expect(row).toContain(';ja;2;1299,5;')
    expect(row).toContain(';13,5;')
    expect(row).toContain('"rad ett\nrad två"')
  })
  // OWASP 2026-09-16, låg: en cell som börjar med formeltecken blir text i Excel, minustal är fortfarande tal.
  it('formeltecken först i text får en apostrof, tal lämnas', () => {
    const csv = toCsv([{ ...blankDrink('wine'), name: '=HYPERLINK("https://evil.example")', producer: '+Plus', price_paid: -5 }])
    const row = csv.split('\r\n')[1]!
    expect(row).toContain(`;"'=HYPERLINK(""https://evil.example"")";'+Plus;`)
    expect(row).toContain(';-5;')
  })
  it('sätter inte apostrof om formeltecknet är inuti texten', () => {
    const csv = toCsv([{ ...blankDrink('wine'), name: 'Château+Pin' }])
    const row = csv.split('\r\n')[1]!
    expect(row).toContain(';Château+Pin;')
    expect(row).not.toContain(";'Château+Pin;")
  })
  it('tomma fält är tomma, inte "null"', () => {
    expect(toCsv([blankDrink('beer')])).not.toContain('null')
  })
  it('tomma fält blir helt tomma i CSV:n', () => {
    const csv = toCsv([blankDrink('beer')])
    expect(csv).toContain(';;')
    expect(csv).not.toContain('Stryker')
  })
  it('filnamnet bär lokalt datum', () => {
    expect(exportName('csv', new Date(2026, 8, 5, 23, 30))).toBe('flaskor-2026-09-05.csv')
  })
  it('innehåller alla förväntade kolumner i headern', () => {
    const csv = toCsv([])
    const header = csv.split('\r\n')[0]!
    expect(header).toBe('﻿Typ;Namn;Producent;Årgång;Land;Region;Kategori;Druvor;Hemma;Antal;Inköpspris;Dagspris;Volym (ml);Alkohol (%);Drick från;Drick till;Servering;Karaffering (h);Mat;Kommentar;Betyg;Senast drucken;Antal avsmakningar;Källa;Artikelnummer;Länk')
  })
  it('översätter dryckestyp', () => {
    expect(toCsv([blankDrink('wine')])).toContain('\r\nVin;')
    expect(toCsv([blankDrink('spirit')])).toContain('\r\nSprit;')
    expect(toCsv([blankDrink('beer')])).toContain('\r\nÖl;')
  })
  it('exporterar fält för producent, årgång, ursprung och druvor', () => {
    const d = { 
      ...blankDrink('wine'),
      producer: 'Producenten',
      vintage: 2020,
      country: 'Sverige',
      region: 'Skåne',
      category: 'Rött',
      grapes: 'Pinot Noir'
    }
    const csv = toCsv([d])
    const row = csv.split('\r\n')[1]!
    expect(row).toContain(';Producenten;2020;Sverige;Skåne;Rött;Pinot Noir;')
  })
  it('prioriterar vivino_rating framför rating', () => {
    expect(toCsv([{ ...blankDrink('wine'), vivino_rating: 4.5, rating: null }])).toContain(';4,5;')
    expect(toCsv([{ ...blankDrink('wine'), vivino_rating: null, rating: 3 }])).toContain(';3;')
    expect(toCsv([{ ...blankDrink('wine'), vivino_rating: 4.5, rating: 3 }])).toContain(';4,5;')
  })
  it('översätter falskt till nej', () => {
    expect(toCsv([{ ...blankDrink('wine'), owned: false }])).toContain(';nej;')
  })
  it('avslutas med en nyrad', () => {
    const csv = toCsv([])
    expect(csv.endsWith('\r\n')).toBe(true)
  })
})

describe('JSON-export', () => {
  it('formaterar JSON snyggt', () => {
    const data = { app: 'flaskor' } as any
    expect(toJson(data)).toBe('{\n  "app": "flaskor"\n}')
  })
})

describe('Nedladdning', () => {
  // stubGlobal återställs efter testet, en rak tilldelning av URL och document läcker till nästa test.
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('skapar en länk och klickar på den', async () => {
    const revokeMock = vi.fn()
    const clickMock = vi.fn()
    const aMock = { click: clickMock, download: '', href: '' }
    const createElement = vi.fn(() => aMock)

    let blobPromise!: Promise<string>
    let blobType = ''

    vi.stubGlobal('URL', {
      createObjectURL: vi.fn((blob: Blob) => {
        blobPromise = blob.text()
        blobType = blob.type
        return 'blob:test'
      }),
      revokeObjectURL: revokeMock,
    })
    vi.stubGlobal('document', { createElement })

    vi.useFakeTimers()

    download('test.txt', 'hello', 'text/plain')
    
    const blobText = await blobPromise

    expect(blobText).toBe('hello')
    expect(blobType).toBe('text/plain')
    expect(createElement).toHaveBeenCalledWith('a')
    expect(aMock.download).toBe('test.txt')
    expect(aMock.href).toBe('blob:test')
    expect(clickMock).toHaveBeenCalled()

    vi.runAllTimers()
    expect(revokeMock).toHaveBeenCalledWith('blob:test')
  })
})

describe('parseExport: exportfilen tillbaka till rader', () => {
  const file = (drinks: unknown[], tastings: unknown[] = []) => JSON.stringify({ app: 'flaskor', exported_at: '2026-10-06T20:00:00Z', household: null, drinks, tastings })
  const wine = { ...blankDrink('wine'), id: 7, household_id: 3, name: 'Barolo', owned: true, count: 2, created_at: '2026-01-01 10:00:00', updated_at: '2026-01-01 10:00:00', last_drunk_on: '2026-09-01', last_rating: 4, tasting_count: 1 }

  it('en export går runt: fälten kvar, serverfälten borta, avsmakningen på rätt rad', () => {
    const other = { ...blankDrink('spirit'), id: 8, name: 'Gin', open_level: 2 as const }
    const items = parseExport(toJson({ app: 'flaskor', exported_at: 'x', household: 'Hemma', drinks: [wine, other], tastings: [{ id: 1, drink_id: 7, drunk_on: '2026-09-01', rating: 4, note: 'gott', created_at: 'x' }] }))
    expect(items).toHaveLength(2)
    expect(items[0]).toMatchObject({ name: 'Barolo', kind: 'wine', owned: true, count: 2, tastings: [{ drunk_on: '2026-09-01', rating: 4, note: 'gott' }] })
    expect(items[1]).toMatchObject({ name: 'Gin', owned: false, open_level: 2, tastings: [] })
    for (const key of ['id', 'household_id', 'created_at', 'updated_at', 'last_drunk_on', 'last_rating', 'tasting_count']) expect(items[0]).not.toHaveProperty(key)
    expect(items[0]!.tastings![0]).not.toHaveProperty('id')
  })
  it('nekar det som inte är en Flaskor-export', () => {
    expect(() => parseExport('inte json')).toThrow('not json')
    expect(() => parseExport('null')).toThrow('not a flaskor export')
    expect(() => parseExport(JSON.stringify({ app: 'annat', drinks: [] }))).toThrow('not a flaskor export')
    expect(() => parseExport(JSON.stringify({ app: 'flaskor', drinks: 'x' }))).toThrow('not a flaskor export')
  })
  it('en enda dålig rad fäller hela filen', () => {
    expect(() => parseExport(file([wine, { ...wine, name: '' }]))).toThrow('name is required')
    expect(() => parseExport(file([{ ...wine, kind: 'cider' }]))).toThrow('kind is required')
    expect(() => parseExport(file([{ ...wine, count: '2' }]))).toThrow('count must be a number')
    expect(() => parseExport(file([{ ...wine, count: -1 }]))).toThrow('count must be a whole number')
    expect(() => parseExport(file([{ ...wine, availability: 'kanske' }]))).toThrow('unknown availability')
    expect(() => parseExport(file([{ ...wine, source_kind: 'vivino' }]))).toThrow('unknown source_kind')
    expect(() => parseExport(file([{ ...wine, open_level: 9 }]))).toThrow('open_level')
    expect(() => parseExport(file([wine], [{ drink_id: 7, drunk_on: 'i går' }]))).toThrow('drunk_on')
  })
  // Länkfälten renderas som href: en fil får inte smuggla in javascript: i gästläget, där ingen server kontrollerar.
  it('nekar en länk som inte är http(s)', () => {
    expect(() => parseExport(file([{ ...wine, source_url: 'javascript:alert(1)' }]))).toThrow('source_url must be an http(s) url')
  })
  // Utan kontrollen matchar undefined === undefined, och varje avsmakning utan drink_id hamnar på varje flaska utan id.
  it('avsmakningar hängs bara på ett id som är ett tal, och samma id två gånger nekas', () => {
    const { id: _id, ...noId } = wine
    const items = parseExport(file([noId, { ...noId, name: 'Annan' }, wine], [{ drunk_on: '2026-09-01' }, { drink_id: 7, drunk_on: '2026-09-02' }]))
    expect(items.map((i) => i.tastings!.length)).toEqual([0, 0, 1])
    expect(parseExport(file([{ ...noId, id: '7' }], [{ drink_id: '7', drunk_on: '2026-09-01' }]))[0]!.tastings).toEqual([])
    expect(() => parseExport(file([wine, { ...wine, name: 'Kopia' }], [{ drink_id: 7, drunk_on: '2026-09-01' }]))).toThrow('duplicate id')
  })
  it('okända fält följer inte med', () => {
    expect(parseExport(file([{ ...wine, __proto__x: 1, extra: 'x' }]))[0]).not.toHaveProperty('extra')
  })
})
