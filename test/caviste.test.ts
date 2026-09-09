import { describe, expect, it } from 'vitest'
import { pickCavisteImage } from '../scripts/caviste.ts'

// Adresserna är klippta ur två riktiga Caviste-sidor 2026-09-09. Bara adresserna spelar roll för valet,
// så sidorna behöver inte sparas som fixturer i sin helhet.
const CAV0143 = `
  <img src="https://www.caviste.se/wp-content/uploads/2021/11/CAV0143-webb-ALL.jpg">
  <img src="https://www.caviste.se/wp-content/uploads/2021/11/CAV0143-webb-ALL-300x480.jpg">
  <img src="https://www.caviste.se/wp-content/uploads/2021/11/CAV0143-webb-Bramaterra-300x1116.jpg">
  <img src="https://www.caviste.se/wp-content/uploads/2021/11/CAV0143-webb-Lessona-300x1116.jpg">
  <img src="https://www.caviste.se/wp-content/uploads/2021/11/CAV0143-webb-Sesia-150x562.jpg">
`
// Sex viner delar en sida: filnamnen skiljer dem åt, inte formatet.
const CAV0137 = `
  <img src="https://www.caviste.se/wp-content/uploads/2021/08/CAV0137-webb-1-768x343.jpg">
  <img src="https://www.caviste.se/wp-content/uploads/2021/08/CAV0137-webb-ALL-300x480.jpg">
  <img src="https://www.caviste.se/wp-content/uploads/2021/08/CAV0137-webb-Beaune-Greves-300x1116.jpg">
  <img src="https://www.caviste.se/wp-content/uploads/2021/08/CAV0137-webb-Savigny-blanc-300x1116.jpg">
  <img src="https://www.caviste.se/wp-content/uploads/2021/08/CAV0137-webb-Forets-300x1116.jpg">
`
const CAV0129 = `
  <img src="https://www.caviste.se/wp-content/uploads/2021/01/CAV0129-webb-1-768x343.jpg">
  <img src="https://www.caviste.se/wp-content/uploads/2021/01/CAV0129-webb-2-560x250.jpg">
  <img src="https://www.caviste.se/wp-content/uploads/2021/01/CAV0129-webb-3-300x456.jpg">
`

describe('caviste', () => {
  it('väljer flaskan vars filnamn bär ett ord ur vinnamnet', () => {
    expect(pickCavisteImage(CAV0143, '143', 'Colombera & Garella Coste della Sesia')).toBe('https://www.caviste.se/wp-content/uploads/2021/11/CAV0143-webb-Sesia.jpg')
    expect(pickCavisteImage(CAV0143, '143', 'Colombera & Garella Bramaterra')).toBe('https://www.caviste.se/wp-content/uploads/2021/11/CAV0143-webb-Bramaterra.jpg')
  })

  it('utan namnträff väljer den högsta bilden, inte den första', () => {
    // "-webb-1" är den liggande bannern och står först i HTML:en; "-webb-3" är flaskan.
    expect(pickCavisteImage(CAV0129, '129', 'Something Else')).toBe('https://www.caviste.se/wp-content/uploads/2021/01/CAV0129-webb-3.jpg')
    // Gruppbilden "-ALL" (300x480) förlorar mot en enskild flaska (300x1116).
    expect(pickCavisteImage(CAV0143, '143', 'Something Else')).toMatch(/CAV0143-webb-(Bramaterra|Lessona|Sesia)\.jpg$/)
  })

  it('bortser från diakriter och väljer den mest specifika träffen', () => {
    // "Forêts" mot filnamnet "Forets".
    expect(pickCavisteImage(CAV0137, '137', 'Patrick Piuze Chablis Premier Cru Les Forêts')).toMatch(/-Forets\.jpg$/)
    // Två träffar (beaune, greves) slår en (blanc).
    expect(pickCavisteImage(CAV0137, '137', 'Le Grappin Beaune Premier Cru Les Grèves Blanc')).toMatch(/-Beaune-Greves\.jpg$/)
  })

  it('ger null när sidan saknar bild för artikelnumret', () => {
    expect(pickCavisteImage(CAV0129, '143', 'Colombera & Garella')).toBeNull()
  })
})
