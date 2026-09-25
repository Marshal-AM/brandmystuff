"use client"
import { useEffect, useRef, useState } from "react"
import { Reveal } from "./section-kit"

function useCountUp(end: number, duration = 2000, decimals = 0) {
  const [count, setCount] = useState(0)
  const [hasStarted, setHasStarted] = useState(false)

  useEffect(() => {
    if (!hasStarted) return
    let startTime: number
    let animationFrame: number
    const animate = (currentTime: number) => {
      if (!startTime) startTime = currentTime
      const progress = Math.min((currentTime - startTime) / duration, 1)
      const easeOutQuart = 1 - Math.pow(1 - progress, 4)
      setCount(easeOutQuart * end)
      if (progress < 1) animationFrame = requestAnimationFrame(animate)
    }
    animationFrame = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(animationFrame)
  }, [end, duration, hasStarted])

  return { value: count.toFixed(decimals), start: () => setHasStarted(true) }
}

const STATS = [
  { end: 10.4, decimals: 1, suffix: "M", label: "views on one tweet auctioning a laptop lid" },
  { end: 315, decimals: 0, suffix: "%", label: "funded, with 20 of 20 sticker spots sold" },
  { end: 88, decimals: 0, suffix: "%", label: "of every lease paid to the owner" },
]

export function StatsSection() {
  const [isVisible, setIsVisible] = useState(false)
  const ref = useRef<HTMLElement>(null)
  const a = useCountUp(STATS[0].end, 2000, STATS[0].decimals)
  const b = useCountUp(STATS[1].end, 2000, STATS[1].decimals)
  const c = useCountUp(STATS[2].end, 2000, STATS[2].decimals)
  const counters = [a, b, c]

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !isVisible) {
          setIsVisible(true)
          counters.forEach((x) => x.start())
        }
      },
      { threshold: 0.3 },
    )
    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isVisible])

  return (
    <section ref={ref} className="bg-background px-6 py-28">
      <div className="mx-auto max-w-5xl">
        <Reveal className="mb-16 text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.14em] text-p-600">It started with one MacBook lid</p>
          <p className="mx-auto mt-4 max-w-2xl text-balance text-2xl font-semibold leading-snug tracking-tight text-ink md:text-3xl">
            In 2026 a developer auctioned sticker spots on a laptop he didn&apos;t even own yet. Brands lined up. We built the
            marketplace for everything else people carry.
          </p>
        </Reveal>
        <div className="grid grid-cols-1 gap-12 md:grid-cols-3 lg:gap-16">
          {STATS.map((s, i) => (
            <div
              key={s.label}
              className={`text-center transition-all duration-1000 ${isVisible ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"}`}
              style={{ transitionDelay: `${200 + i * 100}ms` }}
            >
              <p className="mb-3 text-6xl font-extrabold leading-none tracking-[-0.05em] text-ink md:text-7xl">
                {counters[i].value}
                <span className="text-p">{s.suffix}</span>
              </p>
              <p className="mx-auto max-w-[220px] text-sm text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
