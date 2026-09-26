"use client";
import { AnimatePresence, animate, motion } from 'framer-motion'
import { useRef, useState } from 'react'
import { Media } from '../components/Media'
import { Bot, type BotMood } from '../components/Bot'
import { Icon } from '../components/Icon'
import { districtsOf, useScout, type AdSpace, type District } from '../data'
import { PURPLE, rgba, useCanvas } from '../lib/canvas'
import { rng, useCountUp, useSequence, useViewport } from '../lib/hooks'
import './scout.css'

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1]
const PERSPECTIVE = 900
const VP_Y = 0.46 // vanishing point, as a fraction of height
const Z0 = -2600 // where cards appear
const ZH = -260 // where a card pauses beside the bot for inspection
const Z1 = 700 // behind the camera
const APPROACH = 1.25
const HOLD = 1.15
const EXIT_MATCH = 0.95
const EXIT_SKIP = 0.8
const DIST_MS = 2300
const INTRO_MS = 1500
const TRAY_W = 56


type Side = 'l' | 'r'
type Hero = { uid: number; ad: AdSpace; side: Side; slot: number | null }
type Drift = { uid: number; ad: AdSpace; side: Side; y: number }
type Focus = { uid: number; side: Side; verdict: 'pending' | 'match' | 'skip' }
type Geo = {
  w: number
  h: number
  sideX: number
  cardW: number
  cardH: number
  tray: (slot: number) => { x: number; y: number }
}

const k = (z: number) => PERSPECTIVE / (PERSPECTIVE - z)

/** A listing that slows down beside Scout, gets scanned, then either flies into the shortlist or streams past. */
function HeroCard({ hero, g }: { hero: Hero; g: Geo }) {
  const s = hero.side === 'l' ? -1 : 1
  const match = hero.slot !== null
  const E = match ? EXIT_MATCH : EXIT_SKIP
  const T = APPROACH + HOLD + E
  const t1 = APPROACH / T
  const t2 = (APPROACH + HOLD) / T
  const tgt = match ? g.tray(hero.slot!) : { x: 0, y: 0 }
  const times = [0, t1, t2, 1]
  const ease = [[0.16, 1, 0.3, 1], 'linear', match ? [0.65, 0, 0.25, 1] : [0.6, 0, 0.9, 0.4]] as never

  return (
    <motion.div
      className={`sc-card ${match ? 'is-match' : 'is-skip'}`}
      style={{ width: g.cardW, height: g.cardH, marginLeft: -g.cardW / 2, marginTop: -g.cardH / 2 }}
      initial={{ x: s * g.sideX * 2.2, y: 0, z: Z0, rotateY: -s * 38, scale: 1, opacity: 0 }}
      animate={{
        x: [s * g.sideX * 2.2, s * g.sideX, s * g.sideX * 0.97, match ? tgt.x : s * g.sideX * 1.2],
        y: [0, 0, 0, match ? tgt.y : 0],
        z: [Z0, ZH, ZH + 30, match ? 0 : Z1],
        rotateY: [-s * 38, -s * 18, -s * 15, match ? 0 : -s * 34],
        scale: [1, 1, 1, match ? TRAY_W / g.cardW : 1],
        opacity: [0, 1, 1, 1, 0],
      }}
      transition={{
        duration: T,
        times,
        ease,
        opacity: { duration: T, times: [0, t1 * 0.6, t2, match ? 0.94 : 0.85, 1], ease: 'linear' },
      }}
    >
      <div className="sc-card-in">
        <Media src={hero.ad.imageUrl} art={hero.ad.art} className="sc-art" alt={hero.ad.title} />
        <div className="sc-meta">
          <b>{hero.ad.title}</b>
          <span>{hero.ad.objectTitle}{hero.ad.loc && hero.ad.loc !== '—' ? ` · ${hero.ad.loc}` : ''}</span>
        </div>
        {/* scan line sweeping the card while Scout reads it */}
        <motion.i
          className="sc-scan"
          initial={{ y: -10, opacity: 0 }}
          animate={{ y: [-10, g.cardH], opacity: [0, 1, 1, 0] }}
          transition={{ delay: APPROACH + 0.05, duration: 0.85, ease: 'easeInOut' }}
        />
        <motion.div
          className="sc-verdict"
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: APPROACH + 0.75, type: 'spring', stiffness: 500, damping: 22 }}
        >
          {match && <Icon name="check" size={12} stroke={3.4} />}
          {match ? `${hero.ad.match}% · best fit` : `${hero.ad.match}% · not the one`}
        </motion.div>
        {match ? (
          <motion.div
            className="sc-glow"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 1, 0.7] }}
            transition={{ delay: APPROACH + 0.75, duration: 0.7 }}
          />
        ) : (
          <motion.div
            className="sc-dim"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: APPROACH + 0.85, duration: 0.4 }}
          />
        )}
      </div>
    </motion.div>
  )
}

/** Background listings streaming through the outer lanes: the sense of volume. */
function DriftCard({ d, g }: { d: Drift; g: Geo }) {
  const s = d.side === 'l' ? -1 : 1
  const w = g.cardW * 0.72
  return (
    <motion.div
      className="sc-card sc-drift"
      style={{ width: w, marginLeft: -w / 2, marginTop: -w * 0.4, x: s * g.sideX * 2.4, y: d.y, rotateY: -s * 42 }}
      initial={{ z: Z0, opacity: 0 }}
      animate={{ z: Z1, opacity: [0, 0.55, 0.55, 0] }}
      transition={{ duration: 2.4, ease: 'linear', opacity: { duration: 2.4, times: [0, 0.35, 0.82, 1] } }}
    >
      <div className="sc-card-in">
        <Media src={d.ad.imageUrl} art={d.ad.art} className="sc-art" />
      </div>
    </motion.div>
  )
}

export function Scout({ onDone }: { onDone: () => void }) {
  const live = useScout()
  const DISTRICTS: District[] = districtsOf(live)
  const STREAM: AdSpace[] = live.candidates ?? []
  const pickId = live.pickId
  const TOTAL_LISTINGS = Math.max(1, DISTRICTS.reduce((s, d) => s + d.listings, 0))
  const { w, h } = useViewport()
  const mobile = w < 760
  const [district, setDistrict] = useState(-1)
  const [heroes, setHeroes] = useState<Hero[]>([])
  const [drifts, setDrifts] = useState<Drift[]>([])
  const [picked, setPicked] = useState<AdSpace[]>([])
  const [focus, setFocus] = useState<Focus | null>(null)
  const [thought, setThought] = useState('Made it through!')
  const [finishing, setFinishing] = useState(false)
  const speed = useRef(1)
  const rings = useRef<number[]>([]) // start times of warp rings, in canvas seconds
  const clock = useRef(0)
  const uid = useRef(0)
  const scanned = useCountUp(TOTAL_LISTINGS, DISTRICTS.length * DIST_MS + 1200, district >= 0)

  const S = mobile ? 104 : Math.min(140, h * 0.17)
  const botY = h * 0.54
  const headY = botY - S * 0.17
  const cardW = mobile ? 150 : Math.min(270, w * 0.19)
  const cardH = Math.round(cardW * 0.625 + 58)
  const sideX = mobile ? w * 0.3 : Math.min(w * 0.27, 400)
  const dockW = Math.min(780, w - 24)
  const g: Geo = {
    w,
    h,
    sideX,
    cardW,
    cardH,
    // screen position of shortlist slot n, expressed as a translate at z = 0
    tray: (n) => ({
      x: w / 2 + dockW / 2 - 200 + n * 12 + TRAY_W / 2 - w / 2,
      y: h - 62 - h * VP_Y,
    }),
  }

  // warp field
  const warp = useRef<{ a: number; d: number; s: number; p: boolean }[] | null>(null)
  const canvasRef = useCanvas((ctx, cw, ch, dt, t) => {
    clock.current = t
    if (!warp.current) {
      const r = rng(77)
      warp.current = Array.from({ length: 380 }, () => ({ a: r() * Math.PI * 2, d: r(), s: 0.5 + r() * 1.5, p: r() > 0.7 }))
    }
    ctx.fillStyle = 'rgba(10,10,11,0.35)'
    ctx.fillRect(0, 0, cw, ch)
    const cx = cw / 2
    const cy = ch * VP_Y
    const maxD = Math.hypot(cw, ch) * 0.62
    const sp = speed.current
    ctx.globalCompositeOperation = 'lighter'
    for (const s of warp.current) {
      s.d += dt * sp * (0.12 + s.d * 1.3)
      if (s.d > 1.05) {
        s.d = 0.02 + Math.random() * 0.05
        s.a = Math.random() * Math.PI * 2
      }
      const d = s.d * s.d * maxD
      const len = Math.min(180, 6 + s.d * s.d * 160 * sp)
      const x = cx + Math.cos(s.a) * d
      const y = cy + Math.sin(s.a) * d
      const a = Math.min(1, s.d * 1.8)
      ctx.strokeStyle = s.p ? rgba(PURPLE, a) : `rgba(255,255,255,${a * 0.8})`
      ctx.lineWidth = s.s * (0.4 + s.d)
      ctx.beginPath()
      ctx.moveTo(x, y)
      ctx.lineTo(cx + Math.cos(s.a) * (d + len), cy + Math.sin(s.a) * (d + len))
      ctx.stroke()
    }
    // warp rings: one pulse per new section, drawn beneath everything else
    rings.current = rings.current.filter((t0) => t - t0 < 1.1)
    for (const t0 of rings.current) {
      const a = (t - t0) / 1.1
      const e = a * a
      ctx.strokeStyle = rgba(PURPLE, 0.7 * (1 - a))
      ctx.lineWidth = 2 + e * 10
      ctx.shadowColor = rgba(PURPLE, 0.9)
      ctx.shadowBlur = 24
      ctx.beginPath()
      ctx.ellipse(cx, cy, 20 + e * maxD * 1.1, 12 + e * maxD * 0.7, 0, 0, Math.PI * 2)
      ctx.stroke()
      ctx.shadowBlur = 0
    }
    ctx.globalCompositeOperation = 'source-over'
    const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, 240)
    glow.addColorStop(0, rgba(PURPLE, 0.2 * Math.min(1.5, sp)))
    glow.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = glow
    ctx.fillRect(cx - 240, cy - 240, 480, 480)
  })

  useSequence(async ({ wait }) => {
    const setSpeed = (to: number, duration: number) =>
      animate(speed.current, to, { duration, ease: 'easeInOut', onUpdate: (v) => (speed.current = v) })

    const spawnHero = (ad: AdSpace, side: Side, slot: number | null) => {
      const id = ++uid.current
      setHeroes((x) => [...x, { uid: id, ad, side, slot }])
      ;(async () => {
        await wait(APPROACH * 1000)
        setFocus({ uid: id, side, verdict: 'pending' })
        setThought(`Checking ${ad.title}…`)
        await wait(750)
        setFocus({ uid: id, side, verdict: slot !== null ? 'match' : 'skip' })
        setThought(slot !== null ? `Best fit · ${ad.match}%` : `${ad.match}% · not quite right`)
        await wait(HOLD * 1000 - 750)
        setFocus((f) => (f?.uid === id ? null : f))
        if (slot !== null) {
          await wait(EXIT_MATCH * 1000 - 60)
          setPicked((p) => [...p, ad])
          await wait(200)
        } else {
          await wait(EXIT_SKIP * 1000 + 100)
        }
        setHeroes((x) => x.filter((c) => c.uid !== id))
      })().catch(() => {})
    }

    const spawnDrift = (ad: AdSpace, side: Side, y: number) => {
      const id = ++uid.current
      setDrifts((x) => [...x, { uid: id, ad, side, y }])
      window.setTimeout(() => setDrifts((x) => x.filter((c) => c.uid !== id)), 2500)
    }

    await wait(INTRO_MS)
    const r = rng(5)
    let slot = 0
    for (let di = 0; di < DISTRICTS.length; di++) {
      const d = DISTRICTS[di]
      const t0 = performance.now()
      setDistrict(di)
      rings.current.push(clock.current)
      setSpeed(2.4, 0.35).then(() => setSpeed(1, 0.9))
      if (d.thought) setThought(d.thought)

      const real = STREAM.filter((a) => a.district === d.id)
      // background lanes: other real listings drifting past for a sense of volume
      const others = STREAM.filter((a) => a.district !== d.id)
      const pool = others.length ? others : real
      const drift = (i: number): AdSpace | undefined => pool[(di * 3 + i) % Math.max(1, pool.length)]
      const lane = (i: number) => (i % 2 ? 1 : -1) * h * (0.34 + r() * 0.04)

      for (let j = 0; j < real.length; j++) {
        const side: Side = j % 2 ? 'r' : 'l'
        const dr = drift(j)
        if (!mobile && dr) spawnDrift(dr, side === 'l' ? 'r' : 'l', lane(j))
        const ad = real[j]
        spawnHero(ad, side, ad.id === pickId ? slot++ : null)
        await wait(1150)
      }
      const spent = performance.now() - t0
      await wait(Math.max(300, DIST_MS - spent))
    }

    await wait(Math.max(400, (APPROACH + HOLD + EXIT_MATCH) * 1000 - DIST_MS + 1300))
    setFinishing(true)
    setThought(slot ? 'Found the one!' : 'Nothing fit this time')
    await setSpeed(0.15, 1.2)
    await wait(1000)
    onDone()
  })

  // gaze beam from the visor to the card being inspected
  const beam = (() => {
    if (!focus) return null
    const s = focus.side === 'l' ? -1 : 1
    const kk = k(ZH)
    const cx = w / 2 + s * sideX * kk
    const half = (cardW / 2) * Math.cos((18 * Math.PI) / 180) * kk
    const inner = cx - s * half
    const cy = h * VP_Y
    const hh = (cardH / 2) * kk
    const vx = w / 2 + s * 18
    return { d: `M ${vx} ${headY - 6} L ${inner} ${cy - hh} L ${inner} ${cy + hh} L ${vx} ${headY + 6} Z`, vx, inner, s }
  })()

  const title = finishing ? 'Every corner, checked.' : district < 0 ? 'Entering the marketplace' : DISTRICTS[district]?.name ?? ''
  const mood: BotMood | undefined = finishing || focus?.verdict === 'match' ? 'happy' : focus ? 'focus' : undefined

  return (
    <motion.div
      className="scene scout"
      initial={{ opacity: 0, scale: 1.25, filter: 'blur(20px)' }}
      animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
      exit={{ opacity: 0, scale: 0.96, filter: 'blur(10px)', transition: { duration: 0.8 } }}
      transition={{ duration: 1.2, ease: EASE }}
    >
      <canvas ref={canvasRef} className="sc-canvas" />

      {/* 3D corridor */}
      <div className="sc-tunnel" style={{ perspective: PERSPECTIVE, perspectiveOrigin: `50% ${VP_Y * 100}%` }}>
        <div className="sc-space">
        <div className="sc-floor" />
        {drifts.map((d) => (
          <DriftCard key={d.uid} d={d} g={g} />
        ))}
        {heroes.map((c) => (
          <HeroCard key={c.uid} hero={c} g={g} />
        ))}
        </div>
      </div>

      {/* gaze beam */}
      <svg className="sc-beam" width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
        <defs>
          {beam && (
            <linearGradient id="sc-beam-grad" gradientUnits="userSpaceOnUse" x1={beam.vx} y1="0" x2={beam.inner} y2="0">
              <stop offset="0" stopColor="#fff" stopOpacity="0.55" />
              <stop offset="0.35" stopColor="var(--p)" stopOpacity="0.28" />
              <stop offset="1" stopColor="var(--p)" stopOpacity="0.1" />
            </linearGradient>
          )}
        </defs>
        <AnimatePresence>
          {beam && (
            <motion.path
              key={focus!.uid}
              d={beam.d}
              fill="url(#sc-beam-grad)"
              initial={{ opacity: 0 }}
              animate={{ opacity: [0.7, 1, 0.8, 1] }}
              exit={{ opacity: 0, transition: { duration: 0.25 } }}
              transition={{ duration: 0.6, repeat: Infinity, repeatType: 'mirror' }}
            />
          )}
        </AnimatePresence>
      </svg>

      {/* Scout tumbles out of the wormhole, then hovers and thinks */}
      <div className="sc-bot" style={{ left: w / 2, top: botY }}>
        <motion.span
          className="sc-portal"
          initial={{ scale: 3, opacity: 0.9 }}
          animate={{ scale: 0, opacity: 0 }}
          transition={{ duration: 1.1, ease: [0.7, 0, 0.3, 1], delay: 0.2 }}
        />
        <motion.div
          initial={{ scale: 0.05, rotate: -600, opacity: 0 }}
          animate={{ scale: 1, rotate: 0, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 60, damping: 11, mass: 0.9, delay: 0.25 }}
        >
          <div className="sc-orbit" style={{ width: S * 1.9, height: S * 1.9 }}>
            <i />
            <i />
          </div>
          <div style={{ marginLeft: -S / 2, marginTop: -S * 0.62, position: 'relative' }}>
            <Bot
              pose={finishing ? 'celebrate' : 'think'}
              look={focus ? (focus.side === 'l' ? -1 : 1) : 0}
              lookY={-0.1}
              mood={mood}
              size={S}
              visorScan={!!focus && focus.verdict === 'pending'}
            />
          </div>
        </motion.div>

        <motion.div
          className="sc-thought"
          style={{ top: -S * 0.66 }}
          initial={{ opacity: 0, y: 10, x: '-50%' }}
          animate={{ opacity: 1, y: 0, x: '-50%' }}
          transition={{ delay: 1.1, duration: 0.6, ease: EASE }}
        >
          <motion.div className={`sc-cloud ${focus?.verdict === 'match' ? 'is-match' : ''}`} layout transition={{ layout: { duration: 0.35, ease: EASE } }}>
            <span className="sc-think-ico">
              <motion.span animate={{ rotate: 360 }} transition={{ duration: focus ? 1.2 : 3, repeat: Infinity, ease: 'linear' }}>
                <Icon name={focus?.verdict === 'match' ? 'check' : 'spark'} size={13} stroke={2.4} />
              </motion.span>
            </span>
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={thought}
                className="sc-thought-txt"
                initial={{ opacity: 0, y: 8, filter: 'blur(4px)' }}
                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                exit={{ opacity: 0, y: -8, filter: 'blur(4px)' }}
                transition={{ duration: 0.22 }}
              >
                {thought}
              </motion.span>
            </AnimatePresence>
          </motion.div>
          <i className="sc-thought-dot d1" />
          <i className="sc-thought-dot d2" />
        </motion.div>
      </div>

      {/* HUD: one title up top, one dock at the bottom */}
      <motion.div
        className="sc-hud-top"
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.8, duration: 0.7, ease: EASE }}
      >
        <span className="sc-kicker">
          <i className="sc-live" /> Scanning platform
        </span>
        <AnimatePresence mode="wait" initial={false}>
          <motion.h2
            key={title}
            initial={{ opacity: 0, y: 18, filter: 'blur(10px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            exit={{ opacity: 0, y: -18, filter: 'blur(10px)' }}
            transition={{ duration: 0.4, ease: EASE }}
          >
            {title}
          </motion.h2>
        </AnimatePresence>
        <div className="sc-progress">
          <div className="sc-progress-bar">
            <i style={{ transform: `scaleX(${scanned / TOTAL_LISTINGS})` }} />
          </div>
          <span className="mono">
            {scanned.toLocaleString('en-US')} / {TOTAL_LISTINGS.toLocaleString('en-US')} ad spaces · read from ENS
          </span>
        </div>
      </motion.div>

      <motion.div
        className="sc-dock"
        style={{ width: dockW }}
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1, duration: 0.8, ease: EASE }}
      >
        <div className="sc-map">
          <div className="sc-map-track">
            <motion.i
              className="sc-map-fill"
              animate={{ scaleX: finishing ? 1 : Math.max(0, district) / Math.max(1, DISTRICTS.length - 1) }}
              transition={{ duration: 0.9, ease: EASE }}
            />
          </div>
          {DISTRICTS.map((d, i) => {
            const state = finishing || i < district ? 'done' : i === district ? 'active' : 'todo'
            return (
              <div key={d.id} className={`sc-map-node is-${state}`}>
                <span className="sc-map-dot">
                  {state === 'done' ? <Icon name="check" size={10} stroke={3.6} /> : null}
                  {state === 'active' && <i className="sc-map-ping" />}
                </span>
                <span className="sc-map-label">{d.name.split(' ')[0]}</span>
              </div>
            )
          })}
        </div>
        <div className="sc-tray">
          <div className="sc-tray-stack">
            {picked.map((p, i) => (
              <motion.div
                key={p.id}
                className="sc-tray-item"
                style={{ zIndex: i, x: i * 12 }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1, scale: finishing ? [1, 1.12, 1] : 1 }}
                transition={{ opacity: { duration: 0.15 }, scale: { delay: i * 0.06, duration: 0.5 } }}
              >
                <Media src={p.imageUrl} art={p.art} />
              </motion.div>
            ))}
          </div>
          <div className="sc-tray-count">
            <motion.b key={picked.length} initial={{ scale: 1.6 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 500, damping: 15 }}>
              {picked.length}
            </motion.b>
            <span>best match</span>
          </div>
        </div>
      </motion.div>

      <motion.div className="sc-whiteout" initial={{ opacity: 1 }} animate={{ opacity: 0 }} transition={{ duration: 1.1, ease: 'easeOut' }} />
    </motion.div>
  )
}
