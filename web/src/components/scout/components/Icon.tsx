"use client";
import type { NodeSpec } from '../data'

type Name = NodeSpec['icon'] | 'check' | 'play' | 'lock' | 'spark' | 'search' | 'reset' | 'card' | 'upi' | 'bank' | 'wallet' | 'arrow'

const P: Record<Name, React.ReactNode> = {
  eye: (
    <>
      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  drop: <path d="M12 2.7s7 7.6 7 12.3a7 7 0 0 1-14 0C5 10.3 12 2.7 12 2.7Z" />,
  type: (
    <>
      <path d="M4 7V5h16v2" />
      <path d="M12 5v14M9 19h6" />
    </>
  ),
  image: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="3" />
      <circle cx="9" cy="10" r="2" />
      <path d="m21 16-5-5-9 9" />
    </>
  ),
  ear: (
    <>
      <path d="M6 9a6 6 0 1 1 12 0c0 3-2 4-3 5.5S14 18 12 20a3 3 0 0 1-5-2" />
      <path d="M9.5 9a2.5 2.5 0 0 1 5 0c0 1.5-1.5 2-1.5 3.5" />
    </>
  ),
  wave: <path d="M2 12h2l2-6 3 12 3-9 2 6 2-3h6" />,
  heart: <path d="M12 20s-7.5-4.6-9.2-9.2C1.6 7.3 4 4 7.3 4c2 0 3.5 1.2 4.7 2.8C13.2 5.2 14.7 4 16.7 4 20 4 22.4 7.3 21.2 10.8 19.5 15.4 12 20 12 20Z" />,
  key: (
    <>
      <circle cx="8" cy="15" r="4" />
      <path d="m10.8 12.2 8.7-8.7M17 6l2 2M14.5 8.5l2 2" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
      <path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14a6.5 6.5 0 0 1 3.5 6" />
    </>
  ),
  pin: (
    <>
      <path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21Z" />
      <circle cx="12" cy="9.5" r="2.5" />
    </>
  ),
  radar: (
    <>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <path d="M12 12 19 5" />
    </>
  ),
  coin: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M9 8h6M9 11h6M13 8c0 4-4 4-4 4l5 4" />
    </>
  ),
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  play: <path d="M7 4.5v15l12.5-7.5L7 4.5Z" fill="currentColor" />,
  lock: (
    <>
      <rect x="4.5" y="10.5" width="15" height="10" rx="2.5" />
      <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
    </>
  ),
  spark: <path d="M12 2.5 14 10l7.5 2-7.5 2-2 7.5-2-7.5-7.5-2 7.5-2 2-7.5Z" />,
  search: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4.5 4.5" />
    </>
  ),
  reset: (
    <>
      <path d="M4 12a8 8 0 1 0 2.4-5.7" />
      <path d="M4 4v4.5h4.5" />
    </>
  ),
  card: (
    <>
      <rect x="2.5" y="5" width="19" height="14" rx="2.5" />
      <path d="M2.5 9.5h19M6 15h4" />
    </>
  ),
  upi: <path d="m8 4 6 8-6 8M13 4l6 8-6 8" />,
  bank: (
    <>
      <path d="M3 9.5 12 4l9 5.5M4.5 20h15M6 10v7M10 10v7M14 10v7M18 10v7" />
    </>
  ),
  wallet: (
    <>
      <path d="M4 7.5A2.5 2.5 0 0 1 6.5 5H18v4" />
      <rect x="3.5" y="8" width="17" height="12" rx="2.5" />
      <circle cx="16" cy="14" r="1.3" fill="currentColor" />
    </>
  ),
  arrow: <path d="M5 12h14m-5-5 5 5-5 5" />,
}

export function Icon({ name, size = 18, stroke = 2 }: { name: Name; size?: number; stroke?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {P[name]}
    </svg>
  )
}
