import { useState } from 'react'
import { clearGate, findGate } from './api.ts'
import { kr } from './format.ts'
import { valueOf } from './sort.ts'
import { PATHS, useRoute } from './hash.ts'
import { IconAdd, IconBar, IconCellar, IconWishlist, Logo } from './icons.tsx'
import { StoreProvider, useStore } from './store.tsx'
import { S } from './strings.ts'
import { Add } from './views/Add.tsx'
import { Bar } from './views/Bar.tsx'
import { Cellar } from './views/Cellar.tsx'
import { Detail } from './views/Detail.tsx'
import { Gate } from './views/Gate.tsx'
import { Wishlist } from './views/Wishlist.tsx'

export function App() {
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

const NAV = [
  { key: 'cellar', path: PATHS.cellar, label: S.nav.cellar, Icon: IconCellar },
  { key: 'wishlist', path: PATHS.wishlist, label: S.nav.wishlist, Icon: IconWishlist },
  { key: 'bar', path: PATHS.bar, label: S.nav.bar, Icon: IconBar },
  { key: 'add', path: PATHS.add, label: S.nav.add, Icon: IconAdd },
] as const

function Shell() {
  const route = useRoute()
  const { drinks, error } = useStore()
  // Detaljvyn hör till Källaren eller Barskåpet i navigeringen.
  const active = route.view === 'detail' ? (drinks?.find((d) => d.id === route.id)?.kind === 'spirit' ? 'bar' : 'cellar') : route.view
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
          {S.household}
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
        {route.view === 'detail' && <Detail id={route.id} />}
      </main>
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
