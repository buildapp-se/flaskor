import { FatalError } from '../shared/errors.ts'

// Fota flaskan (BACKLOG 37): fotot krymps i webbläsaren innan det skickas (en telefonbild är 3 till 5 MB, Gemini behöver
// 1 280 px), och när webbläsaren själv kan läsa streckkoder (Android Chrome) skickas koden med. iPhone saknar läsaren
// (BarcodeDetector trasig sedan iOS 18), där läser Gemini siffrorna under streckkoden i stället, eller så skrivs de in.

const MAX_SIDE = 1280

/** Fotot som JPEG-data-URL, högst 1 280 px på längsta sidan, roterat enligt EXIF. */
export async function shrink(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new FatalError('canvas unavailable')
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  return canvas.toDataURL('image/jpeg', 0.8)
}

interface Detector {
  detect(source: ImageBitmapSource): Promise<{ rawValue: string }[]>
}
type DetectorCtor = new (options: { formats: string[] }) => Detector

/** Streckkoden i fotot när webbläsaren kan läsa den, annars null. Aldrig ett fel: fotot går vidare till Gemini ändå. */
export async function findBarcode(file: File): Promise<string | null> {
  const Ctor = (globalThis as { BarcodeDetector?: DetectorCtor }).BarcodeDetector
  if (!Ctor) return null
  try {
    const bitmap = await createImageBitmap(file)
    const hits = await new Ctor({ formats: ['ean_13', 'ean_8', 'upc_a'] }).detect(bitmap)
    bitmap.close()
    return hits[0]?.rawValue ?? null
  } catch {
    return null
  }
}

/** Sant när det som skrevs i rutan ser ut som en streckkod (8, 12 eller 13 siffror), inte ett artikelnummer (4 till 7). */
export function looksLikeEan(input: string): boolean {
  return /^\d{8}$|^\d{12,13}$/.test(input.replace(/\s/g, ''))
}
