"use client"

import { BadgeCheck, Camera, ScanSearch, Wallet } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { ProductArt } from "./brand-art"
import { GradeBadge, Reveal, SectionHeading } from "./section-kit"

const steps = [
  {
    icon: Camera,
    title: "Snap your stuff",
    description: "Photograph a laptop, car, helmet or shop window and mark each ad space with its size and a close-up.",
  },
  {
    icon: ScanSearch,
    title: "AI scores every space",
    description: "A vision model checks the photo is real and grades each space from 0 to 100, with the evidence behind it.",
  },
  {
    icon: Wallet,
    title: "A brand's agent books it",
    description: "Each brand's AI agent matches your space to the brand, books the weeks and pays in USDC. The full amount waits in escrow on Sui.",
  },
  {
    icon: BadgeCheck,
    title: "Prove it, get paid",
    description: "Snap the sticker in place each week. Once the photo checks out, that week's payout lands in your wallet.",
  },
]

function AnimatedIcon({ Icon }: { Icon: React.ComponentType<{ className?: string; strokeWidth?: number; style?: React.CSSProperties }> }) {
  const [isVisible, setIsVisible] = useState(false)
  const iconRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => entry.isIntersecting && setIsVisible(true), { threshold: 0.3 })
    if (iconRef.current) observer.observe(iconRef.current)
    return () => observer.disconnect()
  }, [])

  return (
    <div ref={iconRef} className="relative grid h-20 w-20 place-items-center rounded-3xl bg-p-50 transition-colors duration-300 group-hover:bg-p">
      <Icon
        className={`h-10 w-10 text-ink ${isVisible ? "animate-draw-icon" : ""}`}
        strokeWidth={1.5}
        style={{ strokeDasharray: isVisible ? undefined : 1000, strokeDashoffset: isVisible ? undefined : 1000 }}
      />
    </div>
  )
}

export function ServicesSection() {
  const [isVisible, setIsVisible] = useState(false)
  const sectionRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => entry.isIntersecting && setIsVisible(true), { threshold: 0.2 })
    if (sectionRef.current) observer.observe(sectionRef.current)
    return () => observer.disconnect()
  }, [])

  return (
    <section id="how-it-works" className="relative overflow-hidden px-6 py-32 pb-24">
      <div className="pointer-events-none absolute left-0 right-0 top-0 z-0 flex justify-center">
        <span className="ghost-word text-center text-[18vw] text-p-50 sm:text-[16vw] md:text-[14vw] lg:text-[12vw]">MISSION</span>
      </div>


      <div className="relative z-10 mx-auto max-w-7xl">
        {/* mission panel */}
        <div ref={sectionRef} className="relative mb-32 overflow-hidden rounded-[2rem] bg-ink px-8 py-14 lg:px-14 lg:py-16">
          <div className="absolute -right-24 -top-24 h-[420px] w-[420px] rounded-full bg-p/25 blur-[100px]" />
          <div className="absolute -bottom-32 left-1/3 h-[300px] w-[300px] rounded-full bg-p-700/40 blur-[90px]" />
          <div className="relative z-10 grid items-center gap-12 lg:grid-cols-2 lg:gap-20">
            <div>
              <p className="mb-4 text-sm font-bold uppercase tracking-[0.16em] text-p">Our mission</p>
              <h2 className="mb-8 text-balance text-4xl font-extrabold leading-[1.02] tracking-[-0.04em] text-white md:text-5xl">
                Brands want to be seen in real life. You already carry the space.
              </h2>
              <div className="space-y-5 leading-relaxed text-white/65">
                <p>
                  Sticker auctions on laptop lids proved brands will pay for authentic, physical presence. They also proved
                  what&apos;s broken: one-off sites, no way to judge a spot, weak proof it was ever displayed, and nearly a third of the
                  winners never paying.
                </p>
                <p>
                  brandmystuff fixes the trust gap. Every space is scored, every lease is escrowed upfront, and every payout is
                  released only against a verified photo.
                </p>
              </div>
            </div>

            <div className={`relative mx-auto h-[340px] w-full max-w-md transition-all duration-1000 ${isVisible ? "scale-100 opacity-100" : "scale-95 opacity-0"}`}>
              <div className="absolute inset-0 rounded-[2rem] border border-white/10 bg-white/[0.03]" />
              <div className="absolute inset-0 grid place-items-center">
                <div className="[animation:float-y_5s_ease-in-out_infinite]">
                  <ProductArt id="laptop" size={250} />
                </div>
              </div>
              <div className="absolute left-4 top-6 flex items-center gap-2 rounded-2xl bg-white px-3 py-2 shadow-xl [animation:float-y_4s_ease-in-out_infinite]">
                <GradeBadge grade="A" size="sm" />
                <span className="text-xs font-bold text-ink">AQS 91</span>
              </div>
              <div className="absolute right-4 top-6 rounded-2xl bg-p px-3 py-2 text-xs font-bold text-ink shadow-xl [animation:float-y_4.6s_ease-in-out_infinite_0.6s]">
                45 USDC / week
              </div>
              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full border border-white/15 bg-ink px-3 py-1.5 font-mono text-[11px] text-white/80">
                lid-center.macbook.maya.brandmystuff.eth
              </div>
            </div>
          </div>
        </div>

        <SectionHeading
          kicker="How it works"
          title="From your desk to a paid billboard in four steps"
          sub="Listing takes about five minutes on your phone. After that, the only thing you do is snap a photo each week."
        />

        <div className="mt-16 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {steps.map((step, index) => (
            <Reveal key={step.title} delay={index * 0.08}>
              <div className="group relative h-full rounded-3xl border border-border p-7 transition-colors duration-300 hover:border-p hover:bg-p-50">
                <span className="absolute right-6 top-6 font-mono text-xs font-semibold text-p-600">0{index + 1}</span>
                <div className="mb-6">
                  <AnimatedIcon Icon={step.icon} />
                </div>
                <h3 className="mb-2 text-xl font-bold tracking-tight text-ink">{step.title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{step.description}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}
