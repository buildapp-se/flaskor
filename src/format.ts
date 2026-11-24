import { FatalError } from '../shared/errors.ts'
import type { Drink } from '../shared/types.ts'
import { S } from './strings.ts'

const NBSP = '\u00a0'

/** "1 125 kr": mellanslag som tusentalsavgränsare, hårt så beloppet aldrig bryts. */
export function kr(amount: number): string {
  const whole = Math.round(amount)
  const digits = String(Math.abs(whole))
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, NBSP)
  return `${whole < 0 ? '-' : ''}${grouped}${NBSP}${S.units.kr}`
}

/** "12,5 %": decimalkomma, hårt mellanslag före procenttecknet. */
export function pct(value: number): string {
  return `${String(value).replace('.', ',')}${NBSP}%`
}

/** "13,5" i ett inmatningsfält: decimalkomma, så det som visas går att skicka tillbaka oförändrat. */
export function decimalText(value: number | null): string {
  return value === null ? '' : String(value).replace('.', ',')
}

/**
 * Ett tal som det skrivs i svensk form: "1 299", "129,90", "149 kr", "13,5 %". Tomt ger null (inget värde);
 * allt annat som inte är ett tal kastar, så en felskrivning aldrig tyst blir tomt eller NaN.
 */
export function parseDecimal(raw: string): number | null {
  const t = raw.replace(/[\s  ]/g, '').replace(/(kr|%)$/i, '')
  if (t === '') return null
  // Inget minustecken: pris, årgång, volym, alkohol, fönster och betyg är aldrig negativa.
  if (!/^\d+([.,]\d+)?$/.test(t)) throw new FatalError(`not a number: ${raw}`)
  return Number(t.replace(',', '.'))
}

/** Sant när fältet är tomt eller ett tal som `parseDecimal` tar. */
export function isDecimal(raw: string): boolean {
  try {
    parseDecimal(raw)
    return true
  } catch {
    return false
  }
}

/** "2025–2032", eller null när fönstret saknas. */
export function yearRange(from: number | null, to: number | null): string | null {
  if (from === null || to === null) return null
  return `${from}–${to}`
}

/** "16–18 °C" ur textfältet serve_temp ("16-18", "10"). */
export function temp(serve: string): string {
  return `${serve.replace(/\s*-\s*/, '–')}${NBSP}°C`
}

/** "5 sep 2026" i svensk form. */
export function dateShort(iso: string): string {
  return new Date(iso).toLocaleDateString('sv-SE', { day: 'numeric', month: 'short', year: 'numeric' }).replace('.', '')
}

/** "75 cl" ur volume_ml. */
export function volume(ml: number): string {
  return `${String(ml / 10).replace('.', ',')}${NBSP}${S.units.cl}`
}

/** Artikelnummer som Systembolaget skriver det: "75624 01". Korta nummer lämnas. */
export function articleNo(number: string): string {
  return number.length > 4 ? `${number.slice(0, -2)}${NBSP}${number.slice(-2)}` : number
}

/** "Ordervara · Går att beställa", "Fast sortiment · Finns hos Systembolaget", "Utgått ur sortimentet". Utgått står ensamt: sortimentet är då inte längre sant. Önskelistan och detaljvyn delar texten. */
export function availabilityText(drink: Pick<Drink, 'availability' | 'sb_assortment'>): string {
  const A = S.wishlist.availability
  if (drink.availability === 'discontinued') return A.discontinued
  const label = drink.sb_assortment ? S.wishlist.assortment[drink.sb_assortment] : undefined
  const status = drink.availability === 'in_stock' && drink.sb_assortment === 'BS' ? A.orderable : A[drink.availability]
  return label ? `${label} · ${status}` : status
}
