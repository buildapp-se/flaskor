// Kontraktet mellan nattskriptet (scripts/assortment.ts, kört av GitHub Actions) och Workerns POST /api/assortment.
// Ligger i shared/ så båda sidor läser samma lista utan att skriptet drar in Workerns typer.

/** Fälten ur Systembolagsdumpen som Workern läser (worker/src/assortment.ts fromDump). Resten skickas inte: rå rad är 3,7 kB, bilagorna störst. */
export const DUMP_FIELDS = [
  'productId', 'productNumber', 'productNameBold', 'productNameThin', 'producerName', 'vintage', 'country',
  'originLevel1', 'originLevel2', 'categoryLevel1', 'categoryLevel2', 'categoryLevel3', 'grapes', 'price', 'volume',
  'alcoholPercentage', 'usage', 'taste', 'isTemporaryOutOfStock', 'isCompletelyOutOfStock', 'isDiscontinued', 'images',
] as const

/** Rader per anrop. 300 slimmade rader är cirka 150 kB, vilket Workern parsar på ett par millisekunder: klart under gratisplanens tak. */
export const CHUNK_ROWS = 300

export interface AssortmentChunk {
  /** Körningens id, ISO-tid när skriptet startade. Alla rader i körningen får det som updated_at. */
  run: string
  /** Rader ur dumpen, slimmade till DUMP_FIELDS. Utelämnas i avslutningsanropet. */
  rows?: unknown[]
  /** Sant i sista anropet: rader från äldre körningar tas bort och spegeln stämplas som färsk. */
  done?: boolean
}

export interface AssortmentResult {
  upserted: number
  /** Bara i avslutningsanropet. */
  rows?: number
  removed?: number
}
