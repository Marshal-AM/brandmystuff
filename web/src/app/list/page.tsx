"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Eye, Fingerprint, Loader2, ScanSearch, ShieldCheck, Tag } from "lucide-react";
import { useSession } from "@/lib/client/session";
import { createObject } from "@/lib/sui/tx";
import { Badge, Button, Card, EASE, Empty, Field, Input, PageHeader, PhotoInput, Textarea, cx, useAction } from "@/components/ui";
import { SignInButtons } from "@/components/shell";

const CHECKS = [
  { icon: Fingerprint, label: "Reading your capture code" },
  { icon: ScanSearch, label: "Checking the photo is real and fresh" },
  { icon: Eye, label: "Matching the photo to your description" },
  { icon: ShieldCheck, label: "Checking brand safety" },
];

function Steps({ step }: { step: number }) {
  const items = ["Describe it", "Check the photo", "Create on-chain"];
  return (
    <div className="mb-8 flex items-center gap-2">
      {items.map((label, i) => {
        const done = step > i, active = step === i;
        return (
          <div key={label} className="flex flex-1 items-center gap-2">
            <motion.span animate={{ scale: active ? 1.1 : 1 }} className={cx("grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-extrabold transition-colors duration-500", done ? "bg-p text-ink" : active ? "bg-white text-ink shadow-[0_0_20px_rgba(255,255,255,0.35)]" : "bg-white/[0.06] text-muted")}>
              {done ? <Check className="h-4 w-4" strokeWidth={3} /> : i + 1}
            </motion.span>
            <span className={cx("hidden text-sm font-semibold sm:block", active || done ? "text-white" : "text-muted")}>{label}</span>
            {i < items.length - 1 && (
              <span className="relative mx-1 h-px flex-1 overflow-hidden bg-white/10">
                <motion.span className="absolute inset-y-0 left-0 bg-p" initial={false} animate={{ width: done ? "100%" : "0%" }} transition={{ duration: 0.6, ease: EASE }} />
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

function Checking() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((x) => Math.min(x + 1, CHECKS.length - 1)), 2400);
    return () => clearInterval(t);
  }, []);
  return (
    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
      <div className="mt-2 space-y-2 rounded-3xl border border-p/25 bg-p/[0.06] p-4">
        {CHECKS.map((c, k) => {
          const state = k < i ? "done" : k === i ? "run" : "todo";
          return (
            <motion.div key={c.label} initial={{ opacity: 0, x: -10 }} animate={{ opacity: state === "todo" ? 0.4 : 1, x: 0 }} transition={{ delay: k * 0.08 }} className="flex items-center gap-3 text-sm">
              <span className={cx("grid h-7 w-7 place-items-center rounded-full", state === "done" ? "bg-p text-ink" : "bg-white/[0.06] text-p")}>
                {state === "done" ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : state === "run" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <c.icon className="h-3.5 w-3.5" />}
              </span>
              <span className={state === "run" ? "font-semibold text-white" : "text-white/70"}>{c.label}</span>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}

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
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <Empty title="List your stuff">Sign in to list an object and its ad spaces. It takes about five minutes.</Empty>
        <div className="mt-6 flex justify-center"><SignInButtons /></div>
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
  const step = check?.decision === "ACCEPTED" ? 2 : photo ? 1 : 0;
  const accepted = check?.decision === "ACCEPTED";
  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6">
      <PageHeader kicker="List an object" title="Turn your stuff into ad space" sub="Step one is the whole object. Then you'll add each ad space with its own close-up, and AI scores every one." />
      <Steps step={step} />
      <Card className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name" hint="Anything you own: a laptop, car, helmet, guitar case, shop window…">
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
        <Field label="Description" hint="What it is and how or where it's used. The AI checks your photo matches this and uses it to score your spaces.">
          <Textarea rows={3} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} placeholder="Silver 14-inch laptop I carry to cafés and coworking spaces every day." data-testid="description" />
        </Field>

        <div className="relative overflow-hidden rounded-3xl border border-p/30 bg-gradient-to-br from-p/15 to-transparent p-5">
          <div aria-hidden className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-p/20 blur-2xl" />
          <div className="relative flex flex-wrap items-center gap-4">
            <div className="flex-1 text-sm text-white/80">
              <div className="mb-1 font-bold text-white">Write this code on a note and put it in the photo</div>
              It proves the photo is yours and fresh. Photos without it get lower confidence.
            </div>
            <div className="flex gap-1.5">
              {(code ?? "····").split("").map((ch, i) => (
                <motion.span key={`${ch}${i}`} initial={{ rotateX: 90, opacity: 0 }} animate={{ rotateX: 0, opacity: 1 }} transition={{ delay: i * 0.1, type: "spring", stiffness: 300, damping: 18 }} className="grid h-12 w-10 place-items-center rounded-xl bg-white font-mono text-2xl font-extrabold text-ink shadow-lg">
                  {ch}
                </motion.span>
              ))}
            </div>
          </div>
        </div>

        <PhotoInput label="Photo of the whole object" testId="hero-photo" preview={photo?.url} scanning={busy === "check"} onChange={(file, source) => { setPhoto({ file, source, url: URL.createObjectURL(file) }); setCheck(null); }} />
        <Button onClick={doCheck} loading={busy === "check"} disabled={!photo || f.title.length < 2 || f.description.trim().length < 10} data-testid="check-hero" size="lg">
          <ScanSearch className="h-4 w-4" /> {busy === "check" ? "Checking photo…" : "Check photo"}
        </Button>
        <AnimatePresence>{busy === "check" && <Checking />}</AnimatePresence>

        <AnimatePresence>
          {check && (
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.97, filter: "blur(8px)" }}
              animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.6, ease: EASE }}
              className={cx("relative overflow-hidden rounded-3xl border p-5", accepted ? "border-p/40 bg-p/[0.08]" : "border-white/20 bg-white/[0.04]")}
              data-testid="hero-result"
            >
              {accepted && <div aria-hidden className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-p/25 blur-3xl" />}
              <div className="relative flex flex-wrap items-center gap-3 font-bold">
                {accepted ? <Badge tone="ok">Accepted</Badge> : <Badge tone="bad">Rejected</Badge>}
                {check.reason}
              </div>
              {check.analysis && <p className="relative mt-3 text-sm text-white/70">{check.analysis.description}</p>}
              {check.profile && (
                <div className="relative mt-4 space-y-2 text-sm" data-testid="object-profile">
                  <div className="text-white/80">
                    Detected: <b className="text-white">{check.profile.objectType}</b> · seen from ~{check.profile.viewingDistanceM} m ({check.profile.viewerMode})
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {check.profile.tags.map((t: string, i: number) => (
                      <motion.span key={t} initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2 + i * 0.05, type: "spring", stiffness: 400, damping: 20 }}>
                        <Badge><Tag className="h-3 w-3" /> {t}</Badge>
                      </motion.span>
                    ))}
                  </div>
                  {check.profile.prohibitedZones.length > 0 && <div className="text-xs text-muted">Ads can&apos;t go on: {check.profile.prohibitedZones.join(", ")}</div>}
                </div>
              )}
              {check.tips?.length > 0 && (
                <ul className="relative mt-3 space-y-1 text-sm text-white/75">
                  {check.tips.map((t: string) => (
                    <li key={t} className="flex gap-2"><span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-p" />{t}</li>
                  ))}
                </ul>
              )}
              {accepted && (
                <div className="relative mt-5 space-y-3 border-t border-line pt-4">
                  <p className="text-sm text-muted">
                    Your object will be <span className="font-mono text-p">{check.tx.ensName}</span>
                  </p>
                  <Button onClick={create} loading={busy === "create"} data-testid="create-object" size="lg">
                    Create object on-chain
                  </Button>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </Card>
    </div>
  );
}
