/** Holders of an offering who chose a cross-chain payout route, with what they can claim now. */
import { db, q } from "../db";
import { holdingOf } from "../chainread";

export type ChainHolder = { holder: string; chain: string; domain: number; recipient: string; claimable: bigint };

export async function chainHolders(offeringId: string): Promise<ChainHolder[]> {
  const holders = await q(db().from("holdings").select("address").eq("offering_id", offeringId).or("units.gt.0,listed_units.gt.0"));
  const addrs = (holders as any[]).map((h) => h.address);
  if (!addrs.length) return [];
  const routes = await q(db().from("payout_routes").select("*").in("sui_address", addrs));
  const out: ChainHolder[] = [];
  for (const r of routes as any[]) {
    const h = await holdingOf(offeringId, r.sui_address);
    out.push({ holder: r.sui_address, chain: r.chain, domain: r.domain, recipient: r.recipient, claimable: h.claimable });
  }
  return out;
}
