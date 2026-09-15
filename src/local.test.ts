import { describe, expect, it } from 'vitest'
import { IMPORT_WEIGHT_MAX, type ImportItem } from '../shared/types.ts'
import { blankDrink, chunkImport } from './local.ts'

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
