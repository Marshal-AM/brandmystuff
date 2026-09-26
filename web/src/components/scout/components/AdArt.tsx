"use client";
import type { ArtKind } from '../data'

const I = 'var(--ink)'
const P = 'var(--p)'
const W = '#fff'

function Ad({ x, y, w, h }: { x: number; y: number; w: number; h: number }) {
  // a generic ad creative: sun glyph + headline bars
  const r = Math.min(w, h) * 0.22
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={Math.min(8, h * 0.1)} fill={W} />
      <circle cx={x + w * 0.24} cy={y + h * 0.5} r={r} fill={P} />
      <rect x={x + w * 0.44} y={y + h * 0.3} width={w * 0.42} height={h * 0.12} rx={h * 0.06} fill={I} />
      <rect x={x + w * 0.44} y={y + h * 0.52} width={w * 0.3} height={h * 0.1} rx={h * 0.05} fill={I} opacity={0.35} />
    </g>
  )
}

const ARTS: Record<ArtKind, React.ReactNode> = {
  billboard: (
    <>
      <rect width="320" height="200" fill="var(--p-800)" />
      <circle cx="262" cy="46" r="20" fill={P} opacity="0.8" />
      <path d="M0 150 h30 v-40 h24 v40 h14 v-62 h30 v62 h20 v-30 h26 v30 h40 v-50 h22 v50 h30 v-36 h28 v36 h56 V200 H0Z" fill={I} />
      <rect x="112" y="118" width="6" height="60" fill={W} />
      <rect x="202" y="118" width="6" height="60" fill={W} />
      <rect x="84" y="46" width="152" height="78" rx="6" fill={I} stroke={W} strokeWidth="3" />
      <Ad x={92} y={54} w={136} h={62} />
    </>
  ),
  metro: (
    <>
      <rect width="320" height="200" fill="var(--p-900)" />
      <rect x="0" y="150" width="320" height="50" fill={I} />
      <rect x="0" y="146" width="320" height="4" fill={P} />
      <rect x="-10" y="70" width="250" height="70" rx="22" fill="var(--p-300)" />
      {[20, 70, 120, 170].map((x) => (
        <rect key={x} x={x} y="84" width="36" height="24" rx="6" fill={I} />
      ))}
      <rect x="-10" y="116" width="250" height="6" fill={P} />
      <rect x="252" y="20" width="44" height="130" rx="4" fill={W} />
      <rect x="252" y="50" width="44" height="60" fill={P} />
      <circle cx="274" cy="80" r="12" fill={W} />
      <rect x="252" y="20" width="44" height="130" rx="4" fill="none" stroke={I} strokeWidth="2" />
    </>
  ),
  bus: (
    <>
      <rect width="320" height="200" fill="var(--p-200)" />
      <rect x="0" y="168" width="320" height="32" fill={I} />
      <rect x="20" y="176" width="40" height="4" fill={W} />
      <rect x="120" y="176" width="40" height="4" fill={W} />
      <rect x="220" y="176" width="40" height="4" fill={W} />
      <rect x="60" y="36" width="200" height="12" rx="4" fill={I} />
      <rect x="70" y="48" width="6" height="120" fill={I} />
      <rect x="244" y="48" width="6" height="120" fill={I} />
      <rect x="82" y="56" width="68" height="100" rx="4" fill={W} fillOpacity="0.5" stroke={I} strokeWidth="2" />
      <rect x="160" y="56" width="78" height="100" rx="4" fill={P} stroke={I} strokeWidth="2" />
      <circle cx="199" cy="92" r="18" fill={W} />
      <rect x="176" y="122" width="46" height="8" rx="4" fill={I} />
      <rect x="92" y="136" width="50" height="8" rx="3" fill={I} />
    </>
  ),
  podcast: (
    <>
      <rect width="320" height="200" fill="var(--p-100)" />
      {[60, 84, 108].map((r, i) => (
        <path key={r} d={`M${160 - r} 96 a${r} ${r} 0 0 1 ${r * 2} 0`} fill="none" stroke={P} strokeWidth="6" strokeLinecap="round" opacity={1 - i * 0.28} />
      ))}
      <rect x="136" y="44" width="48" height="84" rx="24" fill={I} />
      {[62, 74, 86, 98].map((y) => (
        <rect key={y} x="144" y={y} width="32" height="4" rx="2" fill={P} opacity="0.7" />
      ))}
      <path d="M120 104 a40 40 0 0 0 80 0" fill="none" stroke={I} strokeWidth="6" strokeLinecap="round" />
      <rect x="157" y="144" width="6" height="22" fill={I} />
      <rect x="132" y="164" width="56" height="8" rx="4" fill={I} />
    </>
  ),
  creator: (
    <>
      <rect width="320" height="200" fill="var(--p-700)" />
      <circle cx="160" cy="100" r="92" fill="none" stroke={W} strokeOpacity="0.25" strokeWidth="14" />
      <rect x="112" y="14" width="96" height="176" rx="18" fill={I} stroke={W} strokeWidth="3" />
      <rect x="118" y="20" width="84" height="164" rx="13" fill="var(--p-300)" />
      <rect x="124" y="28" width="22" height="3" rx="1.5" fill={W} />
      <rect x="149" y="28" width="22" height="3" rx="1.5" fill={W} />
      <rect x="174" y="28" width="22" height="3" rx="1.5" fill={W} opacity="0.5" />
      <circle cx="132" cy="44" r="7" fill={P} stroke={W} strokeWidth="2" />
      <circle cx="160" cy="104" r="26" fill={W} />
      <path d="M160 116 s-12 -8 -12 -15 a6 6 0 0 1 12 -3 a6 6 0 0 1 12 3 c0 7 -12 15 -12 15z" fill={P} />
      <rect x="126" y="160" width="68" height="14" rx="7" fill={W} fillOpacity="0.6" />
    </>
  ),
  newsletter: (
    <>
      <rect width="320" height="200" fill="var(--p-300)" />
      <rect x="54" y="18" width="212" height="182" rx="12" fill={W} />
      <circle cx="70" cy="32" r="4" fill={I} />
      <circle cx="82" cy="32" r="4" fill={I} opacity="0.5" />
      <circle cx="94" cy="32" r="4" fill={I} opacity="0.25" />
      <rect x="70" y="50" width="120" height="12" rx="4" fill={I} />
      <rect x="70" y="72" width="180" height="56" rx="8" fill={P} />
      <circle cx="104" cy="100" r="14" fill={W} />
      <rect x="128" y="92" width="100" height="8" rx="4" fill={I} />
      <rect x="128" y="106" width="70" height="6" rx="3" fill={I} opacity="0.4" />
      <rect x="70" y="140" width="180" height="6" rx="3" fill={I} opacity="0.2" />
      <rect x="70" y="152" width="150" height="6" rx="3" fill={I} opacity="0.2" />
      <rect x="70" y="168" width="64" height="18" rx="9" fill={I} />
    </>
  ),
  screens: (
    <>
      <rect width="320" height="200" fill="var(--p-100)" />
      <rect x="0" y="156" width="320" height="44" fill="var(--p-300)" />
      {[28, 124, 220].map((x, i) => (
        <g key={x}>
          <rect x={x} y="34" width="76" height="98" rx="8" fill={I} />
          <rect x={x + 6} y="40" width="64" height="86" rx="4" fill={i === 1 ? P : 'var(--p-800)'} />
          <circle cx={x + 38} cy="72" r="14" fill={W} opacity={i === 1 ? 1 : 0.5} />
          <rect x={x + 16} y="98" width="44" height="6" rx="3" fill={W} opacity={i === 1 ? 1 : 0.4} />
          <rect x={x + 34} y="132" width="8" height="24" fill={I} />
        </g>
      ))}
    </>
  ),
  stadium: (
    <>
      <rect width="320" height="200" fill="var(--p-950)" />
      <ellipse cx="160" cy="130" rx="170" ry="80" fill="var(--p-800)" />
      <ellipse cx="160" cy="130" rx="150" ry="62" fill={P} opacity="0.9" />
      <ellipse cx="160" cy="130" rx="150" ry="62" fill="none" stroke={W} strokeWidth="2" strokeDasharray="10 6" />
      <ellipse cx="160" cy="134" rx="128" ry="48" fill={W} />
      <ellipse cx="160" cy="134" rx="30" ry="12" fill="none" stroke="var(--p-300)" strokeWidth="2" />
      <line x1="160" y1="86" x2="160" y2="182" stroke="var(--p-300)" strokeWidth="2" />
      {[40, 110, 210, 280].map((x) => (
        <g key={x}>
          <rect x={x - 2} y="10" width="4" height="46" fill="var(--p-700)" />
          <rect x={x - 12} y="6" width="24" height="10" rx="2" fill={W} />
        </g>
      ))}
    </>
  ),
  radio: (
    <>
      <rect width="320" height="200" fill="var(--p-200)" />
      <line x1="120" y1="56" x2="90" y2="16" stroke={I} strokeWidth="4" strokeLinecap="round" />
      <rect x="70" y="56" width="180" height="112" rx="18" fill={I} />
      <circle cx="120" cy="112" r="34" fill="var(--p-700)" />
      {[0, 1, 2, 3].map((i) => (
        <circle key={i} cx="120" cy="112" r={8 + i * 7} fill="none" stroke={P} strokeWidth="2" opacity={0.9 - i * 0.18} />
      ))}
      <rect x="174" y="80" width="56" height="20" rx="4" fill={P} />
      <circle cx="186" cy="130" r="10" fill={W} />
      <circle cx="218" cy="130" r="10" fill={W} opacity="0.5" />
    </>
  ),
  magazine: (
    <>
      <rect width="320" height="200" fill="var(--p-600)" />
      <path d="M40 30 L158 40 V186 L40 176Z" fill={W} />
      <path d="M280 30 L162 40 V186 L280 176Z" fill={W} />
      <path d="M50 44 L150 52 V110 L50 102Z" fill={I} />
      <circle cx="100" cy="76" r="14" fill={P} />
      {[124, 138, 152].map((y) => (
        <rect key={y} x="54" y={y} width="90" height="5" rx="2.5" fill={I} opacity="0.3" />
      ))}
      {[56, 70, 84, 98, 112, 126, 140, 154].map((y) => (
        <rect key={y} x="174" y={y} width="94" height="5" rx="2.5" fill={I} opacity="0.3" />
      ))}
    </>
  ),
  video: (
    <>
      <rect width="320" height="200" fill="var(--p-900)" />
      <rect x="36" y="24" width="248" height="140" rx="14" fill="var(--p-700)" />
      <circle cx="160" cy="94" r="28" fill={W} />
      <path d="M152 80 L174 94 L152 108Z" fill={I} />
      <rect x="36" y="176" width="248" height="6" rx="3" fill={W} opacity="0.2" />
      <rect x="36" y="176" width="110" height="6" rx="3" fill={P} />
      <circle cx="146" cy="179" r="7" fill={W} />
    </>
  ),
  cafe: (
    <>
      <rect width="320" height="200" fill="var(--p-100)" />
      <rect x="0" y="140" width="320" height="60" fill="var(--p-300)" />
      <rect x="0" y="136" width="320" height="8" fill={I} />
      <path d="M90 136 L140 40 L190 136Z" fill={W} stroke={I} strokeWidth="3" strokeLinejoin="round" />
      <circle cx="140" cy="92" r="14" fill={P} />
      <rect x="122" y="112" width="36" height="6" rx="3" fill={I} />
      <path d="M214 96 h48 v26 a18 18 0 0 1 -18 18 h-12 a18 18 0 0 1 -18 -18z" fill={I} />
      <path d="M262 104 a10 10 0 0 1 0 20" fill="none" stroke={I} strokeWidth="5" />
      <path d="M228 86 q6 -10 0 -18 M246 86 q6 -10 0 -18" fill="none" stroke={P} strokeWidth="3" strokeLinecap="round" />
    </>
  ),
}

export function AdArt({ kind, className }: { kind: ArtKind; className?: string }) {
  return (
    <svg className={className} viewBox="0 0 320 200" preserveAspectRatio="xMidYMid slice" aria-hidden>
      {ARTS[kind]}
    </svg>
  )
}
