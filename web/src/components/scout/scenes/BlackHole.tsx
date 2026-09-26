"use client";
import { AnimatePresence, animate, motion, useMotionValue, useTransform } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import { Bot, type BotPose } from '../components/Bot'
import { PURPLE, rgba, useCanvas } from '../lib/canvas'
import { rng, useSequence, useViewport } from '../lib/hooks'
import { PARENT, useScout } from '../data'
import './blackhole.css'

type DiskP = { r: number; th: number; w: number; s: number; hot: number }
type Star = { a: number; d: number; s: number; tw: number }

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1]

function buildSim() {
  const r1 = rng(9)
  const disk: DiskP[] = Array.from({ length: 2200 }, () => {
    const u = r1()
    const rr = 1.25 + Math.pow(u, 1.8) * 2.6
    return { r: rr, th: r1() * Math.PI * 2, w: 1 / Math.pow(rr, 1.5), s: 0.6 + r1() * 1.6, hot: 1 - u }
  })
  const r2 = rng(21)
  const halo: DiskP[] = Array.from({ length: 700 }, () => {
    const rr = 1.04 + Math.pow(r2(), 2) * 0.4
    return { r: rr, th: r2() * Math.PI * 2, w: 0.6 / rr, s: 0.5 + r2() * 1.2, hot: r2() }
  })
  const r3 = rng(3)
  const stars: Star[] = Array.from({ length: 420 }, () => ({ a: r3() * Math.PI * 2, d: 0.2 + r3(), s: 0.4 + r3() * 1.4, tw: r3() * 6 }))
  return { disk, halo, stars }
}

/** Holds (the hole keeps spinning) until the agent has read ENS and ranked every space. */
export function BlackHole({ onDone }: { onDone: () => void }) {
  const live = useScout()
  const ready = !!live.candidates?.length && !!live.pickId
  const readyRef = useRef(ready)
  const failedRef = useRef(!!live.error)
  useEffect(() => {
    readyRef.current = ready
    failedRef.current = !!live.error
  }, [ready, live.error])
  const { w, h } = useViewport()
  const cx = w / 2
  const cy = h * 0.5
  const baseR = Math.min(w, h) * 0.1

  const [pose, setPose] = useState<BotPose>('float')
  const [caption, setCaption] = useState(0)
  const [flash, setFlash] = useState(false)

  // animation state shared with the canvas loop
  const st = useRef({ form: 0, pull: 0.25, spin: 1, collapse: 0 })

  const sim = useRef<{ disk: DiskP[]; halo: DiskP[]; stars: Star[] } | null>(null)

  const canvasRef = useCanvas((ctx, cw, ch, dt, t) => {
    sim.current ??= buildSim()
    const { disk, halo, stars } = sim.current
    const S = st.current
    const maxD = Math.hypot(cw, ch) * 0.6
    const R = baseR * S.form * (1 + S.collapse * S.collapse * 14)

    ctx.globalCompositeOperation = 'source-over'
    ctx.fillStyle = 'rgba(10,10,11,0.42)' // short trails
    ctx.fillRect(0, 0, cw, ch)

    ctx.globalCompositeOperation = 'lighter'
    // stars falling inward, stretching as the pull grows
    for (const s of stars) {
      s.d -= dt * S.pull * (0.05 + (1 - s.d) * 0.2) * 1.6
      s.a += dt * S.pull * 0.12 / Math.max(0.15, s.d)
      if (s.d * maxD < R * 1.05) {
        s.d = 1 + Math.random() * 0.2
      }
      const d = s.d * maxD
      const x = cx + Math.cos(s.a) * d
      const y = cy + Math.sin(s.a) * d
      const streak = Math.min(90, S.pull * S.pull * 26 * (1.2 - s.d) + 1)
      const tw = 0.5 + 0.5 * Math.sin(t * 2 + s.tw)
      ctx.strokeStyle = `rgba(255,255,255,${0.25 + tw * 0.45})`
      ctx.lineWidth = s.s
      ctx.beginPath()
      ctx.moveTo(x, y)
      ctx.lineTo(cx + Math.cos(s.a) * (d + streak), cy + Math.sin(s.a) * (d + streak))
      ctx.stroke()
    }

    if (S.form > 0.001) {
      // outer bloom
      const g = ctx.createRadialGradient(cx, cy, R * 0.9, cx, cy, R * 4.2)
      g.addColorStop(0, rgba(PURPLE, 0.35 * S.form))
      g.addColorStop(0.4, rgba(PURPLE, 0.08 * S.form))
      g.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.arc(cx, cy, R * 4.2, 0, Math.PI * 2)
      ctx.fill()

      const tilt = 0.13
      const drawDisk = (front: boolean) => {
        for (const p of disk) {
          if (!front) p.th += dt * p.w * 2.4 * S.spin
          const sn = Math.sin(p.th)
          if (front !== sn > 0) continue
          const rr = p.r * R
          const x = cx + Math.cos(p.th) * rr
          const y = cy + sn * rr * tilt
          // doppler: the approaching side glows brighter
          const dop = 0.45 + 0.55 * (0.5 - 0.5 * Math.cos(p.th + 0.3))
          const inShadow = front && (x - cx) * (x - cx) + (y - cy) * (y - cy) < R * R
          const a = (0.25 + p.hot * 0.75) * dop * S.form * (inShadow ? 0.45 : 1)
          ctx.fillStyle = p.hot > 0.72 ? `rgba(255,255,255,${a})` : rgba(PURPLE, a)
          ctx.fillRect(x, y, p.s * 1.6, p.s)
        }
      }
      // halo: the far side of the disk bent over the top by gravity
      for (const p of halo) {
        p.th += dt * p.w * 2 * S.spin
        const rr = p.r * R
        const x = cx + Math.cos(p.th) * rr
        const y = cy + Math.sin(p.th) * rr * 0.96
        const a = (0.2 + p.hot * 0.6) * S.form
        ctx.fillStyle = p.hot > 0.6 ? `rgba(255,255,255,${a})` : rgba(PURPLE, a)
        ctx.fillRect(x, y, p.s, p.s)
      }
      drawDisk(false)

      // the shadow
      ctx.globalCompositeOperation = 'source-over'
      ctx.fillStyle = '#000'
      ctx.beginPath()
      ctx.arc(cx, cy, R, 0, Math.PI * 2)
      ctx.fill()
      // photon ring
      ctx.globalCompositeOperation = 'lighter'
      ctx.strokeStyle = `rgba(255,255,255,${0.85 * S.form})`
      ctx.lineWidth = 1.6
      ctx.shadowColor = rgba(PURPLE, 1)
      ctx.shadowBlur = 24
      ctx.beginPath()
      ctx.arc(cx, cy, R * 1.02, 0, Math.PI * 2)
      ctx.stroke()
      ctx.shadowBlur = 0

      drawDisk(true)
    }
    ctx.globalCompositeOperation = 'source-over'
  })

  // bot spiral
  const p = useMotionValue(0)
  const startD = Math.min(w * 0.3, 420)
  const a0 = Math.PI * 0.94
  const turns = 2.1
  const bx = useTransform(p, (v) => cx + Math.cos(a0 + v * turns * Math.PI * 2) * startD * (1 - v) * (1 - v * 0.15))
  const by = useTransform(p, (v) => cy + Math.sin(a0 + v * turns * Math.PI * 2) * startD * (1 - v) * 0.45)
  const bs = useTransform(p, (v) => Math.max(0.02, 1 - Math.pow(v, 0.9)))
  const br = useTransform(p, (v) => v * 900)
  const bo = useTransform(p, [0, 0.92, 1], [1, 1, 0])

  useSequence(async ({ wait }) => {
    const S = st.current
    // the hole forms
    animate(0, 1, { duration: 1.8, ease: EASE, onUpdate: (v) => (S.form = v) })
    animate(0.25, 1.4, { duration: 2.2, onUpdate: (v) => (S.pull = v) })
    animate(p, 0.04, { duration: 1.8, ease: 'easeInOut' })
    await wait(1900)
    setCaption(1)
    // wait here, orbiting, until the scan is ranked (or the run failed)
    while (!readyRef.current && !failedRef.current) await wait(250)
    if (failedRef.current) return
    setCaption(2)
    setPose('sucked')
    animate(1.4, 4.2, { duration: 2.6, ease: 'easeIn', onUpdate: (v) => (S.pull = v) })
    animate(1, 3.2, { duration: 2.6, ease: 'easeIn', onUpdate: (v) => (S.spin = v) })
    await new Promise<void>((res) => {
      animate(p, 1, { duration: 2.6, ease: [0.5, 0, 0.9, 0.55] }).then(() => res())
    })
    setFlash(true)
    animate(0, 1, { duration: 1.1, ease: [0.7, 0, 0.84, 0], onUpdate: (v) => (S.collapse = v) })
    await wait(1100)
    onDone()
  })

  const S = Math.min(140, h * 0.16)
  const n = live.universe?.names
  const captions = [
    `Opening a wormhole into ${PARENT}`,
    n ? `Resolving ${n} names under ${PARENT}…` : `Resolving names under ${PARENT}…`,
    `Diving into ${live.candidates?.length ?? 0} ad spaces…`,
  ]

  return (
    <motion.div
      className="scene blackhole"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.35 } }}
      transition={{ duration: 0.8 }}
    >
      <canvas ref={canvasRef} className="bh-canvas" />

      <motion.div className="bh-bot" style={{ x: bx, y: by, scale: bs, rotate: br, opacity: bo }}>
        <div style={{ marginLeft: -S / 2, marginTop: -S * 0.62 }}>
          <Bot pose={pose} size={S} look={0.8} mood={pose === 'float' ? 'wide' : undefined} />
        </div>
      </motion.div>

      <div className="bh-caption">
        <AnimatePresence mode="wait">
          <motion.div
            key={caption}
            initial={{ opacity: 0, y: 14, filter: 'blur(8px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            exit={{ opacity: 0, y: -14, filter: 'blur(8px)' }}
            transition={{ duration: 0.6, ease: EASE }}
          >
            <span className="bh-kicker">Phase 2 · Scout platform</span>
            <h2>{captions[caption]}</h2>
          </motion.div>
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {flash && (
          <motion.div
            key="flash"
            className="bh-flash"
            initial={{ opacity: 0, scale: 0.2 }}
            animate={{ opacity: [0, 1, 1], scale: [0.2, 1.4, 3] }}
            transition={{ duration: 1.1, times: [0, 0.5, 1], ease: 'easeIn' }}
          />
        )}
      </AnimatePresence>
    </motion.div>
  )
}
