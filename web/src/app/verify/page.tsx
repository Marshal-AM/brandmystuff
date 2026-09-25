"use client";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { BadgeCheck, Check, FileUp, IdCard, ScrollText, ShieldCheck, UserRound } from "lucide-react";
import { useSession } from "@/lib/client/session";
import { Badge, Button, EASE, Empty, Field, Input, PageHeader, PageLoader, Spinner, cx, useAction } from "@/components/ui";
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
const STEPS = [
  { icon: UserRound, label: "Details" },
  { icon: ScrollText, label: "Attest" },
  { icon: IdCard, label: "Document" },
];

export default function Verify() {
  const { authenticated, api, refresh } = useSession();
  const { data, refetch, isLoading } = useQuery({ queryKey: ["kyc"], queryFn: () => api<any>("/api/kyc"), enabled: authenticated });
  const [step, setStep] = useState(1);
  const [dir, setDir] = useState(1);
  const [f, setF] = useState({ legalName: "", dateOfBirth: "", country: "", addressLine: "", investorType: "non_us" });
  const [att, setAtt] = useState<string[]>([]);
  const [doc, setDoc] = useState<File | null>(null);
  const { busy, run } = useAction();
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
        </motion.div>
      </div>
    );
  const go = (n: number) => { setDir(n > step ? 1 : -1); setStep(n); };
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
  return (
    <div className="mx-auto max-w-xl px-4 pb-16">
      <PageHeader kicker="Identity" title="Verify your identity" sub="Required to invest in or trade revenue units. Takes about a minute." />

      <div className="relative mb-6 flex justify-between">
        <div className="absolute left-5 right-5 top-5 h-px bg-white/10" />
        <motion.div className="absolute left-5 top-5 h-px bg-gradient-to-r from-p-600 to-p" animate={{ width: `calc(${((step - 1) / 2) * 100}% - ${((step - 1) / 2) * 40}px)` }} transition={{ duration: 0.6, ease: EASE }} />
        {STEPS.map((s, i) => {
          const n = i + 1, done = step > n, active = step === n;
          return (
            <div key={s.label} className="relative flex flex-col items-center gap-2">
              <motion.span animate={{ scale: active ? 1.12 : 1 }} className={cx("grid h-10 w-10 place-items-center rounded-full transition-colors duration-500", done ? "bg-p text-ink" : active ? "bg-white text-ink shadow-[0_0_24px_rgba(255,255,255,0.35)]" : "bg-p-950 text-muted ring-1 ring-line-strong")}>
                {done ? <Check className="h-4 w-4" strokeWidth={3} /> : <s.icon className="h-4 w-4" />}
              </motion.span>
              <span className={cx("text-xs font-semibold", active || done ? "text-white" : "text-muted")}>{s.label}</span>
            </div>
          );
        })}
      </div>

      <div className="glass relative overflow-hidden rounded-[28px] p-6">
        <AnimatePresence mode="wait" custom={dir} initial={false}>
          <motion.div
            key={step}
            custom={dir}
            variants={{ in: (d: number) => ({ opacity: 0, x: 40 * d, filter: "blur(6px)" }), on: { opacity: 1, x: 0, filter: "blur(0px)" }, out: (d: number) => ({ opacity: 0, x: -40 * d, filter: "blur(6px)" }) }}
            initial="in"
            animate="on"
            exit="out"
            transition={{ duration: 0.4, ease: EASE }}
            className="space-y-4"
          >
            {step === 1 && (
              <>
                <Field label="Legal name"><Input value={f.legalName} onChange={(e) => setF({ ...f, legalName: e.target.value })} data-testid="kyc-name" /></Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Date of birth"><Input type="date" value={f.dateOfBirth} onChange={(e) => setF({ ...f, dateOfBirth: e.target.value })} data-testid="kyc-dob" /></Field>
                  <Field label="Country (ISO code)"><Input maxLength={2} value={f.country} onChange={(e) => setF({ ...f, country: e.target.value.toUpperCase() })} placeholder="IN" className="font-mono uppercase" data-testid="kyc-country" /></Field>
                </div>
                <Field label="Address"><Input value={f.addressLine} onChange={(e) => setF({ ...f, addressLine: e.target.value })} data-testid="kyc-address" /></Field>
                <Button className="w-full" disabled={!f.legalName || !f.dateOfBirth || f.country.length !== 2 || f.addressLine.length < 5} onClick={() => go(2)} data-testid="kyc-next1">Continue</Button>
              </>
            )}
            {step === 2 && (
              <>
                <div className="text-sm font-semibold text-white/80">Investor type</div>
                <div className="grid grid-cols-3 gap-2">
                  {TYPES.map((t) => (
                    <motion.button key={t.id} whileTap={{ scale: 0.96 }} onClick={() => { setF({ ...f, investorType: t.id }); setAtt([]); }} className={cx("relative overflow-hidden rounded-2xl border p-3 text-left transition-colors", f.investorType === t.id ? "border-p" : "border-line-strong hover:border-p/40")}>
                      {f.investorType === t.id && <motion.span layoutId="inv-type" className="absolute inset-0 bg-p/15" transition={{ type: "spring", stiffness: 400, damping: 30 }} />}
                      <div className="relative text-sm font-bold">{t.label}</div>
                      <div className="relative mt-0.5 text-[11px] leading-tight text-muted">{t.sub}</div>
                    </motion.button>
                  ))}
                </div>
                <div className="space-y-2">
                  {ATTEST[f.investorType].map((a, i) => {
                    const on = att.includes(a);
                    return (
                      <motion.label key={a} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }} className={cx("relative flex cursor-pointer gap-3 rounded-2xl border p-4 text-sm transition-colors", on ? "border-p/50 bg-p/[0.08]" : "border-line hover:border-line-strong")}>
                        <input type="checkbox" className="absolute inset-0 h-full w-full cursor-pointer opacity-0" checked={on} onChange={(e) => setAtt(e.target.checked ? [...att, a] : att.filter((x) => x !== a))} data-testid="kyc-attest" />
                        <span className={cx("mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md transition-colors", on ? "bg-p text-ink" : "ring-1 ring-line-strong")}>
                          <AnimatePresence>{on && <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}><Check className="h-3.5 w-3.5" strokeWidth={3.5} /></motion.span>}</AnimatePresence>
                        </span>
                        <span className="text-white/85">{a}</span>
                      </motion.label>
                    );
                  })}
                </div>
                <div className="flex gap-2">
                  <Button variant="secondary" onClick={() => go(1)}>Back</Button>
                  <Button className="flex-1" disabled={att.length < 2} onClick={() => go(3)} data-testid="kyc-next2">Continue</Button>
                </div>
              </>
            )}
            {step === 3 && (
              <>
                <Field label="ID document (passport, national ID or driving licence)" hint="Checked for type and size, then discarded — never stored.">
                  <label className={cx("group relative flex cursor-pointer flex-col items-center justify-center gap-2 overflow-hidden rounded-2xl border border-dashed p-8 text-center transition-colors", doc ? "border-p/60 bg-p/[0.08]" : "border-line-strong hover:border-p/50")}>
                    <input type="file" className="absolute inset-0 cursor-pointer opacity-0" accept="image/*,application/pdf" capture="environment" onChange={(e) => setDoc(e.target.files?.[0] ?? null)} data-testid="kyc-doc" />
                    <motion.span animate={{ y: doc ? 0 : [0, -4, 0] }} transition={{ repeat: doc ? 0 : Infinity, duration: 2 }} className={cx("grid h-12 w-12 place-items-center rounded-2xl", doc ? "bg-p text-ink" : "bg-p/15 text-p")}>
                      {doc ? <Check className="h-5 w-5" strokeWidth={3} /> : <FileUp className="h-5 w-5" />}
                    </motion.span>
                    <span className="text-sm font-semibold">{doc ? doc.name : "Drop or choose a file"}</span>
                    <span className="text-xs text-muted">Image or PDF</span>
                  </label>
                </Field>
                <AnimatePresence>
                  {busy === "kyc" && (
                    <motion.p initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="flex items-center gap-2 text-sm text-p">
                      <Spinner className="h-4 w-4" /> Checking your documents…
                    </motion.p>
                  )}
                </AnimatePresence>
                <div className="flex gap-2">
                  <Button variant="secondary" onClick={() => go(2)}>Back</Button>
                  <Button className="flex-1" loading={busy === "kyc"} disabled={!doc} onClick={submit} data-testid="kyc-submit">
                    <ShieldCheck className="h-4 w-4" /> Submit
                  </Button>
                </div>
              </>
            )}
          </motion.div>
        </AnimatePresence>
        <p className="mt-6 flex flex-wrap items-center gap-2 border-t border-line pt-4 text-[11px] text-muted">
          <Badge tone="warn">Testnet</Badge> Identity verification will be provided by Sumsub or Persona. This demo auto-approves.
        </p>
      </div>
    </div>
  );
}
