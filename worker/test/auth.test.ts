import { SELF, env } from 'cloudflare:test'
import { importJWK, SignJWT } from 'jose'
import { describe, expect, it } from 'vitest'

// Inloggningen (beslut 2, 2026-09-15): riktiga RS256-token signerade med testnyckeln, verifierade av Workern mot
// "Googles" nyckeladress som testmiljön besvarar med den publika halvan. Se worker/vitest.config.ts.

const GATE = { authorization: 'Bearer test-kod' }
let seq = 0

async function token(claims: Record<string, unknown> = {}, options: { audience?: string; expiresIn?: string } = {}): Promise<string> {
  const key = await importJWK(env.FIREBASE_TEST_KEY, 'RS256')
  seq += 1
  return new SignJWT({ email: `user${seq}@example.se`, email_verified: true, ...claims })
    .setProtectedHeader({ alg: 'RS256', kid: 'test' })
    .setSubject(`uid-${seq}-${crypto.randomUUID()}`)
    .setIssuer('https://securetoken.google.com/flaskor-d3762')
    .setAudience(options.audience ?? 'flaskor-d3762')
    .setIssuedAt()
    .setExpirationTime(options.expiresIn ?? '1h')
    .sign(key)
}

async function asUser(claims: Record<string, unknown> = {}) {
  const auth = { authorization: `Bearer ${await token(claims)}` }
  return (method: string, path: string, body?: unknown) =>
    SELF.fetch(`https://flaskor-api.test${path}`, { method, headers: { 'content-type': 'application/json', ...auth }, body: body === undefined ? undefined : JSON.stringify(body) })
}

const gate = (method: string, path: string, body?: unknown) =>
  SELF.fetch(`https://flaskor-api.test${path}`, { method, headers: { 'content-type': 'application/json', ...GATE }, body: body === undefined ? undefined : JSON.stringify(body) })

type Me = { email: string | null; household: { id: number; name: string; invite_code: string; members: string[] } }

describe('Firebase-token', () => {
  it('ett nytt konto får ett eget tomt hushåll med inbjudningskod', async () => {
    const a = await asUser()
    const me = await (await a('GET', '/api/me')).json<Me>()
    expect(me.email).toMatch(/@example\.se$/)
    expect(me.household.id).not.toBe(1)
    expect(me.household.invite_code).toMatch(/^[0-9a-f]{10}$/)
    expect(me.household.members).toEqual([me.email])
    expect((await (await a('GET', '/api/drinks')).json<{ drinks: unknown[] }>()).drinks).toEqual([])
    // Andra anropet skapar inget nytt hushåll.
    expect((await (await a('GET', '/api/me')).json<Me>()).household.id).toBe(me.household.id)
  })

  it('obekräftad adress 403, fel projekt och utgången token 401', async () => {
    const unverified = await asUser({ email_verified: false })
    expect((await unverified('GET', '/api/ping')).status).toBe(403)
    const wrong = await token({}, { audience: 'annat-projekt' })
    expect((await SELF.fetch('https://flaskor-api.test/api/ping', { headers: { authorization: `Bearer ${wrong}` } })).status).toBe(401)
    const expired = await token({}, { expiresIn: '-1m' })
    expect((await SELF.fetch('https://flaskor-api.test/api/ping', { headers: { authorization: `Bearer ${expired}` } })).status).toBe(401)
  })

  it('hushållen ser inte varandras rader och kan inte ändra dem', async () => {
    const a = await asUser()
    const b = await asUser()
    const drink = await (await a('POST', '/api/drinks', { kind: 'wine', name: 'A:s Barolo', owned: true, count: 1 })).json<{ id: number }>()
    expect((await (await b('GET', '/api/drinks')).json<{ drinks: unknown[] }>()).drinks).toEqual([])
    expect((await b('PATCH', `/api/drinks/${drink.id}`, { count: 9 })).status).toBe(404)
    expect((await b('DELETE', `/api/drinks/${drink.id}`)).status).toBe(404)
    expect((await b('GET', `/api/drinks/${drink.id}/tastings`)).status).toBe(404)
    // Grindkoden är hushåll 1 och ser inte heller A:s rad.
    const legacy = await (await gate('GET', '/api/drinks')).json<{ drinks: Array<{ id: number }> }>()
    expect(legacy.drinks.some((d) => d.id === drink.id)).toBe(false)
  })

  it('nattjobbet och spegelimporten nekas ett konto', async () => {
    const a = await asUser()
    expect((await a('POST', '/api/refresh-all')).status).toBe(403)
    expect((await a('POST', '/api/assortment', { run: 'x', rows: [] })).status).toBe(403)
    expect((await gate('POST', '/api/refresh-all')).status).toBe(200)
  })
})

describe('utan konto (gästläget)', () => {
  const anon = (path: string, ip = '203.0.113.1') => SELF.fetch(`https://flaskor-api.test${path}`, { headers: { 'cf-connecting-ip': ip } })

  it('uppslag fungerar, men inget som rör ett hushåll', async () => {
    const preview = await anon('/api/systembolaget?q=7562401')
    expect(preview.status, await preview.clone().text()).toBe(200)
    expect((await preview.json<{ name: string }>()).name).toContain('Ibry')
    expect((await anon('/api/drinks')).status).toBe(401)
    expect((await anon('/api/me')).status).toBe(401)
    expect((await anon('/api/stock?drink=1&store=2401')).status).toBe(401)
    expect((await SELF.fetch('https://flaskor-api.test/api/scan', { method: 'POST', body: '{}' })).status).toBe(401)
    // En trasig token går den vanliga vägen och får 401, även på ett uppslag.
    expect((await SELF.fetch('https://flaskor-api.test/api/systembolaget?q=7562401', { headers: { authorization: 'Bearer trasig' } })).status).toBe(401)
  })

  it('taket räknas per IP-adress', async () => {
    const statuses: number[] = []
    for (let i = 0; i < 62; i++) statuses.push((await anon('/api/search?q=', '198.51.100.7')).status)
    expect(statuses[0]).toBe(400)
    expect(statuses.at(-1)).toBe(429)
    expect((await anon('/api/search?q=', '198.51.100.8')).status).toBe(400)
  })
})

describe('import och export', () => {
  it('en gästs rader och avsmakningar kommer in, och exporten bär båda', async () => {
    const a = await asUser()
    const res = await a('POST', '/api/drinks/import', {
      drinks: [
        { id: 7, household_id: 0, kind: 'wine', name: 'Lokal Barolo', owned: true, count: 2, created_at: 'x', tastings: [{ drunk_on: '2026-09-01', rating: 5, note: 'gott' }] },
        { kind: 'spirit', name: 'Lokal rom', owned: true, count: 1, open_level: 3 },
      ],
    })
    expect(res.status, await res.clone().text()).toBe(200)
    expect(await res.json()).toEqual({ imported: 2 })
    const data = await (await a('GET', '/api/export')).json<{ app: string; household: string; drinks: Array<{ id: number; name: string; last_rating: number | null }>; tastings: Array<{ drink_id: number; note: string }> }>()
    expect(data.app).toBe('flaskor')
    expect(data.household).toBe('Mitt hushåll')
    expect(data.drinks.map((d) => d.name)).toEqual(['Lokal Barolo', 'Lokal rom'])
    expect(data.drinks[0]!.last_rating).toBe(5)
    expect(data.tastings).toHaveLength(1)
    expect(data.tastings[0]!.drink_id).toBe(data.drinks[0]!.id)
  })

  it('en trasig rad skriver ingenting, och för stora bitar nekas', async () => {
    const a = await asUser()
    expect((await a('POST', '/api/drinks/import', { drinks: [{ kind: 'wine', name: 'Bra' }, { kind: 'wine', name: 'Dålig', tastings: [{ drunk_on: 'igår' }] }] })).status).toBe(400)
    expect((await (await a('GET', '/api/drinks')).json<{ drinks: unknown[] }>()).drinks).toEqual([])
    const tooMany = Array.from({ length: 41 }, (_, i) => ({ kind: 'wine', name: `Vin ${i}` }))
    expect((await a('POST', '/api/drinks/import', { drinks: tooMany })).status).toBe(400)
  })
})

describe('hushåll', () => {
  it('går med via inbjudningskod och delar raderna', async () => {
    const a = await asUser()
    const b = await asUser()
    await a('POST', '/api/drinks', { kind: 'wine', name: 'Delad', owned: true, count: 2 })
    const code = (await (await a('GET', '/api/me')).json<Me>()).household.invite_code
    const bOld = (await (await b('GET', '/api/me')).json<Me>()).household.id
    expect((await b('POST', '/api/household/join', { code: code.toUpperCase() })).status).toBe(204)
    const drinks = await (await b('GET', '/api/drinks')).json<{ drinks: Array<{ name: string }> }>()
    expect(drinks.drinks.map((d) => d.name)).toEqual(['Delad'])
    expect((await (await a('GET', '/api/me')).json<Me>()).household.members).toHaveLength(2)
    // B:s tomma hushåll städades bort.
    expect(await env.DB.prepare('SELECT id FROM household WHERE id = ?').bind(bOld).first()).toBeNull()
  })

  it('nekar byte när det egna hushållet har rader, och okänd kod är 404', async () => {
    const a = await asUser()
    const b = await asUser()
    await b('POST', '/api/drinks', { kind: 'beer', name: 'B:s öl', owned: true, count: 1 })
    const code = (await (await a('GET', '/api/me')).json<Me>()).household.invite_code
    expect((await b('POST', '/api/household/join', { code })).status).toBe(409)
    expect((await a('POST', '/api/household/join', { code: '0000000000' })).status).toBe(404)
  })

  it('grindkoden ger inte längre hushåll 1 (borttaget 2026-09-16)', async () => {
    const a = await asUser()
    expect((await a('POST', '/api/household/join', { code: 'test-kod' })).status).toBe(404)
    const me = await (await a('GET', '/api/me')).json<Me>()
    expect(me.household.id).not.toBe(1)
  })

  it('byter namn på hushållet', async () => {
    const a = await asUser()
    expect((await a('PATCH', '/api/household', { name: '  Vinkällaren  ' })).status).toBe(204)
    expect((await (await a('GET', '/api/me')).json<Me>()).household.name).toBe('Vinkällaren')
    expect((await a('PATCH', '/api/household', { name: '' })).status).toBe(400)
  })

  it('radera konto: ensam medlem tar hushållet med rader och loggar, annars bara medlemskapet', async () => {
    const a = await asUser()
    const drink = await (await a('POST', '/api/drinks', { kind: 'wine', name: 'Borta', owned: true, count: 1 })).json<{ id: number; household_id: number }>()
    await a('POST', `/api/drinks/${drink.id}/tastings`, { drunk_on: '2026-09-01', rating: 4 })
    expect((await a('DELETE', '/api/me')).status).toBe(204)
    expect(await env.DB.prepare('SELECT id FROM household WHERE id = ?').bind(drink.household_id).first()).toBeNull()
    expect(await env.DB.prepare('SELECT id FROM drink WHERE id = ?').bind(drink.id).first()).toBeNull()
    expect(await env.DB.prepare('SELECT id FROM tasting WHERE drink_id = ?').bind(drink.id).first()).toBeNull()

    const b = await asUser()
    const c = await asUser()
    const code = (await (await b('GET', '/api/me')).json<Me>()).household.invite_code
    await c('POST', '/api/household/join', { code })
    const kept = await (await b('POST', '/api/drinks', { kind: 'wine', name: 'Kvar', owned: true, count: 1 })).json<{ id: number }>()
    expect((await c('DELETE', '/api/me')).status).toBe(204)
    expect(await env.DB.prepare('SELECT id FROM drink WHERE id = ?').bind(kept.id).first()).not.toBeNull()
    expect((await gate('DELETE', '/api/me')).status).toBe(403)
  })

  it('inbjudningskoden går inte att gissa i en loop (tio per minut)', async () => {
    const a = await asUser()
    const statuses: number[] = []
    for (let i = 0; i < 12; i++) statuses.push((await a('POST', '/api/household/join', { code: `fel${i}` })).status)
    expect(statuses.slice(0, 10).every((s) => s === 404)).toBe(true)
    expect(statuses.at(-1)).toBe(429)
  })
})
