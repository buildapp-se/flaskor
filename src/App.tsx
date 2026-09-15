import { useCallback, useEffect, useState } from 'react'
import { FatalError } from '../shared/errors.ts'
import { api, clearGate, findGate } from './api.ts'
import { isAuthConfigured, signOutUser, subscribeToAuth, type AuthUser } from './auth.ts'
import { kr } from './format.ts'
import { valueOf } from './sort.ts'
import { PATHS, useRoute } from './hash.ts'
import { IconAccount, IconAdd, IconBar, IconCellar, IconWishlist, Logo } from './icons.tsx'
import { StoreProvider, useStore } from './store.tsx'
import { S } from './strings.ts'
import { Account } from './views/Account.tsx'
import { Add } from './views/Add.tsx'
import { Bar } from './views/Bar.tsx'
import { Cellar } from './views/Cellar.tsx'
import { Detail } from './views/Detail.tsx'
import { Gate } from './views/Gate.tsx'
import { Import } from './views/Import.tsx'
import { Login, Verify } from './views/Login.tsx'
import { Wishlist } from './views/Wishlist.tsx'

const UID_KEY = 'flaskor.uid'
const CACHE_KEY = 'flaskor.drinks'

export function App() {
  return isAuthConfigured() ? <SignedIn /> : <GateApp />
}

/** Utan Firebase-konfiguration (src/config.ts): grindkoden som före 2026-09-15. */
function GateApp() {
  const [unlocked, setUnlocked] = useState(() => findGate() !== null)
  if (!unlocked) return <Gate onUnlocked={() => setUnlocked(true)} />
  return (
    <StoreProvider
      onLocked={() => {
        clearGate()
        setUnlocked(false)
      }}
    >
      <Shell />
    </StoreProvider>
  )
}

function SignedIn() {
  // undefined tills Firebase svarat, sedan användaren eller null.
  const [user, setUser] = useState<AuthUser | null | undefined>(undefined)
  const [ready, setReady] = useState(false)
  useEffect(() => subscribeToAuth((u) => setUser(u && { uid: u.uid, email: u.email, emailVerified: u.emailVerified })), [])

  const uid = user?.emailVerified ? user.uid : null
  useEffect(() => {
    setReady(false)
    if (uid === null) return
    void (async () => {
      // Ett annat konto än senast i den här webbläsaren: den cachade listan är inte dess.
      try {
        if (localStorage.getItem(UID_KEY) !== uid) localStorage.removeItem(CACHE_KEY)
        localStorage.setItem(UID_KEY, uid)
      } catch {
        /* cachen är en bekvämlighet */
      }
      // Flytten från grindkoden: en webbläsare som redan var upplåst tar kontot till hushåll 1 en gång, utan klick.
      const gate = findGate()
      if (gate) {
        try {
          await api.joinHousehold(gate)
          localStorage.removeItem(CACHE_KEY)
          clearGate()
        } catch (err) {
          // 404 (koden bytt) och 409 (kontot har redan rader) är slutgiltiga svar; nätfel försöker igen nästa gång.
          if (err instanceof FatalError) clearGate()
        }
      }
      setReady(true)
    })()
  }, [uid])

  if (user === undefined) return <div className="fl-gate fl-muted">{S.login.loading}</div>
  if (user === null) return <Login />
  if (!user.emailVerified) return <Verify user={user} onVerified={setUser} />
  if (!ready) return <div className="fl-gate fl-muted">{S.login.loading}</div>
  return (
    <StoreProvider key={user.uid} onLocked={() => void signOutUser()}>
      <Shell />
    </StoreProvider>
  )
}

const NAV = [
  { key: 'cellar', path: PATHS.cellar, label: S.nav.cellar, Icon: IconCellar },
  { key: 'wishlist', path: PATHS.wishlist, label: S.nav.wishlist, Icon: IconWishlist },
  { key: 'bar', path: PATHS.bar, label: S.nav.bar, Icon: IconBar },
  { key: 'add', path: PATHS.add, label: S.nav.add, Icon: IconAdd },
  { key: 'account', path: PATHS.account, label: S.nav.account, Icon: IconAccount },
] as const

function Shell() {
  const route = useRoute()
  const { drinks, error, undo, runUndo, dismissUndo } = useStore()
  const [household, setHousehold] = useState<string | null>(null)
  const loadHousehold = useCallback(() => {
    api.me().then((me) => setHousehold(me.household.name), () => setHousehold(null))
  }, [])
  useEffect(loadHousehold, [loadHousehold])
  // Detaljvyn hör till Källaren eller Barskåpet i navigeringen, importen till Lägg till.
  const active = route.view === 'detail' ? (drinks?.find((d) => d.id === route.id)?.kind === 'spirit' ? 'bar' : 'cellar') : route.view === 'import' ? 'add' : route.view
  const owned = drinks?.filter((d) => d.owned) ?? []
  const bottles = owned.reduce((sum, d) => sum + d.count, 0)
  const value = owned.reduce((sum, d) => sum + valueOf(d), 0)

  return (
    <div className="fl-app">
      <nav className="fl-side">
        <div className="fl-wordmark fl-wordmark--side">
          <Logo size={28} />
          <span>{S.appName}</span>
        </div>
        <div className="fl-side__links">
          {NAV.map(({ key, path, label, Icon }) => (
            <a key={key} href={path} className="fl-side__link" aria-current={active === key ? 'page' : undefined}>
              <Icon />
              {label}
            </a>
          ))}
        </div>
        <div className="fl-side__foot">
          {household}
          <br />
          {S.bottles(bottles)} · {kr(value)}
        </div>
      </nav>
      <main className="fl-main">
        {error && <div className="fl-error fl-error--bar">{error}</div>}
        {route.view === 'cellar' && <Cellar />}
        {route.view === 'wishlist' && <Wishlist />}
        {route.view === 'bar' && <Bar />}
        {route.view === 'add' && <Add />}
        {route.view === 'import' && <Import />}
        {route.view === 'account' && <Account onAccountChanged={loadHousehold} />}
        {route.view === 'detail' && <Detail id={route.id} />}
      </main>
      {undo && (
        <div className="fl-undo" role="status">
          <span>{undo}</span>
          <button type="button" onClick={runUndo}>
            {S.undo.undo}
          </button>
          <button type="button" className="fl-undo__close" aria-label={S.undo.close} onClick={dismissUndo}>
            ×
          </button>
        </div>
      )}
      <nav className="fl-bottom">
        {NAV.map(({ key, path, label, Icon }) => (
          <a key={key} href={path} className="fl-bottom__link" aria-current={active === key ? 'page' : undefined}>
            <Icon />
            {label}
          </a>
        ))}
      </nav>
    </div>
  )
}
