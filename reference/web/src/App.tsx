import { AnimatePresence, motion } from 'framer-motion'
import { useState } from 'react'
import { Header, type Phase } from './components/Header'
import { BlackHole } from './scenes/BlackHole'
import { Decoded } from './scenes/Decoded'
import { Journey } from './scenes/Journey'
import { Scout } from './scenes/Scout'

const PHASES: Phase[] = ['idle', 'journey', 'decoded', 'blackhole', 'scout', 'results']

// ?phase=scout jumps straight to a scene, handy while tweaking one part
function initialPhase(): Phase {
  const q = new URLSearchParams(window.location.search).get('phase') as Phase | null
  return q && PHASES.includes(q) ? q : 'idle'
}

export default function App() {
  const [phase, setPhase] = useState<Phase>(initialPhase)
  const [run, setRun] = useState(0)

  const start = () => {
    if (phase === 'idle') setPhase('journey')
    else if (phase === 'results') {
      setRun((r) => r + 1)
      setPhase('idle')
    }
  }

  return (
    <div className="app">
      <Header phase={phase === 'results' ? 'done' : phase} onRun={start} />

      <AnimatePresence>
        {(phase === 'idle' || phase === 'journey') && (
          <motion.div key={`journey-${run}`} className="scene" exit={{ opacity: 0, transition: { duration: 0.8 } }}>
            <Journey running={phase === 'journey'} onDone={() => setPhase('decoded')} />
          </motion.div>
        )}
        {phase === 'decoded' && <Decoded key="decoded" onDone={() => setPhase('blackhole')} />}
        {phase === 'blackhole' && <BlackHole key="blackhole" onDone={() => setPhase('scout')} />}
        {phase === 'scout' && <Scout key="scout" onDone={() => setPhase('results')} />}
      </AnimatePresence>

      <div className="grain" />
    </div>
  )
}
