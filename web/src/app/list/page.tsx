"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useSession } from "@/lib/client/session";
import { createObject } from "@/lib/sui/tx";
import { Badge, Button, Card, Field, Input, PhotoInput, Textarea, cx, useAction } from "@/components/ui";
import { SignInButtons } from "@/components/shell";

export default function ListObject() {
  const { authenticated, api, run } = useSession();
  const router = useRouter();
  const [f, setF] = useState({ title: "", make: "", model: "", color: "", city: "", description: "" });
  const [photo, setPhoto] = useState<{ file: File; source: "camera" | "upload"; url: string } | null>(null);
  const [code, setCode] = useState<string | null>(null);
  const [check, setCheck] = useState<any>(null);
  const { busy, run: act } = useAction();
  useEffect(() => {
    if (authenticated && !code) api<{ code: string }>("/api/capture-codes", { method: "POST", json: { purpose: "hero" } }).then((r) => setCode(r.code)).catch(() => {});
  }, [authenticated, code, api]);
  if (!authenticated)
    return (
      <div className="mx-auto max-w-lg px-4 py-20 text-center">
        <h1 className="text-2xl font-semibold">List your stuff</h1>
        <p className="mt-2 text-muted">Sign in to list an object and its ad spaces.</p>
        <div className="mt-6 flex justify-center">
          <SignInButtons />
        </div>
      </div>
    );
  const doCheck = () =>
    act("check", async () => {
      const fd = new FormData();
      fd.set("image", photo!.file);
      Object.entries(f).forEach(([k, v]) => fd.set(k, v));
      if (code) fd.set("captureCode", code);
      fd.set("captureSource", photo!.source);
      const r = await api<any>("/api/objects/check", { method: "POST", body: fd });
      setCheck(r);
    });
  const create = () =>
    act("create", async () => {
      const r = await run(createObject(check.tx));
      const c = await api<any>("/api/objects/confirm", { method: "POST", json: { digest: r.digest, draft: check.draft } });
      router.push(`/objects/${c.object.id}`);
    });
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-3xl font-semibold">List an object</h1>
      <p className="mt-1 text-muted">Step 1: the whole object. Then you&apos;ll add each ad space with its own close-up photo.</p>

      {(
        <Card className="mt-6 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name" hint="Anything you own: a laptop, car, helmet, guitar case, fridge, shop window…">
              <Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="My MacBook Pro 14" data-testid="title" />
            </Field>
            <Field label="City (optional)" hint="Used for search only">
              <Input value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })} placeholder="Tokyo" />
            </Field>
            <Field label="Make">
              <Input value={f.make} onChange={(e) => setF({ ...f, make: e.target.value })} placeholder="Apple" />
            </Field>
            <Field label="Model / colour">
              <Input value={f.model} onChange={(e) => setF({ ...f, model: e.target.value })} placeholder="MacBook Pro 14, silver" />
            </Field>
          </div>
          <Field label="Description" hint="What it is and how/where it's used — the AI checks your photo matches this and uses it to score your spaces.">
            <Textarea rows={3} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} placeholder="Silver 14-inch laptop I carry to cafés and coworking spaces every day." data-testid="description" />
          </Field>
          <div className="rounded-xl border border-violet-200 bg-violet-50 p-3 text-sm">
            Write this code on a note and place it in the photo: <span className="ml-1 rounded-lg bg-white px-2 py-0.5 font-mono text-lg font-bold tracking-widest">{code ?? "…"}</span>
            <div className="text-xs text-muted">It proves the photo is yours and fresh. Photos without it get lower confidence.</div>
          </div>
          <PhotoInput label="Photo of the whole object" testId="hero-photo" preview={photo?.url} onChange={(file, source) => { setPhoto({ file, source, url: URL.createObjectURL(file) }); setCheck(null); }} />
          <Button onClick={doCheck} loading={busy === "check"} disabled={!photo || f.title.length < 2 || f.description.trim().length < 10} data-testid="check-hero">
            {busy === "check" ? "Checking photo…" : "Check photo"}
          </Button>
          {check && (
            <div className={cx("rounded-xl p-4", check.decision === "ACCEPTED" ? "bg-emerald-50" : "bg-red-50")} data-testid="hero-result">
              <div className="flex items-center gap-2 font-semibold">
                {check.decision === "ACCEPTED" ? <Badge tone="ok">Accepted</Badge> : <Badge tone="bad">Rejected</Badge>}
                {check.reason}
              </div>
              {check.analysis && <p className="mt-2 text-sm text-muted">{check.analysis.description}</p>}
              {check.profile && (
                <div className="mt-3 space-y-1 text-sm" data-testid="object-profile">
                  <div>
                    Detected: <b>{check.profile.objectType}</b> · seen from ~{check.profile.viewingDistanceM} m ({check.profile.viewerMode})
                  </div>
                  <div className="flex flex-wrap gap-1">{check.profile.tags.map((t: string) => <Badge key={t}>{t}</Badge>)}</div>
                  {check.profile.prohibitedZones.length > 0 && <div className="text-xs text-muted">Ads can&apos;t go on: {check.profile.prohibitedZones.join(", ")}</div>}
                </div>
              )}
              {check.tips?.length > 0 && (
                <ul className="mt-2 list-disc pl-5 text-sm">
                  {check.tips.map((t: string) => (
                    <li key={t}>{t}</li>
                  ))}
                </ul>
              )}
              {check.decision === "ACCEPTED" && (
                <div className="mt-4 space-y-2">
                  <p className="text-sm">
                    Your object will be <span className="font-mono">{check.tx.ensName}</span>
                  </p>
                  <Button onClick={create} loading={busy === "create"} data-testid="create-object">
                    Create object on-chain
                  </Button>
                </div>
              )}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
