"use client";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowUpDown, MapPin, Search, SlidersHorizontal, Sparkles, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { PLACEMENTS } from "@/lib/categories";
import { SpaceCard } from "@/components/space-card";
import { AnimatedNumber, EASE, Empty, Input, PageHeader, Skeleton, cx } from "@/components/ui";
import { EnsPulse } from "@/components/ens";

function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button onClick={() => onChange(!on)} className="flex items-center gap-2.5 text-sm text-white/75 transition-colors hover:text-white" role="switch" aria-checked={on}>
      <span className={cx("relative h-6 w-11 rounded-full border transition-colors duration-300", on ? "border-p bg-p" : "border-line-strong bg-white/[0.05]")}>
        <motion.span layout transition={{ type: "spring", stiffness: 500, damping: 30 }} className={cx("absolute top-0.5 h-[18px] w-[18px] rounded-full shadow", on ? "right-0.5 bg-ink" : "left-0.5 bg-white/70")} />
      </span>
      {label}
    </button>
  );
}

const GRADES: [string, string][] = [["", "Any"], ["2", "B or better"], ["3", "A or better"], ["4", "A+ only"]];
const SORTS: [string, string][] = [["rank", "Best quality"], ["price_asc", "Price: low to high"], ["price_desc", "Price: high to low"], ["newest", "Newest"]];
const GRADE_LABEL: Record<string, string> = { "2": "Grade B or better", "3": "Grade A or better", "4": "Grade A+" };

function FilterGroup({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <div className="mb-2.5 text-[11px] font-bold uppercase tracking-[0.14em] text-faint">{label}</div>
      {children}
    </div>
  );
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} className={cx("rounded-full border px-3 py-1.5 text-xs font-semibold capitalize transition-colors duration-200", on ? "border-p bg-p text-ink" : "border-line-strong text-white/70 hover:border-p/50 hover:text-white")}>
      {children}
    </button>
  );
}

function Segmented({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return (
    <div className="inline-flex flex-wrap gap-1 rounded-2xl border border-line-strong bg-white/[0.03] p-1">
      {options.map(([v, l]) => (
        <button key={v || "any"} type="button" onClick={() => onChange(v)} className={cx("relative rounded-xl px-3.5 py-2 text-xs font-bold transition-colors", value === v ? "text-ink" : "text-white/65 hover:text-white")}>
          {value === v && <motion.span layoutId={`seg-${options[0][1]}`} className="absolute inset-0 rounded-xl bg-p" transition={{ type: "spring", stiffness: 420, damping: 32 }} />}
          <span className="relative">{l}</span>
        </button>
      ))}
    </div>
  );
}

export default function Explore() {
  const [f, setF] = useState({ q: "", tag: "", minGrade: "", maxPrice: "", placement: "", city: "", tokenised: false, sponsored: false, sort: "rank" });
  const [focus, setFocus] = useState(false);
  const qs = useMemo(() => {
    const p = new URLSearchParams();
    Object.entries(f).forEach(([k, v]) => v && p.set(k, v === true ? "1" : String(v)));
    return p.toString();
  }, [f]);
  const { data, isLoading } = useQuery({ queryKey: ["market", qs], queryFn: () => fetch(`/api/market?${qs}`).then((r) => r.json()) });
  const { data: tags } = useQuery({ queryKey: ["tags"], queryFn: () => fetch("/api/tags").then((r) => r.json()) });
  const set = (k: string, v: any) => setF((x) => ({ ...x, [k]: v }));
  const [open, setOpen] = useState(false);
  const barRef = useRef<HTMLDivElement>(null);
  // Close the panel on outside click or Escape.
  useEffect(() => {
    if (!open) return;
    const down = (e: MouseEvent) => barRef.current && !barRef.current.contains(e.target as Node) && setOpen(false);
    const key = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", down);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("mousedown", down);
      document.removeEventListener("keydown", key);
    };
  }, [open]);
  const active = [
    f.minGrade && { key: "grade", label: GRADE_LABEL[f.minGrade], clear: () => set("minGrade", "") },
    f.placement && { key: "placement", label: `Placement: ${f.placement}`, clear: () => set("placement", "") },
    f.maxPrice && { key: "price", label: `Up to ${f.maxPrice} USDC / week`, clear: () => set("maxPrice", "") },
    f.city && { key: "city", label: `In ${f.city}`, clear: () => set("city", "") },
    f.tag && { key: "tag", label: `#${f.tag}`, clear: () => set("tag", "") },
    f.tokenised && { key: "tok", label: "Tokenised", clear: () => set("tokenised", false) },
    f.sponsored && { key: "spon", label: "Sponsored", clear: () => set("sponsored", false) },
  ].filter(Boolean) as { key: string; label: string; clear: () => void }[];
  const reset = () => setF((x) => ({ ...x, tag: "", minGrade: "", maxPrice: "", placement: "", city: "", tokenised: false, sponsored: false }));

  return (
    <div className="mx-auto max-w-7xl px-4 pb-10 sm:px-6">
      <PageHeader
        kicker="Live marketplace"
        title="Find the space your brand belongs on"
        sub="Every space is scored by AI, paid into USDC escrow on Sui and released only when the owner proves your ad is on display."
      />

      <EnsPulse className="mb-4" />

      {/* command bar: search, sort and one unified filter panel */}
      <div ref={barRef} className="relative">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.2, ease: EASE }} className={cx("relative rounded-[1.75rem] p-[1px] transition-all duration-500", focus || open ? "bg-gradient-to-r from-p-600 via-p to-p-300 shadow-[0_0_60px_-10px_rgba(171,159,242,0.6)]" : "bg-line-strong")}>
          <div className="flex items-center gap-2 rounded-[1.7rem] bg-p-950 pl-5 pr-2 sm:gap-3">
            <Search className={cx("h-5 w-5 shrink-0 transition-colors", focus ? "text-p" : "text-muted")} />
            <input
              className="h-16 min-w-0 flex-1 bg-transparent text-base text-white outline-none placeholder:text-white/30"
              placeholder="Search spaces, objects, cities…"
              value={f.q}
              onChange={(e) => set("q", e.target.value)}
              onFocus={() => setFocus(true)}
              onBlur={() => setFocus(false)}
              data-testid="search"
            />
            <span className="hidden shrink-0 items-center gap-1.5 rounded-full bg-p/10 px-3 py-1.5 text-xs font-bold text-p md:flex">
              <Sparkles className="h-3.5 w-3.5" />
              {data ? <AnimatedNumber value={data.total} /> : "…"} spaces
            </span>
            <span className="hidden h-7 w-px bg-line-strong sm:block" />
            <div className="relative hidden shrink-0 sm:block">
              <ArrowUpDown className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
              <select value={f.sort} onChange={(e) => set("sort", e.target.value)} aria-label="Sort" className="h-11 cursor-pointer appearance-none rounded-full bg-transparent pl-8 pr-3 text-sm font-semibold text-white/80 outline-none transition-colors hover:bg-white/[0.05] hover:text-white">
                {SORTS.map(([v, l]) => (
                  <option key={v} value={v} className="bg-p-950">{l}</option>
                ))}
              </select>
            </div>
            <button
              type="button"
              onClick={() => setOpen((o) => !o)}
              aria-expanded={open}
              data-testid="filters"
              className={cx("relative flex h-12 shrink-0 items-center gap-2 rounded-full px-4 text-sm font-bold transition-colors duration-300", open || active.length ? "bg-p text-ink" : "bg-white/[0.06] text-white hover:bg-white/[0.1]")}
            >
              <SlidersHorizontal className="h-4 w-4" />
              <span className="hidden sm:inline">Filters</span>
              <AnimatePresence>
                {active.length > 0 && (
                  <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} className={cx("grid h-5 min-w-5 place-items-center rounded-full px-1 text-[11px] font-extrabold", open || active.length ? "bg-ink text-p" : "bg-p text-ink")}>
                    {active.length}
                  </motion.span>
                )}
              </AnimatePresence>
            </button>
          </div>
        </motion.div>

        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.98 }}
              transition={{ duration: 0.25, ease: EASE }}
              className="absolute inset-x-0 top-full z-30 mt-3 origin-top overflow-hidden rounded-[1.75rem] border border-line-strong bg-p-950 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.9)]"
              data-testid="filter-panel"
            >
              <div aria-hidden className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-p/10 blur-3xl" />
              <div className="relative grid gap-6 p-5 sm:p-6 md:grid-cols-2">
                <FilterGroup label="Quality">
                  <Segmented value={f.minGrade} onChange={(v) => set("minGrade", v)} options={GRADES} />
                </FilterGroup>
                <FilterGroup label="Placement">
                  <div className="flex flex-wrap gap-1.5">
                    {PLACEMENTS.map((pl) => (
                      <Chip key={pl} on={f.placement === pl} onClick={() => set("placement", f.placement === pl ? "" : pl)}>{pl}</Chip>
                    ))}
                  </div>
                </FilterGroup>
                <FilterGroup label="Max price">
                  <div className="relative">
                    <Input placeholder="Any" inputMode="decimal" value={f.maxPrice} onChange={(e) => set("maxPrice", e.target.value.replace(/[^0-9.]/g, ""))} className="pr-24" />
                    <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted">USDC / week</span>
                  </div>
                </FilterGroup>
                <FilterGroup label="City">
                  <div className="relative">
                    <MapPin className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                    <Input placeholder="Any city" value={f.city} onChange={(e) => set("city", e.target.value)} className="pl-10" />
                  </div>
                </FilterGroup>
                <FilterGroup label="Tags" className="md:col-span-2">
                  <div className="flex flex-wrap gap-1.5">
                    {(tags?.tags ?? []).map((t: any) => (
                      <Chip key={t.tag} on={f.tag === t.tag} onClick={() => set("tag", f.tag === t.tag ? "" : t.tag)}>
                        {t.tag} <span className="opacity-50">{t.count}</span>
                      </Chip>
                    ))}
                    {!tags?.tags?.length && <span className="text-xs text-muted">No tags yet.</span>}
                  </div>
                </FilterGroup>
                <FilterGroup label="Show only" className="md:col-span-2">
                  <div className="flex flex-wrap gap-x-6 gap-y-3">
                    <Toggle on={f.tokenised} onChange={(v) => set("tokenised", v)} label="Tokenised spaces" />
                    <Toggle on={f.sponsored} onChange={(v) => set("sponsored", v)} label="Sponsored spaces" />
                  </div>
                </FilterGroup>
                <FilterGroup label="Sort by" className="sm:hidden">
                  <Segmented value={f.sort} onChange={(v) => set("sort", v || "rank")} options={SORTS} />
                </FilterGroup>
              </div>
              <div className="relative flex items-center justify-between gap-3 border-t border-line px-5 py-4 sm:px-6">
                <button type="button" onClick={reset} disabled={!active.length} className="text-sm font-semibold text-muted transition-colors hover:text-white disabled:opacity-40">
                  Clear all
                </button>
                <button type="button" onClick={() => setOpen(false)} className="rounded-full bg-p px-5 py-2.5 text-sm font-bold text-ink shadow-[0_0_24px_rgba(171,159,242,0.35)] transition-transform hover:scale-[1.03]">
                  Show {data ? data.total : "…"} spaces
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* active filters, only when there are any */}
      <AnimatePresence initial={false}>
        {active.length > 0 && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.3, ease: EASE }} className="overflow-hidden">
            <div className="mt-4 flex flex-wrap items-center gap-2">
              {active.map((a) => (
                <motion.button layout key={a.key} onClick={a.clear} className="group flex items-center gap-1.5 rounded-full border border-p/40 bg-p/10 py-1.5 pl-3 pr-2 text-xs font-semibold text-p-100 transition-colors hover:border-p">
                  {a.label}
                  <X className="h-3.5 w-3.5 text-p/70 transition-colors group-hover:text-p" />
                </motion.button>
              ))}
              <button onClick={reset} className="px-2 text-xs font-semibold text-muted transition-colors hover:text-white">Clear all</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {data?.rail?.length > 0 && (
        <section className="mt-10">
          <div className="mb-4 flex items-center gap-3">
            <span className="rounded-full bg-gradient-to-r from-p-300 to-p px-3 py-1 text-[11px] font-extrabold uppercase tracking-wider text-ink">Sponsored</span>
            <span className="h-px flex-1 bg-gradient-to-r from-p/40 to-transparent" />
          </div>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {data.rail.map((s: any) => (
              <SpaceCard key={`rail-${s.id}`} s={{ ...s, slot: "sponsored" }} />
            ))}
          </div>
        </section>
      )}

      <section className="mt-10">
        {isLoading ? (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="overflow-hidden rounded-3xl border border-line">
                <Skeleton className="aspect-[4/3] rounded-none" />
                <div className="space-y-2 p-4">
                  <Skeleton className="h-4 w-2/3 rounded-lg" />
                  <Skeleton className="h-3 w-1/2 rounded-lg" />
                </div>
              </div>
            ))}
          </div>
        ) : !data?.results?.length ? (
          <Empty title="No spaces match yet">Try widening your filters, or be the first: list an object and its ad spaces.</Empty>
        ) : (
          <motion.div layout className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            <AnimatePresence mode="popLayout">
              {data.results.map((s: any, i: number) => (
                <motion.div
                  key={`${s.id}-${i}`}
                  layout
                  initial={{ opacity: 0, y: 30, scale: 0.94, filter: "blur(8px)" }}
                  animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
                  exit={{ opacity: 0, scale: 0.9, filter: "blur(6px)" }}
                  transition={{ duration: 0.6, delay: Math.min(i, 12) * 0.05, ease: EASE }}
                >
                  <SpaceCard s={s} />
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
        )}
      </section>
    </div>
  );
}
