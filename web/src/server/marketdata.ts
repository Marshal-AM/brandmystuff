/** Secondary-market analytics for tokenised spaces. */
import { db, q } from "./db";

const now = () => Date.now();
export const isLive = (expires: any) => Number(expires ?? 0) === 0 || Number(expires) > now();

export async function bookFor(offeringId: string) {
  const [asks, bids] = await Promise.all([
    q(db().from("listings").select("*").eq("offering_id", offeringId).eq("status", "open").gt("units", 0).order("price_per_unit", { ascending: true })),
    q(db().from("bids").select("*").eq("offering_id", offeringId).eq("status", "open").gt("units", 0).order("price_per_unit", { ascending: false })),
  ]);
  return { asks: asks.filter((a: any) => isLive(a.expires_ms)), bids: bids.filter((b: any) => isLive(b.expires_ms)), expiredAsks: asks.filter((a: any) => !isLive(a.expires_ms)), expiredBids: bids.filter((b: any) => !isLive(b.expires_ms)) };
}

function depth(levels: any[]) {
  const m = new Map<string, number>();
  for (const l of levels) m.set(String(l.price_per_unit), (m.get(String(l.price_per_unit)) ?? 0) + l.units);
  return [...m.entries()].map(([price, units]) => ({ price, units }));
}

export async function marketStats(o: any, trades?: any[]) {
  const tr = trades ?? (await q(db().from("trades").select("*").eq("offering_id", o.id).order("created_at", { ascending: true })));
  const book = await bookFor(o.id);
  const secondary = tr.filter((t: any) => t.kind !== "primary");
  const last = tr[tr.length - 1];
  const lastPrice = last ? Number(last.price_per_unit) : Number(o.price_per_unit);
  const dayAgo = now() - 86400_000;
  const day = secondary.filter((t: any) => new Date(t.created_at).getTime() >= dayAgo);
  const before = tr.filter((t: any) => new Date(t.created_at).getTime() < dayAgo).pop();
  const refPrice = before ? Number(before.price_per_unit) : Number(o.price_per_unit);
  const incomePerUnit = Number(o.total_distributed) / 10_000;
  return {
    lastPrice,
    primaryPrice: Number(o.price_per_unit),
    bestBid: book.bids[0] ? Number(book.bids[0].price_per_unit) : null,
    bestAsk: book.asks[0] ? Number(book.asks[0].price_per_unit) : null,
    spread: book.bids[0] && book.asks[0] ? Number(book.asks[0].price_per_unit) - Number(book.bids[0].price_per_unit) : null,
    volume24h: day.reduce((a: number, t: any) => a + t.units * Number(t.price_per_unit), 0),
    units24h: day.reduce((a: number, t: any) => a + t.units, 0),
    volumeAll: secondary.reduce((a: number, t: any) => a + t.units * Number(t.price_per_unit), 0),
    change24hPct: refPrice ? ((lastPrice - refPrice) / refPrice) * 100 : 0,
    trades: secondary.length,
    incomePerUnit,
    incomeYieldPct: Number(o.price_per_unit) ? (incomePerUnit / Number(o.price_per_unit)) * 100 : 0,
    marketCap: lastPrice * 10_000,
    history: tr.map((t: any) => ({ t: new Date(t.created_at).getTime(), price: Number(t.price_per_unit), units: t.units, kind: t.kind })),
    depth: { bids: depth(book.bids), asks: depth(book.asks) },
    book,
  };
}
