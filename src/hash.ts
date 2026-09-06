import { useSyncExternalStore } from 'react'

// ponytail: hash-routing i 20 rader i stället för ett routerbibliotek. GitHub Pages kan inte skriva om djupa
// sökvägar till index.html, så #/flaska/12 är den enda länken som överlever en omladdning.

export type Route =
  | { view: 'cellar' }
  | { view: 'wishlist' }
  | { view: 'bar' }
  | { view: 'add' }
  | { view: 'import' }
  | { view: 'detail'; id: number }

export const PATHS = { cellar: '#/', wishlist: '#/onskelistan', bar: '#/barskapet', add: '#/lagg-till', import: '#/importera' } as const

export function detailPath(id: number): string {
  return `#/flaska/${id}`
}

function parse(hash: string): Route {
  const detail = hash.match(/^#\/flaska\/(\d+)$/)
  if (detail?.[1]) return { view: 'detail', id: Number(detail[1]) }
  if (hash === PATHS.wishlist) return { view: 'wishlist' }
  if (hash === PATHS.bar) return { view: 'bar' }
  if (hash === PATHS.add) return { view: 'add' }
  if (hash === PATHS.import) return { view: 'import' }
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
