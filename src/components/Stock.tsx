import { useState } from 'react'
import { NotFoundError } from '../../shared/errors.ts'
import type { Drink, Stock as StockValue } from '../../shared/types.ts'
import { api } from '../api.ts'
import { usePersisted } from '../persist.ts'
import { S } from '../strings.ts'
import stores from '../stores.json'

// Lager i vald butik (BACKLOG P3, 2026-09-09). Butiken väljs en gång och sparas i localStorage; saldot hämtas på
// knapptryck, inte automatiskt. ponytail: ett anrop per tryck i stället för ett per rad i en lista, så Systembolaget
// aldrig får en skur av anrop och vi slipper köhantering. Listan i önskelistan finns inte av samma skäl.

interface Store {
  id: string
  city: string
  address: string
}

const ALL = stores as Store[]
const KEY = 'flaskor.store'

export function findStore(id: string | null): Store | null {
  return ALL.find((s) => s.id === id) ?? null
}

/** Butiksväljare plus saldo för en rad. Visas bara för rader med artikelnummer: bara de har lagersaldo. */
export function Stock({ drink }: { drink: Drink }) {
  const [saved, setSaved] = usePersisted<{ id: string | null }>(KEY, { id: null })
  const [picking, setPicking] = useState(false)
  const [query, setQuery] = useState('')
  const [value, setValue] = useState<StockValue | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const store = findStore(saved.id)

  if (drink.source_kind !== 'systembolaget' || !drink.source_id) return null

  async function check(id: string) {
    setBusy(true)
    setError(null)
    try {
      setValue(await api.stock(drink.id, id))
    } catch (err) {
      // Systembolaget svarar 404 för varor butiken aldrig fört. Det är ett svar, inte ett fel.
      if (err instanceof NotFoundError) setValue({ store: id, stock: 0, shelf: null, in_assortment: false })
      else setError(S.stock.failed)
    } finally {
      setBusy(false)
    }
  }

  function pick(id: string) {
    setSaved({ id })
    setPicking(false)
    setQuery('')
    void check(id)
  }

  if (picking || !store) {
    const q = query.trim().toLowerCase()
    const hits = q === '' ? [] : ALL.filter((s) => s.city.toLowerCase().includes(q) || s.address.toLowerCase().includes(q)).slice(0, 8)
    return (
      <div className="fl-stock">
        <div className="fl-label">{S.stock.pick}</div>
        <input className="fl-input" placeholder={S.stock.search} value={query} onChange={(e) => setQuery(e.target.value)} autoFocus={picking} />
        {hits.map((s) => (
          <button key={s.id} type="button" className="fl-stock__hit" onClick={() => pick(s.id)}>
            {s.city} · {s.address}
          </button>
        ))}
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
        <div className="fl-stock__value">{!value.in_assortment ? S.stock.notCarried : value.stock === 0 ? S.stock.empty : S.stock.count(value.stock, value.shelf)}</div>
      )}
      {error && <div className="fl-error">{error}</div>}
      <div className="fl-small fl-muted">{S.stock.hint}</div>
    </div>
  )
}
