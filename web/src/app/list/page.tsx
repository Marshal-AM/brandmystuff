"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Box, Camera, Check, Eye, Fingerprint, Loader2, MapPin, PenLine, Rocket, ScanSearch, ShieldCheck, Sun, Tag } from "lucide-react";
import { useSession } from "@/lib/client/session";
import { createObject } from "@/lib/sui/tx";
import { Badge, Button, Card, EASE, Empty, Field, Input, PageHeader, Textarea, cx, useAction } from "@/components/ui";
import { PhotoCapture } from "@/components/photo-capture";
import { SignInButtons } from "@/components/shell";

const CHECKS = [
  { icon: Fingerprint, label: "Reading your capture code" },
  { icon: ScanSearch, label: "Checking the photo is real and fresh" },
  { icon: Eye, label: "Matching the photo to your description" },
  { icon: ShieldCheck, label: "Checking brand safety" },
];

const STEPS = [
  { key: "basics", label: "Basics", icon: Box, title: "What are you listing?", sub: "Give it a name brands will recognise. Make and model are optional but help search." },
  { key: "story", label: "Story", icon: PenLine, title: "Tell its story", sub: "Where does it go and who sees it? The AI checks your photo against this and uses it to score your spaces." },
  { key: "photo", label: "Photo", icon: Camera, title: "Snap the whole object", sub: "One clear photo with your capture code in frame proves it's yours and it's real." },
  { key: "live", label: "Go live", icon: Rocket, title: "Ready to go on-chain", sub: "Check the details, then create your object. You'll add ad spaces right after." },
] as const;

const PROMPTS = ["What it is", "Where you take it", "Who sees it, and how often"];

function Stepper({ step, maxStep, onJump }: { step: number; maxStep: number; onJump: (i: number) => void }) {
  return (
    <div className="mb-8 flex items-center gap-2">
      {STEPS.map((s, i) => {
        const done = step > i, active = step === i, reachable = i <= maxStep;
        return (
          <div key={s.key} className="flex flex-1 items-center gap-2 last:flex-none">
            <button type="button" disabled={!reachable || active} onClick={() => onJump(i)} className={cx("group flex items-center gap-2", reachable && !active && "cursor-pointer")}>
              <motion.span animate={{ scale: active ? 1.1 : 1 }} className={cx("grid h-9 w-9 shrink-0 place-items-center rounded-full text-xs font-extrabold transition-colors duration-500", done ? "bg-p text-ink group-hover:bg-p-300" : active ? "bg-white text-ink shadow-[0_0_24px_rgba(255,255,255,0.35)]" : "bg-white/[0.06] text-muted")}>
                {done ? <Check className="h-4 w-4" strokeWidth={3} /> : <s.icon className="h-4 w-4" />}
              </motion.span>
              <span className={cx("hidden text-sm font-semibold md:block", active || done ? "text-white" : "text-muted")}>{s.label}</span>
            </button>
            {i < STEPS.length - 1 && (
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

function Tip({ icon: Icon, children }: { icon: typeof Sun; children: ReactNode }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-line bg-white/[0.02] p-3 text-sm text-white/75">
      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-xl bg-p/15 text-p"><Icon className="h-3.5 w-3.5" /></span>
      <span className="pt-1">{children}</span>
    </div>
  );
}

function SummaryRow({ label, value, onEdit }: { label: string; value: ReactNode; onEdit?: () => void }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-line py-3 last:border-0">
      <div className="min-w-0">
        <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted">{label}</div>
        <div className="mt-0.5 break-words text-sm text-white">{value || <span className="text-faint">—</span>}</div>
      </div>
      {onEdit && <button type="button" onClick={onEdit} className="shrink-0 text-xs font-semibold text-p hover:underline">Edit</button>}
    </div>
  );
}

export default function ListObject() {
  const { authenticated, api, run } = useSession();
  const router = useRouter();
  const [f, setF] = useState({ title: "", make: "", model: "", color: "", city: "", description: "" });
  const [photo, setPhoto] = useState<{ file: File; source: "camera" | "upload"; url: string } | null>(null);
  const [code, setCode] = useState<string | null>(null);
  const [check, setCheck] = useState<any>(null);
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);
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

  // Any edit to the details invalidates a previous photo check (the draft is built from them).
  const set = (k: keyof typeof f, v: string) => {
    setF((x) => ({ ...x, [k]: v }));
    if (check) setCheck(null);
  };
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

  const accepted = check?.decision === "ACCEPTED";
  const canNext = [f.title.trim().length >= 2, f.description.trim().length >= 10, accepted, false][step];
  const maxStep = f.title.trim().length < 2 ? 0 : f.description.trim().length < 10 ? 1 : accepted ? 3 : 2;
  const go = (i: number) => {
    setDir(i > step ? 1 : -1);
    setStep(i);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const s = STEPS[step];
  const descLen = f.description.trim().length;

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6">
      <PageHeader kicker="List an object" title="Turn your stuff into ad space" sub="Four quick steps. After this you'll add each ad space with its own close-up, and AI scores every one." />
      <Stepper step={step} maxStep={maxStep} onJump={go} />
      <Card className="overflow-hidden">
        <AnimatePresence mode="wait" custom={dir} initial={false}>
          <motion.div
            key={s.key}
            custom={dir}
            variants={{
              enter: (d: number) => ({ opacity: 0, x: d * 40, filter: "blur(6px)" }),
              center: { opacity: 1, x: 0, filter: "blur(0px)" },
              exit: (d: number) => ({ opacity: 0, x: d * -40, filter: "blur(6px)" }),
            }}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.4, ease: EASE }}
          >
            <div className="mb-6">
              <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-p">Step {step + 1} of {STEPS.length}</div>
              <h2 className="mt-1 text-2xl font-extrabold tracking-tight">{s.title}</h2>
              <p className="mt-1 text-sm text-muted">{s.sub}</p>
            </div>

            {s.key === "basics" && (
              <div className="space-y-5">
                <Field label="Name" hint="Anything you own: a laptop, car, helmet, guitar case, shop window…">
                  <Input autoFocus value={f.title} onChange={(e) => set("title", e.target.value)} placeholder="My MacBook Pro 14" data-testid="title" />
                </Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Make (optional)">
                    <Input value={f.make} onChange={(e) => set("make", e.target.value)} placeholder="Apple" />
                  </Field>
                  <Field label="Model / colour (optional)">
                    <Input value={f.model} onChange={(e) => set("model", e.target.value)} placeholder="MacBook Pro 14, silver" />
                  </Field>
                </div>
                <Field label="City (optional)" hint="Used for search only">
                  <div className="relative">
                    <MapPin className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-p" />
                    <Input value={f.city} onChange={(e) => set("city", e.target.value)} placeholder="Tokyo" className="pl-10" />
                  </div>
                </Field>
              </div>
            )}

            {s.key === "story" && (
              <div className="space-y-5">
                <div className="flex flex-wrap gap-2">
                  {PROMPTS.map((p, i) => (
                    <motion.span key={p} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 + i * 0.06 }} className="rounded-full border border-p/25 bg-p/10 px-3 py-1 text-xs font-semibold text-p">
                      {p}
                    </motion.span>
                  ))}
                </div>
                <Field label="Description">
                  <Textarea autoFocus rows={5} value={f.description} onChange={(e) => set("description", e.target.value)} placeholder="Silver 14-inch laptop I carry to cafés and coworking spaces every day." data-testid="description" />
                </Field>
                <div className="flex items-center gap-3 text-xs">
                  <div className="relative h-1 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
                    <motion.div className="absolute inset-y-0 left-0 rounded-full bg-p" animate={{ width: `${Math.min(100, (descLen / 10) * 100)}%` }} transition={{ duration: 0.3 }} />
                  </div>
                  <span className={descLen >= 10 ? "font-semibold text-p" : "text-muted"}>{descLen >= 10 ? "Looks good" : `${10 - descLen} more characters`}</span>
                </div>
              </div>
            )}

            {s.key === "photo" && (
              <div className="space-y-5">
                <div className="relative overflow-hidden rounded-3xl border border-p/30 bg-gradient-to-br from-p/15 to-transparent p-5">
                  <div aria-hidden className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-p/20 blur-2xl" />
                  <div className="relative flex flex-wrap items-center gap-4">
                    <div className="flex-1 text-sm text-white/80">
                      <div className="mb-1 font-bold text-white">Write this code on a note and put it in the photo</div>
                      Photos without it get lower confidence.
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
                <div className="grid gap-2 sm:grid-cols-3">
                  <Tip icon={Box}>Show the whole object</Tip>
                  <Tip icon={Sun}>Good, even light</Tip>
                  <Tip icon={Fingerprint}>Code clearly visible</Tip>
                </div>
                <PhotoCapture purpose="hero" label="Photo of the whole object" testId="hero-photo" preview={photo?.url} scanning={busy === "check"} onChange={(file, source) => { setPhoto({ file, source, url: URL.createObjectURL(file) }); setCheck(null); }} />
                {!accepted && (
                  <Button onClick={doCheck} loading={busy === "check"} disabled={!photo} data-testid="check-hero" size="lg">
                    <ScanSearch className="h-4 w-4" /> {busy === "check" ? "Checking photo…" : check ? "Check again" : "Check photo"}
                  </Button>
                )}
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
                      {check.tips?.length > 0 && (
                        <ul className="relative mt-3 space-y-1 text-sm text-white/75">
                          {check.tips.map((t: string) => (
                            <li key={t} className="flex gap-2"><span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-p" />{t}</li>
                          ))}
                        </ul>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            {s.key === "live" && check && (
              <div className="space-y-5">
                <div className="grid gap-5 sm:grid-cols-[180px_1fr]">
                  {photo && (
                    <motion.div initial={{ opacity: 0, scale: 0.9, rotate: -3 }} animate={{ opacity: 1, scale: 1, rotate: 0 }} transition={{ type: "spring", stiffness: 220, damping: 18 }} className="overflow-hidden rounded-2xl ring-1 ring-p/40">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={photo.url} alt="" className="aspect-square w-full object-cover" />
                    </motion.div>
                  )}
                  <div className="rounded-2xl border border-line bg-white/[0.02] px-4">
                    <SummaryRow label="Name" value={f.title} onEdit={() => go(0)} />
                    <SummaryRow label="Make / model" value={[f.make, f.model].filter(Boolean).join(" · ")} onEdit={() => go(0)} />
                    <SummaryRow label="City" value={f.city} onEdit={() => go(0)} />
                    <SummaryRow label="Description" value={f.description} onEdit={() => go(1)} />
                  </div>
                </div>
                {check.profile && (
                  <div className="space-y-2 rounded-2xl border border-line bg-white/[0.02] p-4 text-sm" data-testid="object-profile">
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
                <div className="relative overflow-hidden rounded-2xl border border-p/30 bg-p/[0.08] p-4 text-sm">
                  <div className="text-muted">Your object will be</div>
                  <div className="mt-0.5 break-all font-mono text-p">{check.tx.ensName}</div>
                </div>
                <Button onClick={create} loading={busy === "create"} data-testid="create-object" size="lg" className="w-full">
                  <Rocket className="h-4 w-4" /> Create object on-chain
                </Button>
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        <div className="mt-8 flex items-center justify-between gap-3 border-t border-line pt-5">
          {step > 0 ? (
            <Button variant="ghost" onClick={() => go(step - 1)} disabled={!!busy}>
              <ArrowLeft className="h-4 w-4" /> Back
            </Button>
          ) : <span />}
          {step < STEPS.length - 1 && (
            <Button onClick={() => go(step + 1)} disabled={!canNext || !!busy}>
              {step === 2 ? "Review" : "Continue"} <ArrowRight className="h-4 w-4" />
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
}
