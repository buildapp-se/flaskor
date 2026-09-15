import { useStore } from '../store.tsx'
import { S } from '../strings.ts'

export type LockReason = keyof typeof S.guest.locks

/** Kortet en gäst får när en funktion kräver konto (2026-09-15): varför, och en väg till inloggningen. */
export function Locked({ reason, onClose }: { reason: LockReason; onClose?: () => void }) {
  const { signIn } = useStore()
  return (
    <div className="fl-card fl-locked" role="note">
      <div className="fl-label">{S.guest.lockTitle}</div>
      <p className="fl-small">{S.guest.locks[reason]}</p>
      <div className="fl-locked__actions">
        <button type="button" className="fl-btn fl-btn--primary fl-btn--sm" onClick={signIn}>
          {S.guest.lockCta}
        </button>
        {onClose && (
          <button type="button" className="fl-textbtn" onClick={onClose}>
            {S.guest.lockClose}
          </button>
        )}
      </div>
    </div>
  )
}
