"use client"

import type React from "react"
import { useState } from "react"
import { Menu, X, ArrowUpRight, ArrowRight } from "lucide-react"

const NAV = [
  { id: "how-it-works", label: "How it works" },
  { id: "marketplace", label: "Marketplace" },
  { id: "agents", label: "Brand agent" },
  { id: "tokenise", label: "Tokenise" },
  { id: "faq", label: "FAQ" },
]

export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`flex items-center gap-2.5 ${className}`}>
      <span className="grid h-8 w-8 place-items-center rounded-full bg-p">
        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden>
          <rect x="3" y="5" width="18" height="13" rx="6.5" fill="#0a0a0b" />
          <rect x="8" y="9" width="2.6" height="5" rx="1.3" fill="#ab9ff2" />
          <rect x="13.4" y="9" width="2.6" height="5" rx="1.3" fill="#ab9ff2" />
        </svg>
      </span>
      <span className="text-[15px] font-bold tracking-tight">brandmystuff</span>
    </span>
  )
}

export function Header() {
  const [isOpen, setIsOpen] = useState(false)

  const handleSmoothScroll = (e: React.MouseEvent<HTMLAnchorElement>, targetId: string) => {
    e.preventDefault()
    const element = document.getElementById(targetId)
    if (element) {
      const offsetPosition = element.getBoundingClientRect().top + window.scrollY - 96
      window.scrollTo({ top: offsetPosition, behavior: "smooth" })
      setIsOpen(false)
    }
  }

  return (
    <header className="fixed left-0 right-0 top-0 z-50 px-4 pt-4">
      <div className="mx-auto max-w-7xl rounded-2xl border border-white/10 bg-ink/85 px-4 py-2.5 text-white shadow-[0_8px_30px_rgba(0,0,0,0.18)] backdrop-blur-xl sm:px-5">
        <div className="flex items-center justify-between">
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault()
              window.scrollTo({ top: 0, behavior: "smooth" })
            }}
            className="cursor-pointer"
          >
            <Logo />
          </a>

          <nav className="hidden items-center gap-7 md:flex">
            {NAV.map((n) => (
              <a
                key={n.id}
                href={`#${n.id}`}
                onClick={(e) => handleSmoothScroll(e, n.id)}
                className="cursor-pointer text-sm text-white/60 transition-colors hover:text-white"
              >
                {n.label}
              </a>
            ))}
          </nav>

          <div className="hidden items-center gap-2 md:flex">
            <a href="#" className="px-3 text-sm font-medium text-white/70 transition-colors hover:text-white">
              Launch app
            </a>
            <a
              href="#how-it-works"
              onClick={(e) => handleSmoothScroll(e, "how-it-works")}
              className="group relative flex items-center gap-0 overflow-hidden rounded-full bg-p py-1 pl-5 pr-1 text-ink"
            >
              <span className="absolute inset-0 origin-right scale-x-0 rounded-full bg-white transition-transform duration-300 group-hover:scale-x-100" />
              <span className="relative z-10 pr-3 text-sm font-bold">List your stuff</span>
              <span className="relative z-10 flex h-8 w-8 items-center justify-center">
                <ArrowRight className="absolute h-4 w-4 transition-opacity duration-300 group-hover:opacity-0" />
                <ArrowUpRight className="h-4 w-4 opacity-0 transition-all duration-300 group-hover:opacity-100" />
              </span>
            </a>
          </div>

          <button className="text-white md:hidden" onClick={() => setIsOpen(!isOpen)} aria-label="Menu">
            {isOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {isOpen && (
          <nav className="mt-5 flex flex-col gap-4 border-t border-white/10 pb-4 pt-5 md:hidden">
            {NAV.map((n) => (
              <a
                key={n.id}
                href={`#${n.id}`}
                onClick={(e) => handleSmoothScroll(e, n.id)}
                className="cursor-pointer text-white/70 transition-colors hover:text-white"
              >
                {n.label}
              </a>
            ))}
            <div className="mt-2 flex flex-col gap-3 border-t border-white/10 pt-4">
              <a href="#" className="text-white">
                Launch app
              </a>
              <a
                href="#how-it-works"
                onClick={(e) => handleSmoothScroll(e, "how-it-works")}
                className="w-fit rounded-full bg-p px-5 py-2.5 text-sm font-bold text-ink"
              >
                List your stuff
              </a>
            </div>
          </nav>
        )}
      </div>
    </header>
  )
}
