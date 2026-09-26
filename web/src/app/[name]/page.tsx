"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { Bot, CalendarDays, Camera, ChevronRight, Code2, Eye, Layers, MapPin, Maximize2, MessageCircle, Ruler, ShieldBan, Sparkles } from "lucide-react";
import { useSession } from "@/lib/client/session";
import { AqsPanel } from "@/components/aqs";
import { ActivityList } from "@/components/activity";
import { Checkout, weekLabel } from "@/components/checkout";
import { VerifyPanel } from "@/components/verify";
import { SpaceCard } from "@/components/space-card";
import { Badge, Button, Card, EASE, Empty, GradeBadge, Img, LinkButton, PageLoader, Tabs, cx, shortAddr, usdc, useAction } from "@/components/ui";
import { EnsName } from "@/components/ens";
import { Lightbox } from "@/components/lightbox";
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
    <div className="flex items-start gap-2.5 rounded-xl border border-line bg-white/[0.02] px-3 py-2">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-p" />
      <div className="min-w-0">
        <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-faint">{label}</div>
        <div className="truncate text-sm font-semibold">{value}</div>
      </div>
    </div>
  );
}

/** Page height on desktop: the viewport minus header, breadcrumbs and a bottom gap. */
const FIXED = "lg:h-[calc(100dvh-212px)] lg:min-h-[600px]";

/** A glass panel with tabs on top and a body that scrolls inside (on desktop it fills its column). */
function TabPanel<T extends string>({ tabs, value, onChange, children, className, natural }: { tabs: { id: T; label: ReactNode }[]; value: T; onChange: (t: T) => void; children: ReactNode; className?: string; natural?: boolean }) {
  return (
    <div className={cx("glass flex min-h-0 flex-col overflow-hidden rounded-3xl", className)}>
      <div className="shrink-0 border-b border-line px-3 py-2.5">
        <Tabs size="sm" tabs={tabs} value={value} onChange={onChange} />
      </div>
      <div className="relative min-h-0 flex-1">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={value} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.22 }} className={cx("p-5", !natural && "overflow-y-auto overscroll-contain lg:absolute lg:inset-0")}>
            {children}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

function Gallery({ closeup, hero, label, title }: { closeup?: string; hero?: string; label: string; title: string }) {
  const [view, setView] = useState<number | null>(null);
  return (
    <>
    <motion.div initial={{ opacity: 0, scale: 0.98, filter: "blur(10px)" }} animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }} transition={{ duration: 0.8, ease: EASE }} onClick={() => setView(0)} className="group relative aspect-[16/10] shrink-0 cursor-zoom-in overflow-hidden rounded-3xl border border-line">
      <Img blob={closeup} alt={label} className="h-full w-full transition-transform duration-[1.2s] group-hover:scale-105" />
      <div className="absolute inset-0 bg-gradient-to-t from-ink/80 via-transparent to-ink/20" />
      <span className="absolute left-4 top-4 inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-ink/60 px-3 py-1.5 text-[11px] font-bold text-white/85 backdrop-blur-md">
        <Sparkles className="h-3.5 w-3.5 text-p" /> The ad space
      </span>
      <span className="absolute right-4 top-4 inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-ink/60 px-3 py-1.5 text-[11px] font-bold text-white/85 opacity-0 backdrop-blur-md transition-opacity group-hover:opacity-100">
        <Maximize2 className="h-3.5 w-3.5 text-p" /> Click to expand
      </span>
      <motion.div initial={{ opacity: 0, y: 20, rotate: 4 }} animate={{ opacity: 1, y: 0, rotate: -3 }} transition={{ duration: 0.8, delay: 0.3, type: "spring", stiffness: 120, damping: 14 }} whileHover={{ rotate: 0, scale: 1.04 }} onClick={(e) => { e.stopPropagation(); setView(1); }} className="absolute bottom-4 right-4 w-[30%] max-w-[200px] overflow-hidden rounded-2xl border-4 border-p-950 shadow-[0_20px_60px_rgba(0,0,0,0.6)]">
        <Img blob={hero} alt={title} className="aspect-[4/3] w-full" />
        <span className="absolute bottom-1.5 left-1.5 rounded-full bg-ink/70 px-2 py-0.5 text-[10px] font-bold text-white/85 backdrop-blur">Whole object</span>
      </motion.div>
    </motion.div>
    <Lightbox images={[{ blob: closeup, label: label + " · the ad space" }, { blob: hero, label: title + " · whole object" }]} index={view} onClose={() => setView(null)} />
    </>
  );
}

type SpaceTab = "score" | "availability" | "proofs" | "leases" | "activity";
type SideTab = "chain" | "owner" | "api" | "more";

function SpaceView({ d }: { d: any }) {
  const s = d.space, o = d.object;
  const { authenticated, api, address } = useSession();
  const router = useRouter();
  const [checkout, setCheckout] = useState(false);
  const [tab, setTab] = useState<SpaceTab>("score");
  const [side, setSide] = useState<SideTab>("chain");
  const [proofView, setProofView] = useState<number | null>(null);
  const { busy, run } = useAction();
  const mine = address === s.owner_address;
  const weekMs = Number(s.week_ms);
  const current = Math.floor(Date.now() / weekMs);
  const booked = new Set<number>(d.bookedWeeks);
  const count = (n: number) => (n ? <span className="ml-1 opacity-60">{n}</span> : null);
  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6">
      <Crumbs items={[{ href: "/explore", label: "Explore" }, { href: `/${o.ens_name}`, label: o.title }, { label: s.label }]} />
      <div className="grid items-start gap-5 lg:grid-cols-[1fr_400px]">
        {/* left: photos + details (the details panel keeps a fixed height and scrolls inside) */}
        <div className="flex min-w-0 flex-col gap-5">
          <Gallery closeup={s.closeup_blob_id} hero={o.hero_blob_id} label={s.label} title={o.title} />
          <TabPanel
            className="h-[560px] lg:h-[620px]"
            value={tab}
            onChange={setTab}
            tabs={[
              { id: "score", label: "Quality score" },
              { id: "availability", label: "Availability" },
              { id: "proofs", label: <>Proofs{count(d.proofs.length)}</> },
              { id: "leases", label: <>Leases{count(d.leases.length)}</> },
              { id: "activity", label: <>Activity{count(d.activity?.length ?? 0)}</> },
            ]}
          >
            {tab === "score" && (
              <>
                <h3 className="mb-4 font-bold">Ad-Space Quality Score</h3>
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
              </>
            )}
            {tab === "availability" && (
              <>
                <div className="mb-4 flex items-center justify-between gap-3">
                  <h3 className="flex items-center gap-2 font-bold"><CalendarDays className="h-4 w-4 text-p" /> Next 20 weeks</h3>
                  <span className="flex items-center gap-3 text-[11px] text-muted"><span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-p" /> free</span><span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-white/20" /> booked</span></span>
                </div>
                <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-5 xl:grid-cols-10">
                  {Array.from({ length: 20 }, (_, i) => current + i).map((w, i) => (
                    <motion.span key={w} initial={{ opacity: 0, y: 8, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ delay: i * 0.02, duration: 0.35, ease: EASE }} className={cx("grid h-10 place-items-center rounded-xl text-[11px] font-semibold", booked.has(w) ? "bg-white/[0.04] text-faint line-through" : "border border-p/30 bg-p/10 text-p")}>
                      {weekLabel(w, weekMs)}
                    </motion.span>
                  ))}
                </div>
              </>
            )}
            {tab === "proofs" &&
              (d.proofs.length ? (
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 xl:grid-cols-6">
                  {d.proofs.map((p: any, i: number) => (
                    <motion.div key={p.photo_blob_id} initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.04 }} onClick={() => setProofView(i)} className="cursor-zoom-in overflow-hidden rounded-xl border border-line">
                      <Img blob={p.photo_blob_id} alt={`proof ${p.period}`} className="aspect-square w-full transition-transform duration-500 hover:scale-110" />
                    </motion.div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted">No proofs of display yet. They appear here as owners prove each lease period.</p>
              ))}
            {tab === "leases" &&
              (d.leases.length ? (
                <div className="space-y-2 text-sm">
                  {d.leases.map((l: any) => (
                    <Link key={l.escrow_id} href={`/leases/${l.escrow_id}`} className="group flex items-center justify-between gap-3 rounded-2xl border border-line bg-white/[0.02] p-3 transition-colors hover:border-p/40">
                      <span className="flex min-w-0 items-center gap-3">
                        <span className="checker h-10 w-10 shrink-0 overflow-hidden rounded-xl"><Img blob={l.creative_blob_id} alt="" className="h-full w-full object-contain" /></span>
                        <span className="truncate"><b>{l.brand}</b> <span className="text-muted">· {l.weeks} week(s) from {new Date(Number(l.start_ms)).toLocaleDateString()}</span></span>
                      </span>
                      <Badge>{l.status.replace("_", " ")}</Badge>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted">No leases yet. Be the first brand on this space.</p>
              ))}
            {tab === "activity" && <ActivityList items={d.activity} />}
          </TabPanel>
        </div>

        {/* right: booking + on-chain / owner / API, at their natural height */}
        <div className="flex min-w-0 flex-col gap-5">
          <motion.div initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.8, delay: 0.15, ease: EASE }} className="ring-spin shrink-0 rounded-3xl">
            <div className="glass relative overflow-hidden rounded-3xl p-5">
              <div aria-hidden className="absolute -right-16 -top-20 h-48 w-48 rounded-full bg-p/20 blur-3xl" />
              <div className="relative flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h1 className="truncate text-2xl font-extrabold tracking-tight">{s.label}</h1>
                  <div className="mt-0.5 flex items-center gap-1.5 truncate text-sm text-muted">
                    {o.title}
                    {o.city && (
                      <>
                        <MapPin className="h-3.5 w-3.5 shrink-0" /> {o.city}
                      </>
                    )}
                  </div>
                </div>
                <GradeBadge grade={s.grade} aqs={s.aqs} />
              </div>
              <div className="relative mt-2.5"><EnsName name={s.ens_name} status={d.ensInfo?.status} kind="space" /></div>
              <div className="relative mt-3.5 grid grid-cols-2 gap-1.5">
                <Spec icon={Ruler} label="Size" value={`${s.width_mm / 10} × ${s.height_mm / 10} cm`} />
                <Spec icon={Layers} label="Placement" value={s.placement} />
                <Spec icon={Sparkles} label="Surface" value={s.material ?? "—"} />
                <Spec icon={Eye} label="Seen from" value={`~${s.viewing_distance_m ?? o.viewing_distance_m ?? "—"} m`} />
              </div>
              {o.prohibited_zones?.length > 0 && (
                <p className="relative mt-2 line-clamp-2 flex items-start gap-1.5 text-[11px] text-muted" title={o.prohibited_zones.join(", ")}>
                  <ShieldBan className="mt-0.5 h-3 w-3 shrink-0" /> Not on: {o.prohibited_zones.join(", ")}
                </p>
              )}
              <div className="relative mt-3.5 flex items-center justify-between gap-3 rounded-2xl bg-gradient-to-br from-p to-p-600 px-4 py-3 text-ink">
                <div aria-hidden className="absolute -right-6 -top-8 h-24 w-24 rounded-full bg-white/30 blur-2xl" />
                <div className="relative min-w-0">
                  <div className="text-2xl font-extrabold leading-none tracking-tight">{usdc(s.price_per_week)}</div>
                  <div className="mt-1 text-[11px] font-semibold opacity-70">per {weekMs < 86400_000 ? `${weekMs / 60000}-min demo week` : "week"} · fixed price</div>
                </div>
                {d.offering && (
                  <Link href={`/offerings/${d.offering.id}`} className="relative shrink-0 rounded-full bg-ink/85 px-3 py-1.5 text-[11px] font-bold text-p hover:bg-ink">
                    Tokenised ↗
                  </Link>
                )}
              </div>
              <div className="relative mt-3">
                {s.status !== "available" ? (
                  <Badge tone="warn">This space is {s.status}</Badge>
                ) : mine ? (
                  <LinkButton href={`/objects/${o.id}`} variant="secondary" className="w-full">
                    Manage this object
                  </LinkButton>
                ) : authenticated ? (
                  <div className="flex gap-2">
                    <Button className="flex-1" size="lg" onClick={() => setCheckout(true)} data-testid="lease">
                      Lease this space
                    </Button>
                    <Button variant="secondary" size="lg" aria-label="Message owner" loading={busy === "msg"} onClick={() => run("msg", async () => { const r = await api<any>("/api/conversations", { method: "POST", json: { spaceId: s.id } }); router.push(`/messages/${r.id}`); })}>
                      <MessageCircle className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <SignInButtons />
                )}
              </div>
            </div>
          </motion.div>

          <TabPanel
            natural
            value={side}
            onChange={setSide}
            tabs={[
              { id: "chain", label: "On-chain" },
              { id: "owner", label: "Owner" },
              { id: "api", label: "API" },
              ...(d.siblings.length ? [{ id: "more" as const, label: <>More spaces{count(d.siblings.length)}</> }] : []),
            ]}
          >
            {side === "chain" && <VerifyPanel bare name={s.ens_name} suiId={s.id} v={d.verification} ens={d.ens} info={d.ensInfo} />}
            {side === "owner" && (
              <>
                <Link href={`/${d.owner.ens_name ?? ""}`} className="group flex items-center gap-3">
                  <Avatar letter={(d.owner.handle ?? "?")[0]?.toUpperCase()} />
                  <div className="min-w-0">
                    <div className="font-bold transition-colors group-hover:text-p">{d.owner.display_name ?? d.owner.handle ?? shortAddr(d.owner.address)}</div>
                    <div className="mt-1"><EnsName name={d.owner.ens_name} kind="account" size="xs" /></div>
                  </div>
                </Link>
                <div className="mt-4 grid grid-cols-2 gap-2 text-center">
                  <div className="rounded-2xl bg-white/[0.03] p-3"><div className="text-xl font-extrabold">{d.owner.completedLeases}</div><div className="text-[11px] text-muted">completed leases</div></div>
                  <div className="rounded-2xl bg-white/[0.03] p-3"><div className="text-xl font-extrabold">{d.owner.acceptedProofs}</div><div className="text-[11px] text-muted">accepted proofs</div></div>
                </div>
                {d.offering && (
                  <Link href={`/offerings/${d.offering.id}`} className="mt-4 flex items-center justify-between gap-3 rounded-2xl border border-p/25 bg-p/[0.06] p-3 text-sm transition-colors hover:border-p/50">
                    <span><b>Tokenised</b> <span className="text-muted">· {(d.offering.revenue_share_bps / 100).toFixed(0)}% of lease revenue across 10,000 units</span></span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-p" />
                  </Link>
                )}
              </>
            )}
            {side === "api" && (
              <>
                <div className="flex items-center gap-2 text-sm font-bold"><Code2 className="h-4 w-4 text-p" /> Lease over the API (x402)</div>
                <p className="mt-1 text-xs text-muted">Brand agents book this space with USDC on sui:testnet:</p>
                <pre className="mt-3 overflow-x-auto rounded-2xl border border-line bg-ink p-4 font-mono text-[11px] leading-relaxed text-p-200">{`POST /api/x402/leases
{"spaceId":"${s.id.slice(0, 10)}…","weeks":1,
 "creativeUrl":"https://…","landingUrl":"https://…","brand":"…"}`}</pre>
                <Link href="/agents" className="mt-3 inline-flex text-xs font-semibold text-p hover:underline">Agent API docs ↗</Link>
              </>
            )}
            {side === "more" && (
              <div className="space-y-2">
                {d.siblings.map((x: any) => (
                  <Link key={x.id} href={`/${x.ens_name}`} className="group flex items-center gap-3 rounded-2xl border border-line bg-white/[0.02] p-2.5 transition-colors hover:border-p/40">
                    <Img blob={x.closeup_blob_id} alt="" className="h-12 w-12 shrink-0 rounded-xl" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold group-hover:text-p">{x.label}</span>
                      <span className="block text-xs text-muted">{usdc(x.price_per_week)}/wk</span>
                    </span>
                    {x.grade > 0 && <GradeBadge grade={x.grade} aqs={x.aqs} size="sm" />}
                  </Link>
                ))}
              </div>
            )}
          </TabPanel>
        </div>
      </div>
      {checkout && <Checkout space={s} booked={d.bookedWeeks} onClose={() => setCheckout(false)} />}
      <Lightbox images={d.proofs.map((p: any) => ({ blob: p.photo_blob_id, label: "Proof of display · period " + p.period }))} index={proofView} onClose={() => setProofView(null)} />
    </div>
  );
}

type ObjTab = "about" | "chain";

function ObjectView({ d }: { d: any }) {
  const o = d.object;
  const [tab, setTab] = useState<ObjTab>("about");
  const [view, setView] = useState<number | null>(null);
  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6">
      <Crumbs items={[{ href: "/explore", label: "Explore" }, { href: `/${o.owner?.ens_name ?? ""}`, label: o.owner?.handle ?? "owner" }, { label: o.title }]} />
      <div className={cx("grid gap-5 lg:grid-cols-[400px_1fr]", FIXED)}>
        <div className="flex min-h-0 flex-col gap-5">
          <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.7, ease: EASE }} onClick={() => setView(0)} className="relative aspect-[4/3] shrink-0 cursor-zoom-in overflow-hidden rounded-3xl border border-line lg:aspect-auto lg:h-[38%]">
            <Img blob={o.hero_blob_id} alt={o.title} className="h-full w-full" />
            <div className="absolute inset-0 bg-gradient-to-t from-ink/90 via-ink/10 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 p-5">
              <div className="flex items-center gap-2">
                <h1 className="truncate text-2xl font-extrabold tracking-tight">{o.title}</h1>
                {o.object_grade > 0 && <GradeBadge grade={o.object_grade} aqs={o.object_aqs} size="sm" />}
              </div>
              <div className="mt-0.5 truncate text-sm text-white/70">{o.object_type}{o.city && ` · ${o.city}`}</div>
            </div>
          </motion.div>
          <TabPanel className="min-h-[320px] flex-1 lg:min-h-0" value={tab} onChange={setTab} tabs={[{ id: "about", label: "About" }, { id: "chain", label: "On-chain" }]}>
            {tab === "about" && (
              <div className="space-y-4">
                <EnsName name={o.ens_name} status={d.ensInfo?.status} kind="object" />
                {o.owner?.ens_name && (
                  <div className="flex items-center gap-2 text-sm text-muted">by <Link href={`/${o.owner.ens_name}`}><EnsName name={o.owner.ens_name} kind="account" size="xs" /></Link></div>
                )}
                {o.sponsored_until && new Date(o.sponsored_until).getTime() > Date.now() && <Badge tone="sponsored">Sponsored</Badge>}
                {o.description && <p className="text-sm leading-relaxed text-white/75">{o.description}</p>}
                {!!o.tags?.length && <div className="flex flex-wrap gap-1.5">{o.tags.map((t: string) => <Badge key={t}>{t}</Badge>)}</div>}
                {o.viewing_distance_m && <div className="text-xs text-muted">Seen from ~{o.viewing_distance_m} m</div>}
              </div>
            )}
            {tab === "chain" && <VerifyPanel bare name={o.ens_name} suiId={o.id} v={d.verification} ens={d.ens} info={d.ensInfo} />}
          </TabPanel>
        </div>
        <div className="glass flex min-h-0 flex-col overflow-hidden rounded-3xl">
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-line px-5 py-4">
            <h2 className="text-lg font-extrabold tracking-tight">Ad spaces</h2>
            <span className="text-xs text-muted">{d.spaces.length} listed</span>
          </div>
          <div className="relative min-h-0 flex-1">
            <div className="overflow-y-auto overscroll-contain p-5 lg:absolute lg:inset-0">
              {!d.spaces.length && <Empty title="No spaces listed yet" />}
              <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {d.spaces.map((s: any, i: number) => (
                  <motion.div key={s.id} initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 + i * 0.07, duration: 0.6, ease: EASE }}>
                    <SpaceCard s={{ ...s, object: o }} />
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
      <Lightbox images={[{ blob: o.hero_blob_id, label: o.title }]} index={view} onClose={() => setView(null)} />
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

/** A brand's Scout agent (scout.<brand>) or one of the receipt names it registered for a purchase. */
function AgentView({ d }: { d: any }) {
  const r = d.verification?.records ?? {};
  const receipt = d.kind === "receipt";
  const status = r["eth.brandmystuff.attested.agent.status"] ?? d.agent.state?.texts?.["eth.brandmystuff.attested.agent.status"];
  return (
    <div className="mx-auto max-w-3xl space-y-4 px-4">
      <Crumbs items={[{ href: `/${d.agent.brand?.ens_name}`, label: d.agent.brand?.brand_name ?? d.agent.brand?.handle ?? "Brand" }, ...(receipt ? [{ href: `/${d.agent.name}`, label: "Scout" }] : []), { label: receipt ? d.ens.label : "Scout" }]} />
      <Card>
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-p/15 text-p"><Bot className="h-5 w-5" /></span>
            <div className="min-w-0">
              <h1 className="text-2xl font-extrabold tracking-tight">{receipt ? "Purchase receipt" : `${d.agent.brand?.brand_name ?? "Brand"}'s Scout`}</h1>
              <div className="mt-1"><EnsName name={d.ens.name} status={d.ensInfo?.status} kind={d.kind} size="xs" /></div>
            </div>
          </div>
          {!receipt && status && <Badge tone={status === "active" ? "brand" : "neutral"}>{status}</Badge>}
        </div>
        {receipt ? (
          <dl className="mt-5 space-y-2 text-sm">
            {r["eth.brandmystuff.receipt.pick"] && <div><dt className="text-xs text-muted">Picked</dt><dd><Link className="font-mono text-p hover:underline" href={`/${r["eth.brandmystuff.receipt.pick"]}`}>{r["eth.brandmystuff.receipt.pick"]}</Link></dd></div>}
            {r["eth.brandmystuff.receipt.reason"] && <div><dt className="text-xs text-muted">Why (written by the agent)</dt><dd className="text-white/80">{r["eth.brandmystuff.receipt.reason"]}</dd></div>}
            {r["eth.brandmystuff.attested.lease"] && <div><dt className="text-xs text-muted">Lease (attested)</dt><dd><Link className="font-mono text-p hover:underline" href={`/${r["eth.brandmystuff.attested.lease"]}`}>{r["eth.brandmystuff.attested.lease"]}</Link></dd></div>}
          </dl>
        ) : (
          <>
            {r["agent-context"] && <p className="mt-4 text-sm leading-relaxed text-white/75">{r["agent-context"]}</p>}
            <div className="mt-4 flex flex-wrap gap-2 text-xs text-muted">
              {r["eth.brandmystuff.attested.mandate.remaining"] && <Badge>{r["eth.brandmystuff.attested.mandate.remaining"]} USDC left in mandate</Badge>}
              {r["eth.brandmystuff.agent.last-pick"] && <Badge>last pick · {r["eth.brandmystuff.agent.last-pick"].split(".")[0]}</Badge>}
            </div>
            {d.receipts?.length > 0 && (
              <div className="mt-5">
                <div className="mb-2 text-xs font-semibold text-muted">Receipts registered by the agent</div>
                <div className="flex flex-wrap gap-1.5">{d.receipts.map((x: any) => <Link key={x.name} href={`/${x.name}`}><EnsName name={x.name} status={x.status} kind="receipt" size="xs" card={false} /></Link>)}</div>
              </div>
            )}
          </>
        )}
      </Card>
      <VerifyPanel name={d.ens.name} suiId={null} v={d.verification} ens={d.ens} info={d.ensInfo} />
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
  if (data.kind === "agent" || data.kind === "receipt") return <AgentView d={d} />;
  return <LeaseView d={d} />;
}
