import { SELF, env } from 'cloudflare:test'
import { beforeEach, describe, expect, it } from 'vitest'
import { fromDump, importedAt, isFresh, searchMirror, searchTerms, validRun } from '../src/assortment.ts'
import worker, { refreshAll } from '../src/index.ts'
import dump from './fixtures/sb-dump.json'

const AUTH = { authorization: 'Bearer test-kod' }
const RUN = '2026-09-12T02:00:00.000Z'

function api(method: string, path: string, body?: unknown): Promise<Response> {
  return SELF.fetch(`https://flaskor-api.test${path}`, {
    method,
    headers: { 'content-type': 'application/json', ...AUTH },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

/** Som nattskriptet: alla rader i en bit, sedan done. Fixturen är fyra produkter ur den riktiga dumpen 2026-09-12. */
async function mirror(run = RUN): Promise<{ upserted: number; rows?: number; removed?: number }> {
  const first = await api('POST', '/api/assortment', { run, rows: dump })
  expect(first.status, await first.clone().text()).toBe(200)
  const done = await api('POST', '/api/assortment', { run, done: true })
  expect(done.status, await done.clone().text()).toBe(200)
  return done.json()
}

beforeEach(async () => {
  await env.DB.batch([env.DB.prepare('DELETE FROM drink'), env.DB.prepare('DELETE FROM sb_product'), env.DB.prepare('DELETE FROM sb_meta')])
})

describe('dumpraden', () => {
  it('blir vår Product: pris ur price, druvor som text, bild bara när listan har något', () => {
    const p = fromDump({ productNumber: '1', productId: '2', productNameBold: 'X', price: 99, grapes: ['Syrah', 'Grenache'], images: [], vintage: '2020' })
    expect(p.priceInclVat).toBe(99)
    expect(p.grapes).toBe('Syrah, Grenache')
    expect(p.hasImage).toBe(false)
    expect(p.vintage).toBe('2020')
    expect(() => fromDump({ productId: '2' })).toThrow()
    expect(() => fromDump(null)).toThrow()
  })
  it('sökord är gemener utan diakriter och skiljetecken', () => {
    expect(searchTerms("Kahlúa, d'Ibry 2023!")).toEqual(['kahlua', 'd', 'ibry', '2023'])
    expect(searchTerms(' -- ')).toEqual([])
  })
  it('körningens id måste vara en ISO-tid', () => {
    expect(validRun(RUN)).toBe(true)
    expect(validRun('2026-09-12')).toBe(false)
    expect(validRun("x' OR 1=1")).toBe(false)
  })
})

describe('POST /api/assortment', () => {
  it('fyller spegeln i bitar, är idempotent och tar bort det som försvann', async () => {
    expect(await importedAt(env.DB)).toBeNull()
    expect(await isFresh(env.DB)).toBe(false)
    const first = await mirror()
    expect(first).toEqual({ upserted: 0, rows: 4, removed: 0 })
    expect(await importedAt(env.DB)).toBe(RUN)
    expect(await isFresh(env.DB, new Date('2026-09-12T10:00:00Z'))).toBe(true)
    expect(await isFresh(env.DB, new Date('2026-09-14T10:00:00Z'))).toBe(false)

    // En rad som inte finns i dumpen längre: nästa körning ska ta bort den, och den nya körningen får inga dubbletter.
    await env.DB.prepare("INSERT INTO sb_product (number, search, json, updated_at) VALUES ('1', 'borta', '{}', '2000-01-01T00:00:00.000Z')").run()
    const second = await mirror('2026-09-13T02:00:00.000Z')
    expect(second).toEqual({ upserted: 0, rows: 4, removed: 1 })
    expect((await env.DB.prepare('SELECT count(*) AS n FROM sb_product').first<{ n: number }>())?.n).toBe(4)
  })
  it('avvisar skräp: fel körnings-id, rader som inte är en lista, done utan rader, för många rader', async () => {
    expect((await api('POST', '/api/assortment', { run: 'igår', rows: dump })).status).toBe(400)
    expect((await api('POST', '/api/assortment', { run: RUN, rows: 'nej' })).status).toBe(400)
    expect((await api('POST', '/api/assortment', { run: RUN, rows: [{ productId: '1' }] })).status).toBe(400)
    // done på en körning som inte skrev något får aldrig tömma spegeln.
    expect((await api('POST', '/api/assortment', { run: RUN, done: true })).status).toBe(400)
    expect((await api('POST', '/api/assortment', { run: RUN, rows: Array(1001).fill(dump[0]) })).status).toBe(400)
    expect((await api('POST', '/api/assortment', { run: RUN, rows: [] })).status).toBe(200)
  })
  it('kräver grindkoden', async () => {
    const res = await SELF.fetch('https://flaskor-api.test/api/assortment', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ run: RUN, rows: dump }) })
    expect(res.status).toBe(401)
  })
})

describe('sök i spegeln', () => {
  beforeEach(async () => {
    await mirror()
  })
  it('alla ord måste finnas, diakriter spelar ingen roll, kortast namn först', async () => {
    const ibry = await searchMirror(env.DB, 'ibry blanc')
    expect(ibry.map((c) => c.number)).toEqual(['7562401'])
    expect(ibry[0]).toMatchObject({ name: "Domaine Georges d'Ibry Excellence Blanc", price: 164, vintage: 2023, category: 'Vitt vin' })
    expect(ibry[0]!.image_url).toContain('50303361')
    expect((await searchMirror(env.DB, 'Kahlúa')).map((c) => c.number)).toEqual(['71401'])
    expect((await searchMirror(env.DB, 'kahlua')).map((c) => c.number)).toEqual(['71401'])
    expect(await searchMirror(env.DB, 'ibry rioja')).toEqual([])
    expect(await searchMirror(env.DB, '!!')).toEqual([])
  })
})

describe('reserven i API:t', () => {
  beforeEach(async () => {
    await mirror()
  })
  it('söket faller till spegeln när Systembolaget svarar 429 eller nyckeln nekas', async () => {
    for (const q of ['ratelimit%20kahlua', 'nyckelfel%20kahlua']) {
      const res = await api('GET', `/api/search?q=${q}`)
      expect(res.status, await res.clone().text()).toBe(200)
      const { candidates } = await res.json<{ candidates: Array<{ number: string }> }>()
      // Spegeln söker på frågans alla ord, och "ratelimit" finns inte i något namn: därför tom lista här, men 200 och inte 503.
      expect(candidates).toEqual([])
    }
    const plain = await (await api('GET', '/api/search?q=kahlua')).json<{ candidates: Array<{ number: string }> }>()
    // Utan fel svarar Systembolaget som förut (fixturen är alltid Absolut).
    expect(plain.candidates[0]!.number).toBe('8801')
  })
  it('söket cachas: andra anropet finns i Cache API', async () => {
    await api('GET', '/api/search?q=Absolut')
    const hit = await caches.default.match(new Request('https://flaskor-api.buildapp.se/_cache/' + encodeURIComponent('search:absolut')))
    expect(hit).toBeDefined()
    expect((await hit!.json<{ number: string }[]>())[0]!.number).toBe('8801')
  })
  it('produktuppslaget faller till spegeln när produktsidan svarar 5xx, men 404 förblir 404', async () => {
    const res = await api('GET', '/api/systembolaget?q=141201')
    expect(res.status, await res.clone().text()).toBe(200)
    const preview = await res.json<{ name: string; kind: string; price_current: number; sb_product_id: string }>()
    expect(preview).toMatchObject({ name: 'Norrlands Guld Export', kind: 'beer', price_current: 17.5, sb_product_id: '939' })
    expect((await api('GET', '/api/systembolaget?q=9999999')).status).toBe(404)
  })
  it('utan spegelrad går sidans fel vidare', async () => {
    await env.DB.prepare("DELETE FROM sb_product WHERE number = '141201'").run()
    expect((await api('GET', '/api/systembolaget?q=141201')).status).toBe(503)
  })
})

describe('natten ur spegeln (beslut 23)', () => {
  it('uppdaterar priset ur spegeln utan produktsida; okänt nummer går sidvägen', async () => {
    await mirror(new Date().toISOString())
    const mirrored = await (await api('POST', '/api/drinks', { kind: 'beer', name: 'ng', owned: false, source_kind: 'systembolaget', source_id: '141201', price_current: 1 })).json<{ id: number }>()
    const paged = await (await api('POST', '/api/drinks', { kind: 'spirit', name: 'vv', owned: false, source_kind: 'systembolaget', source_id: '1101', price_current: 1 })).json<{ id: number }>()
    const gone = await (await api('POST', '/api/drinks', { kind: 'spirit', name: 'z', owned: false, source_kind: 'systembolaget', source_id: '9999999' })).json<{ id: number }>()

    await worker.scheduled({} as ScheduledController, env)
    const rows = (await (await api('GET', '/api/drinks')).json<{ drinks: Array<{ id: number; price_current: number | null; availability: string; sb_product_id: string | null }> }>()).drinks
    expect(rows.find((r) => r.id === mirrored.id)).toMatchObject({ price_current: 17.5, sb_product_id: '939', availability: 'temporarily_out' })
    expect(rows.find((r) => r.id === paged.id)?.price_current).not.toBe(1)
    expect(rows.find((r) => r.id === gone.id)?.availability).toBe('discontinued')

    expect(await refreshAll(env.DB)).toMatchObject({ refreshed: 3, mirrored: 1, failed: 0 })
  })
  it('gammal spegel går inte före produktsidan, men duger som reserv när sidan ligger nere', async () => {
    await mirror('2020-01-01T00:00:00.000Z')
    await api('POST', '/api/drinks', { kind: 'beer', name: 'ng', owned: false, source_kind: 'systembolaget', source_id: '141201', price_current: 1 })
    // Spegeln är för gammal för att räknas som källa (mirrored 0), så sidan provas först; den svarar 503 och då får
    // den gamla spegelraden ändå svara: ett gammalt pris är bättre än ett fel.
    expect(await refreshAll(env.DB)).toMatchObject({ refreshed: 1, mirrored: 0, failed: 0 })
  })
})
