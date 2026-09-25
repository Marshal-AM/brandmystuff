"use client"

import { motion, useInView } from "framer-motion"
import { FileText, Info, Users } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { ProductArt } from "./brand-art"
import { EASE, GradeBadge, PillButton, Reveal, SectionHeading } from "./section-kit"

const TERMS = [
  { k: "Revenue share", v: "60% of gross" },
  { k: "Term", v: "24 months" },
  { k: "Units", v: "10,000" },
  { k: "Price per unit", v: "0.25 USDC" },
]

function OfferingCard() {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: "-120px" })
  const [raised, setRaised] = useState(0)
  const [accrued, setAccrued] = useState(12.4031)
  const target = 1800

  useEffect(() => {
    if (!inView) return
    let raf = 0
    const t0 = performance.now()
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / 2200)
      setRaised(Math.round(1296 * (1 - Math.pow(1 - p, 3))))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    const id = window.setInterval(() => setAccrued((a) => a + 0.0007), 120)
    return () => {
      cancelAnimationFrame(raf)
      clearInterval(id)
    }
  }, [inView])

  const pct = Math.round((raised / target) * 100)

  return (
    <div ref={ref} className="card-shadow overflow-hidden rounded-3xl bg-white">
      <div className="relative flex items-center gap-4 bg-ink p-6 text-white">
        <div className="absolute -right-10 -top-16 h-40 w-40 rounded-full bg-p/30 blur-3xl" />
        <div className="relative grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-white/5">
          <ProductArt id="laptop" size={54} />
        </div>
        <div className="relative min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-p">Series 00007 · offering</p>
          <p className="truncate text-lg font-bold tracking-tight">lid-center.macbook.maya</p>
        </div>
        <GradeBadge grade="A" light />
      </div>

      <div className="p-6">
        <div className="mb-2 flex items-end justify-between">
          <div>
            <p className="text-xs text-muted-foreground">Raised</p>
            <p className="text-3xl font-extrabold tracking-tight text-ink">
              {raised.toLocaleString("en-US")} <span className="text-base font-semibold text-muted-foreground">/ {target.toLocaleString("en-US")} USDC</span>
            </p>
          </div>
          <span className="flex items-center gap-1.5 text-sm font-semibold text-ink">
            <Users className="h-4 w-4 text-p-600" /> 38 holders
          </span>
        </div>
        <div className="h-2.5 overflow-hidden rounded-full bg-p-50">
          <motion.div className="h-full rounded-full bg-gradient-to-r from-p-600 to-p" animate={{ width: `${pct}%` }} transition={{ duration: 0.4, ease: EASE }} />
        </div>
        <p className="mt-2 text-xs text-muted-foreground">{pct}% of the raise · closes in 2 days</p>

        <div className="mt-6 grid grid-cols-2 gap-3">
          {TERMS.map((t) => (
            <div key={t.k} className="rounded-2xl bg-p-50 p-3">
              <p className="text-xs text-muted-foreground">{t.k}</p>
              <p className="text-sm font-bold text-ink">{t.v}</p>
            </div>
          ))}
        </div>

        <div className="mt-6 flex items-center justify-between rounded-2xl border border-border p-4">
          <div>
            <p className="text-xs text-muted-foreground">Your claimable income</p>
            <p className="font-mono text-xl font-bold text-ink">{accrued.toFixed(4)} USDC</p>
          </div>
          <button className="rounded-xl bg-p px-5 py-2.5 text-sm font-bold text-ink">Claim</button>
        </div>

        <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
          <FileText className="h-3.5 w-3.5" /> Legal pack stored on Walrus · hash on-chain
        </div>
      </div>
    </div>
  )
}

export function TokeniseSection() {
  return (
    <section id="tokenise" className="relative overflow-hidden bg-p-50 px-6 py-32">
      <div className="relative z-10 mx-auto grid max-w-7xl items-center gap-16 lg:grid-cols-2">
        <Reveal className="order-2 lg:order-1">
          <OfferingCard />
        </Reveal>
        <div className="order-1 lg:order-2">
          <SectionHeading
            align="left"
            kicker="Tokenise a space"
            title="Get cash now for your lid's future ad income"
            sub="Like real-estate tokenisation, but for the things you carry. Sell a share of a space's future lease income to verified investors, keep the rest, and they get paid automatically every time a lease pays out."
          />
          <Reveal delay={0.1} className="mt-8 grid gap-3 sm:grid-cols-2">
            {[
              ["You set the terms", "Revenue share, term, unit price and how much you keep."],
              ["Investors earn on every proof", "Their share is distributed each time a tranche is released."],
              ["Trade any time", "Units can be resold to other verified investors on the secondary market."],
              ["Everything on Sui", "Offerings, holdings, payouts and trades are all on-chain."],
            ].map(([t, d]) => (
              <div key={t} className="rounded-2xl bg-white p-4">
                <p className="text-sm font-bold text-ink">{t}</p>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{d}</p>
              </div>
            ))}
          </Reveal>
          <Reveal delay={0.2} className="mt-8 flex flex-wrap items-center gap-4">
            <PillButton href="/offerings" variant="dark">Explore offerings</PillButton>
            <span className="flex max-w-xs items-start gap-2 text-xs leading-relaxed text-muted-foreground">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Testnet demo: mock legal documents and test funds only. Not an offer of securities.
            </span>
          </Reveal>
        </div>
      </div>
    </section>
  )
}
