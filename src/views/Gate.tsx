import { useState, type FormEvent } from 'react'
import { UnauthorizedError } from '../../shared/errors.ts'
import { api, setGate } from '../api.ts'
import { Logo } from '../icons.tsx'
import { S } from '../strings.ts'

// Grindvyn saknas i designleveransen: ett kort med tokens ur §1, inget mer. Bokfört i HANDOFF §Val tagna åt Patrik.
export function Gate({ onUnlocked }: { onUnlocked: () => void }) {
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (code.trim() === '') return
    setBusy(true)
    setError(null)
    setGate(code.trim())
    try {
      await api.ping()
      onUnlocked()
    } catch (err) {
      setError(err instanceof UnauthorizedError ? S.gate.wrong : S.gate.offline)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fl-gate">
      <form className="fl-gate__card" onSubmit={submit}>
        <div className="fl-wordmark">
          <Logo size={40} />
          <span>{S.appName}</span>
        </div>
        <div>
          <div className="fl-label">{S.gate.title}</div>
          <p className="fl-muted">{S.gate.lead}</p>
        </div>
        <input className="fl-input" type="password" autoComplete="current-password" placeholder={S.gate.placeholder} value={code} onChange={(e) => setCode(e.target.value)} autoFocus />
        {error && <div className="fl-error">{error}</div>}
        <button className="fl-btn fl-btn--primary" type="submit" disabled={busy}>
          {S.gate.submit}
        </button>
      </form>
    </div>
  )
}
