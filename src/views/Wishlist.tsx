import { useEffect, useRef, useState } from 'react'
import type { Drink, Kind } from '../../shared/types.ts'
import { articleNo, kr } from '../format.ts'
import { detailPath, navigate } from '../hash.ts'
import { Rating } from '../components/Rating.tsx'
import { IconArrow, IconExternal, IconMinus, IconPlus, IconSearch } from '../icons.tsx'
import { usePersisted } from '../persist.ts'
import { compare, DEFAULT_DIR, type SortDir, type SortKey } from '../sort.ts'
import { useBulkActions, useStore } from '../store.tsx'
import { S } from '../strings.ts'
import { Bottle } from './Add.tsx'
import { matches } from './Cellar.tsx'
import { CellarTable, type ColumnKey } from './CellarTable.tsx'

// Önskelistan (design §3, beslut 29). Ombyggd 2026-09-07 i samma stil som Källaren/Barskåpet:
// sök, sortering (billigast först som standard), kind- och kategorichips, lista/tabell-växel.
// Filter och sortering överlever sidbyte, precis som där (usePersisted).

const WISH_COLUMNS: ColumnKey[] = ['name', 'vintage', 'category', 'country', 'price', 'vivino', 'source']
const WISH_HIDDEN_AT_START: ColumnKey[] = ['vintage', 'country']
const WISH_SORTS = Object.keys(S.wishlist.sort) as ReadonlyArray<keyof typeof S.wishlist.sort>

interface WishlistState {
  query: string
  kind: Kind | null
  category: string | null
  sort: SortKey
  dir: SortDir
  view: 'list' | 'table'
}

const INITIAL: WishlistState = { query: '', kind: null, category: null, sort: 'price', dir: 'asc', view: 'list' }

export function Wishlist() {
  const { drinks, patch } = useStore()
  const { removeMany } = useBulkActions()
  const [state, set] = usePersisted<WishlistState>('flaskor.wishlist', INITIAL)
  const { query, kind, category, sort, dir, view } = state
  const [buying, setBuying] = useState<Drink | null>(null)

  if (drinks === null) return <div className="fl-muted">{S.loading}</div>
  const wished = drinks.filter((d) => !d.owned)
  // Kategorichips beror på vilket kind som är valt: sprit ger whiskey/rom/gin, öl ger IPA/lager, osv.
  const byKind = wished.filter((d) => kind === null || d.kind === kind)
  const categories = [...new Set(byKind.map((d) => d.category).filter((c): c is string => c !== null))].sort((a, b) => a.localeCompare(b, 'sv'))

  const q = query.trim().toLowerCase()
  const keep = (d: Drink) => matches(d, q) && (kind === null || d.kind === kind) && (category === null || d.category === category)
  const visible = wished.filter(keep).sort(compare(sort, dir))

  function pickSort(key: SortKey) {
    set({ sort: key, dir: DEFAULT_DIR[key] ?? 'asc' })
  }
  function headerSort(key: SortKey) {
    if (key === sort) set({ dir: dir === 'asc' ? 'desc' : 'asc' })
    else pickSort(key)
  }

  return (
    <div className="fl-wishlist">
      <div className="fl-head">
        <h1>{S.wishlist.title}</h1>
        <span className="fl-head__count">{S.wishlist.items(wished.length)}</span>
      </div>

      <div className="fl-toolbar">
        <label className="fl-search">
          <IconSearch />
          <input value={query} onChange={(e) => set({ query: e.target.value })} placeholder={S.wishlist.search} aria-label={S.wishlist.search} />
        </label>
        <div className="fl-sortrow">
          <span className="fl-chips__label">{S.wishlist.sortLabel}</span>
          <select className="fl-chip fl-chip--select" value={WISH_SORTS.includes(sort as (typeof WISH_SORTS)[number]) ? sort : 'price'} onChange={(e) => pickSort(e.target.value as SortKey)} aria-label={S.wishlist.sortLabel}>
            {WISH_SORTS.map((key) => (
              <option key={key} value={key}>
                {S.wishlist.sort[key]}
              </option>
            ))}
          </select>
          <button className="fl-chip fl-chip--icon" title={S.cellar.sortDir[dir]} aria-label={S.cellar.sortDir[dir]} onClick={() => set({ dir: dir === 'asc' ? 'desc' : 'asc' })}>
            <IconArrow dir={dir} />
          </button>
          <div className="fl-seg" role="group">
            {(['list', 'table'] as const).map((v) => (
              <button key={v} type="button" aria-pressed={view === v} onClick={() => set({ view: v })}>
                {S.cellar.view[v]}
              </button>
            ))}
          </div>
        </div>
        <div className="fl-chips fl-chips--scroll">
          <span className="fl-chips__label">{S.wishlist.show}</span>
          <button className="fl-chip" aria-pressed={kind === null} onClick={() => set({ kind: null, category: null })}>
            {S.wishlist.all}
          </button>
          {(['wine', 'spirit', 'beer'] as const).map((k) => (
            <button key={k} className="fl-chip" aria-pressed={kind === k} onClick={() => set({ kind: kind === k ? null : k, category: null })}>
              {S.wishlist[k]}
            </button>
          ))}
          {categories.length > 0 && <span className="fl-chips__sep" />}
          {categories.map((c) => (
            <button key={c} className="fl-chip" aria-pressed={category === c} onClick={() => set({ category: category === c ? null : c })}>
              {S.categoryShort[c] ?? c}
            </button>
          ))}
        </div>
      </div>

      {view === 'table' &&
        wished.length > 0 &&
        (visible.length === 0 ? (
          <p className="fl-muted">{S.wishlist.noMatch}</p>
        ) : (
          <CellarTable rows={visible} query={q} sort={sort} dir={dir} onSort={headerSort} onRemove={removeMany} columns={WISH_COLUMNS} hiddenAtStart={WISH_HIDDEN_AT_START} persistKey="flaskor.wishlist.columns" itemLabel={S.wishlist.items} />
        ))}
      {view === 'table' && wished.length === 0 && <p className="fl-muted">{S.wishlist.empty}</p>}

      <div hidden={view === 'table'}>
        {wished.length === 0 && <p className="fl-muted">{S.wishlist.empty}</p>}
        {wished.length > 0 && visible.length === 0 && <p className="fl-muted">{S.wishlist.noMatch}</p>}
        {visible.length > 0 && (
          <div className="fl-card fl-list">
            {visible.map((d) => (
              <WishRow key={d.id} drink={d} onBuy={() => setBuying(d)} />
            ))}
          </div>
        )}
      </div>

      {buying && (
        <BoughtSheet
          drink={buying}
          onCancel={() => setBuying(null)}
          onConfirm={async (count, price) => {
            setBuying(null)
            // Sprit börjar oöppnad; en öppnad flaska registreras i Barskåpet.
            await patch(buying.id, { owned: true, count, price_paid: price })
          }}
        />
      )}
    </div>
  )
}

function WishRow({ drink, onBuy }: { drink: Drink; onBuy: () => void }) {
  const gone = drink.availability === 'discontinued'
  const price = drink.price_current ?? drink.price_paid
  const source = drink.source_kind === 'systembolaget' ? S.wishlist.availability[drink.availability] : drink.source_kind === 'caviste' ? S.wishlist.availability.unknown : null
  // Numret är en länk till produktsidan: där minns Systembolaget din valda butik, så lagret för den syns direkt.
  const number = drink.source_id ? (drink.source_kind === 'systembolaget' ? `${S.wishlist.number} ${articleNo(drink.source_id)}` : drink.source_kind === 'caviste' ? `CAV ${drink.source_id}` : null) : null
  const name = drink.vintage ? `${drink.name} ${drink.vintage}` : drink.name
  return (
    <div className={gone ? 'fl-wish fl-wish--gone' : 'fl-wish'}>
      <Bottle url={drink.image_url} size="sm" />
      <div className="fl-wish__main" onClick={(e) => !(e.target as HTMLElement).closest('a') && navigate(detailPath(drink.id))}>
        <div className="fl-wish__name">{name}</div>
        <div className="fl-wish__line">
          {price !== null && <span className="fl-wish__price">{kr(price)}</span>}
          {price !== null && ' · '}
          {source}
          {source && number && ' · '}
          {number &&
            (drink.source_url ? (
              <a className="fl-wish__link" href={drink.source_url} target="_blank" rel="noreferrer">
                {number}
                <IconExternal />
              </a>
            ) : (
              number
            ))}
          <Rating drink={drink} count />
        </div>
      </div>
      <button className={gone ? 'fl-btn fl-btn--sm fl-btn--secondary' : 'fl-btn fl-btn--sm fl-btn--primary'} onClick={onBuy}>
        {S.wishlist.bought}
      </button>
    </div>
  )
}

function BoughtSheet({ drink, onCancel, onConfirm }: { drink: Drink; onCancel: () => void; onConfirm: (count: number, price: number | null) => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  const [count, setCount] = useState(1)
  const [price, setPrice] = useState(drink.price_current === null ? '' : String(drink.price_current))
  const spirit = drink.kind === 'spirit'

  useEffect(() => {
    ref.current?.showModal()
  }, [])

  return (
    <dialog ref={ref} className="fl-sheet" onClose={onCancel} onClick={(e) => e.target === ref.current && onCancel()}>
      <div className="fl-sheet__body">
        <div className="fl-stack-4">
          <div className="fl-label">{S.wishlist.sheet.title}</div>
          <div className="fl-sheet__name">{drink.vintage ? `${drink.name} ${drink.vintage}` : drink.name}</div>
          <div className="fl-small fl-muted">{spirit ? S.wishlist.sheet.toBar : S.wishlist.sheet.toCellar}</div>
        </div>
        <div className="fl-sheet__fields">
          <label className="fl-field">
            <span className="fl-label">{S.wishlist.sheet.count}</span>
            <div className="fl-counter">
              <button type="button" onClick={() => setCount((c) => Math.max(1, c - 1))} aria-label="−">
                <IconMinus />
              </button>
              <span>{count}</span>
              <button type="button" onClick={() => setCount((c) => c + 1)} aria-label="+">
                <IconPlus />
              </button>
            </div>
          </label>
          <label className="fl-field">
            <span className="fl-label">{S.wishlist.sheet.price}</span>
            <div className="fl-money">
              <input inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} />
              <span>{S.units.kr}</span>
            </div>
          </label>
        </div>
        <div className="fl-sheet__actions">
          <button type="button" className="fl-btn fl-btn--secondary" onClick={onCancel}>
            {S.wishlist.sheet.cancel}
          </button>
          <button type="button" className="fl-btn fl-btn--primary" onClick={() => onConfirm(count, price.trim() === '' ? null : Number(price.replace(',', '.')))}>
            {spirit ? S.wishlist.sheet.confirmBar : S.wishlist.sheet.confirmCellar}
          </button>
        </div>
      </div>
    </dialog>
  )
}
