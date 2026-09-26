"use client";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { Search, SlidersHorizontal, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import { PLACEMENTS } from "@/lib/categories";
import { SpaceCard } from "@/components/space-card";
import { AnimatedNumber, EASE, Empty, Input, LinkButton, PageHeader, Select, Skeleton, cx } from "@/components/ui";
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

  return (
    <div className="mx-auto max-w-7xl px-4 pb-10 sm:px-6">
      <PageHeader
        kicker="Live marketplace"
        title="Find the space your brand belongs on"
        sub="Every space is scored by AI, paid into USDC escrow on Sui and released only when the owner proves your ad is on display."
        actions={
          <>
            <LinkButton href="/list" variant="secondary">List your stuff</LinkButton>
            <LinkButton href="/offerings">Invest in ad income</LinkButton>
          </>
        }
      />

      <EnsPulse className="mb-4" />

      {/* command bar */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.2, ease: EASE }} className={cx("relative rounded-[1.75rem] p-[1px] transition-all duration-500", focus ? "bg-gradient-to-r from-p-600 via-p to-p-300 shadow-[0_0_60px_-10px_rgba(171,159,242,0.6)]" : "bg-line-strong")}>
        <div className="flex items-center gap-3 rounded-[1.7rem] bg-p-950 px-5">
          <Search className={cx("h-5 w-5 shrink-0 transition-colors", focus ? "text-p" : "text-muted")} />
          <input
            className="h-16 w-full bg-transparent text-base text-white outline-none placeholder:text-white/30"
            placeholder="Search spaces, objects, cities…"
            value={f.q}
            onChange={(e) => set("q", e.target.value)}
            onFocus={() => setFocus(true)}
            onBlur={() => setFocus(false)}
            data-testid="search"
          />
          <span className="hidden shrink-0 items-center gap-1.5 rounded-full bg-p/10 px-3 py-1.5 text-xs font-bold text-p sm:flex">
            <Sparkles className="h-3.5 w-3.5" />
            {data ? <AnimatedNumber value={data.total} /> : "…"} spaces
          </span>
        </div>
      </motion.div>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.7, delay: 0.35 }} className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-6">
        <Input placeholder="Tag (laptop, car…)" value={f.tag} onChange={(e) => set("tag", e.target.value.toLowerCase())} />
        <Select value={f.minGrade} onChange={(e) => set("minGrade", e.target.value)}>
          <option value="">Any grade</option>
          <option value="4">A+</option>
          <option value="3">A or better</option>
          <option value="2">B or better</option>
        </Select>
        <Select value={f.placement} onChange={(e) => set("placement", e.target.value)}>
          <option value="">Any placement</option>
          {PLACEMENTS.map((p) => (
            <option key={p}>{p}</option>
          ))}
        </Select>
        <Input placeholder="Max USDC / week" inputMode="decimal" value={f.maxPrice} onChange={(e) => set("maxPrice", e.target.value)} />
        <Input placeholder="City" value={f.city} onChange={(e) => set("city", e.target.value)} />
        <Select value={f.sort} onChange={(e) => set("sort", e.target.value)}>
          <option value="rank">Best quality</option>
          <option value="price_asc">Price ↑</option>
          <option value="price_desc">Price ↓</option>
          <option value="newest">Newest</option>
        </Select>
      </motion.div>

      <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-3">
        <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-faint">
          <SlidersHorizontal className="h-3.5 w-3.5" /> Filters
        </span>
        <Toggle on={f.tokenised} onChange={(v) => set("tokenised", v)} label="Tokenised only" />
        <Toggle on={f.sponsored} onChange={(v) => set("sponsored", v)} label="Sponsored only" />
      </div>

      {tags?.tags?.length > 0 && (
        <motion.div layout className="mt-5 flex flex-wrap gap-2">
          {tags.tags.map((t: any, i: number) => {
            const on = f.tag === t.tag;
            return (
              <motion.button
                key={t.tag}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.4 + i * 0.025, type: "spring", stiffness: 400, damping: 22 }}
                whileTap={{ scale: 0.92 }}
                onClick={() => set("tag", on ? "" : t.tag)}
                className={cx("relative rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors duration-300", on ? "border-p text-ink" : "border-line-strong text-white/70 hover:border-p/50 hover:text-white")}
              >
                {on && <motion.span layoutId="tag-on" className="absolute inset-0 rounded-full bg-p" transition={{ type: "spring", stiffness: 400, damping: 30 }} />}
                <span className="relative">
                  {t.tag} <span className={on ? "opacity-60" : "text-faint"}>{t.count}</span>
                </span>
              </motion.button>
            );
          })}
        </motion.div>
      )}

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
