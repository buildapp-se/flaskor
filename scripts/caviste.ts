// Bildvalet på en Caviste-produktsida (BACKLOG P2). Sidan bär flera CAV<nr>-bilder: en liggande banner,
// en gruppbild på hela paketet ("-ALL"), och en hög bild per flaska. Seeden 2026-09-05 tog den första i
// HTML:en, vilket blev bannern eller gruppbilden. Här väljs i stället flaskan.
//
// WordPress publicerar varje bild i flera storlekar och skriver måtten i filnamnet (`-300x1116.jpg`), så
// formatet går att läsa utan att hämta en enda bild. En flaska är extremt hög och smal (höjd/bredd ≈ 3,7),
// en gruppbild ligger runt 1,6 och en banner under 1. Bär filnamnet dessutom ett ord ur vinnamnet
// ("CAV0143-webb-Sesia" mot "Coste della Sesia") är det den rätta flaskan av flera på samma sida.

const SIZE = /-(\d+)x(\d+)(\.jpe?g)$/i
const SKIP = new Set(['webb', 'web', 'cav', 'all', 'jpg', 'jpeg'])

/** Gemener utan diakriter: Caviste döper filerna "Forets" men vinet heter "Les Forêts". */
function fold(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/\p{M}+/gu, '')
}

/** Orden ur ett filnamn som kan säga vilket vin bilden visar: "CAV0143-webb-Sesia" ger ["sesia"]. */
function nameWords(base: string): string[] {
  const file = base.split('/').pop() ?? base
  return file
    .replace(/\.jpe?g$/i, '')
    .split(/[-_]+/)
    .map(fold)
    .filter((w) => w.length >= 3 && !SKIP.has(w) && !/^\d+$/.test(w) && !/^cav\d+$/.test(w))
}

/**
 * Flaskbilden till en Caviste-rad, eller null när sidan inte har någon bild för artikelnumret.
 * Rankar på namnträff först, sedan på höjd genom bredd. Svaret är originalbilden, utan storlekssuffix.
 */
export function pickCavisteImage(html: string, cavNr: string, name: string): string | null {
  const re = new RegExp(`https?://[^"'\\s]*wp-content/uploads/[^"'\\s]*CAV0*${cavNr}[^"'\\s]*\\.jpe?g`, 'gi')
  const words = new Set(fold(name).split(/[^\p{L}\p{N}]+/u))
  // En post per originalbild; storlekarna bidrar bara med formatet.
  const found = new Map<string, { ratio: number; hits: number }>()
  for (const url of html.match(re) ?? []) {
    const size = url.match(SIZE)
    const base = url.replace(SIZE, '$3')
    const ratio = size ? Number(size[2]) / Number(size[1]) : 0
    const entry = found.get(base) ?? { ratio: 0, hits: nameWords(base).filter((w) => words.has(w)).length }
    found.set(base, { ratio: Math.max(entry.ratio, ratio), hits: entry.hits })
  }
  const best = [...found].sort(([, a], [, b]) => b.hits - a.hits || b.ratio - a.ratio)[0]
  return best?.[0] ?? null
}
