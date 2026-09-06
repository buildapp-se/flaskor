import { TransientError } from '../../shared/errors.ts'
import type { Drink, DrinkPatch } from '../../shared/types.ts'

// Vivinos betyg (Patriks önskemål 2026-09-06). Vivino har inget öppet API, men söksidan är serverrenderad och bär
// träfflistan som HTML-kodad JSON. Första träffen tas, om dess namn liknar det vi sökte på; annars inget betyg.
// ponytail: en sidhämtning per vin, cachad i raden och uppdaterad var 30:e dag. Byt till deras interna API om sidan ändras.
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36'
export const VIVINO_MAX_AGE_DAYS = 30

export interface VivinoHit {
  /** Vinets snittbetyg över alla årgångar, 1 till 5. null när Vivino har för få röster för att visa ett snitt (de skriver 0). */
  rating: number | null
  count: number
  url: string
  /** Träffens namn, för rimlighetskontrollen. */
  name: string
}

export function searchUrl(query: string): string {
  return `https://www.vivino.com/sv/explore?search_term=${encodeURIComponent(query)}`
}

function unescapeHtml(s: string): string {
  return s.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&')
}

/** Första träffen på söksidan, eller null när listan är tom eller sidan saknar den. */
export function findHit(html: string): VivinoHit | null {
  const at = html.indexOf('&quot;matches&quot;:[')
  if (at === -1) return null
  const block = unescapeHtml(html.slice(at, at + 20000))
  if (block.startsWith('"matches":[]')) return null
  const name = block.match(/"name":"([^"]*)"/)?.[1]
  const rating = block.match(/"wine_ratings_average":([\d.]+)/)?.[1]
  const count = block.match(/"wine_ratings_count":(\d+)/)?.[1]
  const wineId = block.match(/"wine":\{"id":(\d+)/)?.[1]
  if (!name || !rating || !count || !wineId) return null
  return { rating: Number(rating) > 0 ? Number(rating) : null, count: Number(count), url: `https://www.vivino.com/w/${wineId}`, name }
}

function tokens(s: string): string[] {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 3 && !/^\d{4}$/.test(t))
}

/** Sant när minst hälften av sökordets ord finns i träffens namn. Vivino ger alltid en "närmaste" träff, även på skräp. */
export function plausible(query: string, hitName: string): boolean {
  const wanted = tokens(query)
  if (wanted.length === 0) return false
  const have = new Set(tokens(hitName))
  const found = wanted.filter((t) => have.has(t)).length
  return found * 2 >= wanted.length
}

/** Söksträngen för en rad: producent plus namn, utan att upprepa producenten när namnet redan bär den. */
export function queryFor(drink: Pick<Drink, 'name' | 'producer'>): string {
  const { name, producer } = drink
  if (!producer || name.toLowerCase().includes(producer.toLowerCase())) return name
  return `${producer} ${name}`
}

/** Träffen för ett vin, eller null när Vivino inte hittar något som liknar det. Nätfel och blockering kastar TransientError. */
export async function findVivino(query: string): Promise<VivinoHit | null> {
  let response: Response
  try {
    response = await fetch(searchUrl(query), { headers: { 'user-agent': USER_AGENT, accept: 'text/html', 'accept-language': 'sv-SE,sv;q=0.9,en;q=0.8' } })
  } catch (error) {
    throw new TransientError(`vivino unreachable: ${String(error)}`)
  }
  if (!response.ok) throw new TransientError(`vivino answered ${response.status}`)
  const hit = findHit(await response.text())
  return hit && plausible(query, hit.name) ? hit : null
}

/** Fälten som skrivs på raden: betyget, eller tomt men med hämtdatum så vi inte frågar igen i morgon. */
export function vivinoPatch(hit: VivinoHit | null, now = new Date()): DrinkPatch {
  const vivino_checked_at = now.toISOString()
  if (!hit) return { vivino_rating: null, vivino_count: null, vivino_url: null, vivino_checked_at }
  return { vivino_rating: hit.rating, vivino_count: hit.count, vivino_url: hit.url, vivino_checked_at }
}

/** Sant när raden är ett vin vars betyg saknas eller är äldre än 30 dagar. */
export function vivinoDue(drink: Drink, now = new Date()): boolean {
  if (drink.kind !== 'wine') return false
  if (drink.vivino_checked_at === null) return true
  return now.getTime() - new Date(drink.vivino_checked_at).getTime() > VIVINO_MAX_AGE_DAYS * 86_400_000
}
