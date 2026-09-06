import { useState, type FormEvent } from 'react'
import { FatalError, NotFoundError } from '../../shared/errors.ts'
import type { Drink, DrinkPatch, Kind, Preview } from '../../shared/types.ts'
import { windowState } from '../../shared/window.ts'
import { api } from '../api.ts'
import { Pill } from '../components/Pill.tsx'
import { Rating } from '../components/Rating.tsx'
import { dateShort, kr, pct, volume } from '../format.ts'
import { detailPath, navigate, PATHS } from '../hash.ts'
import { useStore } from '../store.tsx'
import { S } from '../strings.ts'
import { EditForm } from './Detail.tsx'

// Lägg till (design §3 "Lägg till mobil"): fält, förhandsvisning, förifyllt fönster, två sparknappar.
// Tre vägar in (2026-09-06): Systembolagets nummer eller länk, en Vivino-länk, eller "Skriv in själv" med formuläret från Ändra.
// Desktop saknar artboard: samma innehåll i en kolumn på 560 px. Bokfört i HANDOFF §Val tagna åt Patrik.

/** Tom rad att fylla i för hand. Formuläret vill ha en Drink; id och tider är låtsas och skalas bort vid sparandet. */
function blank(kind: Kind): Drink {
  return {
    id: 0, household_id: 0, kind, owned: false, name: '', producer: null, vintage: null, country: null, region: null, category: kind === 'wine' ? 'Rött vin' : null,
    style: null, grapes: null, volume_ml: null, alcohol: null, source_kind: 'manual', source_id: null, source_url: null, image_url: null, price_paid: null,
    price_current: null, price_checked_at: null, availability: 'unknown', count: 0, open_level: null, drink_from: null, drink_to: null, serve_temp: null,
    decant_hours: null, food: null, note: null, taste: null, vivino_rating: null, vivino_count: null, vivino_url: null, vivino_checked_at: null, created_at: '', updated_at: '',
  }
}

function isVivino(q: string): boolean {
  return /vivino\.com\//i.test(q)
}

export function Add() {
  const { add } = useStore()
  const [query, setQuery] = useState('')
  const [preview, setPreview] = useState<Preview | null>(null)
  const [fetchedAt, setFetchedAt] = useState<string | null>(null)
  const [editingWindow, setEditingWindow] = useState(false)
  const [busy, setBusy] = useState<'fetch' | 'save' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [manual, setManual] = useState<Kind | null>(null)

  async function fetchPreview(event: FormEvent) {
    event.preventDefault()
    if (query.trim() === '') return
    setBusy('fetch')
    setError(null)
    setPreview(null)
    setManual(null)
    try {
      setPreview(isVivino(query) ? await api.previewVivino(query) : await api.preview(query))
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

  /** "Skriv in själv": formuläret ger en patch ovanpå den tomma raden, som sedan visas som vanlig förhandsvisning. */
  function manualDone(kind: Kind, patch: DrinkPatch) {
    const { id: _id, household_id: _h, created_at: _c, updated_at: _u, ...rest } = { ...blank(kind), ...patch }
    setPreview(rest)
    setFetchedAt(null)
    setManual(null)
    setEditingWindow(false)
  }

  async function save(owned: boolean) {
    if (!preview) return
    setBusy('save')
    setError(null)
    try {
      // Direkt till källaren: en flaska, inköpspris = dagens pris om det finns. Ändras sedan i detaljvyn.
      const row = await add(owned ? { ...preview, owned: true, count: 1, price_paid: preview.price_paid ?? preview.price_current } : preview)
      navigate(owned ? detailPath(row.id) : PATHS.wishlist)
    } catch {
      setError(S.error.generic)
      setBusy(null)
    }
  }

  const state = preview ? (preview.kind === 'spirit' ? null : windowState(preview.drink_from, preview.drink_to)) : null
  const windowManual = preview !== null && preview.source_kind === 'systembolaget' && state !== 'unknown' && !editingWindow
  const fromVivino = preview !== null && preview.source_kind === 'manual' && preview.vivino_url !== null && fetchedAt !== null

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
        {!preview && manual === null && query.trim() === '' && (
          <a className="fl-link fl-small" href={PATHS.import}>
            {S.import.link}
          </a>
        )}
        {!preview && manual === null && query.trim() === '' && (
          <div className="fl-add__manual">
            <span className="fl-small fl-muted">{S.add.manual}:</span>
            {(['wine', 'spirit'] as const).map((k) => (
              <button key={k} type="button" className="fl-chip" onClick={() => setManual(k)}>
                {S.add.manualKind[k]}
              </button>
            ))}
          </div>
        )}
      </form>

      {manual !== null && (
        <div className="fl-card fl-add__card">
          <div className="fl-label">
            {S.add.manualTitle} · {S.add.manualKind[manual]}
          </div>
          <EditForm drink={blank(manual)} onCancel={() => setManual(null)} onSave={(p) => manualDone(manual, p)} saveLabel={S.add.manualNext} />
        </div>
      )}

      {preview && (
        <div className="fl-add__body">
          <div className="fl-card fl-add__card">
            <div className="fl-add__top">
              <Bottle url={preview.image_url} size="lg" />
              <div className="fl-add__facts">
                <div className="fl-add__name">{preview.vintage ? `${preview.name} ${preview.vintage}` : preview.name}</div>
                <div className="fl-small fl-muted">{[preview.producer, [preview.region, preview.country].filter(Boolean).join(', ')].filter(Boolean).join(' · ')}</div>
                <div className="fl-small fl-muted">
                  {[preview.grapes, preview.category, preview.volume_ml !== null ? volume(preview.volume_ml) : null, preview.alcohol !== null ? pct(preview.alcohol) : null].filter(Boolean).join(' · ')}
                  {preview.vivino_rating !== null && <Rating drink={{ ...preview, id: 0, household_id: 0, created_at: '', updated_at: '' }} count />}
                </div>
                {(preview.price_current ?? preview.price_paid) !== null && <div className="fl-add__price">{kr((preview.price_current ?? preview.price_paid)!)}</div>}
                {fromVivino && <div className="fl-small fl-muted">{S.add.fromVivino}</div>}
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
            {preview.food && (
              <div className="fl-stack-8">
                <span className="fl-label">{S.detail.food}</span>
                <p className="fl-add__taste">{preview.food}</p>
              </div>
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
