"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowUpRight, Coins, FileText, PenLine, ShieldAlert } from "lucide-react";
import { useSession } from "@/lib/client/session";
import { createOffering } from "@/lib/sui/tx";
import { WALRUS } from "@/lib/deployment";
import { AnimatedNumber, Badge, Button, Card, EASE, Field, GradeBadge, Img, Input, PageHeader, PageLoader, Select, useAction, usdc } from "@/components/ui";
import { EnsName } from "@/components/ens";

function Bar({ label, value, total, tone }: { label: string; value: number; total: number; tone: "p" | "w" }) {
  const pct = total > 0 ? Math.max(0, Math.min(100, (value / total) * 100)) : 0;
  return (
    <div>
      <div className="mb-1.5 flex justify-between text-xs">
        <span className="text-muted">{label}</span>
        <span className="font-mono font-semibold"><AnimatedNumber value={value} duration={500} /> · {pct.toFixed(0)}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-white/[0.06]">
        <motion.div className={tone === "p" ? "h-full rounded-full bg-gradient-to-r from-p-600 to-p" : "h-full rounded-full bg-white/70"} animate={{ width: `${pct}%` }} transition={{ type: "spring", stiffness: 120, damping: 20 }} />
      </div>
    </div>
  );
}

export default function Tokenise({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { api, run, signMessage, me } = useSession();
  const router = useRouter();
  const { data } = useQuery({ queryKey: ["space", id], queryFn: () => api<any>(`/api/spaces/${id}`) });
  const [p, setP] = useState({ share: "60", retained: "2000", price: "0.001", minRaise: "4000", perInvestor: "8000", term: "24", duration: "30" });
  const [prep, setPrep] = useState<any>(null);
  const { busy, run: act } = useAction();
  if (!data) return <PageLoader label="Loading space" />;
  const s = data.space;
  const offered = 10000 - Number(p.retained);
  const verified = me?.kyc?.status === "approved";
  const params_ = () => ({
    spaceId: id,
    revenueShareBps: Math.round(Number(p.share) * 100),
    retainedUnits: Number(p.retained),
    pricePerUnit: String(Math.round(Number(p.price) * 1e6)),
    minRaiseUnits: Number(p.minRaise),
    saleDurationMs: Number(p.duration) * 60_000,
    perInvestorMax: Number(p.perInvestor),
    termMonths: Number(p.term),
  });
  const prepare = () => act("prep", async () => setPrep(await api<any>("/api/offerings/prepare", { method: "POST", json: params_() })));
  const create = () =>
    act("create", async () => {
      const signature = await signMessage(prep.message);
      const acc = await api<any>("/api/acceptances", { method: "POST", json: { message: prep.message, signature, role: "owner", units: Number(p.retained) } });
      const pp = params_();
      const r = await run(
        createOffering({
          spaceId: id,
          revenueShareBps: pp.revenueShareBps,
          retainedUnits: pp.retainedUnits,
          pricePerUnit: BigInt(pp.pricePerUnit),
          minRaiseUnits: pp.minRaiseUnits,
          saleDurationMs: BigInt(pp.saleDurationMs),
          perInvestorMax: pp.perInvestorMax,
          termMonths: pp.termMonths,
          legalPackHash: prep.pack.packHash,
          legalPackBlobId: prep.pack.indexBlobId,
          ownerAcceptSigHash: acc.sigHash,
        }),
      );
      const ev = r.events.find((e) => e.type.endsWith("OfferingOpened"));
      router.push(`/offerings/${ev!.json.offering_id}`);
    }, "Offering opened");
  const set = (k: string, v: string) => { setP({ ...p, [k]: v }); setPrep(null); };
  const n = (v: string) => (Number.isFinite(Number(v)) ? Number(v) : 0);
  const raise = Math.max(0, offered) * n(p.price);
  const minRaiseUsd = n(p.minRaise) * n(p.price);
  const weekly = Number(s.price_per_week ?? 0) / 1e6;
  const investorWeekly = weekly * (n(p.share) / 100);
  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6">
      <PageHeader kicker="Tokenise" title={`Tokenise ${s.label}`} sub="Get cash now for a share of this space's future lease income. 10,000 revenue units; you keep some and sell the rest to verified investors." />

      <Card className="mb-6 flex items-center gap-4">
        <Img blob={s.closeup_blob_id} alt="" className="h-16 w-16 shrink-0 rounded-2xl" />
        <div className="min-w-0 flex-1">
          <EnsName name={s.ens_name} kind="space" size="xs" />
          <div className="text-sm text-muted">{usdc(s.price_per_week)}/week · {s.completed_leases} completed leases · {s.accepted_proofs} proofs</div>
        </div>
        <GradeBadge grade={s.grade} aqs={s.aqs} />
      </Card>

      <AnimatePresence>
        {!verified && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mb-6 flex flex-wrap items-center gap-3 rounded-3xl border border-p-300/30 bg-p-300/10 p-4 text-sm">
            <ShieldAlert className="h-5 w-5 text-p-300" />
            <span className="flex-1">You need to verify your identity before tokenising.</span>
            <Link href="/verify" className="inline-flex items-center gap-1 font-bold text-p hover:underline">Verify now <ArrowUpRight className="h-4 w-4" /></Link>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <Card className="grid gap-4 sm:grid-cols-2">
            <Field label="Revenue share to investors (%)" hint="Of gross lease revenue; max 88%"><Input value={p.share} onChange={(e) => set("share", e.target.value)} data-testid="t-share" /></Field>
            <Field label="Units you keep" hint={`${offered.toLocaleString()} offered`}><Input value={p.retained} onChange={(e) => set("retained", e.target.value)} data-testid="t-retained" /></Field>
            <Field label="Price per unit (USDC)" hint={`Raise if sold out: ${usdc(Math.round(offered * Number(p.price) * 1e6))}`}><Input value={p.price} onChange={(e) => set("price", e.target.value)} data-testid="t-price" /></Field>
            <Field label="Minimum raise (units)"><Input value={p.minRaise} onChange={(e) => set("minRaise", e.target.value)} data-testid="t-min" /></Field>
            <Field label="Max units per investor"><Input value={p.perInvestor} onChange={(e) => set("perInvestor", e.target.value)} data-testid="t-max" /></Field>
            <Field label="Term (months)"><Select value={p.term} onChange={(e) => set("term", e.target.value)}>{[6, 12, 18, 24, 36].map((m) => <option key={m}>{m}</option>)}</Select></Field>
            <Field label="Sale window (minutes)" hint="Testnet allows 5 minutes to 30 days"><Input value={p.duration} onChange={(e) => set("duration", e.target.value)} data-testid="t-duration" /></Field>
            <div className="flex items-end">
              <Button className="w-full" loading={busy === "prep"} onClick={prepare} data-testid="t-prepare"><FileText className="h-4 w-4" /> Generate legal pack</Button>
            </div>
          </Card>

          <AnimatePresence>
            {prep && (
              <motion.div initial={{ opacity: 0, y: 24, filter: "blur(8px)" }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }} exit={{ opacity: 0, y: 10 }} transition={{ duration: 0.6, ease: EASE }} className="glass ring-spin space-y-4 rounded-[28px] p-6">
                <h2 className="flex flex-wrap items-center gap-2 text-lg font-bold">{prep.pack.series} <Badge tone="warn">mock documents</Badge></h2>
                <div className="grid gap-2 sm:grid-cols-2">
                  {prep.pack.documents.map((d: any, i: number) => (
                    <motion.a key={d.key} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 + i * 0.06 }} className="group flex items-center gap-3 rounded-2xl border border-line p-3 text-sm transition-colors hover:border-p/50 hover:bg-p/[0.06]" href={`${WALRUS.aggregator}/v1/blobs/${d.blobId}`} target="_blank" rel="noreferrer">
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-p/15 text-p"><FileText className="h-4 w-4" /></span>
                      <span className="flex-1">{d.title}</span>
                      <ArrowUpRight className="h-4 w-4 text-muted transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-p" />
                    </motion.a>
                  ))}
                </div>
                <div className="rounded-2xl bg-white/[0.04] p-4 text-xs text-white/70">
                  <div className="mb-1 flex items-center gap-1.5 font-semibold text-white"><PenLine className="h-3.5 w-3.5 text-p" /> You will sign</div>
                  <code className="break-all font-mono">{prep.message}</code>
                </div>
                {prep.demoMode && s.completed_leases < 1 && s.accepted_proofs < 1 && <p className="text-xs text-p-300">Testnet demo mode: track-record requirement waived.</p>}
                <Button size="lg" className="w-full" loading={busy === "create"} disabled={!verified} onClick={create} data-testid="t-create">Sign agreement & open offering</Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="lg:sticky lg:top-[140px] lg:self-start">
          <Card className="relative overflow-hidden">
            <div aria-hidden className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-p/20 blur-3xl" />
            <div className="relative">
              <div className="flex items-center gap-2 text-sm font-semibold text-muted"><Coins className="h-4 w-4 text-p" /> Live preview</div>
              <div className="mt-4 text-xs text-muted">Raise if sold out</div>
              <div className="text-4xl font-extrabold tracking-tighter">
                $<AnimatedNumber value={raise} duration={600} format={(v) => v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} />
              </div>
              <div className="mt-1 text-xs text-muted">
                Minimum to close: <span className="font-mono text-white">${minRaiseUsd.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
              </div>

              <div className="mt-6 flex h-3 overflow-hidden rounded-full bg-white/[0.06]">
                <motion.div className="h-full bg-white/80" animate={{ width: `${Math.max(0, Math.min(100, n(p.retained) / 100))}%` }} transition={{ type: "spring", stiffness: 120, damping: 20 }} />
                <motion.div className="h-full bg-gradient-to-r from-p-600 to-p" animate={{ width: `${Math.max(0, Math.min(100, offered / 100))}%` }} transition={{ type: "spring", stiffness: 120, damping: 20 }} />
              </div>
              <div className="mt-2 flex justify-between text-[11px] text-muted">
                <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-white/80" /> You keep</span>
                <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-p" /> Offered</span>
              </div>

              <div className="mt-6 space-y-4">
                <Bar label="Units offered" value={Math.max(0, offered)} total={10000} tone="p" />
                <Bar label="Minimum raise (units)" value={n(p.minRaise)} total={Math.max(1, offered)} tone="w" />
                <Bar label="Max per investor" value={n(p.perInvestor)} total={Math.max(1, offered)} tone="w" />
              </div>

              <div className="mt-6 grid grid-cols-2 gap-3 border-t border-line pt-5 text-sm">
                <div>
                  <div className="text-xs text-muted">To investors / week</div>
                  <div className="font-bold">$<AnimatedNumber value={investorWeekly} duration={500} format={(v) => v.toFixed(2)} /></div>
                </div>
                <div>
                  <div className="text-xs text-muted">You keep / week</div>
                  <div className="font-bold">$<AnimatedNumber value={Math.max(0, weekly - investorWeekly)} duration={500} format={(v) => v.toFixed(2)} /></div>
                </div>
                <div>
                  <div className="text-xs text-muted">Term</div>
                  <div className="font-bold">{p.term} months</div>
                </div>
                <div>
                  <div className="text-xs text-muted">Sale window</div>
                  <div className="font-bold">{p.duration} min</div>
                </div>
              </div>
              <p className="mt-4 text-[11px] text-muted">Weekly figures assume the space is leased every week at its current price.</p>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
