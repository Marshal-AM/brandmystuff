"use client"

import { AnimatePresence, motion, useInView } from "framer-motion"
import { Bot as BotIcon, Coins, Search, Sparkles } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { Bot } from "./scout-bot"
import { EASE, PillButton, Reveal, SectionHeading } from "./section-kit"

type Line = { kind: "cmd" | "out" | "ok"; text: string }

const SCRIPT: Line[] = [
  { kind: "cmd", text: 'scout.analyse("lumen.coffee")' },
  { kind: "out", text: "voice: warm · witty · audience: urban creators, 24–34" },
  { kind: "out", text: "palette: roast, cream, sunrise · budget: 6,000 USDC/mo" },
  { kind: "cmd", text: "scout.scan(marketplace, fit: brand_dna)" },
  { kind: "out", text: "12,480 listings checked · 6 spaces fit (89–96%)" },
  { kind: "cmd", text: "scout.book(shortlist, weeks: 4)" },
  { kind: "ok", text: "5,800 USDC paid via x402 · 6 leases in escrow on Sui" },
  { kind: "ok", text: "proof timeline live · next check-in Monday" },
]

const perks = [
  { icon: Sparkles, title: "Reads your brand", text: "Logo, palette, type, tone of voice and audience, pulled from your site, socials and reviews." },
  { icon: Search, title: "Scours the whole marketplace", text: "Every listing is checked against your brand DNA and ranked by fit and quality score." },
  { icon: Coins, title: "Books and pays for you", text: "Within the budget you set, in USDC via x402 into escrow on Sui. You just watch the proofs come in." },
]

function Terminal() {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { margin: "-120px" })
  const [shown, setShown] = useState(0)
  const [typed, setTyped] = useState("")

  useEffect(() => {
    if (!inView) return
    let cancelled = false
    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
    ;(async () => {
      while (!cancelled) {
        setShown(0)
        setTyped("")
        await sleep(600)
        for (let i = 0; i < SCRIPT.length && !cancelled; i++) {
          const line = SCRIPT[i]
          if (line.kind === "cmd") {
            for (let c = 1; c <= line.text.length && !cancelled; c++) {
              setTyped(line.text.slice(0, c))
              await sleep(18)
            }
            await sleep(250)
          } else {
            await sleep(500)
          }
          setTyped("")
          setShown(i + 1)
        }
        await sleep(4200)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [inView])

  const typing = shown < SCRIPT.length && SCRIPT[shown]?.kind === "cmd"

  return (
    <div ref={ref} className="relative overflow-hidden rounded-3xl border border-white/10 bg-p-950 shadow-[0_40px_100px_rgba(0,0,0,0.5)]">
      <div className="flex items-center gap-2 border-b border-white/10 px-5 py-3.5">
        <span className="h-3 w-3 rounded-full bg-white/15" />
        <span className="h-3 w-3 rounded-full bg-white/15" />
        <span className="h-3 w-3 rounded-full bg-p" />
        <span className="ml-3 font-mono text-xs text-white/50">scout · lumen.coffee</span>
      </div>
      <div className="min-h-[300px] space-y-2.5 p-5 font-mono text-[12.5px] leading-relaxed">
        <AnimatePresence initial={false}>
          {SCRIPT.slice(0, shown).map((l, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, ease: EASE }}
              className={l.kind === "cmd" ? "text-white" : l.kind === "ok" ? "text-p" : "text-white/55"}
            >
              <span className={l.kind === "cmd" ? "text-p" : "text-white/30"}>{l.kind === "cmd" ? "› " : "  ← "}</span>
              {l.text}
            </motion.div>
          ))}
        </AnimatePresence>
        {typing && (
          <div className="text-white">
            <span className="text-p">› </span>
            {typed}
            <span className="ml-0.5 inline-block h-3.5 w-2 translate-y-0.5 bg-p [animation:caret-blink_0.8s_steps(1)_infinite]" />
          </div>
        )}
      </div>
    </div>
  )
}

export function AgentsSection() {
  return (
    <section id="agents" className="relative overflow-hidden bg-ink px-6 py-32 text-white">
      <div className="absolute left-1/2 top-0 h-[500px] w-[900px] -translate-x-1/2 rounded-full bg-p/15 blur-[120px]" />
      <div className="pointer-events-none absolute bottom-0 left-0 right-0 flex justify-center">
        <span className="ghost-word translate-y-[18%] text-[18vw] text-white/[0.03]">SCOUT</span>
      </div>

      <div className="relative z-10 mx-auto grid max-w-7xl items-center gap-16 lg:grid-cols-2">
        <div>
          <SectionHeading
            dark
            align="left"
            kicker="Your own AI agent"
            title="Every brand gets an agent that finds its spaces"
            sub="When a brand joins, it gets Scout, its own AI agent. Scout analyses the brand, searches every listing on the platform for the spaces that fit it, and books them. No media buying, no guesswork."
          />
          <div className="mt-10 grid gap-4">
            {perks.map((p, i) => (
              <Reveal key={p.title} delay={0.1 + i * 0.08}>
                <div className="flex gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-p text-ink">
                    <p.icon className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="font-bold">{p.title}</p>
                    <p className="text-sm leading-relaxed text-white/55">{p.text}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
          <div className="mt-10 flex flex-wrap gap-3">
            <PillButton>Meet your agent</PillButton>
            <PillButton variant="outline-dark">See how Scout works</PillButton>
          </div>
        </div>

        <Reveal delay={0.15} className="relative">
          <div className="absolute -top-24 right-6 z-20 hidden sm:block">
            <Bot pose="think" look={-0.6} size={110} visorScan />
          </div>
          <div className="absolute -left-4 -top-4 z-20 flex items-center gap-2 rounded-full bg-p px-3 py-1.5 text-xs font-bold text-ink shadow-xl">
            <BotIcon className="h-3.5 w-3.5" /> One agent per brand
          </div>
          <Terminal />
        </Reveal>
      </div>
    </section>
  )
}
