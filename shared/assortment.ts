// Kontraktet mellan nattskriptet (scripts/assortment.ts, kört av GitHub Actions) och Workerns POST /api/assortment.
// Ligger i shared/ så båda sidor läser samma lista utan att skriptet drar in Workerns typer.

/** Fälten ur Systembolagsdumpen som Workern läser (worker/src/assortment.ts fromDump). Resten skickas inte: rå rad är 3,7 kB, bilagorna störst. */
export const DUMP_FIELDS = [
  'productId', 'productNumber', 'productNameBold', 'productNameThin', 'producerName', 'vintage', 'country',
  'originLevel1', 'originLevel2', 'categoryLevel1', 'categoryLevel2', 'categoryLevel3', 'grapes', 'price', 'volume',
  'alcoholPercentage', 'usage', 'taste', 'assortment', 'isTemporaryOutOfStock', 'isCompletelyOutOfStock',
  'isSupplierTemporaryNotAvailable', 'isDiscontinued', 'images',
] as const

/** Rader per anrop. 300 slimmade rader är cirka 150 kB, vilket Workern parsar på ett par millisekunder: klart under gratisplanens tak. */
export const CHUNK_ROWS = 300

export interface AssortmentChunk {
  /** Körningens id, ISO-tid när skriptet startade. Alla rader i körningen får det som updated_at. */
  run: string
  /** Rader ur dumpen, slimmade till DUMP_FIELDS. Utelämnas i avslutningsanropet. */
  rows?: unknown[]
  /** Sant i sista anropet: rader utanför `numbers` tas bort och spegeln stämplas som färsk. */
  done?: boolean
  /** Alla artikelnummer i dumpen, bara i avslutningsanropet. Oförändrade rader stämplas inte om, så listan är det enda som säger vad som utgått. */
  numbers?: string[]
}

export interface AssortmentResult {
  /** Rader som faktiskt skrevs: oförändrade rader kostar inget mot D1:s dagskvot. */
  upserted: number
  /** Bara i avslutningsanropet. */
  rows?: number
  removed?: number
}

/** En dumprad slimmad till DUMP_FIELDS. Här och inte i skriptet, så Workerns test kan köra fromDump(slim(rad)) och falla när listan och läsaren glider isär (2026-09-13: assortment saknades i listan, spegeln fick null på alla rader). */
export function slim(raw: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const key of DUMP_FIELDS) if (key in raw) out[key] = raw[key]
  return out
}
