import { AnimatePresence, motion } from 'framer-motion'
import { useRef, useState } from 'react'
import { AdArt } from '../components/AdArt'
import { Bot, type BotMood } from '../components/Bot'
import { Icon } from '../components/Icon'
import { DISTRICTS, MATCH_THRESHOLD, STREAM, type AdSpace, type ArtKind } from '../data'
import { PURPLE, rgba, useCanvas } from '../lib/canvas'
import { rng, useCountUp, useSequence, useViewport } from '../lib/hooks'
import './scout.css'

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1]
const FLY = 3.4 // seconds a card takes to pass the camera
const Z0 = -2600
const Z1 = 700
const PERSPECTIVE = 900
const DIST_MS = 2300
const TOTAL_LISTINGS = DISTRICTS.reduce((s, d) => s + d.listings, 0)

const FILLERS: Record<string, { art: ArtKind; titles: string[] }> = {
  outdoor: { art: 'billboard', titles: ['Worli Sea Face Hoarding', 'MG Road Unipole', 'Airport Road Gantry'] },
  transit: { art: 'bus', titles: ['Airport Shuttle Wraps', 'Local Train Panels', 'Auto-rickshaw Backs'] },
  audio: { art: 'radio', titles: ['Retro FM Drive-time', 'Startup Stories Pod', 'Bollywood Beats FM'] },
  creators: { art: 'video', titles: ['@travelwithtara', '@techunboxed', '@memequeen.in'] },
  newsletters: { art: 'magazine', titles: ['Market Minute', 'Finance Friday', 'Cricket Digest'] },
  indoor: { art: 'screens', titles: ['Gym Locker Screens', 'Cinema Pre-roll', 'Salon Mirrors'] },
  events: { art: 'stadium', titles: ['Marathon Finish Arch', 'Comedy Night Stage', 'Esports Arena'] },
}

type Card = { uid: number; ad: AdSpace; side: 'l' | 'r'; tier: number }
type Ghost = { uid: number; ad: AdSpace; x: number; y: number }

export function Scout({ onDone }: { onDone: () => void }) {
  const { w, h } = useViewport()
  const mobile = w < 760
  const [district, setDistrict] = useState(0)
  const [cards, setCards] = useState<Card[]>([])
  const [gates, setGates] = useState<number[]>([])
  const [ghosts, setGhosts] = useState<Ghost[]>([])
  const [picked, setPicked] = useState<AdSpace[]>([])
  const [look, setLook] = useState(0)
  const [mood, setMood] = useState<BotMood | undefined>(undefined)
  const [thought, setThought] = useState(DISTRICTS[0].thought)
  const [finishing, setFinishing] = useState(false)
  const speed = useRef(1)
  const uid = useRef(0)
  const scanned = useCountUp(TOTAL_LISTINGS, DISTRICTS.length * DIST_MS + 400)

  const cardW = mobile ? 180 : Math.min(300, w * 0.2)
  const sideX = mobile ? w * 0.34 : Math.min(w * 0.3, 470)
  const tierY = [-h * 0.13, h * 0.07]
  const botY = h * 0.52

  // warp field
  const warp = useRef<{ a: number; d: number; s: number; p: boolean }[] | null>(null)
  const canvasRef = useCanvas((ctx, cw, ch, dt) => {
    if (!warp.current) {
      const r = rng(77)
      warp.current = Array.from({ length: 360 }, () => ({ a: r() * Math.PI * 2, d: r(), s: 0.5 + r() * 1.5, p: r() > 0.7 }))
    }
    const stars = warp.current
    ctx.fillStyle = 'rgba(10,10,11,0.35)'
    ctx.fillRect(0, 0, cw, ch)
    const cx = cw / 2
    const cy = ch * 0.46
    const maxD = Math.hypot(cw, ch) * 0.62
    const sp = speed.current
    ctx.globalCompositeOperation = 'lighter'
    for (const s of stars) {
      s.d += dt * sp * (0.12 + s.d * 1.3)
      if (s.d > 1.05) {
        s.d = 0.02 + Math.random() * 0.05
        s.a = Math.random() * Math.PI * 2
      }
      const d = s.d * s.d * maxD
      const len = Math.min(140, 6 + s.d * s.d * 160 * sp)
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
    ctx.globalCompositeOperation = 'source-over'
    // central glow at the vanishing point
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, 220)
    g.addColorStop(0, rgba(PURPLE, 0.22 * sp))
    g.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = g
    ctx.fillRect(cx - 220, cy - 220, 440, 440)
  })

  useSequence(async ({ wait }) => {

    const project = (side: 'l' | 'r', tier: number, t: number) => {
      const z = Z0 + (Z1 - Z0) * t
      const k = PERSPECTIVE / (PERSPECTIVE - z)
      const x = w / 2 + (side === 'l' ? -sideX : sideX) * k
      const y = h * 0.46 + tierY[tier] * k
      return { x, y }
    }

    const spawn = (ad: AdSpace, side: 'l' | 'r', tier: number) => {
      const id = ++uid.current
      setCards((c) => [...c, { uid: id, ad, side, tier }])
      ;(async () => {
        await wait(1350)
        setLook(side === 'l' ? -1 : 1)
        await wait(650)
        if (ad.match >= MATCH_THRESHOLD) {
          const pos = project(side, tier, 2 / FLY)
          setGhosts((g) => [...g, { uid: id, ad, x: pos.x, y: pos.y }])
          setMood('happy')
          setThought(`Ooh — ${ad.title}!`)
          await wait(900)
          setPicked((p) => [...p, ad])
          setGhosts((g) => g.filter((x) => x.uid !== id))
          setMood(undefined)
        }
        await wait(1600)
        setCards((c) => c.filter((x) => x.uid !== id))
      })().catch(() => {})
    }

    const r = rng(5)
    for (let di = 0; di < DISTRICTS.length; di++) {
      const d = DISTRICTS[di]
      setDistrict(di)
      setThought(d.thought)
      setGates((g) => [...g, di])
      const real = STREAM.filter((a) => a.district === d.id)
      const f = FILLERS[d.id]
      const fill = (i: number): AdSpace => ({
        id: `f-${d.id}-${i}`,
        title: f.titles[i % f.titles.length],
        district: d.id,
        loc: '',
        art: f.art,
        match: 18 + Math.round(r() * 50),
        reach: '',
        price: 0,
        unit: '',
        format: '',
      })
      const order: AdSpace[] = [fill(0), real[0], fill(1), real[1] ?? fill(2), fill(2)]
      const sides: ('l' | 'r')[] = di % 2 ? ['r', 'r', 'l', 'l', 'r'] : ['l', 'l', 'r', 'r', 'l']
      for (let i = 0; i < order.length; i++) {
        spawn(order[i], sides[i], (i + di) % 2)
        await wait(DIST_MS / order.length)
      }
      window.setTimeout(() => setGates((g) => g.filter((x) => x !== di)), 2600)
    }
    await wait(2200)
    setLook(0)
    setFinishing(true)
    setThought('Found them all!')
    setMood('happy')
    const t0 = performance.now()
    await new Promise<void>((res) => {
      const tick = () => {
        const p = Math.min(1, (performance.now() - t0) / 1200)
        speed.current = 1 - p * 0.85
        if (p < 1) requestAnimationFrame(tick)
        else res()
      }
      tick()
    })
    await wait(900)
    onDone()
  })

  const S = mobile ? 110 : Math.min(150, h * 0.17)
  const dockW = Math.min(780, w - 24)
  const trayX = w / 2 + dockW / 2 - 110
  const trayY = h - 64

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
      <div className="sc-tunnel" style={{ perspective: PERSPECTIVE, perspectiveOrigin: '50% 46%' }}>
        <div className="sc-floor" />
        {gates.map((gi) => (
          <motion.div
            key={`g${gi}`}
            className="sc-gate"
            style={{ width: Math.min(w * 0.92, 1400), height: h * 0.8, x: '-50%', y: '-50%' }}
            initial={{ z: -3200, opacity: 0 }}
            animate={{ z: 900, opacity: [0, 1, 1, 0] }}
            transition={{ duration: 2.6, ease: [0.5, 0, 0.9, 0.6], opacity: { duration: 2.6, times: [0, 0.2, 0.85, 1] } }}
          >
            <span className="sc-gate-label">
              <i>{String(gi + 1).padStart(2, '0')}</i>
              {DISTRICTS[gi].name}
            </span>
          </motion.div>
        ))}
        {cards.map((c) => {
          const match = c.ad.match >= MATCH_THRESHOLD
          return (
            <motion.div
              key={c.uid}
              className={`sc-card ${match ? 'is-match' : 'is-skip'}`}
              style={{
                width: cardW,
                marginLeft: -cardW / 2,
                x: c.side === 'l' ? -sideX : sideX,
                y: tierY[c.tier],
                rotateY: c.side === 'l' ? 38 : -38,
              }}
              initial={{ z: Z0, opacity: 0 }}
              animate={{ z: Z1, opacity: [0, 1, 1, 0] }}
              transition={{ duration: FLY, ease: 'linear', opacity: { duration: FLY, times: [0, 0.16, 0.86, 1] } }}
            >
              <div className="sc-card-in">
                <AdArt kind={c.ad.art} className="sc-art" />
                <div className="sc-meta">
                  <b>{c.ad.title}</b>
                  <span>{DISTRICTS.find((d) => d.id === c.ad.district)?.name}</span>
                </div>
                <motion.div
                  className="sc-verdict"
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 1.9, type: 'spring', stiffness: 500, damping: 22 }}
                >
                  {match ? <Icon name="check" size={12} stroke={3.4} /> : null}
                  {match ? `${c.ad.match}% match` : `${c.ad.match}% · skip`}
                </motion.div>
                <motion.div
                  className="sc-dim"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: match ? 0 : 1 }}
                  transition={{ delay: 2, duration: 0.4 }}
                />
                {match && (
                  <motion.div
                    className="sc-glow"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: [0, 1, 0.6] }}
                    transition={{ delay: 1.9, duration: 0.8 }}
                  />
                )}
              </div>
            </motion.div>
          )
        })}
      </div>

      {/* the bot, thinking */}
      <div className="sc-bot" style={{ left: w / 2, top: botY }}>
        <motion.div
          className={`sc-gaze ${look < 0 ? 'l' : look > 0 ? 'r' : ''}`}
          animate={{ opacity: look === 0 || finishing ? 0 : 1, rotate: look < 0 ? 180 : 0 }}
          transition={{ duration: 0.5, ease: EASE }}
        />
        <div className="sc-orbit" style={{ width: S * 1.9, height: S * 1.9 }}>
          <i />
          <i />
          <i />
        </div>
        <div style={{ marginLeft: -S / 2, marginTop: -S * 0.62, position: 'relative' }}>
          <Bot pose={finishing ? 'celebrate' : 'think'} look={look} lookY={-0.1} mood={mood} size={S} visorScan={!finishing} />
        </div>

        <div className="sc-thought" style={{ left: S * 0.42, top: -S * 0.95 }}>
          <motion.i className="t1" animate={{ scale: [1, 1.25, 1] }} transition={{ duration: 1.2, repeat: Infinity }} />
          <motion.i className="t2" animate={{ scale: [1, 1.25, 1] }} transition={{ duration: 1.2, delay: 0.2, repeat: Infinity }} />
          <div className="sc-cloud">
            <span className="sc-think-ico">
              <motion.span animate={{ rotate: 360 }} transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}>
                <Icon name="spark" size={14} />
              </motion.span>
            </span>
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.span
                key={thought}
                initial={{ opacity: 0, y: 10, filter: 'blur(4px)' }}
                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                exit={{ opacity: 0, y: -10, filter: 'blur(4px)' }}
                transition={{ duration: 0.35 }}
              >
                {thought}
              </motion.span>
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* ghosts flying into the shortlist */}
      {ghosts.map((g) => (
        <motion.div
          key={g.uid}
          className="sc-ghost"
          initial={{ x: g.x - 60, y: g.y - 40, scale: 1, opacity: 1, rotate: 0 }}
          animate={{
            x: [g.x - 60, (g.x + trayX) / 2 - 60, trayX - 60],
            y: [g.y - 40, Math.min(g.y, trayY) - 160, trayY - 40],
            scale: [1, 0.9, 0.35],
            rotate: [0, -8, 0],
            opacity: [1, 1, 0.2],
          }}
          transition={{ duration: 0.9, ease: [0.55, 0, 0.45, 1] }}
        >
          <AdArt kind={g.ad.art} />
        </motion.div>
      ))}

      {/* HUD: one title up top, one dock at the bottom */}
      <div className="sc-hud-top">
        <span className="sc-kicker">
          <i className="sc-live" /> Scanning platform
        </span>
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.h2
            key={finishing ? 'done' : district}
            initial={{ opacity: 0, y: 24, filter: 'blur(10px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            exit={{ opacity: 0, y: -24, filter: 'blur(10px)' }}
            transition={{ duration: 0.6, ease: EASE }}
          >
            {finishing ? 'Every corner, checked.' : DISTRICTS[district].name}
          </motion.h2>
        </AnimatePresence>
        <div className="sc-progress">
          <div className="sc-progress-bar">
            <i style={{ transform: `scaleX(${scanned / TOTAL_LISTINGS})` }} />
          </div>
          <span className="mono">
            {scanned.toLocaleString('en-IN')} / {TOTAL_LISTINGS.toLocaleString('en-IN')} listings
          </span>
        </div>
      </div>

      <div className="sc-dock" style={{ width: dockW }}>
        <div className="sc-map">
          <div className="sc-map-track">
            <motion.i
              className="sc-map-fill"
              animate={{ scaleX: finishing ? 1 : district / (DISTRICTS.length - 1) }}
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
            <AnimatePresence>
              {picked.map((p, i) => (
                <motion.div
                  key={p.id}
                  className="sc-tray-item"
                  style={{ zIndex: i }}
                  initial={{ scale: 0.3, y: -24, opacity: 0 }}
                  animate={{ scale: 1, y: 0, opacity: 1, x: i * 12 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 22 }}
                >
                  <AdArt kind={p.art} />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
          <div className="sc-tray-count">
            <motion.b key={picked.length} initial={{ scale: 1.6 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 500, damping: 15 }}>
              {picked.length}
            </motion.b>
            <span>matches</span>
          </div>
        </div>
      </div>

      <motion.div
        className="sc-whiteout"
        initial={{ opacity: 1 }}
        animate={{ opacity: 0 }}
        transition={{ duration: 1.1, ease: 'easeOut' }}
      />
    </motion.div>
  )
}
