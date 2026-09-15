import { NotFoundError } from '../shared/errors.ts'
import { IMPORT_WEIGHT_MAX, type Drink, type DrinkInput, type DrinkPatch, type ExportData, type ImportItem, type Kind, type Tasting, type TastingInput } from '../shared/types.ts'
import { api } from './api.ts'

// Gästläget (2026-09-15): allt man gör utan konto sparas här, i webbläsarens localStorage. Samma form som servern
// svarar med, så resten av appen inte ser skillnad. ponytail: hela listan skrivs om vid varje ändring; tiotals till
// hundratals rader är några kilobyte, byt till IndexedDB först om någon har tusentals.

const KEY = 'flaskor.local'

interface LocalData {
  next: number
  drinks: Drink[]
  tastings: Tasting[]
  /** Hur många rader gästen sparat totalt, för påminnelsen om att skapa konto. */
  saves: number
}

const EMPTY: LocalData = { next: 1, drinks: [], tastings: [], saves: 0 }

function read(): LocalData {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? { ...EMPTY, ...(JSON.parse(raw) as Partial<LocalData>) } : { ...EMPTY }
  } catch {
    return { ...EMPTY }
  }
}

function write(data: LocalData): void {
  localStorage.setItem(KEY, JSON.stringify(data))
}

/** Samma tidsformat som D1:s datetime('now'), så datumvisningen fungerar likadant. */
function now(): string {
  return new Date().toISOString().slice(0, 19).replace('T', ' ')
}

/** Tom rad att fylla i. Formuläret i Lägg till utgår från den, och en lokal rad fylls ut med den. */
export function blankDrink(kind: Kind): Drink {
  return {
    id: 0, household_id: 0, kind, owned: false, name: '', producer: null, vintage: null, country: null, region: null, category: kind === 'wine' ? 'Rött vin' : null,
    style: null, grapes: null, volume_ml: null, alcohol: null, source_kind: 'manual', source_id: null, source_url: null, image_url: null, sb_product_id: null, sb_assortment: null, price_paid: null,
    price_current: null, price_checked_at: null, availability: 'unknown', count: 0, open_level: null, drink_from: null, drink_to: null, serve_temp: null,
    decant_hours: null, food: null, note: null, taste: null, vivino_rating: null, vivino_count: null, vivino_url: null, vivino_checked_at: null, rating: null, rating_url: null, last_drunk_on: null, last_rating: null, tasting_count: 0, created_at: '', updated_at: '',
  }
}

/** Raden med de härledda loggfälten, räknade som servern gör: senaste datum, dess betyg, antal. */
function withTastings(d: Drink, tastings: Tasting[]): Drink {
  const own = tastings.filter((t) => t.drink_id === d.id).sort((a, b) => b.drunk_on.localeCompare(a.drunk_on))
  return { ...d, last_drunk_on: own[0]?.drunk_on ?? null, last_rating: own[0]?.rating ?? null, tasting_count: own.length }
}

function getLocal(data: LocalData, id: number): Drink {
  const drink = data.drinks.find((d) => d.id === id)
  if (!drink) throw new NotFoundError(`drink ${id} not found`)
  return drink
}

export const localBackend = {
  async listDrinks(): Promise<Drink[]> {
    const data = read()
    return data.drinks.map((d) => withTastings(d, data.tastings))
  },
  async createDrink(input: DrinkInput): Promise<Drink> {
    const data = read()
    const stamp = now()
    const row: Drink = { ...blankDrink(input.kind), ...input, id: data.next, household_id: 0, created_at: stamp, updated_at: stamp }
    write({ ...data, next: data.next + 1, drinks: [...data.drinks, row], saves: data.saves + 1 })
    return withTastings(row, [])
  },
  async patchDrink(id: number, patch: DrinkPatch): Promise<Drink> {
    const data = read()
    const row = { ...getLocal(data, id), ...patch, updated_at: now() }
    write({ ...data, drinks: data.drinks.map((d) => (d.id === id ? row : d)) })
    return withTastings(row, data.tastings)
  },
  async deleteDrink(id: number): Promise<void> {
    const data = read()
    getLocal(data, id)
    write({ ...data, drinks: data.drinks.filter((d) => d.id !== id), tastings: data.tastings.filter((t) => t.drink_id !== id) })
  },
  async listTastings(drinkId: number): Promise<Tasting[]> {
    return read()
      .tastings.filter((t) => t.drink_id === drinkId)
      .sort((a, b) => b.drunk_on.localeCompare(a.drunk_on) || b.id - a.id)
  },
  async addTasting(drinkId: number, input: TastingInput): Promise<Tasting> {
    const data = read()
    getLocal(data, drinkId)
    const tasting: Tasting = { ...input, id: data.next, drink_id: drinkId, created_at: now() }
    write({ ...data, next: data.next + 1, tastings: [...data.tastings, tasting] })
    return tasting
  },
  async deleteTasting(drinkId: number, id: number): Promise<void> {
    const data = read()
    if (!data.tastings.some((t) => t.id === id && t.drink_id === drinkId)) throw new NotFoundError(`tasting ${id} not found`)
    write({ ...data, tastings: data.tastings.filter((t) => t.id !== id) })
  },
}

export type Backend = typeof localBackend

/** Antal rader sparade lokalt. 0 betyder att det inte finns något att ta med till ett konto. */
export function localCount(): number {
  return read().drinks.length
}

/** Hur många rader gästen sparat totalt, också borttagna. Styr när påminnelsen visas. */
export function localSaves(): number {
  return read().saves
}

export function clearLocal(): void {
  localStorage.removeItem(KEY)
}

export function localExport(): ExportData {
  const data = read()
  return { app: 'flaskor', exported_at: new Date().toISOString(), household: null, drinks: data.drinks.map((d) => withTastings(d, data.tastings)), tastings: data.tastings }
}

/**
 * De lokala raderna in i kontots hushåll, i bitar som servern tar emot (IMPORT_WEIGHT_MAX). Varje bit tas bort
 * lokalt så fort servern svarat, så ett nätfel halvvägs lämnar bara det som inte kommit fram, och ett nytt försök
 * skickar aldrig samma flaska två gånger. Ger antalet sparade rader.
 */
export async function uploadLocal(): Promise<number> {
  const data = read()
  const items = data.drinks.map(({ id, household_id: _h, created_at: _c, updated_at: _u, last_drunk_on: _l, last_rating: _r, tasting_count: _t, ...input }) => ({
    ...input,
    localId: id,
    tastings: data.tastings.filter((t) => t.drink_id === id).map(({ drunk_on, rating, note }) => ({ drunk_on, rating, note })),
  }))
  let sent = 0
  for (const chunk of chunkImport(items)) {
    sent += await api.importDrinks(chunk.map(({ localId: _id, ...item }) => item))
    const done = new Set(chunk.map((c) => c.localId))
    const left = read()
    write({ ...left, drinks: left.drinks.filter((d) => !done.has(d.id)), tastings: left.tastings.filter((t) => !done.has(t.drink_id)) })
  }
  clearLocal()
  return sent
}

/** Delar raderna i bitar där rader plus avsmakningar ryms i IMPORT_WEIGHT_MAX. Ordningen behålls. */
export function chunkImport<T extends ImportItem>(items: T[]): T[][] {
  const chunks: T[][] = []
  let chunk: T[] = []
  let weight = 0
  for (const item of items) {
    // ponytail: en enda rad med fler än 39 avsmakningar skickas med de första 39.
    const trimmed = { ...item, tastings: (item.tastings ?? []).slice(0, IMPORT_WEIGHT_MAX - 1) }
    const w = 1 + trimmed.tastings.length
    if (weight + w > IMPORT_WEIGHT_MAX && chunk.length > 0) {
      chunks.push(chunk)
      chunk = []
      weight = 0
    }
    chunk.push(trimmed)
    weight += w
  }
  if (chunk.length > 0) chunks.push(chunk)
  return chunks
}
