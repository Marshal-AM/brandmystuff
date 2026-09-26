"use client";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, BadgeCheck, Check, ShieldCheck } from "lucide-react";
import { useSession } from "@/lib/client/session";
import { Badge, Button, EASE, Empty, Kicker, PageLoader, Spinner, cx, useAction } from "@/components/ui";
import { FlowChoice, FlowFrame, FlowInput, FlowNext, FlowQuestion, useFlow } from "@/components/flow";
import { PhotoCapture } from "@/components/photo-capture";
import { SignInButtons } from "@/components/shell";

const ATTEST: Record<string, string[]> = {
  accredited: ["I am an accredited investor (income > $200k or net worth > $1M excluding home).", "I understand these units are illiquid and may lose all value."],
  non_us: ["I am not a US person and am not investing on behalf of one.", "I understand these units are illiquid and may lose all value."],
  retail: ["I am investing within my personal limits and understand the risks.", "I understand these units are illiquid and may lose all value."],
};
const TYPES = [
  { id: "accredited", label: "Accredited", sub: "US accredited investor" },
  { id: "non_us", label: "Non-US", sub: "Investing from outside the US" },
  { id: "retail", label: "Retail", sub: "Within personal limits" },
];

export default function Verify() {
  const { authenticated, api, refresh } = useSession();
  const { data, refetch, isLoading } = useQuery({ queryKey: ["kyc"], queryFn: () => api<any>("/api/kyc"), enabled: authenticated });
  const flow = useFlow(7);
  const [f, setF] = useState({ legalName: "", dateOfBirth: "", country: "", addressLine: "", investorType: "non_us" });
  const [att, setAtt] = useState<string[]>([]);
  const [doc, setDoc] = useState<File | null>(null);
  const [docUrl, setDocUrl] = useState<string | null>(null);
  const { busy, run } = useAction();
  const router = useRouter();
  const [returnTo, setReturnTo] = useState<string | null>(null);
  useEffect(() => {
    try {
      const r = sessionStorage.getItem("bms:return-to");
      if (r && r.startsWith("/") && !r.startsWith("//")) setReturnTo(r);
    } catch {}
  }, []);
  if (!authenticated)
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <Empty title="Verify your identity">Sign in to verify and unlock investing.</Empty>
        <div className="mt-6 flex justify-center"><SignInButtons /></div>
      </div>
    );
  if (isLoading) return <PageLoader label="Checking status" />;
  const sub = data?.submission;
  if (sub?.status === "approved" && new Date(sub.expires_at).getTime() > Date.now())
    return (
      <div className="mx-auto max-w-lg px-4 pb-16">
        <motion.div initial={{ opacity: 0, scale: 0.94, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ duration: 0.7, ease: EASE }} className="glass ring-spin relative overflow-hidden rounded-[32px] p-10 text-center">
          <div aria-hidden className="absolute left-1/2 top-0 h-48 w-48 -translate-x-1/2 -translate-y-1/2 rounded-full bg-p/30 blur-3xl" />
          <motion.span initial={{ scale: 0, rotate: -120 }} animate={{ scale: 1, rotate: 0 }} transition={{ delay: 0.2, type: "spring", stiffness: 260, damping: 14 }} className="relative mx-auto grid h-20 w-20 place-items-center rounded-full bg-p text-ink shadow-[0_0_60px_rgba(171,159,242,0.6)]">
            <BadgeCheck className="h-10 w-10" />
          </motion.span>
          <h1 className="relative mt-6 text-3xl font-extrabold tracking-tight">You&apos;re verified</h1>
          <p className="relative mt-2 text-sm text-muted">Investor type: {sub.investor_type.replace("_", "-")} · valid until {new Date(sub.expires_at).toLocaleDateString()}</p>
          <p className="relative mt-4 text-xs text-muted">Your verification is recorded on-chain (Sui KYC registry) and on your ENS name; your personal details never leave our private database.</p>
          <Button size="lg" className="relative mt-8" onClick={() => router.push(returnTo ?? "/offerings")} data-testid="kyc-return">
            <ArrowLeft className="h-4 w-4" />{returnTo ? "Back to where you were" : "Browse offerings"}
          </Button>
        </motion.div>
      </div>
    );
  const submit = () =>
    run("kyc", async () => {
      const fd = new FormData();
      Object.entries(f).forEach(([k, v]) => fd.set(k, v));
      att.forEach((a) => fd.append("attestations", a));
      fd.set("idDocument", doc!);
      await api("/api/kyc", { method: "POST", body: fd });
      await refetch();
      await refresh();
    }, "Verified");
  const can = [f.legalName.trim().length >= 2, !!f.dateOfBirth, f.country.length === 2, f.addressLine.length >= 5, !!f.investorType, att.length >= 2, !!doc][flow.i];
  const next = () => {
    if (!can) return;
    if (flow.i === 6) submit();
    else flow.next();
  };
  const firstName = f.legalName.trim().split(/\s+/)[0];
  return (
    <div className="mx-auto max-w-3xl px-4 pb-16 sm:px-6">
      <div className="mb-8 flex flex-wrap items-center gap-3">
        <Kicker>Identity</Kicker>
        <span className="text-xs text-muted">Required to invest in or trade revenue units. Takes about a minute.</span>
      </div>
      <FlowFrame flow={flow} canNext={can && flow.i !== 6} onEnter={next} chapters={[{ label: "Details", from: 0 }, { label: "Attest", from: 4 }, { label: "Document", from: 6 }]}>
        {flow.i === 0 && (
          <FlowQuestion n={1} required title="What's your full legal name?" sub="Exactly as it appears on your ID.">
            <FlowInput value={f.legalName} onChange={(e) => setF({ ...f, legalName: e.target.value })} onEnter={next} placeholder="Maya Chen" data-testid="kyc-name" />
            <FlowNext onClick={next} disabled={!can} />
          </FlowQuestion>
        )}
        {flow.i === 1 && (
          <FlowQuestion n={2} required title={<>When were you born{firstName ? <>, <span className="text-p">{firstName}</span></> : null}?</>}>
            <FlowInput type="date" value={f.dateOfBirth} onChange={(e) => setF({ ...f, dateOfBirth: e.target.value })} onEnter={next} data-testid="kyc-dob" className="max-w-xs [color-scheme:dark]" />
            <FlowNext onClick={next} disabled={!can} />
          </FlowQuestion>
        )}
        {flow.i === 2 && (
          <FlowQuestion n={3} required title="Which country do you live in?" sub="Two-letter ISO code, like IN, US or GB.">
            <FlowInput maxLength={2} value={f.country} onChange={(e) => setF({ ...f, country: e.target.value.toUpperCase() })} onEnter={next} placeholder="IN" className="max-w-[8rem] font-mono uppercase tracking-[0.2em]" data-testid="kyc-country" />
            <FlowNext onClick={next} disabled={!can} />
          </FlowQuestion>
        )}
        {flow.i === 3 && (
          <FlowQuestion n={4} required title="And your address?">
            <FlowInput value={f.addressLine} onChange={(e) => setF({ ...f, addressLine: e.target.value })} onEnter={next} placeholder="12 MG Road, Bengaluru" data-testid="kyc-address" />
            <FlowNext onClick={next} disabled={!can} testId="kyc-next1" />
          </FlowQuestion>
        )}
        {flow.i === 4 && (
          <FlowQuestion n={5} required title="How are you investing?" sub="Press a letter or tap to choose.">
            <FlowChoice options={TYPES.map((t) => ({ id: t.id, label: t.label, sub: t.sub }))} value={f.investorType} onChange={(v) => { if (v !== f.investorType) { setF({ ...f, investorType: v }); setAtt([]); } }} />
            <FlowNext onClick={next} disabled={!can} />
          </FlowQuestion>
        )}
        {flow.i === 5 && (
          <FlowQuestion n={6} required title="Please confirm both of these" sub="Tick each one to continue.">
            <div className="space-y-2.5">
              {ATTEST[f.investorType].map((a, i) => {
                const on = att.includes(a);
                return (
                  <motion.label key={a} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }} className={cx("relative flex cursor-pointer gap-4 rounded-2xl border px-4 py-4 text-base transition-colors", on ? "border-p bg-p/[0.1]" : "border-line-strong hover:border-p/40")}>
                    <input type="checkbox" className="absolute inset-0 h-full w-full cursor-pointer opacity-0" checked={on} onChange={(e) => setAtt(e.target.checked ? [...att, a] : att.filter((x) => x !== a))} data-testid="kyc-attest" />
                    <span className={cx("mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-lg transition-colors", on ? "bg-p text-ink" : "ring-1 ring-line-strong")}>
                      <AnimatePresence>{on && <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}><Check className="h-4 w-4" strokeWidth={3.5} /></motion.span>}</AnimatePresence>
                    </span>
                    <span className="text-white/85">{a}</span>
                  </motion.label>
                );
              })}
            </div>
            <FlowNext onClick={next} disabled={!can} testId="kyc-next2" />
          </FlowQuestion>
        )}
        {flow.i === 6 && (
          <FlowQuestion n={7} required title="Last one: a photo of your ID" sub="Passport, national ID or driving licence. It's checked for type and size, then discarded. Never stored.">
            <PhotoCapture purpose="kyc" label="ID document" testId="kyc-doc" preview={docUrl} onChange={(file) => { setDoc(file); setDocUrl(URL.createObjectURL(file)); }} />
            <AnimatePresence>
              {busy === "kyc" && (
                <motion.p initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="mt-4 flex items-center gap-2 text-sm text-p">
                  <Spinner className="h-4 w-4" /> Checking your documents…
                </motion.p>
              )}
            </AnimatePresence>
            <div className="mt-8">
              <Button size="lg" loading={busy === "kyc"} disabled={!doc} onClick={submit} data-testid="kyc-submit">
                <ShieldCheck className="h-4 w-4" /> Submit
              </Button>
            </div>
            <p className="mt-6 flex flex-wrap items-center gap-2 text-[11px] text-muted">
              <Badge tone="warn">Testnet</Badge> Identity verification will be provided by Sumsub or Persona. This demo auto-approves.
            </p>
          </FlowQuestion>
        )}
      </FlowFrame>
    </div>
  );
}
