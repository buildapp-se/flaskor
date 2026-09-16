import { describe, expect, it } from 'vitest'
import { blankDrink } from './local.ts'
import { exportName, toCsv } from './export.ts'

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
  it('tomma fält är tomma, inte "null"', () => {
    expect(toCsv([blankDrink('beer')])).not.toContain('null')
  })
  it('filnamnet bär lokalt datum', () => {
    expect(exportName('csv', new Date(2026, 8, 5, 23, 30))).toBe('flaskor-2026-09-05.csv')
  })
})
