"use client";
/**
 * The brand agent's full run, ported from the reference Scout mock and driven by live data:
 * read the brand (Journey) → DNA (Decoded) → dive into ENS (BlackHole) → scan every space (Scout)
 * → the one pick + every analysis (Results) → x402 payment from the mandate (Payment) → booked.
 */
import { AnimatePresence, motion } from 'framer-motion'
import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import type { ScoutLive } from '@/lib/scout/types'
import './index.css'
import { Header, type Phase } from './components/Header'
import { ScoutCtx } from './data'
import { ScoutError } from './components/PayParts'
import { BlackHole } from './scenes/BlackHole'
import { Decoded } from './scenes/Decoded'
import { Journey } from './scenes/Journey'
import { Payment } from './scenes/Payment'
import { Results } from './scenes/Results'
import { Scout } from './scenes/Scout'

function initialPhase(live: ScoutLive): Phase {
  if (live.payment.status === 'done') return 'done'
  if (live.payment.status === 'running') return 'payment'
  return 'idle'
}

export function ScoutExperience({ live, onPay, onClose }: { live: ScoutLive; onPay: () => void; onClose: () => void }) {
  const [phase, setPhase] = useState<Phase>(() => initialPhase(live))

  // the journey starts on its own as soon as the brand has been decoded
  useEffect(() => {
    if (phase === 'idle' && live.lands?.length) {
      const id = window.setTimeout(() => setPhase('journey'), 600)
      return () => window.clearTimeout(id)
    }
  }, [phase, live.lands])

  // a payment that starts elsewhere (e.g. re-opened mid-run) jumps straight to it
  useEffect(() => {
    if (live.payment.status === 'running' && (phase === 'results' || phase === 'idle')) setPhase('payment')
  }, [live.payment.status, phase])

  // While Scout is open, take the rest of the app out of rendering: it sits fully underneath,
  // and restyling/painting its ~500 extra nodes and ambient animations every frame made the
  // scene animations drop frames. The page stays mounted (it owns the run's state).
  useEffect(() => {
    document.body.dataset.scoutOpen = '1'
    return () => {
      delete document.body.dataset.scoutOpen
    }
  }, [])

  const toPayment = useCallback(() => {
    setPhase('payment')
    onPay()
  }, [onPay])
  const toDone = useCallback(() => setPhase('done'), [])

  const showResults = phase === 'results' || phase === 'payment' || phase === 'done'
  const stalled = !!live.error && live.payment.status !== 'running' && live.payment.status !== 'failed'

  if (typeof document === 'undefined') return null
  // Portal to <body> so the app shell's stacking contexts (header, footer) can't sit on top.
  return createPortal(
    <ScoutCtx.Provider value={live}>
      <div className="scout-root" style={{ zIndex: 75 }} role="dialog" aria-label={`Scout, ${live.brand.name}'s agent`}>
        <Header phase={phase} onClose={onClose} />

        <AnimatePresence>
          {(phase === 'idle' || phase === 'journey') && (
            <motion.div key="journey" className="scene" exit={{ opacity: 0, transition: { duration: 0.8 } }}>
              <Journey running={phase === 'journey'} onDone={() => setPhase('decoded')} />
            </motion.div>
          )}
          {phase === 'decoded' && <Decoded key="decoded" onDone={() => setPhase('blackhole')} />}
          {phase === 'blackhole' && <BlackHole key="blackhole" onDone={() => setPhase('scout')} />}
          {phase === 'scout' && <Scout key="scout" onDone={() => setPhase('results')} />}
          {showResults && <Results key="results" mode={phase === 'results' ? 'review' : phase === 'payment' ? 'paying' : 'booked'} onPay={toPayment} />}
        </AnimatePresence>

        <AnimatePresence>{phase === 'payment' && <Payment key="payment" onDone={toDone} onClose={onClose} />}</AnimatePresence>

        <AnimatePresence>
          {stalled && (
            <motion.div
              key="err"
              className="scout-error"
              initial={{ opacity: 0, y: 20, x: '-50%' }}
              animate={{ opacity: 1, y: 0, x: '-50%' }}
              exit={{ opacity: 0, y: 20, x: '-50%' }}
            >
              <ScoutError error={live.error ?? ''} onClose={onClose} compact />
            </motion.div>
          )}
        </AnimatePresence>

        <div className="sc-grain" />
      </div>
    </ScoutCtx.Provider>,
    document.body,
  )
}
