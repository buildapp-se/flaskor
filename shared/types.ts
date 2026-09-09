// Datamodellen enligt CONTEXT.md: en tabell drink, en modell för vin och sprit (beslut 3).

export type Kind = 'wine' | 'spirit' | 'beer'
export type SourceKind = 'systembolaget' | 'caviste' | 'manual'
export type Availability = 'in_stock' | 'temporarily_out' | 'discontinued' | 'unknown'
/** Fjärdedelar kvar i den öppnade flaskan (beslut 14). null: ingen öppnad. */
export type OpenLevel = 4 | 3 | 2 | 1
export type WindowState = 'wait' | 'drink' | 'soon' | 'past' | 'unknown'

export interface Drink {
  id: number
  household_id: number
  kind: Kind
  owned: boolean
  name: string
  producer: string | null
  vintage: number | null
  country: string | null
  region: string | null
  category: string | null
  style: string | null
  grapes: string | null
  volume_ml: number | null
  alcohol: number | null
  source_kind: SourceKind
  source_id: string | null
  source_url: string | null
  image_url: string | null
  /** Systembolagets interna produkt-id, som lagersaldot per butik slås upp på. Inte artikelnumret. */
  sb_product_id: string | null
  price_paid: number | null
  price_current: number | null
  price_checked_at: string | null
  availability: Availability
  count: number
  open_level: OpenLevel | null
  drink_from: number | null
  drink_to: number | null
  serve_temp: string | null
  decant_hours: number | null
  food: string | null
  note: string | null
  taste: string | null
  /** Vivinos betyg för vinet (inte årgången), 1 till 5, med antal röster och länk. null: inte hämtat eller ingen träff. */
  vivino_rating: number | null
  vivino_count: number | null
  vivino_url: string | null
  vivino_checked_at: string | null
  /** Eget eller importerat betyg för sprit och öl (Vivino täcker bara vin), 1 till 5, med länk till källan. */
  rating: number | null
  rating_url: string | null
  /**
   * Härlett ur `tasting` i GET /api/drinks, inte kolumner på raden: senaste avsmakningens datum och betyg samt
   * antalet anteckningar. Finns för att listan ska kunna visa "senast drucken" utan ett anrop per rad (backlog P3).
   */
  last_drunk_on: string | null
  last_rating: number | null
  tasting_count: number
  created_at: string
  updated_at: string
}

/** Fälten klienten får skriva. Allt annat sätter servern, och de härledda fälten räknas fram vid läsning. */
export type DrinkInput = Omit<Drink, 'id' | 'household_id' | 'created_at' | 'updated_at' | 'last_drunk_on' | 'last_rating' | 'tasting_count'>
export type DrinkPatch = Partial<DrinkInput>

/** Vad Workern svarar med när ett Systembolagsnummer hämtats: en rad utan id, redo att sparas. */
export type Preview = DrinkInput

/** Vad streckkoden eller etiketten sa om flaskan (BACKLOG 37). Bara det som gick att läsa, resten null. */
export interface LabelGuess {
  kind: Kind
  name: string
  producer: string | null
  category: string | null
  vintage: number | null
  volume_ml: number | null
  alcohol: number | null
  ean: string | null
}

/** En träff i Systembolagets sök, nog för att välja rätt flaska. Hela raden hämtas sedan med GET /api/systembolaget. */
export interface Candidate {
  number: string
  name: string
  producer: string | null
  category: string | null
  volume_ml: number | null
  price: number | null
  vintage: number | null
  image_url: string | null
}

/**
 * En avsmakning (beslut 16, backlog P3): en rad kan drickas många gånger, så loggen är egna rader.
 * `drunk_on` är ett datum, `YYYY-MM-DD`, inte en tidsstämpel: ingen minns klockslaget.
 */
export interface Tasting {
  id: number
  drink_id: number
  drunk_on: string
  rating: number | null
  note: string | null
  created_at: string
}

export type TastingInput = Omit<Tasting, 'id' | 'drink_id' | 'created_at'>

/** Svaret på GET /api/stock: saldot för en rad i en butik. `shelf` är Systembolagets hyllplats, "14-04-03". */
export interface Stock {
  store: string
  stock: number
  shelf: string | null
  in_assortment: boolean
}

/** Svaret på POST /api/scan: gissningen, upp till tre kandidater, och för vin utan träff Vivinos vinsida. */
export interface ScanResult {
  guess: LabelGuess
  candidates: Candidate[]
  vivino_url: string | null
  via: 'barcode' | 'label'
}
