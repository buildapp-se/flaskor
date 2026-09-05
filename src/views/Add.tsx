import { useState, type FormEvent } from 'react'
import { FatalError, NotFoundError } from '../../shared/errors.ts'
import type { Preview } from '../../shared/types.ts'
import { windowState } from '../../shared/window.ts'
import { api } from '../api.ts'
import { Pill } from '../components/Pill.tsx'
import { dateShort, kr, pct, volume } from '../format.ts'
import { detailPath, navigate, PATHS } from '../hash.ts'
import { useStore } from '../store.tsx'
import { S } from '../strings.ts'

// Lägg till (design §3 "Lägg till mobil"): fält, förhandsvisning, förifyllt fönster, två sparknappar.
// Desktop saknar artboard: samma innehåll i en kolumn på 560 px. Bokfört i HANDOFF §Val tagna åt Patrik.
export function Add() {
  const { add } = useStore()
  const [query, setQuery] = useState('')
  const [preview, setPreview] = useState<Preview | null>(null)
  const [fetchedAt, setFetchedAt] = useState<string | null>(null)
  const [editingWindow, setEditingWindow] = useState(false)
  const [busy, setBusy] = useState<'fetch' | 'save' | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function fetchPreview(event: FormEvent) {
    event.preventDefault()
    if (query.trim() === '') return
    setBusy('fetch')
    setError(null)
    setPreview(null)
    try {
      setPreview(await api.preview(query))
      setFetchedAt(new Date().toISOString())
      setEditingWindow(false)
    } catch (err) {
      if (err instanceof NotFoundError) setError(S.add.notFound)
      else if (err instanceof FatalError && err.status === 400) setError(S.add.badInput)
      else setError(S.add.failed)
    } finally {
      setBusy(null)
    }
  }

  async function save(owned: boolean) {
    if (!preview) return
    setBusy('save')
    setError(null)
    try {
      // Direkt till källaren: en flaska, inköpspris = Systembolagets pris i dag. Ändras sedan i detaljvyn.
      const row = await add(owned ? { ...preview, owned: true, count: 1, price_paid: preview.price_current } : preview)
      navigate(owned ? detailPath(row.id) : PATHS.wishlist)
    } catch {
      setError(S.error.generic)
      setBusy(null)
    }
  }

  const state = preview ? (preview.kind === 'spirit' ? null : windowState(preview.drink_from, preview.drink_to)) : null
  const windowManual = preview !== null && preview.source_kind === 'systembolaget' && state !== 'unknown' && !editingWindow

  return (
    <div className="fl-add">
      <div className="fl-head">
        <h1>{S.add.title}</h1>
      </div>
      <form className="fl-add__form" onSubmit={fetchPreview}>
        <input className="fl-input" inputMode="url" placeholder={S.add.placeholder} value={query} onChange={(e) => setQuery(e.target.value)} autoFocus />
        <div className="fl-small fl-muted">
          {S.add.hint} {fetchedAt && S.add.fetched(dateShort(fetchedAt))}
        </div>
        {error && <div className="fl-error">{error}</div>}
        {!preview && query.trim() !== '' && (
          <button className="fl-btn fl-btn--secondary" type="submit" disabled={busy !== null}>
            {busy === 'fetch' ? S.add.fetching : S.add.fetch}
          </button>
        )}
      </form>

      {preview && (
        <div className="fl-add__body">
          <div className="fl-card fl-add__card">
            <div className="fl-add__top">
              <Bottle url={preview.image_url} size="lg" />
              <div className="fl-add__facts">
                <div className="fl-add__name">{preview.name}</div>
                <div className="fl-small fl-muted">{[preview.producer, [preview.region, preview.country].filter(Boolean).join(', ')].filter(Boolean).join(' · ')}</div>
                <div className="fl-small fl-muted">
                  {[preview.grapes, preview.category, preview.volume_ml !== null ? volume(preview.volume_ml) : null, preview.alcohol !== null ? pct(preview.alcohol) : null].filter(Boolean).join(' · ')}
                </div>
                {preview.price_current !== null && <div className="fl-add__price">{kr(preview.price_current)}</div>}
              </div>
            </div>
            {preview.kind === 'wine' && (
              <>
                <div className="fl-rule" />
                <div className="fl-stack-8">
                  <div className="fl-row-between">
                    <span className="fl-label">{windowManual ? S.add.window : S.add.windowManual}</span>
                    <button type="button" className="fl-textbtn" onClick={() => setEditingWindow((v) => !v)}>
                      {editingWindow ? S.add.done : S.add.change}
                    </button>
                  </div>
                  {editingWindow ? (
                    <div className="fl-years">
                      <label>
                        <span className="fl-label">{S.add.from}</span>
                        <input className="fl-input" type="number" inputMode="numeric" value={preview.drink_from ?? ''} onChange={(e) => setPreview({ ...preview, drink_from: e.target.value === '' ? null : Number(e.target.value) })} />
                      </label>
                      <label>
                        <span className="fl-label">{S.add.to}</span>
                        <input className="fl-input" type="number" inputMode="numeric" value={preview.drink_to ?? ''} onChange={(e) => setPreview({ ...preview, drink_to: e.target.value === '' ? null : Number(e.target.value) })} />
                      </label>
                    </div>
                  ) : (
                    <div>
                      <Pill state={state ?? 'unknown'} large from={preview.drink_from} to={preview.drink_to} />
                    </div>
                  )}
                </div>
              </>
            )}
            {preview.taste && (
              <div className="fl-stack-8">
                <span className="fl-label">{S.add.taste}</span>
                <p className="fl-add__taste">{preview.taste}</p>
              </div>
            )}
          </div>
          <div className="fl-add__actions">
            <button className="fl-btn fl-btn--primary" type="button" disabled={busy !== null} onClick={() => save(false)}>
              {busy === 'save' ? S.add.saving : S.add.toWishlist}
            </button>
            <button className="fl-btn fl-btn--secondary" type="button" disabled={busy !== null} onClick={() => save(true)}>
              {preview.kind === 'spirit' ? S.add.toBar : S.add.toCellar}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

/** Flaskfotot: Systembolagets frilagda bild, eller platshållaren ur designen när bild saknas. */
export function Bottle({ url, size }: { url: string | null; size: 'sm' | 'md' | 'lg' | 'xl' }) {
  return url ? <img className={`fl-bottle fl-bottle--${size}`} src={url} alt="" loading="lazy" /> : <div className={`fl-bottle fl-bottle--${size} fl-bottle--empty`} />
}
