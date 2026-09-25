"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { Search } from "lucide-react";
import { AnimatedNumber, Badge, EASE, Empty, GradeBadge, Img, Input, PageHeader, PageLoader, Stat, cx, usdc } from "@/components/ui";
import { Sparkline, px } from "@/components/trading";

const SORTS = [
  { id: "volume", label: "Top volume" },
  { id: "yield", label: "Income yield" },
  { id: "change", label: "Top movers" },
  { id: "grade", label: "Best quality" },
  { id: "cap", label: "Market cap" },
];

export default function Trade() {
  const { data } = useQuery({ queryKey: ["trade-hub"], queryFn: () => fetch("/api/trade").then((r) => r.json()), refetchInterval: 20000 });
  const [q, setQ] = useState("");
  const [sort, setSort] = useState("volume");
  const rows = useMemo(() => {
    const r = (data?.offerings ?? []).filter((o: any) => !q || `${o.spaces.label} ${o.spaces.objects.title} ${o.spaces.ens_name}`.toLowerCase().includes(q.toLowerCase()));
    const key: Record<string, (o: any) => number> = { volume: (o) => o.market.volume24h, yield: (o) => o.market.incomeYieldPct, change: (o) => o.market.change24hPct, grade: (o) => o.spaces.aqs, cap: (o) => o.market.marketCap };
    return [...r].sort((a, b) => key[sort](b) - key[sort](a));
  }, [data, q, sort]);
  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6">
      <PageHeader kicker="Secondary market" title="Trade ad income" sub="Every tokenised ad space has a live order book. Buy or sell revenue units against other verified investors, with market or limit orders — settled atomically in USDC on Sui." />
      {!data ? (
        <PageLoader label="Loading markets" />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <Stat label="24h volume" value={<AnimatedNumber value={Number(data.totals.volume24h) / 1e6} format={(n) => `$${n.toFixed(4)}`} />} delay={0} />
            <Stat label="Market cap (all spaces)" value={<AnimatedNumber value={Number(data.totals.marketCap) / 1e6} format={(n) => `$${n.toFixed(2)}`} />} delay={0.08} />
            <Stat label="Income distributed" value={<AnimatedNumber value={Number(data.totals.distributed) / 1e6} format={(n) => `$${n.toFixed(4)}`} />} delay={0.16} />
          </div>
          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25, duration: 0.6, ease: EASE }} className="mt-8 flex flex-wrap items-center gap-3">
            <div className="relative w-full max-w-sm">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <Input placeholder="Search tokenised spaces…" value={q} onChange={(e) => setQ(e.target.value)} className="pl-10" />
            </div>
            <div className="flex flex-wrap gap-1 rounded-full border border-line bg-white/[0.03] p-1">
              {SORTS.map((s) => (
                <button key={s.id} onClick={() => setSort(s.id)} className={cx("relative rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors", sort === s.id ? "text-ink" : "text-muted hover:text-white")}>
                  {sort === s.id && <motion.span layoutId="trade-sort" className="absolute inset-0 rounded-full bg-p" transition={{ type: "spring", stiffness: 450, damping: 32 }} />}
                  <span className="relative">{s.label}</span>
                </button>
              ))}
            </div>
          </motion.div>
          {!rows.length ? (
            <div className="mt-6"><Empty title="No tokenised spaces yet" /></div>
          ) : (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35, duration: 0.7, ease: EASE }} className="glass mt-5 overflow-x-auto rounded-3xl">
              <table className="w-full min-w-[900px] text-sm">
                <thead className="border-b border-line text-left text-[10px] font-semibold uppercase tracking-widest text-muted">
                  <tr>
                    <th className="p-4">Space</th><th>Status</th><th className="text-right">Last</th><th className="text-right">24h</th><th className="text-right">Bid / Ask</th><th className="text-right">24h vol</th><th className="text-right">Income yield</th><th className="text-right">Holders</th><th className="p-4">Trend</th>
                  </tr>
                </thead>
                <tbody>
                  <AnimatePresence initial={false}>
                    {rows.map((o: any, i: number) => {
                      const up = o.market.change24hPct >= 0;
                      return (
                        <motion.tr key={o.id} layout initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} transition={{ delay: i * 0.04, duration: 0.45, ease: EASE }} className="group border-b border-line transition-colors last:border-0 hover:bg-p/[0.05]" data-testid="trade-row">
                          <td className="p-4">
                            <Link href={`/offerings/${o.id}`} className="flex items-center gap-3">
                              <span className="relative overflow-hidden rounded-xl ring-1 ring-line transition-all group-hover:ring-p/50">
                                <Img blob={o.spaces.closeup_blob_id} alt="" className="h-11 w-11 transition-transform duration-500 group-hover:scale-110" />
                              </span>
                              <span>
                                <span className="flex items-center gap-2 font-bold transition-colors group-hover:text-p">{o.spaces.label} <GradeBadge grade={o.spaces.grade} size="sm" /></span>
                                <span className="block text-xs text-muted">{o.spaces.objects.title} · {(o.revenue_share_bps / 100).toFixed(0)}% share</span>
                              </span>
                            </Link>
                          </td>
                          <td><Badge tone={o.status === "open" ? "ok" : "brand"}>{o.status === "open" ? "primary sale" : "trading"}</Badge></td>
                          <td className="text-right font-mono font-semibold">{px(o.market.lastPrice)}</td>
                          <td className="text-right">
                            <span className={cx("inline-block rounded-full px-2 py-0.5 font-mono text-xs font-semibold", up ? "bg-p/15 text-p" : "bg-white/10 text-white/80")}>{up ? "+" : ""}{o.market.change24hPct.toFixed(1)}%</span>
                          </td>
                          <td className="text-right font-mono text-xs text-white/75">{px(o.market.bestBid)} / {px(o.market.bestAsk)}</td>
                          <td className="text-right font-mono">{usdc(o.market.volume24h, 4)}</td>
                          <td className="text-right font-semibold text-p">{o.market.incomeYieldPct.toFixed(2)}%</td>
                          <td className="text-right">{o.holders}</td>
                          <td className="p-4"><Sparkline points={o.market.history} /></td>
                        </motion.tr>
                      );
                    })}
                  </AnimatePresence>
                </tbody>
              </table>
            </motion.div>
          )}
        </>
      )}
    </div>
  );
}
