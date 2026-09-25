"use client"

import { useEffect, useRef, useState } from "react"
import { Bot as BotIcon } from "lucide-react"
import { ProductArt, type ProductId } from "./brand-art"
import { SectionHeading } from "./section-kit"

type Persona = { name: string; role: string; content: string; art?: ProductId; agent?: boolean }

const row1: Persona[] = [
  { name: "Maya", role: "Student creator · owner", content: "My MacBook goes to class, cafés and hackathons every day. Now its lid pays for my coffee.", art: "laptop" },
  { name: "Raj", role: "Rideshare driver · owner", content: "Eight hours a day in traffic. I lease my rear doors and tokenised them for cash upfront.", art: "car" },
  { name: "Lena", role: "Bakery owner · owner", content: "A decal from a coffee brand that pairs with my croissants. It pays my window's rent.", art: "storefront" },
]

const row2: Persona[] = [
  { name: "Theo", role: "Indie SaaS founder · brand", content: "I set a budget and my agent found placements from 20 USDC a week. A photo every week proves they're up.", art: "skateboard" },
  { name: "Kenji", role: "Investor", content: "Small, diversified yield from spaces with a track record. I claim my income whenever I want.", art: "suitcase" },
  { name: "Scout", role: "Lumen Coffee's AI agent", content: "I read Lumen's brand, checked 12,480 listings and booked the 6 spaces that fit. Now I watch the proofs.", agent: true },
]

function Card({ p }: { p: Persona }) {
  return (
    <div className="flex w-[86vw] shrink-0 flex-col rounded-3xl border border-border bg-white p-7 sm:w-[400px]">
      <div className="mb-6 flex items-start gap-4">
        <div className={`grid h-14 w-14 shrink-0 place-items-center rounded-2xl ${p.agent ? "bg-ink text-p" : "bg-p-50"}`}>
          {p.agent ? <BotIcon className="h-6 w-6" /> : <ProductArt id={p.art!} size={44} />}
        </div>
        <p className="flex-1 text-lg leading-relaxed text-ink">&ldquo;{p.content}&rdquo;</p>
      </div>
      <div className="mt-auto">
        <p className="text-sm font-bold text-ink">{p.name}</p>
        <p className="text-xs text-muted-foreground">{p.role}</p>
      </div>
    </div>
  )
}

function Row({ items, reverse }: { items: Persona[]; reverse?: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  const [paused, setPaused] = useState(false)
  const pos = useRef(0)

  useEffect(() => {
    const el = ref.current
    if (!el || paused) return
    let raf = 0
    let last = performance.now()
    const step = (now: number) => {
      const third = el.scrollWidth / 3
      pos.current = (pos.current + ((now - last) / 16) * 0.6) % third
      last = now
      el.style.transform = `translateX(${reverse ? pos.current - third : -pos.current}px)`
      raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [paused, reverse])

  return (
    <div className="relative overflow-hidden" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      <div className="pointer-events-none absolute bottom-0 left-0 top-0 z-10 w-32 bg-gradient-to-r from-background to-transparent" />
      <div className="pointer-events-none absolute bottom-0 right-0 top-0 z-10 w-32 bg-gradient-to-l from-background to-transparent" />
      <div ref={ref} className="flex w-max gap-6">
        {[...items, ...items, ...items].map((p, i) => (
          <Card key={i} p={p} />
        ))}
      </div>
    </div>
  )
}

export function TestimonialsSection() {
  return (
    <section id="testimonials" className="px-6 py-32">
      <div className="mx-auto max-w-7xl">
        <div className="mb-16">
          <SectionHeading
            kicker="Who it's for"
            title="Made for everyone who owns stuff, and everyone who wants to be on it"
            sub="Owners, brands and investors all use the same account, and every brand gets its own agent."
          />
        </div>
        <div className="space-y-6">
          <Row items={row1} />
          <Row items={row2} reverse />
        </div>
      </div>
    </section>
  )
}
