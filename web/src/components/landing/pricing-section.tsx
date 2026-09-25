"use client"

import { CalendarDays, Camera, MapPin, Ruler } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { ProductArt, type ProductId } from "./brand-art"
import { GradeBadge, PillButton, SectionHeading } from "./section-kit"
import { useQuery } from "@tanstack/react-query"
import { motion } from "framer-motion"
import { SpaceCard } from "../space-card"

type Listing = {
  product: ProductId
  space: string
  object: string
  owner: string
  city: string
  grade: string
  aqs: number
  size: string
  price: number
  nextFree: string
  proofs: number
  badge?: "Tokenised" | "Sponsored"
}

const listings: Listing[] = [
  { product: "laptop", space: "lid-center", object: "macbook", owner: "maya", city: "Bengaluru", grade: "A", aqs: 91, size: "9.5 × 5.5 cm", price: 45, nextFree: "This week", proofs: 12, badge: "Tokenised" },
  { product: "car", space: "rear-door", object: "hatchback", owner: "raj", city: "Mumbai", grade: "A", aqs: 93, size: "60 × 40 cm", price: 120, nextFree: "Oct 6", proofs: 31 },
  { product: "storefront", space: "window-decal", object: "bakery", owner: "lena", city: "Berlin", grade: "A-", aqs: 89, size: "80 × 60 cm", price: 70, nextFree: "This week", proofs: 8, badge: "Sponsored" },
  { product: "skateboard", space: "deck-bottom", object: "deck", owner: "kai", city: "Lisbon", grade: "A-", aqs: 88, size: "20 × 7 cm", price: 22, nextFree: "Oct 13", proofs: 5 },
  { product: "helmet", space: "shell-left", object: "bike-helmet", owner: "ines", city: "Amsterdam", grade: "B+", aqs: 84, size: "8 × 6 cm", price: 18, nextFree: "This week", proofs: 9 },
  { product: "van", space: "side-panel", object: "taco-truck", owner: "diego", city: "Austin", grade: "A", aqs: 95, size: "180 × 90 cm", price: 160, nextFree: "Oct 20", proofs: 44, badge: "Tokenised" },
  { product: "guitar", space: "case-front", object: "gig-case", owner: "sol", city: "London", grade: "B", aqs: 78, size: "25 × 18 cm", price: 20, nextFree: "This week", proofs: 3 },
  { product: "suitcase", space: "shell-front", object: "carry-on", owner: "yuki", city: "Tokyo", grade: "A-", aqs: 87, size: "30 × 20 cm", price: 30, nextFree: "Oct 6", proofs: 7 },
]

function ExampleCard({ l }: { l: Listing }) {
  return (
    <div className="card-shadow flex h-full w-full flex-col overflow-hidden rounded-3xl bg-white">
      <div className="relative grid aspect-[16/10] w-full place-items-center overflow-hidden bg-gradient-to-br from-p-50 to-p-200">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_60%,rgba(255,255,255,0.9),transparent_60%)]" />
        <div className="relative transition-transform duration-500 group-hover:scale-105">
          <ProductArt id={l.product} size={150} />
        </div>
        <div className="absolute left-3 top-3 flex items-center gap-1.5 rounded-xl bg-white/90 py-1 pl-1 pr-2.5 backdrop-blur">
          <GradeBadge grade={l.grade} size="sm" />
          <span className="text-xs font-bold text-ink">AQS {l.aqs}</span>
        </div>
        {l.badge && (
          <span
            className={`absolute right-3 top-3 rounded-xl px-2.5 py-1 text-xs font-bold ${
              l.badge === "Tokenised" ? "bg-ink text-p" : "bg-p text-ink"
            }`}
          >
            {l.badge}
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col p-5">
        <p className="truncate font-mono text-[11px] text-muted-foreground">
          {l.space}.{l.object}.{l.owner}.brandmystuff.eth
        </p>
        <h3 className="mt-1 text-lg font-bold tracking-tight text-ink">
          {l.space} <span className="font-medium text-muted-foreground">· {l.object}</span>
        </h3>

        <div className="mt-4 grid grid-cols-2 gap-x-3 gap-y-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5" />
            {l.city}
          </span>
          <span className="flex items-center gap-1.5">
            <Ruler className="h-3.5 w-3.5" />
            {l.size}
          </span>
          <span className="flex items-center gap-1.5">
            <CalendarDays className="h-3.5 w-3.5" />
            {l.nextFree}
          </span>
          <span className="flex items-center gap-1.5">
            <Camera className="h-3.5 w-3.5" />
            {l.proofs} proofs
          </span>
        </div>

        <div className="mt-auto flex items-end justify-between pt-5">
          <div>
            <p className="text-xs text-muted-foreground">Fixed price</p>
            <p className="text-2xl font-extrabold tracking-tight text-ink">
              {l.price} <span className="text-sm font-semibold text-muted-foreground">USDC / week</span>
            </p>
          </div>
          <button className="rounded-xl bg-ink px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-p hover:text-ink">
            Lease
          </button>
        </div>
      </div>
    </div>
  )
}

function LiveGrid({ spaces }: { spaces: any[] }) {
  return (
    <div className="mx-auto max-w-7xl px-6">
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {spaces.slice(0, 8).map((s, i) => (
          <motion.div
            key={s.id}
            initial={{ opacity: 0, y: 30, scale: 0.95, filter: "blur(8px)" }}
            whileInView={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.7, delay: i * 0.07, ease: [0.22, 1, 0.36, 1] }}
          >
            <SpaceCard s={s} />
          </motion.div>
        ))}
      </div>
    </div>
  )
}

function ExampleMarquee() {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [isHovered, setIsHovered] = useState(false)
  const positionRef = useRef(0)
  const animationRef = useRef<number>(0)
  const tripled = [...listings, ...listings, ...listings]

  useEffect(() => {
    const scrollContainer = scrollRef.current
    if (!scrollContainer) return
    const speed = isHovered ? 0.25 : 0.9
    let lastTime = performance.now()
    const animate = (currentTime: number) => {
      const deltaTime = currentTime - lastTime
      lastTime = currentTime
      positionRef.current += speed * (deltaTime / 16)
      const totalWidth = scrollContainer.scrollWidth / 3
      if (positionRef.current >= totalWidth) positionRef.current = 0
      scrollContainer.style.transform = `translateX(-${positionRef.current}px)`
      animationRef.current = requestAnimationFrame(animate)
    }
    animationRef.current = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(animationRef.current)
  }, [isHovered])

  return (
    <div className="relative w-full" onMouseEnter={() => setIsHovered(true)} onMouseLeave={() => setIsHovered(false)}>
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-24 bg-gradient-to-r from-ink to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-24 bg-gradient-to-l from-ink to-transparent" />
      <div ref={scrollRef} className="flex gap-6 py-4" style={{ width: "fit-content" }}>
        {tripled.map((l, index) => (
          <div key={index} className="group w-[82vw] shrink-0 sm:w-[340px]">
            <ExampleCard l={l} />
          </div>
        ))}
      </div>
    </div>
  )
}

export function PricingSection() {
  // real listings from the marketplace; illustrative examples only until the first one exists
  const { data } = useQuery({ queryKey: ["market", "landing"], queryFn: () => fetch("/api/market?sort=rank").then((r) => r.json()) })
  const live: any[] = data?.results ?? []

  return (
    <section id="marketplace" className="relative overflow-hidden bg-ink py-32 text-white">
      <div className="absolute left-1/2 top-0 h-[420px] w-[900px] -translate-x-1/2 rounded-full bg-p/15 blur-[120px]" />
      <div className="relative mx-auto mb-16 max-w-7xl px-6">
        <SectionHeading
          dark
          kicker={live.length ? "Live right now" : "Marketplace"}
          title="Real spaces on real things, ranked by quality"
          sub="Every listing is a single ad space with its own close-up photo, score, size and fixed weekly price. Filter by city, grade or budget, then lease in one click."
        />
      </div>
      <div className="relative">{live.length ? <LiveGrid spaces={live} /> : <ExampleMarquee />}</div>
      <div className="relative mt-14 flex justify-center">
        <PillButton href="/explore">Explore the marketplace</PillButton>
      </div>
    </section>
  )
}
