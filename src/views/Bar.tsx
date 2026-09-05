import { useState } from 'react'
import type { Drink, DrinkPatch, OpenLevel } from '../../shared/types.ts'
import { kr } from '../format.ts'
import { detailPath, navigate } from '../hash.ts'
import { IconChevron, IconMinus, IconPlus } from '../icons.tsx'
import { useStore } from '../store.tsx'
import { S } from '../strings.ts'
import { Bottle } from './Add.tsx'

// Barskåpet (design §3, beslut 14): ägd sprit, antal oöppnade plus en öppnad flaska med nivå i fjärdedelar.
// Desktop saknar artboard: samma kort i en kolumn på 720 px.
export function Bar() {
  const { drinks, patch } = useStore()
  const [showDepleted, setShowDepleted] = useState(false)
  if (drinks === null) return <div className="fl-muted">{S.loading}</div>
  const spirits = drinks.filter((d) => d.kind === 'spirit' && d.owned).sort((a, b) => a.name.localeCompare(b.name, 'sv'))
  const inStock = spirits.filter((d) => d.count > 0 || d.open_level !== null)
  const depleted = spirits.filter((d) => d.count === 0 && d.open_level === null)

  return (
    <div className="fl-bar">
      <div className="fl-head">
        <h1>{S.bar.title}</h1>
        <span className="fl-head__count">{S.bar.kinds(inStock.length)}</span>
      </div>
      <div className="fl-bar__list">
        {spirits.length === 0 && <p className="fl-muted">{S.bar.empty}</p>}
        {inStock.map((d) => (
          <SpiritCard key={d.id} drink={d} onPatch={(p) => patch(d.id, p)} />
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
    </div>
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
