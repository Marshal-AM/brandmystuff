"use client"

import { motion } from "framer-motion"
import { ArrowRight, ArrowUpRight } from "lucide-react"
import type { ReactNode } from "react"

export const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1]

export function Reveal({ children, delay = 0, y = 24, className }: { children: ReactNode; delay?: number; y?: number; className?: string }) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y, filter: "blur(8px)" }}
      whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.8, delay, ease: EASE }}
    >
      {children}
    </motion.div>
  )
}

export function Kicker({ children, dark }: { children: ReactNode; dark?: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-[0.08em] ${
        dark ? "border border-p/30 bg-p/10 text-p" : "bg-p-100 text-p-700"
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${dark ? "bg-p shadow-[0_0_10px_var(--p)]" : "bg-p-600"}`} />
      {children}
    </span>
  )
}

export function SectionHeading({
  kicker,
  title,
  sub,
  dark,
  align = "center",
}: {
  kicker?: string
  title: ReactNode
  sub?: ReactNode
  dark?: boolean
  align?: "center" | "left"
}) {
  const centered = align === "center"
  return (
    <Reveal className={centered ? "mx-auto max-w-3xl text-center" : "max-w-xl"}>
      {kicker && <Kicker dark={dark}>{kicker}</Kicker>}
      <h2
        className={`mt-5 text-balance text-4xl font-extrabold leading-[1.02] tracking-[-0.04em] md:text-5xl lg:text-[56px] ${
          dark ? "text-white" : "text-ink"
        }`}
      >
        {title}
      </h2>
      {sub && (
        <p className={`mt-5 text-base leading-relaxed md:text-lg ${centered ? "mx-auto max-w-2xl" : ""} ${dark ? "text-white/60" : "text-muted-foreground"}`}>
          {sub}
        </p>
      )}
    </Reveal>
  )
}

export function PillButton({ children, href = "#", variant = "primary" }: { children: ReactNode; href?: string; variant?: "primary" | "dark" | "outline" | "outline-dark" }) {
  if (variant === "primary" || variant === "dark") {
    const primary = variant === "primary"
    return (
      <a
        href={href}
        className={`group flex items-center gap-0 rounded-full py-1.5 pl-6 pr-1.5 text-sm font-bold transition-transform hover:scale-[1.03] ${
          primary ? "bg-p text-ink shadow-[0_10px_40px_rgba(171,159,242,0.35)]" : "bg-ink text-white"
        }`}
      >
        <span className="pr-4">{children}</span>
        <span className={`flex h-10 w-10 items-center justify-center rounded-full ${primary ? "bg-ink" : "bg-p"}`}>
          <ArrowUpRight className={`h-4 w-4 transition-transform duration-300 group-hover:rotate-45 ${primary ? "text-p" : "text-ink"}`} />
        </span>
      </a>
    )
  }
  const onDark = variant === "outline-dark"
  return (
    <a
      href={href}
      className={`group relative flex items-center gap-0 overflow-hidden rounded-full border py-1.5 pl-6 pr-1.5 text-sm font-semibold ${
        onDark ? "border-white/15 text-white" : "border-border text-ink"
      }`}
    >
      <span className={`absolute inset-0 origin-right scale-x-0 rounded-full transition-transform duration-300 group-hover:scale-x-100 ${onDark ? "bg-white" : "bg-ink"}`} />
      <span className={`relative z-10 pr-4 transition-colors duration-300 ${onDark ? "group-hover:text-ink" : "group-hover:text-white"}`}>{children}</span>
      <span className="relative z-10 flex h-10 w-10 items-center justify-center">
        <ArrowRight className="absolute h-4 w-4 transition-opacity duration-300 group-hover:opacity-0" />
        <ArrowUpRight className={`h-4 w-4 opacity-0 transition-all duration-300 group-hover:opacity-100 ${onDark ? "group-hover:text-ink" : "group-hover:text-white"}`} />
      </span>
    </a>
  )
}

export function GradeBadge({ grade, size = "md", light }: { grade: string; size?: "sm" | "md" | "lg"; light?: boolean }) {
  const cls = size === "lg" ? "h-14 min-w-14 text-2xl rounded-2xl" : size === "sm" ? "h-6 min-w-6 text-[11px] rounded-lg" : "h-8 min-w-8 text-sm rounded-xl"
  return <span className={`inline-grid place-items-center px-1.5 font-extrabold ${light ? "bg-p text-ink" : "bg-ink text-p"} ${cls}`}>{grade}</span>
}
