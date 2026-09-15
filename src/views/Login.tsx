import { useState, type FormEvent } from 'react'
import { authErrorMessage, refreshUser, registerWithEmail, resendVerification, sendPasswordReset, signInWithEmail, signInWithGoogle, signOutUser, type AuthUser } from '../auth.ts'
import { Logo } from '../icons.tsx'
import { localCount } from '../local.ts'
import { S } from '../strings.ts'

// Inloggningen (beslut 2, 2026-09-15). Samma kort som grinden: Google först, e-post under. Inget konto skapas i Workern
// här; första anropet efter inloggningen ger kontot ett eget hushåll.
export function Login({ onGuest }: { onGuest: () => void }) {
  const carried = localCount()
  const [mode, setMode] = useState<'signIn' | 'register'>('signIn')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function run(fn: () => Promise<void>) {
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      await fn()
    } catch (err) {
      setError(authErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    void run(() => (mode === 'signIn' ? signInWithEmail(email.trim(), password) : registerWithEmail(email.trim(), password)))
  }

  function forgot() {
    if (email.trim() === '') return setError(S.login.needEmail)
    void run(async () => {
      await sendPasswordReset(email.trim())
      setNotice(S.login.resetSent(email.trim()))
    })
  }

  return (
    <div className="fl-gate">
      <div className="fl-gate__card">
        <div className="fl-wordmark">
          <Logo size={40} />
          <span>{S.appName}</span>
        </div>
        <p className="fl-muted">{S.login.lead}</p>
        {carried > 0 && <p className="fl-small">{S.guest.carryOver(carried)}</p>}
        <button className="fl-btn fl-btn--primary" type="button" disabled={busy} onClick={() => void run(signInWithGoogle)}>
          {S.login.google}
        </button>
        <div className="fl-label">{S.login.or}</div>
        <form className="fl-login__form" onSubmit={submit}>
          <input className="fl-input" type="email" autoComplete="email" placeholder={S.login.email} aria-label={S.login.email} value={email} onChange={(e) => setEmail(e.target.value)} required />
          <input
            className="fl-input"
            type="password"
            autoComplete={mode === 'signIn' ? 'current-password' : 'new-password'}
            placeholder={S.login.password}
            aria-label={S.login.password}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={6}
            required
          />
          <button className="fl-btn fl-btn--secondary" type="submit" disabled={busy}>
            {mode === 'signIn' ? S.login.signIn : S.login.register}
          </button>
        </form>
        {error && <div className="fl-error">{error}</div>}
        {notice && <p className="fl-muted">{notice}</p>}
        <div className="fl-login__links">
          <button type="button" className="fl-textbtn" onClick={() => setMode(mode === 'signIn' ? 'register' : 'signIn')}>
            {mode === 'signIn' ? S.login.toRegister : S.login.toSignIn}
          </button>
          {mode === 'signIn' && (
            <button type="button" className="fl-textbtn" onClick={forgot}>
              {S.login.forgot}
            </button>
          )}
        </div>
        <div className="fl-login__guest">
          <button type="button" className="fl-btn fl-btn--secondary" onClick={onGuest}>
            {S.guest.tryIt}
          </button>
          <p className="fl-small fl-muted">{S.guest.tryLead}</p>
        </div>
        <Privacy />
      </div>
    </div>
  )
}

/** Konto skapat med lösenord men adressen inte bekräftad: Workern svarar 403 tills länken i mejlet är klickad. */
export function Verify({ user, onVerified }: { user: AuthUser; onVerified: (user: AuthUser) => void }) {
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function check() {
    setBusy(true)
    try {
      const fresh = await refreshUser()
      if (fresh?.emailVerified) onVerified({ uid: fresh.uid, email: fresh.email, emailVerified: true })
      else setMessage(S.login.verifyStill)
    } catch (err) {
      setMessage(authErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fl-gate">
      <div className="fl-gate__card">
        <div className="fl-wordmark">
          <Logo size={40} />
          <span>{S.appName}</span>
        </div>
        <div>
          <div className="fl-label">{S.login.verifyTitle}</div>
          <p className="fl-muted">{S.login.verifyLead(user.email ?? '')}</p>
        </div>
        <button className="fl-btn fl-btn--primary" type="button" disabled={busy} onClick={() => void check()}>
          {S.login.verifyDone}
        </button>
        {message && <p className="fl-muted">{message}</p>}
        <div className="fl-login__links">
          <button type="button" className="fl-textbtn" onClick={() => void resendVerification().then(() => setMessage(S.login.verifySent), (err: unknown) => setMessage(authErrorMessage(err)))}>
            {S.login.verifyResend}
          </button>
          <button type="button" className="fl-textbtn" onClick={() => void signOutUser()}>
            {S.login.signOut}
          </button>
        </div>
      </div>
    </div>
  )
}

export function Privacy() {
  return (
    <details className="fl-privacy">
      <summary>{S.account.privacy}</summary>
      {S.privacy.map((p) => (
        <p key={p}>{p}</p>
      ))}
    </details>
  )
}
