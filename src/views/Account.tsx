import { useEffect, useRef, useState, type FormEvent } from 'react'
import { FatalError, NotFoundError } from '../../shared/errors.ts'
import type { Account as AccountData, ExportData, ImportItem, SipdeckCode, SipdeckLink } from '../../shared/types.ts'
import { api } from '../api.ts'
import { dateShort } from '../format.ts'
import { linkUrl } from '../sipdeck.ts'
import { authErrorMessage, deleteFirebaseUser, isAuthConfigured, signOutUser } from '../auth.ts'
import { download, exportName, parseExport, toCsv, toJson } from '../export.ts'
import { clearLocal, ImportAbortedError, importItems, ImportTooLargeError, localCount, localExport, uploadLocal } from '../local.ts'
import { useStore } from '../store.tsx'
import { S } from '../strings.ts'
import { Privacy } from './Login.tsx'

// Konto och hushåll (beslut 2, 2026-09-15): namn, medlemmar, inbjudningskod, gå med, logga ut, radera.
export function Account({ onAccountChanged }: { onAccountChanged: () => void }) {
  const { guest } = useStore()
  if (guest) return <GuestAccount />
  return <SignedInAccount onAccountChanged={onAccountChanged} />
}

function SignedInAccount({ onAccountChanged }: { onAccountChanged: () => void }) {
  const { reload } = useStore()
  const [pending, setPending] = useState(localCount)
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
        {account?.email && auth && <SipdeckCard />}
        {pending > 0 && account?.email && (
          <section className="fl-card fl-account__card">
            <div className="fl-label">{S.guest.pendingTitle(pending)}</div>
            <p className="fl-muted">{S.guest.pendingLead}</p>
            <div className="fl-account__row">
              <button
                className="fl-btn fl-btn--primary"
                type="button"
                disabled={busy}
                onClick={() => {
                  setBusy(true)
                  uploadLocal()
                    .then(async (n) => {
                      setMessage(S.guest.pendingDone(n))
                      setPending(localCount())
                      await reload()
                    })
                    .catch(() => setMessage(S.error.generic))
                    .finally(() => setBusy(false))
                }}
              >
                {S.guest.pendingUpload}
              </button>
              <button
                className="fl-textbtn"
                type="button"
                onClick={() => {
                  clearLocal()
                  setPending(0)
                }}
              >
                {S.guest.pendingDiscard}
              </button>
            </div>
          </section>
        )}
        {message && <p className="fl-muted" role="status">{message}</p>}
        <ExportCard load={api.exportData} />
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

/**
 * Valfri koppling till Sipdeck (ADR 0001). En medlem skapar en engångskod, och den som är inloggad i Sipdeck
 * löser in den där: inget kopplas av sig självt, inte heller när e-postadressen är densamma i båda apparna.
 */
function SipdeckCard() {
  const [links, setLinks] = useState<SipdeckLink[]>([])
  const [code, setCode] = useState<SipdeckCode | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const load = () => api.sipdeckLinks().then(setLinks, () => setMessage(S.error.offline))
  useEffect(() => {
    void load()
  }, [])

  async function create() {
    setBusy(true)
    setMessage(null)
    try {
      setCode(await api.sipdeckCode())
    } catch (err) {
      setMessage(err instanceof FatalError && err.status === 429 ? S.sipdeck.tooMany : S.error.generic)
    } finally {
      setBusy(false)
    }
  }

  async function revoke(id: number) {
    try {
      await api.revokeSipdeckLink(id)
      setMessage(S.sipdeck.revoked)
    } catch {
      setMessage(S.error.generic)
    }
    await load()
  }

  return (
    <section className="fl-card fl-account__card">
      <div className="fl-label">{S.sipdeck.title}</div>
      <p className="fl-muted">{S.sipdeck.lead}</p>
      {code === null ? (
        <button className="fl-btn fl-btn--secondary" type="button" disabled={busy} onClick={() => void create()}>
          {S.sipdeck.create}
        </button>
      ) : (
        <>
          <p className="fl-muted">{S.sipdeck.codeLead}</p>
          <div className="fl-account__row">
            <a className="fl-btn fl-btn--primary" href={linkUrl(code.code)} target="_blank" rel="noreferrer">
              {S.sipdeck.open}
            </a>
          </div>
          <div className="fl-account__row">
            <code className="fl-account__code">{code.code}</code>
            <button className="fl-btn fl-btn--secondary" type="button" onClick={() => void navigator.clipboard.writeText(code.code).then(() => setMessage(S.account.copied), () => undefined)}>
              {S.account.copy}
            </button>
          </div>
        </>
      )}
      {links.length > 0 && (
        <>
          <div className="fl-label">{S.sipdeck.linked}</div>
          <ul className="fl-account__members">
            {links.map((l) => (
              <li key={l.id}>
                {l.email ?? S.sipdeck.noEmail} <span className="fl-muted">{S.sipdeck.since(dateShort(l.created_at))}</span>{' '}
                <button className="fl-textbtn" type="button" onClick={() => void revoke(l.id)}>
                  {S.sipdeck.revoke}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
      {message && <p className="fl-muted" role="status">{message}</p>}
    </section>
  )
}

/** Konto-fliken för en gäst (2026-09-15): vad som fungerar utan konto, vad som kräver ett, export och rensning. */
function GuestAccount() {
  const { signIn, reload } = useStore()
  const [armed, setArmed] = useState(false)
  const count = localCount()
  return (
    <>
      <div className="fl-head">
        <h1>{S.account.title}</h1>
      </div>
      <div className="fl-account">
        <section className="fl-card fl-account__card">
          <div className="fl-label">{S.guest.accountTitle}</div>
          <p>{S.guest.accountLead}</p>
          <button className="fl-btn fl-btn--primary" type="button" onClick={signIn}>
            {S.guest.create}
          </button>
          {count > 0 && <p className="fl-small fl-muted">{S.guest.carryOver(count)}</p>}
        </section>
        <section className="fl-card fl-account__card fl-account__compare">
          <div>
            <div className="fl-label">{S.guest.localWorks}</div>
            <ul className="fl-account__members">
              {S.guest.localWorksList.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          </div>
          <div>
            <div className="fl-label">{S.guest.needsAccount}</div>
            <ul className="fl-account__members">
              {S.guest.needsAccountList.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          </div>
        </section>
        <ExportCard load={async () => localExport()} />
        <section className="fl-card fl-account__card">
          <Privacy />
        </section>
        {count > 0 && (
          <section className="fl-account__danger">
            <p className="fl-muted">{S.guest.clearLead}</p>
            <button
              className="fl-textbtn fl-account__delete"
              type="button"
              onClick={() => {
                if (!armed) return setArmed(true)
                clearLocal()
                setArmed(false)
                void reload()
              }}
            >
              {armed ? S.guest.clearConfirm : S.guest.clear}
            </button>
          </section>
        )}
      </div>
    </>
  )
}

/** Största exportfil som läses in. En rad är cirka 1,5 kB, så 5 MB är tusentals flaskor. */
const IMPORT_FILE_MAX = 5_000_000

/** Exportera data som JSON (allt) eller CSV (en rad per flaska), och läs in en JSON-export igen. Samma kort för gäst och konto, bara källan skiljer. */
function ExportCard({ load }: { load: () => Promise<ExportData> }) {
  const { guest, reload } = useStore()
  const [error, setError] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  /** Raderna som inte kom fram när en kontoimport bröts. Fortsätt skickar dem, inte hela filen igen. */
  const [rest, setRest] = useState<ImportItem[] | null>(null)
  const file = useRef<HTMLInputElement>(null)
  async function run(format: 'json' | 'csv') {
    setError(false)
    try {
      const data = await load()
      if (format === 'json') download(exportName('json'), toJson(data), 'application/json')
      else download(exportName('csv'), toCsv(data.drinks), 'text/csv;charset=utf-8')
    } catch {
      setError(true)
    }
  }
  async function send(items: ImportItem[]) {
    setBusy(true)
    setRest(null)
    setMessage(S.exportData.importing)
    try {
      setMessage(S.exportData.imported(items.length === 0 ? 0 : await importItems(items, guest)))
    } catch (err) {
      if (err instanceof ImportAbortedError) {
        setRest(items.slice(err.sent))
        setMessage(S.exportData.importAborted(err.sent, items.length))
      } else setMessage(err instanceof ImportTooLargeError ? S.exportData.importTooLarge : S.exportData.importNothing)
    }
    await reload()
    setBusy(false)
  }
  async function importFile(picked: File) {
    let items
    try {
      if (picked.size > IMPORT_FILE_MAX) throw new FatalError('file too large')
      items = parseExport(await picked.text())
    } catch {
      setRest(null)
      setMessage(S.exportData.importBad)
      return
    }
    await send(items)
  }
  return (
    <section className="fl-card fl-account__card">
      <div className="fl-label">{S.exportData.title}</div>
      <p className="fl-muted">{S.exportData.lead}</p>
      <div className="fl-account__row">
        <button className="fl-btn fl-btn--secondary" type="button" onClick={() => void run('json')}>
          {S.exportData.json}
        </button>
        <button className="fl-btn fl-btn--secondary" type="button" onClick={() => void run('csv')}>
          {S.exportData.csv}
        </button>
      </div>
      {error && <div className="fl-error">{S.exportData.failed}</div>}
      <p className="fl-muted">{S.exportData.importLead}</p>
      <div className="fl-account__row">
        <button className="fl-btn fl-btn--secondary" type="button" disabled={busy} onClick={() => file.current?.click()}>
          {S.exportData.importJson}
        </button>
        {rest && (
          <button className="fl-btn fl-btn--primary" type="button" disabled={busy} onClick={() => void send(rest)}>
            {S.exportData.importResume}
          </button>
        )}
        <input
          ref={file}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => {
            const picked = e.target.files?.[0]
            // Nollställ, så samma fil går att välja igen.
            e.target.value = ''
            if (picked) void importFile(picked)
          }}
        />
      </div>
      {message && <p className="fl-muted" role="status">{message}</p>}
    </section>
  )
}
