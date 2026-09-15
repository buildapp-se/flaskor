import type { Drink, ExportData } from '../shared/types.ts'

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
  const text = typeof value === 'boolean' ? (value ? 'ja' : 'nej') : typeof value === 'number' ? String(value).replace('.', ',') : value
  return /[;"\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

export function toCsv(drinks: Drink[]): string {
  const lines = [COLUMNS.map(([h]) => h), ...drinks.map((d) => COLUMNS.map(([, v]) => cell(v(d))))]
  return '﻿' + lines.map((l) => l.join(';')).join('\r\n') + '\r\n'
}

export function toJson(data: ExportData): string {
  return JSON.stringify(data, null, 2)
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
