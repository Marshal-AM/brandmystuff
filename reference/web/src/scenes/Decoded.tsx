import { AnimatePresence, motion } from 'framer-motion'
import { useMemo, useRef, useState } from 'react'
import { Bot, type BotPose } from '../components/Bot'
import { Icon } from '../components/Icon'
import { BRAND, DNA } from '../data'
import { PURPLE, rgba, useCanvas } from '../lib/canvas'
import { useCountUp, useSequence, useViewport } from '../lib/hooks'
import './decoded.css'

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1]

type Confetti = { x: number; y: number; vx: number; vy: number; r: number; vr: number; w: number; h: number; c: string; life: number }

const ORBS = [
  { id: 'identity', label: 'Identity', cls: 'orb-lav', from: { x: -0.2, y: 0.9 } },
  { id: 'voice', label: 'Voice', cls: 'orb-ink', from: { x: 0.5, y: -0.25 } },
  { id: 'audience', label: 'Audience', cls: 'orb-white', from: { x: 1.2, y: 0.8 } },
]

export function Decoded({ onDone }: { onDone: () => void }) {
  const { w, h } = useViewport()
  const mobile = w < 860
  const helixX = mobile ? w / 2 : w * 0.33
  const helixH = Math.min(h * 0.46, 420)
  const helixY = h * 0.42
  const [stage, setStage] = useState<'orbs' | 'merge' | 'card' | 'leave'>('orbs')
  const [pose, setPose] = useState<BotPose>('float')
  const confetti = useRef<Confetti[]>([])
  const reveal = useRef(0)
  const conf = useCountUp(97, 1800, stage === 'card' || stage === 'leave')

  const burst = (x: number, y: number, n: number) => {
    const colors = ['#ab9ff2', '#ffffff', '#0a0a0b', '#ab9ff2']
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2
      const sp = 260 + Math.random() * 620
      confetti.current.push({
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 320,
        r: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 16,
        w: 6 + Math.random() * 8,
        h: 3 + Math.random() * 5,
        c: colors[i % colors.length],
        life: 1,
      })
    }
  }

  const canvasRef = useCanvas((ctx, cw, ch, dt, t) => {
    ctx.clearRect(0, 0, cw, ch)
    // DNA double helix
    const target = stage === 'orbs' ? 0 : 1
    reveal.current += (target - reveal.current) * Math.min(1, dt * 2.2)
    const rv = reveal.current
    const n = 26
    const height = helixH
    const gap = height / n
    const R = Math.min(80, cw * 0.07)
    const cx = helixX
    const top = helixY - height / 2
    const spin = t * 1.5
    const shown = rv * n
    for (let i = 0; i < n; i++) {
      const mid = Math.abs(i - n / 2)
      if (mid > shown / 2 + 0.5) continue
      const local = Math.min(1, shown / 2 - mid + 0.5)
      const ph = spin + i * 0.42
      const y = top + i * gap
      const s = Math.sin(ph)
      const z = Math.cos(ph)
      const x1 = cx + s * R
      const x2 = cx - s * R
      ctx.lineWidth = 2
      ctx.strokeStyle = rgba(PURPLE, 0.18 * local)
      ctx.beginPath()
      ctx.moveTo(x1, y)
      ctx.lineTo(x2, y)
      ctx.stroke()
      const dot = (x: number, depth: number, white: boolean) => {
        const front = (depth + 1) / 2
        const r = (3 + front * 4) * local
        ctx.beginPath()
        ctx.arc(x, y, r, 0, Math.PI * 2)
        ctx.fillStyle = white ? `rgba(255,255,255,${0.25 + front * 0.75})` : rgba(PURPLE, 0.3 + front * 0.7)
        ctx.shadowColor = rgba(PURPLE, 0.9)
        ctx.shadowBlur = 14 * front
        ctx.fill()
        ctx.shadowBlur = 0
      }
      if (z > 0) {
        dot(x2, -z, false)
        dot(x1, z, true)
      } else {
        dot(x1, z, true)
        dot(x2, -z, false)
      }
    }
    // confetti
    const g = 900
    confetti.current = confetti.current.filter((p) => p.life > 0 && p.y < ch + 40)
    for (const p of confetti.current) {
      p.vy += g * dt
      p.vx *= 1 - dt * 1.2
      p.x += p.vx * dt
      p.y += p.vy * dt
      p.r += p.vr * dt
      p.life -= dt * 0.35
      ctx.save()
      ctx.translate(p.x, p.y)
      ctx.rotate(p.r)
      ctx.scale(1, Math.abs(Math.cos(p.r * 1.7)) + 0.15)
      ctx.globalAlpha = Math.max(0, Math.min(1, p.life * 1.5))
      ctx.fillStyle = p.c
      if (p.c === '#0a0a0b') {
        ctx.strokeStyle = 'rgba(171,159,242,0.9)'
        ctx.lineWidth = 1
        ctx.strokeRect(-p.w / 2, -p.h / 2, p.w, p.h)
      }
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h)
      ctx.restore()
    }
    ctx.globalAlpha = 1
  })

  useSequence(async ({ wait }) => {
    await wait(1700)
    setStage('merge')
    burst(helixX, helixY, 20)
    await wait(700)
    setStage('card')
    setPose('celebrate')
    burst(mobile ? w / 2 : w * 0.64, h * 0.3, 70)
    await wait(3600)
    setPose('point')
    await wait(900)
    setStage('leave')
    setPose('float')
    await wait(1300)
    onDone()
  })

  const S = Math.min(130, h * 0.15)
  const orbTargets = useMemo(
    () => ORBS.map((_, i) => ({ x: helixX + Math.cos((i / 3) * Math.PI * 2 - Math.PI / 2) * 130, y: helixY + Math.sin((i / 3) * Math.PI * 2 - Math.PI / 2) * 130 })),
    [helixX, helixY],
  )

  return (
    <motion.div
      className="scene decoded"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.6 } }}
      transition={{ duration: 0.9 }}
    >
      <div className="dc-bg">
        <div className="dc-conic" />
        <div className="dc-vignette" />
      </div>

      <motion.div
        className="dc-stage"
        animate={stage === 'leave' ? { scale: 0.6, opacity: 0, filter: 'blur(16px)', x: w / 2 - helixX } : { scale: 1, opacity: 1, filter: 'blur(0px)', x: 0 }}
        transition={{ duration: 1.2, ease: [0.7, 0, 0.84, 0] }}
        style={{ originX: `${helixX}px`, originY: `${helixY}px` }}
      >
        <canvas ref={canvasRef} className="dc-canvas" />

        {/* three land essences converge */}
        <AnimatePresence>
          {(stage === 'orbs' || stage === 'merge') &&
            ORBS.map((o, i) => (
              <motion.div
                key={o.id}
                className={`orb ${o.cls}`}
                initial={{ x: o.from.x * w, y: o.from.y * h, scale: 0.4, opacity: 0 }}
                animate={
                  stage === 'orbs'
                    ? { x: orbTargets[i].x, y: orbTargets[i].y, scale: 1, opacity: 1 }
                    : { x: helixX, y: helixY, scale: 0.2, opacity: 0 }
                }
                transition={stage === 'orbs' ? { duration: 1.4, delay: i * 0.12, ease: EASE } : { duration: 0.55, ease: [0.7, 0, 0.84, 0] }}
              >
                <span className="orb-ball" />
                <span className="orb-label">{o.label}</span>
              </motion.div>
            ))}
        </AnimatePresence>

        <AnimatePresence>
          {stage !== 'orbs' && (
            <motion.div
              key="flash"
              className="dc-flash"
              style={{ left: helixX, top: helixY }}
              initial={{ scale: 0, opacity: 1 }}
              animate={{ scale: 9, opacity: 0 }}
              transition={{ duration: 1.1, ease: 'easeOut' }}
            />
          )}
        </AnimatePresence>
        {stage !== 'orbs' &&
          [0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="dc-ring"
              style={{ left: helixX, top: helixY }}
              initial={{ scale: 0.2, opacity: 0.9 }}
              animate={{ scale: 5 + i * 2, opacity: 0 }}
              transition={{ duration: 1.6, delay: i * 0.18, ease: [0.22, 1, 0.36, 1] }}
            />
          ))}

        <div className="dc-bot" style={{ left: helixX - S / 2, top: helixY + helixH / 2 + 14 }}>
          <motion.div initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 1, delay: 0.3, ease: EASE }}>
            <Bot pose={pose} size={S} look={pose === 'point' ? 1 : 0} />
          </motion.div>
        </div>

        <AnimatePresence>
          {(stage === 'card' || stage === 'leave') && (
            <motion.div
              key="card"
              className="dc-card"
              style={mobile ? { left: 16, right: 16, bottom: 24 } : { left: w * 0.52, top: h * 0.5 }}
              initial={{ opacity: 0, x: 40, y: mobile ? 0 : '-50%', scale: 0.94, filter: 'blur(12px)' }}
              animate={{ opacity: 1, x: 0, y: mobile ? 0 : '-50%', scale: 1, filter: 'blur(0px)' }}
              transition={{ duration: 1, ease: EASE }}
            >
              <div className="dc-card-glow" />
              <div className="dc-head">
                <motion.span
                  className="dc-medal"
                  initial={{ scale: 0, rotate: -180 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: 'spring', stiffness: 260, damping: 14, delay: 0.2 }}
                >
                  <Icon name="check" size={20} stroke={3.2} />
                </motion.span>
                <div>
                  <motion.div className="dc-kicker" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.35 }}>
                    Brand analysis complete
                  </motion.div>
                  <h2 className="dc-title">
                    {`${BRAND.short}'s DNA, decoded`.split(' ').map((wd, i) => (
                      <span key={i} className="dc-word">
                        <motion.span
                          initial={{ y: '105%' }}
                          animate={{ y: '0%' }}
                          transition={{ duration: 0.8, delay: 0.3 + i * 0.07, ease: EASE }}
                        >
                          {wd}
                        </motion.span>
                      </span>
                    ))}
                  </h2>
                </div>
              </div>

              <div className="dc-rows">
                {DNA.map((d, i) => (
                  <motion.div
                    key={d.k}
                    className="dc-row"
                    initial={{ opacity: 0, x: 24, filter: 'blur(6px)' }}
                    animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
                    transition={{ duration: 0.7, delay: 0.7 + i * 0.12, ease: EASE }}
                  >
                    <span className="dc-k mono">{d.k}</span>
                    <span className="dc-v">{d.v}</span>
                  </motion.div>
                ))}
              </div>

              <div className="dc-conf">
                <span>Confidence</span>
                <div className="dc-conf-track">
                  <motion.i initial={{ scaleX: 0 }} animate={{ scaleX: 0.97 }} transition={{ duration: 1.8, delay: 0.2, ease: EASE }} />
                </div>
                <b className="mono">{conf}%</b>
              </div>

              <motion.div
                className="dc-next"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 2.4, duration: 0.6 }}
              >
                <span className="dc-next-dot" />
                Next: scouring 12,480 ad spaces across the platform
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  )
}
