"use client";
import { AnimatePresence, motion } from 'framer-motion'
import { initialOf, useScout } from '../data'
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

export function Header({ phase, onClose }: { phase: Phase; onClose: () => void }) {
  const { brand } = useScout()
  const step = stepOf(phase)

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
          <span className="hdr-chip-av">
            {brand.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={brand.logoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'inherit' }} />
            ) : (
              initialOf(brand.name)
            )}
          </span>
          <span className="hdr-chip-txt">{brand.name}</span>
        </div>

        <motion.button
          className="run run-idle"
          onClick={onClose}
          aria-label="Close Scout"
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.95 }}
          transition={{ type: 'spring', stiffness: 400, damping: 28 }}
        >
          <span className="run-shine" />
          <span className="run-inner">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
            Close
          </span>
        </motion.button>
      </motion.div>
    </header>
  )
}
