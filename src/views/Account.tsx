import { useEffect, useState, type FormEvent } from 'react'
import { FatalError, NotFoundError } from '../../shared/errors.ts'
import type { Account as AccountData } from '../../shared/types.ts'
import { api } from '../api.ts'
import { authErrorMessage, deleteFirebaseUser, isAuthConfigured, signOutUser } from '../auth.ts'
import { useStore } from '../store.tsx'
import { S } from '../strings.ts'
import { Privacy } from './Login.tsx'

// Konto och hushåll (beslut 2, 2026-09-15): namn, medlemmar, inbjudningskod, gå med, logga ut, radera.
export function Account({ onAccountChanged }: { onAccountChanged: () => void }) {
  const { reload } = useStore()
  const [account, setAccount] = useState<AccountData | null>(null)
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [armed, setArmed] = useState(false)
  const [busy, setBusy] = useState(false)

  async function load() {
    const me = await api.me()
    setAccount(me)
    setName(me.household.name)
  }
  useEffect(() => {
    load().catch(() => setMessage(S.error.offline))
  }, [])

  async function rename(event: FormEvent) {
    event.preventDefault()
    if (name.trim() === '' || name.trim() === account?.household.name) return
    try {
      await api.renameHousehold(name.trim())
      await load()
      onAccountChanged()
    } catch {
      setMessage(S.error.generic)
    }
  }

  async function join(event: FormEvent) {
    event.preventDefault()
    if (code.trim() === '') return
    setBusy(true)
    setMessage(null)
    try {
      await api.joinHousehold(code.trim())
      setCode('')
      setMessage(S.account.joinDone)
      await load()
      await reload()
      onAccountChanged()
    } catch (err) {
      if (err instanceof NotFoundError) setMessage(S.account.joinNotFound)
      else if (err instanceof FatalError && err.status === 409) setMessage(S.account.joinNotEmpty)
      else if (err instanceof FatalError && err.status === 429) setMessage(S.account.joinTooMany)
      else setMessage(S.error.generic)
    } finally {
      setBusy(false)
    }
  }

  async function remove() {
    if (!armed) return setArmed(true)
    setBusy(true)
    try {
      await api.deleteAccount()
      await deleteFirebaseUser()
    } catch (err) {
      setMessage(err instanceof FatalError ? S.error.generic : authErrorMessage(err))
      setBusy(false)
    }
  }

  const auth = isAuthConfigured()
  return (
    <>
      <div className="fl-head">
        <h1>{S.account.title}</h1>
      </div>
      <div className="fl-account">
        {!auth && <p className="fl-muted">{S.account.gateMode}</p>}
        {account?.email && (
          <section className="fl-card fl-account__card">
            <div className="fl-label">{S.account.signedInAs}</div>
            <p>{account.email}</p>
            <button className="fl-btn fl-btn--secondary fl-btn--sm" type="button" onClick={() => void signOutUser()}>
              {S.account.signOut}
            </button>
          </section>
        )}
        {account && (
          <section className="fl-card fl-account__card">
            <div className="fl-label">{S.account.household}</div>
            <p className="fl-muted">{S.account.householdLead}</p>
            <form className="fl-account__row" onSubmit={(e) => void rename(e)}>
              <input className="fl-input" value={name} maxLength={60} aria-label={S.account.household} onChange={(e) => setName(e.target.value)} />
              <button className="fl-btn fl-btn--secondary" type="submit">
                {S.account.rename}
              </button>
            </form>
            {account.household.members.length > 0 && (
              <>
                <div className="fl-label">{S.account.members}</div>
                <ul className="fl-account__members">
                  {account.household.members.map((m) => (
                    <li key={m}>{m}</li>
                  ))}
                </ul>
              </>
            )}
          </section>
        )}
        {account && auth && (
          <section className="fl-card fl-account__card">
            <div className="fl-label">{S.account.invite}</div>
            <p className="fl-muted">{S.account.inviteLead}</p>
            <div className="fl-account__row">
              <code className="fl-account__code">{account.household.invite_code}</code>
              <button
                className="fl-btn fl-btn--secondary"
                type="button"
                onClick={() => void navigator.clipboard.writeText(account.household.invite_code).then(() => setCopied(true), () => setCopied(false))}
              >
                {copied ? S.account.copied : S.account.copy}
              </button>
            </div>
            <div className="fl-label">{S.account.join}</div>
            <p className="fl-muted">{S.account.joinLead}</p>
            <form className="fl-account__row" onSubmit={(e) => void join(e)}>
              <input className="fl-input" value={code} placeholder={S.account.joinPlaceholder} aria-label={S.account.join} autoCapitalize="off" onChange={(e) => setCode(e.target.value)} />
              <button className="fl-btn fl-btn--secondary" type="submit" disabled={busy}>
                {S.account.joinSubmit}
              </button>
            </form>
          </section>
        )}
        {message && <p className="fl-muted" role="status">{message}</p>}
        <section className="fl-card fl-account__card">
          <Privacy />
        </section>
        {account?.email && (
          <section className="fl-account__danger">
            <p className="fl-muted">{S.account.deleteLead}</p>
            <button className="fl-textbtn fl-account__delete" type="button" disabled={busy} onClick={() => void remove()}>
              {armed ? S.account.deleteConfirm : S.account.delete}
            </button>
          </section>
        )}
      </div>
    </>
  )
}
