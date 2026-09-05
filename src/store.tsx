import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { UnauthorizedError } from '../shared/errors.ts'
import type { Drink, DrinkInput, DrinkPatch } from '../shared/types.ts'
import { api } from './api.ts'
import { S } from './strings.ts'

// Servern är sanningen, klienten cachar senaste hämtning (beslut 11). Skrivningar går direkt till Workern.
const CACHE_KEY = 'flaskor.drinks'

export interface Store {
  drinks: Drink[] | null
  error: string | null
  reload(): Promise<void>
  patch(id: number, patch: DrinkPatch): Promise<void>
  add(input: DrinkInput): Promise<Drink>
  refresh(id: number): Promise<void>
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

export function StoreProvider({ onLocked, children }: { onLocked: () => void; children: ReactNode }) {
  const [drinks, setDrinks] = useState<Drink[] | null>(readCache)
  const [error, setError] = useState<string | null>(null)

  const keep = useCallback((list: Drink[]) => {
    setDrinks(list)
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(list))
    } catch {
      /* cachen är en bekvämlighet, inte ett krav */
    }
  }, [])

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
      keep(await api.listDrinks())
      setError(null)
    } catch (err) {
      fail(err)
    }
  }, [keep, fail])

  useEffect(() => {
    void reload()
  }, [reload])

  const replace = useCallback(
    (row: Drink) => {
      setDrinks((list) => {
        const next = list ? list.map((d) => (d.id === row.id ? row : d)) : [row]
        if (!list?.some((d) => d.id === row.id)) next.push(row)
        try {
          localStorage.setItem(CACHE_KEY, JSON.stringify(next))
        } catch {
          /* se ovan */
        }
        return next
      })
    },
    [],
  )

  const store = useMemo<Store>(
    () => ({
      drinks,
      error,
      reload,
      async patch(id, patch) {
        // Optimistiskt: raden ändras direkt, servern bekräftar eller listan laddas om.
        setDrinks((list) => list?.map((d) => (d.id === id ? { ...d, ...patch } : d)) ?? null)
        try {
          replace(await api.patchDrink(id, patch))
        } catch (err) {
          fail(err)
          await reload()
        }
      },
      async add(input) {
        const row = await api.createDrink(input)
        replace(row)
        return row
      },
      async refresh(id) {
        try {
          replace(await api.refreshDrink(id))
        } catch (err) {
          fail(err)
        }
      },
    }),
    [drinks, error, reload, replace, fail],
  )

  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>
}

export function useStore(): Store {
  const store = useContext(StoreContext)
  if (!store) throw new Error('useStore outside StoreProvider')
  return store
}
