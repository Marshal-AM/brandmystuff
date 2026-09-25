"use client";
import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowUpRight, Check, Copy, Droplets, ExternalLink, KeyRound, Send, Sparkles, Wallet as WalletIcon } from "lucide-react";
import { useExportWallet } from "@privy-io/react-auth/extended-chains";
import { useSession } from "@/lib/client/session";
import { sendCoin } from "@/lib/sui/tx";
import { SUI } from "@/lib/deployment";
import { AnimatedNumber, Button, Card, EASE, Empty, Field, Input, PageHeader, cx, suiscan, useAction } from "@/components/ui";
import { SignInButtons } from "@/components/shell";

function CopyButton({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <motion.button
      whileTap={{ scale: 0.9 }}
      onClick={() => { navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 1400); }}
      className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/10 text-white transition-colors hover:bg-p hover:text-ink"
      aria-label="Copy address"
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span key={done ? "y" : "n"} initial={{ scale: 0, rotate: -90 }} animate={{ scale: 1, rotate: 0 }} exit={{ scale: 0, rotate: 90 }} transition={{ type: "spring", stiffness: 500, damping: 25 }}>
          {done ? <Check className="h-4 w-4" strokeWidth={3} /> : <Copy className="h-4 w-4" />}
        </motion.span>
      </AnimatePresence>
    </motion.button>
  );
}

export default function Wallet() {
  const { me, authenticated, api, run, refresh, mode, address } = useSession();
  const { exportWallet } = useExportWallet();
  const [to, setTo] = useState("");
  const [amt, setAmt] = useState("");
  const [coin, setCoin] = useState<"usdc" | "sui">("usdc");
  const { busy, run: act } = useAction();
  if (!authenticated)
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <Empty title="Your wallet">Sign in to see your Sui address and balances.</Empty>
        <div className="mt-6 flex justify-center"><SignInButtons /></div>
      </div>
    );
  const send = () =>
    act("send", async () => {
      const amount = coin === "usdc" ? BigInt(Math.round(Number(amt) * 1e6)) : BigInt(Math.round(Number(amt) * 1e9));
      await run(sendCoin({ coinType: coin === "usdc" ? SUI.usdcType : "0x2::sui::SUI", amount, to }));
      setAmt("");
    }, "Sent");
  const usdcN = Number(me?.balances.usdc ?? 0) / 1e6;
  const suiN = Number(me?.balances.sui ?? 0) / 1e9;
  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6">
      <PageHeader kicker="Wallet" title="Your money, on Sui" sub="Balances settle in USDC. A little SUI covers gas for every transaction you sign." />

      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.8, ease: EASE }}
        className="ring-spin relative overflow-hidden rounded-[32px] bg-gradient-to-br from-p-700 via-p-800 to-p-950 p-7 sm:p-9"
      >
        <div aria-hidden className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-p/40 blur-3xl [animation:drift_9s_ease-in-out_infinite_alternate]" />
        <div aria-hidden className="absolute -bottom-32 -left-16 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
        <div aria-hidden className="absolute inset-0 opacity-[0.07] [background-image:linear-gradient(white_1px,transparent_1px),linear-gradient(90deg,white_1px,transparent_1px)] [background-size:32px_32px]" />
        <div className="relative">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold backdrop-blur">
              <WalletIcon className="h-3.5 w-3.5" /> {mode === "privy" ? "Embedded wallet" : "External wallet"}
            </span>
            <a href={suiscan("account", address!)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold text-white/70 hover:text-white">
              Suiscan <ArrowUpRight className="h-3.5 w-3.5" />
            </a>
          </div>
          <div className="mt-8 text-sm font-medium text-white/60">Total balance</div>
          <div className="mt-1 flex items-baseline gap-3">
            <span className="text-5xl font-extrabold tracking-tighter sm:text-6xl">
              $<AnimatedNumber value={usdcN} format={(n) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} />
            </span>
            <span className="text-lg font-bold text-p-200">USDC</span>
          </div>
          <div className="mt-2 font-mono text-sm text-white/60">
            + <AnimatedNumber value={suiN} format={(n) => n.toFixed(4)} /> SUI for gas
          </div>
          <div className="mt-8 flex items-center gap-2 rounded-2xl bg-ink/40 p-2 pl-4 backdrop-blur">
            <code className="min-w-0 flex-1 break-all font-mono text-xs text-white/85 sm:text-sm" data-testid="sui-address">{address}</code>
            <CopyButton text={address!} />
          </div>
          <div className="mt-3 text-[11px] text-white/50">
            ENS owner (EVM): <code className="font-mono">{me?.user?.evm_address ?? "—"}</code>
          </div>
        </div>
      </motion.div>

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <Card delay={0.1} className="relative overflow-hidden">
          <div aria-hidden className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-p/15 blur-2xl" />
          <div className="relative">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-2xl bg-p/15 text-p"><Droplets className="h-5 w-5" /></span>
              <h2 className="text-lg font-bold">Get test funds</h2>
            </div>
            <p className="mt-3 text-sm text-muted">The platform sends you 0.2 test SUI and 5 test USDC, once every 24 hours.</p>
            <Button className="mt-5 w-full" loading={busy === "fund"} onClick={() => act("fund", async () => { const r = await api<any>("/api/wallet/test-funds", { method: "POST" }); await refresh(); return r; }, "Test funds sent")} data-testid="test-funds">
              <Sparkles className="h-4 w-4" /> Get test funds
            </Button>
            <div className="mt-3 flex flex-wrap gap-2">
              {[
                { href: `https://faucet.sui.io/?address=${address}`, label: "faucet.sui.io" },
                { href: "https://faucet.circle.com", label: "faucet.circle.com (USDC)" },
              ].map((l) => (
                <a key={l.href} href={l.href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-full border border-line-strong px-3 py-1.5 text-xs font-semibold text-white/75 transition-colors hover:border-p/50 hover:text-white">
                  {l.label} <ExternalLink className="h-3 w-3" />
                </a>
              ))}
            </div>
          </div>
        </Card>

        <Card delay={0.18}>
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-2xl bg-p/15 text-p"><Send className="h-5 w-5" /></span>
            <h2 className="text-lg font-bold">Send</h2>
          </div>
          <div className="relative mt-4 grid grid-cols-2 rounded-full bg-white/[0.05] p-1">
            {(["usdc", "sui"] as const).map((c) => (
              <button key={c} onClick={() => setCoin(c)} className={cx("relative z-10 rounded-full py-2 text-sm font-bold transition-colors", coin === c ? "text-ink" : "text-muted hover:text-white")}>
                {coin === c && <motion.span layoutId="coin-pill" className="absolute inset-0 -z-10 rounded-full bg-p" transition={{ type: "spring", stiffness: 450, damping: 32 }} />}
                {c.toUpperCase()}
              </button>
            ))}
          </div>
          <div className="mt-4 space-y-3">
            <Field label="To (Sui address)"><Input value={to} onChange={(e) => setTo(e.target.value.trim())} placeholder="0x…" className="font-mono" /></Field>
            <Field label={`Amount (${coin.toUpperCase()})`}><Input inputMode="decimal" value={amt} onChange={(e) => setAmt(e.target.value)} placeholder="0.00" /></Field>
          </div>
          <Button className="mt-4 w-full" loading={busy === "send"} disabled={!/^0x[0-9a-f]{64}$/.test(to) || !(Number(amt) > 0)} onClick={send}>
            <Send className="h-4 w-4" /> Send {coin.toUpperCase()}
          </Button>
        </Card>
      </div>

      {mode === "privy" && (
        <Card delay={0.26} className="mt-6 flex flex-wrap items-center gap-4">
          <span className="grid h-10 w-10 place-items-center rounded-2xl bg-white/[0.06] text-p"><KeyRound className="h-5 w-5" /></span>
          <div className="flex-1">
            <h2 className="font-bold">Self-custody</h2>
            <p className="text-sm text-muted">Export your embedded Sui wallet&apos;s private key to import it elsewhere.</p>
          </div>
          <Button variant="secondary" onClick={() => exportWallet({ address: address! })}>Export key</Button>
        </Card>
      )}
    </div>
  );
}
