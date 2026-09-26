"use client";
import { AnimatePresence, animate, motion, useMotionValue } from 'framer-motion'
import { useMemo, useState } from 'react'
import { AnalysisNodes, layoutNodes, type NodeState } from '../components/AnalysisNodes'
import { Bot, type BotPose } from '../components/Bot'
import { useScout, type LandId, type LandSpec } from '../data'
import { useSequence, useViewport } from '../lib/hooks'
import { AudienceLand } from './lands/AudienceLand'
import { GeoProvider, type Geo, type LandPhase } from './lands/common'
import { HomeLand } from './lands/HomeLand'
import { IdentityLand } from './lands/IdentityLand'
import { VoiceLand } from './lands/VoiceLand'
import './lands/lands.css'
import './journey.css'

type Scene = 'home' | LandId

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1]

export function computeGeo(w: number, h: number): Geo {
  const mobile = w < 760
  const botSize = mobile ? 108 : Math.max(120, Math.min(184, h * 0.2))
  const groundY = mobile ? h * 0.82 : h * 0.76
  const botX = w / 2
  const botTop = groundY - botSize * 1.21
  const titleBottom = Math.max(84, h * 0.09) + 122
  return { w, h, groundY, botX, botTop, botSize, headY: botTop + botSize * 0.45, titleBottom }
}

const fresh = (n = 4): NodeState[] => Array.from({ length: n }, () => ({ status: 'pending', lines: 0 }))

function Dust({ x, y, light }: { x: number; y: number; light: boolean }) {
  const puffs = [-1, -0.6, -0.25, 0.25, 0.6, 1]
  return (
    <div className="dust" style={{ left: x, top: y }}>
      {puffs.map((d, i) => (
        <motion.i
          key={i}
          className={light ? 'dust-light' : 'dust-dark'}
          initial={{ x: 0, y: 0, scale: 0.3, opacity: 0.9 }}
          animate={{ x: d * 70, y: -18 - Math.abs(d) * 16, scale: 1 + (1 - Math.abs(d)) * 0.6, opacity: 0 }}
          transition={{ duration: 0.75, ease: [0.22, 1, 0.36, 1] }}
        />
      ))}
    </div>
  )
}

function LandTitle({ land }: { land: LandSpec }) {
  const letters = land.name.split('')
  return (
    <motion.div
      className={`ltitle ltitle-${land.theme}`}
      exit={{ opacity: 0, y: -16, filter: 'blur(10px)', transition: { duration: 0.45 } }}
    >
      <motion.div
        className="ltitle-kicker"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.9 }}
      >
        <span>0{land.index}</span>
        {land.kicker}
      </motion.div>
      <h2 className="ltitle-name" aria-label={land.name}>
        {letters.map((c, i) => (
          <motion.span
            key={i}
            initial={{ opacity: 0, y: 26, filter: 'blur(8px)', rotateX: -70 }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)', rotateX: 0 }}
            transition={{ duration: 0.8, delay: 1.0 + i * 0.028, ease: EASE }}
          >
            {c === ' ' ? ' ' : c}
          </motion.span>
        ))}
      </h2>
      <motion.p
        className="ltitle-blurb"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8, delay: 1.5 }}
      >
        {land.blurb}
      </motion.p>
    </motion.div>
  )
}

export function Journey({ running, onDone }: { running: boolean; onDone: () => void }) {
  const live = useScout()
  const BRAND = live.brand
  // the node layout fits four analysis nodes per land
  const LANDS = useMemo(() => (live.lands ?? []).map((l) => ({ ...l, nodes: l.nodes.slice(0, 4) })), [live.lands])
  const { w, h } = useViewport()
  const geo = useMemo(() => computeGeo(w, h), [w, h])
  const layout = useMemo(() => layoutNodes(w, h), [w, h])

  const [scene, setScene] = useState<Scene>('home')
  const [showUi, setShowUi] = useState(true)
  const [landPhase, setLandPhase] = useState<LandPhase>('arrive')
  const [pose, setPose] = useState<BotPose>('idle')
  const [look, setLook] = useState(0)
  const [lookY, setLookY] = useState(0)
  const [bubble, setBubble] = useState<string | null>(null)
  const [nodes, setNodes] = useState<NodeState[]>(fresh)
  const [badge, setBadge] = useState<string | null>(null)
  const [dust, setDust] = useState(0)

  const jy = useMotionValue(0)
  const jr = useMotionValue(0)
  const sx = useMotionValue(1)
  const sy = useMotionValue(1)

  const land = LANDS.find((l) => l.id === scene)
  const light = land ? land.theme === 'light' : false

  useSequence(async ({ wait }) => {
    const setNode = (i: number, s: NodeState) => setNodes((prev) => prev.map((p, j) => (j === i ? s : p)))
    const squash = () => {
      animate(sy, [1, 0.76, 1.08, 1], { duration: 0.5, ease: 'easeOut' })
      animate(sx, [1, 1.2, 0.96, 1], { duration: 0.5, ease: 'easeOut' })
      setDust((d) => d + 1)
    }
    const jump = async (kind: number) => {
      setPose('jump')
      const hgt = Math.min(180, h * 0.22)
      animate(sy, [1, 1.12, 1], { duration: 0.5 })
      animate(sx, [1, 0.9, 1], { duration: 0.5 })
      animate(jy, [0, -hgt, 0], { duration: 1, times: [0, 0.46, 1], ease: ['easeOut', 'easeIn'] })
      if (kind === 1) {
        animate(jr, [0, 360], { duration: 1, ease: [0.45, 0, 0.55, 1] }).then(() => jr.set(0))
      }
      if (kind === 2) {
        animate(jr, [0, -18, 14, 0], { duration: 1 })
      }
      await wait(1000)
      squash()
      setPose('run')
    }
    const runNodes = async (spec: LandSpec) => {
      await Promise.all(
        spec.nodes.map(async (n, i) => {
          await wait(i * 560)
          setNode(i, { status: 'running', lines: 0 })
          for (let l = 1; l <= n.logs.length; l++) {
            await wait(420 + ((i * 97 + l * 53) % 170))
            setNode(i, { status: 'running', lines: l })
          }
          await wait(380)
          setNode(i, { status: 'done', lines: n.logs.length })
        }),
      )
    }

    // hello
    setShowUi(false)
    await wait(700)
    setPose('wave')
    setBubble("Hi! I'm Scout.")
    await wait(1700)
    setBubble(`Let's get to know ${BRAND.short}!`)
    await wait(1900)
    setBubble(null)

    for (let li = 0; li < LANDS.length; li++) {
      const spec = LANDS[li]
      setPose('crouch')
      setLook(1)
      setLookY(0)
      await wait(300)
      setPose('run')
      setDust((d) => d + 1)
      setNodes(fresh(spec.nodes.length))
      setLandPhase('arrive')
      setScene(spec.id)
      await wait(620)
      await jump(li)
      await wait(760)
      setPose('skid')
      setDust((d) => d + 1)
      await wait(520)
      setPose('idle')
      setLook(0)
      await wait(320)
      setLandPhase('analyze')
      setPose('scan')
      setLookY(spec.id === 'voice' ? 0 : -0.9)
      await runNodes(spec)
      setLookY(0)
      setLandPhase('done')
      setPose('celebrate')
      setBadge(spec.done)
      await wait(1600)
      setBadge(null)
    }

    setPose('idle')
    await wait(250)
    onDone()
  }, running)

  const running_ = pose === 'run' || pose === 'jump'
  const S = geo.botSize

  return (
    <GeoProvider value={geo}>
      <div className="scene journey">
        <AnimatePresence>
          {scene === 'home' && <HomeLand key="home" geo={geo} showUi={showUi} />}
          {scene === 'identity' && <IdentityLand key="identity" geo={geo} phase={landPhase} />}
          {scene === 'voice' && <VoiceLand key="voice" geo={geo} phase={landPhase} />}
          {scene === 'audience' && <AudienceLand key="audience" geo={geo} phase={landPhase} />}
        </AnimatePresence>

        <AnimatePresence>
          {land && (
            <motion.div key={land.id} className="nodes-wrap" exit={{ opacity: 0, transition: { duration: 0.5 } }}>
              <AnalysisNodes
                land={land}
                states={nodes}
                layout={layout}
                bot={{ x: geo.botX, y: geo.headY }}
                vw={w}
                vh={h}
              />
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence mode="wait">{land && <LandTitle key={land.id} land={land} />}</AnimatePresence>

        <AnimatePresence>
          {badge && land && (
            <motion.div
              key={badge}
              className={`lbadge lbadge-${land.theme}`}
              initial={{ opacity: 0, y: 20, scale: 0.6, x: '-50%' }}
              animate={{ opacity: 1, y: 0, scale: 1, x: '-50%' }}
              exit={{ opacity: 0, y: -12, scale: 0.9, x: '-50%', filter: 'blur(6px)' }}
              transition={{ type: 'spring', stiffness: 380, damping: 22 }}
              style={{ top: geo.groundY + Math.min(48, (geo.h - geo.groundY) * 0.3) }}
            >
              <motion.span
                className="lbadge-ring"
                initial={{ scale: 0.6, opacity: 0.8 }}
                animate={{ scale: 2.2, opacity: 0 }}
                transition={{ duration: 0.9, ease: 'easeOut' }}
              />
              <span className="lbadge-ico">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round">
                  <motion.path
                    d="m5 12.5 4.5 4.5L19 7.5"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 0.4, delay: 0.15 }}
                  />
                </svg>
              </span>
              {badge}
            </motion.div>
          )}
        </AnimatePresence>

        {/* the bot lives in screen space; the world moves beneath it */}
        <div className="bot-anchor" style={{ left: geo.botX - S / 2, top: geo.botTop, width: S, height: S * 1.25 }}>
          <AnimatePresence>
            {running_ && (
              <motion.div
                className={`speed ${light ? 'speed-light' : ''}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                {[0, 1, 2, 3, 4].map((i) => (
                  <i key={i} style={{ top: `${22 + i * 14}%`, animationDelay: `${i * 0.11}s` }} />
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          <motion.div className="bot-motion" style={{ y: jy, rotate: jr, scaleX: sx, scaleY: sy, originY: 0.85 }}>
            <Bot pose={pose} look={look} lookY={lookY} size={S} visorScan={landPhase === 'analyze' && !!land} />
          </motion.div>

          <AnimatePresence>
            {bubble && (
              <motion.div
                className="say"
                layout
                style={{ left: S * 0.86, top: -S * 0.08 }}
                initial={{ opacity: 0, scale: 0.4, rotate: -8 }}
                animate={{ opacity: 1, scale: 1, rotate: 0 }}
                exit={{ opacity: 0, scale: 0.6, filter: 'blur(6px)' }}
                transition={{ type: 'spring', stiffness: 420, damping: 22, layout: { duration: 0.3, ease: EASE } }}
              >
                <AnimatePresence mode="wait" initial={false}>
                  <motion.span
                    key={bubble}
                    initial={{ opacity: 0, y: 12, filter: 'blur(4px)' }}
                    animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                    exit={{ opacity: 0, y: -12, filter: 'blur(4px)' }}
                    transition={{ duration: 0.2 }}
                  >
                    {bubble}
                  </motion.span>
                </AnimatePresence>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="dust-layer">{dust > 0 && <Dust key={dust} x={geo.botX} y={geo.groundY - 4} light={light || scene === 'home'} />}</div>

        {!running && scene === 'home' && (
          <div className="sr-only" aria-live="polite">
            Scout is reading your brand
          </div>
        )}
      </div>
    </GeoProvider>
  )
}
