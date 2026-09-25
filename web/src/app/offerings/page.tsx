"use client";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { ArrowUpRight } from "lucide-react";
import { Badge, EASE, Empty, GradeBadge, Img, PageHeader, PageLoader, usdc } from "@/components/ui";

export default function Offerings() {
  const { data } = useQuery({ queryKey: ["offerings"], queryFn: () => fetch("/api/offerings/list").then((r) => r.json()) });
  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6">
      <PageHeader kicker="Primary offerings" title="Invest in ad income" sub={<>Each offering splits a share of one ad space&apos;s lease revenue into 10,000 revenue units. Holders are paid pro-rata every time the owner&apos;s proof of display releases escrow.</>} />
      {!data ? <PageLoader label="Loading offerings" /> : !data.offerings.length ? <Empty title="No offerings yet" /> : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {data.offerings.map((o: any, i: number) => {
            const pct = Math.round((o.sold_units / o.offered_units) * 100);
            return (
              <motion.div key={o.id} initial={{ opacity: 0, y: 30, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ delay: i * 0.07, duration: 0.7, ease: EASE }} whileHover={{ y: -6 }}>
                <Link href={`/offerings/${o.id}`} className="group relative block overflow-hidden rounded-3xl border border-line bg-white/[0.03] transition-colors hover:border-p/40" data-testid="offering-card">
                  <div className="relative overflow-hidden">
                    <Img blob={o.spaces.closeup_blob_id} alt="" className="aspect-[16/9] w-full transition-transform duration-700 group-hover:scale-110" />
                    <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/20 to-transparent" />
                    <div className="absolute left-3 top-3"><GradeBadge grade={o.spaces.grade} aqs={o.spaces.aqs} size="sm" /></div>
                    <div className="absolute right-3 top-3"><Badge tone={o.status === "open" ? "ok" : o.status === "tokenised" ? "brand" : "warn"}>{o.status}</Badge></div>
                    <div className="absolute bottom-3 left-4 right-4 flex items-end justify-between">
                      <span className="text-3xl font-extrabold tracking-tight">{(o.revenue_share_bps / 100).toFixed(0)}<span className="text-lg text-p">%</span></span>
                      <span className="grid h-9 w-9 place-items-center rounded-full bg-white text-ink opacity-0 transition-all duration-300 group-hover:rotate-45 group-hover:opacity-100"><ArrowUpRight className="h-4 w-4" /></span>
                    </div>
                  </div>
                  <div className="space-y-3 p-5">
                    <div className="font-bold">{o.spaces.label} · {o.spaces.objects.title}</div>
                    <div className="font-mono text-[11px] text-muted">Series {String(o.seq).padStart(6, "0")} · {o.term_months} months</div>
                    <div className="relative h-2 overflow-hidden rounded-full bg-white/[0.07]">
                      <motion.div className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-p-600 to-p" initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ delay: 0.3 + i * 0.07, duration: 1.1, ease: EASE }} />
                    </div>
                    <div className="flex justify-between text-sm"><span className="text-white/75">{o.sold_units.toLocaleString()} / {o.offered_units.toLocaleString()} units</span><span className="font-bold text-p">{usdc(o.price_per_unit, 4)}/unit</span></div>
                    <div className="border-t border-line pt-3 text-xs text-muted">Distributed so far: <span className="text-white">{usdc(o.total_distributed)}</span></div>
                  </div>
                </Link>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
