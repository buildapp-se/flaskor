import { useState, type ReactNode } from 'react'
import type { Drink } from '../../shared/types.ts'
import { windowState } from '../../shared/window.ts'
import { Highlight } from '../components/Highlight.tsx'
import { Pill } from '../components/Pill.tsx'
import { Rating } from '../components/Rating.tsx'
import { articleNo, kr, yearRange } from '../format.ts'
import { detailPath, navigate } from '../hash.ts'
import { IconArrow } from '../icons.tsx'
import { usePersisted } from '../persist.ts'
import { priceOf, valueOf, type SortDir, type SortKey } from '../sort.ts'
import { S } from '../strings.ts'

// Tabellvyn: Excel-arket som det såg ut, en rad per vin, kolumnrubriker som sorterar upp och ner vid klick,
// sidscroll när den inte får plats. Kolumner bockas i och ur i chipraden ovanför och valet sparas.

export type ColumnKey = SortKey | 'note' | 'source'

interface Column {
  key: ColumnKey
  numeric?: boolean
  wide?: boolean
  render: (d: Drink, q: string) => ReactNode
}

const text = (value: string | null, q: string): ReactNode => (value === null ? '' : <Highlight text={value} query={q} />)

const COLUMNS: ReadonlyArray<Column> = [
  { key: 'name', render: (d, q) => text(d.name, q) },
  { key: 'vintage', numeric: true, render: (d) => d.vintage ?? '' },
  { key: 'category', render: (d) => S.categoryShort[d.category ?? ''] ?? d.category ?? '' },
  { key: 'country', render: (d, q) => text(d.country, q) },
  { key: 'region', render: (d, q) => text(d.region, q) },
  { key: 'grapes', wide: true, render: (d, q) => text(d.grapes, q) },
  { key: 'count', numeric: true, render: (d) => d.count },
  { key: 'price', numeric: true, render: (d) => (priceOf(d) === null ? '' : kr(priceOf(d)!)) },
  { key: 'total', numeric: true, render: (d) => (priceOf(d) === null ? '' : kr(valueOf(d))) },
  {
    key: 'windowEnd',
    render: (d) => (
      <span className="fl-table__window">
        <Pill state={windowState(d.drink_from, d.drink_to)} />
        {yearRange(d.drink_from, d.drink_to)}
      </span>
    ),
  },
  { key: 'serve_temp', numeric: true, render: (d) => d.serve_temp ?? '' },
  { key: 'decant', numeric: true, render: (d) => d.decant_hours ?? '' },
  { key: 'vivino', numeric: true, render: (d) => <Rating drink={d} count /> },
  { key: 'food', wide: true, render: (d, q) => text(d.food, q) },
  { key: 'open_level', render: (d) => (d.open_level === null ? '' : S.bar.level[d.open_level]) },
  { key: 'note', wide: true, render: (d, q) => text(d.note, q) },
  {
    key: 'source',
    render: (d) =>
      d.source_url ? (
        <a href={d.source_url} target="_blank" rel="noreferrer">
          {d.source_kind === 'caviste' ? `CAV ${d.source_id ?? ''}` : d.source_id ? articleNo(d.source_id) : S.detail.systembolaget}
        </a>
      ) : (
        ''
      ),
  },
]

const SORTABLE = new Set<ColumnKey>(['name', 'vintage', 'category', 'country', 'region', 'grapes', 'count', 'price', 'total', 'windowEnd', 'serve_temp', 'decant', 'vivino', 'food', 'open_level'])

/** Kolumner dolda från start: de som sällan avgör något vid en blick. */
const HIDDEN_AT_START: ColumnKey[] = ['region', 'grapes', 'decant', 'note', 'source']

/** Källarens kolumner, oförändrat: alla utom open_level (sprit-fältet). */
const WINE_COLUMNS: ColumnKey[] = COLUMNS.map((c) => c.key).filter((k) => k !== 'open_level')

export function CellarTable({
  rows,
  query,
  sort,
  dir,
  onSort,
  showZero,
  zeroHidden,
  onShowZero,
  onRemove,
  onRewish,
  columns = WINE_COLUMNS,
  hiddenAtStart = HIDDEN_AT_START,
  persistKey = 'flaskor.columns',
  itemLabel = S.cellar.wines,
}: {
  rows: Drink[]
  query: string
  sort: SortKey
  dir: SortDir
  onSort: (key: SortKey) => void
  showZero: boolean
  zeroHidden: number
  onShowZero: (v: boolean) => void
  onRemove: (rows: Drink[]) => void
  onRewish: (rows: Drink[]) => void
  columns?: ColumnKey[]
  hiddenAtStart?: ColumnKey[]
  persistKey?: string
  itemLabel?: (n: number) => string
}) {
  const available = COLUMNS.filter((c) => columns.includes(c.key))
  const [{ hidden }, set] = usePersisted<{ hidden: ColumnKey[] }>(persistKey, { hidden: hiddenAtStart })
  // Kryssrutor för massåtgärder (BACKLOG 40): markeringen lever bara tills vyn byts.
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const chosen = rows.filter((d) => selected.has(d.id))
  const allChecked = rows.length > 0 && chosen.length === rows.length
  function toggle(id: number) {
    setSelected((s) => {
      const next = new Set(s)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }
  function act(fn: (rows: Drink[]) => void) {
    fn(chosen)
    setSelected(new Set())
  }
  const shown = available.filter((c) => !hidden.includes(c.key))
  const bottles = rows.reduce((sum, d) => sum + d.count, 0)
  const value = rows.reduce((sum, d) => sum + valueOf(d), 0)

  return (
    <div className="fl-tableview">
      <div className="fl-chips fl-chips--scroll fl-chips--wrap">
        <button className="fl-chip fl-chip--xs" aria-pressed={showZero} onClick={() => onShowZero(!showZero)}>
          {showZero ? S.cellar.showZeroOn : S.cellar.showZeroOff(zeroHidden)}
        </button>
        <span className="fl-chips__sep" />
        <span className="fl-chips__label">{S.cellar.columns}</span>
        {available.map((c) => (
          <button key={c.key} className="fl-chip fl-chip--xs" aria-pressed={!hidden.includes(c.key)} onClick={() => set({ hidden: hidden.includes(c.key) ? hidden.filter((k) => k !== c.key) : [...hidden, c.key] })}>
            {S.column[c.key]}
          </button>
        ))}
      </div>
      {chosen.length > 0 && (
        <div className="fl-bulk">
          <strong>{S.bulk.selected(chosen.length)}</strong>
          <button className="fl-textbtn" onClick={() => act(onRemove)}>
            {S.bulk.remove}
          </button>
          <button className="fl-textbtn" onClick={() => act(onRewish)}>
            {S.bulk.rewish}
          </button>
          <button className="fl-textbtn" onClick={() => setSelected(new Set())}>
            {S.bulk.clear}
          </button>
        </div>
      )}
      <div className="fl-card fl-tablewrap">
        <table className="fl-table">
          <thead>
            <tr>
              <th className="fl-table__check">
                <input type="checkbox" checked={allChecked} aria-label={S.bulk.all} onChange={() => setSelected(allChecked ? new Set() : new Set(rows.map((d) => d.id)))} />
              </th>
              {shown.map((c) => (
                <th key={c.key} className={c.numeric ? 'fl-table__num' : undefined} aria-sort={sort === c.key ? (dir === 'asc' ? 'ascending' : 'descending') : undefined}>
                  {SORTABLE.has(c.key) ? (
                    <button type="button" className="fl-table__sort" onClick={() => onSort(c.key as SortKey)}>
                      {S.column[c.key]}
                      {sort === c.key && <IconArrow dir={dir} />}
                    </button>
                  ) : (
                    S.column[c.key]
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((d) => (
              <tr key={d.id} className={d.count === 0 && d.open_level === null ? 'fl-table__row fl-table__row--muted' : 'fl-table__row'} onClick={(e) => !(e.target as HTMLElement).closest('a, input') && navigate(detailPath(d.id))}>
                <td className="fl-table__check">
                  <input type="checkbox" checked={selected.has(d.id)} onChange={() => toggle(d.id)} />
                </td>
                {shown.map((c) => (
                  <td key={c.key} className={c.numeric ? 'fl-table__num' : c.wide ? 'fl-table__wide' : undefined}>
                    {c.render(d, query)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td />
              {shown.map((c) => (
                <td key={c.key} className={c.numeric ? 'fl-table__num' : undefined}>
                  {c.key === 'name' ? itemLabel(rows.length) : c.key === 'count' ? bottles : c.key === 'total' ? kr(value) : ''}
                </td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}
