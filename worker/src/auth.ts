import { createRemoteJWKSet, jwtVerify } from 'jose'
import { FatalError, UnauthorizedError } from '../../shared/errors.ts'

/**
 * Vem som anropar (beslut 2, 2026-09-15). Två vägar in:
 * - grindkoden som Bearer: tjänsteåtkomst till hushåll 1, för nattskriptet i Actions och skripten i `scripts/`.
 * - en Firebase ID-token: en inloggad användare, vars hushåll slås upp i `member` (worker/src/household.ts).
 */
export type Identity = { kind: 'service' } | { kind: 'user'; uid: string; email: string }

export interface AuthEnv {
  SERVICE_TOKEN?: string
  FIREBASE_PROJECT_ID?: string
}

// Googles nycklar för Firebase ID-token. jose cachar dem och hämtar om vid okänd kid.
const FIREBASE_JWKS = createRemoteJWKSet(new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'))

export async function authenticate(request: Request, env: AuthEnv): Promise<Identity> {
  const header = request.headers.get('authorization') ?? ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : ''
  if (token === '') throw new UnauthorizedError()
  if (env.SERVICE_TOKEN && timingSafeEqual(token, env.SERVICE_TOKEN)) return { kind: 'service' }
  if (!env.FIREBASE_PROJECT_ID) throw new UnauthorizedError()

  let payload
  try {
    ;({ payload } = await jwtVerify(token, FIREBASE_JWKS, {
      issuer: `https://securetoken.google.com/${env.FIREBASE_PROJECT_ID}`,
      audience: env.FIREBASE_PROJECT_ID,
      algorithms: ['RS256'],
    }))
  } catch {
    throw new UnauthorizedError('invalid token')
  }
  const email = typeof payload.email === 'string' ? payload.email.trim().toLowerCase() : ''
  if (!payload.sub || email === '') throw new FatalError('account has no email', 403)
  // Obekräftade adresser släpps inte in: annars kan vem som helst registrera en adress hen inte äger.
  if (payload.email_verified !== true) throw new FatalError('email not verified', 403)
  return { kind: 'user', uid: payload.sub, email }
}

function timingSafeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder()
  const x = enc.encode(a)
  const y = enc.encode(b)
  if (x.byteLength !== y.byteLength) return false
  return crypto.subtle.timingSafeEqual(x, y)
}
