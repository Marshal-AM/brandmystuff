"use client";
import { useState } from "react";
import { useExportWallet } from "@privy-io/react-auth/extended-chains";
import { useSession } from "@/lib/client/session";
import { sendCoin } from "@/lib/sui/tx";
import { SUI } from "@/lib/deployment";
import { Button, Card, Field, Input, Select, Stat, suiscan, useAction, usdc } from "@/components/ui";
import { SignInButtons } from "@/components/shell";

export default function Wallet() {
  const { me, authenticated, api, run, refresh, mode, address } = useSession();
  const { exportWallet } = useExportWallet();
  const [to, setTo] = useState("");
  const [amt, setAmt] = useState("");
  const [coin, setCoin] = useState<"usdc" | "sui">("usdc");
  const { busy, run: act } = useAction();
  if (!authenticated) return <div className="grid place-items-center py-24"><SignInButtons /></div>;
  const send = () =>
    act("send", async () => {
      const amount = coin === "usdc" ? BigInt(Math.round(Number(amt) * 1e6)) : BigInt(Math.round(Number(amt) * 1e9));
      await run(sendCoin({ coinType: coin === "usdc" ? SUI.usdcType : "0x2::sui::SUI", amount, to }));
      setAmt("");
    }, "Sent");
  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-10">
      <h1 className="text-3xl font-semibold">Wallet</h1>
      <Card>
        <div className="text-sm text-muted">Your Sui address ({mode === "privy" ? "Privy embedded wallet" : "external wallet"})</div>
        <div className="mt-1 flex items-center gap-2">
          <code className="break-all text-sm" data-testid="sui-address">{address}</code>
          <Button size="sm" variant="secondary" onClick={() => navigator.clipboard.writeText(address!)}>Copy</Button>
        </div>
        <div className="mt-2 text-xs text-muted">
          ENS owner (EVM) address: <code>{me?.user?.evm_address ?? "—"}</code> · <a className="underline" href={suiscan("account", address!)} target="_blank" rel="noreferrer">view on Suiscan</a>
        </div>
      </Card>
      <div className="grid grid-cols-2 gap-3">
        <Stat label="USDC" value={usdc(me?.balances.usdc)} />
        <Stat label="SUI (gas)" value={`${(Number(me?.balances.sui ?? 0) / 1e9).toFixed(4)} SUI`} />
      </div>
      <Card className="space-y-3">
        <h2 className="font-semibold">Get test funds</h2>
        <p className="text-sm text-muted">The platform sends you 0.2 test SUI and 5 test USDC, once every 24 hours.</p>
        <div className="flex flex-wrap gap-2">
          <Button loading={busy === "fund"} onClick={() => act("fund", async () => { const r = await api<any>("/api/wallet/test-funds", { method: "POST" }); await refresh(); return r; }, "Test funds sent")} data-testid="test-funds">
            Get test funds
          </Button>
          <a className="rounded-xl border border-line px-4 py-2.5 text-sm hover:border-violet-300" href={`https://faucet.sui.io/?address=${address}`} target="_blank" rel="noreferrer">faucet.sui.io</a>
          <a className="rounded-xl border border-line px-4 py-2.5 text-sm hover:border-violet-300" href="https://faucet.circle.com" target="_blank" rel="noreferrer">faucet.circle.com (USDC)</a>
        </div>
      </Card>
      <Card className="space-y-3">
        <h2 className="font-semibold">Send</h2>
        <div className="grid gap-3 sm:grid-cols-[1fr_140px_120px]">
          <Field label="To (Sui address)"><Input value={to} onChange={(e) => setTo(e.target.value.trim())} placeholder="0x…" /></Field>
          <Field label="Amount"><Input inputMode="decimal" value={amt} onChange={(e) => setAmt(e.target.value)} /></Field>
          <Field label="Coin"><Select value={coin} onChange={(e) => setCoin(e.target.value as any)}><option value="usdc">USDC</option><option value="sui">SUI</option></Select></Field>
        </div>
        <Button loading={busy === "send"} disabled={!/^0x[0-9a-f]{64}$/.test(to) || !(Number(amt) > 0)} onClick={send}>Send</Button>
      </Card>
      {mode === "privy" && (
        <Card>
          <h2 className="font-semibold">Self-custody</h2>
          <p className="mt-1 text-sm text-muted">Export your embedded Sui wallet&apos;s private key to import it elsewhere.</p>
          <Button variant="secondary" className="mt-3" onClick={() => exportWallet({ address: address! })}>Export key</Button>
        </Card>
      )}
    </div>
  );
}
