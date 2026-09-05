import type { WindowState } from '../../shared/types.ts'
import { yearRange } from '../format.ts'
import { S } from '../strings.ts'

// Drickfönstrets piller (design §2): prick plus ord, aldrig bara färg. Okänt är streckat utan prick.
export function Pill({ state, large = false, from = null, to = null }: { state: WindowState; large?: boolean; from?: number | null; to?: number | null }) {
  const range = large ? yearRange(from, to) : null
  const text = state === 'unknown' ? (large ? S.pillUnknownLong : S.pill.unknown) : range ? `${S.pill[state]} · ${range}` : S.pill[state]
  return (
    <span className={large ? 'fl-pill fl-pill--lg' : 'fl-pill'} data-state={state}>
      <i />
      {text}
    </span>
  )
}
