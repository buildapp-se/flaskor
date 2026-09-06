import { useEffect, useRef, useState } from 'react'
import type { Drink, Kind } from '../../shared/types.ts'
import { articleNo, kr } from '../format.ts'
import { detailPath, navigate } from '../hash.ts'
import { Rating } from '../components/Rating.tsx'
import { IconExternal, IconMinus, IconPlus } from '../icons.tsx'
import { useStore } from '../store.tsx'
import { S } from '../strings.ts'
import { Bottle } from './Add.tsx'

// Önskelistan (design §3, beslut 29): vin och sprit i samma lista, ett tryck "Köpt" öppnar rutan med antal och pris.
// Desktop saknar artboard: samma lista i en kolumn på 720 px, rutan centrerad i stället för längst ner.
export function Wishlist() {
  const { drinks, patch } = useStore()
  const [kind, setKind] = useState<Kind | null>(null)
  const [buying, setBuying] = useState<Drink | null>(null)

  if (drinks === null) return <div className="fl-muted">{S.loading}</div>
  const wished = drinks.filter((d) => !d.owned)
  const visible = wished.filter((d) => kind === null || d.kind === kind)

  return (
    <div className="fl-wishlist">
      <div className="fl-head">
        <h1>{S.wishlist.title}</h1>
        <span className="fl-head__count">{S.wishlist.items(wished.length)}</span>
      </div>
      <div className="fl-chips fl-wishlist__chips">
        <button className="fl-chip" aria-pressed={kind === null} onClick={() => setKind(null)}>
          {S.wishlist.all}
        </button>
        <button className="fl-chip" aria-pressed={kind === 'wine'} onClick={() => setKind('wine')}>
          {S.wishlist.wine}
        </button>
        <button className="fl-chip" aria-pressed={kind === 'spirit'} onClick={() => setKind('spirit')}>
          {S.wishlist.spirit}
        </button>
      </div>
      {wished.length === 0 && <p className="fl-muted">{S.wishlist.empty}</p>}
      {visible.length > 0 && (
        <div className="fl-card fl-list">
          {visible.map((d) => (
            <WishRow key={d.id} drink={d} onBuy={() => setBuying(d)} />
          ))}
        </div>
      )}
      {buying && (
        <BoughtSheet
          drink={buying}
          onCancel={() => setBuying(null)}
          onConfirm={async (count, price) => {
            setBuying(null)
            // Sprit börjar oöppnad; en öppnad flaska registreras i Barskåpet.
            await patch(buying.id, { owned: true, count, price_paid: price })
          }}
        />
      )}
    </div>
  )
}

function WishRow({ drink, onBuy }: { drink: Drink; onBuy: () => void }) {
  const gone = drink.availability === 'discontinued'
  const price = drink.price_current ?? drink.price_paid
  const source = drink.source_kind === 'systembolaget' ? S.wishlist.availability[drink.availability] : drink.source_kind === 'caviste' ? S.wishlist.availability.unknown : null
  // Numret är en länk till produktsidan: där minns Systembolaget din valda butik, så lagret för den syns direkt.
  const number = drink.source_id ? (drink.source_kind === 'systembolaget' ? `${S.wishlist.number} ${articleNo(drink.source_id)}` : drink.source_kind === 'caviste' ? `CAV ${drink.source_id}` : null) : null
  const name = drink.vintage ? `${drink.name} ${drink.vintage}` : drink.name
  return (
    <div className={gone ? 'fl-wish fl-wish--gone' : 'fl-wish'}>
      <Bottle url={drink.image_url} size="sm" />
      <div className="fl-wish__main" onClick={(e) => !(e.target as HTMLElement).closest('a') && navigate(detailPath(drink.id))}>
        <div className="fl-wish__name">{name}</div>
        <div className="fl-wish__line">
          {price !== null && <span className="fl-wish__price">{kr(price)}</span>}
          {price !== null && ' · '}
          {source}
          {source && number && ' · '}
          {number &&
            (drink.source_url ? (
              <a className="fl-wish__link" href={drink.source_url} target="_blank" rel="noreferrer">
                {number}
                <IconExternal />
              </a>
            ) : (
              number
            ))}
          <Rating drink={drink} count />
        </div>
      </div>
      <button className={gone ? 'fl-btn fl-btn--sm fl-btn--secondary' : 'fl-btn fl-btn--sm fl-btn--primary'} onClick={onBuy}>
        {S.wishlist.bought}
      </button>
    </div>
  )
}

function BoughtSheet({ drink, onCancel, onConfirm }: { drink: Drink; onCancel: () => void; onConfirm: (count: number, price: number | null) => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  const [count, setCount] = useState(1)
  const [price, setPrice] = useState(drink.price_current === null ? '' : String(drink.price_current))
  const spirit = drink.kind === 'spirit'

  useEffect(() => {
    ref.current?.showModal()
  }, [])

  return (
    <dialog ref={ref} className="fl-sheet" onClose={onCancel} onClick={(e) => e.target === ref.current && onCancel()}>
      <div className="fl-sheet__body">
        <div className="fl-stack-4">
          <div className="fl-label">{S.wishlist.sheet.title}</div>
          <div className="fl-sheet__name">{drink.vintage ? `${drink.name} ${drink.vintage}` : drink.name}</div>
          <div className="fl-small fl-muted">{spirit ? S.wishlist.sheet.toBar : S.wishlist.sheet.toCellar}</div>
        </div>
        <div className="fl-sheet__fields">
          <label className="fl-field">
            <span className="fl-label">{S.wishlist.sheet.count}</span>
            <div className="fl-counter">
              <button type="button" onClick={() => setCount((c) => Math.max(1, c - 1))} aria-label="−">
                <IconMinus />
              </button>
              <span>{count}</span>
              <button type="button" onClick={() => setCount((c) => c + 1)} aria-label="+">
                <IconPlus />
              </button>
            </div>
          </label>
          <label className="fl-field">
            <span className="fl-label">{S.wishlist.sheet.price}</span>
            <div className="fl-money">
              <input inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} />
              <span>{S.units.kr}</span>
            </div>
          </label>
        </div>
        <div className="fl-sheet__actions">
          <button type="button" className="fl-btn fl-btn--secondary" onClick={onCancel}>
            {S.wishlist.sheet.cancel}
          </button>
          <button type="button" className="fl-btn fl-btn--primary" onClick={() => onConfirm(count, price.trim() === '' ? null : Number(price.replace(',', '.')))}>
            {spirit ? S.wishlist.sheet.confirmBar : S.wishlist.sheet.confirmCellar}
          </button>
        </div>
      </div>
    </dialog>
  )
}
