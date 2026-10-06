import { FatalError } from './errors.ts'
import type { DrinkInput, DrinkPatch, TastingInput } from './types.ts'

// Kontrollen av en inkommande rad och avsmakning. Workern kör den på allt som skrivs (worker/src/db.ts), och
// klienten på en importerad exportfil (src/export.ts), så gästläget inte sparar något servern hade nekat.

const WRITABLE: ReadonlyArray<keyof DrinkInput> = [
  'kind', 'owned', 'name', 'producer', 'vintage', 'country', 'region', 'category', 'style', 'grapes',
  'volume_ml', 'alcohol', 'source_kind', 'source_id', 'source_url', 'image_url', 'sb_product_id', 'sb_assortment', 'price_paid',
  'price_current', 'price_checked_at', 'availability', 'count', 'open_level', 'drink_from', 'drink_to',
  'serve_temp', 'decant_hours', 'food', 'note', 'taste', 'vivino_rating', 'vivino_count', 'vivino_url', 'vivino_checked_at', 'rating', 'rating_url',
]

const NUMBER_FIELDS = new Set<keyof DrinkInput>([
  'vintage', 'volume_ml', 'alcohol', 'price_paid', 'price_current', 'count', 'open_level', 'drink_from', 'drink_to', 'decant_hours', 'vivino_rating', 'vivino_count', 'rating',
])

const URL_FIELDS = new Set<keyof DrinkInput>(['source_url', 'image_url', 'vivino_url', 'rating_url'])

// Tak per textfält (OWASP 2026-09-16, A04): ett verifierat konto ska inte kunna fylla den delade D1-kvoten med
// en enda rad. Fritext (anteckning, smak, mat) får 4 000 tecken, allt annat 200; länkar 500.
export const TEXT_MAX = 200
export const LONG_TEXT_MAX = 4_000
export const URL_MAX = 500
const LONG_TEXT_FIELDS = new Set<keyof DrinkInput>(['note', 'taste', 'food'])

function textMax(key: keyof DrinkInput): number {
  return LONG_TEXT_FIELDS.has(key) ? LONG_TEXT_MAX : URL_FIELDS.has(key) ? URL_MAX : TEXT_MAX
}

/** Släpper bara igenom kända fält med rätt grovtyp. Databasens CHECK tar resten. */
export function sanitize(body: unknown): DrinkPatch {
  if (typeof body !== 'object' || body === null) throw new FatalError('body must be an object')
  const out: Record<string, unknown> = {}
  for (const key of WRITABLE) {
    if (!(key in body)) continue
    const value = (body as Record<string, unknown>)[key]
    if (value === null) {
      out[key] = null
    } else if (key === 'owned') {
      if (typeof value !== 'boolean') throw new FatalError('owned must be a boolean')
      out[key] = value ? 1 : 0
    } else if (NUMBER_FIELDS.has(key)) {
      if (typeof value !== 'number' || !Number.isFinite(value)) throw new FatalError(`${key} must be a number`)
      out[key] = value
    } else {
      if (typeof value !== 'string') throw new FatalError(`${key} must be a string`)
      if (value.length > textMax(key)) throw new FatalError(`${key} must be at most ${textMax(key)} characters`)
      // Länkfält renderas som href i klienten: bara http(s), aldrig javascript: eller data:.
      if (URL_FIELDS.has(key) && !/^https?:\/\//.test(value)) throw new FatalError(`${key} must be an http(s) url`)
      out[key] = value
    }
  }
  return out as DrinkPatch
}

export function sanitizeTasting(body: unknown): TastingInput {
  if (typeof body !== 'object' || body === null) throw new FatalError('body must be an object')
  const { drunk_on, rating, note } = body as Record<string, unknown>
  if (typeof drunk_on !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(drunk_on)) throw new FatalError('drunk_on must be a date, YYYY-MM-DD')
  if (rating !== undefined && rating !== null && (typeof rating !== 'number' || !Number.isInteger(rating) || rating < 1 || rating > 5)) {
    throw new FatalError('rating must be a whole number 1 to 5')
  }
  if (note !== undefined && note !== null && (typeof note !== 'string' || note.length > LONG_TEXT_MAX)) throw new FatalError(`note must be text of at most ${LONG_TEXT_MAX} characters`)
  return { drunk_on, rating: (rating as number | null | undefined) ?? null, note: (note as string | null | undefined) ?? null }
}
