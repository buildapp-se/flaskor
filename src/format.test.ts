import { describe, expect, it } from 'vitest'
import { kr, pct, temp, volume, yearRange } from './format.ts'

// Hårt mellanslag (U+00A0) i belopp och enheter, så de aldrig radbryts.
const N = '\u00a0'

describe('format', () => {
  it('belopp med mellanslag som tusentalsavgränsare', () => {
    expect(kr(1125)).toBe(`1${N}125${N}kr`)
    expect(kr(499)).toBe(`499${N}kr`)
    expect(kr(12500)).toBe(`12${N}500${N}kr`)
    expect(kr(1234567)).toBe(`1${N}234${N}567${N}kr`)
  })
  it('procent med decimalkomma', () => {
    expect(pct(12.5)).toBe(`12,5${N}%`)
    expect(pct(13)).toBe(`13${N}%`)
  })
  it('årsintervall', () => {
    expect(yearRange(2025, 2032)).toBe('2025–2032')
    expect(yearRange(null, 2032)).toBeNull()
  })
  it('temperatur och volym', () => {
    expect(temp('16-18')).toBe(`16–18${N}°C`)
    expect(temp('10')).toBe(`10${N}°C`)
    expect(volume(750)).toBe(`75${N}cl`)
    expect(volume(375)).toBe(`37,5${N}cl`)
  })
})
