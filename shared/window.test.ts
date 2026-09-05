import { describe, expect, it } from 'vitest'
import { ruleOfThumb, windowState } from './window.ts'

const today = new Date('2026-09-05')

describe('windowState (beslut 12)', () => {
  it('saknat fält ger unknown', () => {
    expect(windowState(null, 2030, today)).toBe('unknown')
    expect(windowState(2020, null, today)).toBe('unknown')
  })
  it('före fönstret ger wait', () => expect(windowState(2027, 2035, today)).toBe('wait'))
  it('inne i fönstret ger drink', () => expect(windowState(2025, 2032, today)).toBe('drink'))
  it('sista tolv månaderna ger soon', () => {
    expect(windowState(2022, 2026, today)).toBe('soon')
    expect(windowState(2022, 2026, new Date('2026-01-01'))).toBe('soon')
    expect(windowState(2022, 2026, new Date('2025-12-31'))).toBe('drink')
  })
  it('efter 31 december drink_to ger past', () => {
    expect(windowState(2019, 2024, today)).toBe('past')
    expect(windowState(2019, 2025, new Date('2026-01-01'))).toBe('past')
    expect(windowState(2019, 2025, new Date('2025-12-31'))).toBe('soon')
  })
  it('första dagen i fönstret är drink', () => expect(windowState(2026, 2030, new Date('2026-01-01'))).toBe('drink'))
})

describe('ruleOfThumb (beslut 13)', () => {
  it('rött vin i tre prisband', () => {
    expect(ruleOfThumb('wine', 'Rött vin', 2020, 149)).toEqual({ drink_from: 2020, drink_to: 2023 })
    expect(ruleOfThumb('wine', 'Rött vin', 2020, 150)).toEqual({ drink_from: 2021, drink_to: 2026 })
    expect(ruleOfThumb('wine', 'Rött vin', 2020, 300)).toEqual({ drink_from: 2021, drink_to: 2026 })
    expect(ruleOfThumb('wine', 'Rött vin', 2020, 301)).toEqual({ drink_from: 2022, drink_to: 2030 })
  })
  it('vitt, rosé, mousserande', () => {
    expect(ruleOfThumb('wine', 'Vitt vin', 2023, 164)).toEqual({ drink_from: 2023, drink_to: 2027 })
    expect(ruleOfThumb('wine', 'Rosévin', 2024, 500)).toEqual({ drink_from: 2024, drink_to: 2027 })
    expect(ruleOfThumb('wine', 'Mousserande vin', 2015, 800)).toEqual({ drink_from: 2016, drink_to: 2023 })
  })
  it('starkvin och söta viner även under andra nivå 2-namn', () => {
    expect(ruleOfThumb('wine', 'Starkvin, söta viner', 2000, 100)).toEqual({ drink_from: 2000, drink_to: 2010 })
    expect(ruleOfThumb('wine', 'Starkvin', 2000, 200)).toEqual({ drink_from: 2000, drink_to: 2015 })
    expect(ruleOfThumb('wine', 'Dessertvin', 2000, 400)).toEqual({ drink_from: 2000, drink_to: 2025 })
  })
  it('sprit, saknad årgång, saknat pris och okänd kategori ger null', () => {
    expect(ruleOfThumb('spirit', 'Vodka', 2020, 200)).toBeNull()
    expect(ruleOfThumb('wine', 'Rött vin', null, 200)).toBeNull()
    expect(ruleOfThumb('wine', 'Rött vin', 2020, null)).toBeNull()
    expect(ruleOfThumb('wine', 'Sake', 2020, 200)).toBeNull()
    expect(ruleOfThumb('wine', null, 2020, 200)).toBeNull()
  })
})
