"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "@/lib/client/session";
import { categoryByKey } from "@/lib/categories";
import { AqsPanel } from "@/components/aqs";
import { ActivityFeed } from "@/components/activity";
import { Checkout, weekLabel } from "@/components/checkout";
import { VerifyPanel } from "@/components/verify";
import { SpaceCard } from "@/components/space-card";
import { Badge, Button, Card, Empty, GradeBadge, Img, LinkButton, Spinner, shortAddr, usdc, useAction } from "@/components/ui";
import { SignInButtons } from "@/components/shell";

function SpaceView({ d }: { d: any }) {
  const s = d.space, o = d.object;
  const { authenticated, api, address } = useSession();
  const router = useRouter();
  const [checkout, setCheckout] = useState(false);
  const { busy, run } = useAction();
  const cat = categoryByKey(o.category);
  const mine = address === s.owner_address;
  const weekMs = Number(s.week_ms);
  const current = Math.floor(Date.now() / weekMs);
  const booked = new Set<number>(d.bookedWeeks);
  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-4 text-sm text-muted">
        <Link href="/" className="underline">Explore</Link> / <Link href={`/${o.ens_name}`} className="underline">{o.title}</Link> / {s.label}
      </div>
      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-[2fr_1fr]">
            <Img blob={s.closeup_blob_id} alt={s.label} className="aspect-[4/3] w-full rounded-2xl" />
            <div className="grid gap-3">
              <Img blob={o.hero_blob_id} alt={o.title} className="aspect-[4/3] w-full rounded-2xl" />
              <div className="rounded-2xl border border-line bg-surface p-3 text-xs text-muted">Left: the ad space close-up. Above: the whole object.</div>
            </div>
          </div>
          <Card>
            <h2 className="mb-4 font-semibold">Ad-Space Quality Score</h2>
            <AqsPanel r={{ aqs: s.aqs, grade: s.grade, confidence: s.confidence_bps / 10000, subscores: s.subscores ?? {}, strengths: s.strengths, weaknesses: s.weaknesses }} />
            <p className="mt-3 text-xs text-muted">
              Scored by {s.rubric_version} ·{" "}
              {s.report_blob_id && (
                <a className="underline" href={`https://aggregator.walrus-testnet.walrus.space/v1/blobs/${s.report_blob_id}`} target="_blank" rel="noreferrer">
                  full AI report on Walrus
                </a>
              )}
            </p>
          </Card>
          <Card>
            <h2 className="mb-3 font-semibold">Availability</h2>
            <div className="flex flex-wrap gap-1.5">
              {Array.from({ length: 20 }, (_, i) => current + i).map((w) => (
                <span key={w} className={`rounded-lg px-2 py-1 text-xs ${booked.has(w) ? "bg-black/10 text-muted line-through" : "bg-emerald-50 text-emerald-800"}`}>
                  {weekLabel(w, weekMs)}
                </span>
              ))}
            </div>
          </Card>
          {d.proofs.length > 0 && (
            <Card>
              <h2 className="mb-3 font-semibold">Proof of display</h2>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                {d.proofs.map((p: any) => (
                  <Img key={p.photo_blob_id} blob={p.photo_blob_id} alt={`proof ${p.period}`} className="aspect-square w-full rounded-lg" />
                ))}
              </div>
            </Card>
          )}
          {d.leases.length > 0 && (
            <Card>
              <h2 className="mb-3 font-semibold">Lease history</h2>
              <div className="space-y-2 text-sm">
                {d.leases.map((l: any) => (
                  <Link key={l.escrow_id} href={`/leases/${l.escrow_id}`} className="flex items-center justify-between rounded-xl border border-line p-3 hover:border-violet-300">
                    <span className="flex items-center gap-2">
                      <Img blob={l.creative_blob_id} alt="" className="h-8 w-8 rounded object-contain" />
                      <b>{l.brand}</b> · {l.weeks} week(s) from {new Date(Number(l.start_ms)).toLocaleDateString()}
                    </span>
                    <Badge>{l.status.replace("_", " ")}</Badge>
                  </Link>
                ))}
              </div>
            </Card>
          )}
          <ActivityFeed items={d.activity} />
        </div>
        <div className="space-y-4">
          <Card className="space-y-3">
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-2xl font-semibold">{s.label}</h1>
                <div className="text-sm text-muted">
                  {cat.emoji} {o.title}
                  {o.city ? ` · ${o.city}` : ""}
                </div>
              </div>
              <GradeBadge grade={s.grade} aqs={s.aqs} />
            </div>
            <div className="font-mono text-xs text-brand">{s.ens_name}</div>
            <dl className="grid grid-cols-2 gap-2 text-sm">
              <dt className="text-muted">Size</dt>
              <dd>{s.width_mm / 10} × {s.height_mm / 10} cm</dd>
              <dt className="text-muted">Placement</dt>
              <dd>{s.placement}</dd>
              <dt className="text-muted">Surface</dt>
              <dd>{s.material ?? "—"}</dd>
              <dt className="text-muted">Not allowed here</dt>
              <dd>{cat.prohibited}</dd>
            </dl>
            <div className="rounded-xl bg-black/[0.03] p-3">
              <div className="text-2xl font-semibold">{usdc(s.price_per_week)}</div>
              <div className="text-xs text-muted">per {weekMs < 86400_000 ? `${weekMs / 60000}-minute demo week` : "week"} · fixed price set by the owner</div>
            </div>
            {s.status !== "available" ? (
              <Badge tone="warn">This space is {s.status}</Badge>
            ) : mine ? (
              <LinkButton href={`/objects/${o.id}`} variant="secondary" className="w-full">
                Manage this object
              </LinkButton>
            ) : authenticated ? (
              <div className="space-y-2">
                <Button className="w-full" size="lg" onClick={() => setCheckout(true)} data-testid="lease">
                  Lease this space
                </Button>
                <Button variant="secondary" className="w-full" loading={busy === "msg"} onClick={() => run("msg", async () => { const r = await api<any>("/api/conversations", { method: "POST", json: { spaceId: s.id } }); router.push(`/messages/${r.id}`); })}>
                  Message owner
                </Button>
              </div>
            ) : (
              <SignInButtons />
            )}
          </Card>
          <Card>
            <div className="text-sm font-semibold">Owner</div>
            <Link href={`/${d.owner.ens_name ?? ""}`} className="mt-2 flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br from-violet-600 to-amber-400 font-bold text-white">{(d.owner.handle ?? "?")[0]?.toUpperCase()}</span>
              <div>
                <div className="font-medium">{d.owner.display_name ?? d.owner.handle ?? shortAddr(d.owner.address)}</div>
                <div className="font-mono text-xs text-muted">{d.owner.ens_name}</div>
              </div>
            </Link>
            <div className="mt-2 text-xs text-muted">
              {d.owner.completedLeases} completed leases · {d.owner.acceptedProofs} accepted proofs
            </div>
          </Card>
          {d.offering && (
            <Card>
              <div className="flex items-center justify-between">
                <div className="font-semibold">Tokenised</div>
                <Badge tone="brand">{d.offering.status}</Badge>
              </div>
              <p className="mt-1 text-sm text-muted">
                {(d.offering.revenue_share_bps / 100).toFixed(0)}% of this space&apos;s lease revenue is split across 10,000 units.
              </p>
              <LinkButton href={`/offerings/${d.offering.id}`} variant="secondary" className="mt-3 w-full">
                View offering
              </LinkButton>
            </Card>
          )}
          <VerifyPanel name={s.ens_name} suiId={s.id} v={d.verification} ens={d.ens} />
          <Card>
            <div className="text-sm font-semibold">For AI agents</div>
            <p className="mt-1 text-xs text-muted">Lease this space over x402 (USDC on sui:testnet):</p>
            <pre className="mt-2 overflow-x-auto rounded-lg bg-foreground p-3 text-[11px] text-white">{`POST /api/x402/leases
{"spaceId":"${s.id.slice(0, 10)}…","weeks":1,
 "creativeUrl":"https://…","landingUrl":"https://…","brand":"…"}`}</pre>
          </Card>
          {d.siblings.length > 0 && (
            <div>
              <div className="mb-2 text-sm font-semibold">More spaces on this {cat.label.toLowerCase()}</div>
              <div className="grid gap-3">
                {d.siblings.slice(0, 3).map((x: any) => (
                  <SpaceCard key={x.id} s={{ ...x, week_ms: s.week_ms, object: o, width_mm: x.width_mm ?? 0, height_mm: x.height_mm ?? 0 }} />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
      {checkout && <Checkout space={s} booked={d.bookedWeeks} onClose={() => setCheckout(false)} />}
    </div>
  );
}

function ObjectView({ d }: { d: any }) {
  const o = d.object;
  const cat = categoryByKey(o.category);
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="grid gap-6 md:grid-cols-[380px_1fr]">
        <div className="space-y-4">
          <Card className="overflow-hidden p-0">
            <Img blob={o.hero_blob_id} alt={o.title} className="aspect-[4/3] w-full" />
            <div className="space-y-1 p-5">
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-semibold">{o.title}</h1>
                {o.object_grade > 0 && <GradeBadge grade={o.object_grade} aqs={o.object_aqs} size="sm" />}
              </div>
              <div className="text-sm text-muted">
                {cat.emoji} {cat.label} {o.city && `· ${o.city}`} · by <Link className="underline" href={`/${o.owner?.ens_name}`}>{o.owner?.ens_name}</Link>
              </div>
              {o.sponsored_until && new Date(o.sponsored_until).getTime() > Date.now() && <Badge tone="sponsored">Sponsored</Badge>}
              {o.description && <p className="pt-2 text-sm">{o.description}</p>}
            </div>
          </Card>
          <VerifyPanel name={o.ens_name} suiId={o.id} v={d.verification} ens={d.ens} />
        </div>
        <div>
          <h2 className="mb-3 text-lg font-semibold">Ad spaces</h2>
          {!d.spaces.length && <Empty title="No spaces listed yet" />}
          <div className="grid gap-4 sm:grid-cols-2">
            {d.spaces.map((s: any) => (
              <SpaceCard key={s.id} s={{ ...s, object: o }} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function AccountView({ d }: { d: any }) {
  const u = d.user;
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="grid gap-6 md:grid-cols-[320px_1fr]">
        <div className="space-y-4">
          <Card>
            <div className="grid h-16 w-16 place-items-center rounded-full bg-gradient-to-br from-violet-600 to-amber-400 text-2xl font-bold text-white">{(u.handle ?? "?")[0]?.toUpperCase()}</div>
            <h1 className="mt-3 text-xl font-semibold">{u.display_name ?? u.handle}</h1>
            <div className="font-mono text-xs text-brand">{u.ens_name}</div>
            {u.brand_name && <Badge tone="brand" className="mt-2">Advertiser · {u.brand_name}</Badge>}
            {u.bio && <p className="mt-3 text-sm">{u.bio}</p>}
            <div className="mt-3 text-xs text-muted">
              {d.reputation.completedLeases} completed leases · member since {new Date(u.created_at).toLocaleDateString()}
            </div>
            {u.twitter && <div className="mt-1 text-xs">𝕏 @{u.twitter.replace(/^@/, "")}</div>}
            {u.website && <a className="mt-1 block text-xs underline" href={u.website}>{u.website}</a>}
          </Card>
          <VerifyPanel name={u.ens_name} suiId={u.profile_id} v={d.verification} ens={d.ens} />
        </div>
        <div>
          <h2 className="mb-3 text-lg font-semibold">Objects</h2>
          {!d.objects.length && <Empty title="No objects listed yet" />}
          <div className="grid gap-4 sm:grid-cols-2">
            {d.objects.map((o: any) => (
              <Link key={o.id} href={`/${o.ens_name}`} className="overflow-hidden rounded-2xl border border-line bg-surface hover:shadow-md">
                <Img blob={o.hero_blob_id} alt={o.title} className="aspect-[16/10] w-full" />
                <div className="p-4">
                  <div className="font-semibold">{o.title}</div>
                  <div className="text-sm text-muted">{d.spaces.filter((s: any) => s.object_id === o.id).length} spaces · <span className="font-mono">{o.ens_name}</span></div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function LeaseView({ d }: { d: any }) {
  const l = d.lease;
  return (
    <div className="mx-auto max-w-3xl px-4 py-8 space-y-4">
      <Card>
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold">{l.brand} on {d.spaceName}</h1>
          <Badge>{l.status}</Badge>
        </div>
        <Img blob={l.creative_blob_id} alt="creative" className="mt-4 max-h-64 w-full rounded-xl object-contain" />
        <p className="mt-3 text-sm text-muted">
          {l.weeks} week(s) from {new Date(Number(l.start_ms)).toLocaleString()} · {usdc(l.total_paid)}
        </p>
        <LinkButton href={`/leases/${l.escrow_id}`} className="mt-3">
          Open lease
        </LinkButton>
      </Card>
      <VerifyPanel name={`${l.ens_label}.${d.spaceName}`} suiId={l.escrow_id} v={d.verification} ens={d.ens} />
    </div>
  );
}

export default function NamePage({ params }: { params: Promise<{ name: string }> }) {
  const { name } = use(params);
  const n = decodeURIComponent(name);
  const { data, isLoading, error } = useQuery({
    queryKey: ["name", n],
    queryFn: async () => {
      const r = await fetch(`/api/names/${encodeURIComponent(n)}?live=0`);
      if (!r.ok) throw new Error((await r.json()).error);
      return r.json();
    },
    enabled: n.endsWith(".brandmystuff.eth"),
  });
  const { data: live } = useQuery({
    queryKey: ["name-live", n],
    queryFn: () => fetch(`/api/names/${encodeURIComponent(n)}`).then((r) => r.json()),
    enabled: !!data,
  });
  if (!n.endsWith(".brandmystuff.eth")) return <div className="p-10"><Empty title="Page not found" /></div>;
  if (isLoading) return <div className="grid place-items-center py-24"><Spinner /></div>;
  if (error || !data) return <div className="p-10"><Empty title={(error as Error)?.message ?? "Not found"} /></div>;
  const d = { ...data, verification: live?.verification ?? null };
  if (data.kind === "space") return <SpaceView d={d} />;
  if (data.kind === "object") return <ObjectView d={d} />;
  if (data.kind === "account") return <AccountView d={d} />;
  return <LeaseView d={d} />;
}
