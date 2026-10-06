import { useSyncExternalStore } from 'react'

// ponytail: hash-routing i 20 rader i stället för ett routerbibliotek. GitHub Pages kan inte skriva om djupa
// sökvägar till index.html, så #/flaska/12 är den enda länken som överlever en omladdning.

export type Route =
  | { view: 'cellar' }
  | { view: 'wishlist' }
  | { view: 'bar' }
  | { view: 'add'; q: string }
  | { view: 'import' }
  | { view: 'account' }
  | { view: 'detail'; id: number }

export const PATHS = { cellar: '#/', wishlist: '#/onskelistan', bar: '#/barskapet', add: '#/lagg-till', import: '#/importera', account: '#/konto' } as const

export function detailPath(id: number): string {
  return `#/flaska/${id}`
}

function parse(hash: string): Route {
  const detail = hash.match(/^#\/flaska\/(\d+)$/)
  if (detail?.[1]) return { view: 'detail', id: Number(detail[1]) }
  if (hash === PATHS.wishlist) return { view: 'wishlist' }
  if (hash === PATHS.bar) return { view: 'bar' }
  // #/lagg-till?q=cointreau: Sipdecks inköpshjälp öppnar söket förifyllt (ADR 0001). Produkten väljs här.
  if (hash === PATHS.add || hash.startsWith(`${PATHS.add}?`)) return { view: 'add', q: new URLSearchParams(hash.slice(PATHS.add.length + 1)).get('q') ?? '' }
  if (hash === PATHS.import) return { view: 'import' }
  if (hash === PATHS.account) return { view: 'account' }
  return { view: 'cellar' }
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener('hashchange', onChange)
  return () => window.removeEventListener('hashchange', onChange)
}

export function useRoute(): Route {
  return parse(useSyncExternalStore(subscribe, () => window.location.hash))
}

export function navigate(path: string): void {
  window.location.hash = path
}
