"use client";
import { useEffect, useRef, useState } from "react";
import { motion, useInView } from "framer-motion";
import { Bot, Check, Copy, CreditCard, Megaphone, Network, ShieldCheck } from "lucide-react";
import { SUI } from "@/lib/deployment";
import { Card, EASE, PageHeader, cx } from "@/components/ui";

const MCP = `POST /api/mcp   (JSON-RPC 2.0)
tools: search_spaces, get_space, get_object, quote_lease, quote_sponsorship

{"jsonrpc":"2.0","id":1,"method":"tools/call",
 "params":{"name":"search_spaces","arguments":{"category":"laptop","maxPricePerWeekUsdc":5}}}`;

const LEASE = `POST /api/x402/leases
{"spaceId":"0x…","weeks":1,"creativeUrl":"https://…/logo.png","landingUrl":"https://acme.com","brand":"Acme"}

← 402 Payment Required
PAYMENT-REQUIRED: base64({x402Version:2, accepts:[{scheme:"exact", network:"sui:testnet",
  amount:"1000000", asset:"${SUI.usdcType}", payTo:"${SUI.platformAddress}",
  maxTimeoutSeconds:120, extra:{intentId:"…"}}]})

→ build + sign a Sui tx transferring exactly amount USDC to payTo, then retry:
PAYMENT-SIGNATURE: base64({x402Version:2, accepted:<the requirement>, payload:{signature, transaction}})

← 200 {leaseId, escrowId, ensName, …}
PAYMENT-RESPONSE: base64({success:true, transaction:<digest>, network:"sui:testnet", payer})`;

const SPONSOR = `POST /api/x402/sponsorships  {"objectId":"0x…","tier":1,"days":3}`;

function tint(line: string) {
  if (/^(POST|GET)\b/.test(line)) return "text-p font-semibold";
  if (line.startsWith("←")) return "text-white";
  if (line.startsWith("→")) return "text-p-300";
  if (/^[A-Z-]+:/.test(line)) return "text-p-200";
  return "text-white/60";
}

function Terminal({ title, code }: { title: string; code: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  const [n, setN] = useState(0);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!inView) return;
    const step = Math.max(2, Math.ceil(code.length / 140));
    const t = setInterval(() => setN((x) => (x >= code.length ? (clearInterval(t), x) : x + step)), 16);
    return () => clearInterval(t);
  }, [inView, code]);
  const done = n >= code.length;
  const shown = code.slice(0, n);
  return (
    <motion.div ref={ref} initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.7, ease: EASE }} className="overflow-hidden rounded-3xl border border-line-strong bg-p-950 shadow-[0_30px_80px_-30px_rgba(171,159,242,0.35)]">
      <div className="flex items-center gap-2 border-b border-line px-4 py-3">
        <span className="h-2.5 w-2.5 rounded-full bg-white/20" />
        <span className="h-2.5 w-2.5 rounded-full bg-white/20" />
        <span className="h-2.5 w-2.5 rounded-full bg-p/70" />
        <span className="ml-2 font-mono text-[11px] text-muted">{title}</span>
        <button onClick={() => { navigator.clipboard?.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 1400); }} className="ml-auto inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] text-muted transition-colors hover:bg-white/[0.06] hover:text-white">
          {copied ? <Check className="h-3 w-3 text-p" /> : <Copy className="h-3 w-3" />} {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="relative overflow-x-auto p-5 font-mono text-[12px] leading-relaxed">
        <span aria-hidden className="invisible block h-0 overflow-hidden">{code}</span>
        {shown.split("\n").map((l, i, arr) => (
          <span key={i} className={cx("block min-h-[1.2em]", tint(l))}>
            {l}
            {i === arr.length - 1 && <span className="ml-0.5 inline-block h-[1.05em] w-[7px] translate-y-[2px] bg-p" style={{ animation: done ? "caret-blink 1s steps(1) infinite" : undefined }} />}
          </span>
        ))}
      </pre>
    </motion.div>
  );
}

const ENDPOINTS = [
  { icon: Network, method: "POST", path: "/api/mcp", desc: "Discover and quote spaces with JSON-RPC tools." },
  { icon: CreditCard, method: "POST", path: "/api/x402/leases", desc: "Lease a space. Pay USDC on Sui with x402 v2." },
  { icon: Megaphone, method: "POST", path: "/api/x402/sponsorships", desc: "Buy a Sponsored tag for an object." },
];

function Section({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <motion.h2 initial={{ opacity: 0, x: -16 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ duration: 0.6, ease: EASE }} className="flex items-center gap-3 text-2xl font-extrabold tracking-tight">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-p font-mono text-sm text-ink">{n}</span>
        {title}
      </motion.h2>
      {children}
    </section>
  );
}

export default function Agents() {
  return (
    <div className="mx-auto max-w-4xl space-y-12 px-4 sm:px-6">
      <PageHeader
        kicker="Agent API"
        title="Built for AI agents"
        sub={
          <>
            brandmystuff is agent-native. Discover spaces over MCP and lease them with <b className="text-white">x402 v2</b> (exact scheme on <code className="font-mono text-p">sui:testnet</code>, paid in USDC). The endpoint is published in ENS on <code className="font-mono text-p">agent.brandmystuff.eth</code> (ENSIP-26).
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        {ENDPOINTS.map((e, i) => (
          <motion.div key={e.path} initial={{ opacity: 0, y: 24, scale: 0.96 }} whileInView={{ opacity: 1, y: 0, scale: 1 }} viewport={{ once: true }} transition={{ delay: i * 0.08, duration: 0.6, ease: EASE }} whileHover={{ y: -4 }} className="group relative overflow-hidden rounded-3xl border border-line bg-white/[0.03] p-5 transition-colors hover:border-p/40">
            <div aria-hidden className="absolute -right-10 -top-10 h-28 w-28 rounded-full bg-p/0 blur-2xl transition-colors duration-500 group-hover:bg-p/25" />
            <e.icon className="relative h-5 w-5 text-p" />
            <div className="relative mt-4 flex items-center gap-2 font-mono text-xs">
              <span className="rounded-md bg-p/15 px-1.5 py-0.5 font-bold text-p">{e.method}</span>
              <span className="truncate text-white">{e.path}</span>
            </div>
            <p className="relative mt-2 text-sm text-muted">{e.desc}</p>
          </motion.div>
        ))}
      </div>

      <Card className="relative overflow-hidden">
        <div aria-hidden className="absolute -left-16 -top-16 h-48 w-48 rounded-full bg-p/20 blur-3xl" />
        <div className="relative flex items-start gap-4">
          <motion.span animate={{ y: [0, -4, 0] }} transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }} className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-p text-ink">
            <Bot className="h-5 w-5" />
          </motion.span>
          <div>
            <div className="font-bold">Scout uses the same rail</div>
            <p className="mt-1 text-sm text-muted">Every brand&apos;s Scout agent books spaces through this exact x402 flow. Anything Scout can do, your own agent can do too.</p>
          </div>
        </div>
      </Card>

      <Section n={1} title="MCP">
        <Terminal title="mcp.jsonrpc" code={MCP} />
      </Section>

      <Section n={2} title="x402 lease">
        <Terminal title="x402-lease.http" code={LEASE} />
        <p className="flex items-start gap-2 text-sm text-muted">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-p" />
          The owner still approves your creative; if they reject it or miss a proof, the escrow is refunded to your paying address automatically.
        </p>
      </Section>

      <Section n={3} title="x402 sponsorship">
        <Terminal title="x402-sponsorship.http" code={SPONSOR} />
      </Section>
    </div>
  );
}
