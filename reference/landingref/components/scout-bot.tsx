"use client"

import { motion, type Transition } from 'framer-motion'
import { useId, type CSSProperties } from 'react'

export type BotPose =
  | 'idle'
  | 'float'
  | 'wave'
  | 'crouch'
  | 'run'
  | 'jump'
  | 'skid'
  | 'scan'
  | 'think'
  | 'celebrate'
  | 'sucked'
  | 'point'

export type BotMood = 'normal' | 'happy' | 'wide' | 'focus'

type Props = {
  pose?: BotPose
  mood?: BotMood
  /** −1 looks left, 1 looks right */
  look?: number
  /** −1 looks up, 1 looks down */
  lookY?: number
  size?: number
  visorScan?: boolean
  className?: string
  style?: CSSProperties
}

type Loop = { keys: Record<string, number[]>; duration: number; ease?: Transition['ease'] }
type Part = { base: Record<string, number>; loop?: Loop }
type Rig = {
  root: Part
  head: Part
  armL: Part
  armR: Part
  legL: Part
  legR: Part
  mood: BotMood
}

const rest: Part = { base: { rotate: 0 } }

const RIGS: Record<BotPose, Rig> = {
  idle: {
    root: { base: { y: 0, rotate: 0, scaleX: 1, scaleY: 1 }, loop: { keys: { y: [0, -5, 0] }, duration: 2.6 } },
    head: { base: { rotate: 0 }, loop: { keys: { rotate: [0, 2, 0, -2, 0] }, duration: 5 } },
    armL: { base: { rotate: 8 }, loop: { keys: { rotate: [0, 5, 0] }, duration: 2.6 } },
    armR: { base: { rotate: -8 }, loop: { keys: { rotate: [0, -5, 0] }, duration: 2.6 } },
    legL: rest,
    legR: rest,
    mood: 'normal',
  },
  float: {
    root: { base: { y: 0, rotate: 0, scaleX: 1, scaleY: 1 }, loop: { keys: { y: [0, -12, 0] }, duration: 3.2 } },
    head: { base: { rotate: 0 }, loop: { keys: { rotate: [0, 3, 0, -3, 0] }, duration: 6 } },
    armL: { base: { rotate: 28 }, loop: { keys: { rotate: [0, 10, 0] }, duration: 3.2 } },
    armR: { base: { rotate: -28 }, loop: { keys: { rotate: [0, -10, 0] }, duration: 3.2 } },
    legL: { base: { rotate: 8 }, loop: { keys: { rotate: [0, 6, 0] }, duration: 3.2 } },
    legR: { base: { rotate: -8 }, loop: { keys: { rotate: [0, -6, 0] }, duration: 3.2 } },
    mood: 'normal',
  },
  wave: {
    root: { base: { y: 0, rotate: -2, scaleX: 1, scaleY: 1 }, loop: { keys: { y: [0, -6, 0] }, duration: 0.9 } },
    head: { base: { rotate: 7 }, loop: { keys: { rotate: [0, 3, 0] }, duration: 0.9 } },
    armL: { base: { rotate: 12 }, loop: { keys: { rotate: [0, 6, 0] }, duration: 0.9 } },
    armR: { base: { rotate: -148 }, loop: { keys: { rotate: [0, -26, 0, 20, 0] }, duration: 0.8 } },
    legL: rest,
    legR: rest,
    mood: 'happy',
  },
  crouch: {
    root: { base: { y: 6, rotate: 6, scaleX: 1.08, scaleY: 0.9 } },
    head: { base: { rotate: 4 } },
    armL: { base: { rotate: -30 } },
    armR: { base: { rotate: 40 } },
    legL: { base: { rotate: 10 } },
    legR: { base: { rotate: -10 } },
    mood: 'focus',
  },
  run: {
    root: { base: { y: 0, rotate: 9, scaleX: 1, scaleY: 1 }, loop: { keys: { y: [0, -9, 0] }, duration: 0.26, ease: 'easeOut' } },
    head: { base: { rotate: 3 }, loop: { keys: { rotate: [0, -3, 0] }, duration: 0.26 } },
    armL: { base: { rotate: 0 }, loop: { keys: { rotate: [0, -48, 0, 48, 0] }, duration: 0.52, ease: 'linear' } },
    armR: { base: { rotate: 0 }, loop: { keys: { rotate: [0, 48, 0, -48, 0] }, duration: 0.52, ease: 'linear' } },
    legL: { base: { rotate: 0 }, loop: { keys: { rotate: [0, 40, 0, -40, 0] }, duration: 0.52, ease: 'linear' } },
    legR: { base: { rotate: 0 }, loop: { keys: { rotate: [0, -40, 0, 40, 0] }, duration: 0.52, ease: 'linear' } },
    mood: 'focus',
  },
  jump: {
    root: { base: { y: 0, rotate: 0, scaleX: 0.94, scaleY: 1.08 } },
    head: { base: { rotate: -4 } },
    armL: { base: { rotate: 150 }, loop: { keys: { rotate: [0, 12, 0] }, duration: 0.4 } },
    armR: { base: { rotate: -150 }, loop: { keys: { rotate: [0, -12, 0] }, duration: 0.4 } },
    legL: { base: { rotate: 26 } },
    legR: { base: { rotate: -30 } },
    mood: 'happy',
  },
  skid: {
    root: { base: { y: 2, rotate: -12, scaleX: 1.05, scaleY: 0.95 } },
    head: { base: { rotate: -6 } },
    armL: { base: { rotate: 70 }, loop: { keys: { rotate: [0, 14, 0] }, duration: 0.18 } },
    armR: { base: { rotate: -80 }, loop: { keys: { rotate: [0, -14, 0] }, duration: 0.18 } },
    legL: { base: { rotate: -22 } },
    legR: { base: { rotate: -34 } },
    mood: 'wide',
  },
  scan: {
    root: { base: { y: 0, rotate: 0, scaleX: 1, scaleY: 1 }, loop: { keys: { y: [0, -4, 0] }, duration: 2 } },
    head: { base: { rotate: 0 }, loop: { keys: { rotate: [0, 4, 0, -4, 0] }, duration: 4 } },
    armL: { base: { rotate: 34 }, loop: { keys: { rotate: [0, 8, 0] }, duration: 1 } },
    armR: { base: { rotate: -34 }, loop: { keys: { rotate: [0, -8, 0] }, duration: 1 } },
    legL: rest,
    legR: rest,
    mood: 'focus',
  },
  think: {
    root: { base: { y: 0, rotate: 0, scaleX: 1, scaleY: 1 }, loop: { keys: { y: [0, -10, 0] }, duration: 3 } },
    head: { base: { rotate: 0 }, loop: { keys: { rotate: [0, 5, 0, -5, 0] }, duration: 5 } },
    armL: { base: { rotate: 20 }, loop: { keys: { rotate: [0, 8, 0] }, duration: 3 } },
    armR: { base: { rotate: -118 }, loop: { keys: { rotate: [0, -10, 0, -4, 0] }, duration: 1.1 } },
    legL: { base: { rotate: 6 }, loop: { keys: { rotate: [0, 5, 0] }, duration: 3 } },
    legR: { base: { rotate: -6 }, loop: { keys: { rotate: [0, -5, 0] }, duration: 3 } },
    mood: 'normal',
  },
  celebrate: {
    root: {
      base: { y: 0, rotate: 0, scaleX: 1, scaleY: 1 },
      loop: { keys: { y: [0, -38, 0, 0], scaleY: [1, 1.06, 0.9, 1], scaleX: [1, 0.96, 1.08, 1] }, duration: 0.72 },
    },
    head: { base: { rotate: 0 }, loop: { keys: { rotate: [0, 6, 0, -6, 0] }, duration: 1.44 } },
    armL: { base: { rotate: 150 }, loop: { keys: { rotate: [0, 22, 0] }, duration: 0.36 } },
    armR: { base: { rotate: -150 }, loop: { keys: { rotate: [0, -22, 0] }, duration: 0.36 } },
    legL: { base: { rotate: 0 }, loop: { keys: { rotate: [0, 16, 0] }, duration: 0.72 } },
    legR: { base: { rotate: 0 }, loop: { keys: { rotate: [0, -16, 0] }, duration: 0.72 } },
    mood: 'happy',
  },
  sucked: {
    root: { base: { y: 0, rotate: 0, scaleX: 0.9, scaleY: 1.12 } },
    head: { base: { rotate: 0 }, loop: { keys: { rotate: [0, 10, 0, -10, 0] }, duration: 0.3 } },
    armL: { base: { rotate: 130 }, loop: { keys: { rotate: [0, 30, 0] }, duration: 0.22 } },
    armR: { base: { rotate: -130 }, loop: { keys: { rotate: [0, -30, 0] }, duration: 0.25 } },
    legL: { base: { rotate: 20 }, loop: { keys: { rotate: [0, 25, 0] }, duration: 0.2 } },
    legR: { base: { rotate: -20 }, loop: { keys: { rotate: [0, -25, 0] }, duration: 0.24 } },
    mood: 'wide',
  },
  point: {
    root: { base: { y: 0, rotate: 0, scaleX: 1, scaleY: 1 }, loop: { keys: { y: [0, -4, 0] }, duration: 2 } },
    head: { base: { rotate: 6 } },
    armL: { base: { rotate: 10 } },
    armR: { base: { rotate: -100 }, loop: { keys: { rotate: [0, -8, 0] }, duration: 0.8 } },
    legL: rest,
    legR: rest,
    mood: 'happy',
  },
}

const spring: Transition = { type: 'spring', stiffness: 170, damping: 16, mass: 0.8 }
const soft: Transition = { type: 'spring', stiffness: 120, damping: 18 }

function loopTransition(loop?: Loop): Transition {
  if (!loop) return { duration: 0.3 }
  return { duration: loop.duration, ease: loop.ease ?? 'easeInOut', repeat: Infinity }
}

function PartGroup({
  part,
  origin,
  children,
}: {
  part: Part
  origin: { x: number; y: number }
  children: React.ReactNode
}) {
  const loopKeys = { rotate: 0, y: 0, scaleX: 1, scaleY: 1, ...part.loop?.keys }
  return (
    <motion.g animate={part.base} transition={spring} style={{ originX: origin.x, originY: origin.y }}>
      <motion.g
        animate={loopKeys}
        transition={loopTransition(part.loop)}
        style={{ originX: origin.x, originY: origin.y }}
      >
        {children}
      </motion.g>
    </motion.g>
  )
}

const INK = 'var(--ink)'
const SW = 4

export function Bot({ pose = 'idle', mood, look = 0, lookY = 0, size = 170, visorScan, className, style }: Props) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '')
  const rig = RIGS[pose]
  const m = mood ?? rig.mood
  const eyeShape =
    m === 'focus'
      ? { height: 11, y: -5.5, width: 16, x: -8, rx: 5.5 }
      : m === 'wide'
        ? { height: 21, y: -10.5, width: 21, x: -10.5, rx: 10.5 }
        : { height: 22, y: -11, width: 13, x: -6.5, rx: 6.5 }
  const happy = m === 'happy'

  return (
    <svg
      className={className}
      style={{ overflow: 'visible', ...style }}
      width={size}
      height={size * 1.25}
      viewBox="0 0 200 250"
      aria-hidden
    >
      <defs>
        <radialGradient id={`bot-glow-${uid}`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="var(--p)" stopOpacity="0.9" />
          <stop offset="100%" stopColor="var(--p)" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`bot-shade-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fff" />
          <stop offset="100%" stopColor="var(--p-100)" />
        </linearGradient>
        <clipPath id={`visor-clip-${uid}`}>
          <rect x="50" y="58" width="100" height="64" rx="28" />
        </clipPath>
      </defs>

      {/* ground shadow reacts to bob height */}
      <motion.ellipse
        cx="100"
        cy="242"
        rx="44"
        ry="7"
        fill="var(--ink)"
        opacity={0.22}
        animate={
          pose === 'celebrate'
            ? { scaleX: [1, 0.6, 1, 1], opacity: [0.22, 0.1, 0.22, 0.22] }
            : pose === 'float' || pose === 'think'
              ? { scaleX: [1, 0.8, 1], opacity: [0.16, 0.08, 0.16] }
              : { scaleX: 1, opacity: 0.22 }
        }
        transition={
          pose === 'celebrate'
            ? { duration: 0.72, repeat: Infinity }
            : pose === 'float' || pose === 'think'
              ? { duration: 3.1, repeat: Infinity }
              : { duration: 0.3 }
        }
        style={{ originX: 0.5, originY: 0.5 }}
      />

      <PartGroup part={rig.root} origin={{ x: 0.5, y: 1 }}>
        {/* legs */}
        <PartGroup part={rig.legL} origin={{ x: 0.5, y: 0 }}>
          <rect x="80" y="192" width="17" height="36" rx="8.5" fill={`url(#bot-shade-${uid})`} stroke={INK} strokeWidth={SW} />
          <rect x="74" y="220" width="25" height="14" rx="7" fill="#fff" stroke={INK} strokeWidth={SW} />
        </PartGroup>
        <PartGroup part={rig.legR} origin={{ x: 0.5, y: 0 }}>
          <rect x="103" y="192" width="17" height="36" rx="8.5" fill={`url(#bot-shade-${uid})`} stroke={INK} strokeWidth={SW} />
          <rect x="101" y="220" width="25" height="14" rx="7" fill="#fff" stroke={INK} strokeWidth={SW} />
        </PartGroup>

        {/* body */}
        <rect x="64" y="136" width="72" height="66" rx="30" fill={`url(#bot-shade-${uid})`} stroke={INK} strokeWidth={SW} />
        <rect x="80" y="152" width="40" height="32" rx="14" fill="var(--p-100)" stroke={INK} strokeWidth={3} />
        <motion.circle
          cx="100"
          cy="168"
          r="6.5"
          fill="var(--p)"
          stroke={INK}
          strokeWidth={3}
          animate={{ scale: [1, 1.25, 1], opacity: [1, 0.75, 1] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
          style={{ originX: 0.5, originY: 0.5 }}
        />

        {/* head */}
        <PartGroup part={rig.head} origin={{ x: 0.5, y: 1 }}>
          <motion.g animate={{ rotate: look * 6 }} transition={soft} style={{ originX: 0.5, originY: 1 }}>
            {/* antenna */}
            <line x1="100" y1="42" x2="100" y2="20" stroke={INK} strokeWidth={9} strokeLinecap="round" />
            <line x1="100" y1="42" x2="100" y2="20" stroke="#fff" strokeWidth={3} strokeLinecap="round" />
            <motion.circle
              cx="100"
              cy="15"
              r="16"
              fill={`url(#bot-glow-${uid})`}
              animate={{ opacity: [0.2, 0.8, 0.2], scale: [0.8, 1.3, 0.8] }}
              transition={{ duration: pose === 'think' || visorScan ? 0.8 : 2, repeat: Infinity }}
              style={{ originX: 0.5, originY: 0.5 }}
            />
            <circle cx="100" cy="15" r="8" fill="var(--p)" stroke={INK} strokeWidth={SW} />

            {/* ears shift with the head turn to fake depth */}
            <motion.rect
              x="25"
              y="76"
              width="15"
              height="32"
              rx="7.5"
              fill="var(--p)"
              stroke={INK}
              strokeWidth={SW}
              animate={{ x: look > 0 ? look * 5 : look * 2 }}
              transition={soft}
            />
            <motion.rect
              x="160"
              y="76"
              width="15"
              height="32"
              rx="7.5"
              fill="var(--p)"
              stroke={INK}
              strokeWidth={SW}
              animate={{ x: look < 0 ? look * 5 : look * 2 }}
              transition={soft}
            />

            <rect x="34" y="40" width="132" height="102" rx="46" fill={`url(#bot-shade-${uid})`} stroke={INK} strokeWidth={SW} />
            <path d="M58 54 Q70 46 90 46" stroke="#fff" strokeWidth="6" strokeLinecap="round" fill="none" opacity="0.9" />

            <motion.g animate={{ x: look * 5, y: lookY * 2 }} transition={soft}>
              <rect x="50" y="58" width="100" height="64" rx="28" fill={INK} />
              <g clipPath={`url(#visor-clip-${uid})`}>
                <path d="M60 64 L84 64 L66 118 L50 118 Z" fill="#fff" opacity="0.06" />
                {visorScan && (
                  <motion.rect
                    x="50"
                    width="100"
                    height="3"
                    fill="var(--p)"
                    opacity={0.7}
                    initial={{ y: 60 }}
                    animate={{ y: [60, 118, 60] }}
                    transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
                  />
                )}
              </g>
              {/* eyes */}
              <motion.g animate={{ x: look * 11, y: lookY * 7 }} transition={soft}>
                <motion.g
                  animate={{ scaleY: [1, 1, 0.08, 1, 1, 0.08, 1] }}
                  transition={{ duration: 5.2, times: [0, 0.46, 0.48, 0.5, 0.9, 0.92, 0.94], repeat: Infinity }}
                  style={{ originX: 0.5, originY: 0.5 }}
                >
                  {[82, 118].map((cx) => (
                    <g key={cx} transform={`translate(${cx} 90)`}>
                      <motion.rect
                        fill="var(--p)"
                        initial={false}
                        animate={{ ...eyeShape, opacity: happy ? 0 : 1 }}
                        transition={spring}
                        style={{ filter: 'drop-shadow(0 0 5px var(--p))' }}
                      />
                      <motion.path
                        d="M-9 4 Q0 -9 9 4"
                        stroke="var(--p)"
                        strokeWidth="5.5"
                        strokeLinecap="round"
                        fill="none"
                        initial={false}
                        animate={{ opacity: happy ? 1 : 0, scale: happy ? 1 : 0.4 }}
                        transition={spring}
                        style={{ filter: 'drop-shadow(0 0 5px var(--p))' }}
                      />
                      <motion.circle
                        cx="-2.5"
                        cy="-5"
                        r="2.4"
                        fill="#fff"
                        animate={{ opacity: happy ? 0 : 0.9 }}
                      />
                    </g>
                  ))}
                </motion.g>
              </motion.g>
              <motion.path
                d="M93 107 Q100 113 107 107"
                stroke="var(--p)"
                strokeWidth="3.5"
                strokeLinecap="round"
                fill="none"
                animate={{ x: look * 9, opacity: m === 'wide' ? 0 : 1 }}
                transition={soft}
              />
              <motion.ellipse
                cx="100"
                cy="109"
                rx="4.5"
                ry="5"
                fill="var(--p)"
                animate={{ x: look * 9, opacity: m === 'wide' ? 1 : 0, scale: m === 'wide' ? 1 : 0.2 }}
                transition={spring}
              />
            </motion.g>

            {/* cheeks */}
            <motion.ellipse cx="54" cy="128" rx="9" ry="5" fill="var(--p)" opacity="0.55" animate={{ x: look * 4 }} />
            <motion.ellipse cx="146" cy="128" rx="9" ry="5" fill="var(--p)" opacity="0.55" animate={{ x: look * 4 }} />
          </motion.g>
        </PartGroup>
        {/* left arm */}
        <PartGroup part={rig.armL} origin={{ x: 0.5, y: 0.1 }}>
          <rect x="48" y="146" width="18" height="44" rx="9" fill={`url(#bot-shade-${uid})`} stroke={INK} strokeWidth={SW} />
          <circle cx="57" cy="192" r="10" fill="#fff" stroke={INK} strokeWidth={SW} />
        </PartGroup>

        {/* right arm */}
        <PartGroup part={rig.armR} origin={{ x: 0.5, y: 0.1 }}>
          <rect x="134" y="146" width="18" height="44" rx="9" fill={`url(#bot-shade-${uid})`} stroke={INK} strokeWidth={SW} />
          <circle cx="143" cy="192" r="10" fill="#fff" stroke={INK} strokeWidth={SW} />
        </PartGroup>

      </PartGroup>
    </svg>
  )
}
