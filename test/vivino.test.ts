import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { findHit, plausible, queryFor, vivinoDue } from '../worker/src/vivino.ts'

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
