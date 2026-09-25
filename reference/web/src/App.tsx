import { AnimatePresence, motion } from 'framer-motion'
import { useState } from 'react'
import { Header, type Phase } from './components/Header'
import { Journey } from './scenes/Journey'

export default function App() {
  const [phase, setPhase] = useState<Phase>('idle')
  const [run, setRun] = useState(0)

  const start = () => {
    if (phase === 'idle') setPhase('journey')
    else if (phase === 'decoded') {
      setRun((r) => r + 1)
      setPhase('idle')
    }
  }

  return (
    <div className="app">
      <Header phase={phase === 'decoded' ? 'done' : phase} onRun={start} />
      <AnimatePresence>
        {(phase === 'idle' || phase === 'journey') && (
          <motion.div key={`journey-${run}`} className="scene" exit={{ opacity: 0, transition: { duration: 0.8 } }}>
            <Journey running={phase === 'journey'} onDone={() => setPhase('decoded')} />
          </motion.div>
        )}
      </AnimatePresence>
      <div className="grain" />
    </div>
  )
}
