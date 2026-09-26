"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Box, Check, Eye, Fingerprint, Loader2, Rocket, ScanSearch, ShieldCheck, Sun, Tag } from "lucide-react";
import { useSession } from "@/lib/client/session";
import { createObject } from "@/lib/sui/tx";
import { Badge, Button, EASE, Empty, Kicker, cx, useAction } from "@/components/ui";
import { EnsName } from "@/components/ens";
import { PhotoCapture } from "@/components/photo-capture";
import { FlowFrame, FlowInput, FlowNext, FlowQuestion, FlowTextarea, useFlow } from "@/components/flow";
import { SignInButtons } from "@/components/shell";

const CHECKS = [
  { icon: Fingerprint, label: "Confirming it came from your live camera" },
  { icon: ScanSearch, label: "Checking the photo is real and fresh" },
  { icon: Eye, label: "Matching the photo to your description" },
  { icon: ShieldCheck, label: "Checking brand safety" },
];

const CHAPTERS = [
  { label: "Basics", from: 0 },
  { label: "Story", from: 3 },
  { label: "Photo", from: 4 },
  { label: "Go live", from: 5 },
];
const TOTAL = 6;

function Checking() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((x) => Math.min(x + 1, CHECKS.length - 1)), 2400);
    return () => clearInterval(t);
  }, []);
  return (
    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
      <div className="mt-2 space-y-2.5 border-l-2 border-p/40 py-1 pl-5">
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

function SummaryRow({ label, value, onEdit }: { label: string; value: ReactNode; onEdit?: () => void }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-line py-3.5 last:border-0">
      <div className="min-w-0">
        <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted">{label}</div>
        <div className="mt-0.5 break-words text-base text-white">{value || <span className="text-faint">Not set</span>}</div>
      </div>
      {onEdit && <button type="button" onClick={onEdit} className="shrink-0 text-xs font-semibold text-p hover:underline">Edit</button>}
    </div>
  );
}

export default function ListObject() {
  const { authenticated, api, run } = useSession();
  const router = useRouter();
  const [f, setF] = useState({ title: "", make: "", model: "", color: "", city: "", description: "" });
  const [photo, setPhoto] = useState<{ file: File; source: "camera" | "upload"; url: string; linkId?: string } | null>(null);
  const [check, setCheck] = useState<any>(null);
  const flow = useFlow(TOTAL);
  const { busy, run: act } = useAction();
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
      fd.set("captureSource", photo!.source);
      if (photo!.linkId) fd.set("captureLinkId", photo!.linkId);
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
  const descLen = f.description.trim().length;
  const canNext = [f.title.trim().length >= 2, true, true, descLen >= 10, accepted, false][flow.i];
  const next = () => canNext && flow.next();

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6">
      <div className="mb-8">
        <Kicker>List an object</Kicker>
      </div>
      <FlowFrame flow={flow} canNext={canNext} onEnter={next} chapters={CHAPTERS}>
        {flow.i === 0 && (
          <FlowQuestion n={1} required title="What are you listing?" sub="Anything you own: a laptop, a car, a helmet, a guitar case, a shop window…">
            <FlowInput value={f.title} onChange={(e) => set("title", e.target.value)} onEnter={next} placeholder="My MacBook Pro 14" data-testid="title" />
            <FlowNext onClick={next} disabled={!canNext} />
          </FlowQuestion>
        )}

        {flow.i === 1 && (
          <FlowQuestion n={2} title={<>Who made your <span className="text-p">{f.title || "object"}</span>?</>} sub="Make and model help brands find it in search. Skip if it doesn't apply.">
            <div className="grid gap-8 sm:grid-cols-2">
              <FlowInput value={f.make} onChange={(e) => set("make", e.target.value)} onEnter={next} placeholder="Make, e.g. Apple" />
              <FlowInput autoFocus={false} value={f.model} onChange={(e) => set("model", e.target.value)} onEnter={next} placeholder="Model / colour" />
            </div>
            <FlowNext onClick={next} label={f.make || f.model ? "OK" : "Skip"} skip={!f.make && !f.model} />
          </FlowQuestion>
        )}

        {flow.i === 2 && (
          <FlowQuestion n={3} title="Which city is it usually in?" sub="Used for search only. Leave it blank if it moves around a lot.">
            <FlowInput value={f.city} onChange={(e) => set("city", e.target.value)} onEnter={next} placeholder="Tokyo" />
            <FlowNext onClick={next} label={f.city ? "OK" : "Skip"} skip={!f.city} />
          </FlowQuestion>
        )}

        {flow.i === 3 && (
          <FlowQuestion
            n={4}
            required
            title="Tell us its story"
            sub="What it is, where you take it, who sees it and how often. The AI checks your photo against this and uses it to score your spaces."
          >
            <FlowTextarea value={f.description} onChange={(e) => set("description", e.target.value)} onEnter={next} placeholder="Silver 14-inch laptop I carry to cafés and coworking spaces every day." data-testid="description" />
            <div className="mt-3 flex items-center gap-3 text-xs">
              <div className="relative h-1 w-40 overflow-hidden rounded-full bg-white/[0.06]">
                <motion.div className="absolute inset-y-0 left-0 rounded-full bg-p" animate={{ width: `${Math.min(100, (descLen / 10) * 100)}%` }} transition={{ duration: 0.3 }} />
              </div>
              <span className={descLen >= 10 ? "font-semibold text-p" : "text-muted"}>{descLen >= 10 ? "Looks good" : `${10 - descLen} more characters`}</span>
              <span className="hidden text-faint sm:inline">· Shift + Enter for a new line</span>
            </div>
            <FlowNext onClick={next} disabled={!canNext} />
          </FlowQuestion>
        )}

        {flow.i === 4 && (
          <FlowQuestion n={5} required title="Now snap the whole object" sub="Take one clear photo with your phone's camera. We'll give you a link that opens the camera, and the photo comes straight back here.">
            <div className="space-y-6">
              <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-white/70">
                <span className="inline-flex items-center gap-2"><Box className="h-4 w-4 text-p" /> Whole object in frame</span>
                <span className="inline-flex items-center gap-2"><Sun className="h-4 w-4 text-p" /> Even light, no glare</span>
                <span className="inline-flex items-center gap-2"><Eye className="h-4 w-4 text-p" /> Seen the way people see it</span>
              </div>
              <PhotoCapture purpose="hero" label="Photo of the whole object" testId="hero-photo" preview={photo?.url} scanning={busy === "check"} onChange={(file, source, linkId) => { setPhoto({ file, source, linkId, url: URL.createObjectURL(file) }); setCheck(null); }} />
              {!accepted && (
                <Button onClick={doCheck} loading={busy === "check"} disabled={!photo} data-testid="check-hero" size="lg">
                  <ScanSearch className="h-4 w-4" /> {busy === "check" ? "Checking photo…" : check ? "Check again" : "Check photo"}
                </Button>
              )}
              <AnimatePresence>{busy === "check" && <Checking />}</AnimatePresence>
              <AnimatePresence>
                {check && (
                  <motion.div
                    initial={{ opacity: 0, y: 20, filter: "blur(8px)" }}
                    animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.6, ease: EASE }}
                    className={cx("relative border-l-2 py-1 pl-5", accepted ? "border-p" : "border-white/30")}
                    data-testid="hero-result"
                  >
                    <div className="flex flex-wrap items-center gap-3 text-lg font-bold">
                      {accepted ? <Badge tone="ok">Accepted</Badge> : <Badge tone="bad">Rejected</Badge>}
                      {check.reason}
                    </div>
                    {check.analysis && <p className="mt-2 text-sm text-white/70">{check.analysis.description}</p>}
                    {check.tips?.length > 0 && (
                      <ul className="mt-3 space-y-1 text-sm text-white/75">
                        {check.tips.map((t: string) => (
                          <li key={t} className="flex gap-2"><span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-p" />{t}</li>
                        ))}
                      </ul>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
              {accepted && <FlowNext onClick={next} label="Review" skip />}
            </div>
          </FlowQuestion>
        )}

        {flow.i === 5 && check && (
          <FlowQuestion n={6} title="Ready to go on-chain" sub="Check the details, then create your object. You'll add its ad spaces right after.">
            <div className="space-y-8">
              <div className="grid gap-6 sm:grid-cols-[200px_1fr]">
                {photo && (
                  <motion.div initial={{ opacity: 0, scale: 0.9, rotate: -3 }} animate={{ opacity: 1, scale: 1, rotate: 0 }} transition={{ type: "spring", stiffness: 220, damping: 18 }} className="overflow-hidden rounded-3xl ring-1 ring-p/40">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={photo.url} alt="" className="aspect-square w-full object-cover" />
                  </motion.div>
                )}
                <div>
                  <SummaryRow label="Name" value={f.title} onEdit={() => flow.go(0)} />
                  <SummaryRow label="Make / model" value={[f.make, f.model].filter(Boolean).join(" · ")} onEdit={() => flow.go(1)} />
                  <SummaryRow label="City" value={f.city} onEdit={() => flow.go(2)} />
                  <SummaryRow label="Story" value={f.description} onEdit={() => flow.go(3)} />
                </div>
              </div>
              {check.profile && (
                <div className="space-y-2 text-sm" data-testid="object-profile">
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
              <div>
                <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted">Your object&apos;s ENS name</div>
                <div className="mt-2"><EnsName name={check.tx.ensName} status="pending" kind="object" size="md" full /></div>
                <p className="mt-3 text-xs text-muted">Right after your Sui transaction, the relayer registers it on Sepolia ENS and writes these records:</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {["class: PhysicalAsset", "description", "avatar (your photo)", `type: ${check.profile?.objectType ?? "object"}`, ...(check.profile?.tags?.length ? ["tags"] : []), ...(f.city ? [`city: ${f.city}`] : []), "sui.object → this object"].map((r, i) => (
                    <motion.span key={r} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 + i * 0.05 }} className="rounded-full border border-p/25 bg-p/[0.06] px-2.5 py-1 font-mono text-[10.5px] text-p-200">
                      {r}
                    </motion.span>
                  ))}
                </div>
              </div>
              <Button onClick={create} loading={busy === "create"} data-testid="create-object" size="lg">
                <Rocket className="h-4 w-4" /> Create object on-chain
              </Button>
            </div>
          </FlowQuestion>
        )}
      </FlowFrame>
    </div>
  );
}
