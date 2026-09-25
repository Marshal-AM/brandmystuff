"use client";
import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "@/lib/client/session";
import { Badge, Card, Empty, GradeBadge, Img, LinkButton, Spinner, Stat, Tabs, suiscan, usdc } from "@/components/ui";
import { SignInButtons } from "@/components/shell";

const leaseTone = (s: string) => (s === "live" || s === "completed" ? "ok" : s === "pending_approval" || s === "awaiting_install" ? "warn" : s === "disputed" ? "bad" : "neutral");

export default function Dashboard() {
  const { authenticated, api, ready } = useSession();
  const [tab, setTab] = useState<"owner" | "advertiser" | "investor">("owner");
  const { data, isLoading } = useQuery({ queryKey: ["dashboard"], queryFn: () => api<any>("/api/dashboard"), enabled: authenticated, refetchInterval: 20000 });
  const { data: pf } = useQuery({ queryKey: ["portfolio"], queryFn: () => api<any>("/api/portfolio"), enabled: authenticated && tab === "investor" });
  if (ready && !authenticated) return <div className="grid place-items-center py-24"><SignInButtons /></div>;
  if (isLoading || !data) return <div className="grid place-items-center py-24"><Spinner /></div>;
  const o = data.owner, a = data.advertiser;
  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-semibold">Dashboard</h1>
        <Tabs value={tab} onChange={setTab} tabs={[{ id: "owner", label: "Owner" }, { id: "advertiser", label: "Advertiser" }, { id: "investor", label: "Investor" }]} />
      </div>
      {tab === "owner" && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label="Earned" value={usdc(o.totals.earned)} />
            <Stat label="Active leases" value={o.totals.activeLeases} />
            <Stat label="Objects" value={o.objects.length} />
            <Stat label="Listed spaces" value={o.spaces.filter((s: any) => s.status === "available").length} />
          </div>
          {o.pendingApprovals.length > 0 && (
            <Card>
              <h2 className="mb-3 font-semibold">Lease requests to approve</h2>
              {o.pendingApprovals.map((l: any) => (
                <Link key={l.escrow_id} href={`/leases/${l.escrow_id}`} className="flex items-center justify-between rounded-xl border border-line p-3 hover:border-violet-300" data-testid="pending-approval">
                  <span className="flex items-center gap-3">
                    <Img blob={l.creative_blob_id} alt="" className="h-10 w-10 rounded bg-white object-contain" />
                    <span><b>{l.brand}</b> wants <b>{l.spaces.label}</b> for {l.weeks} week(s) · {usdc(l.total_paid)}</span>
                  </span>
                  <Badge tone="warn">approve by {new Date(Number(l.approve_deadline_ms)).toLocaleString()}</Badge>
                </Link>
              ))}
            </Card>
          )}
          {o.dueProofs.length > 0 && (
            <Card>
              <h2 className="mb-3 font-semibold">Proofs due</h2>
              <div className="space-y-2">
                {o.dueProofs.map((p: any) => (
                  <Link key={p.escrowId} href={`/leases/${p.escrowId}`} className="flex items-center justify-between rounded-xl border border-line p-3 hover:border-violet-300">
                    <span>{p.lease.spaces.label} · {p.period === 0 ? "install proof" : `period ${p.period}`} · {p.lease.brand}</span>
                    <Badge tone={p.dueNow ? "warn" : "neutral"}>{p.dueNow ? `due by ${new Date(p.close).toLocaleString()}` : `opens ${new Date(p.open).toLocaleString()}`}</Badge>
                  </Link>
                ))}
              </div>
            </Card>
          )}
          <div>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-semibold">Your objects</h2>
              <LinkButton href="/list">+ List object</LinkButton>
            </div>
            {!o.objects.length ? (
              <Empty title="Nothing listed yet">List your laptop, car, helmet or shop window.</Empty>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {o.objects.map((x: any) => {
                  const sp = o.spaces.filter((s: any) => s.object_id === x.id);
                  return (
                    <Link key={x.id} href={`/objects/${x.id}`} className="overflow-hidden rounded-2xl border border-line bg-surface hover:shadow-md" data-testid="my-object">
                      <Img blob={x.hero_blob_id} alt={x.title} className="aspect-[16/10] w-full" />
                      <div className="p-4">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold">{x.title}</span>
                          {x.object_grade > 0 && <GradeBadge grade={x.object_grade} aqs={x.object_aqs} size="sm" />}
                        </div>
                        <div className="text-sm text-muted">{sp.length} spaces · {sp.filter((s: any) => s.active_leases > 0).length} leased</div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
          <Card>
            <h2 className="mb-3 font-semibold">Earnings history</h2>
            {!o.earnings.length && <p className="text-sm text-muted">Payouts appear here as proofs are accepted.</p>}
            <table className="w-full text-sm">
              <tbody>
                {o.earnings.map((t: any) => (
                  <tr key={t.id} className="border-b border-line last:border-0">
                    <td className="py-2">{new Date(t.created_at).toLocaleString()}</td>
                    <td>period {t.period}</td>
                    <td>{t.kind === "released" ? <>gross {usdc(t.gross)} · fee {usdc(t.platform_fee)} · investors {usdc(t.investor_share)}</> : <span className="text-bad">refunded {usdc(t.gross)}</span>}</td>
                    <td className="text-right font-medium">{t.kind === "released" ? usdc(t.to_owner) : "—"}</td>
                    <td className="text-right"><a className="text-brand underline" href={suiscan("tx", t.digest)} target="_blank" rel="noreferrer">tx</a></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
          <Card>
            <h2 className="mb-3 font-semibold">All leases on your spaces</h2>
            {!o.leases.length && <p className="text-sm text-muted">No leases yet.</p>}
            {o.leases.map((l: any) => (
              <Link key={l.escrow_id} href={`/leases/${l.escrow_id}`} className="flex items-center justify-between border-b border-line py-2 text-sm last:border-0">
                <span>{l.spaces.label} · {l.brand} · {l.weeks}w</span>
                <Badge tone={leaseTone(l.status) as any}>{l.status}</Badge>
              </Link>
            ))}
          </Card>
        </div>
      )}
      {tab === "advertiser" && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label="Spent" value={usdc(a.totals.spent)} />
            <Stat label="Released to owners" value={usdc(a.totals.released)} />
            <Stat label="Refunded" value={usdc(a.totals.refunded)} />
            <Stat label="Link clicks" value={a.totals.clicks} />
          </div>
          <Card>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-semibold">Your leases</h2>
              <LinkButton href="/" variant="secondary">Find spaces</LinkButton>
            </div>
            {!a.leases.length && <p className="text-sm text-muted">No leases yet — explore the marketplace.</p>}
            {a.leases.map((l: any) => (
              <Link key={l.escrow_id} href={`/leases/${l.escrow_id}`} className="flex items-center justify-between border-b border-line py-3 text-sm last:border-0" data-testid="adv-lease">
                <span className="flex items-center gap-3">
                  <Img blob={l.spaces.closeup_blob_id} alt="" className="h-10 w-10 rounded" />
                  <span><b>{l.spaces.label}</b> · {l.weeks}w · {usdc(l.total_paid)} · {l.clicks} clicks</span>
                </span>
                <Badge tone={leaseTone(l.status) as any}>{l.status}</Badge>
              </Link>
            ))}
          </Card>
          <Card>
            <h2 className="mb-3 font-semibold">Proof timeline</h2>
            {!a.proofs.length && <p className="text-sm text-muted">Owners&apos; proof photos appear here.</p>}
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
              {a.proofs.map((p: any) => (
                <Link key={p.id} href={`/leases/${p.escrow_id}`}>
                  <Img blob={p.photo_blob_id} alt="proof" className="aspect-square w-full rounded-lg" />
                  <div className="mt-1 text-[11px] text-muted">{new Date(p.created_at).toLocaleString()}</div>
                </Link>
              ))}
            </div>
          </Card>
          <Card>
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Brand kit</h2>
              <LinkButton href="/brand-kit" variant="secondary">Manage</LinkButton>
            </div>
            <div className="mt-3 flex gap-2">
              {a.brandAssets.slice(0, 8).map((x: any) => (
                <Img key={x.id} blob={x.blob_id} alt={x.name} className="h-16 w-16 rounded-lg bg-white object-contain" />
              ))}
            </div>
          </Card>
        </div>
      )}
      {tab === "investor" && (
        <div className="space-y-4">
          {!pf ? <Spinner /> : !pf.holdings.length ? (
            <Empty title="No holdings yet">Browse <Link className="underline" href="/offerings">offerings</Link> to invest in ad income.</Empty>
          ) : (
            pf.holdings.map((h: any) => (
              <Link key={h.offering_id} href={`/offerings/${h.offering_id}`} className="flex items-center justify-between rounded-2xl border border-line bg-surface p-4 hover:border-violet-300" data-testid="holding">
                <span className="flex items-center gap-3">
                  <Img blob={h.offerings.spaces.closeup_blob_id} alt="" className="h-12 w-12 rounded-lg" />
                  <span>
                    <div className="font-semibold">{h.offerings.spaces.label}</div>
                    <div className="text-sm text-muted">{h.onchain?.units ?? h.units} units · {h.onchain?.listed ?? h.listed_units} listed · paid {usdc(h.paid)} · claimed {usdc(h.claimed)}</div>
                  </span>
                </span>
                <span className="text-right">
                  <div className="font-semibold text-emerald-700">{usdc(h.onchain?.claimable ?? 0)}</div>
                  <div className="text-xs text-muted">claimable</div>
                </span>
              </Link>
            ))
          )}
        </div>
      )}
    </div>
  );
}
