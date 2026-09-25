"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { useSession } from "@/lib/client/session";
import { createProfile } from "@/lib/sui/tx";
import { Button, Card, Field, Input, useAction } from "@/components/ui";

function Onboarding() {
  const { api, run, me, refresh } = useSession();
  const router = useRouter();
  const next = useSearchParams().get("next") ?? "/dashboard";
  const [handle, setHandle] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [brandName, setBrandName] = useState("");
  const { busy, run: act } = useAction();
  const submit = () =>
    act("save", async () => {
      const r = await api<any>("/api/me/profile", { method: "POST", json: { handle, displayName: displayName || undefined, brandName: brandName || undefined } });
      if (r.needsProfileTx) await run(createProfile({ ensName: r.ensName, ensNamehash: r.ensNamehash }));
      await refresh();
      router.push(next === "/onboarding" ? "/dashboard" : next);
    });
  const low = me && BigInt(me.balances.sui) < 20_000_000n;
  return (
    <div className="mx-auto max-w-lg px-4 py-12">
      <Card>
        <h1 className="text-2xl font-semibold">Pick your handle</h1>
        <p className="mt-1 text-sm text-muted">It becomes your ENS name on Sepolia ENSv2 — your objects, spaces and leases live under it.</p>
        <div className="mt-6 space-y-4">
          <Field label="Handle" hint={handle ? <span className="font-mono">{handle}.brandmystuff.eth</span> : "3–32 lowercase letters, digits or dashes"}>
            <Input value={handle} onChange={(e) => setHandle(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))} placeholder="maya" data-testid="handle" />
          </Field>
          <Field label="Display name (optional)">
            <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Maya Chen" />
          </Field>
          <Field label="Brand name (if you'll advertise)">
            <Input value={brandName} onChange={(e) => setBrandName(e.target.value)} placeholder="Acme" />
          </Field>
          {low && (
            <div className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
              You need a little test SUI for gas first.
              <Button size="sm" className="ml-2" loading={busy === "fund"} onClick={() => act("fund", async () => { await api("/api/wallet/test-funds", { method: "POST" }); await refresh(); }, "Test funds sent")} data-testid="onboarding-funds">
                Get test funds
              </Button>
            </div>
          )}
          <Button className="w-full" loading={busy === "save"} disabled={handle.length < 3} onClick={submit} data-testid="save-handle">
            Create my profile
          </Button>
          <p className="text-xs text-muted">This signs one Sui transaction (creates your on-chain profile). The ENS name is registered by the platform in the background.</p>
        </div>
      </Card>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense>
      <Onboarding />
    </Suspense>
  );
}
