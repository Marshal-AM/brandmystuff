const ITEMS = [
  "Settles in USDC on Sui",
  "Media stored on Walrus",
  "Every listing is an ENS name",
  "Every brand gets an AI agent",
  "Scored by Gemini vision",
  "Escrow released on proof",
  "Social login, no seed phrases",
  "Agent payments over x402",
]

export function TrustStrip() {
  const row = [...ITEMS, ...ITEMS]
  return (
    <section className="relative overflow-hidden border-y border-border bg-p-50 py-5" aria-label="Built on">
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-32 bg-gradient-to-r from-p-50 to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-32 bg-gradient-to-l from-p-50 to-transparent" />
      <div className="marquee flex w-max items-center gap-10" style={{ animationDuration: "50s" }}>
        {row.map((t, i) => (
          <span key={i} className="flex items-center gap-3 whitespace-nowrap text-sm font-semibold text-p-700">
            <span className="h-1.5 w-1.5 rounded-full bg-p" />
            {t}
          </span>
        ))}
      </div>
    </section>
  )
}
