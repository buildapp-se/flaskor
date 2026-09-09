import { useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { FatalError, NotFoundError } from '../../shared/errors.ts'
import type { Candidate, Drink, DrinkPatch, Kind, LabelGuess, Preview, ScanResult } from '../../shared/types.ts'
import { windowState } from '../../shared/window.ts'
import { api } from '../api.ts'
import { Pill } from '../components/Pill.tsx'
import { Rating } from '../components/Rating.tsx'
import { dateShort, kr, pct, volume } from '../format.ts'
import { detailPath, navigate, PATHS } from '../hash.ts'
import { findBarcode, looksLikeEan, shrink } from '../scan.ts'
import { useStore } from '../store.tsx'
import { S } from '../strings.ts'
import { EditForm } from './Detail.tsx'

// Lägg till (design §3 "Lägg till mobil"): fält, förhandsvisning, förifyllt fönster, två sparknappar.
// Vägar in: Systembolagets nummer eller länk, en Vivino-länk, "Skriv in själv" med formuläret från Ändra (2026-09-06),
// och "Fota flaskan" eller streckkodens siffror (2026-09-08, BACKLOG 37): Workern gissar flaskan och ger upp till tre
// Systembolagskandidater att välja bland, sedan samma förhandsvisning som för ett artikelnummer.
// Desktop saknar artboard: samma innehåll i en kolumn på 560 px. Bokfört i HANDOFF §Val tagna åt Patrik.

/** Tom rad att fylla i för hand. Formuläret vill ha en Drink; id och tider är låtsas och skalas bort vid sparandet. */
function blank(kind: Kind): Drink {
  return {
    id: 0, household_id: 0, kind, owned: false, name: '', producer: null, vintage: null, country: null, region: null, category: kind === 'wine' ? 'Rött vin' : null,
    style: null, grapes: null, volume_ml: null, alcohol: null, source_kind: 'manual', source_id: null, source_url: null, image_url: null, sb_product_id: null, price_paid: null,
    price_current: null, price_checked_at: null, availability: 'unknown', count: 0, open_level: null, drink_from: null, drink_to: null, serve_temp: null,
    decant_hours: null, food: null, note: null, taste: null, vivino_rating: null, vivino_count: null, vivino_url: null, vivino_checked_at: null, rating: null, rating_url: null, last_drunk_on: null, last_rating: null, tasting_count: 0, created_at: '', updated_at: '',
  }
}

/** Formuläret förifyllt med det som lästes från flaskan, när ingen Systembolagsträff passade. */
function fromGuess(g: LabelGuess): Drink {
  const base = blank(g.kind)
  return { ...base, name: g.name, producer: g.producer, vintage: g.vintage, volume_ml: g.volume_ml, alcohol: g.alcohol, category: g.category ?? base.category }
}

/** "Producent Namn", utan att upprepa producenten när namnet redan bär den. */
function describe(g: LabelGuess): string {
  const name = g.producer && !g.name.toLowerCase().includes(g.producer.toLowerCase()) ? `${g.producer} ${g.name}` : g.name
  return g.vintage ? `${name} ${g.vintage}` : name
}

function isVivino(q: string): boolean {
  return /vivino\.com\//i.test(q)
}

function isCaviste(q: string): boolean {
  return /caviste\.se\//i.test(q)
}

export function Add() {
  const { add } = useStore()
  const fileInput = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  const [preview, setPreview] = useState<Preview | null>(null)
  const [fetchedAt, setFetchedAt] = useState<string | null>(null)
  const [editingWindow, setEditingWindow] = useState(false)
  const [busy, setBusy] = useState<'fetch' | 'scan' | 'search' | 'save' | null>(null)
  const [error, setError] = useState<string | null>(null)
  /** "Skriv in själv": raden formuläret utgår från, tom eller förifylld från en skanning. */
  const [manual, setManual] = useState<Drink | null>(null)
  const [scan, setScan] = useState<ScanResult | null>(null)
  /** Träffar på ett fritextnamn hos Systembolaget (BACKLOG P3, 2026-09-09). */
  const [found, setFound] = useState<Candidate[] | null>(null)
  /** Vinerna i en Caviste-låda, att välja ur (beslut 6). */
  const [box, setBox] = useState<Preview[] | null>(null)

  function reset() {
    setError(null)
    setPreview(null)
    setManual(null)
    setScan(null)
    setFound(null)
    setBox(null)
  }

  async function fetchPreview(event: FormEvent) {
    event.preventDefault()
    const q = query.trim()
    if (q === '') return
    if (looksLikeEan(q)) return runScan({ ean: q.replace(/\s/g, '') })
    // Rena bokstäver är ett namn: sök direkt. Med siffror i får /api/systembolaget försöka först och
    // namnsöket ta vid på 400, så "Absolut 100" fungerar utan att vi bygger en egen gissning på klienten.
    if (!/\d/.test(q) && !/^https?:/i.test(q)) return searchByName(q)
    setBusy('fetch')
    reset()
    try {
      if (isCaviste(q)) {
        const wines = await api.previewCaviste(q)
        // En låda med ett enda vin behöver ingen valruta.
        if (wines.length === 1) setPreview(wines[0]!)
        else setBox(wines)
      } else setPreview(isVivino(q) ? await api.previewVivino(q) : await api.preview(q))
      setFetchedAt(new Date().toISOString())
      setEditingWindow(false)
    } catch (err) {
      // 400 betyder att frågan varken är ett artikelnummer eller en länk. Då är det ett namn: sök på det i stället
      // för att be användaren skriva om sig. ponytail: ingen egen gissning på klienten om vad som är ett namn.
      if (err instanceof FatalError && err.status === 400) {
        await searchByName(q)
        return
      }
      if (err instanceof NotFoundError) setError(S.add.notFound)
      else setError(S.add.failed)
    } finally {
      setBusy(null)
    }
  }

  /** Fritextsök hos Systembolaget. Träffarna väljs som skanningens kandidater, med samma lista. */
  async function searchByName(q: string) {
    setBusy('search')
    reset()
    try {
      const candidates = await api.search(q)
      if (candidates.length === 0) setError(S.search.none)
      else setFound(candidates)
    } catch {
      setError(S.add.failed)
    } finally {
      setBusy(null)
    }
  }

  /** Streckkod och/eller foto till Workern. Svaret blir kandidater att välja bland, ett Vivino-vin, eller ett förifyllt formulär. */
  async function runScan(body: { image?: string; ean?: string }) {
    setBusy('scan')
    reset()
    try {
      const result = await api.scan(body)
      if (result.candidates.length > 0) setScan(result)
      else if (result.vivino_url) {
        setPreview(await api.previewVivino(result.vivino_url))
        setFetchedAt(new Date().toISOString())
        setEditingWindow(false)
      } else {
        setManual(fromGuess(result.guess))
        setError(S.scan.noHit)
      }
    } catch (err) {
      if (err instanceof NotFoundError) setError(body.image ? S.scan.noBottle : S.scan.unknownEan)
      else if (err instanceof FatalError && err.status === 400) setError(S.add.badInput)
      else setError(S.scan.failed)
    } finally {
      setBusy(null)
    }
  }

  /** Fotot krymps i webbläsaren, streckkoden läses där webbläsaren kan (Android), sedan går allt till Workern. */
  async function onPhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setBusy('scan')
    setError(null)
    let image: string
    let ean: string | null
    try {
      ;[image, ean] = await Promise.all([shrink(file), findBarcode(file)])
    } catch {
      setError(S.scan.failed)
      setBusy(null)
      return
    }
    await runScan(ean ? { image, ean } : { image })
  }

  /** Vald kandidat: hela raden hämtas från produktsidan, som för ett inskrivet artikelnummer. */
  async function pick(number: string) {
    setBusy('fetch')
    setError(null)
    try {
      setPreview(await api.preview(number))
      setFetchedAt(new Date().toISOString())
      setEditingWindow(false)
      setScan(null)
      setFound(null)
    } catch {
      setError(S.add.failed)
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
    setError(null)
    setEditingWindow(false)
  }

  async function save(owned: boolean) {
    if (!preview) return
    setBusy('save')
    setError(null)
    try {
      // Direkt till källaren: en flaska, inköpspris = dagens pris om det finns. Ändras sedan i detaljvyn.
      // Caviste-lådan säger hur många flaskor av vinet den innehåller; övriga vägar ger 0 och blir en flaska.
      const row = await add(owned ? { ...preview, owned: true, count: preview.count > 0 ? preview.count : 1, price_paid: preview.price_paid ?? preview.price_current } : { ...preview, count: 0 })
      navigate(owned ? detailPath(row.id) : PATHS.wishlist)
    } catch {
      setError(S.error.generic)
      setBusy(null)
    }
  }

  const state = preview ? (preview.kind === 'wine' ? windowState(preview.drink_from, preview.drink_to) : null) : null
  const windowManual = preview !== null && preview.source_kind === 'systembolaget' && state !== 'unknown' && !editingWindow
  const fromVivino = preview !== null && preview.source_kind === 'manual' && preview.vivino_url !== null && fetchedAt !== null
  const idle = !preview && manual === null && scan === null && found === null && box === null && query.trim() === ''

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
            {busy === 'scan' ? S.scan.scanning : busy === 'search' ? S.search.searching : busy === 'fetch' ? S.add.fetching : S.add.fetch}
          </button>
        )}
        {idle && (
          <>
            <button className="fl-btn fl-btn--primary" type="button" disabled={busy !== null} onClick={() => fileInput.current?.click()}>
              {busy === 'scan' ? S.scan.scanning : S.scan.button}
            </button>
            <input ref={fileInput} type="file" accept="image/*" capture="environment" hidden onChange={onPhoto} />
            <div className="fl-small fl-muted">{S.scan.hint}</div>
            <a className="fl-link fl-small" href={PATHS.import}>
              {S.import.link}
            </a>
            <div className="fl-add__manual">
              <span className="fl-small fl-muted">{S.add.manual}:</span>
              {(['wine', 'spirit', 'beer'] as const).map((k) => (
                <button key={k} type="button" className="fl-chip" onClick={() => setManual(blank(k))}>
                  {S.add.manualKind[k]}
                </button>
              ))}
            </div>
          </>
        )}
      </form>

      {scan && (
        <div className="fl-card fl-add__card">
          <div className="fl-label">{S.scan.pick}</div>
          <div className="fl-small fl-muted">{scan.via === 'barcode' && scan.guess.ean ? S.scan.readBarcode(scan.guess.ean, describe(scan.guess)) : S.scan.read(describe(scan.guess))}</div>
          <CandidateList candidates={scan.candidates} disabled={busy !== null} onPick={pick} />
          <button
            type="button"
            className="fl-textbtn"
            onClick={() => {
              setManual(fromGuess(scan.guess))
              setScan(null)
            }}
          >
            {S.scan.none}
          </button>
        </div>
      )}

      {found && (
        <div className="fl-card fl-add__card">
          <div className="fl-label">{S.scan.pick}</div>
          <div className="fl-small fl-muted">{S.search.hits(found.length)}</div>
          <CandidateList candidates={found} disabled={busy !== null} onPick={pick} />
        </div>
      )}

      {box && (
        <div className="fl-card fl-add__card">
          <div className="fl-label">{S.caviste.pick}</div>
          <div className="fl-small fl-muted">{S.caviste.lead(box.length)}</div>
          <div className="fl-scan__list">
            {box.map((w) => (
              <button
                key={w.name}
                type="button"
                className="fl-scan__item"
                disabled={busy !== null}
                onClick={() => {
                  setPreview(w)
                  setBox(null)
                  setFetchedAt(new Date().toISOString())
                  setEditingWindow(false)
                }}
              >
                <Bottle url={w.image_url} size="md" />
                <span className="fl-scan__text">
                  <span className="fl-scan__name">{w.vintage ? `${w.name} ${w.vintage}` : w.name}</span>
                  <span className="fl-small fl-muted">{[S.caviste.bottles(w.count), w.category, w.price_current !== null ? kr(w.price_current) : null].filter(Boolean).join(' · ')}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {manual !== null && (
        <div className="fl-card fl-add__card">
          <div className="fl-label">
            {S.add.manualTitle} · {S.add.manualKind[manual.kind]}
          </div>
          <EditForm drink={manual} onCancel={() => setManual(null)} onSave={(p) => manualDone(manual.kind, p)} saveLabel={S.add.manualNext} />
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
                  {preview.vivino_rating !== null && <Rating drink={{ ...preview, id: 0, household_id: 0, last_drunk_on: null, last_rating: null, tasting_count: 0, created_at: '', updated_at: '' }} count />}
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
                <span className="fl-label">{S.add.taste(preview.source_kind)}</span>
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

/** Träfflistan, delad av skanningens tre kandidater och namnsökets träffar. Ett tryck hämtar hela raden. */
function CandidateList({ candidates, disabled, onPick }: { candidates: Candidate[]; disabled: boolean; onPick: (number: string) => void }) {
  return (
    <div className="fl-scan__list">
      {candidates.map((c) => (
        <button key={c.number} type="button" className="fl-scan__item" disabled={disabled} onClick={() => onPick(c.number)}>
          <Bottle url={c.image_url} size="md" />
          <span className="fl-scan__text">
            <span className="fl-scan__name">{c.vintage ? `${c.name} ${c.vintage}` : c.name}</span>
            <span className="fl-small fl-muted">{[c.producer, c.category, c.volume_ml !== null ? volume(c.volume_ml) : null, c.price !== null ? kr(c.price) : null].filter(Boolean).join(' · ')}</span>
          </span>
        </button>
      ))}
    </div>
  )
}

/** Flaskfotot: Systembolagets frilagda bild, eller platshållaren ur designen när bild saknas. */
export function Bottle({ url, size }: { url: string | null; size: 'sm' | 'md' | 'lg' | 'xl' }) {
  return url ? <img className={`fl-bottle fl-bottle--${size}`} src={url} alt="" loading="lazy" /> : <div className={`fl-bottle fl-bottle--${size} fl-bottle--empty`} />
}
