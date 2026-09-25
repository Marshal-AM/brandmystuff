"use client"

import { Reveal, SectionHeading } from "./section-kit"

const FEES = [
  { value: "Free", label: "Listing a space", note: "List as many objects and spaces as you like." },
  { value: "12%", label: "Lease fee", note: "Taken from each released tranche. Owners keep 88%." },
  { value: "3%", label: "Tokenisation", note: "Of the amount raised, only if the raise succeeds." },
  { value: "1%", label: "Secondary trades", note: "When investors resell units to each other." },
  { value: "3 USDC", label: "Sponsored, per day", note: "Category slots. The homepage rail is 10 USDC a day." },
]

export function FeesSection() {
  return (
    <section id="fees" className="px-6 pb-8 pt-8">
      <div className="mx-auto max-w-7xl">
        <div className="relative overflow-hidden rounded-[2rem] bg-ink px-6 py-16 sm:px-12">
          <div className="absolute -left-24 top-0 h-80 w-80 rounded-full bg-p/20 blur-[100px]" />
          <div className="relative">
            <SectionHeading
              dark
              kicker="Fees"
              title="Simple fees, all on-chain"
              sub="Owners set every price themselves. We never suggest or change it. Sponsored spots are always labelled and never change the organic ranking."
            />
            <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              {FEES.map((f, i) => (
                <Reveal key={f.label} delay={i * 0.06}>
                  <div className="h-full rounded-3xl border border-white/10 bg-white/[0.03] p-6 transition-colors duration-300 hover:border-p/50 hover:bg-p/10">
                    <p className="text-4xl font-extrabold tracking-[-0.04em] text-p">{f.value}</p>
                    <p className="mt-3 font-bold text-white">{f.label}</p>
                    <p className="mt-1 text-sm leading-relaxed text-white/50">{f.note}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
