"use client";
import Link from "next/link";
import { use, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "@/lib/client/session";
import { approveCreative, extendLease, openDispute, rejectCreative } from "@/lib/sui/tx";
import { Badge, Button, Card, Empty, Img, PhotoInput, Spinner, Stat, cx, suiscan, useAction, usdc } from "@/components/ui";

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
  const ms = to - Date.now();
  if (ms <= 0) return <span>now</span>;
  const m = Math.floor(ms / 60000);
  return <span>{m >= 1440 ? `${Math.floor(m / 1440)}d ${Math.floor((m % 1440) / 60)}h` : m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`}</span>;
}

function ProofUpload({ escrowId, next, onDone }: { escrowId: string; next: any; onDone: () => void }) {
  const { api } = useSession();
  const [code, setCode] = useState<string | null>(null);
  const [photo, setPhoto] = useState<{ file: File; url: string } | null>(null);
  const [res, setRes] = useState<any>(null);
  const { busy, run } = useAction();
  const open = Date.now() >= next.open;
  return (
    <Card className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">{next.period === 0 ? "Install proof" : `Proof for period ${next.period}`}</h3>
        <span className="text-sm text-muted">
          {open ? <>Due in <Countdown to={next.close} /></> : <>Opens in <Countdown to={next.open} /></>}
        </span>
      </div>
      {!open ? (
        <p className="text-sm text-muted">You can upload this proof when the window opens.</p>
      ) : !code ? (
        <Button variant="secondary" loading={busy === "code"} onClick={() => run("code", async () => setCode((await api<any>("/api/capture-codes", { method: "POST", json: { purpose: "proof" } })).code))} data-testid="get-code">
          Get a capture code
        </Button>
      ) : (
        <>
          <div className="rounded-xl border border-violet-200 bg-violet-50 p-3 text-sm">
            Write <span className="rounded bg-white px-2 font-mono text-lg font-bold tracking-widest" data-testid="proof-code">{code}</span> on a note next to the ad and snap it.
          </div>
          <PhotoInput label="Proof photo" testId="proof-photo" preview={photo?.url} onChange={(file) => { setPhoto({ file, url: URL.createObjectURL(file) }); setRes(null); }} />
          <Button
            disabled={!photo}
            loading={busy === "proof"}
            data-testid="submit-proof"
            onClick={() =>
              run("proof", async () => {
                const fd = new FormData();
                fd.set("escrowId", escrowId);
                fd.set("captureCode", code);
                fd.set("image", photo!.file);
                const r = await api<any>("/api/proofs", { method: "POST", body: fd });
                setRes(r);
                if (r.accepted) onDone();
                else setCode(null);
              })
            }
          >
            Submit proof
          </Button>
          {busy === "proof" && <p className="text-sm text-muted">Verifying your photo with AI…</p>}
        </>
      )}
      {res && (
        <div className={cx("rounded-xl p-3 text-sm", res.accepted ? "bg-emerald-50" : "bg-red-50")} data-testid="proof-result">
          {res.accepted ? <>✓ Accepted — escrow released. <a className="underline" href={suiscan("tx", res.digest)} target="_blank" rel="noreferrer">View tx</a></> : <>✗ {res.reason} Retake and try again with a new code.</>}
        </div>
      )}
    </Card>
  );
}

export default function LeasePage({ params }: { params: Promise<{ escrowId: string }> }) {
  const { escrowId } = use(params);
  const { api, run, token } = useSession();
  const { data, refetch, isLoading } = useQuery({ queryKey: ["lease", escrowId], queryFn: () => api<any>(`/api/leases/${escrowId}`), refetchInterval: 15000 });
  const { busy, run: act } = useAction();
  if (isLoading) return <div className="grid place-items-center py-24"><Spinner /></div>;
  if (!data) return <Empty title="Lease not found" />;
  const l = data.lease, s = l.spaces, role = data.role;
  const st = STATUS[l.status] ?? { label: l.status, tone: "neutral" };
  const download = async (size: string, format: string) => {
    const t = await token();
    const r = await fetch(`/api/leases/${escrowId}/print?size=${size}&format=${format}`, { headers: t ? { authorization: `Bearer ${t}` } : {}, credentials: "include" });
    const b = await r.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(b);
    a.download = `${l.ens_label}-${size}.${format}`;
    a.click();
  };
  const leaseName = `${l.ens_label}.${s.ens_name}`;
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm text-muted">
            Lease <span className="font-mono">{leaseName}</span>
          </div>
          <h1 className="text-2xl font-semibold">
            {l.brand} on <Link className="underline" href={`/${s.ens_name}`}>{s.label}</Link>
          </h1>
        </div>
        <Badge tone={st.tone} className="text-sm" >{st.label}</Badge>
      </div>
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Paid into escrow" value={usdc(l.total_paid)} />
            <Stat label="Released" value={usdc(l.released)} />
            <Stat label="Refunded" value={usdc(l.refunded)} />
            <Stat label="Link clicks" value={data.clicks} />
          </div>
          <Card>
            <h3 className="mb-3 font-semibold">Periods</h3>
            <div className="space-y-2">
              {data.periods.map((p: any) => (
                <div key={p.period} className="flex items-center justify-between rounded-xl border border-line px-3 py-2 text-sm">
                  <span>
                    {p.period === 0 ? "Install proof" : `Period ${p.period}`} · <span className="text-muted">closes {new Date(p.close).toLocaleString()}</span>
                  </span>
                  <span className="flex items-center gap-2">
                    {p.tranche && <span className="text-xs text-muted">{usdc(p.tranche.gross)}</span>}
                    <Badge tone={p.status === "released" ? "ok" : p.status === "refunded" ? "bad" : p.status === "due" ? "warn" : "neutral"}>{p.status}</Badge>
                  </span>
                </div>
              ))}
            </div>
          </Card>
          {role === "owner" && data.next && ["awaiting_install", "live"].includes(l.status) && <ProofUpload escrowId={escrowId} next={data.next} onDone={() => refetch()} />}
          <Card>
            <h3 className="mb-3 font-semibold">Proof photos</h3>
            {!data.proofs.length && <p className="text-sm text-muted">No proofs yet.</p>}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {data.proofs.map((p: any) => (
                <div key={p.id} className="overflow-hidden rounded-xl border border-line">
                  <Img blob={p.photo_blob_id} alt="proof" className="aspect-square w-full" />
                  <div className="p-2 text-xs">
                    <Badge tone={p.status === "accepted" ? "ok" : "bad"}>{p.status}</Badge> period {p.period}
                    {p.reason && <div className="mt-1 text-muted">{p.reason}</div>}
                    {p.digest && <a className="mt-1 block text-brand underline" href={suiscan("tx", p.digest)} target="_blank" rel="noreferrer">Sui tx</a>}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
        <div className="space-y-4">
          <Card>
            <h3 className="font-semibold">Creative</h3>
            <Img blob={l.creative_blob_id} alt="creative" className="mt-3 aspect-square w-full rounded-xl bg-white object-contain" />
            <div className="mt-2 text-sm">
              Landing:{" "}
              <a className="break-all underline" href={`/r/${escrowId}`} target="_blank" rel="noreferrer">
                {l.landing_url}
              </a>
            </div>
          </Card>
          {role === "owner" && l.status === "pending_approval" && (
            <Card className="space-y-2">
              <h3 className="font-semibold">Approve this creative?</h3>
              <p className="text-sm text-muted">Deadline: <Countdown to={Number(l.approve_deadline_ms)} />. Rejecting refunds the advertiser in full.</p>
              <div className="flex gap-2">
                <Button loading={busy === "approve"} onClick={() => act("approve", () => run(approveCreative({ escrowId })).then(() => refetch()), "Approved")} data-testid="approve">Approve</Button>
                <Button variant="danger" loading={busy === "reject"} onClick={() => act("reject", () => run(rejectCreative({ escrowId, spaceId: l.space_id, calendarId: s.calendar_id })).then(() => refetch()), "Rejected and refunded")}>Reject</Button>
              </div>
            </Card>
          )}
          {(role === "owner" || role === "advertiser") && !["pending_approval", "cancelled"].includes(l.status) && (
            <Card>
              <h3 className="font-semibold">Print files</h3>
              <p className="mb-3 text-xs text-muted">300 dpi, 3 mm bleed, dashed cut line.</p>
              <div className="grid grid-cols-2 gap-2">
                {[["exact", `Exact ${s.width_mm / 10}×${s.height_mm / 10} cm`], ["S", "Small (5 cm)"], ["M", "Medium (10 cm)"], ["L", "Large (20 cm)"]].map(([k, label]) => (
                  <div key={k} className="rounded-xl border border-line p-2 text-xs">
                    <div className="font-medium">{label}</div>
                    <div className="mt-1 flex gap-2">
                      <button className="text-brand underline" onClick={() => download(k, "pdf")} data-testid={`print-${k}-pdf`}>PDF</button>
                      <button className="text-brand underline" onClick={() => download(k, "png")}>PNG</button>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
          {role === "advertiser" && l.status === "live" && Date.now() < data.disputeOpenUntil && (
            <Card>
              <h3 className="font-semibold">Something wrong?</h3>
              <p className="text-sm text-muted">You can dispute within <Countdown to={data.disputeOpenUntil} /> of the last proof. Releases pause until an admin resolves it.</p>
              <Button variant="danger" className="mt-2" loading={busy === "dispute"} onClick={() => act("dispute", () => run(openDispute({ escrowId })).then(() => refetch()), "Dispute opened")}>Open dispute</Button>
            </Card>
          )}
          {role === "advertiser" && ["awaiting_install", "live"].includes(l.status) && (
            <Card>
              <h3 className="font-semibold">Extend</h3>
              <Button variant="secondary" className="mt-2" loading={busy === "extend"} onClick={() => { const w = Number(prompt("Extra weeks", "1")); if (w > 0) act("extend", async () => { const leaseObj = l.lease_id; await run(extendLease({ escrowId, leaseId: leaseObj, spaceId: l.space_id, calendarId: s.calendar_id, amount: BigInt(s.price_per_week) * BigInt(w), extraWeeks: w })); refetch(); }, "Lease extended"); }}>
                Add weeks ({usdc(s.price_per_week)}/week)
              </Button>
            </Card>
          )}
          {data.conversationId && (
            <Link href={`/messages/${data.conversationId}`} className="block rounded-2xl border border-line bg-surface p-4 text-sm font-medium hover:border-violet-300">
              💬 Open chat with the {role === "owner" ? "advertiser" : "owner"}
            </Link>
          )}
          <Card className="text-xs text-muted space-y-1">
            <div>ENS lease name: <a className="font-mono underline" href={`/${leaseName}`}>{leaseName}</a></div>
            <div>Escrow: <a className="font-mono underline" href={suiscan("object", escrowId)} target="_blank" rel="noreferrer">{escrowId.slice(0, 18)}…</a></div>
            {l.via_operator && <div>Booked by an AI agent via x402</div>}
          </Card>
        </div>
      </div>
    </div>
  );
}
