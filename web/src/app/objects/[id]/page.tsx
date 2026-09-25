"use client";
import Link from "next/link";
import { use, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "@/lib/client/session";
import { addSpace, buySponsorship, setPrice, spaceStatus } from "@/lib/sui/tx";
import { MATERIALS, PLACEMENTS } from "@/lib/categories";
import { toAtomic } from "@/lib/deployment";
import { AqsPanel } from "@/components/aqs";
import { Badge, Button, Card, Empty, Field, GradeBadge, Img, Input, Modal, PhotoInput, Select, Spinner, cx, useAction, usdc } from "@/components/ui";

function AddSpace({ objectId, onDone, onClose }: { objectId: string; onDone: () => void; onClose: () => void }) {
  const { api, run } = useSession();
  const [f, setF] = useState({ label: "", widthCm: "", heightCm: "", placement: "rear", material: "anodised aluminium" });
  const [photo, setPhoto] = useState<{ file: File; source: "camera" | "upload"; url: string } | null>(null);
  const [res, setRes] = useState<any>(null);
  const [price, setPriceV] = useState("");
  const [step, setStep] = useState("");
  const { busy, run: act } = useAction();
  const analyze = () =>
    act("analyze", async () => {
      setRes(null);
      const steps = ["Checking photo quality…", "Checking authenticity…", "Scoring the space…", "Scoring the space (second opinion)…"];
      let i = 0;
      setStep(steps[0]);
      const t = setInterval(() => setStep(steps[Math.min(++i, steps.length - 1)]), 6000);
      try {
        const fd = new FormData();
        Object.entries(f).forEach(([k, v]) => fd.set(k, v));
        fd.set("objectId", objectId);
        fd.set("image", photo!.file);
        fd.set("captureSource", photo!.source);
        setRes(await api<any>("/api/spaces/analyze", { method: "POST", body: fd }));
      } finally {
        clearInterval(t);
        setStep("");
      }
    });
  const list = () =>
    act("list", async () => {
      const r = await run(addSpace({ ...res.tx, pricePerWeek: toAtomic(Number(price)) }));
      await api("/api/spaces/finalize", { method: "POST", json: { analysisId: res.analysisId, digest: r.digest } });
      onDone();
      onClose();
    }, "Space listed!");
  const r = res?.result;
  return (
    <Modal open onClose={onClose} title="Add an ad space" wide>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Space name" hint="e.g. lid-center, rear-panel">
          <Input value={f.label} onChange={(e) => setF({ ...f, label: e.target.value })} data-testid="space-label" />
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Width (cm)">
            <Input inputMode="decimal" value={f.widthCm} onChange={(e) => setF({ ...f, widthCm: e.target.value })} data-testid="space-w" />
          </Field>
          <Field label="Height (cm)">
            <Input inputMode="decimal" value={f.heightCm} onChange={(e) => setF({ ...f, heightCm: e.target.value })} data-testid="space-h" />
          </Field>
        </div>
        <Field label="Placement">
          <Select value={f.placement} onChange={(e) => setF({ ...f, placement: e.target.value })}>
            {PLACEMENTS.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </Select>
        </Field>
        <Field label="Surface material">
          <Select value={f.material} onChange={(e) => setF({ ...f, material: e.target.value })}>
            {MATERIALS.map((m) => (
              <option key={m}>{m}</option>
            ))}
          </Select>
        </Field>
      </div>
      <div className="mt-4">
        <PhotoInput label="Close-up of this section only (place an ID card for scale if you can)" testId="space-photo" preview={photo?.url} onChange={(file, source) => { setPhoto({ file, source, url: URL.createObjectURL(file) }); setRes(null); }} />
      </div>
      <Button className="mt-4" onClick={analyze} loading={busy === "analyze"} disabled={!photo || !f.label || !f.widthCm || !f.heightCm} data-testid="analyze">
        Analyse space
      </Button>
      {busy === "analyze" && (
        <p className="mt-3 flex items-center gap-2 text-sm text-muted">
          <Spinner className="h-4 w-4" /> {step} (AI checks take ~20–60 s)
        </p>
      )}
      {r && (
        <div className={cx("mt-5 rounded-2xl p-4", r.decision === "ACCEPTED" ? "bg-emerald-50" : "bg-red-50")} data-testid="space-result">
          <div className="mb-3 flex items-center gap-2">
            {r.decision === "ACCEPTED" ? <Badge tone="ok">Accepted</Badge> : <Badge tone="bad">Rejected</Badge>}
            <span className="font-medium">{r.decision === "ACCEPTED" ? `Scored ${r.aqs}/100` : r.reason}</span>
          </div>
          {r.decision === "ACCEPTED" ? (
            <>
              <AqsPanel r={r} />
              <div className="mt-4 flex items-end gap-3">
                <Field label="Your fixed price (USDC per week)">
                  <Input inputMode="decimal" value={price} onChange={(e) => setPriceV(e.target.value)} placeholder="1.00" data-testid="space-price" />
                </Field>
                <Button onClick={list} loading={busy === "list"} disabled={!(Number(price) > 0)} data-testid="list-space">
                  List space
                </Button>
              </div>
              <p className="mt-2 text-xs text-muted">Listing signs one Sui transaction. Your ENS name {res.tx.ensName} is registered automatically.</p>
            </>
          ) : (
            <>
              {!!r.tips?.length && (
                <ul className="list-disc pl-5 text-sm">
                  {r.tips.map((t: string) => (
                    <li key={t}>{t}</li>
                  ))}
                </ul>
              )}
              <Button variant="secondary" className="mt-3" onClick={() => { setPhoto(null); setRes(null); }}>
                Retake
              </Button>
            </>
          )}
        </div>
      )}
    </Modal>
  );
}

function Sponsor({ objectId, onClose, onDone }: { objectId: string; onClose: () => void; onDone: () => void }) {
  const { run, api } = useSession();
  const [tier, setTier] = useState<1 | 2>(1);
  const [days, setDays] = useState(1);
  const { data: quote } = useQuery({ queryKey: ["sp", tier, days], queryFn: () => api<any>("/api/sponsor-quote?tier=" + tier + "&days=" + days) });
  const { busy, run: act } = useAction();
  return (
    <Modal open onClose={onClose} title="Boost with a Sponsored tag">
      <p className="text-sm text-muted">Sponsored cards appear in labelled slots (1 in 6) and never change your organic ranking or score.</p>
      <div className="mt-4 grid grid-cols-2 gap-3">
        {[1, 2].map((t) => (
          <button key={t} onClick={() => setTier(t as 1 | 2)} className={cx("rounded-xl border p-3 text-left", tier === t ? "border-brand bg-violet-50" : "border-line")}>
            <div className="font-medium">Tier {t}</div>
            <div className="text-xs text-muted">{t === 1 ? "Category & search slots" : "Homepage sponsored rail + slots"}</div>
          </button>
        ))}
      </div>
      <Field label="Days">
        <Input type="number" min={1} max={90} value={days} onChange={(e) => setDays(Number(e.target.value))} />
      </Field>
      <Button className="mt-4 w-full" loading={busy === "s"} disabled={!quote} data-testid="buy-sponsorship" onClick={() => act("s", async () => { await run(buySponsorship({ objectId, amount: BigInt(quote.amount), tier, days })); onDone(); onClose(); }, "Sponsored!")}>
        Pay {quote ? usdc(quote.amount) : "…"}
      </Button>
    </Modal>
  );
}

export default function ObjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { address, run } = useSession();
  const { data, refetch, isLoading } = useQuery({ queryKey: ["object", id], queryFn: () => fetch(`/api/objects/${id}`).then((r) => r.json()) });
  const [adding, setAdding] = useState(false);
  const [sponsoring, setSponsoring] = useState(false);
  const { busy, run: act } = useAction();
  useEffect(() => {
    const t = setInterval(() => refetch(), 15000);
    return () => clearInterval(t);
  }, [refetch]);
  if (isLoading) return <div className="grid place-items-center py-20"><Spinner /></div>;
  if (!data?.object) return <Empty title="Object not found" />;
  const o = data.object;
  const mine = address === o.owner_address;
  const sponsored = o.sponsored_until && new Date(o.sponsored_until).getTime() > Date.now();
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="grid gap-6 md:grid-cols-[360px_1fr]">
        <Card className="p-0 overflow-hidden">
          <Img blob={o.hero_blob_id} alt={o.title} className="aspect-[4/3] w-full" />
          <div className="space-y-2 p-5">
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold">{o.title}</h1>
              {o.object_grade > 0 && <GradeBadge grade={o.object_grade} aqs={o.object_aqs} size="sm" />}
            </div>
            <div className="text-sm text-muted">
              {o.object_type ?? "object"} {o.city && `· ${o.city}`} {o.viewing_distance_m && `· seen from ~${o.viewing_distance_m} m`}
            </div>
            <Link href={`/${o.ens_name}`} className="block font-mono text-xs text-brand underline">
              {o.ens_name}
            </Link>
            {sponsored && <Badge tone="sponsored">Sponsored until {new Date(o.sponsored_until).toLocaleString()}</Badge>}
            {o.description && <p className="text-sm">{o.description}</p>}
            {mine && (
              <div className="flex gap-2 pt-2">
                <Button onClick={() => setAdding(true)} data-testid="add-space">
                  + Add space
                </Button>
                <Button variant="secondary" onClick={() => setSponsoring(true)} disabled={!data.spaces.length} data-testid="sponsor">
                  Boost
                </Button>
              </div>
            )}
          </div>
        </Card>
        <div>
          <h2 className="mb-3 text-lg font-semibold">Ad spaces</h2>
          {!data.spaces.length && <Empty title="No spaces yet">{mine ? "Add your first ad space — each gets its own AI score." : "The owner hasn't listed spaces yet."}</Empty>}
          <div className="grid gap-3 sm:grid-cols-2">
            {data.spaces.map((s: any) => (
              <Card key={s.id} className="p-0 overflow-hidden">
                <Link href={`/${s.ens_name}`}>
                  <Img blob={s.closeup_blob_id} alt={s.label} className="aspect-[16/10] w-full" />
                </Link>
                <div className="space-y-2 p-4">
                  <div className="flex items-center justify-between">
                    <Link href={`/${s.ens_name}`} className="font-semibold hover:underline">
                      {s.label}
                    </Link>
                    {s.grade > 0 ? <GradeBadge grade={s.grade} aqs={s.aqs} size="sm" /> : <Badge tone="warn">{s.status}</Badge>}
                  </div>
                  <div className="text-sm text-muted">
                    {s.width_mm / 10}×{s.height_mm / 10} cm · {s.placement} · {usdc(s.price_per_week)}/week
                  </div>
                  <div className="flex flex-wrap gap-1">
                    <Badge>{s.status}</Badge>
                    {s.offering_id && <Badge tone="brand">Tokenised</Badge>}
                    {s.active_leases > 0 && <Badge tone="ok">{s.active_leases} active lease(s)</Badge>}
                  </div>
                  {mine && s.status !== "removed" && (
                    <div className="flex flex-wrap gap-2 pt-1">
                      <Button size="sm" variant="secondary" loading={busy === `p${s.id}`} onClick={() => { const v = prompt("New price (USDC per week)", String(Number(s.price_per_week) / 1e6)); if (v) act(`p${s.id}`, () => run(setPrice({ spaceId: s.id, pricePerWeek: toAtomic(Number(v)) })).then(() => refetch()), "Price updated"); }}>
                        Price
                      </Button>
                      {s.status === "available" && <Button size="sm" variant="secondary" loading={busy === `x${s.id}`} onClick={() => act(`x${s.id}`, () => run(spaceStatus({ spaceId: s.id, action: "pause_space" })).then(() => refetch()))}>Pause</Button>}
                      {s.status === "paused" && <Button size="sm" variant="secondary" loading={busy === `x${s.id}`} onClick={() => act(`x${s.id}`, () => run(spaceStatus({ spaceId: s.id, action: "unpause_space" })).then(() => refetch()))}>Unpause</Button>}
                      {!s.offering_id && s.grade >= 2 && s.status === "available" && (
                        <Link href={`/spaces/${s.id}/tokenise`} className="rounded-xl border border-line px-3 py-1.5 text-sm hover:border-violet-300">
                          Tokenise
                        </Link>
                      )}
                    </div>
                  )}
                </div>
              </Card>
            ))}
          </div>
        </div>
      </div>
      {adding && <AddSpace objectId={id} onDone={() => refetch()} onClose={() => setAdding(false)} />}
      {sponsoring && <Sponsor objectId={id} onClose={() => setSponsoring(false)} onDone={() => refetch()} />}
    </div>
  );
}
