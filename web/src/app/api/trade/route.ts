import { handler } from "@/server/http";
import { db, q } from "@/server/db";
import { marketStats } from "@/server/marketdata";

export const GET = handler(async () => {
  const offerings = await q(
    db().from("offerings").select("*, spaces(label, ens_name, closeup_blob_id, aqs, grade, price_per_week, completed_leases, objects(title, category, city))").in("status", ["open", "tokenised"]).order("created_at", { ascending: false }),
  );
  const rows = [];
  for (const o of offerings) {
    const m = await marketStats(o);
    const holders = await q(db().from("holdings").select("address").eq("offering_id", o.id).gt("units", 0));
    rows.push({
      ...o,
      market: { ...m, book: undefined, history: m.history.slice(-40), bidsCount: m.book.bids.length, asksCount: m.book.asks.length },
      holders: holders.length,
    });
  }
  const totals = {
    volume24h: rows.reduce((a, r) => a + r.market.volume24h, 0),
    marketCap: rows.reduce((a, r) => a + r.market.marketCap, 0),
    distributed: rows.reduce((a, r) => a + Number(r.total_distributed), 0),
  };
  return { offerings: rows, totals };
});
