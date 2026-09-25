"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AtSign, Check, Fuel } from "lucide-react";
import { useSession } from "@/lib/client/session";
import { createProfile } from "@/lib/sui/tx";
import { Bot } from "@/components/scout-bot";
import { Button, EASE, Field, Input, cx, useAction } from "@/components/ui";

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
  const valid = /^[a-z0-9-]{3,32}$/.test(handle);
  return (
    <div className="mx-auto max-w-lg px-4 pb-16">
      <div className="flex flex-col items-center text-center">
        <motion.div initial={{ opacity: 0, y: 30, scale: 0.8 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ type: "spring", stiffness: 180, damping: 16 }} className="relative">
          <div aria-hidden className="absolute inset-0 -z-10 scale-150 rounded-full bg-p/25 blur-3xl" />
          <Bot pose={busy === "save" ? "celebrate" : handle ? "point" : "wave"} mood={valid ? "happy" : "normal"} size={140} />
        </motion.div>
        <motion.h1 initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15, duration: 0.7, ease: EASE }} className="mt-4 text-4xl font-extrabold tracking-tight">
          Hey, I&apos;m Scout.
        </motion.h1>
        <motion.p initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25, duration: 0.7, ease: EASE }} className="mt-2 text-muted">
          Pick a handle. It becomes your ENS name on Sepolia ENSv2, and your objects, spaces and leases live under it.
        </motion.p>
      </div>

      <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35, duration: 0.8, ease: EASE }} className="glass mt-8 space-y-5 rounded-[28px] p-6">
        <Field label="Handle" hint="3–32 lowercase letters, digits or dashes">
          <div className="relative">
            <AtSign className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-p" />
            <Input value={handle} onChange={(e) => setHandle(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 32))} placeholder="maya" data-testid="handle" className="pl-10 font-mono" />
          </div>
        </Field>
        <div className={cx("flex items-center gap-2 overflow-hidden rounded-2xl border px-4 py-3 font-mono text-sm transition-colors duration-500", valid ? "border-p/40 bg-p/[0.08]" : "border-line bg-white/[0.02]")}>
          <span className={cx("grid h-5 w-5 shrink-0 place-items-center rounded-full transition-colors", valid ? "bg-p text-ink" : "bg-white/10")}>
            {valid && <Check className="h-3 w-3" strokeWidth={3.5} />}
          </span>
          <span className="flex min-w-0 truncate">
            <AnimatePresence mode="popLayout" initial={false}>
              {(handle || "yourname").split("").map((ch, i) => (
                <motion.span key={`${i}${ch}`} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ type: "spring", stiffness: 500, damping: 30 }} className={handle ? "text-white" : "text-faint"}>
                  {ch}
                </motion.span>
              ))}
            </AnimatePresence>
            <span className="text-p">.brandmystuff.eth</span>
          </span>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Display name (optional)">
            <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Maya Chen" />
          </Field>
          <Field label="Brand name (if you'll advertise)">
            <Input value={brandName} onChange={(e) => setBrandName(e.target.value)} placeholder="Acme" />
          </Field>
        </div>
        <AnimatePresence>
          {low && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
              <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-p-300/30 bg-p-300/10 p-4 text-sm text-p-100">
                <Fuel className="h-4 w-4 text-p-300" />
                <span className="flex-1">You need a little test SUI for gas first.</span>
                <Button size="sm" loading={busy === "fund"} onClick={() => act("fund", async () => { await api("/api/wallet/test-funds", { method: "POST" }); await refresh(); }, "Test funds sent")} data-testid="onboarding-funds">
                  Get test funds
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        <Button className="w-full" size="lg" loading={busy === "save"} disabled={!valid} onClick={submit} data-testid="save-handle">
          Create my profile
        </Button>
        <p className="text-center text-xs text-muted">This signs one Sui transaction (creates your on-chain profile). The ENS name is registered by the platform in the background.</p>
      </motion.div>
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
