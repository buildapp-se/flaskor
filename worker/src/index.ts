import { FatalError, NotFoundError, TransientError, UnauthorizedError } from '../../shared/errors.ts'
import type { Drink, DrinkPatch, Preview } from '../../shared/types.ts'
import { getDrink, insertDrink, listDrinks, sanitize, updateDrink } from './db.ts'
import { fetchProduct, parseProductNumber, toPreview } from './systembolaget.ts'

// Grindkoden (beslut 2): en delad kod, skickad som Bearer, jämförd mot secreten GATE_CODE. Sitter här, aldrig bara i klienten.
type GateEnv = Env & { GATE_CODE?: string }

/** Nattens tak (beslut 23): så många artikelnummer hämtas per körning. */
const NIGHTLY_CAP = 50

export default {
  async fetch(request: Request, env: GateEnv): Promise<Response> {
    const origin = request.headers.get('origin')
    const headers = corsHeaders(origin, env.FRONTEND_ORIGINS)
    try {
      if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers })
      if (origin && !allowedOrigins(env.FRONTEND_ORIGINS).includes(origin)) throw new FatalError('origin not allowed', 403)
      const body = await route(request, env)
      if (body === null) return new Response(null, { status: 204, headers })
      return Response.json(body, { headers })
    } catch (error) {
      const status = error instanceof FatalError ? error.status : error instanceof TransientError ? 503 : 500
      if (status === 500) console.error(error)
      const message = error instanceof Error ? error.message : 'unknown error'
      return Response.json({ error: message }, { status, headers })
    }
  },

  async scheduled(_controller: ScheduledController, env: GateEnv): Promise<void> {
    await refreshAll(env.DB)
  },
} satisfies ExportedHandler<GateEnv>

async function route(request: Request, env: GateEnv): Promise<unknown> {
  const url = new URL(request.url)
  const { method } = request
  const path = url.pathname.replace(/\/$/, '')

  if (method === 'GET' && path === '/health') return { ok: true }
  if (!path.startsWith('/api/')) throw new NotFoundError('no such route')

  authenticate(request, env)

  if (method === 'GET' && path === '/api/ping') return null
  if (method === 'GET' && path === '/api/drinks') return { drinks: await listDrinks(env.DB) }
  if (method === 'POST' && path === '/api/drinks') return insertDrink(env.DB, sanitize(await request.json()))

  const single = path.match(/^\/api\/drinks\/(\d+)$/)
  if (single?.[1] && method === 'PATCH') return updateDrink(env.DB, Number(single[1]), sanitize(await request.json()))

  const refresh = path.match(/^\/api\/drinks\/(\d+)\/refresh$/)
  if (refresh?.[1] && method === 'POST') return refreshDrink(env.DB, await getDrink(env.DB, Number(refresh[1])))

  if (method === 'GET' && path === '/api/systembolaget') {
    const number = parseProductNumber(url.searchParams.get('q') ?? '')
    return toPreview(await fetchProduct(number))
  }

  throw new NotFoundError('no such route')
}

function authenticate(request: Request, env: GateEnv): void {
  if (!env.GATE_CODE) throw new FatalError('GATE_CODE is not configured', 500)
  const header = request.headers.get('authorization') ?? ''
  const code = header.startsWith('Bearer ') ? header.slice(7) : ''
  if (code === '' || !timingSafeEqual(code, env.GATE_CODE)) throw new UnauthorizedError()
}

function timingSafeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder()
  const x = enc.encode(a)
  const y = enc.encode(b)
  if (x.byteLength !== y.byteLength) return false
  return crypto.subtle.timingSafeEqual(x, y)
}

function allowedOrigins(list: string): string[] {
  return list.split(',').map((s) => s.trim()).filter(Boolean)
}

function corsHeaders(origin: string | null, list: string): Record<string, string> {
  const allowed = origin && allowedOrigins(list).includes(origin) ? origin : ''
  return {
    'access-control-allow-origin': allowed,
    'access-control-allow-methods': 'GET, POST, PATCH, OPTIONS',
    'access-control-allow-headers': 'authorization, content-type',
    'access-control-max-age': '86400',
    vary: 'origin',
  }
}

/** Hämtar Systembolagets sida på nytt och uppdaterar pris, tillgänglighet och (för önskelistan) årgång (beslut 23). */
async function refreshDrink(db: D1Database, drink: Drink): Promise<Drink> {
  if (drink.source_kind !== 'systembolaget' || !drink.source_id) throw new FatalError('drink has no systembolaget source')
  const fresh = await fetchFresh(drink.source_id)
  return updateDrink(db, drink.id, refreshPatch(fresh, drink))
}

type Fresh = { gone: true } | { gone: false; preview: Preview }

async function fetchFresh(number: string): Promise<Fresh> {
  try {
    return { gone: false, preview: toPreview(await fetchProduct(number)) }
  } catch (error) {
    // Sidan borta betyder att varan utgått. Allt annat (nätfel, 5xx) kastar vidare och lämnar raden orörd.
    if (error instanceof NotFoundError) return { gone: true }
    throw error
  }
}

function refreshPatch(fresh: Fresh, drink: Drink): DrinkPatch {
  const price_checked_at = new Date().toISOString()
  if (fresh.gone) return { availability: 'discontinued', price_checked_at }
  const { preview } = fresh
  const patch: DrinkPatch = { price_current: preview.price_current, price_checked_at, availability: preview.availability }
  // Ägda flaskor behåller sin årgång: Systembolaget säljer den nya, källaren har den gamla.
  if (!drink.owned) patch.vintage = preview.vintage
  return patch
}

export async function refreshAll(db: D1Database): Promise<{ refreshed: number; failed: number }> {
  const drinks = await listDrinks(db)
  // En hämtning per artikelnummer, oavsett hur många rader som delar det (beslut 23).
  const byNumber = new Map<string, Drink[]>()
  for (const d of drinks) {
    if (d.source_kind !== 'systembolaget' || !d.source_id) continue
    byNumber.set(d.source_id, [...(byNumber.get(d.source_id) ?? []), d])
  }
  let refreshed = 0
  let failed = 0
  for (const [number, rows] of [...byNumber].slice(0, NIGHTLY_CAP)) {
    try {
      const fresh = await fetchFresh(number)
      for (const row of rows) await updateDrink(db, row.id, refreshPatch(fresh, row))
      refreshed++
    } catch (error) {
      failed++
      console.error(`refresh ${number} failed`, error)
    }
  }
  return { refreshed, failed }
}
