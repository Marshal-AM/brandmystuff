"use client"

import { AnimatePresence, motion } from "framer-motion"
import { ArrowRight, ArrowUpRight } from "lucide-react"
import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { AnimatedText } from "./animated-text"
import { PRODUCTS, ProductArt } from "./brand-art"

const N = PRODUCTS.length
const ORBIT_SECONDS = 70 // one full lap of the ring
const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1]

type Geo = { w: number; h: number; cx: number; cy: number; rx: number; ry: number; size: number; apexY: number; chipTop: number }

function geometry(w: number, h: number): Geo {
  if (w < 720) {
    // phones: a flatter arc that stays in a band above the copy
    const size = 68
    const apexY = Math.max(96, h * 0.13)
    const ry = h * 0.17
    const cy = apexY + ry
    return { w, h, cx: w / 2, cy, rx: w * 0.42, ry, size, apexY, chipTop: cy + 8 }
  }
  const size = Math.max(110, Math.min(172, h * 0.19))
  const cy = h * 0.98
  const apexY = h * 0.21
  return { w, h, cx: w / 2, cy, rx: Math.min(w * 0.44, 720), ry: cy - apexY, size, apexY, chipTop: apexY + size * 0.62 + 16 }
}

/** Branded products riding a semicircle, each spinning as it travels. */
function ProductOrbit({ geo, onApex }: { geo: Geo; onApex: (i: number) => void }) {
  const items = useRef<(HTMLDivElement | null)[]>([])
  const spins = useRef<(HTMLDivElement | null)[]>([])
  const apex = useRef(-1)
  const geoRef = useRef(geo)
  geoRef.current = geo

  useEffect(() => {
    let raf = 0
    const t0 = performance.now()
    const speeds = PRODUCTS.map((_, i) => (i % 2 ? -1 : 1) * (22 + (i * 7) % 18)) // deg per second
    const loop = (now: number) => {
      const t = (now - t0) / 1000
      const { cx, cy, rx, ry, size } = geoRef.current
      // products travel left → over the top → right
      const base = Math.PI - (t / ORBIT_SECONDS) * Math.PI * 2
      let best = -2
      let bestI = 0
      for (let i = 0; i < N; i++) {
        const el = items.current[i]
        const spin = spins.current[i]
        if (!el || !spin) continue
        const th = base + (i / N) * Math.PI * 2
        const s = Math.sin(th)
        const x = cx + Math.cos(th) * rx
        const y = cy - s * ry
        const depth = Math.max(0, s)
        const scale = 0.58 + depth * 0.42
        const opacity = Math.max(0, Math.min(1, (s + 0.04) * 3.2))
        el.style.transform = `translate3d(${x - size / 2}px, ${y - size / 2}px, 0) scale(${scale})`
        el.style.opacity = String(opacity)
        el.style.zIndex = String(Math.round(depth * 100))
        el.style.filter = depth < 0.35 ? `blur(${(0.35 - depth) * 6}px)` : "none"
        spin.style.transform = `rotate(${t * speeds[i]}deg)`
        if (s > best) {
          best = s
          bestI = i
        }
      }
      if (bestI !== apex.current) {
        apex.current = bestI
        onApex(bestI)
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [onApex])

  return (
    <div className="absolute inset-0 pointer-events-none" aria-hidden>
      {/* the orbit track */}
      <svg className="absolute inset-0 w-full h-full overflow-visible">
        <ellipse
          cx={geo.cx}
          cy={geo.cy}
          rx={geo.rx}
          ry={geo.ry}
          fill="none"
          stroke="rgba(171,159,242,0.28)"
          strokeWidth="1.5"
          strokeDasharray="2 10"
          strokeLinecap="round"
        />
        <ellipse cx={geo.cx} cy={geo.cy} rx={geo.rx * 1.12} ry={geo.ry * 1.1} fill="none" stroke="rgba(171,159,242,0.08)" strokeWidth="1" />
      </svg>
      {PRODUCTS.map((p, i) => (
        <div
          key={p.id}
          ref={(el) => {
            items.current[i] = el
          }}
          className="absolute left-0 top-0 will-change-transform"
          style={{ width: geo.size, height: geo.size, opacity: 0 }}
        >
          <div className="absolute inset-[18%] rounded-full bg-p/25 blur-2xl" />
          <div
            ref={(el) => {
              spins.current[i] = el
            }}
            className="relative w-full h-full will-change-transform"
            style={{ filter: "drop-shadow(0 18px 24px rgba(0,0,0,0.45))" }}
          >
            <ProductArt id={p.id} size={geo.size} />
          </div>
        </div>
      ))}
    </div>
  )
}

export function HeroSection() {
  const [isVisible, setIsVisible] = useState(false)
  const [scrollProgress, setScrollProgress] = useState(0)
  const [geo, setGeo] = useState<Geo>(() => geometry(1440, 900))
  const [apex, setApex] = useState(0)
  const sectionRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 100)
    return () => clearTimeout(timer)
  }, [])

  useLayoutEffect(() => {
    const measure = () => {
      const el = sectionRef.current
      if (!el) return
      setGeo(geometry(el.clientWidth, el.clientHeight))
    }
    measure()
    window.addEventListener("resize", measure)
    return () => window.removeEventListener("resize", measure)
  }, [])

  useEffect(() => {
    let rafId: number
    let currentProgress = 0
    const handleScroll = () => {
      const targetProgress = Math.min(window.scrollY / 400, 1)
      const smoothUpdate = () => {
        currentProgress += (targetProgress - currentProgress) * 0.1
        if (Math.abs(targetProgress - currentProgress) > 0.001) {
          setScrollProgress(currentProgress)
          rafId = requestAnimationFrame(smoothUpdate)
        } else {
          setScrollProgress(targetProgress)
        }
      }
      cancelAnimationFrame(rafId)
      smoothUpdate()
    }
    window.addEventListener("scroll", handleScroll, { passive: true })
    return () => {
      window.removeEventListener("scroll", handleScroll)
      cancelAnimationFrame(rafId)
    }
  }, [])

  const easeOutQuad = (t: number) => t * (2 - t)
  const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3)
  const scale = 1 - easeOutQuad(scrollProgress) * 0.08
  const borderRadius = easeOutCubic(scrollProgress) * 48

  const p = PRODUCTS[apex]
  const chipTop = geo.chipTop
  const contentTop = chipTop + 52

  return (
    <section ref={sectionRef} className="relative h-[100svh] min-h-[680px] overflow-hidden bg-background">
      <div
        className="absolute inset-0 will-change-transform overflow-hidden bg-ink"
        style={{ transform: `scale(${scale})`, borderRadius: `${borderRadius}px` }}
      >
        {/* backdrop */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_100%,var(--p-800)_0%,var(--p-950)_45%,var(--ink)_75%)]" />
        <div className="absolute -left-[10vw] -top-[10vw] w-[60vw] h-[40vw] rounded-full bg-p-700/40 blur-[90px]" />
        <div className="absolute -right-[12vw] top-[10vh] w-[50vw] h-[36vw] rounded-full bg-p-800/50 blur-[90px]" />
        <div
          className="absolute left-[-50%] right-[-50%] bottom-[-20%] top-[58%] overflow-hidden [perspective:420px] [perspective-origin:50%_0%]"
          style={{ maskImage: "linear-gradient(to bottom, transparent, #000 30%, #000)" }}
        >
          <div
            className="absolute inset-x-0 top-0 bottom-[-100%] origin-top [transform:rotateX(62deg)]"
            style={{
              backgroundImage:
                "linear-gradient(rgba(171,159,242,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(171,159,242,0.3) 1px, transparent 1px)",
              backgroundSize: "64px 64px",
              animation: "grid-drift 3s linear infinite",
            }}
          />
        </div>
        <style>{`@keyframes grid-drift { to { background-position: 0 64px; } }`}</style>

        <ProductOrbit geo={geo} onApex={setApex} />

        {/* whatever crosses the top of the arc shows its listing */}
        <div className="absolute left-1/2 z-[120] -translate-x-1/2" style={{ top: chipTop }}>
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.div
              key={p.id}
              initial={{ opacity: 0, y: 8, filter: "blur(6px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={{ opacity: 0, y: -8, filter: "blur(6px)" }}
              transition={{ duration: 0.45, ease: EASE }}
              className="flex items-center gap-2 whitespace-nowrap rounded-full border border-white/10 bg-white/[0.06] py-1 pl-1 pr-3 text-xs text-white/80 backdrop-blur-md"
            >
              <span className="rounded-full bg-p px-2 py-0.5 font-bold text-ink">{p.grade}</span>
              <span className="font-mono text-white">{p.space}</span>
              <span className="hidden sm:inline text-white/50">· {p.label}</span>
              <span className="font-semibold text-p">{p.price} USDC/wk</span>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* copy sits inside the arc */}
        <div className="absolute inset-x-0 z-[110] px-6 text-center" style={{ top: contentTop }}>
          <h1 className="mx-auto max-w-3xl text-balance text-white">
            <AnimatedText text="Your stuff is ad space." delay={0.3} highlight="ad space." />
          </h1>
          <p
            className={`mx-auto mt-6 max-w-xl text-base md:text-lg leading-relaxed text-white/60 transition-all duration-1000 delay-[900ms] ${
              isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3"
            }`}
          >
            List the laptop, car, helmet or shop window you already own. Every brand gets an AI agent that finds the spaces that fit
            it, and you get paid every time the ad is proven on display.
          </p>
          <div
            className={`mt-9 flex flex-col sm:flex-row items-center justify-center gap-3 transition-all duration-1000 delay-[1100ms] ${
              isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3"
            }`}
          >
            <a
              href="#how-it-works"
              className="group relative flex items-center gap-0 rounded-full bg-p py-1.5 pl-6 pr-1.5 text-sm font-bold text-ink shadow-[0_10px_40px_rgba(171,159,242,0.35)] transition-transform hover:scale-[1.03]"
            >
              <span className="pr-4">List your stuff</span>
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-ink">
                <ArrowUpRight className="h-4 w-4 text-p transition-transform duration-300 group-hover:rotate-45" />
              </span>
            </a>
            <a
              href="#marketplace"
              className="group relative flex items-center gap-0 overflow-hidden rounded-full border border-white/15 py-1.5 pl-6 pr-1.5 text-sm font-semibold text-white"
            >
              <span className="absolute inset-0 origin-right scale-x-0 rounded-full bg-white transition-transform duration-300 group-hover:scale-x-100" />
              <span className="relative z-10 pr-4 transition-colors duration-300 group-hover:text-ink">Book ad spaces</span>
              <span className="relative z-10 flex h-10 w-10 items-center justify-center">
                <ArrowRight className="absolute h-4 w-4 transition-opacity duration-300 group-hover:opacity-0" />
                <ArrowUpRight className="h-4 w-4 opacity-0 transition-all duration-300 group-hover:text-ink group-hover:opacity-100" />
              </span>
            </a>
          </div>
          <p
            className={`mt-6 flex items-center justify-center gap-2 text-xs font-medium text-white/40 transition-all duration-1000 delay-[1300ms] ${
              isVisible ? "opacity-100" : "opacity-0"
            }`}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-p shadow-[0_0_10px_var(--p)] [animation:live-dot_1.6s_ease-in-out_infinite]" />
            Live on Sui testnet · USDC escrow · paid on proof
          </p>
        </div>
      </div>
    </section>
  )
}
