/** Read models for payouts: which chains are live, and a holder's route, payout journeys and totals. */
import { PAYOUT_CHAINS, chainByKey } from "@/lib/payout-chains";
import { db, q } from "../db";
import { eventQuery, mbChain, readMethod } from "./multibaas";
import { relayerFor, PAYOUT_DELIVERED_SIG, RELAYER_LABEL } from "./registry";

/** Every payout chain, and whether it is live (MultiBaas deployment configured + relayer deployed). */
export function payoutChains() {
  return PAYOUT_CHAINS.map((c) => {
    const relayer = relayerFor(c.key);
    return {
      key: c.key,
      name: c.name,
      short: c.short,
      chainId: c.chainId,
      domain: c.domain,
      usdc: c.usdc,
      explorer: c.explorer,
      relayer: relayer?.address ?? null,
      enabled: !!(relayer && mbChain(c.key)),
    };
  });
}

/** Lifetime USDC delivered per recipient on one chain, aggregated by MultiBaas from indexed PayoutDelivered events. */
async function deliveredTotal(chainKey: string, recipient: string) {
  const c = mbChain(chainKey);
  if (!c) return null;
  const rows = await eventQuery<{ recipient: string; total: string | number; payouts: string | number }>(c, {
    events: [
      {
        eventName: PAYOUT_DELIVERED_SIG,
        select: [
          { type: "input", name: "recipient", alias: "recipient" },
          { type: "input", name: "amount", alias: "total", aggregator: "add" },
        ],
        filter: { rule: "and", children: [{ fieldType: "contract_label", operator: "equal", value: RELAYER_LABEL }] },
      },
    ],
    groupBy: "recipient",
  });
  const hit = rows.find((r) => String(r.recipient).toLowerCase() === recipient.toLowerCase());
  return hit ? String(BigInt(Math.round(Number(hit.total)))) : "0";
}

/** The recipient's current USDC balance on the destination chain, read through MultiBaas. */
async function usdcBalance(chainKey: string, recipient: string) {
  const c = mbChain(chainKey);
  if (!c) return null;
  const out = await readMethod<string | number>(c, "usdc", "usdc_erc20", "balanceOf", [recipient]);
  return String(out);
}

export async function myPayouts(suiAddress: string) {
  const [route, rows] = await Promise.all([
    q(db().from("payout_routes").select("*").eq("sui_address", suiAddress).maybeSingle()),
    q(db().from("payouts").select("id, offering_id, chain, recipient, amount, status, release_digest, evm_tx, delivered_at, error, created_at").eq("holder", suiAddress).order("created_at", { ascending: false }).limit(50)),
  ]);
  const ids = [...new Set((rows as any[]).map((r) => r.offering_id))];
  const offs = ids.length ? await q(db().from("offerings").select("id, spaces:space_id(label, ens_name)").in("id", ids)) : [];
  const space = new Map((offs as any[]).map((o) => [o.id, o.spaces]));
  const payouts = (rows as any[]).map((r) => ({ ...r, space: space.get(r.offering_id) ?? null }));
  let onchain: { delivered: string | null; balance: string | null; error?: string } | null = null;
  if (route && chainByKey(route.chain)) {
    const [delivered, balance] = await Promise.allSettled([deliveredTotal(route.chain, route.recipient), usdcBalance(route.chain, route.recipient)]);
    onchain = {
      delivered: delivered.status === "fulfilled" ? delivered.value : null,
      balance: balance.status === "fulfilled" ? balance.value : null,
      ...(delivered.status === "rejected" || balance.status === "rejected" ? { error: String(((delivered as any).reason ?? (balance as any).reason)?.message ?? "MultiBaas unavailable") } : {}),
    };
  }
  return { route: route ?? null, payouts, onchain, chains: payoutChains() };
}
