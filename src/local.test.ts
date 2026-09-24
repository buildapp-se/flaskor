import { beforeEach, describe, expect, it } from 'vitest'
import { IMPORT_WEIGHT_MAX, type ImportItem } from '../shared/types.ts'
import { blankDrink, chunkImport, localBackend, clearLocal } from './local.ts'

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
