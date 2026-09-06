import { SELF, env } from 'cloudflare:test'
import { beforeEach, describe, expect, it } from 'vitest'
import worker from '../src/index.ts'
import { refreshAll } from '../src/index.ts'

const AUTH = { authorization: 'Bearer test-kod' }

function api(method: string, path: string, body?: unknown, headers: Record<string, string> = AUTH): Promise<Response> {
  return SELF.fetch(`https://flaskor-api.test${path}`, {
    method,
    headers: { 'content-type': 'application/json', ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

beforeEach(async () => {
  await env.DB.prepare('DELETE FROM drink').run()
})

describe('grindkoden (beslut 2)', () => {
  it('utan kod: 401', async () => {
    expect((await api('GET', '/api/drinks', undefined, {})).status).toBe(401)
    expect((await api('GET', '/api/drinks', undefined, { authorization: 'Bearer fel' })).status).toBe(401)
  })
  it('rätt kod: 204 på ping', async () => {
    expect((await api('GET', '/api/ping')).status).toBe(204)
  })
  it('health kräver ingen kod', async () => {
    expect((await api('GET', '/health', undefined, {})).status).toBe(200)
  })
  it('okänd origin nekas, känd får CORS-huvud', async () => {
    const bad = await api('GET', '/api/ping', undefined, { ...AUTH, origin: 'https://evil.example' })
    expect(bad.status).toBe(403)
    const good = await api('GET', '/api/ping', undefined, { ...AUTH, origin: 'https://buildapp.se' })
    expect(good.headers.get('access-control-allow-origin')).toBe('https://buildapp.se')
  })
})

describe('drinks', () => {
  it('skapar, listar och uppdaterar en rad', async () => {
    const created = await api('POST', '/api/drinks', { kind: 'wine', name: 'Barolo', owned: true, count: 1, price_paid: 499, category: 'Rött vin' })
    expect(created.status, await created.clone().text()).toBe(200)
    const drink = await created.json<{ id: number; owned: boolean; household_id: number }>()
    expect(drink.owned).toBe(true)
    expect(drink.household_id).toBe(1)

    const list = await (await api('GET', '/api/drinks')).json<{ drinks: unknown[] }>()
    expect(list.drinks).toHaveLength(1)

    const patched = await api('PATCH', `/api/drinks/${drink.id}`, { count: 0, note: 'smakade gött' })
    const after = await patched.json<{ count: number; note: string }>()
    expect(after.count).toBe(0)
    expect(after.note).toBe('smakade gött')
  })
  it('avvisar okända värden och saknat namn', async () => {
    expect((await api('POST', '/api/drinks', { kind: 'wine' })).status).toBe(400)
    expect((await api('POST', '/api/drinks', { kind: 'beer', name: 'x' })).status).toBe(400)
    expect((await api('POST', '/api/drinks', { kind: 'wine', name: 'x', count: 'två' })).status).toBe(400)
  })
  it('okänt id: 404', async () => {
    expect((await api('PATCH', '/api/drinks/999', { count: 1 })).status).toBe(404)
  })
})

describe('vivino', () => {
  it('nytt vin får betyg när namnet liknar träffen, annars inget', async () => {
    const hit = await (await api('POST', '/api/drinks', { kind: 'wine', name: 'Le Grappin Savigny-les-Beaune Rouge', owned: true, count: 1 })).json<{ vivino_rating: number; vivino_url: string; vivino_checked_at: string }>()
    expect(hit.vivino_rating).toBe(4.2)
    expect(hit.vivino_url).toBe('https://www.vivino.com/w/1661808')
    expect(hit.vivino_checked_at).toBeTruthy()
    const miss = await (await api('POST', '/api/drinks', { kind: 'wine', name: 'Testbubbel Brut', owned: true, count: 1 })).json<{ vivino_rating: number | null; vivino_checked_at: string }>()
    expect(miss.vivino_rating).toBeNull()
    expect(miss.vivino_checked_at).toBeTruthy()
    const spirit = await (await api('POST', '/api/drinks', { kind: 'spirit', name: 'Le Grappin Gin', owned: true, count: 1 })).json<{ vivino_checked_at: string | null }>()
    expect(spirit.vivino_checked_at).toBeNull()
  })
  it('uppdatera hämtar betyget även för Caviste-rader; refresh-all fyller på de som saknar', async () => {
    const cav = await (await api('POST', '/api/drinks', { kind: 'wine', name: 'Le Grappin Savigny-les-Beaune Rouge', source_kind: 'caviste', vivino_rating: null, vivino_checked_at: null })).json<{ id: number; vivino_rating: number | null }>()
    expect(cav.vivino_rating).toBeNull()
    const refreshed = await (await api('POST', `/api/drinks/${cav.id}/refresh`)).json<{ vivino_rating: number }>()
    expect(refreshed.vivino_rating).toBe(4.2)
    await api('PATCH', `/api/drinks/${cav.id}`, { vivino_rating: null, vivino_checked_at: null })
    const all = await (await api('POST', '/api/refresh-all')).json<{ vivino: number }>()
    expect(all.vivino).toBe(1)
  })
})

describe('systembolaget', () => {
  it('förhandsvisar ett nummer ur fixturen', async () => {
    const res = await api('GET', '/api/systembolaget?q=7562401')
    expect(res.status, await res.clone().text()).toBe(200)
    const preview = await res.json<{ name: string; drink_from: number; kind: string }>()
    expect(preview.name).toBe("Domaine Georges d'Ibry Excellence Blanc")
    expect(preview.kind).toBe('wine')
    expect(preview.drink_from).toBe(2023)
  })
  it('okänt nummer: 404, skräp: 400', async () => {
    expect((await api('GET', '/api/systembolaget?q=9999999')).status).toBe(404)
    expect((await api('GET', '/api/systembolaget?q=abc')).status).toBe(400)
  })
  it('refresh uppdaterar pris men inte ägd årgång; borttagen vara blir discontinued', async () => {
    const owned = await (await api('POST', '/api/drinks', { kind: 'wine', name: 'x', owned: true, vintage: 2019, source_kind: 'systembolaget', source_id: '7562401', price_current: 100 })).json<{ id: number }>()
    const wished = await (await api('POST', '/api/drinks', { kind: 'wine', name: 'y', owned: false, vintage: 2019, source_kind: 'systembolaget', source_id: '7562401' })).json<{ id: number }>()
    const gone = await (await api('POST', '/api/drinks', { kind: 'spirit', name: 'z', owned: false, source_kind: 'systembolaget', source_id: '9999999' })).json<{ id: number }>()

    const one = await (await api('POST', `/api/drinks/${owned.id}/refresh`)).json<{ price_current: number; vintage: number; availability: string }>()
    expect(one.price_current).toBe(164)
    expect(one.vintage).toBe(2019)
    expect(one.availability).toBe('in_stock')

    const result = await refreshAll(env.DB)
    // Raderna fick sitt Vivino-datum redan vid POST, så natten har inget vin att hämta betyg för.
    expect(result).toEqual({ refreshed: 2, failed: 0, vivino: 0 })
    const rows = (await (await api('GET', '/api/drinks')).json<{ drinks: Array<{ id: number; vintage: number | null; availability: string }> }>()).drinks
    expect(rows.find((r) => r.id === wished.id)?.vintage).toBe(2023)
    expect(rows.find((r) => r.id === owned.id)?.vintage).toBe(2019)
    expect(rows.find((r) => r.id === gone.id)?.availability).toBe('discontinued')
  })
  it('avvisar länkfält som inte är http(s)', async () => {
    expect((await api('POST', '/api/drinks', { kind: 'wine', name: 'x', vivino_url: 'javascript:alert(1)' })).status).toBe(400)
    expect((await api('POST', '/api/drinks', { kind: 'wine', name: 'x', source_url: 'data:text/html,hej' })).status).toBe(400)
  })
  it('scheduled kör utan att kasta', async () => {
    await expect(worker.scheduled({} as ScheduledController, env)).resolves.toBeUndefined()
  })
})
