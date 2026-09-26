"use client";
import Link from "next/link";
import { use, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Coins, Eye, Loader2, Megaphone, Pause, Play, Plus, Rocket, ScanSearch } from "lucide-react";
import { useSession } from "@/lib/client/session";
import { addSpace, buySponsorship, setPrice, spaceStatus } from "@/lib/sui/tx";
import { MATERIALS, PLACEMENTS } from "@/lib/categories";
import { toAtomic } from "@/lib/deployment";
import { AqsPanel } from "@/components/aqs";
import { Badge, Button, Card, EASE, Empty, Field, GradeBadge, Img, Input, Modal, PageLoader, cx, useAction, usdc } from "@/components/ui";
import { FlowChoice, FlowFrame, FlowInput, FlowNext, FlowOverlay, FlowQuestion, useFlow } from "@/components/flow";
import { EnsName } from "@/components/ens";
import { PhotoCapture } from "@/components/photo-capture";

const STEPS = ["Checking photo quality…", "Checking authenticity…", "Scoring the space…", "Scoring the space (second opinion)…"];

function AddSpace({ objectId, onDone, onClose }: { objectId: string; onDone: () => void; onClose: () => void }) {
  const { api, run } = useSession();
  const [f, setF] = useState({ label: "", widthCm: "", heightCm: "", placement: "rear", material: "anodised aluminium" });
  const [photo, setPhoto] = useState<{ file: File; source: "camera" | "upload"; url: string } | null>(null);
  const [res, setRes] = useState<any>(null);
  const [price, setPriceV] = useState("");
  const [phase, setPhase] = useState(-1);
  const flow = useFlow(6);
  const { busy, run: act } = useAction();
  const set = (k: keyof typeof f, v: string) => {
    setF((x) => ({ ...x, [k]: v }));
    if (res) setRes(null);
  };
  const analyze = () =>
    act("analyze", async () => {
      setRes(null);
      let i = 0;
      setPhase(0);
      const t = setInterval(() => setPhase(Math.min(++i, STEPS.length - 1)), 6000);
      try {
        const fd = new FormData();
        Object.entries(f).forEach(([k, v]) => fd.set(k, v));
        fd.set("objectId", objectId);
        fd.set("image", photo!.file);
        fd.set("captureSource", photo!.source);
        const out = await api<any>("/api/spaces/analyze", { method: "POST", body: fd });
        setRes(out);
        if (out?.result?.decision === "ACCEPTED") setTimeout(() => flow.go(5), 900);
      } finally {
        clearInterval(t);
        setPhase(-1);
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
  const accepted = r?.decision === "ACCEPTED";
  const size = Number(f.widthCm) > 0 && Number(f.heightCm) > 0;
  const can = [f.label.trim().length > 0, size, true, true, accepted, Number(price) > 0][flow.i];
  const num = (v: string) => v.replace(/[^\d.]/g, "");
  const next = () => {
    if (!can) return;
    if (flow.i === 5) list();
    else flow.next();
  };
  return (
    <FlowOverlay open onClose={onClose} title="Add an ad space">
      <FlowFrame flow={flow} canNext={can && flow.i < 5} onEnter={next} chapters={[{ label: "The space", from: 0 }, { label: "Photo", from: 4 }, { label: "Price", from: 5 }]}>
        {flow.i === 0 && (
          <FlowQuestion n={1} required title="What do you call this space?" sub="A short name for this part of the object, like lid-center or rear-panel. It becomes part of its ENS name.">
            <FlowInput value={f.label} onChange={(e) => set("label", e.target.value)} onEnter={next} placeholder="lid-center" data-testid="space-label" />
            <FlowNext onClick={next} disabled={!can} />
          </FlowQuestion>
        )}
        {flow.i === 1 && (
          <FlowQuestion n={2} required title={<>How big is <span className="text-p">{f.label || "it"}</span>?</>} sub="The printable area in centimetres. A rough measure is fine; the AI checks it against the photo.">
            <div className="flex flex-wrap items-end gap-4">
              <div className="w-32">
                <FlowInput inputMode="decimal" value={f.widthCm} onChange={(e) => set("widthCm", num(e.target.value))} onEnter={next} placeholder="18" data-testid="space-w" />
                <div className="mt-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted">Width, cm</div>
              </div>
              <span className="pb-9 text-3xl font-light text-white/30">×</span>
              <div className="w-32">
                <FlowInput autoFocus={false} inputMode="decimal" value={f.heightCm} onChange={(e) => set("heightCm", num(e.target.value))} onEnter={next} placeholder="17" data-testid="space-h" />
                <div className="mt-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted">Height, cm</div>
              </div>
            </div>
            <FlowNext onClick={next} disabled={!can} />
          </FlowQuestion>
        )}
        {flow.i === 2 && (
          <FlowQuestion n={3} title="Where on the object is it?" sub="Press a letter or tap to choose.">
            <FlowChoice columns={2} options={PLACEMENTS.map((p) => ({ id: p, label: p }))} value={f.placement} onChange={(v) => set("placement", v)} />
            <FlowNext onClick={next} />
          </FlowQuestion>
        )}
        {flow.i === 3 && (
          <FlowQuestion n={4} title="What's the surface made of?" sub="It tells the AI how a sticker or print will hold up.">
            <FlowChoice columns={2} options={MATERIALS.map((m) => ({ id: m, label: m }))} value={f.material} onChange={(v) => set("material", v)} />
            <FlowNext onClick={next} />
          </FlowQuestion>
        )}
        {flow.i === 4 && (
          <FlowQuestion n={5} required title="Take a close-up of just this section" sub="Place an ID card beside it for scale if you can. The AI scores the space from this photo.">
            <div className="space-y-6">
              <PhotoCapture purpose="space" label="Close-up of the space" testId="space-photo" preview={photo?.url} scanning={busy === "analyze"} onChange={(file, source) => { setPhoto({ file, source, url: URL.createObjectURL(file) }); setRes(null); }} />
              {!accepted && (
                <Button size="lg" onClick={analyze} loading={busy === "analyze"} disabled={!photo || !f.label || !size} data-testid="analyze">
                  <ScanSearch className="h-4 w-4" /> Analyse space
                </Button>
              )}
              <AnimatePresence>
                {busy === "analyze" && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                    <div className="space-y-2.5 border-l-2 border-p/40 py-1 pl-5">
                      {STEPS.map((label, k) => {
                        const state = k < phase ? "done" : k === phase ? "run" : "todo";
                        return (
                          <div key={label} className={cx("flex items-center gap-3 text-sm transition-opacity", state === "todo" && "opacity-40")}>
                            <span className={cx("grid h-7 w-7 place-items-center rounded-full", state === "done" ? "bg-p text-ink" : "bg-white/[0.06] text-p")}>
                              {state === "done" ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : state === "run" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Eye className="h-3.5 w-3.5" />}
                            </span>
                            <span className={state === "run" ? "font-semibold" : "text-white/70"}>{label}</span>
                          </div>
                        );
                      })}
                      <p className="pt-1 text-xs text-muted">AI checks take about 20–60 seconds.</p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
              <AnimatePresence>
                {r && !accepted && (
                  <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="border-l-2 border-white/30 py-1 pl-5" data-testid="space-result">
                    <div className="flex flex-wrap items-center gap-3 text-lg font-bold"><Badge tone="bad">Rejected</Badge> {r.reason}</div>
                    {!!r.tips?.length && (
                      <ul className="mt-3 space-y-1 text-sm text-white/75">
                        {r.tips.map((t: string) => (
                          <li key={t} className="flex gap-2"><span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-p" />{t}</li>
                        ))}
                      </ul>
                    )}
                    <Button variant="secondary" className="mt-4" onClick={() => { setPhoto(null); setRes(null); }}>Retake</Button>
                  </motion.div>
                )}
                {accepted && (
                  <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="flex items-center gap-3 text-lg font-bold">
                    <Badge tone="ok">Accepted</Badge> Scored {r.aqs}/100
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </FlowQuestion>
        )}
        {flow.i === 5 && accepted && (
          <FlowQuestion n={6} required title={<>Scored <span className="text-p">{r.aqs}/100</span>. What&apos;s your weekly price?</>} sub="A fixed price in USDC per week. Brands pay it into escrow, and it's released to you as proofs are accepted.">
            <div data-testid="space-result">
              <div className="flex items-end gap-3">
                <div className="w-44">
                  <FlowInput inputMode="decimal" value={price} onChange={(e) => setPriceV(num(e.target.value))} onEnter={next} placeholder="1.00" data-testid="space-price" />
                </div>
                <span className="pb-4 text-lg font-semibold text-muted">USDC / week</span>
              </div>
              <div className="mt-8 flex flex-wrap items-center gap-4">
                <Button size="lg" onClick={list} loading={busy === "list"} disabled={!(Number(price) > 0)} data-testid="list-space">
                  <Rocket className="h-4 w-4" /> List space
                </Button>
                <span className="text-xs text-muted">Signs one Sui transaction.</span>
              </div>
              <p className="mt-4 flex flex-wrap items-center gap-1.5 text-xs text-muted">
                Its ENS name <EnsName name={res.tx.ensName} kind="space" size="xs" /> is registered on Sepolia automatically, with the score and price written as records.
              </p>
              <details className="mt-10">
                <summary className="cursor-pointer list-none text-sm font-semibold text-p hover:underline">See the full score breakdown</summary>
                <div className="mt-5"><AqsPanel r={r} /></div>
              </details>
            </div>
          </FlowQuestion>
        )}
      </FlowFrame>
    </FlowOverlay>
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
      <div className="mt-5 grid grid-cols-2 gap-3">
        {([1, 2] as const).map((t) => (
          <motion.button key={t} whileTap={{ scale: 0.97 }} onClick={() => setTier(t)} className={cx("relative overflow-hidden rounded-2xl border p-4 text-left transition-colors", tier === t ? "border-p" : "border-line-strong hover:border-p/40")}>
            {tier === t && <motion.span layoutId="tier" className="absolute inset-0 bg-p/15" transition={{ type: "spring", stiffness: 400, damping: 30 }} />}
            <Megaphone className="relative h-5 w-5 text-p" />
            <div className="relative mt-2 font-bold">Tier {t}</div>
            <div className="relative text-xs text-muted">{t === 1 ? "Category & search slots" : "Homepage sponsored rail + slots"}</div>
          </motion.button>
        ))}
      </div>
      <div className="mt-4">
        <Field label="Days">
          <Input type="number" min={1} max={90} value={days} onChange={(e) => setDays(Number(e.target.value))} />
        </Field>
      </div>
      <Button className="mt-5 w-full" size="lg" loading={busy === "s"} disabled={!quote} data-testid="buy-sponsorship" onClick={() => act("s", async () => { await run(buySponsorship({ objectId, amount: BigInt(quote.amount), tier, days })); onDone(); onClose(); }, "Sponsored!")}>
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
  if (isLoading) return <PageLoader label="Loading object" />;
  if (!data?.object) return <div className="mx-auto max-w-xl p-10"><Empty title="Object not found" /></div>;
  const o = data.object;
  const mine = address === o.owner_address;
  const sponsored = o.sponsored_until && new Date(o.sponsored_until).getTime() > Date.now();
  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6">
      <div className="grid gap-5 lg:h-[calc(100dvh-172px)] lg:min-h-[600px] lg:grid-cols-[380px_1fr]">
        <div className="flex min-h-0 flex-col">
          <div className="glass flex min-h-0 flex-1 flex-col overflow-hidden rounded-3xl">
            <div className="relative aspect-[4/3] shrink-0 lg:aspect-auto lg:h-[38%]">
              <Img blob={o.hero_blob_id} alt={o.title} className="h-full w-full" />
              <div className="absolute inset-0 bg-gradient-to-t from-p-950 via-transparent to-transparent" />
            </div>
            <div className="relative min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain p-6">
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-extrabold tracking-tight">{o.title}</h1>
                {o.object_grade > 0 && <GradeBadge grade={o.object_grade} aqs={o.object_aqs} size="sm" />}
              </div>
              <div className="text-sm text-muted">
                {o.object_type ?? "object"} {o.city && `· ${o.city}`} {o.viewing_distance_m && `· seen from ~${o.viewing_distance_m} m`}
              </div>
              {o.ens_name && (
                <div className="space-y-2">
                  <EnsName name={o.ens_name} status={data.ensStatus?.[o.ens_name]} kind="object" full />
                  {data.ensStatus?.[o.ens_name] !== "registered" && (
                    <div className="relative overflow-hidden rounded-xl border border-p/25 bg-p/[0.06] px-3 py-2 text-[11px] text-white/75">
                      <span aria-hidden className="absolute inset-y-0 -left-1/3 w-1/3 bg-gradient-to-r from-transparent via-p/20 to-transparent [animation:sweep_2.2s_ease-in-out_infinite]" />
                      <span className="relative">The relayer is registering this name on Sepolia ENS and writing its records. This page updates on its own.</span>
                    </div>
                  )}
                </div>
              )}
              {sponsored && <Badge tone="sponsored">Sponsored until {new Date(o.sponsored_until).toLocaleString()}</Badge>}
              {o.description && <p className="text-sm leading-relaxed text-white/75">{o.description}</p>}
            </div>
            {mine && (
              <div className="flex shrink-0 gap-2 border-t border-line p-4">
                <Button className="flex-1" onClick={() => setAdding(true)} data-testid="add-space">
                  <Plus className="h-4 w-4" /> Add space
                </Button>
                <Button variant="secondary" onClick={() => setSponsoring(true)} disabled={!data.spaces.length} data-testid="sponsor">
                  <Megaphone className="h-4 w-4" /> Boost
                </Button>
              </div>
            )}
          </div>
        </div>
        <div className="glass flex min-h-0 flex-col overflow-hidden rounded-3xl">
          <div className="flex shrink-0 items-end justify-between gap-3 border-b border-line px-5 py-4">
            <h2 className="text-lg font-extrabold tracking-tight">Ad spaces</h2>
            <span className="text-xs text-muted">{data.spaces.length} listed</span>
          </div>
          <div className="relative min-h-0 flex-1">
          <div className="overflow-y-auto overscroll-contain p-5 lg:absolute lg:inset-0">
          {!data.spaces.length && <Empty title="No spaces yet">{mine ? "Add your first ad space. Each gets its own AI score." : "The owner hasn't listed spaces yet."}</Empty>}
          <div className="grid gap-5 sm:grid-cols-2 2xl:grid-cols-3">
            {data.spaces.map((s: any, i: number) => (
              <motion.div key={s.id} initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07, duration: 0.6, ease: EASE }}>
                <div className="group overflow-hidden rounded-3xl border border-line bg-white/[0.03] transition-colors hover:border-p/40">
                  <Link href={`/${s.ens_name}`} className="relative block overflow-hidden">
                    <Img blob={s.closeup_blob_id} alt={s.label} className="aspect-[16/10] w-full transition-transform duration-700 group-hover:scale-110" />
                    <div className="absolute inset-0 bg-gradient-to-t from-ink/80 to-transparent" />
                    <div className="absolute left-3 top-3">{s.grade > 0 ? <GradeBadge grade={s.grade} aqs={s.aqs} size="sm" /> : <Badge tone="warn">{s.status}</Badge>}</div>
                    <span className="absolute bottom-3 right-3 rounded-full bg-p px-3 py-1 text-xs font-extrabold text-ink">{usdc(s.price_per_week)}/wk</span>
                  </Link>
                  <div className="space-y-3 p-4">
                    <div className="flex items-center justify-between gap-2">
                      <Link href={`/${s.ens_name}`} className="font-bold hover:text-p">{s.label}</Link>
                      <span className="text-xs text-muted">{s.width_mm / 10}×{s.height_mm / 10} cm · {s.placement}</span>
                    </div>
                    {s.ens_name && <EnsName name={s.ens_name} status={data.ensStatus?.[s.ens_name]} kind="space" size="xs" />}
                    <div className="flex flex-wrap gap-1.5">
                      <Badge>{s.status}</Badge>
                      {s.offering_id && <Badge tone="brand">Tokenised</Badge>}
                      {s.active_leases > 0 && <Badge tone="ok">{s.active_leases} active lease(s)</Badge>}
                    </div>
                    {mine && s.status !== "removed" && (
                      <div className="flex flex-wrap gap-2 border-t border-line pt-3">
                        <Button size="sm" variant="secondary" loading={busy === `p${s.id}`} onClick={() => { const v = prompt("New price (USDC per week)", String(Number(s.price_per_week) / 1e6)); if (v) act(`p${s.id}`, () => run(setPrice({ spaceId: s.id, pricePerWeek: toAtomic(Number(v)) })).then(() => refetch()), "Price updated"); }}>
                          <Coins className="h-3.5 w-3.5" /> Price
                        </Button>
                        {s.status === "available" && <Button size="sm" variant="secondary" loading={busy === `x${s.id}`} onClick={() => act(`x${s.id}`, () => run(spaceStatus({ spaceId: s.id, action: "pause_space" })).then(() => refetch()))}><Pause className="h-3.5 w-3.5" /> Pause</Button>}
                        {s.status === "paused" && <Button size="sm" variant="secondary" loading={busy === `x${s.id}`} onClick={() => act(`x${s.id}`, () => run(spaceStatus({ spaceId: s.id, action: "unpause_space" })).then(() => refetch()))}><Play className="h-3.5 w-3.5" /> Unpause</Button>}
                        {!s.offering_id && s.grade >= 2 && s.status === "available" && (
                          <Link href={`/spaces/${s.id}/tokenise`} className="inline-flex h-8 items-center gap-1.5 rounded-full bg-p/15 px-3.5 text-xs font-semibold text-p transition-colors hover:bg-p hover:text-ink">
                            <Coins className="h-3.5 w-3.5" /> Tokenise
                          </Link>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
          </div>
          </div>
        </div>
      </div>
      {adding && <AddSpace objectId={id} onDone={() => refetch()} onClose={() => setAdding(false)} />}
      {sponsoring && <Sponsor objectId={id} onClose={() => setSponsoring(false)} onDone={() => refetch()} />}
    </div>
  );
}
