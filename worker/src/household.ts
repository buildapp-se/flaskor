import { FatalError, NotFoundError } from '../../shared/errors.ts'
import type { Account } from '../../shared/types.ts'
import type { Identity } from './auth.ts'

/** Hushållet grindkoden ger (migrering 0001), och det Patrik och Julia går med i med den gamla koden. */
export const LEGACY_HOUSEHOLD = 1

const newInviteCode = (): string => [...crypto.getRandomValues(new Uint8Array(5))].map((b) => b.toString(16).padStart(2, '0')).join('')

/**
 * Hushållet anroparen hör till. Ett konto utan medlemskap får ett eget, tomt hushåll vid första anropet:
 * ingen registreringsvy, första inloggningen räcker. Kostar två skrivna rader en gång per konto.
 */
export async function householdOf(db: D1Database, who: Identity): Promise<number> {
  if (who.kind === 'service') return LEGACY_HOUSEHOLD
  const found = await db.prepare('SELECT household_id FROM member WHERE uid = ?').bind(who.uid).first<number>('household_id')
  if (found !== null) return found
  const created = await db.prepare("INSERT INTO household (name, invite_code) VALUES ('Mitt hushåll', ?) RETURNING id").bind(newInviteCode()).first<number>('id')
  if (created === null) throw new FatalError('household insert returned no row', 500)
  // ponytail: två samtidiga första anrop kan ge ett föräldralöst tomt hushåll; ON CONFLICT håller medlemskapet unikt.
  await db.prepare('INSERT INTO member (uid, household_id, email) VALUES (?, ?, ?) ON CONFLICT (uid) DO NOTHING').bind(who.uid, created, who.email).run()
  const id = await db.prepare('SELECT household_id FROM member WHERE uid = ?').bind(who.uid).first<number>('household_id')
  if (id === null) throw new FatalError('member insert failed', 500)
  return id
}

export async function getAccount(db: D1Database, who: Identity, householdId: number): Promise<Account> {
  const household = await db.prepare('SELECT id, name, invite_code FROM household WHERE id = ?').bind(householdId).first<{ id: number; name: string; invite_code: string }>()
  if (!household) throw new NotFoundError(`household ${householdId} not found`)
  const { results } = await db.prepare('SELECT email FROM member WHERE household_id = ? ORDER BY created_at').bind(householdId).all<{ email: string }>()
  return { email: who.kind === 'user' ? who.email : null, household: { ...household, members: results.map((r) => r.email) } }
}

export async function renameHousehold(db: D1Database, householdId: number, body: unknown): Promise<void> {
  const name = typeof body === 'object' && body !== null ? (body as { name?: unknown }).name : undefined
  if (typeof name !== 'string' || name.trim() === '' || name.length > 60) throw new FatalError('name must be 1 to 60 characters')
  await db.prepare('UPDATE household SET name = ? WHERE id = ?').bind(name.trim(), householdId).run()
}

/**
 * Går med i ett annat hushåll med dess inbjudningskod, eller med den gamla grindkoden för hushåll 1.
 * Nekas när det nuvarande hushållet har rader: de skulle bli osynliga för alltid, och ingen ska tappa sin källare på ett felklick.
 */
export async function joinHousehold(db: D1Database, who: Identity & { kind: 'user' }, current: number, body: unknown, gateCode: string | undefined): Promise<void> {
  const code = typeof body === 'object' && body !== null ? (body as { code?: unknown }).code : undefined
  if (typeof code !== 'string' || code.trim() === '') throw new FatalError('code is required')
  const target = gateCode && code.trim() === gateCode ? LEGACY_HOUSEHOLD : await db.prepare('SELECT id FROM household WHERE invite_code = ?').bind(code.trim().toLowerCase()).first<number>('id')
  if (target === null) throw new NotFoundError('no household with that code')
  if (target === current) return
  const rows = await db.prepare('SELECT COUNT(*) AS n FROM drink WHERE household_id = ?').bind(current).first<number>('n')
  if (rows !== null && rows > 0) throw new FatalError('current household has drinks', 409)
  await db.prepare('UPDATE member SET household_id = ? WHERE uid = ?').bind(target, who.uid).run()
  await dropIfEmpty(db, current)
}

/** Raderar kontots medlemskap, och hushållet med alla rader och avsmakningar när ingen annan är kvar i det. */
export async function deleteAccount(db: D1Database, who: Identity & { kind: 'user' }, householdId: number): Promise<void> {
  await db.prepare('DELETE FROM member WHERE uid = ?').bind(who.uid).run()
  await dropIfEmpty(db, householdId)
}

async function dropIfEmpty(db: D1Database, householdId: number): Promise<void> {
  // Hushåll 1 rörs aldrig: grindkoden (nattskriptet) pekar på det även utan medlemmar.
  if (householdId === LEGACY_HOUSEHOLD) return
  const left = await db.prepare('SELECT COUNT(*) AS n FROM member WHERE household_id = ?').bind(householdId).first<number>('n')
  if (left !== 0) return
  await db.batch([
    db.prepare('DELETE FROM tasting WHERE drink_id IN (SELECT id FROM drink WHERE household_id = ?)').bind(householdId),
    db.prepare('DELETE FROM drink WHERE household_id = ?').bind(householdId),
    db.prepare('DELETE FROM household WHERE id = ?').bind(householdId),
  ])
}
