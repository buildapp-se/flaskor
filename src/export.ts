import { FatalError } from '../shared/errors.ts'
import { sanitize, sanitizeTasting } from '../shared/sanitize.ts'
import type { Drink, ExportData, ImportItem } from '../shared/types.ts'

// Exportera data (2026-09-15): hela listan som JSON (allt, även loggen) eller CSV (en rad per flaska, för Excel).
// CSV:n skrivs för svensk Excel: semikolon mellan fälten, decimalkomma och en BOM så å, ä och ö läses rätt.

type Column = [header: string, value: (d: Drink) => string | number | boolean | null]

const COLUMNS: ReadonlyArray<Column> = [
  ['Typ', (d) => ({ wine: 'Vin', spirit: 'Sprit', beer: 'Öl' })[d.kind]],
  ['Namn', (d) => d.name],
  ['Producent', (d) => d.producer],
  ['Årgång', (d) => d.vintage],
  ['Land', (d) => d.country],
  ['Region', (d) => d.region],
  ['Kategori', (d) => d.category],
  ['Druvor', (d) => d.grapes],
  ['Hemma', (d) => d.owned],
  ['Antal', (d) => d.count],
  ['Inköpspris', (d) => d.price_paid],
  ['Dagspris', (d) => d.price_current],
  ['Volym (ml)', (d) => d.volume_ml],
  ['Alkohol (%)', (d) => d.alcohol],
  ['Drick från', (d) => d.drink_from],
  ['Drick till', (d) => d.drink_to],
  ['Servering', (d) => d.serve_temp],
  ['Karaffering (h)', (d) => d.decant_hours],
  ['Mat', (d) => d.food],
  ['Kommentar', (d) => d.note],
  ['Betyg', (d) => d.vivino_rating ?? d.rating],
  ['Senast drucken', (d) => d.last_drunk_on],
  ['Antal avsmakningar', (d) => d.tasting_count],
  ['Källa', (d) => d.source_kind],
  ['Artikelnummer', (d) => d.source_id],
  ['Länk', (d) => d.source_url],
]

function cell(value: string | number | boolean | null): string {
  if (value === null) return ''
  if (typeof value === 'number') return String(value).replace('.', ',')
  if (typeof value === 'boolean') return value ? 'ja' : 'nej'
  // Text som börjar med = + - @ eller tab tolkar Excel som en formel (OWASP 2026-09-16, låg): ett inledande
  // apostroftecken gör den till text, som när man skriver det i en cell för hand.
  const text = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value
  return /[;"\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

export function toCsv(drinks: Drink[]): string {
  const lines = [COLUMNS.map(([h]) => h), ...drinks.map((d) => COLUMNS.map(([, v]) => cell(v(d))))]
  return '﻿' + lines.map((l) => l.join(';')).join('\r\n') + '\r\n'
}

export function toJson(data: ExportData): string {
  return JSON.stringify(data, null, 2)
}

const KINDS = ['wine', 'spirit', 'beer']
const SOURCES = ['systembolaget', 'caviste', 'manual']
const AVAILABILITY = ['in_stock', 'temporarily_out', 'supplier_out', 'sold_out', 'discontinued', 'unknown']

/**
 * En exporterad JSON-fil (toJson) tillbaka till rader att lägga till, var och en med sina avsmakningar. Kastar
 * FatalError när filen inte är en Flaskor-export eller någon rad inte håller: hellre ingenting än en halv fil.
 * Fälten går genom samma kontroll som servern kör (sanitize), så id, hushåll, tidsstämplar och okända fält faller
 * bort och en länk som inte är http(s) nekas. Värdelistorna kontrolleras här, eftersom gästläget saknar databasens CHECK.
 */
export function parseExport(text: string): ImportItem[] {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    throw new FatalError('not json')
  }
  const { app, drinks, tastings = [] } = (typeof data === 'object' && data !== null ? data : {}) as Partial<ExportData>
  if (app !== 'flaskor' || !Array.isArray(drinks) || !Array.isArray(tastings)) throw new FatalError('not a flaskor export')
  const seen = new Set<number>()
  return drinks.map((raw: unknown) => {
    const { owned: _owned, ...clean } = sanitize(raw)
    const row = raw as { id?: unknown; owned?: unknown }
    if (typeof clean.name !== 'string' || clean.name.trim() === '') throw new FatalError('name is required')
    if (!KINDS.includes(clean.kind as string)) throw new FatalError('kind is required')
    if (clean.source_kind !== undefined && !SOURCES.includes(clean.source_kind)) throw new FatalError('unknown source_kind')
    if (clean.availability !== undefined && !AVAILABILITY.includes(clean.availability)) throw new FatalError('unknown availability')
    if (clean.open_level != null && ![1, 2, 3, 4].includes(clean.open_level)) throw new FatalError('open_level must be 1 to 4')
    if (clean.count !== undefined && (clean.count === null || !Number.isInteger(clean.count) || clean.count < 0)) throw new FatalError('count must be a whole number')
    // Avsmakningar hängs bara på ett id som är ett tal och unikt i filen: annars hamnar samma logg på flera flaskor.
    const id = typeof row.id === 'number' ? row.id : null
    if (id !== null && seen.has(id)) throw new FatalError('duplicate id')
    if (id !== null) seen.add(id)
    const own = id === null ? [] : tastings.filter((t: unknown) => typeof t === 'object' && t !== null && (t as { drink_id?: unknown }).drink_id === id).map(sanitizeTasting)
    // sanitize ger owned som 0 eller 1 för databasen; klienten och importvägen vill ha sant eller falskt.
    return { ...clean, owned: row.owned === true, tastings: own } as ImportItem
  })
}

/** Sparar texten som en fil via en tillfällig länk. Fungerar i alla moderna webbläsare, även Safari på iPhone. */
export function download(filename: string, text: string, type: string): void {
  const url = URL.createObjectURL(new Blob([text], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** "flaskor-2026-09-15.csv" i lokal tid. */
export function exportName(ext: 'json' | 'csv', date = new Date()): string {
  return `flaskor-${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}.${ext}`
}
