"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, useScroll, useTransform } from "framer-motion";
import { CalendarDays, Camera, ChevronRight, Code2, Eye, Layers, MapPin, MessageCircle, Ruler, ShieldBan, Sparkles } from "lucide-react";
import { useSession } from "@/lib/client/session";
import { AqsPanel } from "@/components/aqs";
import { ActivityFeed } from "@/components/activity";
import { Checkout, weekLabel } from "@/components/checkout";
import { VerifyPanel } from "@/components/verify";
import { SpaceCard } from "@/components/space-card";
import { Badge, Button, Card, EASE, Empty, GradeBadge, Img, LinkButton, PageLoader, SectionTitle, cx, shortAddr, usdc, useAction, ScrollArea } from "@/components/ui";
import { EnsName } from "@/components/ens";
import { SignInButtons } from "@/components/shell";

function Crumbs({ items }: { items: { href?: string; label: string }[] }) {
  return (
    <motion.nav initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="mb-6 flex flex-wrap items-center gap-1.5 text-sm">
      {items.map((it, i) => (
        <span key={i} className="flex items-center gap-1.5">
          {it.href ? (
            <Link href={it.href} className="rounded-full px-2.5 py-1 text-muted transition-colors hover:bg-white/[0.06] hover:text-white">
              {it.label}
            </Link>
          ) : (
            <span className="rounded-full bg-p/10 px-2.5 py-1 font-semibold text-p">{it.label}</span>
          )}
          {i < items.length - 1 && <ChevronRight className="h-3.5 w-3.5 text-faint" />}
        </span>
      ))}
    </motion.nav>
  );
}

function Avatar({ letter, size = 40 }: { letter: string; size?: number }) {
  return (
    <span className="grid shrink-0 place-items-center rounded-full bg-gradient-to-br from-p-300 via-p to-p-700 font-extrabold text-ink" style={{ width: size, height: size, fontSize: size * 0.42 }}>
      {letter}
    </span>
  );
}

function Spec({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-line bg-white/[0.02] p-3">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-p" />
      <div className="min-w-0">
        <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-faint">{label}</div>
        <div className="truncate text-sm font-semibold">{value}</div>
      </div>
    </div>
  );
}

function Gallery({ closeup, hero, label, title }: { closeup?: string; hero?: string; label: string; title: string }) {
  const { scrollY } = useScroll();
  const y = useTransform(scrollY, [0, 600], [0, 60]);
  const scale = useTransform(scrollY, [0, 600], [1.04, 1.12]);
  return (
    <div className="relative">
      <motion.div initial={{ opacity: 0, scale: 0.97, filter: "blur(10px)" }} animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }} transition={{ duration: 0.9, ease: EASE }} className="relative aspect-[16/10] overflow-hidden rounded-[2rem] border border-line">
        <motion.div style={{ y, scale }} className="absolute inset-0">
          <Img blob={closeup} alt={label} className="h-full w-full" />
        </motion.div>
        <div className="absolute inset-0 bg-gradient-to-t from-ink/80 via-transparent to-ink/20" />
        <span className="absolute left-4 top-4 inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-ink/60 px-3 py-1.5 text-[11px] font-bold text-white/85 backdrop-blur-md">
          <Sparkles className="h-3.5 w-3.5 text-p" /> The ad space
        </span>
      </motion.div>
      <motion.div initial={{ opacity: 0, y: 30, rotate: 4 }} animate={{ opacity: 1, y: 0, rotate: -3 }} transition={{ duration: 0.9, delay: 0.35, type: "spring", stiffness: 120, damping: 14 }} whileHover={{ rotate: 0, scale: 1.04 }} className="absolute -bottom-6 right-4 w-[38%] max-w-[240px] overflow-hidden rounded-2xl border-4 border-p-950 shadow-[0_20px_60px_rgba(0,0,0,0.6)] sm:right-6">
        <Img blob={hero} alt={title} className="aspect-[4/3] w-full" />
        <span className="absolute bottom-2 left-2 rounded-full bg-ink/70 px-2 py-0.5 text-[10px] font-bold text-white/85 backdrop-blur">Whole object</span>
      </motion.div>
    </div>
  );
}

function SpaceView({ d }: { d: any }) {
  const s = d.space, o = d.object;
  const { authenticated, api, address } = useSession();
  const router = useRouter();
  const [checkout, setCheckout] = useState(false);
  const { busy, run } = useAction();
  const mine = address === s.owner_address;
  const weekMs = Number(s.week_ms);
  const current = Math.floor(Date.now() / weekMs);
  const booked = new Set<number>(d.bookedWeeks);
  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6">
      <Crumbs items={[{ href: "/explore", label: "Explore" }, { href: `/${o.ens_name}`, label: o.title }, { label: s.label }]} />
      <div className="grid gap-8 lg:grid-cols-[1fr_400px]">
        <div className="space-y-8">
          <Gallery closeup={s.closeup_blob_id} hero={o.hero_blob_id} label={s.label} title={o.title} />
          <div className="pt-4" />
          <Card>
            <SectionTitle>Ad-Space Quality Score</SectionTitle>
            <AqsPanel r={{ aqs: s.aqs, grade: s.grade, confidence: s.confidence_bps / 10000, subscores: s.subscores ?? {}, strengths: s.strengths, weaknesses: s.weaknesses }} />
            <p className="mt-5 border-t border-line pt-4 text-xs text-muted">
              Scored by <span className="font-mono text-white/70">{s.rubric_version}</span>
              {s.report_blob_id && (
                <>
                  {" · "}
                  <a className="font-semibold text-p hover:underline" href={`https://aggregator.walrus-testnet.walrus.space/v1/blobs/${s.report_blob_id}`} target="_blank" rel="noreferrer">
                    full AI report on Walrus
                  </a>
                </>
              )}
            </p>
          </Card>
          <Card>
            <SectionTitle action={<span className="flex items-center gap-3 text-[11px] text-muted"><span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-p" /> free</span><span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-white/20" /> booked</span></span>}>
              <span className="flex items-center gap-2"><CalendarDays className="h-4 w-4 text-p" /> Availability</span>
            </SectionTitle>
            <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-10">
              {Array.from({ length: 20 }, (_, i) => current + i).map((w, i) => (
                <motion.span
                  key={w}
                  initial={{ opacity: 0, y: 10, scale: 0.9 }}
                  whileInView={{ opacity: 1, y: 0, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.025, duration: 0.4, ease: EASE }}
                  className={cx("grid h-10 place-items-center rounded-xl text-[11px] font-semibold", booked.has(w) ? "bg-white/[0.04] text-faint line-through" : "border border-p/30 bg-p/10 text-p")}
                >
                  {weekLabel(w, weekMs)}
                </motion.span>
              ))}
            </div>
          </Card>
          {d.proofs.length > 0 && (
            <Card>
              <SectionTitle><span className="flex items-center gap-2"><Camera className="h-4 w-4 text-p" /> Proof of display</span></SectionTitle>
              <ScrollArea max={260}><div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                {d.proofs.map((p: any, i: number) => (
                  <motion.div key={p.photo_blob_id} initial={{ opacity: 0, scale: 0.85 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} transition={{ delay: i * 0.05 }} whileHover={{ scale: 1.06, zIndex: 2 }} className="overflow-hidden rounded-xl border border-line">
                    <Img blob={p.photo_blob_id} alt={`proof ${p.period}`} className="aspect-square w-full" />
                  </motion.div>
                ))}
              </div></ScrollArea>
            </Card>
          )}
          {d.leases.length > 0 && (
            <Card>
              <SectionTitle>Lease history</SectionTitle>
              <ScrollArea max={320}><div className="space-y-2 text-sm">
                {d.leases.map((l: any) => (
                  <Link key={l.escrow_id} href={`/leases/${l.escrow_id}`} className="group flex items-center justify-between gap-3 rounded-2xl border border-line bg-white/[0.02] p-3 transition-colors hover:border-p/40">
                    <span className="flex min-w-0 items-center gap-3">
                      <span className="checker h-10 w-10 shrink-0 overflow-hidden rounded-xl"><Img blob={l.creative_blob_id} alt="" className="h-full w-full object-contain" /></span>
                      <span className="truncate"><b>{l.brand}</b> <span className="text-muted">· {l.weeks} week(s) from {new Date(Number(l.start_ms)).toLocaleDateString()}</span></span>
                    </span>
                    <Badge>{l.status.replace("_", " ")}</Badge>
                  </Link>
                ))}
              </div></ScrollArea>
            </Card>
          )}
          <ActivityFeed items={d.activity} />
        </div>

        <div className="space-y-4 lg:sticky lg:top-[140px] lg:self-start">
          <motion.div initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.8, delay: 0.15, ease: EASE }} className="ring-spin rounded-[2rem]">
            <div className="glass relative overflow-hidden rounded-[2rem] p-6">
              <div aria-hidden className="absolute -right-16 -top-20 h-48 w-48 rounded-full bg-p/20 blur-3xl" />
              <div className="relative flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h1 className="truncate text-3xl font-extrabold tracking-tight">{s.label}</h1>
                  <div className="mt-0.5 flex items-center gap-1.5 text-sm text-muted">
                    {o.title}
                    {o.city && (
                      <>
                        <MapPin className="h-3.5 w-3.5" /> {o.city}
                      </>
                    )}
                  </div>
                </div>
                <GradeBadge grade={s.grade} aqs={s.aqs} />
              </div>
              <div className="relative mt-3"><EnsName name={s.ens_name} status={d.ensInfo?.status} kind="space" /></div>
              <div className="relative mt-5 grid grid-cols-2 gap-2">
                <Spec icon={Ruler} label="Size" value={`${s.width_mm / 10} × ${s.height_mm / 10} cm`} />
                <Spec icon={Layers} label="Placement" value={s.placement} />
                <Spec icon={Sparkles} label="Surface" value={s.material ?? "—"} />
                <Spec icon={Eye} label="Seen from" value={`~${s.viewing_distance_m ?? o.viewing_distance_m ?? "—"} m`} />
              </div>
              {o.prohibited_zones?.length > 0 && (
                <div className="relative mt-2 flex items-start gap-2 rounded-2xl border border-line bg-white/[0.02] p-3 text-xs text-muted">
                  <ShieldBan className="mt-0.5 h-3.5 w-3.5 shrink-0" /> Not allowed on this {o.object_type ?? "object"}: {o.prohibited_zones.join(", ")}
                </div>
              )}
              <div className="relative mt-5 rounded-3xl bg-gradient-to-br from-p to-p-600 p-5 text-ink">
                <div aria-hidden className="absolute -right-6 -top-8 h-24 w-24 rounded-full bg-white/30 blur-2xl" />
                <div className="relative text-3xl font-extrabold tracking-tight">{usdc(s.price_per_week)}</div>
                <div className="relative text-xs font-semibold opacity-70">per {weekMs < 86400_000 ? `${weekMs / 60000}-minute demo week` : "week"} · fixed price set by the owner</div>
              </div>
              <div className="relative mt-4">
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
                      <MessageCircle className="h-4 w-4" /> Message owner
                    </Button>
                  </div>
                ) : (
                  <SignInButtons />
                )}
              </div>
            </div>
          </motion.div>

          <Card delay={0.1}>
            <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-faint">Owner</div>
            <Link href={`/${d.owner.ens_name ?? ""}`} className="group mt-3 flex items-center gap-3">
              <Avatar letter={(d.owner.handle ?? "?")[0]?.toUpperCase()} />
              <div className="min-w-0">
                <div className="font-bold transition-colors group-hover:text-p">{d.owner.display_name ?? d.owner.handle ?? shortAddr(d.owner.address)}</div>
                <div className="mt-1"><EnsName name={d.owner.ens_name} kind="account" size="xs" /></div>
              </div>
            </Link>
            <div className="mt-4 grid grid-cols-2 gap-2 text-center">
              <div className="rounded-2xl bg-white/[0.03] p-2.5"><div className="text-lg font-extrabold">{d.owner.completedLeases}</div><div className="text-[11px] text-muted">completed leases</div></div>
              <div className="rounded-2xl bg-white/[0.03] p-2.5"><div className="text-lg font-extrabold">{d.owner.acceptedProofs}</div><div className="text-[11px] text-muted">accepted proofs</div></div>
            </div>
          </Card>

          {d.offering && (
            <Card delay={0.15} className="overflow-hidden">
              <div aria-hidden className="absolute -left-10 -top-10 h-32 w-32 rounded-full bg-p/15 blur-2xl" />
              <div className="relative flex items-center justify-between">
                <div className="font-bold">Tokenised</div>
                <Badge tone="brand">{d.offering.status}</Badge>
              </div>
              <p className="relative mt-2 text-sm text-muted">{(d.offering.revenue_share_bps / 100).toFixed(0)}% of this space&apos;s lease revenue is split across 10,000 units.</p>
              <LinkButton href={`/offerings/${d.offering.id}`} variant="secondary" className="relative mt-4 w-full">
                View offering
              </LinkButton>
            </Card>
          )}

          <VerifyPanel name={s.ens_name} suiId={s.id} v={d.verification} ens={d.ens} info={d.ensInfo} />

          <Card delay={0.2}>
            <div className="flex items-center gap-2 text-sm font-bold">
              <Code2 className="h-4 w-4 text-p" /> Lease over the API (x402)
            </div>
            <p className="mt-1 text-xs text-muted">Brand agents book this space with USDC on sui:testnet:</p>
            <pre className="mt-3 overflow-x-auto rounded-2xl border border-line bg-ink p-4 font-mono text-[11px] leading-relaxed text-p-200">{`POST /api/x402/leases
{"spaceId":"${s.id.slice(0, 10)}…","weeks":1,
 "creativeUrl":"https://…","landingUrl":"https://…","brand":"…"}`}</pre>
          </Card>

          {d.siblings.length > 0 && (
            <div>
              <div className="mb-3 text-sm font-bold">More spaces on this {o.object_type ?? "object"}</div>
              <div className="grid gap-4">
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
  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6">
      <Crumbs items={[{ href: "/explore", label: "Explore" }, { href: `/${o.owner?.ens_name ?? ""}`, label: o.owner?.handle ?? "owner" }, { label: o.title }]} />
      <div className="grid gap-8 md:grid-cols-[400px_1fr]">
        <div className="space-y-4 md:sticky md:top-[140px] md:self-start">
          <Card className="overflow-hidden p-0">
            <div className="relative">
              <Img blob={o.hero_blob_id} alt={o.title} className="aspect-[4/3] w-full" />
              <div className="absolute inset-0 bg-gradient-to-t from-p-950 via-transparent to-transparent" />
            </div>
            <div className="relative -mt-10 space-y-3 p-6">
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-extrabold tracking-tight">{o.title}</h1>
                {o.object_grade > 0 && <GradeBadge grade={o.object_grade} aqs={o.object_aqs} size="sm" />}
              </div>
              <div className="text-sm text-muted">
                {o.object_type} {o.city && `· ${o.city}`} · by {o.owner?.ens_name && <Link href={`/${o.owner.ens_name}`}><EnsName name={o.owner.ens_name} kind="account" size="xs" /></Link>}
              </div>
              {o.sponsored_until && new Date(o.sponsored_until).getTime() > Date.now() && <Badge tone="sponsored">Sponsored</Badge>}
              {o.description && <p className="text-sm leading-relaxed text-white/75">{o.description}</p>}
              <div className="flex flex-wrap gap-1.5">{(o.tags ?? []).map((t: string) => <Badge key={t}>{t}</Badge>)}</div>
            </div>
          </Card>
          <VerifyPanel name={o.ens_name} suiId={o.id} v={d.verification} ens={d.ens} info={d.ensInfo} />
        </div>
        <div>
          <h2 className="mb-5 text-2xl font-extrabold tracking-tight">Ad spaces</h2>
          {!d.spaces.length && <Empty title="No spaces listed yet" />}
          <div className="grid gap-5 sm:grid-cols-2">
            {d.spaces.map((s: any, i: number) => (
              <motion.div key={s.id} initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 + i * 0.07, duration: 0.6, ease: EASE }}>
                <SpaceCard s={{ ...s, object: o }} />
              </motion.div>
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
    <div className="mx-auto max-w-7xl px-4 sm:px-6">
      <div className="relative mb-10 overflow-hidden rounded-[2rem] border border-line bg-gradient-to-br from-p-900 via-p-950 to-ink p-8">
        <div aria-hidden className="absolute -right-20 -top-24 h-72 w-72 rounded-full bg-p/25 blur-3xl" />
        <div className="relative flex flex-wrap items-center gap-6">
          <motion.div initial={{ scale: 0.6, rotate: -20, opacity: 0 }} animate={{ scale: 1, rotate: 0, opacity: 1 }} transition={{ type: "spring", stiffness: 200, damping: 14 }}>
            <Avatar letter={(u.handle ?? "?")[0]?.toUpperCase()} size={88} />
          </motion.div>
          <div className="min-w-0 flex-1">
            <h1 className="text-4xl font-extrabold tracking-tight">{u.display_name ?? u.handle}</h1>
            <div className="mt-2"><EnsName name={u.ens_name} status={d.ensInfo?.status} kind="account" /></div>
            <div className="mt-3 flex flex-wrap gap-2">
              {u.brand_name && <Badge tone="brand">Advertiser · {u.brand_name}</Badge>}
              <Badge>{d.reputation.completedLeases} completed leases</Badge>
              <Badge>member since {new Date(u.created_at).toLocaleDateString()}</Badge>
            </div>
          </div>
        </div>
        {u.bio && <p className="relative mt-5 max-w-2xl text-white/75">{u.bio}</p>}
        <div className="relative mt-3 flex gap-4 text-sm">
          {u.twitter && <span className="text-muted">𝕏 @{u.twitter.replace(/^@/, "")}</span>}
          {u.website && <a className="font-semibold text-p hover:underline" href={u.website}>{u.website}</a>}
        </div>
      </div>
      <div className="grid gap-8 md:grid-cols-[1fr_380px]">
        <div>
          <h2 className="mb-5 text-2xl font-extrabold tracking-tight">Objects</h2>
          {!d.objects.length && <Empty title="No objects listed yet" />}
          <div className="grid gap-5 sm:grid-cols-2">
            {d.objects.map((o: any, i: number) => (
              <motion.div key={o.id} initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 + i * 0.07, duration: 0.6, ease: EASE }}>
                <Link href={`/${o.ens_name}`} className="group block overflow-hidden rounded-3xl border border-line bg-white/[0.03] transition-colors hover:border-p/50">
                  <div className="overflow-hidden"><Img blob={o.hero_blob_id} alt={o.title} className="aspect-[16/10] w-full transition-transform duration-700 group-hover:scale-110" /></div>
                  <div className="p-4">
                    <div className="font-bold">{o.title}</div>
                    <div className="truncate text-sm text-muted">{d.spaces.filter((s: any) => s.object_id === o.id).length} spaces</div>
                    <div className="mt-2"><EnsName name={o.ens_name} kind="object" size="xs" /></div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
        <VerifyPanel name={u.ens_name} suiId={u.profile_id} v={d.verification} ens={d.ens} info={d.ensInfo} />
      </div>
    </div>
  );
}

function LeaseView({ d }: { d: any }) {
  const l = d.lease;
  return (
    <div className="mx-auto max-w-3xl space-y-4 px-4">
      <Card>
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-extrabold tracking-tight">{l.brand} on {d.spaceName}</h1>
          <Badge>{l.status}</Badge>
        </div>
        <div className="checker mt-5 overflow-hidden rounded-2xl">
          <Img blob={l.creative_blob_id} alt="creative" className="max-h-72 w-full object-contain" />
        </div>
        <p className="mt-4 text-sm text-muted">
          {l.weeks} week(s) from {new Date(Number(l.start_ms)).toLocaleString()} · {usdc(l.total_paid)}
        </p>
        <LinkButton href={`/leases/${l.escrow_id}`} className="mt-4">
          Open lease
        </LinkButton>
      </Card>
      <VerifyPanel name={`${l.ens_label}.${d.spaceName}`} suiId={l.escrow_id} v={d.verification} ens={d.ens} info={d.ensInfo} />
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
  if (!n.endsWith(".brandmystuff.eth")) return <div className="mx-auto max-w-xl p-10"><Empty title="Page not found" /></div>;
  if (isLoading) return <PageLoader label="Resolving name" />;
  if (error || !data) return <div className="mx-auto max-w-xl p-10"><Empty title={(error as Error)?.message ?? "Not found"} /></div>;
  const d = { ...data, verification: live?.verification ?? null };
  if (data.kind === "space") return <SpaceView d={d} />;
  if (data.kind === "object") return <ObjectView d={d} />;
  if (data.kind === "account") return <AccountView d={d} />;
  return <LeaseView d={d} />;
}
