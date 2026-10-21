import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { detailPath, navigate, PATHS, useRoute } from './hash.ts'

let lastSubscribe: ((onChange: () => void) => () => void) | undefined

vi.mock('react', () => ({
  useSyncExternalStore: (
    subscribe: (onChange: () => void) => () => void,
    getSnapshot: () => string,
  ) => {
    lastSubscribe = subscribe
    return getSnapshot()
  },
}))

describe('hash-routing', () => {
  beforeEach(() => {
    const target = new EventTarget()
    const location = { hash: '' }
    vi.stubGlobal('window', {
      location,
      addEventListener: target.addEventListener.bind(target),
      removeEventListener: target.removeEventListener.bind(target),
      dispatchEvent: target.dispatchEvent.bind(target),
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('definierar sökvägar och flasklänk', () => {
    expect(PATHS).toEqual({
      cellar: '#/',
      wishlist: '#/onskelistan',
      bar: '#/barskapet',
      add: '#/lagg-till',
      import: '#/importera',
      account: '#/konto',
    })
    expect(detailPath(12)).toBe('#/flaska/12')
  })

  it('tolkar kända vyer och faller tillbaka på källaren', () => {
    navigate('#/')
    expect(useRoute()).toEqual({ view: 'cellar' })

    navigate('#/onskelistan')
    expect(useRoute()).toEqual({ view: 'wishlist' })

    navigate('#/barskapet')
    expect(useRoute()).toEqual({ view: 'bar' })

    navigate('#/importera')
    expect(useRoute()).toEqual({ view: 'import' })

    navigate('#/konto')
    expect(useRoute()).toEqual({ view: 'account' })

    navigate('#/okand')
    expect(useRoute()).toEqual({ view: 'cellar' })
  })

  it('tolkar detaljvy endast för heltal i #/flaska/:id', () => {
    navigate('#/flaska/12')
    expect(useRoute()).toEqual({ view: 'detail', id: 12 })

    navigate('#/flaska/7')
    expect(useRoute()).toEqual({ view: 'detail', id: 7 })

    navigate('prefix#/flaska/12')
    expect(useRoute()).toEqual({ view: 'cellar' })

    navigate('#/flaska/12/extra')
    expect(useRoute()).toEqual({ view: 'cellar' })

    navigate('#/flaska/abc')
    expect(useRoute()).toEqual({ view: 'cellar' })
  })

  it('tolkar lägg-till med och utan förifyllt sökord', () => {
    navigate('#/lagg-till')
    expect(useRoute()).toEqual({ view: 'add', q: '' })

    navigate('#/lagg-till?q=cointreau')
    expect(useRoute()).toEqual({ view: 'add', q: 'cointreau' })

    navigate('#/lagg-till?annat=1')
    expect(useRoute()).toEqual({ view: 'add', q: '' })

    navigate('#/lagg-till-extra')
    expect(useRoute()).toEqual({ view: 'cellar' })
  })

  it('prenumererar på hashchange och avregistrerar vid cleanup', () => {
    const onChange = vi.fn()
    useRoute()
    const unsubscribe = lastSubscribe!(onChange)

    window.dispatchEvent(new Event('hashchange'))
    expect(onChange).toHaveBeenCalledTimes(1)

    unsubscribe()
    window.dispatchEvent(new Event('hashchange'))
    expect(onChange).toHaveBeenCalledTimes(1)
  })
})
