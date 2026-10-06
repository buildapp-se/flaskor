import { SELF, env } from 'cloudflare:test'
import { importJWK, SignJWT } from 'jose'
import { describe, expect, it } from 'vitest'
import { redeemCode } from '../src/sipdeck.ts'

// Valfri koppling till Sipdeck (ADR 0001): riktiga RS256-token för båda Firebase-projekten, signerade med
// testnyckeln. Skillnaden mellan ett Flaskor-konto och ett Sipdeck-konto är bara issuer och audience, precis
// som i drift, så testerna visar att Workern håller isär dem.

let seq = 0
async function token(project: string, claims: Record<string, unknown> = {}): Promise<string> {
  const key = await importJWK(env.FIREBASE_TEST_KEY, 'RS256')
  seq += 1
  return new SignJWT({ email: `person${seq}@example.se`, email_verified: true, ...claims })
    .setProtectedHeader({ alg: 'RS256', kid: 'test' })
    .setSubject(`${project}-${seq}-${crypto.randomUUID()}`)
    .setIssuer(`https://securetoken.google.com/${project}`)
    .setAudience(project)
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(key)
}

type Call = (method: string, path: string, body?: unknown) => Promise<Response>
async function as(project: string, claims: Record<string, unknown> = {}): Promise<Call> {
  const auth = { authorization: `Bearer ${await token(project, claims)}` }
  return (method, path, body) =>
    SELF.fetch(`https://flaskor-api.test${path}`, { method, headers: { 'content-type': 'application/json', ...auth }, body: body === undefined ? undefined : JSON.stringify(body) })
}
const member = (claims?: Record<string, unknown>) => as('flaskor-d3762', claims)
const sipdeck = (claims?: Record<string, unknown>) => as('sipdeck', claims)

type Bottles = { contract: number; household: string; bottles: Array<Record<string, unknown> & { id: number; name: string; ref: string | null }> }
const code = async (m: Call) => (await (await m('POST', '/api/sipdeck/code')).json<{ code: string; expires_at: string }>()).code
const link = async (m: Call, s: Call) => s('POST', '/api/sipdeck/link', { code: await code(m) })
const names = async (s: Call) => (await (await s('GET', '/api/sipdeck/bottles')).json<Bottles>()).bottles.map((b) => b.name)
const fail = async (res: Response) => ({ status: res.status, code: (await res.json<{ code?: string }>()).code })

describe('kontokoppling', () => {
  it('kopplas bara med en kod från en inloggad medlem, aldrig av samma e-postadress', async () => {
    const m = await member({ email: 'samma@example.se' })
    const s = await sipdeck({ email: 'samma@example.se' })
    await m('POST', '/api/drinks', { kind: 'spirit', name: 'Gin', owned: true, count: 1 })
    expect(await fail(await s('GET', '/api/sipdeck/bottles'))).toEqual({ status: 404, code: 'not_linked' })
    const res = await link(m, s)
    expect(res.status, await res.clone().text()).toBe(200)
    expect(await res.json()).toEqual({ household: 'Mitt hushåll' })
    expect(await names(s)).toEqual(['Gin'])
  })

  it('fel projekt-token nekas åt båda håll, och tjänstenyckeln är ingen användarkoppling', async () => {
    const m = await member()
    const s = await sipdeck()
    const c = await code(m)
    // Ett Flaskor-token är inte ett Sipdeck-konto, även om det är giltigt och hör till hushållet.
    expect((await m('POST', '/api/sipdeck/link', { code: c })).status).toBe(401)
    expect((await m('GET', '/api/sipdeck/bottles')).status).toBe(401)
    // Ett Sipdeck-token öppnar ingenting annat i Flaskor.
    for (const path of ['/api/drinks', '/api/me', '/api/export', '/api/sipdeck/links']) expect((await s('GET', path)).status).toBe(401)
    expect((await s('POST', '/api/sipdeck/code')).status).toBe(401)
    const gate = { authorization: 'Bearer test-kod' }
    expect((await SELF.fetch('https://flaskor-api.test/api/sipdeck/bottles', { headers: gate })).status).toBe(401)
    expect((await SELF.fetch('https://flaskor-api.test/api/sipdeck/code', { method: 'POST', headers: gate })).status).toBe(403)
    expect((await SELF.fetch('https://flaskor-api.test/api/sipdeck/bottles')).status).toBe(401)
    // Koden är oförbrukad efter de nekade försöken och fungerar för rätt konto.
    expect((await s('POST', '/api/sipdeck/link', { code: c })).status).toBe(200)
  })

  it('en kod gäller en gång och tio minuter, och sparas bara som hash', async () => {
    const m = await member()
    const first = await sipdeck()
    const second = await sipdeck()
    const c = await code(m)
    expect(c).toMatch(/^[0-9a-f]{32}$/)
    expect(await env.DB.prepare('SELECT COUNT(*) AS n FROM sipdeck_code WHERE code_hash = ?').bind(c).first<number>('n')).toBe(0)
    expect((await first('POST', '/api/sipdeck/link', { code: c })).status).toBe(200)
    expect(await fail(await second('POST', '/api/sipdeck/link', { code: c }))).toEqual({ status: 404, code: 'bad_code' })
    expect(await fail(await second('POST', '/api/sipdeck/link', { code: 'inte-en-kod' }))).toEqual({ status: 404, code: 'bad_code' })
    expect(await fail(await second('POST', '/api/sipdeck/link', {}))).toEqual({ status: 404, code: 'bad_code' })
    // Utgången: samma funktion med klockan elva minuter fram.
    const late = await code(m)
    await expect(redeemCode(env.DB, { uid: 'sent', email: null }, { code: late }, Date.now() + 11 * 60_000)).rejects.toMatchObject({ code: 'bad_code' })
    // En ny kod ersätter medlemmens förra: bara den senaste gäller.
    const old = await code(m)
    const fresh = await code(m)
    expect((await second('POST', '/api/sipdeck/link', { code: old })).status).toBe(404)
    expect((await second('POST', '/api/sipdeck/link', { code: fresh })).status).toBe(200)
  })

  it('koden går inte att gissa i en loop (tio per minut)', async () => {
    const s = await sipdeck()
    const statuses: number[] = []
    for (let i = 0; i < 12; i++) statuses.push((await s('POST', '/api/sipdeck/link', { code: `${i}`.padStart(32, '0') })).status)
    expect(statuses.slice(0, 10).every((x) => x === 404)).toBe(true)
    expect(statuses.at(-1)).toBe(429)
  })
})

describe('tillgängliga flaskor', () => {
  it('ägt med antal eller öppnad nivå räknas; önskelista och slut gör det inte; vin och bubbel följer med', async () => {
    const m = await member()
    const s = await sipdeck()
    const add = (drink: Record<string, unknown>) => m('POST', '/api/drinks', drink)
    await add({ kind: 'spirit', name: 'Gin oöppnad', owned: true, count: 1, category: 'Gin & Genever', style: 'Gin', source_kind: 'systembolaget', source_id: '100', price_paid: 399, note: 'hemlig anteckning' })
    await add({ kind: 'spirit', name: 'Rom öppnad', owned: true, count: 0, open_level: 1 })
    await add({ kind: 'spirit', name: 'Vodka slut', owned: true, count: 0 })
    await add({ kind: 'spirit', name: 'Whisky önskad', owned: false, count: 0 })
    await add({ kind: 'spirit', name: 'Likör önskad med antal', owned: false, count: 2 })
    await add({ kind: 'wine', name: 'Vermouth', owned: true, count: 1, category: 'Vermouth', style: 'Vermouth röd söt', country: 'Italien', vivino_rating: 4.1, vivino_url: 'https://www.vivino.com/w/1' })
    await add({ kind: 'wine', name: 'Champagne', owned: true, count: 2, category: 'Mousserande vin', country: 'Frankrike', region: 'Champagne', source_kind: 'caviste', source_id: '143' })
    await add({ kind: 'beer', name: 'Öl', owned: true, count: 6 })
    await link(m, s)
    const data = await (await s('GET', '/api/sipdeck/bottles')).json<Bottles>()
    expect(data.contract).toBe(1)
    expect(data.household).toBe('Mitt hushåll')
    expect(data.bottles.map((b) => b.name)).toEqual(['Gin oöppnad', 'Rom öppnad', 'Vermouth', 'Champagne', 'Öl'])
    // Exakt kontraktets fält: inget pris, ingen anteckning, inget betyg, inget antal.
    for (const b of data.bottles) expect(Object.keys(b).sort()).toEqual(['category', 'country', 'id', 'kind', 'name', 'producer', 'ref', 'region', 'style'])
    expect(data.bottles[0]).toMatchObject({ kind: 'spirit', category: 'Gin & Genever', style: 'Gin', ref: 'sb:100' })
    // Systembolagets nummer är en produktreferens; ett CAV-nummer eller en egen rad ger ingen.
    expect(data.bottles[3]).toMatchObject({ kind: 'wine', region: 'Champagne', ref: null })
    expect(JSON.stringify(data)).not.toMatch(/hemlig|399|vivino/)
  })

  it('två flaskor av samma sort ger sorten tills den sista är slut', async () => {
    const m = await member()
    const s = await sipdeck()
    const one = await (await m('POST', '/api/drinks', { kind: 'spirit', name: 'Gin A', owned: true, count: 1 })).json<{ id: number }>()
    const two = await (await m('POST', '/api/drinks', { kind: 'spirit', name: 'Gin B', owned: true, count: 0, open_level: 2 })).json<{ id: number }>()
    await link(m, s)
    expect(await names(s)).toEqual(['Gin A', 'Gin B'])
    await m('PATCH', `/api/drinks/${one.id}`, { count: 0 })
    expect(await names(s)).toEqual(['Gin B'])
    await m('PATCH', `/api/drinks/${two.id}`, { open_level: null })
    expect(await names(s)).toEqual([])
    // Tillbaka på önskelistan är inte hemma, köpt igen är det.
    await m('PATCH', `/api/drinks/${one.id}`, { owned: false, count: 3 })
    expect(await names(s)).toEqual([])
    await m('PATCH', `/api/drinks/${one.id}`, { owned: true })
    expect(await names(s)).toEqual(['Gin A'])
    await m('DELETE', `/api/drinks/${one.id}`)
    expect(await names(s)).toEqual([])
  })

  it('två hushåll läcker inte till varandra, och ett Sipdeck-konto har högst ett hushåll', async () => {
    const a = await member()
    const b = await member()
    const sa = await sipdeck()
    const sb = await sipdeck()
    await a('POST', '/api/drinks', { kind: 'spirit', name: 'A:s gin', owned: true, count: 1 })
    await b('POST', '/api/drinks', { kind: 'spirit', name: 'B:s rom', owned: true, count: 1 })
    await link(a, sa)
    await link(b, sb)
    expect(await names(sa)).toEqual(['A:s gin'])
    expect(await names(sb)).toEqual(['B:s rom'])
    // Ett påhittat hushålls-id i anropet ändrar ingenting: hushållet slås upp på tokenets uid.
    const bId = (await (await b('GET', '/api/me')).json<{ household: { id: number } }>()).household.id
    expect((await (await sa('GET', `/api/sipdeck/bottles?household=${bId}&household_id=${bId}`)).json<Bottles>()).bottles.map((x) => x.name)).toEqual(['A:s gin'])
    // Samma Sipdeck-konto kopplas om till B: A:s flaskor försvinner, det blir inte två hushåll.
    expect((await link(b, sa)).status).toBe(200)
    expect(await names(sa)).toEqual(['B:s rom'])
    expect(await env.DB.prepare("SELECT COUNT(*) AS n FROM sipdeck_link WHERE email IS NOT NULL AND sipdeck_uid LIKE 'sipdeck-%'").first<number>('n')).toBeGreaterThan(0)
    // B:s hushåll ser båda kopplingarna, A:s ser ingen och kan inte återkalla B:s.
    const links = (await (await b('GET', '/api/sipdeck/links')).json<{ links: Array<{ id: number; email: string }> }>()).links
    expect(links).toHaveLength(2)
    expect((await (await a('GET', '/api/sipdeck/links')).json<{ links: unknown[] }>()).links).toEqual([])
    expect((await a('DELETE', `/api/sipdeck/links/${links[0]!.id}`)).status).toBe(404)
    expect(await names(sb)).toEqual(['B:s rom'])
  })

  it('flera medlemmar kopplar var sitt Sipdeck-konto till samma hushåll', async () => {
    const a = await member()
    const b = await member()
    const sa = await sipdeck()
    const sb = await sipdeck()
    await a('POST', '/api/drinks', { kind: 'spirit', name: 'Delad gin', owned: true, count: 1 })
    const invite = (await (await a('GET', '/api/me')).json<{ household: { invite_code: string } }>()).household.invite_code
    await b('POST', '/api/household/join', { code: invite })
    await link(a, sa)
    await link(b, sb)
    expect(await names(sa)).toEqual(['Delad gin'])
    expect(await names(sb)).toEqual(['Delad gin'])
  })
})

describe('frånkoppling och återkallad behörighet', () => {
  it('Sipdeck-kontot kopplar från sig självt, och bara sig självt', async () => {
    const m = await member()
    const s = await sipdeck()
    const other = await sipdeck()
    await m('POST', '/api/drinks', { kind: 'spirit', name: 'Gin', owned: true, count: 1 })
    await link(m, s)
    await link(m, other)
    expect((await s('DELETE', '/api/sipdeck/link')).status).toBe(204)
    expect(await fail(await s('GET', '/api/sipdeck/bottles'))).toEqual({ status: 404, code: 'not_linked' })
    expect(await fail(await s('DELETE', '/api/sipdeck/link'))).toEqual({ status: 404, code: 'not_linked' })
    expect(await names(other)).toEqual(['Gin'])
    // Flaskorna i Flaskor är orörda: kopplingen läser bara.
    expect((await (await m('GET', '/api/drinks')).json<{ drinks: unknown[] }>()).drinks).toHaveLength(1)
  })

  it('en medlem återkallar en koppling under Konto', async () => {
    const m = await member()
    const s = await sipdeck({ email: 'Sippa@Example.se' })
    await link(m, s)
    const links = (await (await m('GET', '/api/sipdeck/links')).json<{ links: Array<{ id: number; email: string; created_at: string }> }>()).links
    expect(links).toHaveLength(1)
    expect(links[0]!.email).toBe('sippa@example.se')
    expect((await m('DELETE', `/api/sipdeck/links/${links[0]!.id}`)).status).toBe(204)
    expect(await fail(await s('GET', '/api/sipdeck/bottles'))).toEqual({ status: 404, code: 'not_linked' })
    expect((await m('DELETE', `/api/sipdeck/links/${links[0]!.id}`)).status).toBe(404)
  })

  it('hushållsbyte tar medlemmens kopplingar och koder med sig bort', async () => {
    const a = await member()
    const b = await member()
    const s = await sipdeck()
    const pending = await sipdeck()
    await a('POST', '/api/drinks', { kind: 'spirit', name: 'A:s gin', owned: true, count: 1 })
    await link(b, s)
    const unused = await code(b)
    const invite = (await (await a('GET', '/api/me')).json<{ household: { invite_code: string } }>()).household.invite_code
    expect((await b('POST', '/api/household/join', { code: invite })).status).toBe(204)
    // Kopplingen gällde B:s gamla hushåll: den följer inte med till A:s, och A:s flaskor läcker inte.
    expect(await fail(await s('GET', '/api/sipdeck/bottles'))).toEqual({ status: 404, code: 'not_linked' })
    expect((await pending('POST', '/api/sipdeck/link', { code: unused })).status).toBe(404)
  })

  it('raderat konto: kopplingen försvinner med medlemmen som gav den', async () => {
    const m = await member()
    const partner = await member()
    const s = await sipdeck()
    await m('POST', '/api/drinks', { kind: 'spirit', name: 'Gin', owned: true, count: 1 })
    const invite = (await (await m('GET', '/api/me')).json<{ household: { invite_code: string } }>()).household.invite_code
    await partner('POST', '/api/household/join', { code: invite })
    await link(partner, s)
    expect(await names(s)).toEqual(['Gin'])
    expect((await partner('DELETE', '/api/me')).status).toBe(204)
    expect(await fail(await s('GET', '/api/sipdeck/bottles'))).toEqual({ status: 404, code: 'not_linked' })
    // Hushållet finns kvar med sin andra medlem och sin flaska.
    expect((await (await m('GET', '/api/drinks')).json<{ drinks: unknown[] }>()).drinks).toHaveLength(1)
  })

  it('behörigheten kontrolleras vid varje läsning: en koppling vars givare inte längre hör till hushållet är återkallad', async () => {
    const m = await member()
    const s = await sipdeck()
    await m('POST', '/api/drinks', { kind: 'spirit', name: 'Gin', owned: true, count: 1 })
    await link(m, s)
    // Medlemskapet försvinner utan att städningen körs (som om en rad ändrats för hand i databasen).
    await env.DB.prepare('DELETE FROM member WHERE household_id = (SELECT household_id FROM sipdeck_link ORDER BY id DESC LIMIT 1)').run()
    expect(await fail(await s('GET', '/api/sipdeck/bottles'))).toEqual({ status: 403, code: 'revoked' })
    // Raden är borta efter det, så nästa svar är ett rent "inte kopplad".
    expect(await fail(await s('GET', '/api/sipdeck/bottles'))).toEqual({ status: 404, code: 'not_linked' })
  })

  it('en kod från en medlem som hunnit lämna hushållet kopplar ingenting', async () => {
    const m = await member()
    const s = await sipdeck()
    const c = await code(m)
    expect((await m('DELETE', '/api/me')).status).toBe(204)
    expect(await fail(await s('POST', '/api/sipdeck/link', { code: c }))).toEqual({ status: 404, code: 'bad_code' })
  })
})
