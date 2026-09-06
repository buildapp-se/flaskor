import { useState } from 'react'
import type { Drink, DrinkPatch } from '../../shared/types.ts'
import { windowState } from '../../shared/window.ts'
import { Pill } from '../components/Pill.tsx'
import { articleNo, dateShort, kr, pct, temp } from '../format.ts'
import { PATHS } from '../hash.ts'
import { IconExternal, IconMinus, IconPlus } from '../icons.tsx'
import { useStore } from '../store.tsx'
import { S } from '../strings.ts'
import { Bottle } from './Add.tsx'
import { SpiritCard } from './Bar.tsx'

// Vindetalj (design §3 "Vindetalj desktop", beslut 17): foto, namn, fönster som tidslinje, fakta, smak, kommentar, antal, priser, länkar.
// Mobil saknar artboard: samma block i en kolumn. Redigering saknas i leveransen: "Ändra" byter mittkolumnen mot ett formulär.
export function Detail({ id }: { id: number }) {
  const { drinks, patch, refresh } = useStore()
  const [editing, setEditing] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  if (drinks === null) return <div className="fl-muted">{S.loading}</div>
  const drink = drinks.find((d) => d.id === id)
  if (!drink) return <p className="fl-muted">{S.detail.notFound}</p>

  const spirit = drink.kind === 'spirit'
  const state = spirit ? null : windowState(drink.drink_from, drink.drink_to)
  const title = drink.vintage ? `${drink.name} ${drink.vintage}` : drink.name
  const meta = [
    [drink.region, drink.country].filter(Boolean).join(', '),
    drink.grapes,
    S.categoryShort[drink.category ?? ''] ?? drink.category,
    drink.alcohol !== null ? pct(drink.alcohol) : null,
  ]
    .filter(Boolean)
    .join(' · ')
  const parent = spirit ? { path: PATHS.bar, label: S.nav.bar } : drink.owned ? { path: PATHS.cellar, label: S.nav.cellar } : { path: PATHS.wishlist, label: S.nav.wishlist }
  const vivino = `https://www.vivino.com/search/wines?q=${encodeURIComponent(drink.name)}`

  async function doRefresh() {
    setRefreshing(true)
    await refresh(drink!.id)
    setRefreshing(false)
  }

  return (
    <div className="fl-detail">
      <div className="fl-crumbs">
        <span>
          <a href={parent.path}>{parent.label}</a>
          {drink.category && (
            <>
              <span className="fl-crumbs__sep">/</span>
              <span>{S.categoryShort[drink.category] ?? drink.category}</span>
            </>
          )}
        </span>
        {!editing && (
          <button className="fl-textbtn" onClick={() => setEditing(true)}>
            {S.detail.edit}
          </button>
        )}
      </div>

      <div className="fl-detail__photo">
        <Bottle url={drink.image_url} size="xl" />
      </div>

      {editing ? (
        <EditForm
          drink={drink}
          onCancel={() => setEditing(false)}
          onSave={async (p) => {
            setEditing(false)
            await patch(drink.id, p)
          }}
        />
      ) : (
        <div className="fl-detail__main">
          <div className="fl-stack-8">
            {drink.producer && <div className="fl-small fl-muted">{drink.producer}</div>}
            <h1 className="fl-detail__title">{title}</h1>
            {meta && <div className="fl-detail__meta">{meta}</div>}
          </div>

          {state !== null && (
            <div className="fl-detail__window">
              <div className="fl-detail__pillrow">
                <Pill state={state} large from={drink.drink_from} to={drink.drink_to} />
                {(state === 'drink' || state === 'soon') && drink.drink_from !== null && drink.drink_to !== null && (
                  <span className="fl-small fl-muted">{S.detail.yearOf(new Date().getFullYear() - drink.drink_from + 1, drink.drink_to - drink.drink_from + 1)}</span>
                )}
              </div>
              {drink.drink_from !== null && drink.drink_to !== null && <Timeline from={drink.drink_from} to={drink.drink_to} />}
            </div>
          )}

          <div className="fl-facts">
            <Fact label={S.detail.serving} value={drink.serve_temp ? temp(drink.serve_temp) : null} />
            <Fact label={S.detail.decant} value={drink.decant_hours ? S.detail.decantHours(drink.decant_hours) : S.detail.decantNone} />
            <Fact label={S.detail.food} value={drink.food} />
            <Fact label={S.detail.alcohol} value={drink.alcohol !== null ? pct(drink.alcohol) : null} />
          </div>

          {drink.taste && (
            <div className="fl-stack-8">
              <span className="fl-label">{S.detail.taste}</span>
              <p className="fl-detail__taste">{drink.taste}</p>
            </div>
          )}
          {drink.note && (
            <div className="fl-stack-8">
              <span className="fl-label">{S.detail.note}</span>
              <p className="fl-detail__note">”{drink.note}”</p>
            </div>
          )}
        </div>
      )}

      <aside className="fl-detail__aside">
        <div className="fl-card fl-detail__count">
          <div className="fl-row-between">
            <span className="fl-label">{S.detail.countAtHome}</span>
            <span className="fl-detail__big">{drink.count}</span>
          </div>
          <div className="fl-detail__pair">
            <button className="fl-detail__act" disabled={drink.count === 0} onClick={() => patch(drink.id, { count: drink.count - 1 })}>
              <IconMinus />
              {S.detail.drankOne}
            </button>
            <button className="fl-detail__act" onClick={() => patch(drink.id, { count: drink.count + 1 })}>
              <IconPlus />
              {S.detail.boughtMore}
            </button>
          </div>
          {/* Sprit: öppnad flaska och fjärdedelar som i Barskåpet. Slut: lägg på önskelistan igen (beslut 30). */}
          {spirit && drink.owned && (drink.count > 0 || drink.open_level !== null) && <SpiritCard drink={drink} onPatch={(p) => patch(drink.id, p)} />}
          {drink.owned && drink.count === 0 && drink.open_level === null && (
            <button className="fl-textbtn" onClick={() => patch(drink.id, { owned: false, count: 0, open_level: null })}>
              {S.cellar.rewish}
            </button>
          )}
        </div>

        <div className="fl-card fl-detail__prices">
          {drink.price_paid !== null && <Line label={S.detail.pricePaid} value={kr(drink.price_paid)} strong />}
          {drink.price_current !== null && <Line label={S.detail.priceCurrent} value={kr(drink.price_current)} strong />}
          {drink.owned && <Line label={S.detail.bought} value={dateShort(drink.created_at)} />}
          {drink.source_kind === 'systembolaget' && drink.source_id && <Line label={S.detail.number} value={articleNo(drink.source_id)} />}
          {drink.price_checked_at && <Line label={S.detail.checked} value={dateShort(drink.price_checked_at)} />}
          <div className="fl-rule" />
          {drink.source_url && (
            <a className="fl-link fl-small" href={drink.source_url} target="_blank" rel="noreferrer">
              {drink.source_kind === 'caviste' ? S.detail.caviste : S.detail.systembolaget}
              <IconExternal />
            </a>
          )}
          {!spirit && (
            <a className="fl-link fl-small" href={drink.vivino_url ?? vivino} target="_blank" rel="noreferrer">
              {drink.vivino_rating !== null ? S.detail.vivinoRated(String(drink.vivino_rating).replace('.', ','), drink.vivino_count) : S.detail.vivino}
              <IconExternal />
            </a>
          )}
          {(drink.source_kind === 'systembolaget' || !spirit) && (
            <button className="fl-link fl-small fl-detail__refresh" disabled={refreshing} onClick={doRefresh}>
              {refreshing ? S.detail.refreshing : drink.source_kind === 'systembolaget' ? S.detail.refresh : S.detail.refreshVivino}
            </button>
          )}
        </div>
      </aside>
    </div>
  )
}

function Fact({ label, value }: { label: string; value: string | null }) {
  if (!value) return null
  return (
    <div className="fl-fact">
      <span className="fl-label">{label}</span>
      <span className="fl-fact__value">{value}</span>
    </div>
  )
}

function Line({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="fl-line">
      <span className="fl-muted">{label}</span>
      <span className={strong ? 'fl-line__strong' : undefined}>{value}</span>
    </div>
  )
}

/** Tidslinjen ur designen: ett år före fönstret till ett år efter, tonat fönster, mörkare del fram till i dag, markör för i dag. */
function Timeline({ from, to }: { from: number; to: number }) {
  const start = from - 1
  const end = to + 1
  const total = end - start
  const now = new Date()
  const today = now.getFullYear() + (now.getMonth() + 0.5) / 12
  const pos = (year: number) => Math.min(100, Math.max(0, ((year - start) / total) * 100))
  return (
    <div className="fl-timeline">
      <div className="fl-timeline__bar">
        <div className="fl-timeline__window" style={{ left: `${pos(from)}%`, right: `${100 - pos(to + 1)}%` }} />
        <div className="fl-timeline__past" style={{ left: `${pos(from)}%`, width: `${Math.max(0, pos(Math.min(today, to + 1)) - pos(from))}%` }} />
        <div className="fl-timeline__today" style={{ left: `${pos(today)}%` }} />
      </div>
      <div className="fl-timeline__labels">
        <span>{start}</span>
        <span>{from}</span>
        <span className="fl-timeline__now">{S.detail.today}</span>
        <span>{to}</span>
        <span>{end}</span>
      </div>
    </div>
  )
}

type Field = keyof typeof S.detail.fields
const TEXTAREAS: ReadonlyArray<Field> = ['food', 'note', 'taste']
const NUMBERS: ReadonlyArray<Field> = ['vintage', 'alcohol', 'volume', 'drink_from', 'drink_to', 'decant_hours', 'price_paid']

function EditForm({ drink, onCancel, onSave }: { drink: Drink; onCancel: () => void; onSave: (p: DrinkPatch) => void }) {
  const initial: Record<Field, string> = {
    name: drink.name,
    producer: drink.producer ?? '',
    vintage: drink.vintage?.toString() ?? '',
    country: drink.country ?? '',
    region: drink.region ?? '',
    category: drink.category ?? '',
    grapes: drink.grapes ?? '',
    alcohol: drink.alcohol?.toString() ?? '',
    volume: drink.volume_ml?.toString() ?? '',
    drink_from: drink.drink_from?.toString() ?? '',
    drink_to: drink.drink_to?.toString() ?? '',
    serve_temp: drink.serve_temp ?? '',
    decant_hours: drink.decant_hours?.toString() ?? '',
    food: drink.food ?? '',
    price_paid: drink.price_paid?.toString() ?? '',
    note: drink.note ?? '',
    taste: drink.taste ?? '',
  }
  const [values, setValues] = useState(initial)
  const fields = (Object.keys(S.detail.fields) as Field[]).filter((f) => drink.kind === 'wine' || !['drink_from', 'drink_to', 'decant_hours', 'grapes', 'vintage'].includes(f))

  function submit() {
    const p: Record<string, unknown> = {}
    for (const f of fields) {
      const raw = values[f].trim()
      const key = f === 'volume' ? 'volume_ml' : f
      p[key] = raw === '' ? null : NUMBERS.includes(f) ? Number(raw.replace(',', '.')) : raw
    }
    if (typeof p['name'] !== 'string') p['name'] = drink.name
    onSave(p as DrinkPatch)
  }

  return (
    <form
      className="fl-edit"
      onSubmit={(e) => {
        e.preventDefault()
        submit()
      }}
    >
      <div className="fl-edit__grid">
        {fields.map((f) => (
          <label key={f} className={TEXTAREAS.includes(f) ? 'fl-field fl-edit__wide' : 'fl-field'}>
            <span className="fl-label">{S.detail.fields[f]}</span>
            {TEXTAREAS.includes(f) ? (
              <textarea className="fl-input fl-edit__area" rows={3} value={values[f]} onChange={(e) => setValues({ ...values, [f]: e.target.value })} />
            ) : (
              <input className="fl-input" inputMode={NUMBERS.includes(f) ? 'decimal' : undefined} value={values[f]} onChange={(e) => setValues({ ...values, [f]: e.target.value })} />
            )}
          </label>
        ))}
      </div>
      <div className="fl-sheet__actions">
        <button type="button" className="fl-btn fl-btn--secondary" onClick={onCancel}>
          {S.detail.cancel}
        </button>
        <button type="submit" className="fl-btn fl-btn--primary">
          {S.detail.save}
        </button>
      </div>
    </form>
  )
}
