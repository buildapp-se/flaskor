import { useState } from 'react'
import type { Drink, DrinkPatch, OpenLevel } from '../../shared/types.ts'
import { kr } from '../format.ts'
import { detailPath, navigate } from '../hash.ts'
import { IconArrow, IconChevron, IconMinus, IconPlus, IconSearch } from '../icons.tsx'
import { usePersisted } from '../persist.ts'
import { compare, DEFAULT_DIR, valueOf, type SortDir, type SortKey } from '../sort.ts'
import { useBulkActions, useStore } from '../store.tsx'
import { S } from '../strings.ts'
import { Bottle } from './Add.tsx'
import { CellarTable, type ColumnKey } from './CellarTable.tsx'

// Barskåpet: samma mönster som Källaren (sök, chips, sorterbar tabell, kryssrutor, massåtgärder),
// men filtrerat på spritsort istället för drick-år, som saknar mening för sprit.

const BAR_COLUMNS: ColumnKey[] = ['name', 'category', 'count', 'price', 'total', 'open_level', 'note', 'source']
const BAR_HIDDEN_AT_START: ColumnKey[] = ['note', 'source']
const BAR_SORTS = Object.keys(S.bar.sort) as ReadonlyArray<keyof typeof S.bar.sort>

function matchesSpirit(d: Drink, q: string): boolean {
  if (q === '') return true
  return [d.name, d.producer, d.category, d.style, d.note].some((f) => f?.toLowerCase().includes(q))
}

interface BarState {
  query: string
  category: string | null
  sort: SortKey
  dir: SortDir
  view: 'list' | 'table'
  showZero: boolean
}

const INITIAL: BarState = { query: '', category: null, sort: 'name', dir: 'asc', view: 'list', showZero: false }

export function Bar() {
  const { drinks, patch } = useStore()
  const { removeMany, rewishMany } = useBulkActions()
  const [state, set] = usePersisted<BarState>('flaskor.bar', INITIAL)
  const { query, category, sort, dir, view, showZero } = state
  const [showDepleted, setShowDepleted] = useState(false)
  if (drinks === null) return <div className="fl-muted">{S.loading}</div>

  const spirits = drinks.filter((d) => d.kind === 'spirit' && d.owned)
  const inStock = spirits.filter((d) => d.count > 0 || d.open_level !== null)
  const empty = (d: Drink) => d.count === 0 && d.open_level === null
  const present = [...new Set(inStock.map((d) => d.category ?? ''))]
  const categories = present.sort((a, b) => a.localeCompare(b, 'sv'))

  const q = query.trim().toLowerCase()
  const keep = (d: Drink) => matchesSpirit(d, q) && (category === null || (d.category ?? '') === category)
  const visible = inStock.filter(keep).sort(compare(sort, dir))
  const groups = categories.map((c) => ({ category: c, rows: visible.filter((d) => (d.category ?? '') === c) })).filter((g) => g.rows.length > 0)
  const depleted = visible.length === 0 ? [] : spirits.filter((d) => keep(d) && empty(d)).sort(compare('name', 'asc'))
  // Tabellen: alla ägda sorter, även tomma om "Visa slut" är på, i en platt lista.
  const tableRows = spirits.filter(keep).filter((d) => showZero || !empty(d)).sort(compare(sort, dir))
  const zeroHidden = showZero ? 0 : spirits.filter(keep).filter(empty).length
  const value = inStock.reduce((sum, d) => sum + valueOf(d), 0)

  function pickSort(key: SortKey) {
    set({ sort: key, dir: DEFAULT_DIR[key] ?? 'asc' })
  }
  function headerSort(key: SortKey) {
    if (key === sort) set({ dir: dir === 'asc' ? 'desc' : 'asc' })
    else pickSort(key)
  }

  return (
    <>
      <div className="fl-head">
        <h1>{S.bar.title}</h1>
        <span className="fl-head__count">
          {S.bar.kinds(inStock.length)} · {kr(value)}
        </span>
      </div>

      <div className="fl-toolbar">
        <label className="fl-search">
          <IconSearch />
          <input value={query} onChange={(e) => set({ query: e.target.value })} placeholder={S.bar.search} aria-label={S.bar.search} />
        </label>
        <div className="fl-sortrow">
          <span className="fl-chips__label">{S.bar.sortLabel}</span>
          <select className="fl-chip fl-chip--select" value={BAR_SORTS.includes(sort as (typeof BAR_SORTS)[number]) ? sort : 'name'} onChange={(e) => pickSort(e.target.value as SortKey)} aria-label={S.bar.sortLabel}>
            {BAR_SORTS.map((key) => (
              <option key={key} value={key}>
                {S.bar.sort[key]}
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
          <span className="fl-chips__label">{S.bar.show}</span>
          <button className="fl-chip" aria-pressed={category === null} onClick={() => set({ category: null })}>
            {S.bar.all}
          </button>
          {categories.map((c) => (
            <button key={c} className="fl-chip" aria-pressed={category === c} onClick={() => set({ category: category === c ? null : c })}>
              {c}
            </button>
          ))}
        </div>
      </div>

      {view === 'table' &&
        spirits.length > 0 &&
        (tableRows.length === 0 ? (
          <p className="fl-muted">{S.bar.noMatch}</p>
        ) : (
          <CellarTable
            rows={tableRows}
            query={q}
            sort={sort}
            dir={dir}
            onSort={headerSort}
            showZero={showZero}
            zeroHidden={zeroHidden}
            onShowZero={(v) => set({ showZero: v })}
            onRemove={removeMany}
            onRewish={rewishMany}
            columns={BAR_COLUMNS}
            hiddenAtStart={BAR_HIDDEN_AT_START}
            persistKey="flaskor.bar.columns"
            itemLabel={S.bar.kinds}
          />
        ))}
      {view === 'table' && spirits.length === 0 && <p className="fl-muted">{S.bar.empty}</p>}

      <div className="fl-bar__list" hidden={view === 'table'}>
        {spirits.length === 0 && <p className="fl-muted">{S.bar.empty}</p>}
        {spirits.length > 0 && groups.length === 0 && depleted.length === 0 && <p className="fl-muted">{S.bar.noMatch}</p>}
        {groups.map(({ category: c, rows }) => (
          <section key={c} className="fl-group">
            <div className="fl-group__head">
              <span className="fl-group__title">{c || S.bar.all}</span>
              <span className="fl-group__count">{S.bar.kinds(rows.length)}</span>
            </div>
            {rows.map((d) => (
              <SpiritCard key={d.id} drink={d} onPatch={(p) => patch(d.id, p)} />
            ))}
          </section>
        ))}
        {depleted.length > 0 && (
          <>
            <button className="fl-slut" aria-expanded={showDepleted} onClick={() => setShowDepleted((v) => !v)}>
              <IconChevron />
              {S.bar.depleted} · {S.bar.kinds(depleted.length)}
            </button>
            {showDepleted && depleted.map((d) => <SpiritCard key={d.id} drink={d} muted onPatch={(p) => patch(d.id, p)} />)}
          </>
        )}
      </div>
    </>
  )
}

export function SpiritCard({ drink, onPatch, muted = false }: { drink: Drink; onPatch: (p: DrinkPatch) => void; muted?: boolean }) {
  const level = drink.open_level
  const line = [drink.style ?? drink.category, drink.price_paid !== null ? kr(drink.price_paid) : null, S.bar.unopened(drink.count), level === null && !muted ? S.bar.noneOpen : null].filter(Boolean).join(' · ')

  function openOne() {
    onPatch({ count: drink.count - 1, open_level: 4 })
  }
  function step(delta: 1 | -1) {
    if (level === null) return
    const next = level + delta
    // Under en fjärdedel är flaskan slut: ingen öppnad kvar.
    onPatch({ open_level: next < 1 ? null : (Math.min(4, next) as OpenLevel) })
  }

  return (
    <div className={muted ? 'fl-card fl-spirit fl-spirit--muted' : 'fl-card fl-spirit'}>
      <div className="fl-spirit__top">
        <Bottle url={drink.image_url} size="sm" />
        <div className="fl-spirit__main" onClick={() => navigate(detailPath(drink.id))}>
          <div className="fl-spirit__name">{drink.name}</div>
          <div className="fl-spirit__line">{line}</div>
        </div>
        {drink.count > 0 && (
          <button className="fl-btn fl-btn--sm fl-btn--secondary" onClick={openOne}>
            {S.bar.openOne}
          </button>
        )}
        {muted && (
          <button className="fl-textbtn" onClick={() => onPatch({ owned: false, count: 0, open_level: null })}>
            {S.cellar.rewish}
          </button>
        )}
      </div>
      {level !== null && (
        <div className="fl-spirit__open">
          <div className="fl-field">
            <span className="fl-label">{S.bar.openBottle}</span>
            <div className="fl-level">
              <div className="fl-level__bar" aria-hidden="true">
                {[1, 2, 3, 4].map((q) => (
                  <span key={q} className={q <= level ? 'fl-level__seg fl-level__seg--on' : 'fl-level__seg'} />
                ))}
              </div>
              <span className="fl-level__word">{S.bar.level[level]}</span>
            </div>
          </div>
          <div className="fl-stepper fl-stepper--touch">
            <button type="button" onClick={() => step(-1)} aria-label="−">
              <IconMinus />
            </button>
            <button type="button" onClick={() => step(1)} disabled={level === 4} aria-label="+">
              <IconPlus />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
