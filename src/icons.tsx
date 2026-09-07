// Ikoner ur design/Flaskor.dc.html §4: 20 px-rutnät, stroke 1.5, runda ändar. Färg via currentColor.
import type { ReactNode } from 'react'

function Icon({ children, size = 20 }: { children: ReactNode; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  )
}

export const IconCellar = () => (
  <Icon>
    <path d="M8 2h4v4l1.5 2.5V17a1 1 0 0 1-1 1h-5a1 1 0 0 1-1-1V8.5L8 6z" />
    <path d="M6.5 12h7" />
  </Icon>
)
export const IconWishlist = () => (
  <Icon>
    <path d="M5 3h10v14l-5-3.5L5 17z" />
  </Icon>
)
export const IconBar = () => (
  <Icon>
    <path d="M5 3h10l-1 14H6z" />
    <path d="M5.5 9h9" />
  </Icon>
)
export const IconAdd = () => (
  <Icon>
    <circle cx="10" cy="10" r="7.5" />
    <path d="M10 6.5v7M6.5 10h7" />
  </Icon>
)
export const IconSearch = () => (
  <Icon>
    <circle cx="9" cy="9" r="5.5" />
    <path d="M13 13l4 4" />
  </Icon>
)
export const IconPlus = () => (
  <Icon>
    <path d="M10 5v10M5 10h10" />
  </Icon>
)
export const IconMinus = () => (
  <Icon>
    <path d="M5 10h10" />
  </Icon>
)
export const IconExternal = () => (
  <Icon>
    <path d="M8 5h7v7M15 5l-9 9" />
  </Icon>
)
export const IconChevron = () => (
  <Icon>
    <path d="M6 8l4 4 4-4" />
  </Icon>
)

/** Sorteringsriktning: pil ner för fallande, upp för stigande. */
export const IconArrow = ({ dir }: { dir: 'asc' | 'desc' }) => (
  <Icon size={16}>
    {dir === 'desc' ? <path d="M10 4v12M5 11l5 5 5-5" /> : <path d="M10 16V4M5 9l5-5 5 5" />}
  </Icon>
)

/** Appikonen (512, kandidat A "Tre Bordeaux", maskable-säker) i valfri storlek. */
export const Logo = ({ size = 28 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 512 512" aria-hidden="true">
    <rect width="512" height="512" rx="112" fill="#85444F" />
    <rect x="132" y="112" width="32" height="12" rx="3" fill="#C9A9A9" />
    <path d="M135,122 V218 C135,246 109,248 109,280 V400 Q109,408 117,408 H179 Q187,408 187,400 V280 C187,248 161,246 161,218 V122 Z" fill="#C9A9A9" />
    <rect x="240" y="88" width="32" height="12" rx="3" fill="#FBF7EF" />
    <path d="M243,98 V194 C243,222 217,224 217,256 V400 Q217,408 225,408 H287 Q295,408 295,400 V256 C295,224 269,222 269,194 V98 Z" fill="#FBF7EF" />
    <rect x="348" y="112" width="32" height="12" rx="3" fill="#C9A9A9" />
    <path d="M351,122 V218 C351,246 325,248 325,280 V400 Q325,408 333,408 H395 Q403,408 403,400 V280 C403,248 377,246 377,218 V122 Z" fill="#C9A9A9" />
  </svg>
)
