"use client";
/** Cross-chain payouts: where a holder's revenue share lands, and each payout's trip there. */
import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowUpRight, Check, Route, Wallet } from "lucide-react";
import { useSession } from "@/lib/client/session";
import { clearPayoutRoute, setPayoutRoute } from "@/lib/sui/tx";
import { isEvmAddress } from "@/lib/payout-chains";
import { Badge, Button, Card, EASE, SectionTitle, ScrollArea, Spinner, cx, shortAddr, suiscan, usdc, useAction } from "@/components/ui";

export type PayoutChainInfo = { key: string; name: string; short: string; chainId: number; domain: number; usdc: string; explorer: string; relayer: string | null; enabled: boolean };
/** "sui" = keep claiming on Sui, otherwise a payout chain key */
export type PayoutChoice = "sui" | string;

const COLORS: Record<string, string> = { sui: "#4DA2FF", "eth-sepolia": "#8A9CF0", "base-sepolia": "#0052FF", "arb-sepolia": "#28A0F0", "op-sepolia": "#FF0420" };

/** Small, recognisable chain glyphs (simplified, not official logos). */
export function ChainMark({ chain, className = "h-8 w-8" }: { chain: string; className?: string }) {
  const c = COLORS[chain] ?? "#AB9FF2";
  return (
    <span className={cx("grid shrink-0 place-items-center rounded-full", className)} style={{ background: `${c}22`, boxShadow: `inset 0 0 0 1px ${c}55` }} aria-hidden>
      <svg viewBox="0 0 24 24" className="h-[58%] w-[58%]" fill={c}>
        {chain === "sui" && <path d="M12 3c3.2 3.6 6 7.2 6 10.4A6 6 0 0 1 6 13.4C6 10.2 8.8 6.6 12 3Z" />}
        {chain === "eth-sepolia" && <path d="M12 2 5.5 12.3 12 16l6.5-3.7L12 2Zm0 15.3-6.5-3.8L12 22l6.5-8.5-6.5 3.8Z" />}
        {chain === "base-sepolia" && <path d="M12 3a9 9 0 1 1-8.9 10.3h11.6v-2.6H3.1A9 9 0 0 1 12 3Z" />}
        {chain === "arb-sepolia" && <path d="M12 2.5 3.8 7.2v9.6L12 21.5l8.2-4.7V7.2L12 2.5Zm-1.4 5h2.3l3.6 9.6h-2.3l-2.4-6.6-2.4 6.6H7.1l3.5-9.6Z" />}
        {chain === "op-sepolia" && <path d="M7.4 16.6c-1 0-1.9-.3-2.5-.9-.6-.6-.9-1.4-.9-2.4 0-.2 0-.5.1-.8.1-.9.4-1.8.8-2.6.4-.8 1-1.4 1.6-1.8.7-.4 1.5-.6 2.3-.6 1 0 1.9.3 2.5.9.6.6.9 1.3.9 2.3 0 .3 0 .5-.1.8-.1.9-.4 1.8-.8 2.6-.4.8-1 1.4-1.6 1.8-.7.5-1.5.7-2.3.7Zm.3-2c.4 0 .8-.2 1.1-.5.3-.4.6-.9.7-1.6.1-.4.1-.7.1-1 0-.8-.4-1.2-1.2-1.2-.4 0-.8.2-1.1.5-.3.4-.6.9-.7 1.6-.1.4-.1.7-.1 1 0 .8.4 1.2 1.2 1.2Zm5.4 1.9 1.6-8.4h3.4c.9 0 1.6.2 2.1.6.5.4.7 1 .7 1.6 0 .2 0 .4-.1.6-.2 1-.6 1.7-1.3 2.2-.7.5-1.6.7-2.7.7h-1.2l-.5 2.7h-2Zm2.9-4.5h.9c.4 0 .7-.1 1-.3.3-.2.5-.5.5-.9v-.3c0-.5-.3-.7-1-.7h-.9l-.5 2.2Z" />}
      </svg>
    </span>
  );
}

export function usePayoutChains() {
  const { api } = useSession();
  return useQuery({ queryKey: ["payout-chains"], queryFn: () => api<{ chains: PayoutChainInfo[] }>("/api/payouts/chains").then((r) => r.chains), staleTime: 60_000 });
}

/**
 * The chain picker: Sui (default) or one of the CCTP chains. Chains without a MultiBaas deployment
 * and relayer yet show as "soon".
 */
export function PayoutChainPicker({ value, onChange, recipient, onRecipient, compact }: { value: PayoutChoice; onChange: (v: PayoutChoice) => void; recipient: string; onRecipient: (a: string) => void; compact?: boolean }) {
  const { data: chains } = usePayoutChains();
  const opts = [{ key: "sui", name: "Sui", short: "Sui", enabled: true } as const, ...(chains ?? [])];
  const picked = chains?.find((c) => c.key === value);
  const bad = value !== "sui" && recipient.length > 0 && !isEvmAddress(recipient);
  return (
    <div>
      <div className={cx("grid gap-2.5", compact ? "grid-cols-2 sm:grid-cols-3" : "grid-cols-2 sm:grid-cols-3")} role="radiogroup" aria-label="Payout chain">
        {opts.map((c) => {
          const on = value === c.key;
          return (
            <button
              key={c.key}
              type="button"
              role="radio"
              aria-checked={on}
              disabled={!c.enabled}
              onClick={() => onChange(c.key)}
              data-testid={`payout-chain-${c.key}`}
              className={cx(
                "relative flex items-center gap-3 rounded-2xl border p-3 text-left transition-[border-color,background-color,opacity] duration-300",
                on ? "border-p/70 bg-p/[0.08]" : "border-line bg-white/[0.02] hover:border-p/40",
                !c.enabled && "cursor-not-allowed opacity-45 hover:border-line",
              )}
            >
              {on && <motion.span layoutId={compact ? "payout-pick-s" : "payout-pick"} className="absolute inset-0 rounded-2xl ring-1 ring-p/60" transition={{ type: "spring", stiffness: 380, damping: 30 }} />}
              <ChainMark chain={c.key} className="h-9 w-9" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-bold">{c.short}</span>
                <span className="block truncate text-[11px] text-muted">{c.key === "sui" ? "Claim on Sui" : c.enabled ? "USDC via CCTP" : "Coming soon"}</span>
              </span>
              <span className={cx("grid h-5 w-5 shrink-0 place-items-center rounded-full transition-colors", on ? "bg-p text-ink" : "bg-white/10")}>{on && <Check className="h-3 w-3" strokeWidth={3.5} />}</span>
            </button>
          );
        })}
        {!chains && (
          <div className="col-span-2 flex items-center gap-2 p-3 text-xs text-muted sm:col-span-1"><Spinner className="h-3.5 w-3.5" /> Checking chains…</div>
        )}
      </div>
      <AnimatePresence initial={false}>
        {picked && (
          <motion.div key="addr" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.35, ease: EASE }} className="overflow-hidden">
            <label className="mt-5 block">
              <span className="text-xs font-semibold text-muted">Your {picked.name} address</span>
              <span className={cx("mt-1.5 flex items-center gap-2 rounded-2xl border bg-white/[0.03] px-3.5 py-3 transition-colors focus-within:border-p/60", bad ? "border-red-400/60" : "border-line")}>
                <Wallet className="h-4 w-4 shrink-0 text-p" />
                <input value={recipient} onChange={(e) => onRecipient(e.target.value.trim())} placeholder="0x…" spellCheck={false} data-testid="payout-recipient" className="min-w-0 flex-1 bg-transparent font-mono text-sm text-white outline-none placeholder:text-faint" />
              </span>
            </label>
            <p className={cx("mt-2 text-xs", bad ? "text-red-300" : "text-muted")}>
              {bad ? "That isn't an EVM address (0x followed by 40 hex characters)." : <>Your share is burned on Sui and minted as native USDC on {picked.short} with Circle CCTP. It arrives straight in this address.</>}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Adds the route to `tx` when the choice is an EVM chain. Returns whether anything was added. */
export function routeReady(choice: PayoutChoice, recipient: string) {
  return choice === "sui" || isEvmAddress(recipient);
}

/** Settings card: see and change where your revenue share lands. */
export function PayoutRouteCard({ delay }: { delay?: number }) {
  const { api, run, me } = useSession();
  const { data: chains } = usePayoutChains();
  const { data, refetch } = useQuery({ queryKey: ["my-payouts"], queryFn: () => api<any>("/api/me/payouts"), enabled: !!me?.user?.sui_address });
  const route = data?.route;
  const [choice, setChoice] = useState<PayoutChoice>("sui");
  const [recipient, setRecipient] = useState("");
  const { busy, run: act } = useAction();
  // Seed the form from the saved route whenever it changes (adjusting state during render, not in an effect).
  const savedKey = data ? `${data.route?.chain ?? "sui"}:${data.route?.recipient ?? ""}` : null;
  const [seeded, setSeeded] = useState<string | null>(null);
  if (savedKey && seeded !== savedKey) {
    setSeeded(savedKey);
    setChoice(data.route?.chain ?? "sui");
    setRecipient(data.route?.recipient ?? me?.user?.evm_address ?? "");
  }
  const current = route?.chain ?? "sui";
  const dirty = choice !== current || (choice !== "sui" && recipient.toLowerCase() !== String(route?.recipient ?? "").toLowerCase());
  const save = () =>
    act(
      "route",
      async () => {
        if (choice === "sui") await run(clearPayoutRoute());
        else await run(setPayoutRoute({ domain: chains!.find((c) => c.key === choice)!.domain, recipient }));
        await refetch();
      },
      choice === "sui" ? "Payouts stay on Sui" : "Payout chain saved on Sui",
    );
  return (
    <Card className="mt-6" delay={delay}>
      <div className="mb-4">
        <h3 className="flex items-center gap-2 font-bold"><Route className="h-4 w-4 text-p" /> Where your revenue lands</h3>
        <p className="mt-0.5 text-xs text-muted">Ad income is earned and split on Sui. Pick another chain and your share is sent there as USDC after each payout. This is saved on Sui and signed by you.</p>
      </div>
      {!data ? (
        <div className="flex items-center gap-2 py-6 text-sm text-muted"><Spinner className="h-4 w-4" /> Loading your payout route…</div>
      ) : (
        <>
          <PayoutChainPicker value={choice} onChange={setChoice} recipient={recipient} onRecipient={setRecipient} compact />
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <Button loading={busy === "route"} disabled={!dirty || !routeReady(choice, recipient) || !chains} onClick={save} data-testid="save-payout-route">
              {choice === "sui" && route ? "Go back to Sui" : "Save payout chain"}
            </Button>
            {route && route.set_digest && (
              <a href={suiscan("tx", route.set_digest)} target="_blank" rel="noreferrer" className="text-xs font-semibold text-p hover:underline">Route on Sui ↗</a>
            )}
          </div>
        </>
      )}
    </Card>
  );
}

const STEPS = [
  { id: "released", label: "Sent from Sui" },
  { id: "attested", label: "Circle attested" },
  { id: "delivering", label: "Minting" },
  { id: "delivered", label: "Arrived" },
] as const;
const stepIndex = (s: string) => Math.max(0, STEPS.findIndex((x) => x.id === s));

function Journey({ p, chain }: { p: any; chain?: PayoutChainInfo }) {
  const at = p.status === "failed" ? -1 : stepIndex(p.status);
  const done = p.status === "delivered";
  return (
    <div className="rounded-2xl border border-line bg-white/[0.02] p-3.5" data-testid="payout-journey">
      <div className="flex items-center justify-between gap-3">
        <span className="flex min-w-0 items-center gap-2.5">
          <ChainMark chain={p.chain} className="h-8 w-8" />
          <span className="min-w-0">
            <span className="block truncate text-sm font-bold">{usdc(p.amount, 4)} to {chain?.short ?? p.chain}</span>
            <span className="block truncate text-[11px] text-muted">{p.space?.label ?? "Revenue share"} · {new Date(p.created_at).toLocaleString()}</span>
          </span>
        </span>
        <Badge tone={done ? "ok" : p.status === "failed" ? "bad" : "brand"}>{done ? "Delivered" : p.status === "failed" ? "Failed" : "In transit"}</Badge>
      </div>
      <div className="mt-3.5 grid grid-cols-4 gap-1.5">
        {STEPS.map((s, i) => {
          const reached = done || i <= at;
          const live = !done && i === at + 1 && p.status !== "failed";
          return (
            <div key={s.id} className="min-w-0">
              <div className="relative h-1 overflow-hidden rounded-full bg-white/[0.07]">
                <motion.div initial={{ scaleX: 0 }} animate={{ scaleX: reached ? 1 : 0 }} transition={{ duration: 0.6, delay: i * 0.12, ease: EASE }} className="absolute inset-0 origin-left rounded-full bg-p" />
                {live && <motion.div className="absolute inset-y-0 w-1/3 rounded-full bg-p/60" animate={{ x: ["-100%", "300%"] }} transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }} />}
              </div>
              <div className={cx("mt-1.5 truncate text-[10px] font-semibold", reached ? "text-white/80" : "text-faint")}>{s.label}</div>
            </div>
          );
        })}
      </div>
      <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 text-[11px]">
        {p.release_digest && <a href={suiscan("tx", p.release_digest)} target="_blank" rel="noreferrer" className="font-semibold text-p hover:underline">Sui burn ↗</a>}
        {p.evm_tx && chain && <a href={`${chain.explorer}/tx/${p.evm_tx}`} target="_blank" rel="noreferrer" className="font-semibold text-p hover:underline">{chain.short} mint ↗</a>}
        <span className="font-mono text-faint">to {shortAddr(p.recipient)}</span>
        {p.error && !done && <span className="text-amber-300/80">Retrying: {String(p.error).slice(0, 80)}</span>}
      </div>
    </div>
  );
}

/** Dashboard (investor): the payout route, MultiBaas-read totals, and each payout's journey. */
export function PayoutsPanel() {
  const { api, me } = useSession();
  const { data } = useQuery({
    queryKey: ["my-payouts"],
    queryFn: () => api<any>("/api/me/payouts"),
    enabled: !!me?.user?.sui_address,
    refetchInterval: (q) => ((q.state.data as any)?.payouts?.some((p: any) => p.status !== "delivered" && p.status !== "failed") ? 5000 : 30000),
  });
  if (!data) return null;
  const chain = data.chains.find((c: PayoutChainInfo) => c.key === data.route?.chain) as PayoutChainInfo | undefined;
  const byKey = new Map<string, PayoutChainInfo>(data.chains.map((c: PayoutChainInfo) => [c.key, c]));
  return (
    <Card>
      <SectionTitle action={<Link href="/settings" className="inline-flex items-center gap-1 text-xs font-semibold text-p hover:underline">Change <ArrowUpRight className="h-3 w-3" /></Link>}>Cross-chain payouts</SectionTitle>
      <div className="flex flex-wrap items-center gap-4 rounded-2xl bg-white/[0.03] p-4">
        <ChainMark chain={data.route?.chain ?? "sui"} className="h-11 w-11" />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-bold">{chain ? `Paid on ${chain.name}` : "Paid on Sui"}</div>
          <div className="truncate text-xs text-muted">{chain ? <>USDC arrives at <span className="font-mono">{shortAddr(data.route.recipient)}</span> after every payout</> : "You claim your share on Sui. Pick another chain in settings to get it sent there."}</div>
        </div>
        {chain && data.onchain && (
          <div className="flex gap-2">
            <div className="rounded-xl bg-p/10 px-3 py-2 text-right">
              <div className="text-sm font-extrabold tabular-nums text-p">{data.onchain.delivered != null ? usdc(data.onchain.delivered, 4) : "…"}</div>
              <div className="text-[10px] text-muted">delivered</div>
            </div>
            <div className="rounded-xl bg-white/[0.04] px-3 py-2 text-right">
              <div className="text-sm font-extrabold tabular-nums">{data.onchain.balance != null ? usdc(data.onchain.balance, 2) : "…"}</div>
              <div className="text-[10px] text-muted">{chain.short} balance</div>
            </div>
          </div>
        )}
      </div>
      {data.payouts.length > 0 ? (
        <ScrollArea max={360} className="mt-4"><div className="space-y-2.5">{data.payouts.map((p: any) => <Journey key={p.id} p={p} chain={byKey.get(p.chain)} />)}</div></ScrollArea>
      ) : chain ? (
        <p className="mt-4 text-xs text-muted">No payouts yet. The next time a campaign on a space you hold pays out, your share will show up here.</p>
      ) : null}
      <div className="mt-4 flex justify-end">
        <a href="https://www.curvegrid.com" target="_blank" rel="noreferrer" className="inline-flex items-baseline gap-1.5 text-[11px] text-muted transition-colors hover:text-white" data-testid="powered-by-curvegrid">
          Cross-chain payouts powered by <span className="text-[13px] font-extrabold lowercase tracking-tight text-white">curvegrid</span>
        </a>
      </div>
    </Card>
  );
}
