import { AnimatePresence, motion } from 'framer-motion'
import { BRAND } from '../data'
import { Icon } from './Icon'
import './header.css'

export type Phase = 'idle' | 'journey' | 'decoded' | 'blackhole' | 'scout' | 'results' | 'payment' | 'done'

const STEPS = ['Analyse brand', 'Scout platform', 'Shortlist', 'Pay']

function stepOf(p: Phase) {
  switch (p) {
    case 'idle':
      return -1
    case 'journey':
    case 'decoded':
      return 0
    case 'blackhole':
    case 'scout':
      return 1
    case 'results':
      return 2
    case 'payment':
      return 3
    case 'done':
      return 4
  }
}

export function Header({ phase, onRun }: { phase: Phase; onRun: () => void }) {
  const step = stepOf(phase)
  const state: 'idle' | 'running' | 'done' = phase === 'idle' ? 'idle' : phase === 'done' ? 'done' : 'running'

  return (
    <header className="hdr">
      <motion.div
        className="hdr-pill hdr-brand"
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
      >
        <span className="hdr-logo">
          <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden>
            <rect x="3" y="5" width="18" height="13" rx="6.5" fill="var(--ink)" />
            <rect x="8" y="9" width="2.6" height="5" rx="1.3" fill="var(--p)" />
            <rect x="13.4" y="9" width="2.6" height="5" rx="1.3" fill="var(--p)" />
          </svg>
        </span>
        <span className="hdr-name">
          brandmystuff<span className="hdr-dim"> / scout</span>
        </span>
      </motion.div>

      <AnimatePresence>
        {step >= 0 && (
          <motion.nav
            className="hdr-pill hdr-steps"
            initial={{ opacity: 0, y: -16, scale: 0.96, filter: 'blur(6px)' }}
            animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
            exit={{ opacity: 0, y: -16, scale: 0.96, filter: 'blur(6px)' }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            aria-label="Progress"
          >
            {STEPS.map((s, i) => {
              const done = step > i
              const active = step === i
              return (
                <div key={s} className={`hdr-step ${active ? 'is-active' : ''} ${done ? 'is-done' : ''}`}>
                  {active && (
                    <motion.span
                      layoutId="step-hl"
                      className="hdr-step-hl"
                      transition={{ type: 'spring', stiffness: 260, damping: 30 }}
                    />
                  )}
                  <span className="hdr-step-dot">
                    <AnimatePresence mode="popLayout" initial={false}>
                      {done ? (
                        <motion.span
                          key="c"
                          initial={{ scale: 0, rotate: -90 }}
                          animate={{ scale: 1, rotate: 0 }}
                          transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                        >
                          <Icon name="check" size={11} stroke={3.2} />
                        </motion.span>
                      ) : (
                        <motion.span key="n" exit={{ scale: 0 }}>
                          {i + 1}
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </span>
                  <span className="hdr-step-label">{s}</span>
                </div>
              )
            })}
          </motion.nav>
        )}
      </AnimatePresence>

      <motion.div
        className="hdr-right"
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="hdr-pill hdr-chip">
          <span className="hdr-chip-av">L</span>
          <span className="hdr-chip-txt">{BRAND.name}</span>
        </div>

        <motion.button
          className={`run run-${state}`}
          onClick={onRun}
          disabled={state === 'running'}
          whileHover={state !== 'running' ? { scale: 1.04 } : undefined}
          whileTap={state !== 'running' ? { scale: 0.95 } : undefined}
          layout
          transition={{ type: 'spring', stiffness: 400, damping: 28 }}
        >
          <span className="run-shine" />
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span
              key={state}
              className="run-inner"
              initial={{ y: 18, opacity: 0, filter: 'blur(4px)' }}
              animate={{ y: 0, opacity: 1, filter: 'blur(0px)' }}
              exit={{ y: -18, opacity: 0, filter: 'blur(4px)' }}
              transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            >
              {state === 'idle' && (
                <>
                  <Icon name="play" size={13} />
                  Run
                </>
              )}
              {state === 'running' && (
                <>
                  <span className="run-spin" />
                  Running
                </>
              )}
              {state === 'done' && (
                <>
                  <Icon name="reset" size={14} stroke={2.4} />
                  Run again
                </>
              )}
            </motion.span>
          </AnimatePresence>
        </motion.button>
      </motion.div>
    </header>
  )
}
