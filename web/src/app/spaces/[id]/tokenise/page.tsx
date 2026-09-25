"use client";
import { useRouter } from "next/navigation";
import { use, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "@/lib/client/session";
import { createOffering } from "@/lib/sui/tx";
import { WALRUS } from "@/lib/deployment";
import { Badge, Button, Card, Field, GradeBadge, Img, Input, Select, Spinner, useAction, usdc } from "@/components/ui";

export default function Tokenise({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { api, run, signMessage, me } = useSession();
  const router = useRouter();
  const { data } = useQuery({ queryKey: ["space", id], queryFn: () => api<any>(`/api/spaces/${id}`) });
  const [p, setP] = useState({ share: "60", retained: "2000", price: "0.001", minRaise: "4000", perInvestor: "8000", term: "24", duration: "30" });
  const [prep, setPrep] = useState<any>(null);
  const { busy, run: act } = useAction();
  if (!data) return <div className="grid place-items-center py-24"><Spinner /></div>;
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
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-3xl font-semibold">Tokenise {s.label}</h1>
      <p className="mt-1 text-muted">Get cash now for a share of this space&apos;s future lease income. 10,000 revenue units; you keep some and sell the rest to verified investors.</p>
      <Card className="mt-6 flex items-center gap-4">
        <Img blob={s.closeup_blob_id} alt="" className="h-16 w-16 rounded-xl" />
        <div className="flex-1">
          <div className="font-semibold">{s.ens_name}</div>
          <div className="text-sm text-muted">{usdc(s.price_per_week)}/week · {s.completed_leases} completed leases · {s.accepted_proofs} proofs</div>
        </div>
        <GradeBadge grade={s.grade} aqs={s.aqs} />
      </Card>
      {!verified && (
        <Card className="mt-4 bg-amber-50">
          <p className="text-sm">You need to verify your identity before tokenising. <a className="underline" href="/verify">Verify now</a></p>
        </Card>
      )}
      <Card className="mt-4 grid gap-4 sm:grid-cols-2">
        <Field label="Revenue share to investors (%)" hint="Of gross lease revenue; max 88%"><Input value={p.share} onChange={(e) => set("share", e.target.value)} data-testid="t-share" /></Field>
        <Field label="Units you keep" hint={`${offered.toLocaleString()} offered`}><Input value={p.retained} onChange={(e) => set("retained", e.target.value)} data-testid="t-retained" /></Field>
        <Field label="Price per unit (USDC)" hint={`Raise if sold out: ${usdc(Math.round(offered * Number(p.price) * 1e6))}`}><Input value={p.price} onChange={(e) => set("price", e.target.value)} data-testid="t-price" /></Field>
        <Field label="Minimum raise (units)"><Input value={p.minRaise} onChange={(e) => set("minRaise", e.target.value)} data-testid="t-min" /></Field>
        <Field label="Max units per investor"><Input value={p.perInvestor} onChange={(e) => set("perInvestor", e.target.value)} data-testid="t-max" /></Field>
        <Field label="Term (months)"><Select value={p.term} onChange={(e) => set("term", e.target.value)}>{[6, 12, 18, 24, 36].map((m) => <option key={m}>{m}</option>)}</Select></Field>
        <Field label="Sale window (minutes)" hint="Testnet allows 5 minutes to 30 days"><Input value={p.duration} onChange={(e) => set("duration", e.target.value)} data-testid="t-duration" /></Field>
        <div className="flex items-end">
          <Button className="w-full" loading={busy === "prep"} onClick={prepare} data-testid="t-prepare">Generate legal pack</Button>
        </div>
      </Card>
      {prep && (
        <Card className="mt-4 space-y-3">
          <h2 className="font-semibold">{prep.pack.series} <Badge tone="warn">mock documents</Badge></h2>
          {prep.pack.documents.map((d: any) => (
            <a key={d.key} className="block rounded-xl border border-line p-3 text-sm hover:border-violet-300" href={`${WALRUS.aggregator}/v1/blobs/${d.blobId}`} target="_blank" rel="noreferrer">📄 {d.title}</a>
          ))}
          <div className="rounded-xl bg-black/[0.03] p-3 text-xs">
            You will sign: <code className="break-all">{prep.message}</code>
          </div>
          {prep.demoMode && s.completed_leases < 1 && s.accepted_proofs < 1 && <p className="text-xs text-amber-700">Testnet demo mode: track-record requirement waived.</p>}
          <Button size="lg" className="w-full" loading={busy === "create"} disabled={!verified} onClick={create} data-testid="t-create">Sign agreement & open offering</Button>
        </Card>
      )}
    </div>
  );
}
