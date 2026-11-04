import { describe, expect, it } from 'vitest'
import { DUMP_FIELDS, slim } from './assortment.ts'

describe('slim', () => {
  it('behåller bara fälten i DUMP_FIELDS, även när värdet är null eller falskt', () => {
    const raw = { productNumber: '7120', price: 0, isDiscontinued: false, vintage: null, images: [{ imageUrl: 'x' }], productLaunchDate: '2020', attachments: ['stor'] }
    expect(slim(raw)).toEqual({ productNumber: '7120', price: 0, isDiscontinued: false, vintage: null, images: [{ imageUrl: 'x' }] })
  })
  it('lägger inte till fält som saknas i raden', () => {
    expect(Object.keys(slim({ productId: '1' }))).toEqual(['productId'])
    expect(DUMP_FIELDS).toContain('assortment')
  })
})
