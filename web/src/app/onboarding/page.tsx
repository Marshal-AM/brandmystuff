"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Fuel } from "lucide-react";
import { useSession } from "@/lib/client/session";
import { createProfile } from "@/lib/sui/tx";
import { Bot } from "@/components/scout-bot";
import { Button, cx, useAction } from "@/components/ui";
import { EnsHint } from "@/components/ens";
import { FlowFrame, FlowInput, FlowNext, FlowQuestion, useFlow } from "@/components/flow";

function Onboarding() {
  const { api, run, me, refresh } = useSession();
  const router = useRouter();
  const next = useSearchParams().get("next") ?? "/dashboard";
  const [handle, setHandle] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [brandName, setBrandName] = useState("");
  const flow = useFlow(2);
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
  const canNext = flow.i === 0 ? valid : !busy;
  const onEnter = () => (flow.i === 0 ? valid && flow.next() : valid && submit());

  const gas = (
    <AnimatePresence>
      {low && (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
          <div className="mt-8 flex flex-wrap items-center gap-3 border-l-2 border-p-300 py-1 pl-4 text-sm text-p-100">
            <Fuel className="h-4 w-4 text-p-300" />
            <span className="flex-1">You need a little test SUI for gas first.</span>
            <Button size="sm" loading={busy === "fund"} onClick={() => act("fund", async () => { await api("/api/wallet/test-funds", { method: "POST" }); await refresh(); }, "Test funds sent")} data-testid="onboarding-funds">
              Get test funds
            </Button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return (
    <div className="mx-auto max-w-3xl px-4 pb-16 sm:px-6">
      <FlowFrame flow={flow} canNext={canNext} onEnter={onEnter}>
        {flow.i === 0 && (
          <FlowQuestion
            n={1}
            required
            title={<>Hey, I&apos;m Scout. What should your handle be?</>}
            sub="It becomes your ENS name on Sepolia, and your objects, spaces and leases live under it."
            aside={
              <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: "spring", stiffness: 180, damping: 16 }} className="relative hidden shrink-0 md:block">
                <div aria-hidden className="absolute inset-0 -z-10 scale-150 rounded-full bg-p/25 blur-3xl" />
                <Bot pose={handle ? "point" : "wave"} mood={valid ? "happy" : "normal"} size={110} />
              </motion.div>
            }
          >
            <div className="relative">
              <span className="pointer-events-none absolute left-0 top-1 text-2xl font-semibold text-p sm:text-3xl">@</span>
              <FlowInput value={handle} onChange={(e) => setHandle(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 32))} onEnter={onEnter} placeholder="maya" data-testid="handle" className="pl-8 font-mono sm:pl-9" />
            </div>
            <div className="mt-4 flex items-center gap-2 font-mono text-sm">
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
            <p className="mt-2 text-xs text-muted">3–32 lowercase letters, digits or dashes.</p>
            <div className="mt-4">
              <EnsHint>This is a real ENS name on Sepolia. Everything you list sits under it, like <span className="font-mono text-white/70">macbook.{handle || "yourname"}.brandmystuff.eth</span>.</EnsHint>
            </div>
            {gas}
            <FlowNext onClick={onEnter} disabled={!valid} testId="onboarding-next" />
          </FlowQuestion>
        )}

        {flow.i === 1 && (
          <FlowQuestion n={2} title={<>Nice to meet you, <span className="text-p">@{handle}</span>. Anything else?</>} sub="Both optional. Your display name and brand are written to your ENS records, and you can change them later in settings.">
            <div className="grid gap-8 sm:grid-cols-2">
              <FlowInput value={displayName} onChange={(e) => setDisplayName(e.target.value)} onEnter={onEnter} placeholder="Display name" />
              <FlowInput autoFocus={false} value={brandName} onChange={(e) => setBrandName(e.target.value)} onEnter={onEnter} placeholder="Brand (if you'll advertise)" className="placeholder:text-lg sm:placeholder:text-xl" />
            </div>
            {gas}
            <FlowNext onClick={submit} loading={busy === "save"} disabled={!valid} label="Create my profile" testId="save-handle" />
            <p className="mt-4 text-xs text-muted">This signs one Sui transaction (your on-chain profile). The ENS name is registered by the platform in the background.</p>
          </FlowQuestion>
        )}
      </FlowFrame>
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
