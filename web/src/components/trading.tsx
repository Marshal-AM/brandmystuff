"use client";
import { useId, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowDownRight, ArrowUpRight, ExternalLink, ShieldAlert } from "lucide-react";
import { useSession } from "@/lib/client/session";
import { buyOrder, cancelBid, cancelListing, cancelListingV2, planFills, sellOrder, transferUnits } from "@/lib/sui/tx";
import { Badge, Button, Card, EASE, Field, Input, Select, Tabs, cx, shortAddr, suiscan, useAction, usdc } from "./ui";

export const px = (atomic: number | string | null | undefined) => (atomic == null ? "—" : `${(Number(atomic) / 1e6).toFixed(6).replace(/0+$/, "").replace(/\.$/, "")}`);

export function Sparkline({ points, className }: { points: { price: number }[]; className?: string }) {
  const gid = useId().replace(/:/g, "");
  if (points.length < 2) return <div className={cx("grid h-8 w-24 place-items-center font-mono text-xs text-faint", className)}>—</div>;
  const ys = points.map((p) => p.price);
  const min = Math.min(...ys), max = Math.max(...ys), span = max - min || 1;
  const pts = ys.map((y, i) => [(i / (ys.length - 1)) * 96, 30 - ((y - min) / span) * 28] as const);
  const line = pts.map(([x, y], i) => `${i ? "L" : "M"}${x},${y}`).join(" ");
  const up = ys[ys.length - 1] >= ys[0];
  return (
    <svg viewBox="0 0 96 32" className={cx("h-8 w-24 overflow-visible", className)}>
      <defs>
        <linearGradient id={`sg${gid}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#ab9ff2" stopOpacity={up ? 0.45 : 0.2} />
          <stop offset="1" stopColor="#ab9ff2" stopOpacity="0" />
        </linearGradient>
      </defs>
      <motion.path d={`${line} L96,32 L0,32 Z`} fill={`url(#sg${gid})`} initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ delay: 0.5, duration: 0.6 }} />
      <motion.path d={line} fill="none" stroke={up ? "#ab9ff2" : "rgba(255,255,255,.6)"} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" initial={{ pathLength: 0 }} whileInView={{ pathLength: 1 }} viewport={{ once: true }} transition={{ duration: 1.1, ease: EASE }} />
      <motion.circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r={2.4} fill={up ? "#ab9ff2" : "#fff"} initial={{ scale: 0 }} whileInView={{ scale: 1 }} viewport={{ once: true }} transition={{ delay: 1, type: "spring", stiffness: 400, damping: 15 }} />
    </svg>
  );
}

export function PriceChart({ history }: { history: { t: number; price: number; units: number; kind: string }[] }) {
  const gid = useId().replace(/:/g, "");
  const [hover, setHover] = useState<number | null>(null);
  if (!history.length) return <div className="grid h-40 place-items-center rounded-2xl border border-dashed border-line-strong text-sm text-muted">No trades yet.</div>;
  const W = 640, H = 220, pad = 30;
  const ts = history.map((h) => h.t), ps = history.map((h) => h.price);
  const t0 = Math.min(...ts), t1 = Math.max(...ts) || t0 + 1;
  const p0 = Math.min(...ps) * 0.95, p1 = Math.max(...ps) * 1.05 || 1;
  const x = (t: number) => pad + ((t - t0) / (t1 - t0 || 1)) * (W - pad * 2);
  const y = (p: number) => H - pad - ((p - p0) / (p1 - p0 || 1)) * (H - pad * 2);
  const maxU = Math.max(...history.map((h) => h.units));
  const line = history.map((h, i) => `${i ? "L" : "M"}${x(h.t)},${y(h.price)}`).join(" ");
  const area = `${line} L${x(history[history.length - 1].t)},${H - pad} L${x(history[0].t)},${H - pad} Z`;
  const hv = hover != null ? history[hover] : null;
  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full overflow-visible" onMouseLeave={() => setHover(null)}>
        <defs>
          <linearGradient id={`pa${gid}`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#ab9ff2" stopOpacity="0.35" />
            <stop offset="1" stopColor="#ab9ff2" stopOpacity="0" />
          </linearGradient>
          <linearGradient id={`pl${gid}`} x1="0" x2="1">
            <stop offset="0" stopColor="#6f679d" />
            <stop offset="1" stopColor="#ab9ff2" />
          </linearGradient>
        </defs>
        {[0, 0.5, 1].map((f) => {
          const p = p0 + (p1 - p0) * f;
          return (
            <g key={f}>
              <line x1={pad} x2={W - pad} y1={y(p)} y2={y(p)} stroke="rgba(255,255,255,.07)" strokeDasharray="3 5" />
              <text x={2} y={y(p) + 3} fontSize="9" fill="rgba(255,255,255,.4)" fontFamily="var(--font-jetbrains)">{px(p)}</text>
            </g>
          );
        })}
        {history.map((h, i) => (
          <motion.rect key={i} x={x(h.t) - 2} width={4} rx={1} fill={h.kind === "primary" ? "rgba(171,159,242,.45)" : "rgba(255,255,255,.22)"} initial={{ height: 0, y: H - pad }} whileInView={{ height: (h.units / maxU) * 30, y: H - pad - (h.units / maxU) * 30 }} viewport={{ once: true }} transition={{ delay: 0.3 + i * 0.02, duration: 0.5, ease: EASE }} />
        ))}
        <motion.path d={area} fill={`url(#pa${gid})`} initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ delay: 0.8, duration: 0.8 }} />
        <motion.path d={line} fill="none" stroke={`url(#pl${gid})`} strokeWidth={2.2} strokeLinejoin="round" strokeLinecap="round" initial={{ pathLength: 0 }} whileInView={{ pathLength: 1 }} viewport={{ once: true }} transition={{ duration: 1.4, ease: EASE }} style={{ filter: "drop-shadow(0 0 6px rgba(171,159,242,.5))" }} />
        {history.map((h, i) => (
          <g key={`c${i}`} onMouseEnter={() => setHover(i)}>
            <circle cx={x(h.t)} cy={y(h.price)} r={10} fill="transparent" />
            <motion.circle cx={x(h.t)} cy={y(h.price)} r={hover === i ? 5 : 3} fill={h.kind === "primary" ? "#ab9ff2" : h.kind === "bid" ? "#fff" : "#0a0a0b"} stroke="#ab9ff2" strokeWidth={1.5} initial={{ scale: 0 }} whileInView={{ scale: 1 }} viewport={{ once: true }} transition={{ delay: 1 + i * 0.03, type: "spring", stiffness: 400, damping: 18 }}>
              <title>{`${h.kind} · ${h.units} units @ ${px(h.price)} USDC · ${new Date(h.t).toLocaleString()}`}</title>
            </motion.circle>
          </g>
        ))}
        {hv && <line x1={x(hv.t)} x2={x(hv.t)} y1={pad} y2={H - pad} stroke="rgba(171,159,242,.4)" strokeDasharray="2 3" />}
        <text x={W - pad} y={H - 8} fontSize="9" fill="rgba(255,255,255,.4)" textAnchor="end">{new Date(t1).toLocaleString()}</text>
        <text x={pad} y={H - 8} fontSize="9" fill="rgba(255,255,255,.4)">{new Date(t0).toLocaleString()}</text>
      </svg>
      <AnimatePresence>
        {hv && (
          <motion.div key="tip" initial={{ opacity: 0, y: 6, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0 }} className="pointer-events-none absolute right-2 top-2 rounded-xl border border-p/30 bg-ink/90 px-3 py-2 font-mono text-[11px] backdrop-blur">
            <div className="text-p">{hv.kind}</div>
            <div>{hv.units.toLocaleString()}u @ {px(hv.price)} USDC</div>
            <div className="text-muted">{new Date(hv.t).toLocaleString()}</div>
          </motion.div>
        )}
      </AnimatePresence>
      <div className="mt-2 flex gap-4 text-[11px] text-muted">
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-p" />Primary</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-white" />Bid fill</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full border border-p bg-ink" />Ask fill</span>
      </div>
    </div>
  );
}

export function OrderBook({ bids, asks, me }: { bids: any[]; asks: any[]; me: string | null }) {
  const lvl = (rows: any[]) => {
    const m = new Map<string, { units: number; mine: boolean; count: number }>();
    for (const r of rows) {
      const k = String(r.price_per_unit);
      const v = m.get(k) ?? { units: 0, mine: false, count: 0 };
      v.units += r.units;
      v.count += 1;
      v.mine ||= (r.buyer ?? r.seller) === me;
      m.set(k, v);
    }
    return [...m.entries()];
  };
  const b = lvl(bids).slice(0, 10), a = lvl(asks).slice(0, 10);
  const maxU = Math.max(1, ...b.map(([, v]) => v.units), ...a.map(([, v]) => v.units));
  const Row = ({ price, v, side, i }: { price: string; v: { units: number; mine: boolean; count: number }; side: "bid" | "ask"; i: number }) => (
    <motion.div initial={{ opacity: 0, x: side === "bid" ? -12 : 12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04, duration: 0.4, ease: EASE }} className="relative flex justify-between overflow-hidden rounded-md px-2 py-1.5 font-mono text-xs" data-testid={`book-${side}`}>
      <motion.div className={cx("absolute inset-y-0", side === "bid" ? "right-0 bg-p/20" : "left-0 bg-white/[0.09]")} initial={{ width: 0 }} animate={{ width: `${(v.units / maxU) * 100}%` }} transition={{ delay: 0.1 + i * 0.04, duration: 0.7, ease: EASE }} />
      <span className={cx("relative font-semibold", side === "bid" ? "text-p" : "text-white")}>{px(price)}{v.mine && <span className="ml-1 text-p-300">•</span>}</span>
      <span className="relative">{v.units.toLocaleString()} <span className="text-faint">({v.count})</span></span>
    </motion.div>
  );
  return (
    <div className="grid grid-cols-2 gap-3">
      <div>
        <div className="mb-1.5 flex justify-between px-2 text-[10px] font-semibold uppercase tracking-widest text-muted"><span>Bid (USDC)</span><span>Units</span></div>
        {!b.length && <p className="px-2 text-xs text-faint">No bids</p>}
        <div className="space-y-0.5">{b.map(([p, v], i) => <Row key={p} price={p} v={v} side="bid" i={i} />)}</div>
      </div>
      <div>
        <div className="mb-1.5 flex justify-between px-2 text-[10px] font-semibold uppercase tracking-widest text-muted"><span>Ask (USDC)</span><span>Units</span></div>
        {!a.length && <p className="px-2 text-xs text-faint">No asks</p>}
        <div className="space-y-0.5">{a.map(([p, v], i) => <Row key={p} price={p} v={v} side="ask" i={i} />)}</div>
      </div>
    </div>
  );
}

const EXPIRIES = [
  { label: "Good till cancelled", ms: 0 },
  { label: "1 hour", ms: 3600_000 },
  { label: "1 day", ms: 86400_000 },
  { label: "1 week", ms: 7 * 86400_000 },
  { label: "30 days", ms: 30 * 86400_000 },
];

export function TradeTicket({ offering, bids, asks, mine, onDone }: { offering: any; bids: any[]; asks: any[]; mine: any; onDone: () => void }) {
  const { run, address } = useSession();
  const [tab, setTab] = useState<"buy" | "sell" | "transfer">("buy");
  const [type, setType] = useState<"market" | "limit">("market");
  const [units, setUnits] = useState("");
  const [price, setPrice] = useState("");
  const [exp, setExp] = useState(0);
  const [to, setTo] = useState("");
  const { busy, run: act } = useAction();
  const u = Number(units) || 0;
  const limit = type === "limit" && Number(price) > 0 ? BigInt(Math.round(Number(price) * 1e6)) : null;
  const otherAsks = asks.filter((a) => a.seller !== address);
  const otherBids = bids.filter((b) => b.buyer !== address);
  const plan = useMemo(() => (tab === "buy" ? planFills(otherAsks, u, limit, "buy") : planFills(otherBids, u, limit, "sell")), [tab, otherAsks, otherBids, u, limit]);
  const free = mine?.units ?? 0;
  const rest = type === "limit" && plan.left > 0 && limit ? { units: plan.left, pricePerUnit: limit, expiresMs: BigInt(exp ? Date.now() + exp : 0) } : null;
  const restCost = rest ? rest.pricePerUnit * BigInt(rest.units) : 0n;
  const canBuy = mine?.verified && u > 0 && (type === "market" ? plan.filled > 0 : !!limit);
  const canSell = u > 0 && u <= free && (type === "market" ? plan.filled > 0 : !!limit);
  const submit = () =>
    act("order", async () => {
      if (tab === "buy") {
        await run(buyOrder({ offeringId: offering.id, fills: plan.fills.map((f) => ({ listingId: f.order.id, units: f.units, pricePerUnit: BigInt(f.order.price_per_unit), v2: !!f.order.v2 })), rest }));
      } else {
        await run(sellOrder({ offeringId: offering.id, fills: plan.fills.map((f) => ({ bidId: f.order.id, units: f.units })), rest }));
      }
      setUnits("");
      onDone();
    }, tab === "buy" ? "Buy order placed" : "Sell order placed");
  const transfer = () =>
    act("transfer", async () => {
      await run(transferUnits({ offeringId: offering.id, to, units: u }));
      setUnits("");
      onDone();
    }, "Units transferred");
  return (
    <Card className="ring-spin space-y-4">
      <Tabs value={tab} onChange={(t) => { setTab(t); setUnits(""); }} tabs={[{ id: "buy", label: "Buy" }, { id: "sell", label: "Sell" }, { id: "transfer", label: "Transfer" }]} />
      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={tab} initial={{ opacity: 0, y: 10, filter: "blur(4px)" }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }} exit={{ opacity: 0, y: -8, filter: "blur(4px)" }} transition={{ duration: 0.3, ease: EASE }} className="space-y-4">
          {tab !== "transfer" && (
            <div className="inline-flex rounded-full border border-line bg-white/[0.03] p-1 text-sm">
              {(["market", "limit"] as const).map((k) => (
                <button key={k} onClick={() => setType(k)} className={cx("relative rounded-full px-4 py-1.5 font-semibold transition-colors", type === k ? "text-ink" : "text-muted hover:text-white")} data-testid={`type-${k}`}>
                  {type === k && <motion.span layoutId="order-type" className="absolute inset-0 rounded-full bg-white" transition={{ type: "spring", stiffness: 450, damping: 32 }} />}
                  <span className="relative">{k === "market" ? "Market" : "Limit"}</span>
                </button>
              ))}
            </div>
          )}
          {tab !== "buy" && <div className="text-xs text-muted">You hold <b className="text-white">{free.toLocaleString()}</b> free units{mine?.listed ? ` (+${mine.listed} listed)` : ""}.</div>}
          {tab === "buy" && !mine?.verified && (
            <div className="flex items-center gap-2 rounded-2xl border border-p-300/30 bg-p-300/10 p-3 text-xs text-p-200">
              <ShieldAlert className="h-4 w-4 shrink-0" /> Verify your identity to trade. <a className="font-semibold text-white underline" href="/verify">Verify</a>
            </div>
          )}
          <Field label="Units">
            <Input inputMode="numeric" value={units} onChange={(e) => setUnits(e.target.value.replace(/\D/g, ""))} data-testid={`${tab}-units`} />
          </Field>
          {tab === "transfer" ? (
            <>
              <Field label="To (verified investor's Sui address)" hint="Transfers are restricted to verified investors, like a regulated security token.">
                <Input value={to} onChange={(e) => setTo(e.target.value.trim())} placeholder="0x…" className="font-mono" data-testid="transfer-to" />
              </Field>
              <Button className="w-full" size="lg" loading={busy === "transfer"} disabled={!(u > 0 && u <= free && /^0x[0-9a-f]{64}$/.test(to))} onClick={transfer} data-testid="transfer">Transfer units</Button>
            </>
          ) : (
            <>
              <AnimatePresence initial={false}>
                {type === "limit" && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                    <div className="grid grid-cols-2 gap-2">
                      <Field label="Limit price (USDC/unit)"><Input inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} data-testid={`${tab}-price`} /></Field>
                      <Field label="Expires">
                        <Select value={exp} onChange={(e) => setExp(Number(e.target.value))}>{EXPIRIES.map((x) => <option key={x.ms} value={x.ms}>{x.label}</option>)}</Select>
                      </Field>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
              <motion.div layout className="space-y-1.5 rounded-2xl border border-line bg-white/[0.025] p-3.5 text-xs text-white/80">
                {plan.filled > 0 && (
                  <div>Fills now: <b className="text-white">{plan.filled.toLocaleString()}</b> units @ avg <span className="font-mono text-p">{px(plan.avg)}</span> = <b className="text-white">{usdc(plan.cost.toString(), 4)}</b> across {plan.fills.length} order(s)</div>
                )}
                {rest && <div>Rests on the book: <b className="text-white">{rest.units.toLocaleString()}</b> units @ <span className="font-mono text-p">{px(rest.pricePerUnit.toString())}</span> {tab === "buy" && <>({usdc(restCost.toString(), 4)} escrowed)</>}</div>}
                {type === "market" && u > 0 && plan.left > 0 && <div className="text-p-300">Only {plan.filled} units available at market — use a limit order to rest the rest.</div>}
                {tab === "sell" && u > free && <div className="font-semibold text-white">You only have {free} free units.</div>}
                <div className="text-faint">1% market fee on filled trades (paid by the seller).</div>
              </motion.div>
              <Button className="w-full" size="lg" variant={tab === "buy" ? "primary" : "secondary"} loading={busy === "order"} disabled={tab === "buy" ? !canBuy : !canSell} onClick={submit} data-testid={`${tab}-submit`}>
                {tab === "buy" ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
                {tab === "buy" ? "Buy" : "Sell"} {u > 0 ? `${u.toLocaleString()} units` : ""}
              </Button>
            </>
          )}
        </motion.div>
      </AnimatePresence>
    </Card>
  );
}

export function MyOrders({ offeringId, bids, asks, onDone }: { offeringId: string; bids: any[]; asks: any[]; onDone: () => void }) {
  const { run } = useSession();
  const { busy, run: act } = useAction();
  if (!bids.length && !asks.length) return null;
  const expired = (e: any) => Number(e ?? 0) > 0 && Number(e) < Date.now();
  return (
    <Card>
      <h3 className="mb-3 font-bold">Your open orders</h3>
      <div className="space-y-2 text-sm">
        <AnimatePresence initial={false}>
          {bids.map((b) => (
            <motion.div key={b.id} layout initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20, height: 0 }} className="flex items-center justify-between gap-2 rounded-2xl border border-line bg-white/[0.02] p-2.5" data-testid="my-bid">
              <span className="flex flex-wrap items-center gap-2"><Badge tone="brand">Bid</Badge> <span className="font-mono">{b.units.toLocaleString()} @ {px(b.price_per_unit)}</span> {Number(b.expires_ms) > 0 && <span className="text-xs text-muted">· {expired(b.expires_ms) ? "expired (refund pending)" : `expires ${new Date(Number(b.expires_ms)).toLocaleString()}`}</span>}</span>
              <Button size="sm" variant="ghost" loading={busy === b.id} onClick={() => act(b.id, () => run(cancelBid({ bidId: b.id })).then(onDone), "Bid cancelled — USDC refunded")}>Cancel</Button>
            </motion.div>
          ))}
          {asks.map((l) => (
            <motion.div key={l.id} layout initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20, height: 0 }} className="flex items-center justify-between gap-2 rounded-2xl border border-line bg-white/[0.02] p-2.5" data-testid="my-ask">
              <span className="flex flex-wrap items-center gap-2"><Badge>Ask</Badge> <span className="font-mono">{l.units.toLocaleString()} @ {px(l.price_per_unit)}</span> {Number(l.expires_ms) > 0 && <span className="text-xs text-muted">· {expired(l.expires_ms) ? "expired (units returning)" : `expires ${new Date(Number(l.expires_ms)).toLocaleString()}`}</span>}</span>
              <Button size="sm" variant="ghost" loading={busy === l.id} onClick={() => act(l.id, () => run(l.v2 ? cancelListingV2({ offeringId, listingId: l.id }) : cancelListing({ offeringId, listingId: l.id })).then(onDone), "Listing cancelled")}>Cancel</Button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </Card>
  );
}

export function Tape({ events }: { events: any[] }) {
  const trades = events.filter((e) => ["trade", "purchase", "transfer"].includes(e.kind)).slice(0, 15);
  return (
    <div className="space-y-1 text-xs">
      {!trades.length && <p className="text-muted">No trades yet.</p>}
      {trades.map((e, i) => (
        <motion.div key={e.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }} className="flex justify-between gap-2 rounded-lg px-2 py-1 font-mono hover:bg-white/[0.03]">
          <span><span className="text-p">{e.kind === "purchase" ? "primary" : e.kind}</span> · {e.units?.toLocaleString()}u{e.amount && e.units ? ` @ ${px(Number(e.amount) / e.units)}` : ""} · <span className="text-muted">{shortAddr(e.address)}</span></span>
          <a className="inline-flex items-center gap-1 text-p hover:text-white" href={suiscan("tx", e.digest)} target="_blank" rel="noreferrer">tx <ExternalLink className="h-3 w-3" /></a>
        </motion.div>
      ))}
    </div>
  );
}
