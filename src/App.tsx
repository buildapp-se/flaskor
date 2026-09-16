import { useCallback, useEffect, useState } from 'react'
import { api, clearGate, findGate } from './api.ts'
import { isAuthConfigured, signOutUser, subscribeToAuth, type AuthUser } from './auth.ts'
import { kr } from './format.ts'
import { localCount, uploadLocal } from './local.ts'
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
/** Gästläget valt på inloggningskortet (2026-09-15). Sparas så appen öppnar som gäst nästa gång också. */
const GUEST_KEY = 'flaskor.guest'
const BANNER_KEY = 'flaskor.guestBannerHidden'

function readFlag(key: string, storage: Storage): boolean {
  try {
    return storage.getItem(key) === '1'
  } catch {
    return false
  }
}

function writeFlag(key: string, storage: Storage, on: boolean): void {
  try {
    if (on) storage.setItem(key, '1')
    else storage.removeItem(key)
  } catch {
    /* utan lagring gäller valet bara den här sidladdningen */
  }
}
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
  const [guest, setGuestState] = useState(() => readFlag(GUEST_KEY, localStorage))
  const setGuest = (on: boolean) => {
    writeFlag(GUEST_KEY, localStorage, on)
    setGuestState(on)
  }
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
      // Grindkoden ger inte längre hushåll 1 (2026-09-16); en sparad kod från förr glöms bara.
      clearGate()
      // Från gästläget: de lokala flaskorna följer med när kontots hushåll är tomt. Har kontot redan flaskor
      // frågar Konto i stället, så inget blandas ihop utan att användaren valt det.
      writeFlag(GUEST_KEY, localStorage, false)
      if (localCount() > 0) {
        try {
          if ((await api.listDrinks()).length === 0) await uploadLocal()
        } catch (err) {
          console.error('lokala flaskor kunde inte laddas upp', err)
        }
      }
      setReady(true)
    })()
  }, [uid])

  if (user === undefined) return <div className="fl-gate fl-muted">{S.login.loading}</div>
  if (user === null) {
    if (guest)
      return (
        <StoreProvider key="guest" guest onLocked={() => setGuest(false)} onSignIn={() => setGuest(false)}>
          <Shell />
        </StoreProvider>
      )
    return <Login onGuest={() => setGuest(true)} />
  }
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
  const { drinks, error, undo, runUndo, dismissUndo, guest, signIn, notice, dismissNotice } = useStore()
  // Påminnelsen överst kan döljas, men bara för den här sessionen: nästa besök syns den igen.
  const [bannerHidden, setBannerHidden] = useState(() => readFlag(BANNER_KEY, sessionStorage))
  const [household, setHousehold] = useState<string | null>(null)
  const loadHousehold = useCallback(() => {
    if (guest) return setHousehold(S.guest.householdName)
    api.me().then((me) => setHousehold(me.household.name), () => setHousehold(null))
  }, [guest])
  useEffect(loadHousehold, [loadHousehold])
  // Detaljvyn hör till Källaren eller Barskåpet i navigeringen, importen till Lägg till.
  const active = route.view === 'detail' ? (drinks?.find((d) => d.id === route.id)?.kind === 'spirit' ? 'bar' : 'cellar') : route.view === 'import' ? 'add' : route.view
  const owned = drinks?.filter((d) => d.owned) ?? []
  const bottles = owned.reduce((sum, d) => sum + d.count, 0)
  const value = owned.reduce((sum, d) => sum + valueOf(d), 0)

  return (
    <div className="fl-app">
      <nav className="fl-side">
        <a href={PATHS.cellar} className="fl-wordmark fl-wordmark--side">
          <Logo size={28} />
          <span>{S.appName}</span>
        </a>
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
        {guest && !bannerHidden && (
          <div className="fl-guestbar" role="note">
            <span>
              <strong>{S.guest.banner}</strong>{' '}
              <button type="button" className="fl-guestbar__cta" onClick={signIn}>
                {S.guest.bannerCta}
              </button>{' '}
              {S.guest.bannerLead}
            </span>
            <button
              type="button"
              className="fl-guestbar__close"
              aria-label={S.guest.bannerClose}
              onClick={() => {
                writeFlag(BANNER_KEY, sessionStorage, true)
                setBannerHidden(true)
              }}
            >
              ×
            </button>
          </div>
        )}
        {error && <div className="fl-error fl-error--bar">{error}</div>}
        {route.view === 'cellar' && <Cellar />}
        {route.view === 'wishlist' && <Wishlist />}
        {route.view === 'bar' && <Bar />}
        {route.view === 'add' && <Add />}
        {route.view === 'import' && <Import />}
        {route.view === 'account' && <Account onAccountChanged={loadHousehold} />}
        {route.view === 'detail' && <Detail id={route.id} />}
      </main>
      {notice && !undo && (
        <div className="fl-undo" role="status">
          <span>{notice}</span>
          <button type="button" onClick={signIn}>
            {S.guest.bannerCta}
          </button>
          <button type="button" className="fl-undo__close" aria-label={S.undo.close} onClick={dismissNotice}>
            ×
          </button>
        </div>
      )}
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
