// Lagersaldo per butik (BACKLOG P3). Systembolagets sök-API svarar på lagerfrågor med samma publika frontendnyckel
// som skanningen redan använder, verifierat 2026-09-09:
//   GET /sb-api-ecommerce/v1/stockbalance/store/{butik}/{productId}
//   -> {"productId":"164","storeId":"2401","shelf":"14-04-03","stock":48,"isInStoreAssortment":true}
// Fällan: id:t är Systembolagets interna `productId`, inte artikelnumret. Artikelnumret svarar 200 med stock 0 och
// isInStoreAssortment false på varje butik, alltså tyst fel svar, inte ett fel. Därför bär raden `sb_product_id`.
import { FatalError, NotFoundError, TransientError } from '../../shared/errors.ts'
import type { Stock } from '../../shared/types.ts'

export function stockUrl(store: string, productId: string): string {
  return `https://api-extern.systembolaget.se/sb-api-ecommerce/v1/stockbalance/store/${store}/${productId}`
}

/** Butiksnummer är fyra siffror. Kastar på allt annat, så inget användarvärde går rakt in i en URL. */
export function validStore(store: string): boolean {
  return /^\d{4}$/.test(store)
}

interface StockBody {
  shelf?: unknown
  stock?: unknown
  isInStoreAssortment?: unknown
}

export function parseStock(json: unknown): Omit<Stock, 'store'> {
  const body = json as StockBody
  if (typeof body?.stock !== 'number') throw new FatalError('systembolaget stock answered without stock', 502)
  return {
    stock: body.stock,
    shelf: typeof body.shelf === 'string' && body.shelf !== '' ? body.shelf : null,
    in_assortment: body.isInStoreAssortment === true,
  }
}

export async function fetchStock(store: string, productId: string, apiKey: string): Promise<Omit<Stock, 'store'>> {
  if (!validStore(store)) throw new FatalError('store must be four digits')
  let response: Response
  try {
    response = await fetch(stockUrl(store, productId), { headers: { 'ocp-apim-subscription-key': apiKey, accept: 'application/json' } })
  } catch (error) {
    throw new TransientError(`systembolaget stock unreachable: ${String(error)}`)
  }
  if (response.status === 404) throw new NotFoundError(`no stock for ${productId} in store ${store}`)
  if (response.status === 401 || response.status === 403) throw new FatalError('systembolaget stock key rejected', 502)
  if (response.status === 429 || response.status >= 500) throw new TransientError(`systembolaget stock answered ${response.status}`)
  if (!response.ok) throw new FatalError(`systembolaget stock answered ${response.status}`, 502)
  return parseStock(await response.json())
}
