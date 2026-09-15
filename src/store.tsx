import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { UnauthorizedError } from '../shared/errors.ts'
import type { Drink, DrinkInput, DrinkPatch } from '../shared/types.ts'
import { api } from './api.ts'
import { localBackend, localSaves, type Backend } from './local.ts'
import { S } from './strings.ts'

// Servern är sanningen, klienten cachar senaste hämtning (beslut 11). Skrivningar går direkt till Workern.
const CACHE_KEY = 'flaskor.drinks'
/** Ångra-raden (BACKLOG 40) lever så här länge efter en import eller en massåtgärd. Bara i minnet: en omladdning tar bort den. */
const UNDO_MS = 10 * 60 * 1000

export interface Store {
  /** Gästläget (2026-09-15): allt sparas i webbläsaren, se src/local.ts. */
  guest: boolean
  /** Där rader och avsmakningar läses och skrivs: Workern, eller localStorage för en gäst. */
  backend: Backend
  /** Till inloggningen. Bara meningsfull för en gäst; en inloggad är redan där. */
  signIn(): void
  /** Påminnelsen efter en lokal sparning, eller null. */
  notice: string | null
  dismissNotice(): void
  drinks: Drink[] | null
  error: string | null
  reload(): Promise<void>
  patch(id: number, patch: DrinkPatch): Promise<void>
  add(input: DrinkInput): Promise<Drink>
  refresh(id: number): Promise<void>
  remove(id: number): Promise<void>
  /** Texten på ångra-raden, eller null när det inte finns något att ångra. */
  undo: string | null
  setUndo(label: string, run: () => Promise<void>): void
  runUndo(): Promise<void>
  dismissUndo(): void
}

const StoreContext = createContext<Store | null>(null)

function readCache(): Drink[] | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    return raw ? (JSON.parse(raw) as Drink[]) : null
  } catch {
    return null
  }
}

function writeCache(list: Drink[]): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(list))
  } catch {
    /* cachen är en bekvämlighet, inte ett krav */
  }
}

/** Påminnelsen visas efter första sparningen och sedan var femte, så den märks utan att bli brus. */
const remindAt = (saves: number) => saves === 1 || saves % 5 === 0

export function StoreProvider({ onLocked, children, guest = false, onSignIn = () => {} }: { onLocked: () => void; children: ReactNode; guest?: boolean; onSignIn?: () => void }) {
  const backend: Backend = guest ? localBackend : api
  // En gäst har ingen servercache: localStorage är källan.
  const [drinks, setDrinks] = useState<Drink[] | null>(() => (guest ? null : readCache()))
  const [notice, setNotice] = useState<string | null>(null)
  useEffect(() => {
    if (notice === null) return
    const timer = setTimeout(() => setNotice(null), 10_000)
    return () => clearTimeout(timer)
  }, [notice])
  const [error, setError] = useState<string | null>(null)
  const [undo, setUndoLabel] = useState<string | null>(null)
  const undoFn = useRef<(() => Promise<void>) | null>(null)
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const keep = useCallback(
    (list: Drink[]) => {
      setDrinks(list)
      if (!guest) writeCache(list)
    },
    [guest],
  )

  /** Ändrar listan utifrån dess senaste värde, aldrig ett gammalt: flera anrop i rad (massåtgärder) ska inte skriva över varandra. */
  const mutate = useCallback((fn: (list: Drink[]) => Drink[]) => {
    setDrinks((list) => {
      const next = fn(list ?? [])
      if (!guest) writeCache(next)
      return next
    })
  }, [guest])

  const fail = useCallback(
    (err: unknown) => {
      if (err instanceof UnauthorizedError) {
        onLocked()
        return
      }
      setError(err instanceof Error && err.name === 'TransientError' ? S.error.offline : S.error.generic)
    },
    [onLocked],
  )

  const reload = useCallback(async () => {
    try {
      keep(await backend.listDrinks())
      setError(null)
    } catch (err) {
      fail(err)
    }
  }, [keep, fail, backend])

  // Hämta om vid start och varje gång fliken får fokus igen: två användare delar listan (beslut 2, 11).
  useEffect(() => {
    void reload()
    const onVisible = () => document.visibilityState === 'visible' && void reload()
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
    }
  }, [reload])

  const replace = useCallback((row: Drink) => mutate((list) => (list.some((d) => d.id === row.id) ? list.map((d) => (d.id === row.id ? row : d)) : [...list, row])), [mutate])

  const dismissUndo = useCallback(() => {
    if (undoTimer.current) clearTimeout(undoTimer.current)
    undoTimer.current = null
    undoFn.current = null
    setUndoLabel(null)
  }, [])

  const store = useMemo<Store>(
    () => ({
      guest,
      backend,
      signIn: onSignIn,
      notice,
      dismissNotice: () => setNotice(null),
      drinks,
      error,
      reload,
      async patch(id, patch) {
        // Optimistiskt: raden ändras direkt, servern bekräftar eller listan laddas om.
        mutate((list) => list.map((d) => (d.id === id ? { ...d, ...patch } : d)))
        try {
          replace(await backend.patchDrink(id, patch))
        } catch (err) {
          fail(err)
          await reload()
        }
      },
      async add(input) {
        const row = await backend.createDrink(input)
        replace(row)
        if (guest && remindAt(localSaves())) setNotice(S.guest.saved)
        return row
      },
      async refresh(id) {
        try {
          if (guest) throw new Error('refresh requires an account')
          replace(await api.refreshDrink(id))
        } catch (err) {
          fail(err)
        }
      },
      async remove(id) {
        // Raden försvinner direkt; misslyckas servern laddas listan om och raden kommer tillbaka.
        mutate((list) => list.filter((d) => d.id !== id))
        try {
          await backend.deleteDrink(id)
        } catch (err) {
          fail(err)
          await reload()
        }
      },
      undo,
      setUndo(label, run) {
        dismissUndo()
        undoFn.current = run
        setUndoLabel(label)
        undoTimer.current = setTimeout(dismissUndo, UNDO_MS)
      },
      async runUndo() {
        const fn = undoFn.current
        dismissUndo()
        if (!fn) return
        try {
          await fn()
        } catch (err) {
          fail(err)
        }
        await reload()
      },
      dismissUndo,
    }),
    [guest, backend, onSignIn, notice, drinks, error, reload, replace, fail, mutate, undo, dismissUndo],
  )

  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>
}

export function useStore(): Store {
  const store = useContext(StoreContext)
  if (!store) throw new Error('useStore outside StoreProvider')
  return store
}

/** Massåtgärder ur tabellen (BACKLOG 40), delade mellan Källaren och Barskåpet. Båda med ångra i tio minuter. */
export function useBulkActions() {
  const { patch, remove, add, setUndo } = useStore()
  async function removeMany(rows: Drink[]) {
    for (const d of rows) await remove(d.id)
    setUndo(S.undo.removed(rows.length), async () => {
      for (const { id: _id, household_id: _h, created_at: _c, updated_at: _u, ...input } of rows) await add(input)
    })
  }
  async function rewishMany(rows: Drink[]) {
    for (const d of rows) await patch(d.id, { owned: false, count: 0, open_level: null })
    setUndo(S.undo.rewished(rows.length), async () => {
      for (const d of rows) await patch(d.id, { owned: true, count: d.count, open_level: d.open_level })
    })
  }
  return { removeMany, rewishMany }
}
