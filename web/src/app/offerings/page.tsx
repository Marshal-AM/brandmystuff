"use client";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Badge, Empty, GradeBadge, Img, Spinner, usdc } from "@/components/ui";

export default function Offerings() {
  const { data } = useQuery({ queryKey: ["offerings"], queryFn: () => fetch("/api/offerings/list").then((r) => r.json()) });
  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      <h1 className="text-3xl font-semibold">Invest in ad income</h1>
      <p className="mt-1 max-w-2xl text-muted">Each offering splits a share of one ad space&apos;s lease revenue into 10,000 revenue units. Holders are paid pro-rata every time the owner&apos;s proof of display releases escrow.</p>
      {!data ? <div className="grid place-items-center py-20"><Spinner /></div> : !data.offerings.length ? <div className="mt-8"><Empty title="No offerings yet" /></div> : (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.offerings.map((o: any) => {
            const pct = Math.round((o.sold_units / o.offered_units) * 100);
            return (
              <Link key={o.id} href={`/offerings/${o.id}`} className="overflow-hidden rounded-2xl border border-line bg-surface hover:shadow-md" data-testid="offering-card">
                <div className="relative">
                  <Img blob={o.spaces.closeup_blob_id} alt="" className="aspect-[16/9] w-full" />
                  <div className="absolute left-3 top-3"><GradeBadge grade={o.spaces.grade} aqs={o.spaces.aqs} size="sm" /></div>
                  <div className="absolute right-3 top-3"><Badge tone={o.status === "open" ? "ok" : o.status === "tokenised" ? "brand" : "warn"}>{o.status}</Badge></div>
                </div>
                <div className="space-y-2 p-4">
                  <div className="font-semibold">{o.spaces.label} · {o.spaces.objects.title}</div>
                  <div className="text-sm text-muted">Series {String(o.seq).padStart(6, "0")} · {(o.revenue_share_bps / 100).toFixed(0)}% revenue share · {o.term_months} months</div>
                  <div className="h-2 overflow-hidden rounded-full bg-black/5"><div className="h-full bg-brand" style={{ width: `${pct}%` }} /></div>
                  <div className="flex justify-between text-sm"><span>{o.sold_units.toLocaleString()} / {o.offered_units.toLocaleString()} units</span><span className="font-medium">{usdc(o.price_per_unit, 4)}/unit</span></div>
                  <div className="text-xs text-muted">Distributed so far: {usdc(o.total_distributed)}</div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
