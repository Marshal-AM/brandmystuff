"use client"

import { PRODUCTS, ProductArt } from "./brand-art"
import { PillButton, Reveal } from "./section-kit"

export function CTASection() {
  const row = [...PRODUCTS, ...PRODUCTS]
  return (
    <section className="relative overflow-hidden px-6 pb-16 pt-32">
      <div className="pointer-events-none absolute inset-0 flex select-none items-center justify-center">
        <span className="ghost-word text-[20vw] text-p-50">BRAND IT</span>
      </div>

      <div className="relative z-10 mx-auto max-w-7xl">
        <Reveal className="mb-16 text-center">
          <h2 className="mx-auto mb-6 max-w-4xl text-balance text-4xl font-extrabold leading-[1.02] tracking-[-0.04em] text-ink md:text-6xl">
            Everything you own is a billboard <span className="text-p-600">waiting to happen</span>
          </h2>
          <p className="mx-auto mb-10 max-w-2xl text-muted-foreground">
            List your first space in five minutes, or book real-world placements from 8 USDC a week.
          </p>
          <div className="flex flex-col justify-center gap-3 sm:flex-row">
            <PillButton href="/list" variant="dark">List your stuff</PillButton>
            <PillButton href="/explore" variant="outline">Book ad spaces</PillButton>
          </div>
        </Reveal>
      </div>

      {/* a slow parade of branded things */}
      <div className="relative z-10 overflow-hidden">
        <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-40 bg-gradient-to-r from-background to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-40 bg-gradient-to-l from-background to-transparent" />
        <div className="marquee flex w-max items-center gap-10 py-6" style={{ animationDuration: "45s" }}>
          {row.map((p, i) => (
            <div key={i} className="grid h-36 w-36 shrink-0 place-items-center rounded-[2rem] bg-p-50" style={{ rotate: `${(i % 3) * 4 - 4}deg` }}>
              <ProductArt id={p.id} size={104} />
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
