"use client"

import { Check } from "lucide-react"
import { AnimatePresence, motion, useInView } from "framer-motion"
import { useEffect, useRef, useState } from "react"
import { ProductArt } from "./brand-art"
import { EASE, GradeBadge, SectionHeading } from "./section-kit"

// the 11 object-intrinsic criteria from the AQS rubric, scored 0–4
const CRITERIA = [
  { k: "Angular size", v: 3.6 },
  { k: "Orientation", v: 3.8 },
  { k: "Occlusion", v: 3.4 },
  { k: "Legibility", v: 3.7 },
  { k: "Surface", v: 3.9 },
  { k: "Material", v: 3.5 },
  { k: "Interruptions", v: 3.2 },
  { k: "Condition", v: 3.6 },
  { k: "Clutter", v: 2.9 },
  { k: "Conspicuity", v: 3.8 },
  { k: "Durability", v: 3.3 },
]

const CHECKS = ["Capture code verified", "Not AI, stock or a screen photo", "Close-up matches the object", "Brand-safe surface"]

const points = [
  "11-criterion rubric, every score backed by evidence",
  "Capture-code check against fake photos",
  "AI, stock and screen-photo detection",
  "Brand-safety and prompt-injection gates",
  "Ranked by quality, never by who paid",
  "Clear retake tips when a photo fails",
]

function ScoreCard() {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: "-100px" })
  const [score, setScore] = useState(0)
  const [checks, setChecks] = useState(0)
  const [hl, setHl] = useState(0)

  useEffect(() => {
    if (!inView) return
    let raf = 0
    const t0 = performance.now()
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / 1800)
      setScore(Math.round(91 * (1 - Math.pow(1 - p, 3))))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    const ids = CHECKS.map((_, i) => window.setTimeout(() => setChecks(i + 1), 400 + i * 350))
    const cycle = window.setInterval(() => setHl((h) => (h + 1) % CRITERIA.length), 1400)
    return () => {
      cancelAnimationFrame(raf)
      ids.forEach(clearTimeout)
      clearInterval(cycle)
    }
  }, [inView])

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.8, ease: EASE }}
      className="card-shadow w-full rounded-3xl bg-white p-6"
    >
      <div className="mb-5 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-p-50">
            <ProductArt id="laptop" size={40} />
          </div>
          <div className="min-w-0">
            <p className="truncate font-mono text-xs text-muted-foreground">lid-center.macbook.maya.brandmystuff.eth</p>
            <p className="font-bold tracking-tight text-ink">Ad-Space Quality Score</p>
          </div>
        </div>
        <span className="flex items-center gap-2 text-xs font-semibold text-p-700">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-p opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-p-600" />
          </span>
          Scored
        </span>
      </div>

      <div className="mb-5 grid grid-cols-[auto_1fr] items-center gap-5 rounded-2xl bg-ink p-5 text-white">
        <div className="flex items-center gap-3">
          <GradeBadge grade="A" size="lg" />
          <div>
            <p className="text-4xl font-extrabold leading-none tracking-tight">{score}</p>
            <p className="mt-1 text-xs text-white/50">out of 100</p>
          </div>
        </div>
        <div className="grid gap-1.5">
          {CHECKS.map((c, i) => (
            <div key={c} className="flex items-center gap-2 text-xs">
              <AnimatePresence>
                {checks > i ? (
                  <motion.span
                    key="y"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 500, damping: 18 }}
                    className="grid h-4 w-4 place-items-center rounded-full bg-p text-ink"
                  >
                    <Check className="h-2.5 w-2.5" strokeWidth={3.5} />
                  </motion.span>
                ) : (
                  <span className="h-4 w-4 rounded-full border border-white/20" />
                )}
              </AnimatePresence>
              <span className={checks > i ? "text-white" : "text-white/40"}>{c}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-x-6 gap-y-2.5 sm:grid-cols-2">
        {CRITERIA.map((c, i) => (
          <div key={c.k} className="flex items-center gap-3">
            <span className={`w-24 shrink-0 text-xs transition-colors ${hl === i ? "font-bold text-ink" : "text-muted-foreground"}`}>{c.k}</span>
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-p-50">
              <motion.div
                className={`h-full rounded-full ${hl === i ? "bg-ink" : "bg-p"}`}
                initial={{ width: 0 }}
                animate={{ width: inView ? `${(c.v / 4) * 100}%` : 0 }}
                transition={{ duration: 1.2, delay: 0.3 + i * 0.06, ease: EASE }}
              />
            </div>
            <span className="w-7 text-right font-mono text-[11px] text-ink">{c.v.toFixed(1)}</span>
          </div>
        ))}
      </div>

      <div className="mt-5 flex flex-wrap gap-2 border-t border-border pt-4">
        <span className="rounded-lg bg-p-100 px-2.5 py-1 text-xs font-semibold text-p-700">+ Flat, glossy, faces people</span>
        <span className="rounded-lg bg-p-100 px-2.5 py-1 text-xs font-semibold text-p-700">+ Seen daily in cafés</span>
        <span className="rounded-lg bg-p-50 px-2.5 py-1 text-xs font-semibold text-muted-foreground">− Two stickers nearby</span>
      </div>
    </motion.div>
  )
}

export function FeaturesSection() {
  return (
    <section id="features" className="relative overflow-hidden px-6 py-32">
      <div className="pointer-events-none absolute left-0 right-0 top-1/2 z-0 flex -translate-y-1/2 justify-center">
        <span className="ghost-word text-center text-[20vw] text-p-50 sm:text-[18vw] md:text-[16vw] lg:text-[14vw]">SCORED</span>
      </div>

      <div className="relative z-10 mx-auto max-w-7xl">
        <div className="grid items-center gap-16 lg:grid-cols-2">
          <div className="order-2 lg:order-1">
            <ScoreCard />
          </div>

          <div className="order-1 space-y-8 lg:order-2">
            <SectionHeading
              align="left"
              kicker="Ad-Space Quality Score"
              title="Every space gets an honest score"
              sub="Brands can't judge a sticker spot from a photo, so we do it for them. Each space is graded from 0 to 100 on how visible, legible and durable it really is, and only real, brand-safe spaces make it onto the marketplace."
            />

            <div className="grid gap-3 sm:grid-cols-2">
              {points.map((feature, index) => (
                <motion.div
                  key={feature}
                  initial={{ opacity: 0, x: -10 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.4, delay: index * 0.08 }}
                  viewport={{ once: true }}
                  className="flex items-center gap-2.5 rounded-xl p-2 transition-colors duration-300 hover:bg-p-50"
                >
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-p">
                    <Check className="h-3.5 w-3.5 text-ink" strokeWidth={3} />
                  </div>
                  <span className="text-sm text-ink">{feature}</span>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
