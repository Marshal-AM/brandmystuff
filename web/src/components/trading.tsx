"use client";
import { useMemo, useState } from "react";
import { useSession } from "@/lib/client/session";
import { buyOrder, cancelBid, cancelListing, cancelListingV2, planFills, sellOrder, transferUnits } from "@/lib/sui/tx";
import { Badge, Button, Card, Field, Input, Select, Tabs, cx, shortAddr, suiscan, useAction, usdc } from "./ui";

export const px = (atomic: number | string | null | undefined) => (atomic == null ? "—" : `${(Number(atomic) / 1e6).toFixed(6).replace(/0+$/, "").replace(/\.$/, "")}`);

export function Sparkline({ points, className }: { points: { price: number }[]; className?: string }) {
  if (points.length < 2) return <div className={cx("h-8 w-24 text-xs text-muted", className)}>—</div>;
  const ys = points.map((p) => p.price);
  const min = Math.min(...ys), max = Math.max(...ys), span = max - min || 1;
  const d = ys.map((y, i) => `${(i / (ys.length - 1)) * 96},${30 - ((y - min) / span) * 28}`).join(" ");
  const up = ys[ys.length - 1] >= ys[0];
  return (
    <svg viewBox="0 0 96 32" className={cx("h-8 w-24", className)}>
      <polyline points={d} fill="none" stroke={up ? "#059669" : "#dc2626"} strokeWidth={2} />
    </svg>
  );
}

export function PriceChart({ history }: { history: { t: number; price: number; units: number; kind: string }[] }) {
  if (!history.length) return <p className="text-sm text-muted">No trades yet.</p>;
  const W = 640, H = 200, pad = 28;
  const ts = history.map((h) => h.t), ps = history.map((h) => h.price);
  const t0 = Math.min(...ts), t1 = Math.max(...ts) || t0 + 1;
  const p0 = Math.min(...ps) * 0.95, p1 = Math.max(...ps) * 1.05 || 1;
  const x = (t: number) => pad + ((t - t0) / (t1 - t0 || 1)) * (W - pad * 2);
  const y = (p: number) => H - pad - ((p - p0) / (p1 - p0 || 1)) * (H - pad * 2);
  const maxU = Math.max(...history.map((h) => h.units));
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
      {[0, 0.5, 1].map((f) => {
        const p = p0 + (p1 - p0) * f;
        return (
          <g key={f}>
            <line x1={pad} x2={W - pad} y1={y(p)} y2={y(p)} stroke="#eee" />
            <text x={2} y={y(p) + 3} fontSize="9" fill="#999">{px(p)}</text>
          </g>
        );
      })}
      {history.map((h, i) => (
        <rect key={i} x={x(h.t) - 2} y={H - pad - (h.units / maxU) * 30} width={4} height={(h.units / maxU) * 30} fill={h.kind === "primary" ? "#c4b5fd" : "#a7f3d0"} />
      ))}
      <polyline points={history.map((h) => `${x(h.t)},${y(h.price)}`).join(" ")} fill="none" stroke="#6d28d9" strokeWidth={2} />
      {history.map((h, i) => (
        <circle key={`c${i}`} cx={x(h.t)} cy={y(h.price)} r={3} fill={h.kind === "primary" ? "#6d28d9" : h.kind === "bid" ? "#059669" : "#dc2626"}>
          <title>{`${h.kind} · ${h.units} units @ ${px(h.price)} USDC · ${new Date(h.t).toLocaleString()}`}</title>
        </circle>
      ))}
      <text x={W - pad} y={H - 6} fontSize="9" fill="#999" textAnchor="end">{new Date(t1).toLocaleString()}</text>
      <text x={pad} y={H - 6} fontSize="9" fill="#999">{new Date(t0).toLocaleString()}</text>
    </svg>
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
  const Row = ({ price, v, side }: { price: string; v: { units: number; mine: boolean; count: number }; side: "bid" | "ask" }) => (
    <div className="relative flex justify-between px-2 py-1 font-mono text-xs" data-testid={`book-${side}`}>
      <div className={cx("absolute inset-y-0", side === "bid" ? "right-0 bg-emerald-100" : "left-0 bg-red-100")} style={{ width: `${(v.units / maxU) * 100}%` }} />
      <span className={cx("relative", side === "bid" ? "text-emerald-700" : "text-red-700")}>{px(price)}{v.mine && " •"}</span>
      <span className="relative">{v.units.toLocaleString()} <span className="text-muted">({v.count})</span></span>
    </div>
  );
  return (
    <div className="grid grid-cols-2 gap-3">
      <div>
        <div className="mb-1 flex justify-between px-2 text-[11px] uppercase text-muted"><span>Bid (USDC)</span><span>Units</span></div>
        {!b.length && <p className="px-2 text-xs text-muted">No bids</p>}
        {b.map(([p, v]) => <Row key={p} price={p} v={v} side="bid" />)}
      </div>
      <div>
        <div className="mb-1 flex justify-between px-2 text-[11px] uppercase text-muted"><span>Ask (USDC)</span><span>Units</span></div>
        {!a.length && <p className="px-2 text-xs text-muted">No asks</p>}
        {a.map(([p, v]) => <Row key={p} price={p} v={v} side="ask" />)}
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
    <Card className="space-y-3" >
      <Tabs value={tab} onChange={(t) => { setTab(t); setUnits(""); }} tabs={[{ id: "buy", label: "Buy" }, { id: "sell", label: "Sell" }, { id: "transfer", label: "Transfer" }]} />
      {tab !== "transfer" && (
        <div className="flex gap-1 text-sm">
          {(["market", "limit"] as const).map((k) => (
            <button key={k} onClick={() => setType(k)} className={cx("rounded-lg px-3 py-1", type === k ? "bg-foreground text-white" : "bg-black/5")} data-testid={`type-${k}`}>{k === "market" ? "Market" : "Limit"}</button>
          ))}
        </div>
      )}
      {tab !== "buy" && <div className="text-xs text-muted">You hold {free.toLocaleString()} free units{mine?.listed ? ` (+${mine.listed} listed)` : ""}.</div>}
      {tab === "buy" && !mine?.verified && <p className="rounded-lg bg-amber-50 p-2 text-xs text-amber-900">Verify your identity to trade. <a className="underline" href="/verify">Verify</a></p>}
      <Field label="Units">
        <Input inputMode="numeric" value={units} onChange={(e) => setUnits(e.target.value.replace(/\D/g, ""))} data-testid={`${tab}-units`} />
      </Field>
      {tab === "transfer" ? (
        <>
          <Field label="To (verified investor's Sui address)" hint="Transfers are restricted to verified investors, like a regulated security token.">
            <Input value={to} onChange={(e) => setTo(e.target.value.trim())} placeholder="0x…" data-testid="transfer-to" />
          </Field>
          <Button className="w-full" loading={busy === "transfer"} disabled={!(u > 0 && u <= free && /^0x[0-9a-f]{64}$/.test(to))} onClick={transfer} data-testid="transfer">Transfer units</Button>
        </>
      ) : (
        <>
          {type === "limit" && (
            <div className="grid grid-cols-2 gap-2">
              <Field label="Limit price (USDC/unit)"><Input inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} data-testid={`${tab}-price`} /></Field>
              <Field label="Expires">
                <Select value={exp} onChange={(e) => setExp(Number(e.target.value))}>{EXPIRIES.map((x) => <option key={x.ms} value={x.ms}>{x.label}</option>)}</Select>
              </Field>
            </div>
          )}
          <div className="space-y-1 rounded-xl bg-black/[0.03] p-3 text-xs">
            {plan.filled > 0 && (
              <div>Fills now: <b>{plan.filled.toLocaleString()}</b> units @ avg {px(plan.avg)} = <b>{usdc(plan.cost.toString(), 4)}</b> across {plan.fills.length} order(s)</div>
            )}
            {rest && <div>Rests on the book: <b>{rest.units.toLocaleString()}</b> units @ {px(rest.pricePerUnit.toString())} {tab === "buy" && <>({usdc(restCost.toString(), 4)} escrowed)</>}</div>}
            {type === "market" && u > 0 && plan.left > 0 && <div className="text-amber-700">Only {plan.filled} units available at market — use a limit order to rest the rest.</div>}
            {tab === "sell" && u > free && <div className="text-bad">You only have {free} free units.</div>}
            <div className="text-muted">1% market fee on filled trades (paid by the seller).</div>
          </div>
          <Button className="w-full" variant={tab === "buy" ? "primary" : "danger"} loading={busy === "order"} disabled={tab === "buy" ? !canBuy : !canSell} onClick={submit} data-testid={`${tab}-submit`}>
            {tab === "buy" ? "Buy" : "Sell"} {u > 0 ? `${u.toLocaleString()} units` : ""}
          </Button>
        </>
      )}
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
      <h3 className="mb-2 font-semibold">Your open orders</h3>
      <div className="space-y-2 text-sm">
        {bids.map((b) => (
          <div key={b.id} className="flex items-center justify-between rounded-xl border border-line p-2" data-testid="my-bid">
            <span><Badge tone="ok">Bid</Badge> {b.units.toLocaleString()} @ {px(b.price_per_unit)} {Number(b.expires_ms) > 0 && <span className="text-xs text-muted">· {expired(b.expires_ms) ? "expired (refund pending)" : `expires ${new Date(Number(b.expires_ms)).toLocaleString()}`}</span>}</span>
            <Button size="sm" variant="secondary" loading={busy === b.id} onClick={() => act(b.id, () => run(cancelBid({ bidId: b.id })).then(onDone), "Bid cancelled — USDC refunded")}>Cancel</Button>
          </div>
        ))}
        {asks.map((l) => (
          <div key={l.id} className="flex items-center justify-between rounded-xl border border-line p-2" data-testid="my-ask">
            <span><Badge tone="bad">Ask</Badge> {l.units.toLocaleString()} @ {px(l.price_per_unit)} {Number(l.expires_ms) > 0 && <span className="text-xs text-muted">· {expired(l.expires_ms) ? "expired (units returning)" : `expires ${new Date(Number(l.expires_ms)).toLocaleString()}`}</span>}</span>
            <Button size="sm" variant="secondary" loading={busy === l.id} onClick={() => act(l.id, () => run(l.v2 ? cancelListingV2({ offeringId, listingId: l.id }) : cancelListing({ offeringId, listingId: l.id })).then(onDone), "Listing cancelled")}>Cancel</Button>
          </div>
        ))}
      </div>
    </Card>
  );
}

export function Tape({ events }: { events: any[] }) {
  const trades = events.filter((e) => ["trade", "purchase", "transfer"].includes(e.kind)).slice(0, 15);
  return (
    <div className="space-y-1 text-xs">
      {!trades.length && <p className="text-muted">No trades yet.</p>}
      {trades.map((e) => (
        <div key={e.id} className="flex justify-between gap-2 font-mono">
          <span>{e.kind === "purchase" ? "primary" : e.kind} · {e.units?.toLocaleString()}u{e.amount && e.units ? ` @ ${px(Number(e.amount) / e.units)}` : ""} · {shortAddr(e.address)}</span>
          <a className="text-brand underline" href={suiscan("tx", e.digest)} target="_blank" rel="noreferrer">tx</a>
        </div>
      ))}
    </div>
  );
}
