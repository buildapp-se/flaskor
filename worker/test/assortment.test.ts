import { SELF, env } from 'cloudflare:test'
import { beforeEach, describe, expect, it } from 'vitest'
import { fromDump, importAssortment, importedAt, isFresh, objectSplitter, searchMirror, searchTerms } from '../src/assortment.ts'
import worker, { refreshAll } from '../src/index.ts'

const AUTH = { authorization: 'Bearer test-kod' }

function api(method: string, path: string, body?: unknown): Promise<Response> {
  return SELF.fetch(`https://flaskor-api.test${path}`, {
    method,
    headers: { 'content-type': 'application/json', ...AUTH },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

/** Kör texten genom delaren i bitar om `size` tecken, som en nätström skulle göra. */
async function split(text: string, size: number): Promise<unknown[]> {
  const out: unknown[] = []
  const stream = new ReadableStream<string>({
    start(controller) {
      for (let i = 0; i < text.length; i += size) controller.enqueue(text.slice(i, i + size))
      controller.close()
    },
  })
  const reader = stream.pipeThrough(objectSplitter()).getReader()
  for (;;) {
    const { done, value } = await reader.read()
    if (done) return out
    out.push(value)
  }
}

beforeEach(async () => {
  await env.DB.batch([env.DB.prepare('DELETE FROM drink'), env.DB.prepare('DELETE FROM sb_product'), env.DB.prepare('DELETE FROM sb_meta')])
})

describe('strömdelaren', () => {
  const text = '[\n {"a": 1, "s": "kl}am{mer \\" citat", "n": {"d": [1, {"e": 2}]}},\n {"b": "två"}\n]'
  it('ger samma objekt oavsett var chunkgränserna faller', async () => {
    const whole = await split(text, text.length)
    expect(whole).toEqual([{ a: 1, s: 'kl}am{mer " citat', n: { d: [1, { e: 2 }] } }, { b: 'två' }])
    for (const size of [1, 2, 3, 7, 13]) expect(await split(text, size)).toEqual(whole)
  })
})

describe('dumpraden', () => {
  it('blir vår Product: pris ur price, druvor som text, bild bara när listan har något', () => {
    const p = fromDump({ productNumber: '1', productId: '2', productNameBold: 'X', price: 99, grapes: ['Syrah', 'Grenache'], images: [], vintage: '2020' })
    expect(p.priceInclVat).toBe(99)
    expect(p.grapes).toBe('Syrah, Grenache')
    expect(p.hasImage).toBe(false)
    expect(p.vintage).toBe('2020')
    expect(() => fromDump({ productId: '2' })).toThrow()
  })
  it('sökord är gemener utan diakriter och skiljetecken', () => {
    expect(searchTerms("Kahlúa, d'Ibry 2023!")).toEqual(['kahlua', 'd', 'ibry', '2023'])
    expect(searchTerms(' -- ')).toEqual([])
  })
})

describe('importen', () => {
  it('fyller spegeln, är idempotent och tar bort det som försvann', async () => {
    expect(await importedAt(env.DB)).toBeNull()
    expect(await isFresh(env.DB)).toBe(false)
    const first = await importAssortment(env.DB)
    expect(first.rows).toBe(4)
    expect(first.removed).toBe(0)
    expect(await isFresh(env.DB)).toBe(true)

    // En rad som inte finns i dumpen längre, med gammal tidsstämpel: nästa import ska ta bort den.
    await env.DB.prepare("INSERT INTO sb_product (number, search, json, updated_at) VALUES ('1', 'borta', '{}', '2000-01-01T00:00:00.000Z')").run()
    const second = await importAssortment(env.DB)
    expect(second.rows).toBe(4)
    expect(second.removed).toBe(1)
    expect((await env.DB.prepare('SELECT count(*) AS n FROM sb_product').first<{ n: number }>())?.n).toBe(4)
  })
  it('spegeln äldre än 36 timmar räknas inte som färsk', async () => {
    await importAssortment(env.DB)
    expect(await isFresh(env.DB, new Date(Date.now() + 37 * 3600 * 1000))).toBe(false)
  })
})

describe('sök i spegeln', () => {
  beforeEach(async () => {
    await importAssortment(env.DB)
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
    await importAssortment(env.DB)
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
  it('scheduled importerar och uppdaterar priset utan produktsida; okänt nummer går sidvägen', async () => {
    const mirrored = await (await api('POST', '/api/drinks', { kind: 'beer', name: 'ng', owned: false, source_kind: 'systembolaget', source_id: '141201', price_current: 1 })).json<{ id: number }>()
    const paged = await (await api('POST', '/api/drinks', { kind: 'spirit', name: 'vv', owned: false, source_kind: 'systembolaget', source_id: '1101', price_current: 1 })).json<{ id: number }>()
    const gone = await (await api('POST', '/api/drinks', { kind: 'spirit', name: 'z', owned: false, source_kind: 'systembolaget', source_id: '9999999' })).json<{ id: number }>()

    await worker.scheduled({} as ScheduledController, env)
    expect(await isFresh(env.DB)).toBe(true)
    const rows = (await (await api('GET', '/api/drinks')).json<{ drinks: Array<{ id: number; price_current: number | null; availability: string; sb_product_id: string | null }> }>()).drinks
    expect(rows.find((r) => r.id === mirrored.id)).toMatchObject({ price_current: 17.5, sb_product_id: '939', availability: 'temporarily_out' })
    expect(rows.find((r) => r.id === paged.id)?.price_current).not.toBe(1)
    expect(rows.find((r) => r.id === gone.id)?.availability).toBe('discontinued')

    const again = await refreshAll(env.DB)
    expect(again).toMatchObject({ refreshed: 3, mirrored: 1, failed: 0 })
  })
})
