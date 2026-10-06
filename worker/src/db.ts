import { FatalError, NotFoundError } from '../../shared/errors.ts'
import { sanitize, sanitizeTasting } from '../../shared/sanitize.ts'
import { IMPORT_WEIGHT_MAX, type Drink, type DrinkPatch, type ExportData, type Tasting, type TastingInput } from '../../shared/types.ts'

type Derived = 'last_drunk_on' | 'last_rating' | 'tasting_count'
// Aggregaten kommer bara med i listan; en enskild rad läses med SELECT * och saknar dem.
type Row = Omit<Drink, 'owned' | Derived> & { owned: 0 | 1 } & Partial<Pick<Drink, Derived>>

// Kontrollen av inkommande rader ligger i shared/ sedan 2026-10-06: klientens JSON-import kör samma.
export { sanitize, sanitizeTasting, TEXT_MAX, LONG_TEXT_MAX, URL_MAX } from '../../shared/sanitize.ts'

function rowToDrink(row: Row): Drink {
  return { ...row, owned: row.owned === 1, last_drunk_on: row.last_drunk_on ?? null, last_rating: row.last_rating ?? null, tasting_count: row.tasting_count ?? 0 }
}

/**
 * Alla rader med senaste avsmakningen påhängd (backlog P3), så listan kan visa "senast drucken" utan ett
 * anrop per rad. `rating` i undergruppen hör till raden med `MAX(drunk_on)`: SQLite lovar det för en enda
 * min/max-aggregat, vilket sparar en fönsterfunktion.
 */
export async function listDrinks(db: D1Database, household: number): Promise<Drink[]> {
  // Båda delarna begränsas till hushållet: D1 räknar lästa rader, och en osorterad GROUP BY över alla hushålls loggar kostar per sidladdning.
  const { results } = await db
    .prepare(
      `SELECT d.*, t.last_drunk_on, t.last_rating, COALESCE(t.tasting_count, 0) AS tasting_count
       FROM drink d
       LEFT JOIN (SELECT drink_id, MAX(drunk_on) AS last_drunk_on, rating AS last_rating, COUNT(*) AS tasting_count
                  FROM tasting WHERE drink_id IN (SELECT id FROM drink WHERE household_id = ?1) GROUP BY drink_id) t
         ON t.drink_id = d.id
       WHERE d.household_id = ?1 ORDER BY d.id`,
    )
    .bind(household)
    .all<Row>()
  return results.map(rowToDrink)
}

/** Varje hushålls rader, för nattens uppdatering. Utan loggaggregat: natten behöver dem inte. */
export async function listAllDrinks(db: D1Database): Promise<Drink[]> {
  const { results } = await db.prepare('SELECT * FROM drink ORDER BY id').all<Row>()
  return results.map(rowToDrink)
}

export async function getDrink(db: D1Database, household: number, id: number): Promise<Drink> {
  const row = await db.prepare('SELECT * FROM drink WHERE id = ? AND household_id = ?').bind(id, household).first<Row>()
  if (!row) throw new NotFoundError(`drink ${id} not found`)
  return rowToDrink(row)
}

function insertStatement(db: D1Database, household: number, input: DrinkPatch): D1PreparedStatement {
  if (typeof input.name !== 'string' || input.name.trim() === '') throw new FatalError('name is required')
  if (input.kind !== 'wine' && input.kind !== 'spirit' && input.kind !== 'beer') throw new FatalError('kind is required')
  const keys = Object.keys(input) as Array<keyof DrinkPatch>
  const columns = ['household_id', ...keys].join(', ')
  const marks = ['?', ...keys.map(() => '?')].join(', ')
  const values = [household, ...keys.map((k) => input[k] as unknown)]
  return db.prepare(`INSERT INTO drink (${columns}) VALUES (${marks}) RETURNING *`).bind(...values)
}

export async function insertDrink(db: D1Database, household: number, input: DrinkPatch): Promise<Drink> {
  const row = await insertStatement(db, household, input).first<Row>()
  if (!row) throw new FatalError('insert returned no row', 500)
  return rowToDrink(row)
}

/**
 * En gästs lokala flaskor in i hushållet (2026-09-15). Allt kontrolleras innan något skrivs, så en trasig rad inte
 * lämnar halva bitar. Två batchar: raderna, sedan avsmakningarna mot de nya id:na. Ger antalet sparade rader.
 */
export async function importDrinks(db: D1Database, household: number, body: unknown): Promise<number> {
  const items = typeof body === 'object' && body !== null ? (body as { drinks?: unknown }).drinks : undefined
  if (!Array.isArray(items) || items.length === 0) throw new FatalError('drinks must be a non-empty array')
  const parsed = items.map((item) => {
    const tastings = typeof item === 'object' && item !== null ? (item as { tastings?: unknown }).tastings : undefined
    if (tastings !== undefined && !Array.isArray(tastings)) throw new FatalError('tastings must be an array')
    return { input: sanitize(item), tastings: (tastings ?? []).map(sanitizeTasting) }
  })
  const weight = parsed.reduce((n, p) => n + 1 + p.tastings.length, 0)
  if (weight > IMPORT_WEIGHT_MAX) throw new FatalError(`at most ${IMPORT_WEIGHT_MAX} drinks and tastings per call`)
  const inserted = await db.batch<Row>(parsed.map((p) => insertStatement(db, household, p.input)))
  const tastingStatements = parsed.flatMap((p, i) => {
    const id = inserted[i]?.results[0]?.id
    if (id === undefined) throw new FatalError('insert returned no row', 500)
    return p.tastings.map((t) => db.prepare('INSERT INTO tasting (drink_id, drunk_on, rating, note) VALUES (?, ?, ?, ?)').bind(id, t.drunk_on, t.rating, t.note))
  })
  if (tastingStatements.length > 0) await db.batch(tastingStatements)
  return inserted.length
}

/** Hela hushållet till en fil: raderna som listan ser dem och varje avsmakning. */
export async function exportHousehold(db: D1Database, household: number): Promise<ExportData> {
  const [drinks, name, tastings] = await Promise.all([
    listDrinks(db, household),
    db.prepare('SELECT name FROM household WHERE id = ?').bind(household).first<string>('name'),
    db.prepare('SELECT t.* FROM tasting t JOIN drink d ON d.id = t.drink_id WHERE d.household_id = ? ORDER BY t.drink_id, t.drunk_on').bind(household).all<Tasting>(),
  ])
  return { app: 'flaskor', exported_at: new Date().toISOString(), household: name, drinks, tastings: tastings.results }
}

/** Tar bort raden och dess avsmakningar. Kastar NotFoundError när raden inte finns. */
export async function deleteDrink(db: D1Database, household: number, id: number): Promise<void> {
  const result = await db.prepare('DELETE FROM drink WHERE id = ? AND household_id = ?').bind(id, household).run()
  if (result.meta.changes === 0) throw new NotFoundError(`drink ${id} not found`)
  // Tabellen har ON DELETE CASCADE, men den kräver att PRAGMA foreign_keys är på. En rad till är billigare
  // än en föräldralös logg som ingen upptäcker.
  await db.prepare('DELETE FROM tasting WHERE drink_id = ?').bind(id).run()
}

export async function updateDrink(db: D1Database, household: number, id: number, patch: DrinkPatch): Promise<Drink> {
  const keys = Object.keys(patch) as Array<keyof DrinkPatch>
  if (keys.length === 0) return getDrink(db, household, id)
  const sets = [...keys.map((k) => `${k} = ?`), "updated_at = datetime('now')"].join(', ')
  const values = [...keys.map((k) => patch[k] as unknown), id, household]
  const row = await db.prepare(`UPDATE drink SET ${sets} WHERE id = ? AND household_id = ? RETURNING *`).bind(...values).first<Row>()
  if (!row) throw new NotFoundError(`drink ${id} not found`)
  return rowToDrink(row)
}


// ── Drucken-logg (beslut 16) ─────────────────────────────────────────────────

/** Avsmakningarna för en rad, senast druckna först. Tom lista är ett giltigt svar: raden är inte drucken än. */
export async function listTastings(db: D1Database, drinkId: number): Promise<Tasting[]> {
  const { results } = await db.prepare('SELECT * FROM tasting WHERE drink_id = ? ORDER BY drunk_on DESC, id DESC').bind(drinkId).all<Tasting>()
  return results
}

/** Läser och kontrollerar en avsmakning ur ett anrop. Kastar på datum eller betyg som inte håller. */
export async function insertTasting(db: D1Database, drinkId: number, input: TastingInput): Promise<Tasting> {
  const row = await db
    .prepare('INSERT INTO tasting (drink_id, drunk_on, rating, note) VALUES (?, ?, ?, ?) RETURNING *')
    .bind(drinkId, input.drunk_on, input.rating, input.note)
    .first<Tasting>()
  if (!row) throw new FatalError('insert returned no tasting', 500)
  return row
}

/** Tar bort en avsmakning. Kastar NotFoundError när den inte finns på den raden. */
export async function deleteTasting(db: D1Database, drinkId: number, id: number): Promise<void> {
  const result = await db.prepare('DELETE FROM tasting WHERE id = ? AND drink_id = ?').bind(id, drinkId).run()
  if (result.meta.changes === 0) throw new NotFoundError(`tasting ${id} not found`)
}
