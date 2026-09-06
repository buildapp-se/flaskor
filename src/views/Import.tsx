import { useState } from 'react'
import type { Drink, DrinkInput, Preview } from '../../shared/types.ts'
import { api } from '../api.ts'
import { kr } from '../format.ts'
import { navigate, PATHS } from '../hash.ts'
import { parseImport, type ImportedRow } from '../importParse.ts'
import { useStore } from '../store.tsx'
import { S } from '../strings.ts'
import { Bottle } from './Add.tsx'

// Bulkimport via egen AI (BACKLOG 40), Grammat-modellen: prompten kopieras till valfri AI tillsammans med texten från
// Systembolagets lista, svaret (JSON) klistras in här, varje artikelnummer slås upp hos Systembolaget, en granskningstabell
// visas före import, och en ångra-rad ligger kvar i tio minuter.

type Dest = 'wishlist' | 'cellar' | 'bar'
type Status = 'pending' | 'found' | 'notfound' | 'manual'

interface Row {
  key: number
  input: ImportedRow
  preview: Preview | null
  status: Status
  dest: Dest
  count: number
  include: boolean
}

const DESTS: ReadonlyArray<Dest> = ['wishlist', 'cellar', 'bar']

function destsFor(kind: 'wine' | 'spirit'): Dest[] {
  return kind === 'spirit' ? ['wishlist', 'bar'] : ['wishlist', 'cellar']
}

/** Raden som sparas: Systembolagets fält när numret hittades, annars bara det AI:n gav. */
function toInput(row: Row): DrinkInput {
  const { input, preview, dest, count } = row
  const owned = dest !== 'wishlist'
  const base: DrinkInput = preview ?? {
    kind: input.kind, owned: false, name: input.name, producer: null, vintage: null, country: null, region: null, category: input.kind === 'wine' ? 'Rött vin' : null,
    style: null, grapes: null, volume_ml: null, alcohol: null, source_kind: 'manual', source_id: null, source_url: null, image_url: null, price_paid: null,
    price_current: null, price_checked_at: null, availability: 'unknown', count: 0, open_level: null, drink_from: null, drink_to: null, serve_temp: null,
    decant_hours: null, food: null, note: null, taste: null, vivino_rating: null, vivino_count: null, vivino_url: null, vivino_checked_at: null,
  }
  return {
    ...base,
    vintage: input.vintage ?? base.vintage,
    owned,
    count: owned ? count : 0,
    price_paid: owned ? (input.price ?? base.price_current) : null,
    price_current: base.price_current ?? input.price,
  }
}

export function Import() {
  const { add, setUndo } = useStore()
  const [text, setText] = useState('')
  const [rows, setRows] = useState<Row[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [saving, setSaving] = useState<number | null>(null)

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(S.import.prompt)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      /* fältet nedanför går att markera för hand */
    }
  }

  function load() {
    setError(null)
    let parsed: ImportedRow[]
    try {
      parsed = parseImport(text)
    } catch {
      setError(S.import.badJson)
      return
    }
    if (parsed.length === 0) {
      setError(S.import.empty)
      return
    }
    const next: Row[] = parsed.map((input, key) => ({ key, input, preview: null, status: input.nr ? 'pending' : 'manual', dest: 'wishlist', count: input.count, include: true }))
    setRows(next)
    // Slå upp numren hos Systembolaget, fyra i taget, och fyll på raderna allteftersom.
    void (async () => {
      const queue = next.filter((r) => r.input.nr)
      const worker = async () => {
        for (let r = queue.shift(); r; r = queue.shift()) {
          const row = r
          let preview: Preview | null = null
          try {
            preview = await api.preview(row.input.nr!)
          } catch {
            preview = null
          }
          setRows((list) => list?.map((x) => (x.key === row.key ? { ...x, preview, status: preview ? 'found' : 'notfound' } : x)) ?? null)
        }
      }
      await Promise.all([worker(), worker(), worker(), worker()])
    })()
  }

  function update(key: number, patch: Partial<Row>) {
    setRows((list) => list?.map((r) => (r.key === key ? { ...r, ...patch } : r)) ?? null)
  }

  function allTo(dest: Dest) {
    setRows((list) => list?.map((r) => ({ ...r, dest: destsFor(r.input.kind).includes(dest) ? dest : dest === 'cellar' ? 'bar' : dest === 'bar' ? 'cellar' : dest })) ?? null)
  }

  async function importAll() {
    if (!rows) return
    const chosen = rows.filter((r) => r.include && r.status !== 'pending')
    const created: Drink[] = []
    setSaving(0)
    try {
      for (const [i, row] of chosen.entries()) {
        setSaving(i + 1)
        created.push(await add(toInput(row)))
      }
    } catch {
      setError(S.error.generic)
    }
    setSaving(null)
    if (created.length === 0) return
    const ids = created.map((d) => d.id)
    setUndo(S.import.done(ids.length), async () => {
      for (const id of ids) await api.deleteDrink(id)
    })
    const dests = new Set(chosen.map((r) => r.dest))
    navigate(dests.has('cellar') ? PATHS.cellar : dests.has('bar') ? PATHS.bar : PATHS.wishlist)
  }

  const ready = rows?.filter((r) => r.include && r.status !== 'pending').length ?? 0
  const pending = rows?.some((r) => r.status === 'pending') ?? false

  return (
    <div className="fl-import">
      <div className="fl-head">
        <h1>{S.import.title}</h1>
        {rows && <span className="fl-head__count">{S.import.review(rows.length)}</span>}
      </div>

      {!rows && (
        <div className="fl-import__paste">
          <p className="fl-small fl-muted">{S.import.lead}</p>
          <div className="fl-import__promptrow">
            <button className="fl-btn fl-btn--secondary" type="button" onClick={copyPrompt}>
              {copied ? S.import.copied : S.import.copyPrompt}
            </button>
          </div>
          <pre className="fl-import__prompt">{S.import.prompt}</pre>
          <label className="fl-field">
            <span className="fl-label">{S.import.pasteLabel}</span>
            <textarea className="fl-input fl-import__area" rows={8} value={text} onChange={(e) => setText(e.target.value)} placeholder={S.import.pastePlaceholder} />
          </label>
          {error && <div className="fl-error">{error}</div>}
          <button className="fl-btn fl-btn--primary" type="button" disabled={text.trim() === ''} onClick={load}>
            {S.import.load}
          </button>
        </div>
      )}

      {rows && (
        <div className="fl-import__review">
          <div className="fl-chips fl-chips--scroll">
            <span className="fl-chips__label">{S.import.allTo}</span>
            {DESTS.map((d) => (
              <button key={d} className="fl-chip" onClick={() => allTo(d)}>
                {S.import.dest[d]}
              </button>
            ))}
            <span className="fl-chips__sep" />
            <button className="fl-chip" onClick={() => setRows(null)}>
              {S.import.back}
            </button>
          </div>
          <div className="fl-card fl-tablewrap">
            <table className="fl-table fl-import__table">
              <thead>
                <tr>
                  <th>{S.import.include}</th>
                  <th />
                  <th>{S.column.name}</th>
                  <th className="fl-table__num">{S.column.price}</th>
                  <th>{S.import.to}</th>
                  <th className="fl-table__num">{S.import.count}</th>
                  <th>{S.column.source}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const p = r.preview
                  const name = p ? (p.vintage ?? r.input.vintage ? `${p.name} ${r.input.vintage ?? p.vintage}` : p.name) : r.input.vintage ? `${r.input.name} ${r.input.vintage}` : r.input.name
                  const price = r.input.price ?? p?.price_current ?? null
                  return (
                    <tr key={r.key} className={r.include ? undefined : 'fl-table__row--muted'}>
                      <td>
                        <input type="checkbox" checked={r.include} onChange={(e) => update(r.key, { include: e.target.checked })} />
                      </td>
                      <td>
                        <Bottle url={p?.image_url ?? null} size="sm" />
                      </td>
                      <td className="fl-import__name">
                        {name}
                        {p && <div className="fl-small fl-muted">{[p.producer, p.category, p.country].filter(Boolean).join(' · ')}</div>}
                      </td>
                      <td className="fl-table__num">{price !== null ? kr(price) : ''}</td>
                      <td>
                        <select className="fl-chip fl-chip--select fl-chip--xs" value={r.dest} onChange={(e) => update(r.key, { dest: e.target.value as Dest })}>
                          {destsFor(p?.kind ?? r.input.kind).map((d) => (
                            <option key={d} value={d}>
                              {S.import.dest[d]}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="fl-table__num">
                        <input className="fl-input fl-import__count" inputMode="numeric" value={r.count} disabled={r.dest === 'wishlist'} onChange={(e) => update(r.key, { count: Math.max(1, Number(e.target.value) || 1) })} />
                      </td>
                      <td className="fl-small fl-muted">{S.import.status[r.status]}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {error && <div className="fl-error">{error}</div>}
          <button className="fl-btn fl-btn--primary" type="button" disabled={saving !== null || pending || ready === 0} onClick={importAll}>
            {saving !== null ? S.import.importing(saving, ready) : S.import.import(ready)}
          </button>
        </div>
      )}
    </div>
  )
}
