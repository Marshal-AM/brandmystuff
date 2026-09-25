import { AnimatePresence, motion } from 'framer-motion'
import { useMemo } from 'react'
import { rng } from '../../lib/hooks'
import { Fade, Layer, type LandProps } from './common'

function Cloud({ x, y, s, dur, delay }: { x: string; y: string; s: number; dur: number; delay: number }) {
  return (
    <div className="cloud" style={{ left: x, top: y, scale: s, animationDuration: `${dur}s`, animationDelay: `${delay}s` }}>
      <i style={{ width: 90, height: 90, left: 30, top: 0 }} />
      <i style={{ width: 70, height: 70, left: 90, top: 18 }} />
      <i style={{ width: 60, height: 60, left: 0, top: 30 }} />
      <i style={{ width: 170, height: 42, left: 0, top: 48, borderRadius: 30 }} />
    </div>
  )
}

function Flower({ x, bottom, h, d, s = 1 }: { x: string; bottom: number; h: number; d: number; s?: number }) {
  return (
    <div className="flower" style={{ left: x, bottom, height: h, animationDelay: `${d}s`, scale: s }}>
      <span className="flower-stem" />
      <span className="flower-head">
        {[0, 72, 144, 216, 288].map((r) => (
          <i key={r} style={{ rotate: `${r}deg` }} />
        ))}
        <b />
      </span>
    </div>
  )
}

/** The brand mark being inspected: a sunrise glyph. */
function Mark({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 200 200" style={{ overflow: 'visible' }}>
      <motion.g
        animate={{ rotate: 360 }}
        transition={{ duration: 40, repeat: Infinity, ease: 'linear' }}
        style={{ originX: 0.5, originY: 0.5 }}
      >
        {Array.from({ length: 12 }).map((_, i) => (
          <line
            key={i}
            x1="100"
            y1="8"
            x2="100"
            y2="26"
            stroke="var(--ink)"
            strokeWidth="6"
            strokeLinecap="round"
            transform={`rotate(${i * 30} 100 100)`}
          />
        ))}
      </motion.g>
      <circle cx="100" cy="100" r="62" fill="#fff" stroke="var(--ink)" strokeWidth="6" />
      <path d="M52 112 A48 48 0 0 1 148 112 Z" fill="var(--ink)" />
      <path d="M44 126 H156 M60 140 H140" stroke="var(--ink)" strokeWidth="6" strokeLinecap="round" />
      <circle cx="100" cy="88" r="10" fill="var(--p)" />
    </svg>
  )
}

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1]
const PALETTE = [
  { name: 'Roast', c: 'var(--ink)' },
  { name: 'Sunrise', c: 'var(--p)' },
  { name: 'Cream', c: '#fff' },
]

export function IdentityLand({ geo, phase }: LandProps) {
  const { w, h, groundY, botX, headY, botTop, titleBottom } = geo
  const analyzing = phase !== 'arrive'
  // the mark (plus its selection box) lives in the gap between the title and the antenna
  const gapTop = titleBottom + 22
  const gapBottom = botTop - 18
  const markSize = Math.max(84, Math.min(168, (gapBottom - gapTop) / 1.3))
  const markCx = botX
  const markCy = (gapTop + gapBottom) / 2
  const fh = Math.min(120, (h - groundY) * 0.55)
  const r = useMemo(() => rng(7), [])
  const sparkles = useMemo(
    () => Array.from({ length: 9 }, () => ({ x: r() * 100, y: r() * 40, d: r() * 4, s: 0.5 + r() })),
    [r],
  )

  return (
    <div className="land land-identity">
      <Layer depth={0} className="id-sky">
        <div className="id-sun" />
        <div className="id-sun-rays" />
        {sparkles.map((s, i) => (
          <span key={i} className="id-sparkle" style={{ left: `${s.x}%`, top: `${s.y}%`, animationDelay: `${s.d}s`, scale: s.s }} />
        ))}
      </Layer>

      <Layer depth={0.25}>
        <Cloud x="6%" y="18%" s={0.9} dur={60} delay={-10} />
        <Cloud x="58%" y="12%" s={0.6} dur={80} delay={-30} />
        <Cloud x="30%" y="30%" s={0.45} dur={70} delay={-50} />
        <svg className="hill" style={{ bottom: h - groundY + 70, height: h * 0.34 }} viewBox="0 0 1000 300" preserveAspectRatio="none">
          <path d="M0 160 C120 90 220 70 330 120 S560 40 690 100 S900 60 1000 110 V300 H0 Z" fill="var(--p-300)" />
        </svg>
      </Layer>

      <Layer depth={0.45}>
        <svg className="hill" style={{ bottom: h - groundY + 10, height: h * 0.28 }} viewBox="0 0 1000 300" preserveAspectRatio="none">
          <path d="M0 150 C160 60 300 90 420 140 S700 70 820 120 S960 110 1000 90 V300 H0 Z" fill="var(--p)" />
        </svg>
      </Layer>

      <Layer depth={1} z={2}>
        <div className="ground id-ground" style={{ top: groundY - 10 }} />
        <Flower x="2%" bottom={h * 0.02} h={fh * 0.8} d={0} />
        <Flower x="6%" bottom={h * 0.01} h={fh} d={0.6} s={1.1} />
        <Flower x="10%" bottom={h * 0.03} h={fh * 0.6} d={1.1} s={0.8} />
        <Flower x="88%" bottom={h * 0.03} h={fh * 0.65} d={0.3} s={0.85} />
        <Flower x="92%" bottom={h * 0.01} h={fh} d={0.9} s={1.1} />
        <Flower x="96%" bottom={h * 0.02} h={fh * 0.7} d={1.4} s={0.75} />
      </Layer>

      {/* the mark the bot is scanning */}
      <Fade className="id-mark" style={{ position: 'absolute', left: markCx - markSize / 2, top: markCy - markSize / 2, zIndex: 3 }} delay={1.2}>
        <motion.div animate={{ y: [0, -10, 0] }} transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}>
          <Mark size={markSize} />
        </motion.div>
      </Fade>

      <AnimatePresence propagate>
        {analyzing && (
          <motion.svg
            key="scan"
            className="id-overlay"
            width={w}
            height={h}
            viewBox={`0 0 ${w} ${h}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.6 } }}
          >
            <defs>
              <linearGradient id="beam" x1="0" y1="1" x2="0" y2="0">
                <stop offset="0" stopColor="#fff" stopOpacity="0.9" />
                <stop offset="0.4" stopColor="var(--p)" stopOpacity="0.55" />
                <stop offset="1" stopColor="var(--p)" stopOpacity="0" />
              </linearGradient>
            </defs>
            {/* beam from the visor to the mark */}
            <motion.path
              d={`M ${botX - 14} ${headY} L ${markCx - markSize * 0.62} ${markCy - markSize * 0.1} L ${markCx + markSize * 0.62} ${markCy - markSize * 0.1} L ${botX + 14} ${headY} Z`}
              fill="url(#beam)"
              initial={{ opacity: 0, scaleY: 0 }}
              animate={{ opacity: phase === 'done' ? 0 : [0.55, 0.9, 0.6, 1, 0.55], scaleY: 1 }}
              transition={{ opacity: { duration: 1.2, repeat: Infinity }, scaleY: { duration: 0.6, ease: [0.22, 1, 0.36, 1] } }}
              style={{ originY: 1 }}
            />
            {/* scan line sweeping over the mark */}
            {phase === 'analyze' && (
              <motion.rect
                x={markCx - markSize * 0.62}
                width={markSize * 1.24}
                height={3}
                fill="var(--ink)"
                initial={{ y: markCy - markSize * 0.6 }}
                animate={{ y: [markCy - markSize * 0.6, markCy + markSize * 0.6, markCy - markSize * 0.6] }}
                transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
              />
            )}
            {/* bounding box */}
            <motion.rect
              x={markCx - markSize * 0.6}
              y={markCy - markSize * 0.6}
              width={markSize * 1.2}
              height={markSize * 1.2}
              rx={18}
              fill="none"
              stroke="var(--ink)"
              strokeOpacity={0.5}
              strokeWidth={1.5}
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 1.4, delay: 0.3, ease: [0.65, 0, 0.35, 1] }}
            />
            {/* corner handles */}
            {[
              [-1, -1],
              [1, -1],
              [-1, 1],
              [1, 1],
            ].map(([sx, sy], i) => (
              <motion.rect
                key={i}
                x={markCx + sx * markSize * 0.6 - 5}
                y={markCy + sy * markSize * 0.6 - 5}
                width={10}
                height={10}
                rx={3}
                fill="#fff"
                stroke="var(--ink)"
                strokeWidth={2}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 500, damping: 18, delay: 0.9 + i * 0.08 }}
              />
            ))}
          </motion.svg>
        )}
      </AnimatePresence>

      {/* two quiet readouts either side of the mark */}
      <AnimatePresence propagate>
        {analyzing && (
          <motion.div
            key="readouts"
            className="id-readouts"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.4 } }}
          >
            <motion.div
              className="id-card id-type"
              style={{ right: w - (markCx - markSize * 0.8), top: markCy }}
              initial={{ opacity: 0, x: 16, filter: 'blur(6px)' }}
              animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
              transition={{ delay: 1.2, duration: 0.7, ease: EASE }}
            >
              <b>Aa</b>
              <span className="mono">geometric sans</span>
            </motion.div>
            <motion.div
              className="id-card id-palette"
              style={{ left: markCx + markSize * 0.8, top: markCy }}
              initial={{ opacity: 0, x: -16, filter: 'blur(6px)' }}
              animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
              transition={{ delay: 1.5, duration: 0.7, ease: EASE }}
            >
              {PALETTE.map((c, i) => (
                <motion.div
                  key={c.name}
                  className="id-chip"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 1.8 + i * 0.2, duration: 0.45, ease: EASE }}
                >
                  <i style={{ background: c.c }} />
                  {c.name}
                </motion.div>
              ))}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
