/**
 * Cross-chain payout engine. Revenue is earned and distributed on Sui; holders who chose an EVM
 * chain get their share there, as native USDC, through Circle CCTP, with every EVM step run
 * through Curvegrid MultiBaas.
 *
 *   Distributed (Sui)            → payout_release  : release_routed + CCTP burn, one Sui tx
 *   burn attested by Circle      → payout_attest   : Iris attestation per message
 *   relayer.deliver via MultiBaas→ payout_deliver  : MultiBaas composes, platform key signs, MultiBaas submits
 *   PayoutDelivered indexed      → payout_confirm / MultiBaas webhook : mark delivered, notify
 */
import { keccak256, toHex } from "viem";
import { SUI } from "@/lib/deployment";
import { chainByDomain, chainByKey } from "@/lib/payout-chains";
import { chainHolders } from "./holders";
import { db, ok, q } from "../db";
import { ingestDigest } from "../indexer";
import { enqueue, notifyAddress } from "../notify";
import { attestations, decodeBurnMessage, releaseAndBurn } from "./cctp";
import { listEvents, mbChain, receipt, writeMethod, type MbEvent } from "./multibaas";
import { relayerFor, RELAYER_ALIAS, RELAYER_LABEL, PAYOUT_DELIVERED_SIG } from "./registry";

const usd = (atomic: string | number | bigint) => Number(atomic) / 1e6;
const bytes32 = (hex: string) => `0x${hex.toLowerCase().replace(/^0x/, "").padStart(64, "0")}` as `0x${string}`;

/** Step 1: pay every routed holder of an offering on their chosen chain. */
export async function releaseForOffering(offeringId: string) {
  const routed = await chainHolders(offeringId);
  const ready = routed.filter((h) => h.claimable > 0n && relayerFor(h.chain) && mbChain(h.chain));
  if (!ready.length) return { released: 0 };

  const r = await releaseAndBurn(
    offeringId,
    ready.map((h) => ({ holder: h.holder, domain: h.domain, recipient: h.recipient, relayer: relayerFor(h.chain)!.address })),
  );
  // Keep the Sui read model in step (the release emits offering::Claimed for each holder).
  await ingestDigest(r.digest).catch(() => undefined);

  const released = r.events.filter((e) => e.type.endsWith("::payout::PayoutReleased")).map((e) => e.json);
  const burns = r.events.filter((e) => e.type.endsWith("::deposit_for_burn::DepositForBurn")).map((e) => e.json);
  const rows = released.map((ev: any, i: number) => {
    const burn = burns[i] ?? {};
    const chain = chainByDomain(Number(ev.domain))!;
    return {
      offering_id: offeringId,
      holder: ev.holder,
      chain: chain.key,
      domain: Number(ev.domain),
      recipient: "0x" + String(ev.recipient).replace(/^0x/, "").padStart(64, "0").slice(24),
      amount: String(ev.amount),
      status: "released",
      release_digest: r.digest,
      cctp_nonce: burn.nonce != null ? String(burn.nonce) : null,
    };
  });
  await ok(db().from("payouts").insert(rows));
  for (const row of rows) await notifyAddress(row.holder, { kind: "payout", title: `Sending ${usd(row.amount)} USDC to ${chainByKey(row.chain)!.name}`, body: "Your revenue share is crossing over with Circle CCTP.", link: "/dashboard" });
  await enqueue("payout_attest", { digest: r.digest }, { dedupe: `payout_attest:${r.digest}`, runAfter: new Date(Date.now() + 8_000) });
  return { released: rows.length, digest: r.digest };
}

/** Step 2: wait for Circle to attest every burn in the release transaction. Throws (→ retry) while pending. */
export async function attestRelease(digest: string) {
  const att = await attestations(digest);
  if (!att) throw new Error("Circle attestation pending");
  for (const a of att) {
    const m = decodeBurnMessage(a.message);
    const row = await q(db().from("payouts").select("id, status").eq("release_digest", digest).eq("cctp_nonce", m.nonce).maybeSingle());
    if (!row || row.status !== "released") continue;
    await ok(db().from("payouts").update({ status: "attested", message: a.message, attestation: a.attestation, updated_at: new Date().toISOString() }).eq("id", row.id));
    await enqueue("payout_deliver", { payoutId: row.id }, { dedupe: `payout_deliver:${row.id}` });
  }
}

/** Step 3: our relayer mints it on the destination chain (MultiBaas builds + submits the tx). */
export async function deliverPayout(payoutId: string) {
  const p = await q(db().from("payouts").select("*").eq("id", payoutId).single());
  if (p.status === "delivered" || (p.status === "delivering" && p.evm_tx)) return;
  const c = mbChain(p.chain);
  if (!c) throw new Error(`No MultiBaas deployment configured for ${p.chain}`);
  const hash = await writeMethod(c, RELAYER_ALIAS, RELAYER_LABEL, "deliver", [
    p.message,
    p.attestation,
    bytes32(p.holder),
    bytes32(p.offering_id),
    keccak256(toHex(p.release_digest)),
  ]).catch(async (e) => {
    await ok(db().from("payouts").update({ error: String(e?.message ?? e).slice(0, 400), attempts: (p.attempts ?? 0) + 1, updated_at: new Date().toISOString() }).eq("id", payoutId));
    throw e;
  });
  await ok(db().from("payouts").update({ status: "delivering", evm_tx: hash, error: null, updated_at: new Date().toISOString() }).eq("id", payoutId));
  await enqueue("payout_confirm", { payoutId }, { dedupe: `payout_confirm:${payoutId}`, runAfter: new Date(Date.now() + 6_000) });
}

async function markDelivered(p: any, evmTx: string, block: number | null) {
  if (p.status === "delivered") return;
  await ok(db().from("payouts").update({ status: "delivered", evm_tx: evmTx, evm_block: block, delivered_at: new Date().toISOString(), error: null, updated_at: new Date().toISOString() }).eq("id", p.id));
  const chain = chainByKey(p.chain)!;
  await notifyAddress(p.holder, { kind: "payout", title: `${usd(p.amount)} USDC arrived on ${chain.name}`, body: `Delivered to ${p.recipient.slice(0, 8)}…`, link: `${chain.explorer}/tx/${evmTx}` });
}

/** Step 4: confirm through MultiBaas (receipt + indexed PayoutDelivered event). Throws (→ retry) until final. */
export async function confirmPayout(payoutId: string) {
  const p = await q(db().from("payouts").select("*").eq("id", payoutId).single());
  if (p.status === "delivered" || !p.evm_tx) return;
  const c = mbChain(p.chain)!;
  const rc = await receipt(c, p.evm_tx);
  if (!rc) throw new Error("relayer tx not mined yet");
  if (rc.data.status === "0x0") {
    await ok(db().from("payouts").update({ status: "attested", evm_tx: null, error: "relayer tx reverted; retrying", attempts: (p.attempts ?? 0) + 1 }).eq("id", payoutId));
    await enqueue("payout_deliver", { payoutId }, { dedupe: `payout_deliver:${payoutId}:${Date.now()}`, runAfter: new Date(Date.now() + 20_000) });
    return;
  }
  await markDelivered(p, p.evm_tx, Number(rc.data.blockNumber));
}

/** Applies a PayoutDelivered event (from a MultiBaas webhook or event query). */
export async function applyDeliveredEvent(chainKey: string, ev: MbEvent) {
  if (ev.event?.name !== "PayoutDelivered") return false;
  const nonce = String(ev.event.inputs.find((i) => i.name === "nonce")?.value ?? "");
  const p = await q(db().from("payouts").select("*").eq("chain", chainKey).eq("cctp_nonce", nonce).maybeSingle());
  if (!p) return false;
  await markDelivered(p, ev.transaction.txHash, ev.transaction.blockNumber ?? null);
  return true;
}

/** Reconciler: catches deliveries the webhook missed, straight from MultiBaas's event index. */
export async function reconcileDeliveries() {
  const open = await q(db().from("payouts").select("chain").eq("status", "delivering"));
  for (const chain of new Set((open as any[]).map((r) => r.chain))) {
    const c = mbChain(chain);
    if (!c) continue;
    const evs = await listEvents(c, { contract_label: RELAYER_LABEL, event_signature: PAYOUT_DELIVERED_SIG, limit: 50 });
    for (const ev of evs) await applyDeliveredEvent(chain, ev);
  }
}

export { SUI };
