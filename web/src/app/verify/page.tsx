"use client";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useSession } from "@/lib/client/session";
import { Badge, Button, Card, Field, Input, Select, Spinner, useAction } from "@/components/ui";
import { SignInButtons } from "@/components/shell";

const ATTEST: Record<string, string[]> = {
  accredited: ["I am an accredited investor (income > $200k or net worth > $1M excluding home).", "I understand these units are illiquid and may lose all value."],
  non_us: ["I am not a US person and am not investing on behalf of one.", "I understand these units are illiquid and may lose all value."],
  retail: ["I am investing within my personal limits and understand the risks.", "I understand these units are illiquid and may lose all value."],
};

export default function Verify() {
  const { authenticated, api, refresh } = useSession();
  const { data, refetch } = useQuery({ queryKey: ["kyc"], queryFn: () => api<any>("/api/kyc"), enabled: authenticated });
  const [step, setStep] = useState(1);
  const [f, setF] = useState({ legalName: "", dateOfBirth: "", country: "", addressLine: "", investorType: "non_us" });
  const [att, setAtt] = useState<string[]>([]);
  const [doc, setDoc] = useState<File | null>(null);
  const { busy, run } = useAction();
  if (!authenticated) return <div className="grid place-items-center py-24"><SignInButtons /></div>;
  const sub = data?.submission;
  if (sub?.status === "approved" && new Date(sub.expires_at).getTime() > Date.now())
    return (
      <div className="mx-auto max-w-lg px-4 py-16">
        <Card className="text-center">
          <div className="text-4xl">✅</div>
          <h1 className="mt-2 text-xl font-semibold">You&apos;re verified</h1>
          <p className="mt-1 text-sm text-muted">Investor type: {sub.investor_type.replace("_", "-")} · valid until {new Date(sub.expires_at).toLocaleDateString()}</p>
          <p className="mt-3 text-xs text-muted">Your verification is recorded on-chain (Sui KYC registry) and on your ENS name; your personal details never leave our private database.</p>
        </Card>
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
  return (
    <div className="mx-auto max-w-xl px-4 py-10">
      <h1 className="text-3xl font-semibold">Verify your identity</h1>
      <p className="mt-1 text-sm text-muted">Required to invest in or trade revenue units. Step {step} of 3.</p>
      <Card className="mt-6 space-y-4">
        {step === 1 && (
          <>
            <Field label="Legal name"><Input value={f.legalName} onChange={(e) => setF({ ...f, legalName: e.target.value })} data-testid="kyc-name" /></Field>
            <Field label="Date of birth"><Input type="date" value={f.dateOfBirth} onChange={(e) => setF({ ...f, dateOfBirth: e.target.value })} data-testid="kyc-dob" /></Field>
            <Field label="Country (ISO code)"><Input maxLength={2} value={f.country} onChange={(e) => setF({ ...f, country: e.target.value.toUpperCase() })} placeholder="IN" data-testid="kyc-country" /></Field>
            <Field label="Address"><Input value={f.addressLine} onChange={(e) => setF({ ...f, addressLine: e.target.value })} data-testid="kyc-address" /></Field>
            <Button disabled={!f.legalName || !f.dateOfBirth || f.country.length !== 2 || f.addressLine.length < 5} onClick={() => setStep(2)} data-testid="kyc-next1">Continue</Button>
          </>
        )}
        {step === 2 && (
          <>
            <Field label="Investor type">
              <Select value={f.investorType} onChange={(e) => { setF({ ...f, investorType: e.target.value }); setAtt([]); }}>
                <option value="accredited">Accredited investor</option>
                <option value="non_us">Non-US investor</option>
                <option value="retail">Retail investor</option>
              </Select>
            </Field>
            {ATTEST[f.investorType].map((a) => (
              <label key={a} className="flex gap-2 text-sm">
                <input type="checkbox" checked={att.includes(a)} onChange={(e) => setAtt(e.target.checked ? [...att, a] : att.filter((x) => x !== a))} data-testid="kyc-attest" />
                {a}
              </label>
            ))}
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setStep(1)}>Back</Button>
              <Button disabled={att.length < 2} onClick={() => setStep(3)} data-testid="kyc-next2">Continue</Button>
            </div>
          </>
        )}
        {step === 3 && (
          <>
            <Field label="ID document (passport, national ID or driving licence)" hint="Checked for type and size, then discarded — never stored.">
              <input type="file" accept="image/*,application/pdf" capture="environment" onChange={(e) => setDoc(e.target.files?.[0] ?? null)} data-testid="kyc-doc" />
            </Field>
            {busy === "kyc" && <p className="flex items-center gap-2 text-sm text-muted"><Spinner className="h-4 w-4" /> Checking your documents…</p>}
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setStep(2)}>Back</Button>
              <Button loading={busy === "kyc"} disabled={!doc} onClick={submit} data-testid="kyc-submit">Submit</Button>
            </div>
          </>
        )}
        <p className="border-t border-line pt-3 text-[11px] text-muted">
          <Badge>Testnet</Badge> Identity verification will be provided by Sumsub or Persona. This demo auto-approves.
        </p>
      </Card>
    </div>
  );
}
