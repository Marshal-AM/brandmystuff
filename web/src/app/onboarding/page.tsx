"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Transaction } from "@mysten/sui/transactions";
import { Box, Check, Fuel, ImagePlus, MapPin, Megaphone, X, Zap } from "lucide-react";
import { useSession } from "@/lib/client/session";
import { createProfile, setPayoutRoute } from "@/lib/sui/tx";
import { Bot } from "@/components/scout-bot";
import { Button, Spinner, cx, useAction } from "@/components/ui";
import { EnsHint, FitName } from "@/components/ens";
import { DEMO, DEMO_ENABLED, demoFile } from "@/lib/client/demo";

import { PayoutChainPicker, routeReady, usePayoutChains, type PayoutChoice } from "@/components/payouts";
import { FlowFrame, FlowInput, FlowNext, FlowQuestion, FlowTextarea, useFlow } from "@/components/flow";

type Mode = "owner" | "brand";

/** Top-right switch between listing your stuff and signing up as a brand. */
function ModeToggle({ mode, onChange }: { mode: Mode; onChange: (m: Mode) => void }) {
  return (
    <div className="inline-flex items-center gap-1 rounded-full border border-line bg-white/[0.03] p-1" role="tablist" aria-label="Account type">
      {(
        [
          { id: "owner", label: "I list my stuff", icon: Box },
          { id: "brand", label: "I'm a brand", icon: Megaphone },
        ] as const
      ).map((o) => (
        <button key={o.id} type="button" role="tab" aria-selected={mode === o.id} onClick={() => onChange(o.id)} data-testid={`mode-${o.id}`} className={cx("relative inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-semibold transition-colors", mode === o.id ? "text-ink" : "text-muted hover:text-white")}>
          {mode === o.id && <motion.span layoutId="onb-mode" className="absolute inset-0 rounded-full bg-p shadow-[0_0_24px_rgba(171,159,242,0.45)]" transition={{ type: "spring", stiffness: 380, damping: 30 }} />}
          <o.icon className="relative h-3.5 w-3.5" />
          <span className="relative">{o.label}</span>
        </button>
      ))}
    </div>
  );
}

function Onboarding() {
  const { api, run, me, refresh } = useSession();
  const router = useRouter();
  const next = useSearchParams().get("next") ?? "/dashboard";
  const [mode, setMode] = useState<Mode>("owner");
  const [handle, setHandle] = useState(() => (DEMO_ENABLED ? DEMO.handle() : ""));
  const [displayName, setDisplayName] = useState(DEMO.displayName);
  const [brand, setBrand] = useState(DEMO.brand);
  const [logo, setLogo] = useState<{ blobId: string; url: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [payout, setPayout] = useState<PayoutChoice>("sui");
  const [recipient, setRecipient] = useState<string | null>(null);
  const { data: chains } = usePayoutChains();
  const flow = useFlow(mode === "brand" ? 6 : 3);
  const { busy, run: act } = useAction();
  const low = me && BigInt(me.balances.sui) < 20_000_000n;
  const valid = /^[a-z0-9-]{3,32}$/.test(handle);
  const payTo = recipient ?? me?.user?.evm_address ?? "";

  const submit = () =>
    act("save", async () => {
      const json =
        mode === "brand"
          ? { handle, accountType: "brand", brandName: brand.name.trim(), displayName: brand.name.trim(), brandAbout: brand.about.trim() || undefined, brandLocation: brand.location.trim() || undefined, brandLogoBlobId: logo?.blobId }
          : { handle, accountType: "owner", displayName: displayName || undefined };
      const r = await api<any>("/api/me/profile", { method: "POST", json });
      // One signature: the on-chain profile and, if they picked another chain, their payout route.
      const tx = new Transaction();
      if (r.needsProfileTx) createProfile({ ensName: r.ensName, ensNamehash: r.ensNamehash }, tx);
      const route = mode === "owner" && payout !== "sui" ? chains?.find((c) => c.key === payout) : null;
      if (route) setPayoutRoute({ domain: route.domain, recipient: payTo }, tx);
      if (r.needsProfileTx || route) await run(tx);
      await refresh();
      router.push(mode === "brand" ? "/agent" : next === "/onboarding" ? "/dashboard" : next);
    });

  const uploadLogo = async (file?: File | null) => {
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.set("file", file);
      const r = await api<{ blobId: string }>("/api/upload", { method: "POST", body: fd });
      setLogo({ blobId: r.blobId, url: URL.createObjectURL(file) });
    } finally {
      setUploading(false);
    }
  };

  // what each step needs before Enter moves on
  const brandCan = [valid, brand.name.trim().length >= 2, brand.about.trim().length >= 10, !uploading, true, !busy];
  const ownerCan = [valid, true, !busy && routeReady(payout, payTo)];
  const canNext = mode === "brand" ? brandCan[flow.i] : ownerCan[flow.i];
  const onEnter = () => {
    if (!canNext) return;
    if (mode === "brand") return flow.i === 5 ? submit() : flow.next();
    return flow.i === 2 ? submit() : flow.next();
  };
  const switchMode = (m: Mode) => {
    setMode(m);
    if (flow.i > 0) flow.go(0);
  };

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

  const handleStep = (
    <FlowQuestion
      n={1}
      required
      title={mode === "brand" ? <>Hey, I&apos;m Scout, your brand&apos;s agent. Pick a handle.</> : <>Hey, I&apos;m Scout. What should your handle be?</>}
      sub={mode === "brand" ? "It becomes your brand's ENS name on Sepolia. I'll use it to book ad spaces for you." : "It becomes your ENS name on Sepolia, and your objects, spaces and leases live under it."}
      aside={
        <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: "spring", stiffness: 180, damping: 16 }} className="relative hidden shrink-0 md:block">
          <div aria-hidden className="absolute inset-0 -z-10 scale-150 rounded-full bg-p/25 blur-3xl" />
          <Bot pose={handle ? "point" : "wave"} mood={valid ? "happy" : "normal"} size={110} />
        </motion.div>
      }
    >
      <div className="relative">
        <span className="pointer-events-none absolute left-0 top-1 text-2xl font-semibold text-p sm:text-3xl">@</span>
        <FlowInput value={handle} onChange={(e) => setHandle(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 32))} onEnter={onEnter} placeholder={mode === "brand" ? "lumen" : "maya"} data-testid="handle" className="pl-8 font-mono sm:pl-9" />
      </div>
      <div className="mt-4 flex items-center gap-2 font-mono text-sm">
        <span className={cx("grid h-5 w-5 shrink-0 place-items-center rounded-full transition-colors", valid ? "bg-p text-ink" : "bg-white/10")}>{valid && <Check className="h-3 w-3" strokeWidth={3.5} />}</span>
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
        <EnsHint>
          {mode === "brand" ? (
            <>A real ENS name on Sepolia. Your brand story, logo and location are written to its records, so anyone can look you up.</>
          ) : (
            <>This is a real ENS name on Sepolia. Everything you list sits under it, like <span className="font-mono text-white/70">macbook.{handle || "yourname"}.brandmystuff.eth</span>.</>
          )}
        </EnsHint>
      </div>
      {gas}
      <FlowNext onClick={onEnter} disabled={!valid} testId="onboarding-next" />
    </FlowQuestion>
  );

  return (
    <div className="mx-auto max-w-3xl px-4 pb-16 sm:px-6">
      <div className="mb-8 flex items-center justify-end">
        <ModeToggle mode={mode} onChange={switchMode} />
      </div>
      <FlowFrame
        flow={flow}
        canNext={!!canNext}
        onEnter={onEnter}
        chapters={mode === "brand" ? [{ label: "Handle", from: 0 }, { label: "Your brand", from: 1 }, { label: "Go", from: 5 }] : [{ label: "Handle", from: 0 }, { label: "About you", from: 1 }, { label: "Payouts", from: 2 }]}
      >
        {flow.i === 0 && handleStep}

        {mode === "owner" && flow.i === 1 && (
          <FlowQuestion n={2} title={<>Nice to meet you, <span className="text-p">@{handle}</span>. What should we call you?</>} sub="Optional. Your display name is written to your ENS records, and you can change it later in settings.">
            <FlowInput value={displayName} onChange={(e) => setDisplayName(e.target.value)} onEnter={onEnter} placeholder="Display name" />
            <FlowNext onClick={onEnter} label={displayName ? "OK" : "Skip"} skip={!displayName} testId="onboarding-extras" />
          </FlowQuestion>
        )}

        {mode === "owner" && flow.i === 2 && (
          <FlowQuestion n={3} title="Where should your earnings land?" sub="When you hold units of a space and a brand's campaign pays out, your share is split on Sui. Keep it there, or have it sent as USDC to the chain you use most. You can change this any time in settings.">
            <PayoutChainPicker value={payout} onChange={setPayout} recipient={payTo} onRecipient={setRecipient} />
            {gas}
            <FlowNext onClick={submit} loading={busy === "save"} disabled={!valid || !routeReady(payout, payTo)} label="Create my profile" testId="save-handle" />
            <p className="mt-4 text-xs text-muted">This signs one Sui transaction: your on-chain profile{payout !== "sui" && " and your payout chain"}. The ENS name is registered by the platform in the background.</p>
          </FlowQuestion>
        )}

        {mode === "brand" && flow.i === 1 && (
          <FlowQuestion n={2} required title="What's your brand called?">
            <FlowInput value={brand.name} onChange={(e) => setBrand({ ...brand, name: e.target.value })} onEnter={onEnter} placeholder="Lumen Coffee Co." data-testid="brand-name" />
            <FlowNext onClick={onEnter} disabled={!brandCan[1]} />
          </FlowQuestion>
        )}

        {mode === "brand" && flow.i === 2 && (
          <FlowQuestion n={3} required title={<>Tell me about <span className="text-p">{brand.name || "your brand"}</span></>} sub="What you sell, who it's for, and how it should feel. I read this to understand your brand before I pick an ad space.">
            <FlowTextarea value={brand.about} onChange={(e) => setBrand({ ...brand, about: e.target.value })} onEnter={onEnter} placeholder="Small-batch specialty coffee for people who like slow mornings and a good desk ritual." data-testid="brand-about" />
            <p className="mt-3 text-xs text-muted">{brand.about.trim().length >= 10 ? "Looks good · Shift + Enter for a new line" : `${Math.max(0, 10 - brand.about.trim().length)} more characters`}</p>
            <FlowNext onClick={onEnter} disabled={!brandCan[2]} />
          </FlowQuestion>
        )}

        {mode === "brand" && flow.i === 3 && (
          <FlowQuestion n={4} title="Add your logo" sub="It's what your ads will show, and I study it to read your visual identity. PNG, JPG, WEBP or SVG.">
            <label
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                void uploadLogo(e.dataTransfer.files?.[0]);
              }}
              className={cx("group relative flex h-48 w-full max-w-md cursor-pointer items-center justify-center overflow-hidden rounded-3xl border border-dashed transition-colors", logo ? "border-p/50 bg-white" : "border-line-strong bg-white/[0.02] hover:border-p/50 hover:bg-p/[0.05]")}
            >
              <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="sr-only" onChange={(e) => void uploadLogo(e.target.files?.[0])} data-testid="brand-logo" />
              {logo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <motion.img key={logo.url} src={logo.url} alt="Brand logo" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="max-h-36 max-w-[80%] object-contain" />
              ) : uploading ? (
                <span className="flex items-center gap-2 text-sm text-p"><Spinner className="h-4 w-4" /> Uploading to Walrus…</span>
              ) : (
                <span className="flex flex-col items-center gap-2 text-sm text-muted">
                  <span className="grid h-12 w-12 place-items-center rounded-2xl bg-p/15 text-p transition-transform group-hover:scale-110"><ImagePlus className="h-5 w-5" /></span>
                  Drop your logo or click to choose
                </span>
              )}
              {logo && (
                <button type="button" onClick={(e) => { e.preventDefault(); setLogo(null); }} className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-full bg-ink/80 text-white" aria-label="Remove logo">
                  <X className="h-4 w-4" />
                </button>
              )}
            </label>
            {DEMO_ENABLED && !logo && (
              <Button type="button" variant="secondary" className="mt-4" loading={uploading} onClick={async () => uploadLogo(await demoFile("logo"))} data-testid="demo-logo">
                <Zap className="h-4 w-4" /> Demo submit
              </Button>
            )}
            <FlowNext onClick={onEnter} disabled={uploading} label={logo ? "OK" : "Skip for now"} skip={!logo} />
          </FlowQuestion>
        )}

        {mode === "brand" && flow.i === 4 && (
          <FlowQuestion n={5} title="Where is your brand based?" sub="City or region. It helps me find ad spaces your customers actually walk past.">
            <div className="relative">
              <MapPin className="pointer-events-none absolute left-0 top-2 h-6 w-6 text-p" />
              <FlowInput value={brand.location} onChange={(e) => setBrand({ ...brand, location: e.target.value })} onEnter={onEnter} placeholder="Bengaluru, India" className="pl-9" data-testid="brand-location" />
            </div>
            <FlowNext onClick={onEnter} label={brand.location ? "OK" : "Skip"} skip={!brand.location} />
          </FlowQuestion>
        )}

        {mode === "brand" && flow.i === 5 && (
          <FlowQuestion n={6} title={<>Ready, <span className="text-p">{brand.name}</span>?</>} sub="I'll create your profile and wake up your agent. Next you'll set my budget mandate: how much I'm allowed to spend on ads for you.">
            <div className="flex items-center gap-4 rounded-3xl border border-line bg-white/[0.02] p-4">
              {logo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logo.url} alt="" className="h-14 w-14 rounded-2xl bg-white object-contain p-1.5" />
              ) : (
                <span className="grid h-14 w-14 place-items-center rounded-2xl bg-p/15 text-xl font-extrabold text-p">{brand.name.slice(0, 1).toUpperCase()}</span>
              )}
              <div className="min-w-0">
                <div className="truncate text-lg font-bold">{brand.name}</div>
                <FitName text={`@${handle}.brandmystuff.eth${brand.location ? ` · ${brand.location}` : ""}`} base={14} className="text-muted" />
              </div>
            </div>
            {gas}
            <FlowNext onClick={submit} loading={busy === "save"} disabled={!valid || brand.name.trim().length < 2} label="Create brand & meet my agent" testId="save-brand" />
            <p className="mt-4 text-xs text-muted">This signs one Sui transaction (your on-chain profile). Your ENS name and records are written in the background.</p>
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
