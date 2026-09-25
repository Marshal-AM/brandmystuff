import Link from "next/link"
import { Github, Twitter, Send } from "lucide-react"
import { Logo } from "./header"

const footerLinks = {
  product: [
    { label: "Marketplace", href: "#marketplace" },
    { label: "List your stuff", href: "#how-it-works" },
    { label: "Tokenise", href: "#tokenise" },
    { label: "Brand agent", href: "#agents" },
  ],
  protocol: [
    { label: "Sui package", href: "#" },
    { label: "ENS names", href: "#" },
    { label: "x402 endpoint", href: "#" },
    { label: "Walrus storage", href: "#" },
  ],
  resources: [
    { label: "Docs", href: "#" },
    { label: "Quality score spec", href: "#" },
    { label: "Tokenisation spec", href: "#" },
    { label: "FAQ", href: "#faq" },
  ],
  legal: [
    { label: "Terms", href: "#" },
    { label: "Privacy", href: "#" },
    { label: "Content policy", href: "#" },
    { label: "Risk disclosure", href: "#" },
  ],
}

export function Footer() {
  return (
    <div className="relative">
      {/* purple horizon with the wordmark resting on it */}
      <div className="relative h-[24vw] min-h-[170px] overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_82%_100%_at_50%_100%,var(--p)_0%,var(--p-600)_28%,var(--p-800)_52%,var(--p-950)_69.5%,transparent_70%)]" />
        <div
          className="absolute inset-0 opacity-50"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.16) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.16) 1px, transparent 1px)",
            backgroundSize: "56px 56px",
            maskImage: "radial-gradient(ellipse 82% 100% at 50% 100%, #000 35%, transparent 69%)",
          }}
        />
        <h2 className="ghost-word absolute inset-x-0 bottom-0 translate-y-[18%] text-center text-[13.5vw] leading-[0.85] text-white">
          brandmystuff
        </h2>
      </div>

      <footer id="contact" className="relative z-20 border-t border-white/10 bg-ink px-6 py-16 text-white">
        <div className="mx-auto max-w-7xl">
          <div className="mb-12 grid grid-cols-2 gap-8 md:grid-cols-5">
            <div className="col-span-2 md:col-span-1">
              <Link href="/" className="mb-4 inline-flex">
                <Logo />
              </Link>
              <p className="mb-6 text-sm text-white/50">Rent, lease and tokenise the ad spaces on the things you own.</p>
              <div className="flex gap-3">
                {[Twitter, Github, Send].map((Icon, i) => (
                  <Link
                    key={i}
                    href="#"
                    className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 text-white/60 transition-colors hover:border-p hover:text-p"
                  >
                    <Icon className="h-4 w-4" />
                  </Link>
                ))}
              </div>
            </div>

            {Object.entries(footerLinks).map(([title, links]) => (
              <div key={title}>
                <h4 className="mb-4 text-sm font-bold uppercase tracking-wider text-p">{title}</h4>
                <ul className="space-y-3">
                  {links.map((link) => (
                    <li key={link.label}>
                      <Link href={link.href} className="text-sm text-white/55 transition-colors hover:text-white">
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="flex flex-col items-center justify-between gap-4 border-t border-white/10 pt-8 md:flex-row">
            <p className="text-xs text-white/40">© 2026 brandmystuff. All rights reserved.</p>
            <p className="text-xs text-white/40">Testnet MVP · test funds and mock legal documents only · not an offer of securities</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
