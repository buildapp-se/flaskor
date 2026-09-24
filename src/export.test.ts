import { afterEach, describe, expect, it, vi } from 'vitest'
import { blankDrink } from './local.ts'
import { exportName, toCsv, download, toJson } from './export.ts'

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
