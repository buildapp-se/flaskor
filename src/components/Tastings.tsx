import { useEffect, useState } from 'react'
import type { Tasting } from '../../shared/types.ts'
import { api } from '../api.ts'
import { dateShort } from '../format.ts'
import { S } from '../strings.ts'

// Drucken-logg per rad (beslut 16, backlog P3): datum, betyg 1 till 5, kommentar.
// "Drack en" rör inte loggen. Beslut 16 säger uttryckligen ingen ruta och inget betyg vid nedräkningen, och
// friktion vid fel tillfälle är precis varför loggar slutar användas. Här skrivs den när man faktiskt har en
// åsikt, i efterhand om man vill.
// ponytail: hämtas per rad när detaljvyn öppnas, inte i den globala listan. Loggen syns bara här.

/** Dagens datum som YYYY-MM-DD i lokal tid. `toISOString` ger UTC och blir fel datum sent på kvällen. */
function today(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

export function Tastings({ drinkId }: { drinkId: number }) {
  const [list, setList] = useState<Tasting[] | null>(null)
  const [adding, setAdding] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [date, setDate] = useState(today())
  const [rating, setRating] = useState<number | null>(null)
  const [note, setNote] = useState('')

  useEffect(() => {
    let alive = true
    api
      .listTastings(drinkId)
      .then((t) => alive && setList(t))
      .catch(() => alive && setError(S.tasting.failed))
    return () => {
      alive = false
    }
  }, [drinkId])

  async function save() {
    setBusy(true)
    setError(null)
    try {
      const saved = await api.addTasting(drinkId, { drunk_on: date, rating, note: note.trim() || null })
      setList((prev) => [saved, ...(prev ?? [])])
      setAdding(false)
      setDate(today())
      setRating(null)
      setNote('')
    } catch {
      setError(S.tasting.failed)
    } finally {
      setBusy(false)
    }
  }

  async function remove(id: number) {
    setError(null)
    try {
      await api.deleteTasting(drinkId, id)
      setList((prev) => (prev ?? []).filter((t) => t.id !== id))
    } catch {
      setError(S.tasting.failed)
    }
  }

  return (
    <div className="fl-tasting">
      <div className="fl-tasting__head">
        <span className="fl-label">{S.tasting.label}</span>
        {!adding && (
          <button type="button" className="fl-textbtn" onClick={() => setAdding(true)}>
            {S.tasting.add}
          </button>
        )}
      </div>

      {adding && (
        <form
          className="fl-tasting__form"
          onSubmit={(e) => {
            e.preventDefault()
            void save()
          }}
        >
          <label className="fl-field">
            <span className="fl-label">{S.tasting.date}</span>
            <input className="fl-input" type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          <div className="fl-field">
            <span className="fl-label">{S.tasting.rating}</span>
            <div className="fl-tasting__stars">
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} type="button" className="fl-chip" aria-pressed={n === rating} onClick={() => setRating(n === rating ? null : n)}>
                  {n}
                </button>
              ))}
            </div>
          </div>
          <label className="fl-field fl-tasting__wide">
            <span className="fl-label">{S.tasting.note}</span>
            <textarea className="fl-input fl-edit__area" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
          </label>
          <div className="fl-sheet__actions">
            <button type="button" className="fl-btn fl-btn--secondary" onClick={() => setAdding(false)}>
              {S.detail.cancel}
            </button>
            <button type="submit" className="fl-btn fl-btn--primary" disabled={busy}>
              {busy ? S.add.saving : S.detail.save}
            </button>
          </div>
        </form>
      )}

      {error && <div className="fl-error">{error}</div>}
      {list !== null && list.length === 0 && !adding && <div className="fl-small fl-muted">{S.tasting.empty}</div>}
      {list?.map((t) => (
        <div key={t.id} className="fl-tasting__row">
          <div className="fl-tasting__meta">
            <span className="fl-tasting__date">{dateShort(t.drunk_on)}</span>
            {t.rating !== null && <span className="fl-tasting__rating">{'★'.repeat(t.rating)}</span>}
          </div>
          {t.note && <p className="fl-tasting__note">”{t.note}”</p>}
          <button type="button" className="fl-textbtn fl-small" onClick={() => void remove(t.id)}>
            {S.tasting.remove}
          </button>
        </div>
      ))}
    </div>
  )
}
