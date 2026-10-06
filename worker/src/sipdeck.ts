import { createRemoteJWKSet, jwtVerify } from 'jose'
import { FatalError, NotFoundError, UnauthorizedError } from '../../shared/errors.ts'
import { SIPDECK_CONTRACT, type SipdeckBottle, type SipdeckBottles, type SipdeckCode, type SipdeckLink } from '../../shared/types.ts'
import type { Identity } from './auth.ts'

/**
 * Valfri koppling till Sipdeck (ADR 0001, docs/adr/0001-sipdeck-hemma.md). Flaskor äger flaskorna, Sipdeck
 * recepten; här lämnas bara vilka flaskor som finns hemma, enkelriktat och utan pris, anteckning eller logg.
 *
 * Protokollet, minsta säkra:
 * 1. En inloggad hushållsmedlem skapar en engångskod (POST /api/sipdeck/code).
 * 2. Sipdeck-klienten löser in koden med sitt eget Sipdeck-ID-token (POST /api/sipdeck/link). Token verifieras
 *    här mot Sipdecks Firebase-projekt (issuer och audience), så ett Flaskor-token duger inte och tvärtom.
 * 3. Varje läsning (GET /api/sipdeck/bottles) slår upp hushållet på tokenets uid och kontrollerar att medlemmen
 *    som gav kopplingen fortfarande hör till hushållet. Klienten skickar aldrig något hushålls-id.
 * Samma e-postadress i båda apparna kopplar ingenting, och tjänstenyckeln används inte.
 */
export interface SipdeckEnv {
  SIPDECK_FIREBASE_PROJECT_ID?: string
}
export type SipdeckIdentity = { uid: string; email: string | null }

/** Felen Sipdeck-klienten agerar på: `revoked` och `not_linked` tar bort dess cache, allt annat behåller den. */
export class LinkError extends FatalError {
  override name = 'LinkError'
  readonly code: 'revoked' | 'not_linked' | 'bad_code'
  constructor(code: LinkError['code'], status: number) {
    super(code, status)
    this.code = code
  }
}

const CODE_TTL_MS = 10 * 60_000
const JWKS = createRemoteJWKSet(new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'))

/**
 * Ett Sipdeck-konto ur sitt eget ID-token. Bekräftad e-post krävs inte: adressen ger ingen behörighet här,
 * den visas bara för hushållet. Behörigheten kommer ur koden som en medlem skapat.
 */
export async function authenticateSipdeck(request: Request, env: SipdeckEnv): Promise<SipdeckIdentity> {
  const header = request.headers.get('authorization') ?? ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : ''
  if (token === '' || !env.SIPDECK_FIREBASE_PROJECT_ID) throw new UnauthorizedError()
  try {
    const { payload } = await jwtVerify(token, JWKS, {
      issuer: `https://securetoken.google.com/${env.SIPDECK_FIREBASE_PROJECT_ID}`,
      audience: env.SIPDECK_FIREBASE_PROJECT_ID,
      algorithms: ['RS256'],
    })
    if (!payload.sub) throw new Error('no subject')
    return { uid: payload.sub, email: typeof payload.email === 'string' ? payload.email.trim().toLowerCase().slice(0, 200) : null }
  } catch {
    throw new UnauthorizedError('invalid token')
  }
}

async function sha256(text: string): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/** En ny engångskod för hushållet. Medlemmens äldre koder och alla utgångna städas i samma anrop. */
export async function createCode(db: D1Database, who: Identity & { kind: 'user' }, householdId: number, now = Date.now()): Promise<SipdeckCode> {
  const code = [...crypto.getRandomValues(new Uint8Array(16))].map((b) => b.toString(16).padStart(2, '0')).join('')
  const expires_at = now + CODE_TTL_MS
  await db.batch([
    db.prepare('DELETE FROM sipdeck_code WHERE uid = ? OR expires_at <= ?').bind(who.uid, now),
    db.prepare('INSERT INTO sipdeck_code (code_hash, household_id, uid, expires_at) VALUES (?, ?, ?, ?)').bind(await sha256(code), householdId, who.uid, expires_at),
  ])
  return { code, expires_at: new Date(expires_at).toISOString() }
}

/** Hushållet medlemmen hör till just nu, eller null. Kopplingens giltighet hänger på det här svaret. */
async function grantedHousehold(db: D1Database, uid: string, householdId: number): Promise<string | null> {
  return db
    .prepare('SELECT h.name FROM member m JOIN household h ON h.id = m.household_id WHERE m.uid = ? AND m.household_id = ?')
    .bind(uid, householdId)
    .first<string>('name')
}

/**
 * Löser in en kod: den raderas i samma fråga som läser den, så en kod kan aldrig användas två gånger. Ett
 * Sipdeck-konto har högst en koppling, så en ny kod byter hushåll i stället för att lägga till ett.
 */
export async function redeemCode(db: D1Database, sipdeck: SipdeckIdentity, body: unknown, now = Date.now()): Promise<{ household: string }> {
  const code = typeof body === 'object' && body !== null ? (body as { code?: unknown }).code : undefined
  if (typeof code !== 'string' || !/^[0-9a-f]{32}$/.test(code)) throw new LinkError('bad_code', 404)
  const grant = await db
    .prepare('DELETE FROM sipdeck_code WHERE code_hash = ? AND expires_at > ? RETURNING household_id, uid')
    .bind(await sha256(code), now)
    .first<{ household_id: number; uid: string }>()
  if (!grant) throw new LinkError('bad_code', 404)
  const household = await grantedHousehold(db, grant.uid, grant.household_id)
  if (household === null) throw new LinkError('bad_code', 404)
  await db
    .prepare(
      `INSERT INTO sipdeck_link (sipdeck_uid, household_id, uid, email) VALUES (?, ?, ?, ?)
       ON CONFLICT (sipdeck_uid) DO UPDATE SET household_id = excluded.household_id, uid = excluded.uid, email = excluded.email, created_at = datetime('now')`,
    )
    .bind(sipdeck.uid, grant.household_id, grant.uid, sipdeck.email)
    .run()
  return { household }
}

/**
 * Flaskorna som finns hemma för det kopplade Sipdeck-kontot. Tillgängligt är ägt med minst en oöppnad eller en
 * öppnad med något kvar; önskelistan och slut räknas inte. Vin, bubbel och öl följer med, inte bara sprit:
 * vad som är en drinkingrediens avgör Sipdeck. Inga priser, avsmakningar eller anteckningar lämnar Flaskor.
 */
export async function linkedBottles(db: D1Database, sipdeck: SipdeckIdentity): Promise<SipdeckBottles> {
  const link = await db.prepare('SELECT household_id, uid FROM sipdeck_link WHERE sipdeck_uid = ?').bind(sipdeck.uid).first<{ household_id: number; uid: string }>()
  if (!link) throw new LinkError('not_linked', 404)
  const household = await grantedHousehold(db, link.uid, link.household_id)
  if (household === null) {
    // Medlemmen som gav kopplingen har lämnat hushållet eller raderat sitt konto: kopplingen är återkallad.
    await db.prepare('DELETE FROM sipdeck_link WHERE sipdeck_uid = ?').bind(sipdeck.uid).run()
    throw new LinkError('revoked', 403)
  }
  const { results } = await db
    .prepare(
      `SELECT id, kind, name, producer, category, style, country, region, source_kind, source_id FROM drink
       WHERE household_id = ? AND owned = 1 AND (count > 0 OR open_level IS NOT NULL) ORDER BY id`,
    )
    .bind(link.household_id)
    .all<Omit<SipdeckBottle, 'ref'> & { source_kind: string; source_id: string | null }>()
  const bottles = results.map(({ source_kind, source_id, ...b }) => ({ ...b, ref: source_kind === 'systembolaget' && source_id ? `sb:${source_id}` : null }))
  return { contract: SIPDECK_CONTRACT, household, bottles }
}

/** Sipdeck-kontot kopplar från sig självt. Kastar not_linked när det inte fanns något att ta bort. */
export async function unlinkSelf(db: D1Database, sipdeck: SipdeckIdentity): Promise<void> {
  const result = await db.prepare('DELETE FROM sipdeck_link WHERE sipdeck_uid = ?').bind(sipdeck.uid).run()
  if (result.meta.changes === 0) throw new LinkError('not_linked', 404)
}

/** Hushållets kopplade Sipdeck-konton, för Konto-vyn. Bara kopplingar vars givare är kvar i hushållet. */
export async function listLinks(db: D1Database, householdId: number): Promise<SipdeckLink[]> {
  const { results } = await db
    .prepare(
      `SELECT l.id, l.email, l.created_at FROM sipdeck_link l JOIN member m ON m.uid = l.uid AND m.household_id = l.household_id
       WHERE l.household_id = ? ORDER BY l.id`,
    )
    .bind(householdId)
    .all<SipdeckLink>()
  return results
}

/** En medlem återkallar en av hushållets kopplingar. */
export async function revokeLink(db: D1Database, householdId: number, id: number): Promise<void> {
  const result = await db.prepare('DELETE FROM sipdeck_link WHERE id = ? AND household_id = ?').bind(id, householdId).run()
  if (result.meta.changes === 0) throw new NotFoundError(`link ${id} not found`)
}

/** Kopplingar och koder som en medlem gett försvinner med medlemskapet: hushållsbyte, utträde, raderat konto. */
export function dropGrants(db: D1Database, uid: string): D1PreparedStatement[] {
  return [db.prepare('DELETE FROM sipdeck_link WHERE uid = ?').bind(uid), db.prepare('DELETE FROM sipdeck_code WHERE uid = ?').bind(uid)]
}
