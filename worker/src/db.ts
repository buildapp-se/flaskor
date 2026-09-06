import { FatalError, NotFoundError } from '../../shared/errors.ts'
import type { Drink, DrinkInput, DrinkPatch } from '../../shared/types.ts'

export const HOUSEHOLD_ID = 1

type Row = Omit<Drink, 'owned'> & { owned: 0 | 1 }

function rowToDrink(row: Row): Drink {
  return { ...row, owned: row.owned === 1 }
}

const WRITABLE: ReadonlyArray<keyof DrinkInput> = [
  'kind', 'owned', 'name', 'producer', 'vintage', 'country', 'region', 'category', 'style', 'grapes',
  'volume_ml', 'alcohol', 'source_kind', 'source_id', 'source_url', 'image_url', 'price_paid',
  'price_current', 'price_checked_at', 'availability', 'count', 'open_level', 'drink_from', 'drink_to',
  'serve_temp', 'decant_hours', 'food', 'note', 'taste', 'vivino_rating', 'vivino_count', 'vivino_url', 'vivino_checked_at',
]

const NUMBER_FIELDS = new Set<keyof DrinkInput>([
  'vintage', 'volume_ml', 'alcohol', 'price_paid', 'price_current', 'count', 'open_level', 'drink_from', 'drink_to', 'decant_hours', 'vivino_rating', 'vivino_count',
])

const URL_FIELDS = new Set<keyof DrinkInput>(['source_url', 'image_url', 'vivino_url'])

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
      // Länkfält renderas som href i klienten: bara http(s), aldrig javascript: eller data:.
      if (URL_FIELDS.has(key) && !/^https?:\/\//.test(value)) throw new FatalError(`${key} must be an http(s) url`)
      out[key] = value
    }
  }
  return out as DrinkPatch
}

export async function listDrinks(db: D1Database): Promise<Drink[]> {
  const { results } = await db.prepare('SELECT * FROM drink WHERE household_id = ? ORDER BY id').bind(HOUSEHOLD_ID).all<Row>()
  return results.map(rowToDrink)
}

export async function getDrink(db: D1Database, id: number): Promise<Drink> {
  const row = await db.prepare('SELECT * FROM drink WHERE id = ? AND household_id = ?').bind(id, HOUSEHOLD_ID).first<Row>()
  if (!row) throw new NotFoundError(`drink ${id} not found`)
  return rowToDrink(row)
}

export async function insertDrink(db: D1Database, input: DrinkPatch): Promise<Drink> {
  if (typeof input.name !== 'string' || input.name.trim() === '') throw new FatalError('name is required')
  if (input.kind !== 'wine' && input.kind !== 'spirit') throw new FatalError('kind is required')
  const keys = Object.keys(input) as Array<keyof DrinkPatch>
  const columns = ['household_id', ...keys].join(', ')
  const marks = ['?', ...keys.map(() => '?')].join(', ')
  const values = [HOUSEHOLD_ID, ...keys.map((k) => input[k] as unknown)]
  const row = await db.prepare(`INSERT INTO drink (${columns}) VALUES (${marks}) RETURNING *`).bind(...values).first<Row>()
  if (!row) throw new FatalError('insert returned no row', 500)
  return rowToDrink(row)
}

/** Tar bort raden. Kastar NotFoundError när den inte finns. */
export async function deleteDrink(db: D1Database, id: number): Promise<void> {
  const result = await db.prepare('DELETE FROM drink WHERE id = ? AND household_id = ?').bind(id, HOUSEHOLD_ID).run()
  if (result.meta.changes === 0) throw new NotFoundError(`drink ${id} not found`)
}

export async function updateDrink(db: D1Database, id: number, patch: DrinkPatch): Promise<Drink> {
  const keys = Object.keys(patch) as Array<keyof DrinkPatch>
  if (keys.length === 0) return getDrink(db, id)
  const sets = [...keys.map((k) => `${k} = ?`), "updated_at = datetime('now')"].join(', ')
  const values = [...keys.map((k) => patch[k] as unknown), id, HOUSEHOLD_ID]
  const row = await db.prepare(`UPDATE drink SET ${sets} WHERE id = ? AND household_id = ? RETURNING *`).bind(...values).first<Row>()
  if (!row) throw new NotFoundError(`drink ${id} not found`)
  return rowToDrink(row)
}
