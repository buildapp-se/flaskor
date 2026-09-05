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

/** Appikonen (512, maskable-säker) i valfri storlek. */
export const Logo = ({ size = 28 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 512 512" aria-hidden="true">
    <rect width="512" height="512" rx="112" fill="#85444F" />
    <rect x="148" y="176" width="96" height="232" rx="24" fill="#FBF7EF" />
    <rect x="176.8" y="112" width="38.4" height="80" rx="9.6" fill="#FBF7EF" />
    <rect x="268" y="232" width="96" height="176" rx="24" fill="#FBF7EF" />
    <rect x="296.8" y="168" width="38.4" height="80" rx="9.6" fill="#FBF7EF" />
  </svg>
)
