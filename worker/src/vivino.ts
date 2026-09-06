import { FatalError, NotFoundError, TransientError } from '../../shared/errors.ts'
import type { Drink, DrinkPatch, Preview } from '../../shared/types.ts'

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

// ── Lägg till från Vivino-länk (2026-09-06) ─────────────────────────────────
// Vinsidan (vivino.com/.../w/<id>?year=2018) är också serverrenderad med vinet som HTML-kodad JSON.
// Vi läser producent, namn, typ, region, land, druvor, alkohol, bild, betyg och matförslag. Pris hoppas över.

/** Vinets id och årgång ur en Vivino-länk. Kastar på allt som inte är en vivino.com-länk med /w/<id>. */
export function parseVivinoUrl(input: string): { wineId: string; year: number | null } {
  let url: URL
  try {
    url = new URL(input.trim())
  } catch {
    throw new FatalError('not a vivino link')
  }
  if (!/(^|\.)vivino\.com$/.test(url.hostname)) throw new FatalError('not a vivino link')
  const wineId = url.pathname.match(/\/w\/(\d+)/)?.[1]
  if (!wineId) throw new FatalError('no wine id in vivino link')
  const year = url.searchParams.get('year')
  return { wineId, year: year && /^\d{4}$/.test(year) ? Number(year) : null }
}

export function wineUrl(wineId: string): string {
  return `https://www.vivino.com/w/${wineId}`
}

/** Vivinos type_id till Systembolagets nivå 2, så tumregeln och chipsen känner igen vinet. */
const TYPE: Record<string, string> = { '1': 'Rött vin', '2': 'Vitt vin', '3': 'Mousserande vin', '4': 'Rosévin', '7': 'Starkvin, söta viner', '24': 'Starkvin, söta viner' }

/** Landsnamn på svenska för de vanliga; övriga behåller Vivinos engelska. */
const COUNTRY: Record<string, string> = {
  Italy: 'Italien', France: 'Frankrike', Spain: 'Spanien', Germany: 'Tyskland', Austria: 'Österrike', Portugal: 'Portugal',
  'United States': 'USA', Australia: 'Australien', 'New Zealand': 'Nya Zeeland', 'South Africa': 'Sydafrika', Chile: 'Chile',
  Argentina: 'Argentina', Greece: 'Grekland', Hungary: 'Ungern', Sweden: 'Sverige', Denmark: 'Danmark', 'United Kingdom': 'Storbritannien',
}

/** JSON-strängen som den står i blobben ("Colombera & Garella") till text. */
function jsonString(raw: string): string {
  try {
    return JSON.parse(`"${raw}"`) as string
  } catch {
    return raw
  }
}

export interface VivinoWine {
  name: string
  winery: string | null
  category: string | null
  region: string | null
  country: string | null
  grapes: string | null
  alcohol: number | null
  image_url: string | null
  rating: number | null
  count: number | null
  food: string | null
}

/** Vinet ur vinsidan. Kastar NotFoundError när sidan inte bär vinet med det id:t. */
export function parseWinePage(html: string, wineId: string): VivinoWine {
  const decoded = unescapeHtml(html)
  const anchor = `"wine":{"id":${wineId},"name":"`
  const start = decoded.indexOf(anchor)
  if (start === -1) throw new NotFoundError(`vivino wine ${wineId} not on page`)
  const block = decoded.slice(start, start + 30000)
  const before = decoded.slice(Math.max(0, start - 3000), start)
  const first = (re: RegExp, s = block): string | null => s.match(re)?.[1] ?? null

  const name = jsonString(first(/^"wine":\{"id":\d+,"name":"([^"]*)"/) ?? '')
  const winery = first(/"winery":\{"id":\d+,"name":"([^"]*)"/)
  const wineryAt = block.search(/"winery":\{/)
  const region = first(/"region":\{"id":\d+,"name":"([^"]*)"/)
  const parentRegion = wineryAt === -1 ? null : first(/"region":\{"id":\d+,"name":"([^"]*)"/, block.slice(wineryAt))
  const country = first(/"country":\{"code":"[a-z]+","name":"([^"]*)"/)
  const stats = block.match(/"statistics":\{"status":"[^"]*","ratings_count":(\d+),"ratings_average":([\d.]+)/)
  const grapes = [...(first(/"grapes":\[(.*?)\]/) ?? '').matchAll(/"name":"([^"]*)"/g)].map((m) => jsonString(m[1]!))
  // Matlistan slutar med "}]"; varje post har bilder som nästlade objekt men inga egna listor.
  const food = [...(first(/"food":\[(.*?)\}\]/) ?? '').matchAll(/"name":"([^"]*)"/g)].map((m) => jsonString(m[1]!))
  const alcohol = first(/"alcohol":([\d.]+)/)
  const bottle = first(/"bottle_large":"([^"]*)"/, before) ?? first(/"bottle_large":"([^"]*)"/)
  const rating = stats ? Number(stats[2]) : null

  return {
    name: [winery ? jsonString(winery) : null, name].filter(Boolean).join(' '),
    winery: winery ? jsonString(winery) : null,
    category: first(/"type_id":(\d+)/) ? (TYPE[first(/"type_id":(\d+)/)!] ?? null) : null,
    region: [region, parentRegion].filter((r): r is string => r !== null && r !== '').filter((r, i, all) => all.indexOf(r) === i).map(jsonString).join(', ') || null,
    country: country ? (COUNTRY[jsonString(country)] ?? jsonString(country)) : null,
    grapes: grapes.length > 0 ? grapes.join(', ') : null,
    alcohol: alcohol ? Number(alcohol) : null,
    image_url: bottle ? (bottle.startsWith('//') ? `https:${bottle}` : bottle) : null,
    rating: rating !== null && rating > 0 ? rating : null,
    count: stats ? Number(stats[1]) : null,
    food: food.length > 0 ? food.join(', ') : null,
  }
}

export async function fetchWine(wineId: string): Promise<string> {
  let response: Response
  try {
    response = await fetch(wineUrl(wineId), { headers: { 'user-agent': USER_AGENT, accept: 'text/html', 'accept-language': 'sv-SE,sv;q=0.9,en;q=0.8' } })
  } catch (error) {
    throw new TransientError(`vivino unreachable: ${String(error)}`)
  }
  if (response.status === 404) throw new NotFoundError(`vivino wine ${wineId} not found`)
  if (!response.ok) throw new TransientError(`vivino answered ${response.status}`)
  return response.text()
}

/** En rad redo att sparas ur en Vivino-länk: önskelistan, källa manual, betyget ifyllt så POST inte söker igen. */
export function vivinoToPreview(wine: VivinoWine, wineId: string, year: number | null, now = new Date()): Preview {
  return {
    kind: 'wine',
    owned: false,
    name: wine.name,
    producer: wine.winery,
    vintage: year,
    country: wine.country,
    region: wine.region,
    category: wine.category,
    style: null,
    grapes: wine.grapes,
    volume_ml: null,
    alcohol: wine.alcohol,
    source_kind: 'manual',
    source_id: null,
    source_url: null,
    image_url: wine.image_url,
    price_paid: null,
    price_current: null,
    price_checked_at: null,
    availability: 'unknown',
    count: 0,
    open_level: null,
    drink_from: null,
    drink_to: null,
    serve_temp: null,
    decant_hours: null,
    food: wine.food,
    note: null,
    taste: null,
    vivino_rating: wine.rating,
    vivino_count: wine.count,
    vivino_url: wineUrl(wineId),
    vivino_checked_at: now.toISOString(),
  }
}
