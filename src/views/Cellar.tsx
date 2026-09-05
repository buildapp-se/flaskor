import { useMemo, useState } from 'react'
import type { Drink, DrinkPatch, WindowState } from '../../shared/types.ts'
import { windowState } from '../../shared/window.ts'
import { DrinkRow } from '../components/DrinkRow.tsx'
import { Pill } from '../components/Pill.tsx'
import { IconChevron, IconMinus, IconPlus, IconSearch } from '../icons.tsx'
import { useStore } from '../store.tsx'
import { S } from '../strings.ts'

// Källaren (beslut 24, 28): ägda viner grupperade på kategori, sorterade på pris, sök och chips, "Dags att dricka: N".
type Sort = 'price' | 'vintage' | 'windowEnd'

/** Kategoriernas ordning i listan: rött först, som i designen; okända sist i bokstavsordning. */
const CATEGORY_ORDER = ['Rött vin', 'Vitt vin', 'Rosévin', 'Mousserande vin']

function categoryRank(category: string): number {
  const i = CATEGORY_ORDER.indexOf(category)
  return i === -1 ? CATEGORY_ORDER.length : i
}

function matches(d: Drink, q: string): boolean {
  if (q === '') return true
  return [d.name, d.producer, d.grapes, d.region, d.country, d.vintage === null ? null : String(d.vintage)].some((f) => f?.toLowerCase().includes(q))
}

const SORTERS: Record<Sort, (a: Drink, b: Drink) => number> = {
  price: (a, b) => (b.price_paid ?? b.price_current ?? 0) - (a.price_paid ?? a.price_current ?? 0),
  vintage: (a, b) => (a.vintage ?? 9999) - (b.vintage ?? 9999),
  windowEnd: (a, b) => (a.drink_to ?? 9999) - (b.drink_to ?? 9999),
}

const DUE: ReadonlyArray<WindowState> = ['drink', 'soon']

export function Cellar() {
  const { drinks, patch } = useStore()
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<string | null>(null)
  const [country, setCountry] = useState<string | null>(null)
  const [dueOnly, setDueOnly] = useState(false)
  const [sort, setSort] = useState<Sort>('price')
  const [showDepleted, setShowDepleted] = useState(false)

  const wines = useMemo(() => (drinks ?? []).filter((d) => d.kind === 'wine' && d.owned), [drinks])
  const inStock = wines.filter((d) => d.count > 0)
  const depleted = wines.filter((d) => d.count === 0).sort(SORTERS.price)
  const categories = [...new Set(inStock.map((d) => d.category ?? ''))].sort((a, b) => categoryRank(a) - categoryRank(b) || a.localeCompare(b, 'sv'))
  const countries = [...new Set(inStock.map((d) => d.country).filter((c): c is string => c !== null))].sort((a, b) => a.localeCompare(b, 'sv'))
  // "Dags att dricka" räknar viner (rader) inne i fönstret eller i dess sista år, inte flaskor.
  const due = inStock.filter((d) => DUE.includes(windowState(d.drink_from, d.drink_to))).length
  const bottles = inStock.reduce((sum, d) => sum + d.count, 0)

  const q = query.trim().toLowerCase()
  const visible = inStock
    .filter((d) => matches(d, q))
    .filter((d) => category === null || (d.category ?? '') === category)
    .filter((d) => country === null || d.country === country)
    .filter((d) => !dueOnly || DUE.includes(windowState(d.drink_from, d.drink_to)))
    .sort(SORTERS[sort])
  const groups = categories.map((c) => ({ category: c, rows: visible.filter((d) => (d.category ?? '') === c) })).filter((g) => g.rows.length > 0)

  if (drinks === null) return <div className="fl-muted">{S.loading}</div>

  return (
    <>
      <div className="fl-head">
        <h1>{S.cellar.title}</h1>
        <div className="fl-head__aside fl-desktop-only">
          <Pill state="drink" />
          <span>
            {S.cellar.dueLabel} <strong className="fl-nums">{due}</strong>
          </span>
        </div>
        <span className="fl-head__count fl-mobile-only">{S.bottles(bottles)}</span>
      </div>

      <div className="fl-toolbar">
        <label className="fl-search">
          <IconSearch />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={S.cellar.search} aria-label={S.cellar.search} />
        </label>
        <div className="fl-chips fl-chips--scroll">
          <button className="fl-chip" aria-pressed={category === null} onClick={() => setCategory(null)}>
            {S.cellar.all}
          </button>
          {categories.map((c) => (
            <button key={c} className="fl-chip" aria-pressed={category === c} onClick={() => setCategory(category === c ? null : c)}>
              {S.categoryShort[c] ?? c}
            </button>
          ))}
          {countries.length > 0 && <span className="fl-chips__sep" />}
          {countries.map((c) => (
            <button key={c} className="fl-chip" aria-pressed={country === c} onClick={() => setCountry(country === c ? null : c)}>
              {c}
            </button>
          ))}
          <span className="fl-chips__sep" />
          <button className="fl-chip" aria-pressed={dueOnly} onClick={() => setDueOnly((v) => !v)}>
            {S.cellar.drinkNow}
          </button>
          {/* Bytbar sortering (beslut 28) saknar artboard: en select i chip-form sist i raden. */}
          <select className="fl-chip fl-chip--select" value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label={S.cellar.sortLabel}>
            {(Object.keys(S.cellar.sort) as Sort[]).map((key) => (
              <option key={key} value={key}>
                {S.cellar.sort[key]}
              </option>
            ))}
          </select>
        </div>
        <div className="fl-due fl-mobile-only">
          <Pill state="drink" />
          {S.cellar.dueLabel} <strong className="fl-nums">{due}</strong>
        </div>
      </div>

      <div className="fl-groups">
        {wines.length === 0 && <p className="fl-muted">{S.cellar.empty}</p>}
        {wines.length > 0 && groups.length === 0 && depleted.length < wines.length && <p className="fl-muted">{S.cellar.noMatch}</p>}
        {groups.map(({ category: c, rows }) => (
          <section key={c} className="fl-group">
            <div className="fl-group__head">
              <span className="fl-group__title">{S.categoryShort[c] ?? c}</span>
              <span className="fl-group__count">
                <span className="fl-desktop-only">{S.cellar.wines(rows.length)} · </span>
                {S.bottles(rows.reduce((sum, d) => sum + d.count, 0))}
              </span>
            </div>
            <div className="fl-card fl-list">
              {rows.map((d) => (
                <DrinkRow key={d.id} drink={d} actions={<CountStepper drink={d} onPatch={(p) => patch(d.id, p)} />} />
              ))}
            </div>
          </section>
        ))}
        {depleted.length > 0 && (
          <section className="fl-group">
            <button className="fl-slut" aria-expanded={showDepleted} onClick={() => setShowDepleted((v) => !v)}>
              <IconChevron />
              <span className="fl-desktop-only">
                {S.cellar.depleted} · {S.cellar.winesZero(depleted.length)}
              </span>
              <span className="fl-mobile-only">
                {S.cellar.depleted} · {S.cellar.wines(depleted.length)}
              </span>
            </button>
            {showDepleted && (
              <div className="fl-card fl-list">
                {depleted.map((d) => (
                  <DrinkRow key={d.id} drink={d} muted actions={<Rewish drink={d} onPatch={(p) => patch(d.id, p)} />} />
                ))}
              </div>
            )}
          </section>
        )}
      </div>
    </>
  )
}

/** Drack en, Köpte fler (design §5 regel 3): minus minskar direkt, plus ökar. Ingen ruta. */
export function CountStepper({ drink, onPatch, touch = false }: { drink: Drink; onPatch: (p: DrinkPatch) => void; touch?: boolean }) {
  return (
    <div className={touch ? 'fl-stepper fl-stepper--touch' : 'fl-stepper'}>
      <button type="button" title={S.cellar.drankOne} aria-label={S.cellar.drankOne} disabled={drink.count === 0} onClick={() => onPatch({ count: drink.count - 1 })}>
        <IconMinus />
      </button>
      <button type="button" title={S.cellar.boughtMore} aria-label={S.cellar.boughtMore} onClick={() => onPatch({ count: drink.count + 1 })}>
        <IconPlus />
      </button>
    </div>
  )
}

/** Slut (beslut 30): raden stannar grå, ett tryck lägger den på önskelistan igen, eller plus om fler köpts. */
export function Rewish({ drink, onPatch }: { drink: Drink; onPatch: (p: DrinkPatch) => void }) {
  return (
    <div className="fl-rewish">
      <button type="button" className="fl-textbtn" onClick={() => onPatch({ owned: false, count: 0, open_level: null })}>
        {S.cellar.rewish}
      </button>
      <CountStepper drink={drink} onPatch={onPatch} />
    </div>
  )
}
