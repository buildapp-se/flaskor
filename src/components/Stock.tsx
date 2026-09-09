import { useState } from 'react'
import { NotFoundError } from '../../shared/errors.ts'
import type { Drink, Stock as StockValue } from '../../shared/types.ts'
import { api } from '../api.ts'
import { usePersisted } from '../persist.ts'
import { S } from '../strings.ts'
import stores from '../stores.json'

// Lager i vald butik (BACKLOG P3, 2026-09-09). Butiken väljs en gång och sparas i localStorage.
// Saldot hämtas alltid på ett uttryckligt tryck, aldrig när en vy öppnas: annars hade Önskelistan
// skickat ett anrop per rad mot Systembolaget vid varje sidladdning.

export interface Store {
  id: string
  city: string
  address: string
}

const ALL = stores as Store[]
const KEY = 'flaskor.store'

/** Den valda butiken, delad av detaljvyn och Önskelistan. `pick` sparar den i webbläsaren. */
export function useSavedStore(): [Store | null, (id: string) => void] {
  const [saved, setSaved] = usePersisted<{ id: string | null }>(KEY, { id: null })
  return [ALL.find((s) => s.id === saved.id) ?? null, (id: string) => setSaved({ id })]
}

/** Sökruta över alla butiker. Visar träffar först när något är skrivet: 455 rader hjälper ingen. */
export function StorePicker({ onPick, autoFocus = false }: { onPick: (id: string) => void; autoFocus?: boolean }) {
  const [query, setQuery] = useState('')
  const q = query.trim().toLowerCase()
  const hits = q === '' ? [] : ALL.filter((s) => s.city.toLowerCase().includes(q) || s.address.toLowerCase().includes(q)).slice(0, 8)
  return (
    <>
      <input className="fl-input" placeholder={S.stock.search} value={query} onChange={(e) => setQuery(e.target.value)} autoFocus={autoFocus} />
      {hits.map((s) => (
        <button key={s.id} type="button" className="fl-stock__hit" onClick={() => onPick(s.id)}>
          {s.city} · {s.address}
        </button>
      ))}
    </>
  )
}

/** Saldot i klartext: "5 st, hylla 18-03-02", "Slut i butiken" eller "Förs inte i butiken". */
export function stockText(value: StockValue): string {
  if (!value.in_assortment) return S.stock.notCarried
  return value.stock === 0 ? S.stock.empty : S.stock.count(value.stock, value.shelf)
}

/** En rad har lagersaldo bara om den finns hos Systembolaget. */
export function hasStock(drink: Drink): boolean {
  return drink.source_kind === 'systembolaget' && drink.source_id !== null
}

/**
 * Saldot för en rad, hämtat på knapptryck. Systembolaget svarar 404 för varor butiken aldrig fört,
 * vilket är ett svar och inte ett fel: det visas som "Förs inte i butiken".
 */
export async function checkStock(drinkId: number, storeId: string): Promise<StockValue> {
  try {
    return await api.stock(drinkId, storeId)
  } catch (error) {
    if (error instanceof NotFoundError) return { store: storeId, stock: 0, shelf: null, in_assortment: false }
    throw error
  }
}

/** Butiksväljare plus saldo för en rad. Visas bara för rader med artikelnummer. */
export function Stock({ drink }: { drink: Drink }) {
  const [store, pickStore] = useSavedStore()
  const [picking, setPicking] = useState(false)
  const [value, setValue] = useState<StockValue | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!hasStock(drink)) return null

  async function check(id: string) {
    setBusy(true)
    setError(null)
    try {
      setValue(await checkStock(drink.id, id))
    } catch {
      setError(S.stock.failed)
    } finally {
      setBusy(false)
    }
  }

  if (picking || !store) {
    return (
      <div className="fl-stock">
        <div className="fl-label">{S.stock.pick}</div>
        <StorePicker
          autoFocus={picking}
          onPick={(id) => {
            pickStore(id)
            setPicking(false)
            void check(id)
          }}
        />
      </div>
    )
  }

  return (
    <div className="fl-stock">
      <div className="fl-stock__head">
        <span className="fl-label">{S.stock.label}</span>
        <button type="button" className="fl-textbtn" onClick={() => setPicking(true)}>
          {S.stock.change}
        </button>
      </div>
      <div className="fl-stock__store">
        {store.city} · {store.address}
      </div>
      {value === null ? (
        <button type="button" className="fl-btn fl-btn--secondary" disabled={busy} onClick={() => void check(store.id)}>
          {busy ? S.stock.loading : S.stock.check}
        </button>
      ) : (
        <div className="fl-stock__value">{stockText(value)}</div>
      )}
      {error && <div className="fl-error">{error}</div>}
      <div className="fl-small fl-muted">{S.stock.hint}</div>
    </div>
  )
}
