/**
 * Made-up brand marks and the everyday objects that carry them.
 * Everything is drawn in the three brand colours: ink, white and purple.
 */

const INK = "#0a0a0b"
const P = "#ab9ff2"
const W = "#ffffff"
const P100 = "#eeecfc"
const P300 = "#cdc5f7"

export type BrandId = "lumen" | "nova" | "orbit" | "kiln" | "peak" | "drift" | "bolt" | "fizz" | "mono"

export const BRANDS: Record<BrandId, { name: string }> = {
  lumen: { name: "Lumen" },
  nova: { name: "Nova" },
  orbit: { name: "Orbit" },
  kiln: { name: "Kiln" },
  peak: { name: "Peak" },
  drift: { name: "Drift" },
  bolt: { name: "Bolt" },
  fizz: { name: "Fizz" },
  mono: { name: "Mono" },
}

/** A round brand sticker centred on (x, y). */
export function Sticker({ brand, x, y, r = 12 }: { brand: BrandId; x: number; y: number; r?: number }) {
  const s = r / 12
  const glyph = (() => {
    switch (brand) {
      case "lumen":
        return (
          <>
            <circle r="12" fill={W} stroke={INK} strokeWidth="2" />
            <path d="M-6 2 A6 6 0 0 1 6 2 Z" fill={INK} />
            <path d="M-7 5 H7" stroke={INK} strokeWidth="1.8" strokeLinecap="round" />
            {[-60, -30, 0, 30, 60].map((a) => (
              <line key={a} x1="0" y1="-5.5" x2="0" y2="-8.5" stroke={INK} strokeWidth="1.6" strokeLinecap="round" transform={`rotate(${a})`} />
            ))}
          </>
        )
      case "nova":
        return (
          <>
            <circle r="12" fill={P} stroke={INK} strokeWidth="2" />
            <path d="M0 -7 L2 -2 L7 0 L2 2 L0 7 L-2 2 L-7 0 L-2 -2 Z" fill={INK} />
          </>
        )
      case "orbit":
        return (
          <>
            <circle r="12" fill={INK} />
            <ellipse rx="7" ry="3.2" fill="none" stroke={P} strokeWidth="1.8" transform="rotate(-25)" />
            <circle r="2.6" fill={W} />
          </>
        )
      case "kiln":
        return (
          <>
            <rect x="-12" y="-12" width="24" height="24" rx="7" fill={W} stroke={INK} strokeWidth="2" />
            <path d="M0 -7 C4 -2 5 1 5 3 A5 5 0 0 1 -5 3 C-5 0 -3 -2 -2 -4 C-1 -1 0 0 1 0 C1 -2 0 -5 0 -7 Z" fill={P} stroke={INK} strokeWidth="1.3" />
          </>
        )
      case "peak":
        return (
          <>
            <rect x="-12" y="-12" width="24" height="24" rx="7" fill={P} stroke={INK} strokeWidth="2" />
            <path d="M-8 6 L-2 -4 L1 1 L3 -2 L8 6 Z" fill={INK} />
            <path d="M-2 -4 L-3.4 -1.6 L-1 -1 Z" fill={W} />
          </>
        )
      case "drift":
        return (
          <>
            <circle r="12" fill={INK} />
            <path d="M-8 1 C-5 -3 -2 -3 0 0 S5 3 8 -1" fill="none" stroke={W} strokeWidth="2.2" strokeLinecap="round" />
            <path d="M-8 5 C-5 1 -2 1 0 4 S5 7 8 3" fill="none" stroke={P} strokeWidth="1.8" strokeLinecap="round" />
          </>
        )
      case "bolt":
        return (
          <>
            <circle r="12" fill={W} stroke={INK} strokeWidth="2" />
            <path d="M1.5 -8 L-5 1 L-0.5 1 L-2 8 L5 -1.5 L0.5 -1.5 Z" fill={P} stroke={INK} strokeWidth="1.3" strokeLinejoin="round" />
          </>
        )
      case "fizz":
        return (
          <>
            <circle r="12" fill={P} stroke={INK} strokeWidth="2" />
            <circle cx="-3" cy="2" r="3.4" fill={W} stroke={INK} strokeWidth="1.2" />
            <circle cx="3.6" cy="-2.6" r="2.4" fill={W} stroke={INK} strokeWidth="1.2" />
            <circle cx="3" cy="4.4" r="1.5" fill={W} stroke={INK} strokeWidth="1" />
          </>
        )
      case "mono":
        return (
          <>
            <rect x="-12" y="-12" width="24" height="24" rx="5" fill={INK} />
            <path d="M-6 6 V-5 L0 2 L6 -5 V6" fill="none" stroke={W} strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" />
          </>
        )
    }
  })()
  return <g transform={`translate(${x} ${y}) scale(${s})`}>{glyph}</g>
}

/** A wide wordmark sticker, e.g. for car doors and deck undersides. */
export function Wordmark({ brand, x, y, w = 60 }: { brand: BrandId; x: number; y: number; w?: number }) {
  const h = w * 0.36
  return (
    <g transform={`translate(${x - w / 2} ${y - h / 2})`}>
      <rect width={w} height={h} rx={h / 2} fill={INK} />
      <g transform={`translate(${h / 2} ${h / 2}) scale(${h / 30})`}>
        <Sticker brand={brand} x={0} y={0} r={11} />
      </g>
      <text x={h + 4} y={h * 0.66} fontSize={h * 0.5} fontWeight="800" fill={W} fontFamily="var(--font-jakarta), sans-serif" letterSpacing="-0.02em">
        {BRANDS[brand].name}
      </text>
    </g>
  )
}

export type ProductId =
  | "laptop"
  | "helmet"
  | "skateboard"
  | "backpack"
  | "car"
  | "guitar"
  | "hoodie"
  | "bottle"
  | "suitcase"
  | "surfboard"
  | "van"
  | "storefront"

export const PRODUCTS: { id: ProductId; label: string; space: string; grade: string; aqs: number; price: number }[] = [
  { id: "laptop", label: "MacBook lid", space: "lid-center", grade: "A", aqs: 91, price: 45 },
  { id: "helmet", label: "Bike helmet", space: "shell-left", grade: "B+", aqs: 84, price: 18 },
  { id: "skateboard", label: "Skate deck", space: "deck-bottom", grade: "A-", aqs: 88, price: 22 },
  { id: "backpack", label: "Backpack", space: "front-panel", grade: "B+", aqs: 82, price: 15 },
  { id: "car", label: "Hatchback", space: "rear-door", grade: "A", aqs: 93, price: 120 },
  { id: "guitar", label: "Guitar case", space: "case-front", grade: "B", aqs: 78, price: 20 },
  { id: "hoodie", label: "Hoodie", space: "chest", grade: "B+", aqs: 81, price: 25 },
  { id: "bottle", label: "Water bottle", space: "wrap", grade: "B", aqs: 74, price: 8 },
  { id: "suitcase", label: "Suitcase", space: "shell-front", grade: "A-", aqs: 87, price: 30 },
  { id: "surfboard", label: "Surfboard", space: "deck-nose", grade: "B+", aqs: 83, price: 35 },
  { id: "van", label: "Food truck", space: "side-panel", grade: "A", aqs: 95, price: 160 },
  { id: "storefront", label: "Shop window", space: "window-decal", grade: "A-", aqs: 89, price: 70 },
]

const stroke = { stroke: INK, strokeWidth: 4, strokeLinejoin: "round" as const, strokeLinecap: "round" as const }

const ART: Record<ProductId, React.ReactNode> = {
  laptop: (
    <>
      <rect x="22" y="26" width="116" height="80" rx="10" fill={W} {...stroke} />
      <path d="M28 32 H70" stroke={P100} strokeWidth="5" strokeLinecap="round" />
      <path d="M12 118 L22 106 H138 L148 118 Z" fill={P300} {...stroke} />
      <path d="M12 118 H148 V122 A4 4 0 0 1 144 126 H16 A4 4 0 0 1 12 122 Z" fill={W} {...stroke} />
      <Sticker brand="lumen" x={56} y={58} r={15} />
      <Sticker brand="nova" x={100} y={52} r={11} />
      <Wordmark brand="drift" x={90} y={86} w={58} />
      <Sticker brand="mono" x={42} y={90} r={8} />
    </>
  ),
  helmet: (
    <>
      <path d="M22 104 C22 58 50 30 86 30 C120 30 142 56 142 90 L142 104 Z" fill={W} {...stroke} />
      <path d="M56 36 C70 50 74 72 72 104 M100 32 C112 50 116 74 114 104" fill="none" stroke={P300} strokeWidth="5" />
      <path d="M18 104 H146 V112 A6 6 0 0 1 140 118 H24 A6 6 0 0 1 18 112 Z" fill={INK} />
      <path d="M40 118 L34 136 M124 118 L130 136" stroke={INK} strokeWidth="4" strokeLinecap="round" />
      <Sticker brand="bolt" x={48} y={78} r={13} />
      <Sticker brand="peak" x={94} y={64} r={12} />
      <Sticker brand="fizz" x={124} y={88} r={8} />
    </>
  ),
  skateboard: (
    <g transform="rotate(-24 80 80)">
      <rect x="10" y="58" width="140" height="44" rx="22" fill={P} {...stroke} />
      <path d="M30 64 H130" stroke={W} strokeWidth="4" strokeLinecap="round" opacity="0.6" />
      <Wordmark brand="kiln" x={80} y={80} w={70} />
      <Sticker brand="orbit" x={30} y={80} r={9} />
      <Sticker brand="nova" x={130} y={80} r={9} />
      <circle cx="40" cy="110" r="8" fill={W} {...stroke} />
      <circle cx="120" cy="110" r="8" fill={W} {...stroke} />
    </g>
  ),
  backpack: (
    <>
      <path d="M58 36 C58 20 102 20 102 36" fill="none" {...stroke} />
      <rect x="32" y="34" width="96" height="108" rx="30" fill={W} {...stroke} />
      <rect x="46" y="88" width="68" height="44" rx="14" fill={P300} {...stroke} />
      <path d="M52 100 H108" stroke={INK} strokeWidth="3" strokeDasharray="4 5" />
      <Sticker brand="peak" x={80} y={62} r={15} />
      <Sticker brand="drift" x={62} y={116} r={9} />
      <Sticker brand="bolt" x={98} y={116} r={9} />
    </>
  ),
  car: (
    <>
      <path d="M10 108 V88 C10 82 14 78 20 76 L40 70 L58 48 C62 44 66 42 72 42 H112 C118 42 122 44 126 50 L140 72 C148 74 152 80 152 88 V108 Z" fill={W} {...stroke} />
      <path d="M62 72 L72 52 H94 V72 Z M102 72 V52 H114 L126 72 Z" fill={P300} {...stroke} />
      <Wordmark brand="lumen" x={84} y={92} w={64} />
      <circle cx="40" cy="110" r="15" fill={INK} />
      <circle cx="40" cy="110" r="6" fill={P} />
      <circle cx="124" cy="110" r="15" fill={INK} />
      <circle cx="124" cy="110" r="6" fill={P} />
      <rect x="140" y="82" width="10" height="6" rx="3" fill={P} />
    </>
  ),
  guitar: (
    <g transform="rotate(18 80 80)">
      <path d="M80 8 C94 8 98 20 96 34 C94 44 104 50 112 58 C124 70 124 90 116 104 C108 120 98 126 98 140 C98 152 62 152 62 140 C62 126 52 120 44 104 C36 90 36 70 48 58 C56 50 66 44 64 34 C62 20 66 8 80 8 Z" fill={P300} {...stroke} />
      <path d="M80 18 V60" stroke={INK} strokeWidth="3" strokeLinecap="round" opacity="0.35" />
      <Sticker brand="nova" x={80} y={100} r={16} />
      <Sticker brand="lumen" x={62} y={74} r={9} />
      <Sticker brand="fizz" x={98} y={78} r={9} />
      <Sticker brand="kiln" x={80} y={40} r={8} />
    </g>
  ),
  hoodie: (
    <>
      <path d="M58 26 C62 40 98 40 102 26 L128 38 L150 82 L128 92 L122 76 V140 H38 V76 L32 92 L10 82 L32 38 Z" fill={W} {...stroke} />
      <path d="M62 26 C66 50 94 50 98 26" fill={P300} {...stroke} />
      <path d="M70 46 V62 M90 46 V62" stroke={INK} strokeWidth="3" strokeLinecap="round" />
      <path d="M56 116 H104 V132 H56 Z" fill={P100} stroke={INK} strokeWidth="3" />
      <Sticker brand="orbit" x={80} y={88} r={17} />
    </>
  ),
  bottle: (
    <>
      <rect x="62" y="14" width="36" height="16" rx="6" fill={INK} />
      <path d="M58 30 H102 C108 30 112 36 112 44 V136 C112 144 106 148 100 148 H60 C54 148 48 144 48 136 V44 C48 36 52 30 58 30 Z" fill={W} {...stroke} />
      <rect x="48" y="62" width="64" height="54" fill={P} stroke={INK} strokeWidth="4" />
      <Sticker brand="fizz" x={80} y={89} r={17} />
      <path d="M60 40 V56" stroke={P100} strokeWidth="5" strokeLinecap="round" />
    </>
  ),
  suitcase: (
    <>
      <path d="M62 34 V24 C62 20 64 18 68 18 H92 C96 18 98 20 98 24 V34" fill="none" {...stroke} />
      <rect x="30" y="34" width="100" height="108" rx="16" fill={P300} {...stroke} />
      <path d="M54 40 V136 M106 40 V136" stroke={INK} strokeWidth="3" opacity="0.35" />
      <Sticker brand="bolt" x={80} y={66} r={15} />
      <Sticker brand="mono" x={62} y={108} r={10} />
      <Sticker brand="nova" x={98} y={112} r={10} />
      <circle cx="46" cy="148" r="6" fill={INK} />
      <circle cx="114" cy="148" r="6" fill={INK} />
    </>
  ),
  surfboard: (
    <g transform="rotate(-38 80 80)">
      <path d="M80 6 C112 30 116 110 80 154 C44 110 48 30 80 6 Z" fill={W} {...stroke} />
      <path d="M80 12 V148" stroke={P} strokeWidth="6" />
      <Sticker brand="drift" x={80} y={56} r={15} />
      <Sticker brand="peak" x={80} y={100} r={11} />
      <path d="M80 138 L70 152 H90 Z" fill={INK} />
    </g>
  ),
  van: (
    <>
      <path d="M8 118 V48 C8 42 12 38 18 38 H112 C118 38 122 40 126 46 L148 78 C150 82 152 86 152 90 V118 Z" fill={W} {...stroke} />
      <path d="M118 48 L140 80 H118 Z" fill={P300} {...stroke} />
      <rect x="20" y="50" width="86" height="42" rx="6" fill={P100} stroke={INK} strokeWidth="3" />
      <path d="M16 38 L26 26 H100 L110 38" fill={P} {...stroke} />
      <Sticker brand="kiln" x={42} y={71} r={14} />
      <Wordmark brand="kiln" x={80} y={106} w={60} />
      <circle cx="40" cy="120" r="14" fill={INK} />
      <circle cx="40" cy="120" r="5" fill={P} />
      <circle cx="124" cy="120" r="14" fill={INK} />
      <circle cx="124" cy="120" r="5" fill={P} />
    </>
  ),
  storefront: (
    <>
      <rect x="16" y="46" width="128" height="98" rx="6" fill={W} {...stroke} />
      <path d="M12 46 L22 22 H138 L148 46 Z" fill={P} {...stroke} />
      <path d="M38 22 L32 46 M60 22 L58 46 M82 22 V46 M104 22 L106 46 M126 22 L132 46" stroke={INK} strokeWidth="3" />
      <rect x="26" y="58" width="72" height="74" rx="4" fill={P100} stroke={INK} strokeWidth="3" />
      <rect x="106" y="58" width="28" height="86" rx="3" fill={P300} stroke={INK} strokeWidth="3" />
      <Sticker brand="mono" x={62} y={86} r={17} />
      <path d="M40 118 H84" stroke={INK} strokeWidth="3" strokeLinecap="round" />
    </>
  ),
}

export function ProductArt({ id, size = 140, className }: { id: ProductId; size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 160 160" className={className} style={{ overflow: "visible" }} aria-hidden>
      {ART[id]}
    </svg>
  )
}
