import type { MouseEvent, ReactNode } from 'react'
import type { Drink } from '../../shared/types.ts'
import { windowState } from '../../shared/window.ts'
import { kr, yearRange } from '../format.ts'
import { detailPath, navigate } from '../hash.ts'
import { priceOf } from '../sort.ts'
import { S } from '../strings.ts'
import { Bottle } from '../views/Add.tsx'
import { Highlight, hits } from './Highlight.tsx'
import { Pill } from './Pill.tsx'
import { Rating } from './Rating.tsx'

/** Raden i Källaren (design §3): foto, namn och ursprung, piller, pris, antal, knappar. Mobilen visar pris och "N fl" till höger.
 * Träffar sökningen maten eller kommentaren visas det fältet som en extra rad med träffen markerad. */
export function DrinkRow({ drink, actions, query = '', muted = false }: { drink: Drink; actions?: ReactNode; query?: string; muted?: boolean }) {
  const state = windowState(drink.drink_from, drink.drink_to)
  const range = yearRange(drink.drink_from, drink.drink_to)
  const meta = [[drink.region, drink.country].filter(Boolean).join(', '), drink.grapes].filter(Boolean).join(' · ')
  const name = drink.vintage ? `${drink.name} ${drink.vintage}` : drink.name
  const hit = [drink.food, drink.note, drink.taste].find((f) => hits(f, query)) ?? null
  const price = priceOf(drink)

  function open(event: MouseEvent) {
    if ((event.target as HTMLElement).closest('button, a')) return
    navigate(detailPath(drink.id))
  }

  return (
    <div className={muted ? 'fl-row fl-row--muted' : 'fl-row'} onClick={open} role="link" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && navigate(detailPath(drink.id))}>
      <Bottle url={drink.image_url} size="md" />
      <div className="fl-row__main">
        <div className="fl-row__name">{name}</div>
        {meta && (
          <div className="fl-row__meta fl-desktop-only">
            {meta}
            <Rating drink={drink} />
          </div>
        )}
        <div className="fl-row__pill fl-mobile-only">
          <Pill state={state} />
          {range}
          <Rating drink={drink} />
        </div>
        {hit !== null && (
          <div className="fl-row__hit">
            <Highlight text={hit} query={query} />
          </div>
        )}
      </div>
      <div className="fl-row__pill fl-desktop-only">
        <Pill state={state} />
        {range}
      </div>
      <div className="fl-row__price">{price !== null ? kr(price) : ''}</div>
      <div className="fl-row__count">
        <span className="fl-desktop-only">{S.bottles(drink.count)}</span>
        <span className="fl-mobile-only">{S.bottlesShort(drink.count)}</span>
      </div>
      <div className="fl-row__actions fl-desktop-only">{actions}</div>
    </div>
  )
}
