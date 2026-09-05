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
