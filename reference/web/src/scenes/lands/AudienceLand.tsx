import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useMemo, useState } from 'react'
import { rng } from '../../lib/hooks'
import { Layer, type LandProps } from './common'

const CLUSTERS = [
  { label: 'Urban creators', pct: '41%', dx: -0.2, dy: -0.05 },
  { label: 'Remote workers', pct: '33%', dx: 0.2, dy: -0.08 },
  { label: 'Students', pct: '26%', dx: 0, dy: -0.26 },
]

function Pine({ left, bottom, s }: { left: string; bottom: number; s: number }) {
  return (
    <div className="pine" style={{ left, bottom, scale: s }}>
      <i />
      <i />
      <i />
      <b />
    </div>
  )
}

export function AudienceLand({ geo, phase }: LandProps) {
  const { w, h, groundY, botX, headY } = geo
  const analyzing = phase !== 'arrive'
  const r = useMemo(() => rng(1337), [])
  const radarR = Math.min(w * 0.3, h * 0.44)
  const cx = botX
  const cy = headY

  const snow = useMemo(
    () => Array.from({ length: 26 }, () => ({ x: r() * 100, d: -r() * 12, dur: 8 + r() * 8, s: 0.4 + r() * 1.1, sway: 10 + r() * 30 })),
    [r],
  )

  // persona dots scattered in the upper half, each assigned to a cluster
  const dots = useMemo(() => {
    return Array.from({ length: 24 }, (_, i) => {
      const a = Math.PI + r() * Math.PI // upper semicircle
      const d = radarR * (0.3 + r() * 0.68)
      const cl = i % 3
      const c = CLUSTERS[cl]
      const tx = cx + c.dx * w * 0.9 + (r() - 0.5) * 56
      const ty = cy + c.dy * h - 40 + (r() - 0.5) * 40
      const ang = ((a * 180) / Math.PI + 90) % 360 // angle measured like the sweep
      return { x: cx + Math.cos(a) * d, y: cy + Math.sin(a) * d, tx, ty, cl, delay: (ang / 360) * 2.4 }
    })
  }, [r, radarR, cx, cy, w, h])

  const [clustered, setClustered] = useState(false)
  useEffect(() => {
    if (phase === 'arrive') return
    const id = window.setTimeout(() => setClustered(true), phase === 'done' ? 0 : 2700)
    return () => window.clearTimeout(id)
  }, [phase])

  return (
    <div className="land land-audience">
      <Layer depth={0} className="au-sky">
        <div className="au-sun" style={{ left: w * 0.22, top: groundY - h * 0.48 }} />
      </Layer>

      <Layer depth={0.3}>
        <svg className="hill" style={{ bottom: h - groundY + 40, height: h * 0.42 }} viewBox="0 0 1000 400" preserveAspectRatio="none">
          <path d="M0 300 L90 190 L170 250 L280 120 L360 210 L450 150 L540 240 L640 110 L760 230 L850 160 L1000 260 V400 H0 Z" fill="var(--p-200)" />
          <path d="M280 120 L320 240 L360 210 Z M640 110 L680 260 L760 230 Z M90 190 L120 260 L170 250 Z" fill="var(--p-300)" />
        </svg>
      </Layer>

      <Layer depth={0.6}>
        <svg className="hill" style={{ bottom: h - groundY + 6, height: h * 0.36 }} viewBox="0 0 1000 360" preserveAspectRatio="none">
          <path d="M-20 360 L160 120 L260 230 L380 60 L520 250 L640 140 L760 260 L880 100 L1020 300 V360 Z" fill="var(--ink)" />
          <path d="M160 120 L130 160 L150 170 L170 150 L190 162 Z" fill="#fff" />
          <path d="M380 60 L338 120 L362 132 L382 108 L404 128 L420 116 Z" fill="#fff" />
          <path d="M880 100 L846 146 L870 154 L888 136 L906 150 L918 140 Z" fill="#fff" />
          <path d="M380 60 L520 250 L440 250 Z M880 100 L1020 300 L940 300 Z" fill="var(--p-900)" />
        </svg>
        {/* competitor flags on the peaks */}
        {[
          { x: 0.16, y: 0.36 * (1 - 120 / 360) },
          { x: 0.38, y: 0.36 * (1 - 60 / 360) },
          { x: 0.88, y: 0.36 * (1 - 100 / 360) },
        ].map((f, i) => (
          <div key={i} className="au-flag" style={{ left: `${f.x * 100}%`, bottom: h - groundY + 6 + f.y * h - 2 }}>
            <i />
            <b />
          </div>
        ))}
      </Layer>

      <Layer depth={1} z={2}>
        <div className="ground au-ground" style={{ top: groundY - 10 }} />
        <Pine left="5%" bottom={h * 0.05} s={1.3} />
        <Pine left="11%" bottom={h * 0.1} s={0.9} />
        <Pine left="86%" bottom={h * 0.08} s={1.1} />
        <Pine left="93%" bottom={h * 0.02} s={1.45} />
      </Layer>

      <div className="au-snow">
        {snow.map((s, i) => (
          <i
            key={i}
            style={{
              left: `${s.x}%`,
              animationDelay: `${s.d}s`,
              animationDuration: `${s.dur}s`,
              scale: s.s,
              ['--sway' as string]: `${s.sway}px`,
            }}
          />
        ))}
      </div>

      {/* radar + persona constellation */}
      <AnimatePresence propagate>
        {analyzing && (
          <motion.div
            key="radar"
            className="au-radar"
            style={{ left: cx - radarR, top: cy - radarR, width: radarR * 2, height: radarR * 2 }}
            initial={{ opacity: 0, scale: 0.4 }}
            animate={{ opacity: clustered ? 0.25 : 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.1 }}
            transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
          >
            <i className="au-ring" style={{ inset: '0%' }} />
            <i className="au-ring" style={{ inset: '30%' }} />
            <div className="au-sweep" />
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence propagate>
        {analyzing && (
          <motion.svg
            key="links"
            className="au-links"
            width={w}
            height={h}
            viewBox={`0 0 ${w} ${h}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {clustered &&
              dots.map((d, i) => {
                const next = dots.find((o, j) => j > i && o.cl === d.cl)
                if (!next) return null
                return (
                  <motion.line
                    key={i}
                    x1={d.tx}
                    y1={d.ty}
                    x2={next.tx}
                    y2={next.ty}
                    stroke="var(--ink)"
                    strokeOpacity="0.22"
                    strokeWidth="1"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 0.6, delay: 0.5 + i * 0.015 }}
                  />
                )
              })}
          </motion.svg>
        )}
      </AnimatePresence>

      <AnimatePresence propagate>
        {analyzing &&
          dots.map((d, i) => (
            <motion.span
              key={i}
              className={`au-dot au-dot-${d.cl}`}
              initial={{ x: d.x, y: d.y, scale: 0, opacity: 0 }}
              animate={
                clustered
                  ? { x: d.tx, y: d.ty, scale: 1, opacity: 1 }
                  : { x: d.x, y: d.y, scale: [0, 1.8, 1], opacity: 1 }
              }
              exit={{ scale: 0, opacity: 0, transition: { duration: 0.3, delay: i * 0.008 } }}
              transition={
                clustered
                  ? { type: 'spring', stiffness: 60, damping: 13, delay: i * 0.012 }
                  : { duration: 0.6, delay: d.delay }
              }
            />
          ))}
      </AnimatePresence>

      <AnimatePresence propagate>
        {clustered &&
          CLUSTERS.map((c, i) => (
            <motion.div
              key={c.label}
              className="au-cluster"
              style={{ left: cx + c.dx * w * 0.9, top: cy + c.dy * h - 40 - 62 }}
              initial={{ opacity: 0, y: 12, scale: 0.8, x: '-50%' }}
              animate={{ opacity: 1, y: 0, scale: 1, x: '-50%' }}
              exit={{ opacity: 0, scale: 0.8, x: '-50%' }}
              transition={{ delay: 0.7 + i * 0.15, type: 'spring', stiffness: 260, damping: 20 }}
            >
              <b>{c.pct}</b> {c.label}
            </motion.div>
          ))}
      </AnimatePresence>
    </div>
  )
}
