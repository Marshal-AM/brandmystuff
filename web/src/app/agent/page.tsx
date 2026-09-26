"use client";
import Link from "next/link";
import { EnsName } from "@/components/ens";
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowUpRight, Coins, Pause, Play, Plus, Radar, ShieldCheck, Sparkles, Wallet, X } from "lucide-react";
import { useSession } from "@/lib/client/session";
import { SUI } from "@/lib/deployment";
import { createMandate, mandateRevoke, mandateTopUp, mandateUpdate } from "@/lib/sui/tx";
import { emptyLive, reduceScout, type ScoutCandidate, type ScoutEvent, type ScoutLive } from "@/lib/scout/types";
import { Bot } from "@/components/scout-bot";
import { ScoutExperience } from "@/components/scout/ScoutExperience";
import { Badge, Button, Card, EASE, Empty, Field, Input, Kicker, Modal, PageLoader, cx, suiscan, useAction } from "@/components/ui";
import { SignInButtons } from "@/components/shell";

const LINES_NEW = (brand: string) => [
  `Hi! I'm Scout, ${brand}'s own agent.`,
  "Give me a budget mandate and I'll hunt for the perfect ad space.",
  "The mandate lives on Sui: I can never spend past it.",
  "I read every space's ENS records before I pick one.",
];
const LINES_READY = (brand: string) => [
  `Ready when you are, ${brand}.`,
  "I'll decode your brand, scan every space on ENS, and pick the best one.",
  "Then I pay with x402, straight from the mandate.",
];

/** Scout wandering around its corner of the page, saying things. Always stays fully inside the box. */
function WanderingScout({ lines, busy }: { lines: string[]; busy?: boolean }) {
  const box = useRef<HTMLDivElement>(null);
  const bot = useRef<HTMLDivElement>(null);
  const bubble = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [face, setFace] = useState(1);
  const [line, setLine] = useState(0);
  const [pose, setPose] = useState<"idle" | "wave" | "point" | "celebrate">("wave");

  // The reachable area for the bot's top-left corner, from the real sizes of the box, the bot
  // (incl. its bob and shadow) and the speech bubble centred above it.
  const bounds = () => {
    const el = box.current, b = bot.current;
    if (!el || !b) return null;
    const pad = 12;
    const bw = b.offsetWidth, bh = b.offsetHeight + 10; // + bob travel
    const sw = Math.max(bubble.current?.offsetWidth ?? 224, bw), sh = (bubble.current?.offsetHeight ?? 64) + 10;
    const side = Math.max(0, (sw - bw) / 2);
    return { minX: pad + side, maxX: Math.max(pad + side, el.clientWidth - pad - side - bw), minY: pad + sh, maxY: Math.max(pad + sh, el.clientHeight - pad - bh) };
  };
  const clamp = (p: { x: number; y: number }) => {
    const r = bounds();
    return r ? { x: Math.min(r.maxX, Math.max(r.minX, p.x)), y: Math.min(r.maxY, Math.max(r.minY, p.y)) } : p;
  };

  useEffect(() => {
    const place = () => {
      const r = bounds();
      if (r) setPos((p) => (p ? clamp(p) : { x: (r.minX + r.maxX) / 2, y: (r.minY + r.maxY) / 2 }));
    };
    place();
    const ro = new ResizeObserver(place);
    if (box.current) ro.observe(box.current);
    const t = setInterval(() => {
      const r = bounds();
      if (!r) return;
      setPos((p) => {
        const nx = r.minX + Math.random() * (r.maxX - r.minX);
        setFace(!p || nx >= p.x ? 1 : -1);
        return { x: nx, y: r.minY + Math.random() * (r.maxY - r.minY) };
      });
      setPose((["idle", "point", "wave", "idle"] as const)[Math.floor(Math.random() * 4)]);
    }, 3200);
    return () => {
      clearInterval(t);
      ro.disconnect();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const t = setInterval(() => setLine((l) => (l + 1) % lines.length), 4200);
    return () => clearInterval(t);
  }, [lines.length]);
  return (
    <div ref={box} className="relative h-[380px] overflow-hidden rounded-[2rem] border border-line bg-[radial-gradient(ellipse_at_50%_120%,rgba(171,159,242,0.18),transparent_60%)]">
      <div aria-hidden className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:40px_40px] [mask-image:radial-gradient(ellipse_at_center,#000_40%,transparent_75%)]" />
      <motion.div className="absolute left-0 top-0" initial={false} animate={pos ?? { x: 0, y: 0 }} style={{ opacity: pos ? 1 : 0 }} transition={{ type: "spring", stiffness: 40, damping: 12, mass: 1.2 }}>
        <div ref={bot} className="relative">
          <AnimatePresence mode="wait">
            <motion.div ref={bubble} key={line} initial={{ opacity: 0, y: 8, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -6, scale: 0.95 }} transition={{ duration: 0.3, ease: EASE }} className="absolute bottom-full left-1/2 mb-2 w-56 -translate-x-1/2 rounded-2xl rounded-bl-md border border-p/30 bg-p-950/95 px-3.5 py-2.5 text-xs font-medium leading-snug text-white shadow-[0_12px_40px_-10px_rgba(171,159,242,0.5)] backdrop-blur">
              {busy ? "On it…" : lines[line]}
            </motion.div>
          </AnimatePresence>
          <motion.div animate={{ y: [0, -8, 0] }} transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }} style={{ scaleX: face }}>
            <Bot pose={busy ? "celebrate" : pose} mood="happy" size={130} />
          </motion.div>
          <motion.div aria-hidden className="mx-auto mt-1 h-2 w-20 rounded-full bg-p/25 blur-md" animate={{ scaleX: [1, 0.8, 1] }} transition={{ duration: 2.2, repeat: Infinity }} />
        </div>
      </motion.div>
    </div>
  );
}

function Ring({ value, total }: { value: number; total: number }) {
  const r = 46, c = 2 * Math.PI * r, pct = total > 0 ? value / total : 0;
  return (
    <div className="relative h-32 w-32 shrink-0">
      <svg viewBox="0 0 110 110" className="h-32 w-32 -rotate-90">
        <circle cx="55" cy="55" r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="9" />
        <motion.circle cx="55" cy="55" r={r} fill="none" stroke="url(#mg)" strokeWidth="9" strokeLinecap="round" strokeDasharray={c} initial={{ strokeDashoffset: c }} animate={{ strokeDashoffset: c * (1 - pct) }} transition={{ duration: 1.2, ease: EASE }} />
        <defs>
          <linearGradient id="mg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#6f679d" />
            <stop offset="100%" stopColor="#ab9ff2" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div>
          <div className="text-2xl font-extrabold tabular-nums">{value.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
          <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted">USDC left</div>
        </div>
      </div>
    </div>
  );
}

/** Reads an NDJSON response line by line. */
async function readStream(res: Response, on: (e: any) => void) {
  if (!res.body) return;
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let nl: number;
    while ((nl = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (line) on(JSON.parse(line));
    }
  }
}

function RunDetails({ runId, onClose }: { runId: string | null; onClose: () => void }) {
  const { api } = useSession();
  const { data } = useQuery({ queryKey: ["agent-run", runId], queryFn: () => api<any>(`/api/agent/runs/${runId}`), enabled: !!runId });
  const r = data?.run;
  const cands: ScoutCandidate[] = r?.candidates ?? [];
  const [open, setOpen] = useState<string | null>(null);
  return (
    <Modal open={!!runId} onClose={onClose} title="What Scout considered" wide>
      {!r ? (
        <div className="py-10"><PageLoader label="Loading run" /></div>
      ) : (
        <div className="space-y-2">
          {r.payment?.digest && (
            <a href={suiscan("tx", r.payment.digest)} target="_blank" rel="noreferrer" className="mb-3 flex items-center justify-between gap-3 rounded-2xl border border-p/30 bg-p/[0.07] px-4 py-3 text-sm">
              <span>Paid <b>{r.payment.amount} USDC</b> via x402 · {r.payment.leaseEns}</span>
              <ArrowUpRight className="h-4 w-4 text-p" />
            </a>
          )}
          {cands.map((c, i) => {
            const isPick = c.id === r.pick_id;
            return (
              <div key={c.id} className={cx("overflow-hidden rounded-2xl border transition-colors", isPick ? "border-p/50 bg-p/[0.06]" : "border-line bg-white/[0.02]")}>
                <button type="button" onClick={() => setOpen(open === c.id ? null : c.id)} className="flex w-full items-center gap-3 p-3 text-left">
                  <span className="w-6 text-center font-mono text-xs text-muted">{i + 1}</span>
                  {c.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={c.imageUrl} alt="" className="h-10 w-10 rounded-xl object-cover" />
                  ) : (
                    <span className="h-10 w-10 rounded-xl bg-white/5" />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2 truncate text-sm font-bold">{c.title}{isPick && <Badge tone="brand">Picked</Badge>}{!c.affordable && <Badge>Over budget</Badge>}</span>
                    <span className="block truncate text-xs text-muted">{c.objectTitle} · {c.price} USDC/wk · {c.grade} {c.aqs}</span>
                  </span>
                  <span className={cx("font-mono text-lg font-extrabold tabular-nums", isPick ? "text-p" : "text-white/80")}>{c.match}</span>
                </button>
                <AnimatePresence initial={false}>
                  {open === c.id && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                      <div className="space-y-3 border-t border-line p-4">
                        <p className="text-sm leading-relaxed text-white/85">{c.reasoning}</p>
                        <div className="space-y-2">
                          {c.factors.map((f) => (
                            <div key={f.k}>
                              <div className="mb-1 flex justify-between gap-2 text-xs"><span className="text-white/75">{f.k} <span className="text-faint">×{f.weight}</span></span><span className="font-mono font-bold">{f.score}</span></div>
                              <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]"><motion.div className="h-full rounded-full bg-gradient-to-r from-p-600 to-p" initial={{ width: 0 }} animate={{ width: `${f.score}%` }} transition={{ duration: 0.7, ease: EASE }} /></div>
                              <div className="mt-0.5 text-[11px] text-muted">{f.note}</div>
                            </div>
                          ))}
                        </div>
                        <div className="rounded-xl bg-ink p-3 font-mono text-[11px] leading-relaxed text-white/70">
                          <div className="mb-1 flex items-center gap-1.5 text-p">ENS · {c.ensName} {c.verified && <ShieldCheck className="h-3 w-3" />}</div>
                          {Object.entries(c.ensRecords).map(([k, v]) => <div key={k} className="truncate"><span className="text-p-200">{k.replace(/^eth\.brandmystuff\./, "")}</span> = {v}</div>)}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      )}
    </Modal>
  );
}

export default function AgentPage() {
  const { authenticated, api, run, me, refresh, token, ready } = useSession();
  const isBrand = me?.user?.account_type === "brand";
  const { data, refetch, isLoading } = useQuery({ queryKey: ["agent"], queryFn: () => api<any>("/api/agent"), enabled: authenticated && isBrand });
  const { busy, run: act } = useAction();
  const [form, setForm] = useState({ budget: "1", cap: "1", days: "30" });
  const [topUp, setTopUp] = useState("");
  const [live, setLive] = useState<ScoutLive | null>(null);
  const [details, setDetails] = useState<string | null>(null);
  const brandName = me?.user?.brand_name ?? me?.user?.handle ?? "your brand";

  if (!ready) return <PageLoader label="Waking Scout" />;
  if (!authenticated)
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <Empty title="Your brand agent">Sign in as a brand to meet Scout.</Empty>
        <div className="mt-6 flex justify-center"><SignInButtons /></div>
      </div>
    );
  if (!isBrand)
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <Empty title="Scout works for brands">Brand accounts get their own agent. This account lists objects.</Empty>
      </div>
    );
  if (isLoading || !data) return <PageLoader label="Waking Scout" />;

  const m = data.mandate;
  const usdcBal = Number(me?.balances?.usdc ?? 0) / 1e6;
  const expired = m && m.expiresMs < Date.now();

  const createM = () =>
    act("mandate", async () => {
      const amount = BigInt(Math.round(Number(form.budget) * 1e6));
      const cap = BigInt(Math.round(Number(form.cap) * 1e6));
      const r = await run(createMandate({ amount, agent: data.agent.address, payee: SUI.platformAddress, perPaymentCap: cap, expiresMs: BigInt(Date.now() + Number(form.days) * 86400_000) }));
      await api("/api/agent/mandate", { method: "POST", json: { digest: r.digest } });
      await refetch();
    }, "Mandate set. Scout is ready", "Setting Scout's budget mandate…");

  // Scout run: stream the backend's steps into the experience.
  const startRun = async () => {
    const base = emptyLive({ name: brandName, short: brandName.split(/\s+/)[0], category: "", logoUrl: null }, m);
    setLive(base);
    // Only events that change what the scenes show trigger a render: log lines and the
    // per-candidate stream (the final "ranked" event carries every candidate) are skipped,
    // so the running animations aren't re-rendered mid-flight.
    const push = (e: ScoutEvent) => {
      if (e.t === "log" || e.t === "candidate") return;
      setLive((s) => (s ? reduceScout(s, e) : s));
    };
    const t = await token();
    try {
      const res = await fetch("/api/agent/run", { method: "POST", credentials: "include", headers: t ? { authorization: `Bearer ${t}` } : {} });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        push({ t: "error", error: j.error ?? `Couldn't start (${res.status})` });
        return;
      }
      await readStream(res, push);
    } catch {
      push({ t: "error", error: "Lost the connection to Scout" });
    }
  };
  const pay = async () => {
    const runId = live?.runId;
    if (!runId) return;
    setLive((s) => (s ? { ...s, payment: { status: "running", steps: [] } } : s));
    const push = (e: ScoutEvent) => setLive((s) => (s ? reduceScout(s, e) : s));
    const t = await token();
    try {
      const res = await fetch(`/api/agent/runs/${runId}/pay`, { method: "POST", credentials: "include", headers: t ? { authorization: `Bearer ${t}` } : {} });
      await readStream(res, push);
    } catch {
      push({ t: "error", error: "Lost the connection during payment" });
    } finally {
      refetch();
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <Kicker>Your agent</Kicker>
          <h1 className="mt-3 text-4xl font-extrabold tracking-tight sm:text-5xl">Scout <span className="text-muted">for</span> <span className="text-p">{brandName}</span></h1>
          <p className="mt-2 max-w-xl text-muted">One brand, one agent. Scout decodes your brand, reads every ad space from ENS, picks the single best one, and pays for it with x402 from your on-chain budget mandate.</p>
        </div>
        <div className="rounded-2xl border border-line bg-white/[0.03] px-4 py-3 text-xs">
          <div className="text-muted">Agent wallet</div>
          <a href={suiscan("account", data.agent.address)} target="_blank" rel="noreferrer" className="font-mono text-p hover:underline">{data.agent.address.slice(0, 10)}…{data.agent.address.slice(-6)}</a>
          <div className="mt-0.5 text-muted">{data.agent.gasSui.toFixed(3)} SUI gas</div>
          {data.ens?.name && (
            <Link href={`/${data.ens.name}`} className="mt-2 flex items-center gap-1.5 border-t border-line pt-2 text-muted hover:text-white" title="Scout's ENS identity: its own key writes its agent records; brandmystuff attests the mandate">
              <EnsName name={data.ens.name} status={data.ens.status} kind="agent" size="xs" card={false} />
              {data.ens.state && data.ens.state !== "active" && <span className="text-[10px]">{data.ens.state}</span>}
            </Link>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
        <WanderingScout lines={m ? LINES_READY(brandName) : LINES_NEW(brandName)} busy={busy === "mandate"} />

        {!m || !m.active || expired ? (
          <Card className="relative overflow-hidden">
            <div aria-hidden className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-p/20 blur-3xl" />
            <div className="relative">
              <div className="flex items-center gap-2 text-lg font-bold"><ShieldCheck className="h-5 w-5 text-p" /> Set Scout&apos;s budget mandate</div>
              <p className="mt-1 text-sm text-muted">A mandate is a Sui object that holds the budget. Scout can only spend it on ads through brandmystuff&apos;s x402 gate, never above the per-ad cap, and never after it expires. You can top up, pause or revoke it any time.</p>
              {m && (m.active === false || expired) && <p className="mt-3 rounded-xl bg-white/[0.04] px-3 py-2 text-xs text-p-200">Your last mandate is {expired ? "expired" : "revoked"}. Set a new one.</p>}
              <div className="mt-5 grid gap-4 sm:grid-cols-3">
                <Field label="Total budget (USDC)"><Input inputMode="decimal" value={form.budget} onChange={(e) => setForm({ ...form, budget: e.target.value.replace(/[^\d.]/g, "") })} data-testid="mandate-budget" /></Field>
                <Field label="Max per ad (USDC)"><Input inputMode="decimal" value={form.cap} onChange={(e) => setForm({ ...form, cap: e.target.value.replace(/[^\d.]/g, "") })} data-testid="mandate-cap" /></Field>
                <Field label="Valid for (days)"><Input inputMode="numeric" value={form.days} onChange={(e) => setForm({ ...form, days: e.target.value.replace(/\D/g, "") })} /></Field>
              </div>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-muted">
                <span className="inline-flex items-center gap-1.5"><Wallet className="h-3.5 w-3.5" /> You have {usdcBal.toFixed(2)} test USDC</span>
                {usdcBal < Number(form.budget || 0) && (
                  <Button size="sm" variant="secondary" loading={busy === "fund"} onClick={() => act("fund", async () => { await api("/api/wallet/test-funds", { method: "POST" }); await refresh(); }, "Test funds sent")}>Get test USDC</Button>
                )}
              </div>
              <Button className="mt-5 w-full" size="lg" loading={busy === "mandate"} disabled={!(Number(form.budget) > 0 && Number(form.cap) > 0 && Number(form.days) > 0) || Number(form.cap) > Number(form.budget)} onClick={createM} data-testid="create-mandate">
                <ShieldCheck className="h-4 w-4" /> Sign mandate · {Number(form.budget || 0)} USDC
              </Button>
              <p className="mt-3 text-center text-[11px] text-muted">Contract <a className="font-mono text-p hover:underline" href={suiscan("object", SUI.mandatePackageId)} target="_blank" rel="noreferrer">{SUI.mandatePackageId.slice(0, 10)}…::mandate</a></p>
            </div>
          </Card>
        ) : (
          <Card className="relative overflow-hidden">
            <div aria-hidden className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-p/20 blur-3xl" />
            <div className="relative flex flex-wrap items-center gap-6">
              <Ring value={m.remaining} total={m.budget} />
              <div className="min-w-0 flex-1 space-y-1.5 text-sm">
                <div className="flex items-center gap-2 font-bold">Budget mandate <Badge tone="ok">active</Badge></div>
                <div className="text-muted">Spent <b className="text-white">{m.spent}</b> of {m.budget} USDC · {m.payments ?? 0} ad{(m.payments ?? 0) === 1 ? "" : "s"}</div>
                <div className="text-muted">Max <b className="text-white">{m.perAdCap} USDC</b> per ad · until {new Date(m.expiresMs).toLocaleDateString()}</div>
                <a href={suiscan("object", m.id)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-mono text-[11px] text-p hover:underline">{m.id.slice(0, 12)}… <ArrowUpRight className="h-3 w-3" /></a>
              </div>
            </div>
            <div className="relative mt-5 flex flex-wrap items-end gap-2">
              <div className="w-32"><Input inputMode="decimal" placeholder="Top up USDC" value={topUp} onChange={(e) => setTopUp(e.target.value.replace(/[^\d.]/g, ""))} /></div>
              <Button variant="secondary" loading={busy === "topup"} disabled={!(Number(topUp) > 0)} onClick={() => act("topup", async () => { await run(mandateTopUp({ mandateId: m.id, amount: BigInt(Math.round(Number(topUp) * 1e6)) })); setTopUp(""); await refetch(); }, "Mandate topped up", "Topping up the mandate…")}><Plus className="h-4 w-4" /> Top up</Button>
              <Button variant="ghost" loading={busy === "pause"} onClick={() => act("pause", async () => { await run(mandateUpdate({ mandateId: m.id, perPaymentCap: BigInt(Math.round(m.perAdCap * 1e6)), expiresMs: BigInt(m.expiresMs), active: false })); api("/api/agent/sync", { method: "POST" }).catch(() => null); await refetch(); }, "Scout paused", "Pausing Scout…")}><Pause className="h-4 w-4" /> Pause</Button>
              <Button variant="danger" loading={busy === "revoke"} onClick={() => act("revoke", async () => { await run(mandateRevoke({ mandateId: m.id })); api("/api/agent/sync", { method: "POST" }).catch(() => null); await refetch(); await refresh(); }, "Mandate revoked, funds returned", "Revoking the mandate…")}><X className="h-4 w-4" /> Revoke</Button>
            </div>
            <Button className="relative mt-6 w-full" size="lg" onClick={startRun} data-testid="run-scout">
              <Radar className="h-5 w-5" /> Run Scout
            </Button>
          </Card>
        )}
      </div>

      {m && m.active === false && !expired && (
        <div className="mt-4">
          <Button variant="secondary" loading={busy === "resume"} onClick={() => act("resume", async () => { await run(mandateUpdate({ mandateId: m.id, perPaymentCap: BigInt(Math.round(m.perAdCap * 1e6)), expiresMs: BigInt(m.expiresMs), active: true })); api("/api/agent/sync", { method: "POST" }).catch(() => null); await refetch(); }, "Scout resumed", "Resuming Scout…")}><Play className="h-4 w-4" /> Resume the paused mandate</Button>
        </div>
      )}

      <div className="mt-10">
        <h2 className="mb-4 flex items-center gap-2 text-xl font-extrabold tracking-tight"><Sparkles className="h-5 w-5 text-p" /> Scout&apos;s runs</h2>
        {!data.runs.length ? (
          <p className="text-sm text-muted">No runs yet. Once the mandate is set, press Run Scout.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {data.runs.map((r: any, i: number) => (
              <motion.button key={r.id} type="button" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }} onClick={() => setDetails(r.id)} className="group flex items-center gap-3 rounded-2xl border border-line bg-white/[0.02] p-3 text-left transition-colors hover:border-p/40">
                {r.pick?.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={r.pick.imageUrl} alt="" className="h-14 w-14 rounded-xl object-cover" />
                ) : (
                  <span className="grid h-14 w-14 place-items-center rounded-xl bg-p/10 text-p"><Coins className="h-5 w-5" /></span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2 text-sm font-bold">{r.pick ? `${r.pick.title} on ${r.pick.objectTitle}` : "No pick"}<Badge tone={r.status === "paid" ? "ok" : r.status === "failed" || r.status === "pay_failed" ? "bad" : "neutral"}>{r.status === "paid" ? "booked" : r.status.replace("_", " ")}</Badge></span>
                  <span className="block truncate text-xs text-muted">{new Date(r.createdAt).toLocaleString()} · {r.considered} spaces considered{r.pick ? ` · match ${r.pick.match}` : ""}</span>
                </span>
                <span className="text-xs font-semibold text-p opacity-0 transition-opacity group-hover:opacity-100">Reasoning →</span>
              </motion.button>
            ))}
          </div>
        )}
        <p className="mt-4 text-xs text-muted">Booked ads show up in <Link href="/dashboard" className="text-p hover:underline">My ads</Link>.</p>
      </div>

      {live && <ScoutExperience live={live} onPay={pay} onClose={() => { setLive(null); refetch(); refresh(); }} />}
      <RunDetails runId={details} onClose={() => setDetails(null)} />
    </div>
  );
}
