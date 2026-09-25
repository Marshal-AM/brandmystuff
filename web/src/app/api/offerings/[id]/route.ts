import { handler } from "@/server/http";
import { HttpError, optionalUser } from "@/server/auth";
import { db, q, ok } from "@/server/db";
import { holdingOf } from "@/server/chainread";
import { acceptanceMessage } from "@/server/legal";
import { readBlob } from "@/server/walrus";
import { marketStats } from "@/server/marketdata";

export const GET = handler(async (req, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const me = await optionalUser(req);
  const o = await q(db().from("offerings").select("*").eq("id", id).maybeSingle());
  if (!o) throw new HttpError(404, "Offering not found");
  const [space, holders, _unused, events, leases] = await Promise.all([
    q(db().from("spaces").select("*, objects(title, ens_name, hero_blob_id, category)").eq("id", o.space_id).single()),
    q(db().from("holdings").select("*").eq("offering_id", id).order("units", { ascending: false })),
    Promise.resolve([]),
    q(db().from("unit_events").select("*").eq("offering_id", id).order("created_at", { ascending: false }).limit(100)),
    q(db().from("leases").select("status, total_paid, weeks, start_ms").eq("space_id", o.space_id)),
  ]);
  let pack = o.legal_pack;
  if (!pack) {
    try {
      pack = JSON.parse((await readBlob(o.legal_pack_blob_id)).toString());
      await ok(db().from("offerings").update({ legal_pack: pack }).eq("id", id));
    } catch {}
  }
  const market = await marketStats(o);
  const listings = market.book.asks;
  let mine = null;
  if (me?.sui_address) {
    const h = await holdingOf(id, me.sui_address).catch(() => null);
    const kyc = await q(db().from("kyc_submissions").select("status, expires_at").eq("user_id", me.id).order("created_at", { ascending: false }).limit(1).maybeSingle());
    mine = {
      units: h ? Number(h.units) : 0,
      listed: h ? Number(h.listed) : 0,
      claimable: h ? h.claimable.toString() : "0",
      verified: kyc?.status === "approved" && new Date(kyc.expires_at).getTime() > Date.now(),
      myListings: [...listings, ...market.book.expiredAsks].filter((l: any) => l.seller === me.sui_address),
      myBids: [...market.book.bids, ...market.book.expiredBids].filter((b: any) => b.buyer === me.sui_address),
      costBasis: (holders.find((h: any) => h.address === me.sui_address)?.paid ?? "0"),
      claimed: (holders.find((h: any) => h.address === me.sui_address)?.claimed ?? "0"),
    };
  }
  return {
    offering: { ...o, legal_pack: pack },
    space,
    holders,
    listings,
    bids: market.book.bids,
    market: { ...market, book: undefined },
    events,
    stats: { leases: leases.length, completed: leases.filter((l: any) => l.status === "completed").length, revenue: leases.reduce((a: number, l: any) => a + Number(l.total_paid), 0) },
    mine,
    acceptanceTemplate: acceptanceMessage(id, o.legal_pack_hash.replace(/^0x/, ""), 0),
  };
});
