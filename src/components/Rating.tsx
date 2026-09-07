import type { Drink } from '../../shared/types.ts'
import { S } from '../strings.ts'

/** Betyget som "★ 4,2", länkat till källan: Vivino för vin, det egna/importerade betyget annars. Inget alls när det saknas. */
export function Rating({ drink, count = false }: { drink: Drink; count?: boolean }) {
  const vivino = drink.vivino_rating !== null
  const value = vivino ? drink.vivino_rating : drink.rating
  if (value === null) return null
  const url = vivino ? drink.vivino_url : drink.rating_url
  const text = `★ ${String(value).replace('.', ',')}`
  const title = vivino ? (drink.vivino_count === null ? S.detail.vivino : S.rating.votes(drink.vivino_count)) : S.rating.own
  return url ? (
    <a className="fl-rating" href={url} target="_blank" rel="noreferrer" title={title}>
      {text}
      {count && vivino && drink.vivino_count !== null && <span className="fl-rating__count">({drink.vivino_count})</span>}
    </a>
  ) : (
    <span className="fl-rating" title={title}>
      {text}
    </span>
  )
}
