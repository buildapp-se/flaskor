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
    expect((await api('POST', '/api/drinks', { kind: 'mjöd', name: 'x' })).status).toBe(400)
    expect((await api('POST', '/api/drinks', { kind: 'beer', name: 'Pilsner', owned: true, count: 1 })).status).toBe(200)
    expect((await api('POST', '/api/drinks', { kind: 'wine', name: 'x', count: 'två' })).status).toBe(400)
  })
  it('okänt id: 404', async () => {
    expect((await api('PATCH', '/api/drinks/999', { count: 1 })).status).toBe(404)
    expect((await api('DELETE', '/api/drinks/999')).status).toBe(404)
  })
  it('tar bort en rad', async () => {
    const row = await (await api('POST', '/api/drinks', { kind: 'spirit', name: 'Felinlagd', owned: true, count: 1 })).json<{ id: number }>()
    expect((await api('DELETE', `/api/drinks/${row.id}`)).status).toBe(204)
    const list = await (await api('GET', '/api/drinks')).json<{ drinks: unknown[] }>()
    expect(list.drinks).toHaveLength(0)
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

describe('vivino-länk', () => {
  it('förhandsvisar ett vin ur länken, årgång ur year', async () => {
    const res = await api('GET', `/api/vivino?q=${encodeURIComponent('https://www.vivino.com/en/colombera-cascina-cottignano-bramaterra/w/2379181?year=2018&price_id=31367393')}`)
    expect(res.status, await res.clone().text()).toBe(200)
    const p = await res.json<{ name: string; producer: string; vintage: number; category: string; region: string; country: string; grapes: string; alcohol: number; vivino_rating: number; vivino_url: string; image_url: string; food: string }>()
    expect(p.name).toBe('Colombera & Garella Cascina Cottignano Bramaterra')
    expect(p.producer).toBe('Colombera & Garella')
    expect(p.vintage).toBe(2018)
    expect(p.category).toBe('Rött vin')
    expect(p.region).toBe('Bramaterra, Piemonte')
    expect(p.country).toBe('Italien')
    expect(p.grapes).toBe('Nebbiolo')
    expect(p.alcohol).toBe(13)
    expect(p.vivino_rating).toBe(3.9)
    expect(p.vivino_url).toBe('https://www.vivino.com/w/2379181')
    expect(p.image_url).toMatch(/^https:\/\/images\.vivino\.com\//)
    expect(p.food).toContain('Beef')
  })
  it('okänt vin: 404, annan länk: 400', async () => {
    expect((await api('GET', `/api/vivino?q=${encodeURIComponent('https://www.vivino.com/w/1')}`)).status).toBe(404)
    expect((await api('GET', `/api/vivino?q=${encodeURIComponent('https://www.systembolaget.se/produkt/vin/x-7562401/')}`)).status).toBe(400)
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

describe('sök på namn (BACKLOG P3)', () => {
  it('ger kandidatlistan ur Systembolagets sök', async () => {
    const res = await api('GET', '/api/search?q=absolut%20vodka')
    expect(res.status, await res.clone().text()).toBe(200)
    const { candidates } = await res.json<{ candidates: Array<{ number: string; name: string }> }>()
    // Namnsöket rankar inte om och kapar inte till tre som skanningen: användaren skrev frågan själv.
    expect(candidates.map((c) => c.number)).toEqual(['8801', '8802', '8804', '106304', '8650801'])
    expect(candidates[0]!.name).toContain('Absolut')
  })
  it('tom fråga: 400', async () => {
    expect((await api('GET', '/api/search?q=%20')).status).toBe(400)
  })
})

describe('lager i butik (BACKLOG P3)', () => {
  /** En rad med artikelnummer men utan sb_product_id, som alla rader före migrering 0004. */
  async function row() {
    return (await api('POST', '/api/drinks', { kind: 'spirit', name: 'Vanlig Vodka', owned: true, count: 1, source_kind: 'systembolaget', source_id: '1101' })).json<{ id: number; sb_product_id: string | null }>()
  }

  it('hämtar saldo och hyllplats, och fyller i produkt-id:t på vägen', async () => {
    const drink = await row()
    expect(drink.sb_product_id).toBeNull()

    const res = await api('GET', `/api/stock?drink=${drink.id}&store=2401`)
    expect(res.status, await res.clone().text()).toBe(200)
    expect(await res.json()).toEqual({ store: '2401', stock: 48, shelf: '14-04-03', in_assortment: true })

    // Andra anropet behöver ingen produktsida: id:t ligger på raden nu.
    const after = await (await api('GET', '/api/drinks')).json<{ drinks: Array<{ sb_product_id: string | null }> }>()
    expect(after.drinks[0]!.sb_product_id).toBe('21955733')
  })

  it('butik utan varan ger noll och in_assortment false', async () => {
    const drink = await row()
    const body = await (await api('GET', `/api/stock?drink=${drink.id}&store=2402`)).json<{ stock: number; in_assortment: boolean; shelf: string | null }>()
    expect(body).toMatchObject({ stock: 0, in_assortment: false, shelf: null })
  })

  it('okänd butik hos Systembolaget: 404, felformat butiksnummer: 400', async () => {
    const drink = await row()
    expect((await api('GET', `/api/stock?drink=${drink.id}&store=9999`)).status).toBe(404)
    expect((await api('GET', `/api/stock?drink=${drink.id}&store=24`)).status).toBe(400)
  })

  it('rad utan artikelnummer har inget saldo: 400', async () => {
    const manual = await (await api('POST', '/api/drinks', { kind: 'wine', name: 'Egen', owned: true, count: 1 })).json<{ id: number }>()
    expect((await api('GET', `/api/stock?drink=${manual.id}&store=2401`)).status).toBe(400)
  })
})

describe('caviste-import (beslut 6)', () => {
  it('ger lådans tre viner med hela raden ur produktsidan', async () => {
    const res = await api('GET', '/api/caviste?q=https%3A%2F%2Fwww.caviste.se%2Fcav%2Fcav0143-colombera-garella%2F')
    expect(res.status, await res.clone().text()).toBe(200)
    const { wines } = await res.json<{ wines: Array<{ name: string; count: number; drink_to: number | null; source_kind: string; grapes: string | null }> }>()
    expect(wines).toHaveLength(3)
    expect(wines[0]).toMatchObject({ name: 'Colombera & Garella Coste della Sesia', count: 3, drink_to: 2026, source_kind: 'caviste', grapes: 'nebbiolo, vespolina, croatina' })
  })

  it('ett valt vin sparas som vanligt, med lådans antal', async () => {
    const { wines } = await (await api('GET', '/api/caviste?q=https%3A%2F%2Fwww.caviste.se%2Fcav%2Fcav0143-colombera-garella%2F')).json<{ wines: unknown[] }>()
    const saved = await (await api('POST', '/api/drinks', { ...(wines[1] as object), owned: true })).json<{ name: string; count: number; decant_hours: number }>()
    expect(saved).toMatchObject({ name: 'Colombera & Garella Bramaterra', count: 2, decant_hours: 1 })
  })

  it('okänd låda: 404, annan sajt: 400', async () => {
    expect((await api('GET', '/api/caviste?q=https%3A%2F%2Fwww.caviste.se%2Fcav%2Fcav0999-inget%2F')).status).toBe(404)
    expect((await api('GET', '/api/caviste?q=https%3A%2F%2Fexample.com%2F')).status).toBe(400)
  })
})

describe('drucken-logg (beslut 16)', () => {
  async function drink() {
    return (await api('POST', '/api/drinks', { kind: 'wine', name: 'Barolo', owned: true, count: 2 })).json<{ id: number }>()
  }

  it('skriver, listar senast först och tar bort', async () => {
    const d = await drink()
    expect(await (await api('GET', `/api/drinks/${d.id}/tastings`)).json()).toEqual({ tastings: [] })

    await api('POST', `/api/drinks/${d.id}/tastings`, { drunk_on: '2026-01-05', rating: 4, note: 'till oxfilé' })
    const second = await (await api('POST', `/api/drinks/${d.id}/tastings`, { drunk_on: '2026-06-20', rating: 5 })).json<{ id: number; note: string | null }>()
    expect(second.note).toBeNull()

    const { tastings } = await (await api('GET', `/api/drinks/${d.id}/tastings`)).json<{ tastings: Array<{ id: number; drunk_on: string; rating: number | null }> }>()
    expect(tastings.map((t) => t.drunk_on)).toEqual(['2026-06-20', '2026-01-05'])

    expect((await api('DELETE', `/api/drinks/${d.id}/tastings/${second.id}`)).status).toBe(204)
    const after = await (await api('GET', `/api/drinks/${d.id}/tastings`)).json<{ tastings: unknown[] }>()
    expect(after.tastings).toHaveLength(1)
  })

  it('avvisar datum och betyg som inte håller', async () => {
    const d = await drink()
    expect((await api('POST', `/api/drinks/${d.id}/tastings`, { drunk_on: 'i fredags' })).status).toBe(400)
    expect((await api('POST', `/api/drinks/${d.id}/tastings`, {})).status).toBe(400)
    expect((await api('POST', `/api/drinks/${d.id}/tastings`, { drunk_on: '2026-06-20', rating: 6 })).status).toBe(400)
    expect((await api('POST', `/api/drinks/${d.id}/tastings`, { drunk_on: '2026-06-20', rating: 3.5 })).status).toBe(400)
  })

  it('loggen försvinner med raden, ingen föräldralös rad blir kvar', async () => {
    const d = await drink()
    await api('POST', `/api/drinks/${d.id}/tastings`, { drunk_on: '2026-06-20', rating: 5 })
    await api('DELETE', `/api/drinks/${d.id}`)
    const left = await env.DB.prepare('SELECT count(*) AS n FROM tasting WHERE drink_id = ?').bind(d.id).first<{ n: number }>()
    expect(left?.n).toBe(0)
  })

  it('okänd rad ger 404, inte en logg på ett främmande id', async () => {
    expect((await api('GET', '/api/drinks/99999/tastings')).status).toBe(404)
    expect((await api('POST', '/api/drinks/99999/tastings', { drunk_on: '2026-06-20' })).status).toBe(404)
  })
})
