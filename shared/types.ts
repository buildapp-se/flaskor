// Datamodellen enligt CONTEXT.md: en tabell drink, en modell för vin och sprit (beslut 3).

export type Kind = 'wine' | 'spirit'
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
  created_at: string
  updated_at: string
}

/** Fälten klienten får skriva. Allt annat sätter servern. */
export type DrinkInput = Omit<Drink, 'id' | 'household_id' | 'created_at' | 'updated_at'>
export type DrinkPatch = Partial<DrinkInput>

/** Vad Workern svarar med när ett Systembolagsnummer hämtats: en rad utan id, redo att sparas. */
export type Preview = DrinkInput
