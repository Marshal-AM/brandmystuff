"use client";
import Link from "next/link";
import { use, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { Bot, Check, Clock, Download, ExternalLink, MessageCircle, Plus, ScanSearch, X } from "lucide-react";
import { useSession } from "@/lib/client/session";
import { approveCreative, extendLease, openDispute, rejectCreative } from "@/lib/sui/tx";
import { Badge, Button, Card, EASE, Empty, Img, PageLoader, Spinner, Stat, cx, suiscan, useAction, usdc, ScrollArea } from "@/components/ui";
import { EnsName } from "@/components/ens";
import { PhotoCapture } from "@/components/photo-capture";

const STATUS: Record<string, { label: string; tone: any }> = {
  pending_approval: { label: "Waiting for owner approval", tone: "warn" },
  awaiting_install: { label: "Approved — waiting for install proof", tone: "brand" },
  live: { label: "Live", tone: "ok" },
  completed: { label: "Completed", tone: "ok" },
  disputed: { label: "Disputed", tone: "bad" },
  cancelled: { label: "Cancelled (refunded)", tone: "neutral" },
  refunded: { label: "Refunded", tone: "neutral" },
};

function Countdown({ to }: { to: number }) {
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick((x) => x + 1), 30000);
    return () => clearInterval(t);
  }, []);
  const ms = to - Date.now();
  if (ms <= 0) return <span>now</span>;
  const m = Math.floor(ms / 60000);
  return <span className="font-mono">{m >= 1440 ? `${Math.floor(m / 1440)}d ${Math.floor((m % 1440) / 60)}h` : m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`}</span>;
}

function ProofUpload({ escrowId, next, onDone }: { escrowId: string; next: any; onDone: () => void }) {
  const { api } = useSession();
  const [photo, setPhoto] = useState<{ file: File; url: string } | null>(null);
  const [res, setRes] = useState<any>(null);
  const { busy, run } = useAction();
  const open = Date.now() >= next.open;
  return (
    <Card className={cx("space-y-4", open && "ring-spin")}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-lg font-bold">{next.period === 0 ? "Install proof" : `Proof for period ${next.period}`}</h3>
        <span className="flex items-center gap-1.5 rounded-full bg-white/[0.05] px-3 py-1 text-xs text-muted">
          <Clock className="h-3.5 w-3.5 text-p" />
          {open ? <>Due in <Countdown to={next.close} /></> : <>Opens in <Countdown to={next.open} /></>}
        </span>
      </div>
      {!open ? (
        <p className="text-sm text-muted">You can upload this proof when the window opens.</p>
      ) : (
        <>
          <p className="text-sm text-muted">Take a clear photo of the ad installed on the space.</p>
          <PhotoCapture purpose="proof" label="Proof photo" testId="proof-photo" preview={photo?.url} scanning={busy === "proof"} onChange={(file) => { setPhoto({ file, url: URL.createObjectURL(file) }); setRes(null); }} />
          <Button
            size="lg"
            disabled={!photo}
            loading={busy === "proof"}
            data-testid="submit-proof"
            onClick={() =>
              run("proof", async () => {
                const fd = new FormData();
                fd.set("escrowId", escrowId);
                fd.set("image", photo!.file);
                const r = await api<any>("/api/proofs", { method: "POST", body: fd });
                setRes(r);
                if (r.accepted) onDone();
                else setPhoto(null);
              })
            }
          >
            <ScanSearch className="h-4 w-4" /> Submit proof
          </Button>
          <AnimatePresence>
            {busy === "proof" && (
              <motion.p initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="flex items-center gap-2 text-sm text-p">
                <span className="h-1.5 w-1.5 animate-ping rounded-full bg-p" /> Verifying your photo with AI…
              </motion.p>
            )}
          </AnimatePresence>
        </>
      )}
      <AnimatePresence>
        {res && (
          <motion.div initial={{ opacity: 0, y: 12, filter: "blur(6px)" }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }} exit={{ opacity: 0 }} transition={{ duration: 0.5, ease: EASE }} className={cx("flex items-start gap-3 rounded-2xl border p-3.5 text-sm", res.accepted ? "border-p/40 bg-p/10" : "border-white/20 bg-white/[0.05]")} data-testid="proof-result">
            <span className={cx("grid h-7 w-7 shrink-0 place-items-center rounded-full", res.accepted ? "bg-p text-ink" : "bg-white text-ink")}>{res.accepted ? <Check className="h-4 w-4" strokeWidth={3} /> : <X className="h-4 w-4" strokeWidth={3} />}</span>
            <span className="pt-0.5">{res.accepted ? <>✓ Accepted — escrow released. <a className="font-semibold text-p underline" href={suiscan("tx", res.digest)} target="_blank" rel="noreferrer">View tx</a></> : <>✗ {res.reason} Retake the photo and try again.</>}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}

export default function LeasePage({ params }: { params: Promise<{ escrowId: string }> }) {
  const { escrowId } = use(params);
  const { api, run, token } = useSession();
  const { data, refetch, isLoading } = useQuery({ queryKey: ["lease", escrowId], queryFn: () => api<any>(`/api/leases/${escrowId}`), refetchInterval: 15000 });
  const { busy, run: act } = useAction();
  if (isLoading) return <PageLoader label="Loading lease" />;
  if (!data) return <div className="mx-auto max-w-xl p-10"><Empty title="Lease not found" /></div>;
  const l = data.lease, s = l.spaces, role = data.role;
  const st = STATUS[l.status] ?? { label: l.status, tone: "neutral" };
  const download = (size: string, format: string) =>
    act(`dl-${size}-${format}`, async () => {
      const t = await token();
      const r = await fetch(`/api/leases/${escrowId}/print?size=${size}&format=${format}`, { headers: t ? { authorization: `Bearer ${t}` } : {}, credentials: "include" });
      if (!r.ok) throw new Error("Could not build the print file");
      const b = await r.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(b);
      a.download = `${l.ens_label}-${size}.${format}`;
      a.click();
    }, undefined, `Rendering the ${format.toUpperCase()} print file…`);
  const leaseName = `${l.ens_label}.${s.ens_name}`;
  const released = data.periods.filter((p: any) => p.status === "released").length;
  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease: EASE }} className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <div className="text-xs font-semibold uppercase tracking-widest text-p">Lease</div>
          <div className="mt-2"><EnsName name={leaseName} kind="lease" /></div>
          <h1 className="mt-2 text-4xl font-extrabold tracking-tight sm:text-5xl">
            {l.brand} <span className="text-muted">on</span> <Link className="text-p transition-colors hover:text-white" href={`/${s.ens_name}`}>{s.label}</Link>
          </h1>
        </div>
        <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.3, type: "spring", stiffness: 300, damping: 18 }}>
          <Badge tone={st.tone} className="px-3 py-1.5 text-sm">{st.label}</Badge>
        </motion.div>
      </motion.div>
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Paid into escrow" value={usdc(l.total_paid)} />
            <Stat label="Released" value={usdc(l.released)} delay={0.05} />
            <Stat label="Refunded" value={usdc(l.refunded)} delay={0.1} />
            <Stat label="Link clicks" value={data.clicks} delay={0.15} />
          </div>
          <Card>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold">Periods</h3>
              <span className="text-xs text-muted">{released}/{data.periods.length} released</span>
            </div>
            <ScrollArea max={360}><div className="relative space-y-2 pl-6">
              <div className="absolute bottom-3 left-[9px] top-3 w-px bg-gradient-to-b from-p via-p/30 to-transparent" />
              {data.periods.map((p: any, i: number) => (
                <motion.div key={p.period} initial={{ opacity: 0, x: -12 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.05, duration: 0.45, ease: EASE }} className="relative flex items-center justify-between gap-2 rounded-2xl border border-line bg-white/[0.02] px-4 py-2.5 text-sm">
                  <span className={cx("absolute -left-[21px] h-3 w-3 rounded-full border-2 border-ink", p.status === "released" ? "bg-p" : p.status === "due" ? "animate-pulse bg-p-300" : "bg-white/20")} />
                  <span>
                    <span className="font-semibold">{p.period === 0 ? "Install proof" : `Period ${p.period}`}</span> · <span className="text-muted">closes {new Date(p.close).toLocaleString()}</span>
                  </span>
                  <span className="flex items-center gap-2">
                    {p.tranche && <span className="font-mono text-xs text-muted">{usdc(p.tranche.gross)}</span>}
                    <Badge tone={p.status === "released" ? "ok" : p.status === "refunded" ? "bad" : p.status === "due" ? "warn" : "neutral"}>{p.status}</Badge>
                  </span>
                </motion.div>
              ))}
            </div></ScrollArea>
          </Card>
          {role === "owner" && data.next && ["awaiting_install", "live"].includes(l.status) && <ProofUpload escrowId={escrowId} next={data.next} onDone={() => refetch()} />}
          <Card>
            <h3 className="mb-4 text-lg font-bold">Proof photos</h3>
            {!data.proofs.length && <p className="text-sm text-muted">No proofs yet.</p>}
            <ScrollArea max={520}><div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {data.proofs.map((p: any, i: number) => (
                <motion.div key={p.id} initial={{ opacity: 0, scale: 0.9 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} transition={{ delay: i * 0.06, duration: 0.5, ease: EASE }} className="group overflow-hidden rounded-2xl border border-line bg-white/[0.02]">
                  <div className="overflow-hidden"><Img blob={p.photo_blob_id} alt="proof" className="aspect-square w-full transition-transform duration-700 group-hover:scale-110" /></div>
                  <div className="space-y-1 p-2.5 text-xs">
                    <div className="flex items-center gap-2"><Badge tone={p.status === "accepted" ? "ok" : "bad"}>{p.status}</Badge> <span className="text-muted">period {p.period}</span></div>
                    {p.reason && <div className="text-muted">{p.reason}</div>}
                    {p.digest && <a className="inline-flex items-center gap-1 text-p hover:text-white" href={suiscan("tx", p.digest)} target="_blank" rel="noreferrer">Sui tx <ExternalLink className="h-3 w-3" /></a>}
                  </div>
                </motion.div>
              ))}
            </div></ScrollArea>
          </Card>
        </div>
        <div className="space-y-4 lg:sticky lg:top-[140px] lg:self-start">
          <Card>
            <h3 className="font-bold">Creative</h3>
            <div className="checker mt-3 overflow-hidden rounded-2xl">
              <Img blob={l.creative_blob_id} alt="creative" className="aspect-square w-full object-contain" />
            </div>
            <div className="mt-3 text-sm text-muted">
              Landing:{" "}
              <a className="break-all text-p hover:underline" href={`/r/${escrowId}`} target="_blank" rel="noreferrer">
                {l.landing_url}
              </a>
            </div>
          </Card>
          {role === "owner" && l.status === "pending_approval" && (
            <Card className="ring-spin space-y-3">
              <h3 className="text-lg font-bold">Approve this creative?</h3>
              <p className="text-sm text-muted">Deadline: <span className="text-white"><Countdown to={Number(l.approve_deadline_ms)} /></span>. Rejecting refunds the advertiser in full.</p>
              <div className="flex gap-2">
                <Button loading={busy === "approve"} onClick={() => act("approve", () => run(approveCreative({ escrowId })).then(() => refetch()), "Approved")} data-testid="approve"><Check className="h-4 w-4" /> Approve</Button>
                <Button variant="danger" loading={busy === "reject"} onClick={() => act("reject", () => run(rejectCreative({ escrowId, spaceId: l.space_id, calendarId: s.calendar_id })).then(() => refetch()), "Rejected and refunded")}>Reject</Button>
              </div>
            </Card>
          )}
          {(role === "owner" || role === "advertiser") && !["pending_approval", "cancelled"].includes(l.status) && (
            <Card>
              <h3 className="font-bold">Print files</h3>
              <p className="mb-3 text-xs text-muted">300 dpi, 3 mm bleed, dashed cut line.</p>
              <div className="grid grid-cols-2 gap-2">
                {[["exact", `Exact ${s.width_mm / 10}×${s.height_mm / 10} cm`], ["S", "Small (5 cm)"], ["M", "Medium (10 cm)"], ["L", "Large (20 cm)"]].map(([k, label], i) => (
                  <motion.div key={k} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="rounded-2xl border border-line bg-white/[0.02] p-3 text-xs transition-colors hover:border-p/40">
                    <div className="font-semibold">{label}</div>
                    <div className="mt-2 flex gap-1.5">
                      <button className="inline-flex items-center gap-1 rounded-full bg-p/15 px-2.5 py-1 font-semibold text-p transition-colors hover:bg-p hover:text-ink" disabled={!!busy} onClick={() => download(k, "pdf")} data-testid={`print-${k}-pdf`}>{busy === `dl-${k}-pdf` ? <Spinner className="h-3 w-3" /> : <Download className="h-3 w-3" />}PDF</button>
                      <button className="inline-flex items-center gap-1 rounded-full bg-white/[0.06] px-2.5 py-1 font-semibold text-white/80 transition-colors hover:bg-white hover:text-ink" disabled={!!busy} onClick={() => download(k, "png")}>{busy === `dl-${k}-png` && <Spinner className="h-3 w-3" />}PNG</button>
                    </div>
                  </motion.div>
                ))}
              </div>
            </Card>
          )}
          {role === "advertiser" && l.status === "live" && Date.now() < data.disputeOpenUntil && (
            <Card>
              <h3 className="font-bold">Something wrong?</h3>
              <p className="text-sm text-muted">You can dispute within <Countdown to={data.disputeOpenUntil} /> of the last proof. Releases pause until an admin resolves it.</p>
              <Button variant="danger" className="mt-3" loading={busy === "dispute"} onClick={() => act("dispute", () => run(openDispute({ escrowId })).then(() => refetch()), "Dispute opened")}>Open dispute</Button>
            </Card>
          )}
          {role === "advertiser" && ["awaiting_install", "live"].includes(l.status) && (
            <Card>
              <h3 className="font-bold">Extend</h3>
              <Button variant="secondary" className="mt-3" loading={busy === "extend"} onClick={() => { const w = Number(prompt("Extra weeks", "1")); if (w > 0) act("extend", async () => { const leaseObj = l.lease_id; await run(extendLease({ escrowId, leaseId: leaseObj, spaceId: l.space_id, calendarId: s.calendar_id, amount: BigInt(s.price_per_week) * BigInt(w), extraWeeks: w })); refetch(); }, "Lease extended"); }}>
                <Plus className="h-4 w-4" /> Add weeks ({usdc(s.price_per_week)}/week)
              </Button>
            </Card>
          )}
          {data.conversationId && (
            <motion.div whileHover={{ y: -3 }}>
              <Link href={`/messages/${data.conversationId}`} className="glass flex items-center gap-3 rounded-3xl p-4 text-sm font-semibold transition-colors hover:border-p/40">
                <span className="grid h-9 w-9 place-items-center rounded-full bg-p/15 text-p"><MessageCircle className="h-4 w-4" /></span>
                Open chat with the {role === "owner" ? "advertiser" : "owner"}
              </Link>
            </motion.div>
          )}
          <Card className="space-y-1.5 text-xs text-muted">
            <div>ENS lease name: <a className="break-all font-mono text-p hover:underline" href={`/${leaseName}`}>{leaseName}</a></div>
            <div>Escrow: <a className="font-mono text-p hover:underline" href={suiscan("object", escrowId)} target="_blank" rel="noreferrer">{escrowId.slice(0, 18)}…</a></div>
            {l.via_operator && <div className="flex items-center gap-1.5 text-p-200"><Bot className="h-3.5 w-3.5" /> Booked by an AI agent via x402</div>}
          </Card>
        </div>
      </div>
    </div>
  );
}
