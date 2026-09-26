"use client"

import { AnimatePresence, motion, useInView } from "framer-motion"
import { Check, Lock, RotateCcw, ScanEye } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { ProductArt } from "./brand-art"
import { EASE, Reveal, SectionHeading } from "./section-kit"

const WEEKS = 4
const PRICE = 45
const facts = [
  { icon: Lock, title: "Paid upfront, held in escrow", text: "The brand pays the whole lease on day one. It sits in a Sui escrow, so nobody can walk away without paying." },
  { icon: ScanEye, title: "Every proof photo is checked", text: "AI confirms the creative is there, it's the same object and space, and the photo is new." },
  { icon: RotateCcw, title: "Missed a week? It's refunded", text: "If no proof lands in time, that week's money goes back to the brand automatically." },
]

function EscrowCard() {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { margin: "-120px" })
  const [released, setReleased] = useState(0)

  useEffect(() => {
    if (!inView) return
    let i = 0
    setReleased(0)
    const id = window.setInterval(() => {
      i = i >= WEEKS + 2 ? 0 : i + 1
      setReleased(Math.min(i, WEEKS))
    }, 1300)
    return () => clearInterval(id)
  }, [inView])

  const paid = released * PRICE
  const escrow = WEEKS * PRICE - paid

  return (
    <div ref={ref} className="card-shadow rounded-3xl bg-white p-6">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <p className="font-mono text-xs text-muted-foreground">l-0007.lid-center.macbook.maya</p>
          <p className="text-lg font-bold tracking-tight text-ink">4-week lease · Lumen Coffee</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground">In escrow</p>
          <p className="font-mono text-lg font-bold text-ink">{escrow} USDC</p>
        </div>
      </div>

      <div className="grid gap-2.5">
        {Array.from({ length: WEEKS }).map((_, w) => {
          const done = released > w
          return (
            <div
              key={w}
              className={`flex items-center gap-4 rounded-2xl border p-3 transition-colors duration-500 ${done ? "border-p bg-p-50" : "border-border"}`}
            >
              <div className="relative grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-xl bg-p-50">
                <ProductArt id="laptop" size={40} />
                <AnimatePresence>
                  {done && (
                    <motion.span
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ type: "spring", stiffness: 500, damping: 18 }}
                      className="absolute bottom-0.5 right-0.5 grid h-4 w-4 place-items-center rounded-full bg-ink text-p"
                    >
                      <Check className="h-2.5 w-2.5" strokeWidth={3.5} />
                    </motion.span>
                  )}
                </AnimatePresence>
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold text-ink">Week {w + 1}</p>
                <p className="text-xs text-muted-foreground">{done ? "Proof accepted · escrow released" : "Waiting for proof photo"}</p>
              </div>
              <span className={`font-mono text-sm font-bold ${done ? "text-ink" : "text-muted-foreground/60"}`}>
                {done ? `+${Math.round(PRICE * 0.88 * 100) / 100}` : `${PRICE}`}
              </span>
            </div>
          )
        })}
      </div>

      <div className="mt-5 border-t border-border pt-5">
        <div className="mb-2 flex justify-between text-xs">
          <span className="font-semibold text-ink">Released so far</span>
          <span className="font-mono text-muted-foreground">{paid} / {WEEKS * PRICE} USDC</span>
        </div>
        <div className="flex h-3 overflow-hidden rounded-full bg-p-50">
          <motion.div className="h-full bg-ink" animate={{ width: `${(paid / (WEEKS * PRICE)) * 88}%` }} transition={{ duration: 0.6, ease: EASE }} />
          <motion.div className="h-full bg-p" animate={{ width: `${(paid / (WEEKS * PRICE)) * 12}%` }} transition={{ duration: 0.6, ease: EASE }} />
        </div>
        <div className="mt-2 flex gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-ink" /> Owner 88%
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-p" /> Platform 12%
          </span>
        </div>
      </div>
    </div>
  )
}

export function ProofSection() {
  return (
    <section id="proof" className="relative overflow-hidden px-6 py-32">
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <span className="ghost-word text-[20vw] text-p-50">PROOF</span>
      </div>
      <div className="relative z-10 mx-auto grid max-w-7xl items-center gap-16 lg:grid-cols-2">
        <div>
          <SectionHeading
            align="left"
            kicker="Proof of display"
            title="Paid on proof, not on promises"
            sub="Each week the app asks you to snap the sticker in place. When the photo checks out, that week's money moves from escrow to your wallet. Brands see every proof on a public timeline."
          />
          <div className="mt-10 grid gap-5">
            {facts.map((f, i) => (
              <Reveal key={f.title} delay={0.1 + i * 0.08}>
                <div className="flex gap-4">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-ink text-p">
                    <f.icon className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="font-bold text-ink">{f.title}</p>
                    <p className="text-sm leading-relaxed text-muted-foreground">{f.text}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
        <Reveal delay={0.15}>
          <EscrowCard />
        </Reveal>
      </div>
    </section>
  )
}
