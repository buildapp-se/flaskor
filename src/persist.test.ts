import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { usePersisted } from './persist.ts'

let state: unknown
let initialized = false
let memoized: { fn: unknown; deps: readonly unknown[] } | null = null

function resetHookMount() {
  state = undefined
  initialized = false
  memoized = null
}

vi.mock('react', () => ({
  useState: <T,>(init: T | (() => T)) => {
    if (!initialized) {
      state = typeof init === 'function' ? (init as () => T)() : init
      initialized = true
    }
    const setValue = (updater: T | ((prev: T) => T)) => {
      state = typeof updater === 'function' ? (updater as (prev: T) => T)(state as T) : updater
    }
    return [state as T, setValue]
  },
  useCallback: <T extends (...args: never[]) => unknown>(fn: T, deps: readonly unknown[]) => {
    if (!memoized || deps.length !== memoized.deps.length || deps.some((d, i) => !Object.is(d, memoized!.deps[i]))) {
      memoized = { fn, deps }
    }
    return memoized.fn as T
  },
}))

interface FilterState {
  query: string
  sort: 'price' | 'vintage'
  dueOnly: boolean
}

const INITIAL: FilterState = { query: '', sort: 'price', dueOnly: false }

describe('usePersisted', () => {
  let store: Map<string, string>

  beforeEach(() => {
    store = new Map<string, string>()
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => store.set(k, v),
      removeItem: (k: string) => store.delete(k),
      clear: () => store.clear(),
    })
    resetHookMount()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('ger standardvärdet när inget finns sparat i localStorage', () => {
    const [value] = usePersisted('flaskor.test', INITIAL)
    expect(value).toEqual(INITIAL)
  })

  it('lägger sparat värde ovanpå standardvärdet så nya fält får sitt standardvärde', () => {
    localStorage.setItem('flaskor.test', JSON.stringify({ sort: 'vintage' }))
    const [value] = usePersisted('flaskor.test', INITIAL)
    expect(value).toEqual({ query: '', sort: 'vintage', dueOnly: false })
  })

  it('faller tillbaka på standardvärdet vid trasig JSON i localStorage', () => {
    localStorage.setItem('flaskor.test', '{ trasig json')
    const [value] = usePersisted('flaskor.test', INITIAL)
    expect(value).toEqual(INITIAL)
  })

  it('uppdaterar state stegvis och sparar till localStorage', () => {
    const [, update] = usePersisted('flaskor.test', INITIAL)
    update({ query: 'barolo' })
    update({ dueOnly: true })

    const [current] = usePersisted('flaskor.test', INITIAL)
    expect(current).toEqual({ query: 'barolo', sort: 'price', dueOnly: true })
    expect(JSON.parse(localStorage.getItem('flaskor.test')!)).toEqual({
      query: 'barolo',
      sort: 'price',
      dueOnly: true,
    })

    // Nyladdning i ny komponent läser det sparade värdet.
    resetHookMount()
    const [reloaded] = usePersisted('flaskor.test', INITIAL)
    expect(reloaded).toEqual({ query: 'barolo', sort: 'price', dueOnly: true })
  })

  it('uppdaterar state även om localStorage kastar vid skrivning', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => null,
      setItem: () => {
        throw new Error('QuotaExceededError')
      },
    })
    const [, update] = usePersisted('flaskor.test', INITIAL)
    expect(() => update({ query: 'rioja' })).not.toThrow()

    const [current] = usePersisted('flaskor.test', INITIAL)
    expect(current).toEqual({ query: 'rioja', sort: 'price', dueOnly: false })
  })

  it('behåller update-funktionen för samma nyckel och byter mål när nyckeln ändras', () => {
    const [, updateA1] = usePersisted('flaskor.a', INITIAL)
    const [, updateA2] = usePersisted('flaskor.a', INITIAL)
    expect(updateA2).toBe(updateA1)

    const [, updateB] = usePersisted('flaskor.b', INITIAL)
    updateB({ query: 'chenin' })

    expect(localStorage.getItem('flaskor.a')).toBeNull()
    expect(JSON.parse(localStorage.getItem('flaskor.b')!)).toEqual({
      query: 'chenin',
      sort: 'price',
      dueOnly: false,
    })
  })
})
