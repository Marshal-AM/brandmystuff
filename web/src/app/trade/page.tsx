"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Badge, Empty, GradeBadge, Img, Input, Select, Spinner, Stat, usdc } from "@/components/ui";
import { Sparkline, px } from "@/components/trading";

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
    <div className="mx-auto max-w-7xl px-4 py-10">
      <h1 className="text-3xl font-semibold">Trade ad income</h1>
      <p className="mt-1 max-w-2xl text-muted">Every tokenised ad space has a live order book. Buy or sell revenue units against other verified investors, with market or limit orders — settled atomically in USDC on Sui.</p>
      {!data ? (
        <div className="grid place-items-center py-20"><Spinner /></div>
      ) : (
        <>
          <div className="mt-6 grid grid-cols-3 gap-3">
            <Stat label="24h volume" value={usdc(data.totals.volume24h, 4)} />
            <Stat label="Market cap (all spaces)" value={usdc(data.totals.marketCap)} />
            <Stat label="Income distributed" value={usdc(data.totals.distributed, 4)} />
          </div>
          <div className="mt-6 flex gap-2">
            <Input placeholder="Search tokenised spaces…" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-sm" />
            <Select value={sort} onChange={(e) => setSort(e.target.value)} className="max-w-48">
              <option value="volume">Top volume</option>
              <option value="yield">Highest income yield</option>
              <option value="change">Top movers</option>
              <option value="grade">Best quality</option>
              <option value="cap">Market cap</option>
            </Select>
          </div>
          {!rows.length ? (
            <div className="mt-6"><Empty title="No tokenised spaces yet" /></div>
          ) : (
            <div className="mt-4 overflow-x-auto rounded-2xl border border-line bg-surface">
              <table className="w-full text-sm">
                <thead className="border-b border-line text-left text-xs uppercase text-muted">
                  <tr>
                    <th className="p-3">Space</th><th>Status</th><th className="text-right">Last</th><th className="text-right">24h</th><th className="text-right">Bid / Ask</th><th className="text-right">24h vol</th><th className="text-right">Income yield</th><th className="text-right">Holders</th><th className="p-3">Trend</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((o: any) => (
                    <tr key={o.id} className="border-b border-line last:border-0 hover:bg-black/[0.02]" data-testid="trade-row">
                      <td className="p-3">
                        <Link href={`/offerings/${o.id}`} className="flex items-center gap-3">
                          <Img blob={o.spaces.closeup_blob_id} alt="" className="h-10 w-10 rounded-lg" />
                          <span>
                            <span className="font-medium">{o.spaces.label}</span> <GradeBadge grade={o.spaces.grade} size="sm" />
                            <span className="block text-xs text-muted">{o.spaces.objects.title} · {(o.revenue_share_bps / 100).toFixed(0)}% share</span>
                          </span>
                        </Link>
                      </td>
                      <td><Badge tone={o.status === "open" ? "ok" : "brand"}>{o.status === "open" ? "primary sale" : "trading"}</Badge></td>
                      <td className="text-right font-mono">{px(o.market.lastPrice)}</td>
                      <td className={`text-right font-mono ${o.market.change24hPct >= 0 ? "text-emerald-700" : "text-bad"}`}>{o.market.change24hPct >= 0 ? "+" : ""}{o.market.change24hPct.toFixed(1)}%</td>
                      <td className="text-right font-mono text-xs">{px(o.market.bestBid)} / {px(o.market.bestAsk)}</td>
                      <td className="text-right font-mono">{usdc(o.market.volume24h, 4)}</td>
                      <td className="text-right">{o.market.incomeYieldPct.toFixed(2)}%</td>
                      <td className="text-right">{o.holders}</td>
                      <td className="p-3"><Sparkline points={o.market.history} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
