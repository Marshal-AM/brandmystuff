import { handler } from "@/server/http";
import { requireUser } from "@/server/auth";
import { db, q } from "@/server/db";
import { holdingOf } from "@/server/chainread";
import { marketStats } from "@/server/marketdata";

export const GET = handler(async (req) => {
  const u = await requireUser(req);
  const rows = await q(db().from("holdings").select("*, offerings(*, spaces(label, ens_name, closeup_blob_id, aqs, grade))").eq("address", u.sui_address ?? "").or("units.gt.0,listed_units.gt.0,claimed.gt.0"));
  const out = [];
  const totals = { cost: 0, value: 0, income: 0, claimable: 0 };
  for (const r of rows) {
    const h = await holdingOf(r.offering_id, u.sui_address!).catch(() => null);
    const m = await marketStats(r.offerings);
    const units = h ? Number(h.units + h.listed) : r.units + r.listed_units;
    const claimable = h ? Number(h.claimable) : 0;
    const value = units * m.lastPrice;
    const cost = Number(r.paid);
    const income = Number(r.claimed) + claimable;
    totals.cost += cost;
    totals.value += value;
    totals.income += income;
    totals.claimable += claimable;
    out.push({
      ...r,
      onchain: h ? { units: Number(h.units), listed: Number(h.listed), claimable: h.claimable.toString() } : null,
      pnl: { cost, value, income, lastPrice: m.lastPrice, bestBid: m.bestBid, bestAsk: m.bestAsk, net: value + income - cost, netPct: cost ? ((value + income - cost) / cost) * 100 : null },
    });
  }
  const [bids, asks] = await Promise.all([
    q(db().from("bids").select("*, offerings(spaces(label))").eq("buyer", u.sui_address ?? "").eq("status", "open")),
    q(db().from("listings").select("*, offerings(spaces(label))").eq("seller", u.sui_address ?? "").eq("status", "open").gt("units", 0)),
  ]);
  return { holdings: out, totals, openOrders: { bids, asks } };
});
