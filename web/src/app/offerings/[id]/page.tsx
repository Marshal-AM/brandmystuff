"use client";
import Link from "next/link";
import { use, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { ExternalLink, FileText, Sparkles } from "lucide-react";
import { useSession } from "@/lib/client/session";
import { buyPrimary, claim, closeOffering, refundOffering } from "@/lib/sui/tx";
import { WALRUS } from "@/lib/deployment";
import { AnimatedNumber, Badge, Button, Card, EASE, Empty, Field, GradeBadge, Img, Input, PageLoader, ScrollArea, Stat, Unit, FitText, shortAddr, suiscan, useAction, usdc } from "@/components/ui";
import { EnsName } from "@/components/ens";
import { MyOrders, OrderBook, PriceChart, TradeTicket, px } from "@/components/trading";
import { SignInButtons } from "@/components/shell";

export default function Offering({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { api, run, authenticated, address, signMessage } = useSession();
  const { data, refetch, isLoading } = useQuery({ queryKey: ["offering", id], queryFn: () => api<any>(`/api/offerings/${id}`), refetchInterval: 15000 });
  const [units, setUnits] = useState("");
  const { busy, run: act } = useAction();
  if (isLoading) return <PageLoader label="Loading offering" />;
  if (!data?.offering) return <div className="mx-auto max-w-xl p-10"><Empty title="Offering not found" /></div>;
  const o = data.offering, s = data.space, mine = data.mine;
  const ended = Date.now() >= Number(o.sale_end_ms) || o.sold_units >= o.offered_units;
  const remaining = o.offered_units - o.sold_units;
  const pct = Math.round((o.sold_units / o.offered_units) * 100);
  const accept = async (u: number) => {
    const message = `brandmystuff:accept:${id}:${o.legal_pack_hash.replace(/^0x/, "")}:${u}`;
    const signature = await signMessage(message);
    const r = await api<any>("/api/acceptances", { method: "POST", json: { message, signature, role: "investor", offeringId: id, units: u } });
    return r.sigHash as string;
  };
  const buy = () =>
    act("buy", async () => {
      const u = Number(units);
      const sigHash = await accept(u);
      await run(buyPrimary({ offeringId: id, units: u, amount: BigInt(o.price_per_unit) * BigInt(u), acceptSigHash: sigHash }));
      setUnits("");
      refetch();
    }, "Units purchased");
  const pack = o.legal_pack;
  const held = mine ? mine.units + mine.listed : 0;
  const liveHolders = data.holders.filter((h: any) => h.units + h.listed_units > 0).sort((x: any, y: any) => y.units + y.listed_units - (x.units + x.listed_units));
  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6">
      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-5">
          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease: EASE }} className="relative overflow-hidden rounded-[2rem] border border-line">
            <Img blob={s.closeup_blob_id} alt="" className="absolute inset-0 h-full w-full scale-110 opacity-30 blur-2xl" />
            <div className="absolute inset-0 bg-gradient-to-br from-ink/60 via-ink/80 to-p-950" />
            <div className="relative flex flex-wrap items-center gap-5 p-6 sm:p-8">
              <motion.div initial={{ rotate: -8, scale: 0.8, opacity: 0 }} animate={{ rotate: 0, scale: 1, opacity: 1 }} transition={{ delay: 0.15, type: "spring", stiffness: 200, damping: 16 }} className="overflow-hidden rounded-2xl ring-1 ring-p/40 shadow-[0_20px_60px_-20px_rgba(171,159,242,.6)]">
                <Img blob={s.closeup_blob_id} alt="" className="h-28 w-28" />
              </motion.div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-3xl font-extrabold tracking-tight">{pack?.series ?? `Series ${String(o.seq).padStart(6, "0")}`}</h1>
                  <Badge tone={o.status === "open" ? "ok" : o.status === "tokenised" ? "brand" : "warn"}>{o.status}</Badge>
                </div>
                <div className="mt-2"><EnsName name={s.ens_name} kind="space" size="xs" /></div>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-white/70">
                  <GradeBadge grade={s.grade} aqs={s.aqs} size="sm" /> {s.objects.title} · {usdc(s.price_per_week)}/week lease price
                </div>
                <div className="mt-4 max-w-md">
                  <div className="mb-1 flex justify-between text-[11px] text-muted"><span>{pct}% sold</span><span>{remaining.toLocaleString()} left</span></div>
                  <div className="relative h-1.5 overflow-hidden rounded-full bg-white/10">
                    <motion.div className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-p-600 to-p" initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ delay: 0.4, duration: 1.2, ease: EASE }} />
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
          {o.status === "tokenised" && data.market && (
            <Card className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="flex items-center gap-2 text-lg font-bold"><span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-p opacity-75" /><span className="relative inline-flex h-2 w-2 rounded-full bg-p" /></span>Market</h2>
                <span className="text-xs text-muted">Secondary trading between verified investors · 1% fee</span>
              </div>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                <Stat label="Last price" value={`${px(data.market.lastPrice)}`} sub={<span className={data.market.change24hPct >= 0 ? "text-p" : "text-white/80"}>{data.market.change24hPct >= 0 ? "+" : ""}{data.market.change24hPct.toFixed(1)}% 24h</span>} />
                <Stat label="Best bid / ask" value={`${px(data.market.bestBid)} / ${px(data.market.bestAsk)}`} sub={data.market.spread != null ? `spread ${px(data.market.spread)}` : "no spread yet"} delay={0.05} />
                <Stat label="24h volume" value={usdc(data.market.volume24h, 4)} sub={`${data.market.units24h.toLocaleString()} units traded`} delay={0.1} />
                <Stat label="Income / unit" value={`${px(data.market.incomePerUnit)}`} sub={`${data.market.incomeYieldPct.toFixed(2)}% of issue price`} delay={0.15} />
                <Stat label="Market cap" value={usdc(data.market.marketCap, 2)} sub="10,000 units × last" delay={0.2} />
                <Stat label="Trades" value={<AnimatedNumber value={data.market.trades} />} sub="all-time fills" delay={0.25} />
              </div>
              <PriceChart history={data.market.history} />
              <OrderBook bids={data.bids} asks={data.listings} me={address} />
            </Card>
          )}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label="Revenue share" value={`${(o.revenue_share_bps / 100).toFixed(0)}%`} sub="of gross lease revenue" delay={0.05} />
            <Stat label="Price / unit" value={usdc(o.price_per_unit, 4)} sub={`${o.offered_units.toLocaleString()} offered`} delay={0.1} />
            <Stat label="Sold" value={<><AnimatedNumber value={o.sold_units} /><Unit>units</Unit></>} sub={`min raise ${o.min_raise_units.toLocaleString()}`} delay={0.15} />
            <Stat label="Distributed" value={usdc(o.total_distributed)} sub={`${data.stats.completed} completed leases`} delay={0.2} />
          </div>
          <Card>
            <h2 className="mb-2 flex items-center gap-2 text-lg font-bold"><Sparkles className="h-4 w-4 text-p" /> How you earn</h2>
            <p className="text-sm leading-relaxed text-white/70">
              Every time the owner&apos;s proof of display is accepted, a tranche of the advertiser&apos;s escrow is released: 12% platform fee, <b className="text-white">{(o.revenue_share_bps / 100).toFixed(0)}%</b> of the gross to all 10,000 units pro-rata (via an on-chain accumulator), the rest to the owner. One unit earns <span className="font-mono text-p">{(o.revenue_share_bps / 1e8).toFixed(6)}</span> USDC per 1 USDC of lease revenue. Claim any time.
            </p>
            <p className="mt-3 text-xs text-muted">Term {o.term_months} months · sale {ended ? "ended" : `ends ${new Date(Number(o.sale_end_ms)).toLocaleString()}`}</p>
          </Card>
          <Card>
            <h2 className="mb-3 flex items-center gap-2 text-lg font-bold">Legal documents <Badge tone="warn">mock</Badge></h2>
            {!pack ? <p className="text-sm text-muted">Loading document pack…</p> : (
              <div className="space-y-2">
                {pack.documents.map((d: any, i: number) => (
                  <motion.a key={d.key} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }} whileHover={{ x: 4 }} href={`${WALRUS.aggregator}/v1/blobs/${d.blobId}`} target="_blank" rel="noreferrer" className="group flex items-center justify-between gap-3 rounded-2xl border border-line bg-white/[0.02] p-3 text-sm transition-colors hover:border-p/40">
                    <span className="flex items-center gap-3"><span className="grid h-8 w-8 place-items-center rounded-xl bg-p/15 text-p"><FileText className="h-4 w-4" /></span>{d.title}</span>
                    <span className="flex items-center gap-2 font-mono text-[11px] text-muted">sha256 {d.sha256.slice(0, 10)}… <ExternalLink className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-100" /></span>
                  </motion.a>
                ))}
                <p className="break-all pt-1 text-xs text-muted">Pack hash (on-chain): <span className="font-mono text-white/70">{o.legal_pack_hash}</span></p>
              </div>
            )}
          </Card>
          <Card>
            <h2 className="mb-4 text-lg font-bold">Holders & activity</h2>
            <div className="grid gap-6 md:grid-cols-2">
              <div>
                <div className="mb-2 flex items-center justify-between text-[11px] font-bold uppercase tracking-[0.12em] text-muted"><span>Holders</span><span>{liveHolders.length}</span></div>
                <ScrollArea max={300}>
                  <div className="space-y-3 text-sm">
                    {liveHolders.map((h: any, i: number) => {
                      const hu = h.units + h.listed_units;
                      return (
                        <div key={h.address}>
                          <div className="flex justify-between gap-2"><span className="truncate font-mono text-xs">{shortAddr(h.address)}{h.address === o.owner && <span className="ml-1 text-p">(owner)</span>}</span><span className="shrink-0 tabular-nums">{hu.toLocaleString()} units</span></div>
                          <div className="mt-1 h-1 overflow-hidden rounded-full bg-white/[0.06]">
                            <motion.div className="h-full rounded-full bg-p/70" initial={{ width: 0 }} whileInView={{ width: `${(hu / 10000) * 100}%` }} viewport={{ once: true }} transition={{ delay: Math.min(i, 8) * 0.05, duration: 0.8, ease: EASE }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              </div>
              <div>
                <div className="mb-2 flex items-center justify-between text-[11px] font-bold uppercase tracking-[0.12em] text-muted"><span>Activity</span><span>{data.events.length}</span></div>
                <ScrollArea max={300}>
                  <div className="space-y-1 text-xs">
                    {data.events.map((e: any, i: number) => (
                      <motion.div key={e.id} initial={{ opacity: 0, y: 6 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: Math.min(i, 10) * 0.025 }} className="flex justify-between gap-2 rounded-lg px-2 py-1.5 hover:bg-white/[0.03]">
                        <span className="truncate"><span className="font-semibold text-p">{e.kind}</span>{e.units ? ` · ${e.units}u` : ""}{e.amount ? ` · ${usdc(e.amount)}` : ""}</span>
                        <a className="inline-flex shrink-0 items-center gap-1 text-p hover:text-white" href={suiscan("tx", e.digest)} target="_blank" rel="noreferrer">tx <ExternalLink className="h-3 w-3" /></a>
                      </motion.div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            </div>
          </Card>
        </div>
        <div className="space-y-4 lg:sticky lg:top-[140px] lg:self-start">
          {!authenticated ? <Card><p className="mb-3 text-sm text-muted">Sign in to invest or trade.</p><SignInButtons /></Card> : (
            <>
              {mine && (
                <Card className="relative overflow-hidden">
                  <div aria-hidden className="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-p/20 blur-3xl" />
                  <div className="relative">
                    <div className="text-xs font-semibold uppercase tracking-widest text-muted">Your position</div>
                    <div className="mt-1 text-4xl font-extrabold tracking-tight"><AnimatedNumber value={held} /> <span className="text-lg text-muted">units</span></div>
                    <div className="text-sm text-muted">{mine.listed > 0 && `${mine.listed} listed · `}{(held / 100).toFixed(2)}% of the series</div>
                    {data.market && held > 0 && (
                      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                        <div className="rounded-xl bg-white/[0.04] p-2.5 text-muted">Cost basis<FitText max={14} min={10} className="mt-0.5 font-bold text-white">{usdc(mine.costBasis, 4)}</FitText></div>
                        <div className="rounded-xl bg-white/[0.04] p-2.5 text-muted">Market value<FitText max={14} min={10} className="mt-0.5 font-bold text-white">{usdc(held * data.market.lastPrice, 4)}</FitText></div>
                      </div>
                    )}
                    <div className="mt-4 flex items-center justify-between rounded-2xl border border-p/30 bg-p/10 p-3.5">
                      <div><div className="text-xs text-p-200">Claimable</div><div className="text-xl font-extrabold text-white" data-testid="claimable">{usdc(mine.claimable)}</div></div>
                      <Button size="sm" disabled={BigInt(mine.claimable) === 0n} loading={busy === "claim"} onClick={() => act("claim", () => run(claim({ offeringId: id })).then(() => refetch()), "Claimed")} data-testid="claim">Claim</Button>
                    </div>
                    {o.status === "refunding" && mine.units > 0 && address !== o.owner && (
                      <Button className="mt-3 w-full" loading={busy === "refund"} onClick={() => act("refund", () => run(refundOffering({ offeringId: id })).then(() => refetch()), "Refunded")}>Refund my purchase</Button>
                    )}
                  </div>
                </Card>
              )}
              {o.status === "open" && !ended && (
                <Card className="ring-spin space-y-4">
                  <h3 className="text-lg font-bold">Buy units</h3>
                  {!mine?.verified ? (
                    <p className="text-sm text-white/75">Verify your identity to invest. <Link href="/verify" className="font-semibold text-p hover:underline">Verify now</Link></p>
                  ) : (
                    <>
                      <Field label={`Units (max ${Math.min(remaining, o.per_investor_max).toLocaleString()})`}>
                        <Input inputMode="numeric" value={units} onChange={(e) => setUnits(e.target.value.replace(/\D/g, ""))} data-testid="buy-units" />
                      </Field>
                      <div className="flex items-baseline justify-between rounded-2xl bg-white/[0.04] p-3.5">
                        <span className="text-sm text-muted">Total</span>
                        <motion.span key={units} initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="text-2xl font-extrabold">{usdc((BigInt(o.price_per_unit) * BigInt(Number(units) || 0)).toString(), 4)}</motion.span>
                      </div>
                      <p className="text-xs text-muted">You&apos;ll sign the subscription agreement with your wallet; its hash is stored on-chain with your purchase.</p>
                      <Button className="w-full" size="lg" loading={busy === "buy"} disabled={!(Number(units) > 0)} onClick={buy} data-testid="buy">Sign & buy</Button>
                    </>
                  )}
                </Card>
              )}
              {o.status === "open" && ended && (
                <Card>
                  <p className="text-sm text-white/75">The sale window has ended.</p>
                  <Button className="mt-3 w-full" loading={busy === "close"} onClick={() => act("close", () => run(closeOffering({ offeringId: id, spaceId: o.space_id })).then(() => refetch()), "Offering closed")} data-testid="close-offering">Close offering</Button>
                </Card>
              )}
              {o.status === "tokenised" && (
                <>
                  <TradeTicket offering={o} bids={data.bids} asks={data.listings} mine={mine} onDone={() => refetch()} />
                  <MyOrders offeringId={id} bids={mine?.myBids ?? []} asks={mine?.myListings ?? []} onDone={() => refetch()} />
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
