import type { Drink } from '../../shared/types.ts'
import { S } from '../strings.ts'

/** Vivinos betyg som "★ 4,2", länkat till vinets sida. Inget alls när betyget saknas. */
export function Rating({ drink, count = false }: { drink: Drink; count?: boolean }) {
  if (drink.vivino_rating === null) return null
  const text = `★ ${String(drink.vivino_rating).replace('.', ',')}`
  const title = drink.vivino_count === null ? S.detail.vivino : S.rating.votes(drink.vivino_count)
  return drink.vivino_url ? (
    <a className="fl-rating" href={drink.vivino_url} target="_blank" rel="noreferrer" title={title}>
      {text}
      {count && drink.vivino_count !== null && <span className="fl-rating__count">({drink.vivino_count})</span>}
    </a>
  ) : (
    <span className="fl-rating" title={title}>
      {text}
    </span>
  )
}
