"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowUpRight, BellRing, Camera, Clock, Plus } from "lucide-react";
import { useSession } from "@/lib/client/session";
import { AnimatedNumber, Badge, Card, EASE, Empty, GradeBadge, Img, LinkButton, PageHeader, PageLoader, SectionTitle, Stat, Tabs, cx, suiscan, usdc, ScrollArea, FitText } from "@/components/ui";
import { YourNames } from "@/components/ens";
import { SignInButtons } from "@/components/shell";

const leaseTone = (s: string) => (s === "live" || s === "completed" ? "ok" : s === "pending_approval" || s === "awaiting_install" ? "warn" : s === "disputed" ? "bad" : "neutral");
const money = (atomic: any, d = 2) => <AnimatedNumber value={Number(atomic ?? 0) / 1e6} format={(n) => `${n.toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d })} USDC`} />;

function Row({ href, children, testId, className }: { href: string; children: React.ReactNode; testId?: string; className?: string }) {
  return (
    <Link href={href} data-testid={testId} className={cx("group flex items-center justify-between gap-3 rounded-2xl border border-line bg-white/[0.02] p-3 text-sm transition-[border-color,background-color] duration-300 hover:border-p/40 hover:bg-p/[0.05]", className)}>
      {children}
      <ArrowUpRight className="h-4 w-4 shrink-0 text-faint transition-all duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-p" />
    </Link>
  );
}

function Urgent({ icon: Icon, title, children }: { icon: any; title: string; children: React.ReactNode }) {
  return (
    <Card className="ring-spin overflow-hidden">
      <div aria-hidden className="absolute -right-16 -top-16 h-40 w-40 rounded-full bg-p/15 blur-3xl" />
      <SectionTitle>
        <span className="flex items-center gap-2">
          <span className="relative grid h-8 w-8 place-items-center rounded-xl bg-p text-ink">
            <Icon className="h-4 w-4" />
            <span className="absolute inset-0 animate-ping rounded-xl bg-p/40" />
          </span>
          {title}
        </span>
      </SectionTitle>
      <div className="relative space-y-2">{children}</div>
    </Card>
  );
}

export default function Dashboard() {
  const { authenticated, api, ready, me } = useSession();
  const [tab, setTab] = useState<"owner" | "advertiser" | "investor">("owner");
  const isBrand = me?.user?.account_type === "brand";
  // Brands only buy ads, so their dashboard is the advertiser view.
  useEffect(() => {
    if (isBrand && tab !== "advertiser") setTab("advertiser");
  }, [isBrand, tab]);
  const { data, isLoading } = useQuery({ queryKey: ["dashboard"], queryFn: () => api<any>("/api/dashboard"), enabled: authenticated, refetchInterval: 20000 });
  const { data: pf } = useQuery({ queryKey: ["portfolio"], queryFn: () => api<any>("/api/portfolio"), enabled: authenticated && tab === "investor" });
  if (ready && !authenticated)
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <Empty title="Sign in to see your dashboard">Your objects, leases, earnings and holdings, all in one place.</Empty>
        <div className="mt-6 flex justify-center"><SignInButtons /></div>
      </div>
    );
  if (isLoading || !data) return <PageLoader label="Loading your dashboard" />;
  const o = data.owner, a = data.advertiser;
  const name = me?.user?.display_name ?? me?.user?.handle ?? "there";
  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6">
      <PageHeader kicker="Dashboard" title={`Welcome back, ${name}`} sub="Everything you own, lease and hold, updated live from Sui." actions={isBrand ? undefined : <Tabs value={tab} onChange={setTab} tabs={[{ id: "owner", label: "Owner" }, { id: "advertiser", label: "Advertiser" }, { id: "investor", label: "Investor" }]} />} />
      <AnimatePresence mode="wait">
        <motion.div key={tab} initial={{ opacity: 0, y: 16, filter: "blur(6px)" }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }} exit={{ opacity: 0, y: -10, filter: "blur(6px)" }} transition={{ duration: 0.45, ease: EASE }}>
          {tab === "owner" && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <Stat label="Earned" value={money(o.totals.earned)} />
                <Stat label="Active leases" value={<AnimatedNumber value={o.totals.activeLeases} />} delay={0.05} />
                <Stat label="Objects" value={<AnimatedNumber value={o.objects.length} />} delay={0.1} />
                <Stat label="Listed spaces" value={<AnimatedNumber value={o.spaces.filter((s: any) => s.status === "available").length} />} delay={0.15} />
              </div>
              {o.pendingApprovals.length > 0 && (
                <Urgent icon={BellRing} title="Lease requests to approve">
                  {o.pendingApprovals.map((l: any) => (
                    <Row key={l.escrow_id} href={`/leases/${l.escrow_id}`} testId="pending-approval">
                      <span className="flex min-w-0 items-center gap-3">
                        <span className="checker h-10 w-10 shrink-0 overflow-hidden rounded-xl"><Img blob={l.creative_blob_id} alt="" className="h-full w-full object-contain" /></span>
                        <span className="min-w-0 truncate"><b>{l.brand}</b> wants <b>{l.spaces.label}</b> for {l.weeks} week(s) · <span className="text-p">{usdc(l.total_paid)}</span></span>
                      </span>
                      <Badge tone="warn">by {new Date(Number(l.approve_deadline_ms)).toLocaleString()}</Badge>
                    </Row>
                  ))}
                </Urgent>
              )}
              {o.dueProofs.length > 0 && (
                <Urgent icon={Camera} title="Proofs due">
                  {o.dueProofs.map((p: any) => (
                    <Row key={p.escrowId} href={`/leases/${p.escrowId}`}>
                      <span className="min-w-0 truncate">{p.lease.spaces.label} · {p.period === 0 ? "install proof" : `period ${p.period}`} · <span className="text-muted">{p.lease.brand}</span></span>
                      <Badge tone={p.dueNow ? "warn" : "neutral"}>{p.dueNow ? `due by ${new Date(p.close).toLocaleString()}` : `opens ${new Date(p.open).toLocaleString()}`}</Badge>
                    </Row>
                  ))}
                </Urgent>
              )}
              <div>
                <SectionTitle action={<LinkButton href="/list" size="sm"><Plus className="h-3.5 w-3.5" /> List object</LinkButton>}>Your objects</SectionTitle>
                {!o.objects.length ? (
                  <Empty title="Nothing listed yet">List your laptop, car, helmet or shop window and let brands find it.</Empty>
                ) : (
                  <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                    {o.objects.map((x: any, i: number) => {
                      const sp = o.spaces.filter((s: any) => s.object_id === x.id);
                      return (
                        <motion.div key={x.id} initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06, duration: 0.6, ease: EASE }}>
                          <Link href={`/objects/${x.id}`} className="group block overflow-hidden rounded-3xl border border-line bg-white/[0.03] transition-[border-color,transform] duration-300 hover:-translate-y-1 hover:border-p/50" data-testid="my-object">
                            <div className="relative overflow-hidden">
                              <Img blob={x.hero_blob_id} alt={x.title} className="aspect-[16/10] w-full transition-transform duration-700 group-hover:scale-110" />
                              <div className="absolute inset-0 bg-gradient-to-t from-ink/80 to-transparent" />
                              {x.object_grade > 0 && <div className="absolute right-3 top-3"><GradeBadge grade={x.object_grade} aqs={x.object_aqs} size="sm" /></div>}
                            </div>
                            <div className="p-4">
                              <div className="font-bold">{x.title}</div>
                              <div className="mt-1 flex items-center gap-2 text-sm text-muted">
                                <span>{sp.length} spaces</span>
                                <span className="h-1 w-1 rounded-full bg-faint" />
                                <span className="text-p">{sp.filter((s: any) => s.active_leases > 0).length} leased</span>
                              </div>
                            </div>
                          </Link>
                        </motion.div>
                      );
                    })}
                  </div>
                )}
              </div>
              <YourNames api={api} />
              <Card>
                <SectionTitle>Earnings history</SectionTitle>
                {!o.earnings.length && <p className="text-sm text-muted">Payouts appear here as proofs are accepted.</p>}
                <ScrollArea max={340}><div className="space-y-1.5">
                  {o.earnings.map((t: any, i: number) => (
                    <motion.div key={t.id} initial={{ opacity: 0, x: -10 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.03 }} className="grid grid-cols-[1fr_auto_auto] items-center gap-4 rounded-2xl px-3 py-2.5 text-sm transition-colors hover:bg-white/[0.03] md:grid-cols-[170px_90px_1fr_auto_auto]">
                      <span className="text-muted">{new Date(t.created_at).toLocaleString()}</span>
                      <span className="hidden text-muted md:block">period {t.period}</span>
                      <span className="hidden text-xs text-muted md:block">{t.kind === "released" ? <>gross {usdc(t.gross)} · fee {usdc(t.platform_fee)} · investors {usdc(t.investor_share)}</> : <span className="text-white">refunded {usdc(t.gross)}</span>}</span>
                      <span className="text-right font-bold text-p">{t.kind === "released" ? `+${usdc(t.to_owner)}` : "—"}</span>
                      <a className="rounded-full bg-white/[0.06] px-2.5 py-0.5 text-[11px] font-bold text-white/70 hover:bg-p hover:text-ink" href={suiscan("tx", t.digest)} target="_blank" rel="noreferrer">tx</a>
                    </motion.div>
                  ))}
                </div></ScrollArea>
              </Card>
              <Card>
                <SectionTitle>All leases on your spaces</SectionTitle>
                {!o.leases.length && <p className="text-sm text-muted">No leases yet.</p>}
                <ScrollArea max={360}><div className="space-y-2">
                  {o.leases.map((l: any) => (
                    <Row key={l.escrow_id} href={`/leases/${l.escrow_id}`}>
                      <span className="min-w-0 truncate">{l.spaces.label} · {l.brand} · {l.weeks}w</span>
                      <Badge tone={leaseTone(l.status) as any}>{l.status}</Badge>
                    </Row>
                  ))}
                </div></ScrollArea>
              </Card>
            </div>
          )}
          {tab === "advertiser" && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <Stat label="Spent" value={money(a.totals.spent)} />
                <Stat label="Released to owners" value={money(a.totals.released)} delay={0.05} />
                <Stat label="Refunded" value={money(a.totals.refunded)} delay={0.1} />
                <Stat label="Link clicks" value={<AnimatedNumber value={a.totals.clicks} />} delay={0.15} />
              </div>
              <Card>
                <SectionTitle action={<LinkButton href="/explore" variant="secondary" size="sm">Find spaces</LinkButton>}>Your leases</SectionTitle>
                {!a.leases.length && <p className="text-sm text-muted">No leases yet. Explore the marketplace.</p>}
                <ScrollArea max={380}><div className="space-y-2">
                  {a.leases.map((l: any) => (
                    <Row key={l.escrow_id} href={`/leases/${l.escrow_id}`} testId="adv-lease">
                      <span className="flex min-w-0 items-center gap-3">
                        <Img blob={l.spaces.closeup_blob_id} alt="" className="h-10 w-10 shrink-0 rounded-xl" />
                        <span className="min-w-0 truncate"><b>{l.spaces.label}</b> · {l.weeks}w · <span className="text-p">{usdc(l.total_paid)}</span> · {l.clicks} clicks</span>
                      </span>
                      <Badge tone={leaseTone(l.status) as any}>{l.status}</Badge>
                    </Row>
                  ))}
                </div></ScrollArea>
              </Card>
              <Card>
                <SectionTitle><span className="flex items-center gap-2"><Clock className="h-4 w-4 text-p" /> Proof timeline</span></SectionTitle>
                {!a.proofs.length && <p className="text-sm text-muted">Owners&apos; proof photos appear here.</p>}
                <ScrollArea max={300}><div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
                  {a.proofs.map((p: any, i: number) => (
                    <motion.div key={p.id} initial={{ opacity: 0, scale: 0.85 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} transition={{ delay: i * 0.04 }}>
                      <Link href={`/leases/${p.escrow_id}`} className="group block">
                        <div className="overflow-hidden rounded-2xl border border-line"><Img blob={p.photo_blob_id} alt="proof" className="aspect-square w-full transition-transform duration-500 group-hover:scale-110" /></div>
                        <div className="mt-1.5 text-[11px] text-muted">{new Date(p.created_at).toLocaleString()}</div>
                      </Link>
                    </motion.div>
                  ))}
                </div></ScrollArea>
              </Card>
              <Card>
                <SectionTitle action={<LinkButton href="/brand-kit" variant="secondary" size="sm">Manage</LinkButton>}>Brand kit</SectionTitle>
                <div className="flex flex-wrap gap-3">
                  {!a.brandAssets.length && <p className="text-sm text-muted">Upload logos and creatives to lease spaces faster.</p>}
                  {a.brandAssets.slice(0, 8).map((x: any, i: number) => (
                    <motion.div key={x.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="checker h-16 w-16 overflow-hidden rounded-2xl">
                      <Img blob={x.blob_id} alt={x.name} className="h-full w-full object-contain" />
                    </motion.div>
                  ))}
                </div>
              </Card>
            </div>
          )}
          {tab === "investor" && (
            <div className="space-y-5">
              {!pf ? (
                <PageLoader label="Loading portfolio" />
              ) : !pf.holdings.length ? (
                <Empty title="No holdings yet">
                  Browse <Link className="font-semibold text-p underline" href="/offerings">offerings</Link> or the <Link className="font-semibold text-p underline" href="/trade">market</Link> to invest in ad income.
                </Empty>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
                    <Stat label="Invested (cost)" value={usdc(pf.totals.cost, 4)} />
                    <Stat label="Market value" value={usdc(pf.totals.value, 4)} delay={0.05} />
                    <Stat label="Income earned" value={usdc(pf.totals.income, 4)} sub={`${usdc(pf.totals.claimable, 4)} claimable`} delay={0.1} />
                    <Stat label="Net P&L" value={<span className={pf.totals.value + pf.totals.income - pf.totals.cost >= 0 ? "text-p" : "text-white"}>{usdc(pf.totals.value + pf.totals.income - pf.totals.cost, 4)}</span>} delay={0.15} />
                    <Stat label="Open orders" value={pf.openOrders.bids.length + pf.openOrders.asks.length} sub={`${pf.openOrders.bids.length} bids · ${pf.openOrders.asks.length} asks`} delay={0.2} />
                  </div>
                  {pf.holdings.map((h: any, i: number) => (
                    <motion.div key={h.offering_id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06, duration: 0.6, ease: EASE }}>
                      <Link href={`/offerings/${h.offering_id}`} className="group block rounded-3xl border border-line bg-white/[0.03] p-5 transition-colors hover:border-p/50" data-testid="holding">
                        <div className="flex items-center justify-between gap-3">
                          <span className="flex min-w-0 items-center gap-3">
                            <Img blob={h.offerings.spaces.closeup_blob_id} alt="" className="h-14 w-14 shrink-0 rounded-2xl" />
                            <span className="min-w-0">
                              <div className="font-bold">{h.offerings.spaces.label}</div>
                              <div className="truncate text-sm text-muted">{(h.onchain?.units ?? h.units) + (h.onchain?.listed ?? h.listed_units)} units{(h.onchain?.listed ?? h.listed_units) > 0 && ` (${h.onchain?.listed ?? h.listed_units} listed)`} · last {(h.pnl.lastPrice / 1e6).toFixed(6)} USDC</div>
                            </span>
                          </span>
                          <span className="rounded-2xl bg-p/10 px-3 py-2 text-right">
                            <div className="font-extrabold text-p">{usdc(h.onchain?.claimable ?? 0, 4)}</div>
                            <div className="text-[11px] text-muted">claimable</div>
                          </span>
                        </div>
                        <div className="mt-4 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                          {[["Cost", usdc(h.pnl.cost, 4)], ["Value", usdc(h.pnl.value, 4)], ["Income", usdc(h.pnl.income, 4)]].map(([k, v]) => (
                            <div key={k} className="rounded-xl bg-white/[0.03] p-2.5"><div className="text-muted">{k}</div><FitText max={14} min={10} className="mt-0.5 font-bold tabular-nums">{v}</FitText></div>
                          ))}
                          <div className="rounded-xl bg-white/[0.03] p-2.5"><div className="text-muted">Net</div><FitText max={14} min={10} className={`mt-0.5 font-bold tabular-nums ${h.pnl.net >= 0 ? "text-p" : "text-white"}`}>{usdc(h.pnl.net, 4)}{h.pnl.netPct != null && ` (${h.pnl.netPct.toFixed(1)}%)`}</FitText></div>
                        </div>
                      </Link>
                    </motion.div>
                  ))}
                  {(pf.openOrders.bids.length > 0 || pf.openOrders.asks.length > 0) && (
                    <Card>
                      <SectionTitle>Open orders</SectionTitle>
                      <ScrollArea max={300}><div className="space-y-2">
                        {[...pf.openOrders.bids.map((b: any) => ({ ...b, side: "Bid" })), ...pf.openOrders.asks.map((x: any) => ({ ...x, side: "Ask" }))].map((x: any) => (
                          <Row key={x.id} href={`/offerings/${x.offering_id}`}>
                            <span className="flex min-w-0 items-center gap-2 truncate"><Badge tone={x.side === "Bid" ? "ok" : "neutral"}>{x.side}</Badge> {x.offerings?.spaces?.label} · {x.units} units @ {(Number(x.price_per_unit) / 1e6).toFixed(6)}</span>
                            <span className="shrink-0 text-xs text-muted">{Number(x.expires_ms) > 0 ? `expires ${new Date(Number(x.expires_ms)).toLocaleString()}` : "good till cancelled"}</span>
                          </Row>
                        ))}
                      </div></ScrollArea>
                    </Card>
                  )}
                </>
              )}
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
