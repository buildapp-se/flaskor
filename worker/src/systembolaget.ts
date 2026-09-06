import { FatalError, NotFoundError, TransientError } from '../../shared/errors.ts'
import type { Availability, Kind, Preview } from '../../shared/types.ts'
import { ruleOfThumb } from '../../shared/window.ts'

// Systembolagets produktsida är serverrenderad Next.js. Sluggen ignoreras, bara numret styr (docs/RESEARCH.md).
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36'

export function productUrl(number: string): string {
  return `https://www.systembolaget.se/produkt/vin/x-${number}/`
}

/** Artikelnummer ur ett nummer eller en inklistrad produktlänk. Kastar om inget nummer går att läsa. */
export function parseProductNumber(input: string): string {
  const trimmed = input.trim()
  if (/^\d{4,7}$/.test(trimmed)) return trimmed
  let path: string
  try {
    path = new URL(trimmed).pathname
  } catch {
    throw new FatalError('not a product number or link')
  }
  const match = path.match(/-(\d{5,7})\/?$/)
  if (!match?.[1]) throw new FatalError('no product number in link')
  return match[1]
}

/** Fälten vi läser ur __NEXT_DATA__. Allt annat i objektet ignoreras. */
export interface Product {
  productId: string
  productNumber: string
  productNameBold: string
  productNameThin: string | null
  producerName: string | null
  vintage: string | null
  country: string | null
  originLevel1: string | null
  originLevel2: string | null
  categoryLevel1: string | null
  categoryLevel2: string | null
  categoryLevel3: string | null
  grapes: string | null
  priceInclVat: number | null
  volume: number | null
  alcoholPercentage: number | null
  usage: string | null
  taste: string | null
  isTemporaryOutOfStock: boolean
  isCompletelyOutOfStock: boolean
  isDiscontinued: boolean
}

function findProduct(node: unknown): Record<string, unknown> | null {
  if (typeof node !== 'object' || node === null) return null
  const obj = node as Record<string, unknown>
  if (typeof obj['productNumber'] === 'string' && typeof obj['productNameBold'] === 'string') return obj
  for (const value of Object.values(obj)) {
    const found = findProduct(value)
    if (found) return found
  }
  return null
}

function str(v: unknown): string | null {
  return typeof v === 'string' && v.trim() !== '' ? v : null
}
function num(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}

export function parseProductPage(html: string): Product {
  const match = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/)
  if (!match?.[1]) throw new FatalError('no __NEXT_DATA__ on page', 502)
  const raw = findProduct(JSON.parse(match[1]))
  if (!raw) throw new NotFoundError('no product on page')
  return {
    productId: String(raw['productId']),
    productNumber: String(raw['productNumber']),
    productNameBold: String(raw['productNameBold']),
    productNameThin: str(raw['productNameThin']),
    producerName: str(raw['producerName']),
    vintage: str(raw['vintage']),
    country: str(raw['country']),
    originLevel1: str(raw['originLevel1']),
    originLevel2: str(raw['originLevel2']),
    categoryLevel1: str(raw['categoryLevel1']),
    categoryLevel2: str(raw['categoryLevel2']),
    categoryLevel3: str(raw['categoryLevel3']),
    grapes: str(raw['grapes']),
    priceInclVat: num(raw['priceInclVat']),
    volume: num(raw['volume']),
    alcoholPercentage: num(raw['alcoholPercentage']),
    usage: str(raw['usage']),
    taste: str(raw['taste']),
    isTemporaryOutOfStock: raw['isTemporaryOutOfStock'] === true,
    isCompletelyOutOfStock: raw['isCompletelyOutOfStock'] === true,
    isDiscontinued: raw['isDiscontinued'] === true,
  }
}

export function availabilityOf(p: Product): Availability {
  if (p.isDiscontinued) return 'discontinued'
  if (p.isTemporaryOutOfStock || p.isCompletelyOutOfStock) return 'temporarily_out'
  return 'in_stock'
}

export function imageUrl(productId: string): string {
  return `https://product-cdn.systembolaget.se/productimages/${productId}/${productId}_200.webp`
}

/** Systembolagets usage är fritext, "Serveras vid 16-18°C till ...". Temperaturen bryts ut, resten blir mat. */
export function splitUsage(usage: string | null): { serve_temp: string | null; food: string | null } {
  if (!usage) return { serve_temp: null, food: null }
  const temp = usage.match(/(\d{1,2}(?:\s*[-–]\s*\d{1,2})?)\s*°\s*C/)
  const serve_temp = temp?.[1]?.replace(/\s*[-–]\s*/, '-') ?? null
  const food = usage.match(/\btill\s+(.+?)\.?$/i)?.[1] ?? null
  return { serve_temp, food: serve_temp === null && food === null ? usage : food }
}

/** En rad redo att sparas (owned false, count 0), fönster från tumregeln (beslut 13). */
export function toPreview(p: Product, now = new Date()): Preview {
  const kind: Kind = p.categoryLevel1 === 'Sprit' ? 'spirit' : 'wine'
  const vintage = p.vintage ? Number(p.vintage) : null
  const window = ruleOfThumb(kind, p.categoryLevel2, vintage, p.priceInclVat)
  const { serve_temp, food } = splitUsage(p.usage)
  return {
    kind,
    owned: false,
    name: [p.productNameBold, p.productNameThin].filter(Boolean).join(' '),
    producer: p.producerName,
    vintage,
    country: p.country,
    region: [p.originLevel2, p.originLevel1].filter(Boolean).join(', ') || null,
    category: p.categoryLevel2,
    style: p.categoryLevel3,
    grapes: p.grapes,
    volume_ml: p.volume,
    alcohol: p.alcoholPercentage,
    source_kind: 'systembolaget',
    source_id: p.productNumber,
    source_url: productUrl(p.productNumber),
    image_url: imageUrl(p.productId),
    price_paid: null,
    price_current: p.priceInclVat,
    price_checked_at: now.toISOString(),
    availability: availabilityOf(p),
    count: 0,
    open_level: null,
    drink_from: window?.drink_from ?? null,
    drink_to: window?.drink_to ?? null,
    serve_temp,
    decant_hours: null,
    food,
    note: null,
    taste: p.taste,
    vivino_rating: null,
    vivino_count: null,
    vivino_url: null,
    vivino_checked_at: null,
  }
}

export async function fetchProduct(number: string): Promise<Product> {
  let response: Response
  try {
    response = await fetch(productUrl(number), { headers: { 'user-agent': USER_AGENT, accept: 'text/html' } })
  } catch (error) {
    throw new TransientError(`systembolaget unreachable: ${String(error)}`)
  }
  if (response.status === 404) throw new NotFoundError(`product ${number} not found`)
  if (response.status >= 500 || response.status === 429) throw new TransientError(`systembolaget answered ${response.status}`)
  if (!response.ok) throw new FatalError(`systembolaget answered ${response.status}`, 502)
  return parseProductPage(await response.text())
}
