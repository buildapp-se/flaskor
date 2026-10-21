import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FatalError, NotFoundError, TransientError, UnauthorizedError } from '../shared/errors.ts'
import type { Account, Candidate, Drink, DrinkInput, ExportData, Preview, ScanResult, SipdeckCode, SipdeckLink, Stock, Tasting, TastingInput } from '../shared/types.ts'
import { api, clearGate, findGate, setGate } from './api.ts'
import { getIdToken, isAuthConfigured } from './auth.ts'
import { blankDrink } from './local.ts'

vi.mock('./auth.ts', () => ({
  isAuthConfigured: vi.fn(),
  getIdToken: vi.fn(),
}))

const mockedIsAuthConfigured = vi.mocked(isAuthConfigured)
const mockedGetIdToken = vi.mocked(getIdToken)

const BASE = 'http://localhost:8787'
const { id: _id, household_id: _hh, created_at: _ca, updated_at: _ua, last_drunk_on: _ld, last_rating: _lr, tasting_count: _tc, ...sampleInput }: Drink = {
  ...blankDrink('wine'),
  name: 'Barolo',
  producer: 'Colla',
  vintage: 2019,
  owned: true,
  count: 2,
}
const sampleDrink: Drink = { ...blankDrink('wine'), ...sampleInput, id: 12, household_id: 1 }

describe('grindkoden i localStorage', () => {
  let store: Map<string, string>

  beforeEach(() => {
    store = new Map<string, string>()
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => store.set(k, v),
      removeItem: (k: string) => store.delete(k),
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('läser, sparar och tar bort grindkoden under nyckeln flaskor.gate', () => {
    expect(findGate()).toBeNull()

    setGate('hemlig-kod')
    expect(store.get('flaskor.gate')).toBe('hemlig-kod')
    expect(findGate()).toBe('hemlig-kod')

    clearGate()
    expect(store.has('flaskor.gate')).toBe(false)
    expect(findGate()).toBeNull()
  })
})

describe('autentisering och huvuden i API-anrop', () => {
  let store: Map<string, string>
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    store = new Map<string, string>()
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => store.set(k, v),
      removeItem: (k: string) => store.delete(k),
    })
    fetchMock = vi.fn(async () => new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.resetAllMocks()
  })

  it('skickar sparad grindkod som Bearer när Firebase-inloggning inte är på', async () => {
    mockedIsAuthConfigured.mockReturnValue(false)
    mockedGetIdToken.mockRejectedValue(new Error('ska inte anropas'))
    setGate('grind-123')

    await api.ping()

    expect(mockedGetIdToken).not.toHaveBeenCalled()
    expect(fetchMock).toHaveBeenCalledExactlyOnceWith(`${BASE}/api/ping`, {
      method: 'GET',
      headers: { authorization: 'Bearer grind-123' },
      body: undefined,
    })
  })

  it('skickar inget authorization-huvud när varken inloggning eller grindkod finns', async () => {
    mockedIsAuthConfigured.mockReturnValue(false)

    await api.ping()

    expect(fetchMock).toHaveBeenCalledExactlyOnceWith(`${BASE}/api/ping`, {
      method: 'GET',
      headers: {},
      body: undefined,
    })
  })

  it('skickar Firebase ID-token som Bearer när inloggningen är på', async () => {
    mockedIsAuthConfigured.mockReturnValue(true)
    mockedGetIdToken.mockResolvedValue('firebase-jwt-token')
    setGate('gammal-grind')

    await api.ping()

    expect(fetchMock).toHaveBeenCalledExactlyOnceWith(`${BASE}/api/ping`, {
      method: 'GET',
      headers: { authorization: 'Bearer firebase-jwt-token' },
      body: undefined,
    })
  })

  it('utelämnar authorization-huvudet i gästläget när getIdToken kastar', async () => {
    mockedIsAuthConfigured.mockReturnValue(true)
    mockedGetIdToken.mockRejectedValue(new Error('Du är inte inloggad.'))

    await api.ping()

    expect(fetchMock).toHaveBeenCalledExactlyOnceWith(`${BASE}/api/ping`, {
      method: 'GET',
      headers: {},
      body: undefined,
    })
  })

  it('sätter content-type och serialiserar kroppen bara när body skickas med', async () => {
    mockedIsAuthConfigured.mockReturnValue(true)
    mockedGetIdToken.mockResolvedValue('jwt-1')

    await api.renameHousehold('Vinkällaren')

    expect(fetchMock).toHaveBeenCalledExactlyOnceWith(`${BASE}/api/household`, {
      method: 'PATCH',
      headers: {
        authorization: 'Bearer jwt-1',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ name: 'Vinkällaren' }),
    })
  })
})

describe('svar och felhantering i call()', () => {
  beforeEach(() => {
    mockedIsAuthConfigured.mockReturnValue(true)
    mockedGetIdToken.mockResolvedValue('jwt-1')
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.resetAllMocks()
  })

  it('kastar TransientError med nätfelmeddelande när fetch avvisas', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('Failed to fetch')
      }),
    )

    const err = await api.ping().catch((e: unknown) => e)
    expect(err).toBeInstanceOf(TransientError)
    expect((err as Error).message).toBe('network: TypeError: Failed to fetch')
  })

  it('returnerar undefined vid 204 utan att försöka tolka JSON', async () => {
    const jsonSpy = vi.fn(async () => {
      throw new SyntaxError('Unexpected end of JSON input')
    })
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ status: 204, ok: true, json: jsonSpy }) as unknown as Response),
    )

    await expect(api.ping()).resolves.toBeUndefined()
    expect(jsonSpy).not.toHaveBeenCalled()
  })

  it('kastar UnauthorizedError vid 401', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('ogiltig token', { status: 401 })))

    await expect(api.me()).rejects.toBeInstanceOf(UnauthorizedError)
  })

  it('kastar NotFoundError med svaret vid 404', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('flaskan saknas', { status: 404 })))

    const err = await api.refreshDrink(99).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(NotFoundError)
    expect((err as NotFoundError).status).toBe(404)
    expect((err as NotFoundError).message).toBe('flaskan saknas')
  })

  it('kastar TransientError vid 500 och 503', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('databasfel', { status: 500 })))
    const err500 = await api.me().catch((e: unknown) => e)
    expect(err500).toBeInstanceOf(TransientError)
    expect((err500 as Error).message).toBe('databasfel')

    vi.stubGlobal('fetch', vi.fn(async () => new Response('upstream nere', { status: 503 })))
    const err503 = await api.me().catch((e: unknown) => e)
    expect(err503).toBeInstanceOf(TransientError)
    expect((err503 as Error).message).toBe('upstream nere')
  })

  it('kastar FatalError med statuskod och meddelande vid övriga 4xx-svar', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('hushållet är inte tomt', { status: 409 })))

    const err = await api.joinHousehold('abc123def0').catch((e: unknown) => e)
    expect(err).toBeInstanceOf(FatalError)
    expect(err).not.toBeInstanceOf(UnauthorizedError)
    expect(err).not.toBeInstanceOf(NotFoundError)
    expect((err as FatalError).status).toBe(409)
    expect((err as FatalError).message).toBe('hushållet är inte tomt')
  })

  it('kapar felmeddelandet till 200 tecken och faller tillbaka på tom sträng om text() kastar', async () => {
    const longText = 'a'.repeat(50) + 'b'.repeat(150) + 'c'.repeat(40)
    vi.stubGlobal('fetch', vi.fn(async () => new Response(longText, { status: 400 })))

    const truncated = await api.me().catch((e: unknown) => e)
    expect(truncated).toBeInstanceOf(FatalError)
    expect((truncated as FatalError).message).toBe('a'.repeat(50) + 'b'.repeat(150))
    expect((truncated as FatalError).message).toHaveLength(200)

    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          ({
            status: 502,
            ok: false,
            text: async () => {
              throw new Error('stream avbruten')
            },
          }) as unknown as Response,
      ),
    )

    const fallback = await api.me().catch((e: unknown) => e)
    expect(fallback).toBeInstanceOf(TransientError)
    expect((fallback as Error).message).toBe('')
  })
})

describe('api-metodernas anrop och svar', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    mockedIsAuthConfigured.mockReturnValue(true)
    mockedGetIdToken.mockResolvedValue('jwt-token')
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.resetAllMocks()
  })

  function mockJson(data: unknown) {
    fetchMock.mockResolvedValueOnce(Response.json(data, { status: 200 }))
  }

  function mockNoContent() {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }))
  }

  it('me, renameHousehold, joinHousehold och deleteAccount', async () => {
    const account: Account = {
      email: 'patrik@example.com',
      household: { id: 1, name: 'Hemma', invite_code: '0123456789', members: ['patrik@example.com'] },
    }
    mockJson(account)
    await expect(api.me()).resolves.toEqual(account)
    expect(fetchMock).toHaveBeenLastCalledWith(`${BASE}/api/me`, {
      method: 'GET',
      headers: { authorization: 'Bearer jwt-token' },
      body: undefined,
    })

    mockNoContent()
    await expect(api.renameHousehold('Stugan')).resolves.toBeUndefined()
    expect(fetchMock).toHaveBeenLastCalledWith(`${BASE}/api/household`, {
      method: 'PATCH',
      headers: { authorization: 'Bearer jwt-token', 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Stugan' }),
    })

    mockNoContent()
    await expect(api.joinHousehold('0123456789')).resolves.toBeUndefined()
    expect(fetchMock).toHaveBeenLastCalledWith(`${BASE}/api/household/join`, {
      method: 'POST',
      headers: { authorization: 'Bearer jwt-token', 'content-type': 'application/json' },
      body: JSON.stringify({ code: '0123456789' }),
    })

    mockNoContent()
    await expect(api.deleteAccount()).resolves.toBeUndefined()
    expect(fetchMock).toHaveBeenLastCalledWith(`${BASE}/api/me`, {
      method: 'DELETE',
      headers: { authorization: 'Bearer jwt-token' },
      body: undefined,
    })
  })

  it('importDrinks och exportData', async () => {
    const items = [{ ...sampleInput, tastings: [{ drunk_on: '2026-09-01', rating: 4, note: 'Gott' }] }]
    mockJson({ imported: 1 })
    await expect(api.importDrinks(items)).resolves.toBe(1)
    expect(fetchMock).toHaveBeenLastCalledWith(`${BASE}/api/drinks/import`, {
      method: 'POST',
      headers: { authorization: 'Bearer jwt-token', 'content-type': 'application/json' },
      body: JSON.stringify({ drinks: items }),
    })

    const exported: ExportData = {
      app: 'flaskor',
      exported_at: '2026-09-15T12:00:00Z',
      household: 'Hemma',
      drinks: [sampleDrink],
      tastings: [],
    }
    mockJson(exported)
    await expect(api.exportData()).resolves.toEqual(exported)
    expect(fetchMock).toHaveBeenLastCalledWith(`${BASE}/api/export`, {
      method: 'GET',
      headers: { authorization: 'Bearer jwt-token' },
      body: undefined,
    })
  })

  it('listDrinks, createDrink, patchDrink, refreshDrink och deleteDrink', async () => {
    mockJson({ drinks: [sampleDrink] })
    await expect(api.listDrinks()).resolves.toEqual([sampleDrink])
    expect(fetchMock).toHaveBeenLastCalledWith(`${BASE}/api/drinks`, {
      method: 'GET',
      headers: { authorization: 'Bearer jwt-token' },
      body: undefined,
    })

    const input: DrinkInput = sampleInput
    mockJson(sampleDrink)
    await expect(api.createDrink(input)).resolves.toEqual(sampleDrink)
    expect(fetchMock).toHaveBeenLastCalledWith(`${BASE}/api/drinks`, {
      method: 'POST',
      headers: { authorization: 'Bearer jwt-token', 'content-type': 'application/json' },
      body: JSON.stringify(input),
    })

    const patched: Drink = { ...sampleDrink, count: 5 }
    mockJson(patched)
    await expect(api.patchDrink(12, { count: 5 })).resolves.toEqual(patched)
    expect(fetchMock).toHaveBeenLastCalledWith(`${BASE}/api/drinks/12`, {
      method: 'PATCH',
      headers: { authorization: 'Bearer jwt-token', 'content-type': 'application/json' },
      body: JSON.stringify({ count: 5 }),
    })

    mockJson(patched)
    await expect(api.refreshDrink(12)).resolves.toEqual(patched)
    expect(fetchMock).toHaveBeenLastCalledWith(`${BASE}/api/drinks/12/refresh`, {
      method: 'POST',
      headers: { authorization: 'Bearer jwt-token' },
      body: undefined,
    })

    mockNoContent()
    await expect(api.deleteDrink(12)).resolves.toBeUndefined()
    expect(fetchMock).toHaveBeenLastCalledWith(`${BASE}/api/drinks/12`, {
      method: 'DELETE',
      headers: { authorization: 'Bearer jwt-token' },
      body: undefined,
    })
  })

  it('preview, previewVivino, previewCaviste, scan och search med URL-kodade frågor', async () => {
    const preview: Preview = sampleInput

    mockJson(preview)
    await expect(api.preview('https://www.systembolaget.se/produkt/vin/barolo-7562401/?a=1&b=2')).resolves.toEqual(preview)
    expect(fetchMock).toHaveBeenLastCalledWith(
      `${BASE}/api/systembolaget?q=${encodeURIComponent('https://www.systembolaget.se/produkt/vin/barolo-7562401/?a=1&b=2')}`,
      {
        method: 'GET',
        headers: { authorization: 'Bearer jwt-token' },
        body: undefined,
      },
    )

    mockJson(preview)
    await expect(api.previewVivino('https://www.vivino.com/w/2379181?year=2021')).resolves.toEqual(preview)
    expect(fetchMock).toHaveBeenLastCalledWith(
      `${BASE}/api/vivino?q=${encodeURIComponent('https://www.vivino.com/w/2379181?year=2021')}`,
      {
        method: 'GET',
        headers: { authorization: 'Bearer jwt-token' },
        body: undefined,
      },
    )

    mockJson({ wines: [preview] })
    await expect(api.previewCaviste('https://www.caviste.se/produkt/cav0143/?x=1')).resolves.toEqual([preview])
    expect(fetchMock).toHaveBeenLastCalledWith(
      `${BASE}/api/caviste?q=${encodeURIComponent('https://www.caviste.se/produkt/cav0143/?x=1')}`,
      {
        method: 'GET',
        headers: { authorization: 'Bearer jwt-token' },
        body: undefined,
      },
    )

    const scanResult: ScanResult = {
      guess: {
        kind: 'wine',
        name: 'Barolo',
        producer: 'Colla',
        category: 'Rött vin',
        vintage: 2019,
        volume_ml: 750,
        alcohol: 14,
        ean: '7312040017034',
      },
      candidates: [],
      vivino_url: null,
      via: 'barcode',
    }
    mockJson(scanResult)
    await expect(api.scan({ ean: '7312040017034' })).resolves.toEqual(scanResult)
    expect(fetchMock).toHaveBeenLastCalledWith(`${BASE}/api/scan`, {
      method: 'POST',
      headers: { authorization: 'Bearer jwt-token', 'content-type': 'application/json' },
      body: JSON.stringify({ ean: '7312040017034' }),
    })

    const candidate: Candidate = {
      number: '7562401',
      name: 'Barolo',
      producer: 'Colla',
      category: 'Rött vin',
      volume_ml: 750,
      price: 299,
      vintage: 2019,
      image_url: null,
    }
    mockJson({ candidates: [candidate] })
    await expect(api.search('Côte & Rôtie')).resolves.toEqual([candidate])
    expect(fetchMock).toHaveBeenLastCalledWith(`${BASE}/api/search?q=${encodeURIComponent('Côte & Rôtie')}`, {
      method: 'GET',
      headers: { authorization: 'Bearer jwt-token' },
      body: undefined,
    })
  })

  it('listTastings, addTasting och deleteTasting', async () => {
    const tasting: Tasting = {
      id: 34,
      drink_id: 12,
      drunk_on: '2026-09-10',
      rating: 5,
      note: 'Toppen',
      created_at: '2026-09-10 20:00:00',
    }
    mockJson({ tastings: [tasting] })
    await expect(api.listTastings(12)).resolves.toEqual([tasting])
    expect(fetchMock).toHaveBeenLastCalledWith(`${BASE}/api/drinks/12/tastings`, {
      method: 'GET',
      headers: { authorization: 'Bearer jwt-token' },
      body: undefined,
    })

    const input: TastingInput = { drunk_on: '2026-09-10', rating: 5, note: 'Toppen' }
    mockJson(tasting)
    await expect(api.addTasting(12, input)).resolves.toEqual(tasting)
    expect(fetchMock).toHaveBeenLastCalledWith(`${BASE}/api/drinks/12/tastings`, {
      method: 'POST',
      headers: { authorization: 'Bearer jwt-token', 'content-type': 'application/json' },
      body: JSON.stringify(input),
    })

    mockNoContent()
    await expect(api.deleteTasting(12, 34)).resolves.toBeUndefined()
    expect(fetchMock).toHaveBeenLastCalledWith(`${BASE}/api/drinks/12/tastings/34`, {
      method: 'DELETE',
      headers: { authorization: 'Bearer jwt-token' },
      body: undefined,
    })
  })

  it('sipdeckCode, sipdeckLinks, revokeSipdeckLink och stock', async () => {
    const code: SipdeckCode = { code: 'ab12cd34', expires_at: '2026-10-06T20:10:00Z' }
    mockJson(code)
    await expect(api.sipdeckCode()).resolves.toEqual(code)
    expect(fetchMock).toHaveBeenLastCalledWith(`${BASE}/api/sipdeck/code`, {
      method: 'POST',
      headers: { authorization: 'Bearer jwt-token' },
      body: undefined,
    })

    const link: SipdeckLink = { id: 5, email: 'sipdeck@example.com', created_at: '2026-10-06 19:00:00' }
    mockJson({ links: [link] })
    await expect(api.sipdeckLinks()).resolves.toEqual([link])
    expect(fetchMock).toHaveBeenLastCalledWith(`${BASE}/api/sipdeck/links`, {
      method: 'GET',
      headers: { authorization: 'Bearer jwt-token' },
      body: undefined,
    })

    mockNoContent()
    await expect(api.revokeSipdeckLink(5)).resolves.toBeUndefined()
    expect(fetchMock).toHaveBeenLastCalledWith(`${BASE}/api/sipdeck/links/5`, {
      method: 'DELETE',
      headers: { authorization: 'Bearer jwt-token' },
      body: undefined,
    })

    const stock: Stock = { store: '0102', stock: 8, shelf: '14-04-03', in_assortment: true }
    mockJson(stock)
    await expect(api.stock(12, '0102')).resolves.toEqual(stock)
    expect(fetchMock).toHaveBeenLastCalledWith(`${BASE}/api/stock?drink=12&store=0102`, {
      method: 'GET',
      headers: { authorization: 'Bearer jwt-token' },
      body: undefined,
    })
  })
})
