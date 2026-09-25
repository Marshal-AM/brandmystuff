import { AnimatePresence, motion } from 'framer-motion'
import { useMemo } from 'react'
import { rng } from '../../lib/hooks'
import { Layer, type LandProps } from './common'

const WORDS: { t: string; s: 'pos' | 'neu' | 'neg'; v: string }[] = [
  { t: 'cozy', s: 'pos', v: '+0.91' },
  { t: 'late delivery', s: 'neg', v: '−0.62' },
  { t: 'slow mornings', s: 'pos', v: '+0.93' },
  { t: 'pricey?', s: 'neu', v: '±0.08' },
  { t: 'love the mugs', s: 'pos', v: '+0.90' },
  { t: 'best cold brew', s: 'pos', v: '+0.88' },
]

function Waves({ fill, bottom, height, dur, amp, foam }: { fill: string; bottom: number; height: number; dur: number; amp: number; foam?: boolean }) {
  // two identical periods so a −50% translate loops seamlessly
  const period = (o: number) =>
    `C${o + 125} ${60 - amp} ${o + 125} ${60 - amp} ${o + 250} 60 C${o + 375} ${60 + amp} ${o + 375} ${60 + amp} ${o + 500} 60`
  const d = `M0 60 ${period(0)} ${period(500)} ${period(1000)} ${period(1500)} V200 H0 Z`
  return (
    <div className="waves" style={{ bottom, height }}>
      <svg viewBox="0 0 2000 200" preserveAspectRatio="none" style={{ animationDuration: `${dur}s` }}>
        <path d={d} fill={fill} />
        {foam && <path d={d.replace(/ V200 H0 Z$/, '')} fill="none" stroke="#fff" strokeOpacity="0.35" strokeWidth="2.5" />}
      </svg>
    </div>
  )
}

export function VoiceLand({ geo, phase }: LandProps) {
  const { w, h, groundY, botX, headY, titleBottom } = geo
  const analyzing = phase === 'analyze'
  const r = useMemo(() => rng(42), [])
  const stars = useMemo(
    () => Array.from({ length: 55 }, () => ({ x: r() * 100, y: r() * 55, d: r() * 5, s: 0.4 + r() * 1.3 })),
    [r],
  )
  const bars = useMemo(() => Array.from({ length: 22 }, () => ({ d: -r() * 1.2, dur: 0.5 + r() * 0.6, s: 0.35 + r() * 0.65 })), [r])
  const bubbles = useMemo(
    () =>
      WORDS.map((wd, i) => {
        const col = i % 2 === 0 ? 0.36 : 0.64
        return { ...wd, x: col * w, delay: 0.2 + i * 0.62, dur: 4.2 + r() * 0.8, drift: (r() - 0.5) * 16 }
      }),
    [r, w],
  )
  const horizon = groundY - h * 0.1

  return (
    <div className="land land-voice">
      <Layer depth={0} className="vo-sky">
        {stars.map((s, i) => (
          <span key={i} className="vo-star" style={{ left: `${s.x}%`, top: `${s.y}%`, animationDelay: `${s.d}s`, scale: s.s }} />
        ))}
        <div className="vo-aurora a1" />
        <div className="vo-aurora a2" />
        <div className="vo-aurora a3" />
      </Layer>

      <Layer depth={0.2}>
        <div className="vo-moon">
          <i style={{ left: '22%', top: '30%', width: 13, height: 13 }} />
          <i style={{ left: '58%', top: '52%', width: 19, height: 19 }} />
          <i style={{ left: '40%', top: '72%', width: 9, height: 9 }} />
        </div>
        <div className="vo-horizon" style={{ top: horizon }} />
      </Layer>

      <Layer depth={0.55}>
        <Waves fill="var(--p-900)" bottom={0} height={h - horizon} dur={26} amp={10} />
      </Layer>
      <Layer depth={0.8}>
        <Waves fill="var(--p-800)" bottom={0} height={h - groundY + 40} dur={18} amp={16} foam />
      </Layer>

      <Layer depth={1} z={2}>
        {/* the floating island the bot stands on */}
        <motion.div
          className="vo-island"
          style={{ left: botX - 130, top: groundY - 24 }}
          animate={{ y: [0, 5, 0], rotate: [-1, 1, -1] }}
          transition={{ duration: 3.4, repeat: Infinity, ease: 'easeInOut' }}
        >
          <div className="vo-island-top" />
          <div className="vo-island-glow" />
        </motion.div>
        {[0, 1, 2].map((i) => (
          <span key={i} className="vo-ripple" style={{ left: botX - 170, top: groundY + 4, animationDelay: `${i * 1.3}s` }} />
        ))}
        <Waves fill="var(--p-700)" bottom={-10} height={h - groundY - 10} dur={11} amp={18} foam />
        <div className="vo-deep" />
      </Layer>

      {/* sonar pulses from the antenna */}
      <AnimatePresence propagate>
        {analyzing && (
          <motion.div key="sonar" className="vo-sonar" style={{ left: botX, top: headY - geo.botSize * 0.34 }} exit={{ opacity: 0 }}>
            {[0, 1, 2].map((i) => (
              <span key={i} style={{ animationDelay: `${i * 0.93}s` }} />
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* speech bubbles rising out of the lagoon, then classified */}
      <AnimatePresence propagate>
        {analyzing &&
          bubbles.map((b) => (
            <motion.div
              key={b.t}
              className="vo-bubble-wrap"
              style={{ left: b.x }}
              initial={{ y: groundY + 20, opacity: 0, scale: 0.6 }}
              animate={{ y: titleBottom + 40, opacity: [0, 1, 1, 0], scale: 1, x: [0, b.drift, -b.drift * 0.4, b.drift * 0.6] }}
              exit={{ opacity: 0, scale: 0.8, filter: 'blur(6px)', transition: { duration: 0.4 } }}
              transition={{ duration: b.dur, delay: b.delay, ease: 'linear', opacity: { duration: b.dur, delay: b.delay, times: [0, 0.14, 0.7, 1] } }}
            >
              <motion.div
                className={`vo-bubble vo-${b.s}`}
                initial={{ color: '#ffffff' }}
                animate={{ color: b.s === 'pos' ? '#0a0a0b' : '#ffffff' }}
                transition={{ delay: b.delay + 1.0, duration: 0.4 }}
              >
                <motion.span
                  className="vo-fill"
                  initial={{ opacity: 0, scale: 0.6 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: b.delay + 1.0, type: 'spring', stiffness: 300, damping: 20 }}
                />
                <span className="vo-t">{b.t}</span>
                <motion.b
                  initial={{ opacity: 0, scale: 0.4, y: 6 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  transition={{ delay: b.delay + 1.1, type: 'spring', stiffness: 400, damping: 18 }}
                >
                  {b.v}
                </motion.b>
              </motion.div>
            </motion.div>
          ))}
      </AnimatePresence>

      {/* one tidy readout: tone waveform + sentiment */}
      <AnimatePresence propagate>
        {phase !== 'arrive' && (
          <motion.div
            key="tone"
            className="vo-tone"
            style={{ left: botX, top: groundY + Math.min(64, (h - groundY) * 0.36) }}
            initial={{ opacity: 0, y: 20, x: '-50%', filter: 'blur(8px)' }}
            animate={{ opacity: 1, y: 0, x: '-50%', filter: 'blur(0px)' }}
            exit={{ opacity: 0, y: 10, x: '-50%' }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="vo-tone-row">
              <span>Voice</span>
              <div className={`vo-wave ${analyzing ? 'is-on' : ''}`}>
                {bars.map((b, i) => (
                  <i key={i} style={{ animationDelay: `${b.d}s`, animationDuration: `${b.dur}s`, scale: `1 ${b.s}` }} />
                ))}
              </div>
              <b>Warm · witty</b>
            </div>
            <div className="vo-tone-row">
              <span>Sentiment</span>
              <div className="vo-meter-track">
                <motion.i initial={{ width: '0%' }} animate={{ width: '78%' }} transition={{ duration: 4, ease: [0.22, 1, 0.36, 1], delay: 0.6 }} />
              </div>
              <b>78% positive</b>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
