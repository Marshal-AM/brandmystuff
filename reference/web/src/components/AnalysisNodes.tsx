import { AnimatePresence, motion } from 'framer-motion'
import type { LandSpec } from '../data'
import { Icon } from './Icon'
import './nodes.css'

export type NodeState = { status: 'pending' | 'running' | 'done'; lines: number }

export type NodeLayout = { x: number; y: number; w: number; side: 'l' | 'r' }

export function layoutNodes(w: number, h: number): NodeLayout[] {
  if (w < 760) {
    const nw = (w - 36) / 2
    const top = 118
    const gap = 150
    return [
      { x: 12, y: top, w: nw, side: 'l' },
      { x: 24 + nw, y: top, w: nw, side: 'r' },
      { x: 12, y: top + gap, w: nw, side: 'l' },
      { x: 24 + nw, y: top + gap, w: nw, side: 'r' },
    ]
  }
  const nw = Math.max(236, Math.min(300, w * 0.205))
  const m = Math.max(24, w * 0.045)
  const top = Math.max(150, h * 0.22)
  const bottom = Math.min(Math.max(top + 212, h * 0.55), h - 230)
  return [
    { x: m, y: top, w: nw, side: 'l' },
    { x: w - m - nw, y: top - 28, w: nw, side: 'r' },
    { x: m + w * 0.02, y: bottom, w: nw, side: 'l' },
    { x: w - m - nw - w * 0.02, y: bottom - 28, w: nw, side: 'r' },
  ]
}

function wire(n: NodeLayout, bot: { x: number; y: number }) {
  const nx = n.side === 'l' ? n.x + n.w : n.x
  const ny = n.y + 30
  const bx = bot.x + (n.side === 'l' ? -54 : 54)
  const by = bot.y
  const dx = bx - nx
  return `M ${nx} ${ny} C ${nx + dx * 0.55} ${ny}, ${bx - dx * 0.45} ${by}, ${bx} ${by}`
}

type Props = {
  land: LandSpec
  states: NodeState[]
  layout: NodeLayout[]
  bot: { x: number; y: number }
  vw: number
  vh: number
}

export function AnalysisNodes({ land, states, layout, bot, vw, vh }: Props) {
  const light = land.theme === 'light'
  return (
    <div className={`nodes ${light ? 'nodes-light' : 'nodes-dark'}`}>
      <svg className="nodes-wires" width={vw} height={vh} viewBox={`0 0 ${vw} ${vh}`}>
        {land.nodes.map((n, i) => {
          const st = states[i]
          const d = wire(layout[i], bot)
          const on = st.status !== 'pending'
          return (
            <g key={n.id}>
              <motion.path
                d={d}
                fill="none"
                stroke={light ? 'rgba(10,10,11,0.12)' : 'rgba(255,255,255,0.1)'}
                strokeWidth={1.2}
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: on ? 1 : 0, opacity: on ? 1 : 0 }}
                transition={{ duration: 0.9, ease: [0.65, 0, 0.35, 1] }}
              />
              <motion.path
                d={d}
                fill="none"
                stroke={light ? 'var(--ink)' : 'var(--p)'}
                strokeWidth={1.6}
                strokeLinecap="round"
                strokeDasharray="3 11"
                initial={{ opacity: 0 }}
                animate={{
                  opacity: st.status === 'running' ? 0.7 : 0,
                  strokeDashoffset: [0, -28],
                }}
                transition={{
                  opacity: { duration: 0.5 },
                  strokeDashoffset: { duration: 0.8, repeat: Infinity, ease: 'linear' },
                }}
              />
            </g>
          )
        })}
      </svg>

      {/* data packets travel from each node back to the bot */}
      {land.nodes.map((n, i) =>
        states[i].status === 'running'
          ? [0].map((delay) => (
              <motion.span
                key={n.id + delay}
                className="packet"
                style={{ offsetPath: `path("${wire(layout[i], bot)}")` }}
                initial={{ offsetDistance: '0%', opacity: 0 }}
                animate={{ offsetDistance: ['0%', '100%'], opacity: [0, 1, 1, 0] }}
                transition={{ duration: 1.1, delay, repeat: Infinity, ease: [0.45, 0, 0.55, 1] }}
              />
            ))
          : null,
      )}

      {land.nodes.map((n, i) => (
        <NodeCard key={n.id} spec={n} state={states[i]} pos={layout[i]} index={i} />
      ))}
    </div>
  )
}

function NodeCard({
  spec,
  state,
  pos,
  index,
}: {
  spec: LandSpec['nodes'][number]
  state: NodeState
  pos: NodeLayout
  index: number
}) {
  const total = spec.logs.length
  const progress = state.status === 'done' ? 1 : state.lines / (total + 1)
  const shown = spec.logs.slice(0, state.lines)
  // keep cards a steady height: only the latest three lines stay on screen
  const visible = shown.slice(-3)
  const offset = shown.length - visible.length

  return (
    <motion.div
      className={`node is-${state.status}`}
      style={{ left: pos.x, top: pos.y, width: pos.w }}
      initial={{ opacity: 0, y: 24, scale: 0.92, filter: 'blur(10px)' }}
      animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
      exit={{ opacity: 0, y: -18, scale: 0.94, filter: 'blur(10px)', transition: { duration: 0.5, delay: index * 0.05 } }}
      transition={{ duration: 0.9, delay: 0.25 + index * 0.12, ease: [0.22, 1, 0.36, 1] }}
    >
      <motion.div
        className="node-float"
        animate={{ y: [0, -5, 0] }}
        transition={{ duration: 4 + index * 0.6, repeat: Infinity, ease: 'easeInOut' }}
      >
        <div className="node-head">
          <span className="node-ico">
            <Icon name={spec.icon} size={15} />
          </span>
          <span className="node-title">{spec.title}</span>
          <span className="node-status">
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.span
                key={state.status}
                initial={{ y: 10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -10, opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="node-status-in"
              >
                {state.status === 'pending' && 'queued'}
                {state.status === 'running' && (
                  <>
                    <i className="node-live" />
                    running
                  </>
                )}
                {state.status === 'done' && (
                  <>
                    <Icon name="check" size={11} stroke={3.4} />
                    done
                  </>
                )}
              </motion.span>
            </AnimatePresence>
          </span>
        </div>

        <div className="node-bar">
          <motion.i
            initial={{ scaleX: 0 }}
            animate={{ scaleX: progress }}
            transition={{ type: 'spring', stiffness: 90, damping: 20 }}
          />
        </div>

        <div className="node-logs mono">
          {state.status === 'pending' && (
            <div className="node-skel">
              <i />
              <i />
              <i />
            </div>
          )}
          <AnimatePresence initial={false}>
            {visible.map((l, li) => (
              <motion.div
                key={offset + li + l}
                className="node-line"
                exit={{ opacity: 0, height: 0, transition: { duration: 0.3 } }}
                initial={{ opacity: 0, height: 0, filter: 'blur(4px)' }}
                animate={{ opacity: li === visible.length - 1 && state.status === 'running' ? 1 : 0.62, height: 'auto', filter: 'blur(0px)' }}
                transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
              >
                <span className="node-gt">›</span>
                <motion.span
                  className="node-txt"
                  initial={{ clipPath: 'inset(0 100% 0 0)' }}
                  animate={{ clipPath: 'inset(0 0% 0 0)' }}
                  transition={{ duration: 0.5, ease: 'linear' }}
                >
                  {l}
                </motion.span>
                {li === visible.length - 1 && state.status === 'running' && <span className="node-caret" />}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        <AnimatePresence>
          {state.status === 'done' && (
            <motion.div
              className="node-result"
              initial={{ opacity: 0, height: 0, marginTop: 0 }}
              animate={{ opacity: 1, height: 'auto', marginTop: 10 }}
              transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
            >
              <motion.span
                className="node-result-ico"
                initial={{ scale: 0, rotate: -120 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: 'spring', stiffness: 420, damping: 16, delay: 0.1 }}
              >
                <Icon name="check" size={11} stroke={3.4} />
              </motion.span>
              {spec.result}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  )
}
