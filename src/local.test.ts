import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { IMPORT_WEIGHT_MAX, type ImportItem } from '../shared/types.ts'
import { api } from './api.ts'
import { parseExport, toJson } from './export.ts'
import { FatalError, TransientError } from '../shared/errors.ts'
import { blankDrink, chunkImport, localBackend, clearLocal, importItems, localExport, ImportAbortedError, ImportTooLargeError } from './local.ts'

const { id: _i, household_id: _h, created_at: _c, updated_at: _u, last_drunk_on: _l, last_rating: _r, tasting_count: _t, ...base } = blankDrink('wine')
const item = (name: string, tastings = 0): ImportItem => ({ ...base, name, tastings: Array.from({ length: tastings }, () => ({ drunk_on: '2026-09-01', rating: null, note: null })) })
const weight = (chunk: ImportItem[]) => chunk.reduce((n, i) => n + 1 + (i.tastings?.length ?? 0), 0)

describe('uppladdningen i bitar (gäst till konto)', () => {
  it('ingen bit väger mer än servern tar emot, och ingen rad tappas eller byter plats', () => {
    const items = Array.from({ length: 100 }, (_, i) => item(`vin ${i}`, i % 7))
    const chunks = chunkImport(items)
    expect(chunks.every((c) => weight(c) <= IMPORT_WEIGHT_MAX)).toBe(true)
    expect(chunks.flat().map((i) => i.name)).toEqual(items.map((i) => i.name))
  })
  it('en rad med för många avsmakningar kapas till en egen bit', () => {
    const chunks = chunkImport([item('a'), item('loggad', 60), item('b')])
    expect(chunks.map((c) => c.map((i) => i.name))).toEqual([['a'], ['loggad'], ['b']])
    expect(chunks[1]![0]!.tastings).toHaveLength(IMPORT_WEIGHT_MAX - 1)
  })
  // Workern nekar en kropp över 65 536 byte (BODY_MAX): vikten räcker inte när raderna bär lång text.
  it('ingen bit blir större än servern läser, också med långa anteckningar och å, ä, ö', () => {
    const items = Array.from({ length: 60 }, (_, i) => ({ ...item(`vin ${i}`, i % 3), note: 'å'.repeat(1500), taste: 'x'.repeat(2000) }))
    const chunks = chunkImport(items)
    const body = (c: ImportItem[]) => new TextEncoder().encode(JSON.stringify({ drinks: c })).length
    expect(Math.max(...chunks.map(body))).toBeLessThanOrEqual(65_536)
    expect(chunks.length).toBeGreaterThan(Math.ceil(weight(items) / IMPORT_WEIGHT_MAX))
    expect(chunks.every((c) => weight(c) <= IMPORT_WEIGHT_MAX)).toBe(true)
    expect(chunks.flat().map((i) => i.name)).toEqual(items.map((i) => i.name))
  })
  it('tom lista ger inga anrop', () => {
    expect(chunkImport([])).toEqual([])
  })
})

describe('localBackend', () => {
  beforeEach(() => {
    const store = new Map<string, string>()
    globalThis.localStorage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => store.set(k, v),
      removeItem: (k: string) => store.delete(k),
      clear: () => store.clear(),
      length: 0,
      key: () => null
    } as any
    clearLocal()
  })

  it('kan skapa och spara en dryck med rätt tidsformat', async () => {
    const drink = await localBackend.createDrink({ kind: 'wine' } as any)
    expect(drink.kind).toBe('wine')
    expect(drink.id).toBe(1)
    expect(drink.created_at).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)
    
    const list = await localBackend.listDrinks()
    expect(list).toHaveLength(1)
    expect(list[0]!.id).toBe(1)
  })

  it('hanterar tom data (falsy raw) och trasig JSON i localStorage', async () => {
    localStorage.setItem('flaskor.local', '{ trasig json')
    let list = await localBackend.listDrinks()
    expect(list).toEqual([])
    
    localStorage.removeItem('flaskor.local')
    list = await localBackend.listDrinks()
    expect(list).toEqual([])
  })

  it('räknar ut antal och senaste avsmakning (inkluderar ej andras)', async () => {
    const d1 = await localBackend.createDrink({ kind: 'wine' } as any)
    const d2 = await localBackend.createDrink({ kind: 'beer' } as any)

    await localBackend.addTasting(d1.id, { drunk_on: '2026-09-01', rating: 3, note: null })
    await localBackend.addTasting(d1.id, { drunk_on: '2026-09-10', rating: 4, note: null })
    await localBackend.addTasting(d1.id, { drunk_on: '2026-08-15', rating: 2, note: null })

    const list = await localBackend.listDrinks()
    
    const read1 = list.find(d => d.id === d1.id)!
    expect(read1.tasting_count).toBe(3)
    expect(read1.last_drunk_on).toBe('2026-09-10')
    expect(read1.last_rating).toBe(4)

    const read2 = list.find(d => d.id === d2.id)!
    expect(read2.tasting_count).toBe(0)
    expect(read2.last_drunk_on).toBeNull()
    expect(read2.last_rating).toBeNull()
  })

  it('kastar fel vid uppdatering av obefintlig dryck', async () => {
    await expect(localBackend.patchDrink(999, {} as any)).rejects.toThrow('drink 999 not found')
  })
})

describe('importItems i gästläget', () => {
  beforeEach(() => {
    const store = new Map<string, string>()
    vi.stubGlobal('localStorage', { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => store.set(k, v), removeItem: (k: string) => store.delete(k) })
  })
  afterEach(() => vi.unstubAllGlobals())

  it('export, rensa, import ger samma lista tillbaka, med loggen på rätt flaska', async () => {
    const a = await localBackend.createDrink({ ...base, name: 'Barolo', owned: true, count: 2 })
    const b = await localBackend.createDrink({ ...base, kind: 'spirit', name: 'Gin', owned: true, open_level: 3 })
    await localBackend.addTasting(b.id, { drunk_on: '2026-09-10', rating: 5, note: 'bra' })
    const text = toJson(localExport())
    clearLocal()
    expect(await importItems(parseExport(text), true)).toBe(2)
    const list = await localBackend.listDrinks()
    expect(list.map((d) => [d.name, d.kind, d.owned, d.count, d.open_level, d.tasting_count, d.last_rating])).toEqual([
      ['Barolo', 'wine', true, 2, null, 0, null],
      ['Gin', 'spirit', true, 0, 3, 1, 5],
    ])
    expect(a.id).not.toBe(b.id)
    expect(await localBackend.listTastings(list[1]!.id)).toMatchObject([{ drunk_on: '2026-09-10', rating: 5, note: 'bra' }])
  })
  it('lägger till utan att röra det som finns, och nya id:n krockar inte', async () => {
    const kept = await localBackend.createDrink({ ...base, name: 'Kvar' })
    await localBackend.addTasting(kept.id, { drunk_on: '2026-01-01', rating: null, note: null })
    const text = toJson(localExport())
    await importItems(parseExport(text), true)
    const list = await localBackend.listDrinks()
    expect(list.map((d) => d.name)).toEqual(['Kvar', 'Kvar'])
    expect(new Set(list.map((d) => d.id)).size).toBe(2)
    expect(list.map((d) => d.tasting_count)).toEqual([1, 1])
    const next = await localBackend.createDrink({ ...base, name: 'Ny' })
    expect(list.map((d) => d.id)).not.toContain(next.id)
  })
})

describe('importItems till ett konto', () => {
  afterEach(() => vi.restoreAllMocks())
  it('skickar raderna i bitar som servern tar emot, utan serverfält, och summerar svaret', async () => {
    const sent: ImportItem[][] = []
    vi.spyOn(api, 'importDrinks').mockImplementation(async (chunk) => (sent.push(chunk), chunk.length))
    const drinks = Array.from({ length: 90 }, (_, i) => ({ ...blankDrink('wine'), id: i + 1, household_id: 5, name: `vin ${i}`, owned: true, count: 1 }))
    const tastings = [{ id: 1, drink_id: 90, drunk_on: '2026-09-01', rating: 3, note: null, created_at: 'x' }]
    const items = parseExport(toJson({ app: 'flaskor', exported_at: 'x', household: 'H', drinks, tastings }))
    expect(await importItems(items, false)).toBe(90)
    expect(sent.every((c) => c.reduce((n, i) => n + 1 + (i.tastings?.length ?? 0), 0) <= IMPORT_WEIGHT_MAX)).toBe(true)
    expect(sent.flat().map((i) => i.name)).toEqual(drinks.map((d) => d.name))
    expect(sent.flat()[89]).toMatchObject({ owned: true, tastings: [{ drunk_on: '2026-09-01', rating: 3, note: null }] })
    expect(sent.flat()[0]).not.toHaveProperty('id')
    expect(sent.flat()[0]).not.toHaveProperty('household_id')
  })
})

describe('importItems till ett konto: avbrott, tak och för stora rader', () => {
  afterEach(() => vi.restoreAllMocks())
  const many = (n: number) => Array.from({ length: n }, (_, i) => item(`vin ${i}`))

  it('429 väntas ut och samma bit skickas igen, ingen rad två gånger', async () => {
    const landed: string[] = []
    let calls = 0
    vi.spyOn(api, 'importDrinks').mockImplementation(async (chunk) => {
      if (++calls === 2 || calls === 3) throw new FatalError('too many requests, wait a minute', 429)
      landed.push(...chunk.map((i) => i.name))
      return chunk.length
    })
    const wait = vi.fn(async () => undefined)
    expect(await importItems(many(100), false, wait)).toBe(100)
    expect(wait).toHaveBeenCalledTimes(2)
    expect(landed).toEqual(many(100).map((i) => i.name))
  })
  it('429 utan slut ger upp med antalet som kom fram', async () => {
    let calls = 0
    vi.spyOn(api, 'importDrinks').mockImplementation(async (chunk) => {
      if (++calls > 1) throw new FatalError('too many requests, wait a minute', 429)
      return chunk.length
    })
    await expect(importItems(many(100), false, async () => undefined)).rejects.toMatchObject({ name: 'ImportAbortedError', sent: IMPORT_WEIGHT_MAX })
  })
  it('ett avbrott säger hur många rader som kom fram, och fortsättningen skickar bara resten', async () => {
    const landed: string[] = []
    let fail = true
    vi.spyOn(api, 'importDrinks').mockImplementation(async (chunk) => {
      if (fail && landed.length === IMPORT_WEIGHT_MAX) throw new TransientError('network')
      landed.push(...chunk.map((i) => i.name))
      return chunk.length
    })
    const items = many(100)
    const wait = vi.fn(async () => undefined)
    const error = await importItems(items, false, wait).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(ImportAbortedError)
    expect((error as ImportAbortedError).sent).toBe(IMPORT_WEIGHT_MAX)
    expect(wait).not.toHaveBeenCalled()
    fail = false
    expect(await importItems(items.slice((error as ImportAbortedError).sent), false, wait)).toBe(100 - IMPORT_WEIGHT_MAX)
    expect(landed).toEqual(items.map((i) => i.name))
  })
  it('en flaska som inte ryms i ett anrop fäller importen innan något skickats', async () => {
    const spy = vi.spyOn(api, 'importDrinks').mockResolvedValue(1)
    await expect(importItems([item('a'), item('loggad', IMPORT_WEIGHT_MAX)], false)).rejects.toBeInstanceOf(ImportTooLargeError)
    const fat = { ...item('tjock', 30), tastings: Array.from({ length: 30 }, () => ({ drunk_on: '2026-09-01', rating: null, note: 'x'.repeat(3000) })) }
    await expect(importItems([item('a'), fat], false)).rejects.toBeInstanceOf(ImportTooLargeError)
    expect(spy).not.toHaveBeenCalled()
    expect(await importItems([item('a'), item('loggad', IMPORT_WEIGHT_MAX - 1)], false)).toBe(2)
  })
})
