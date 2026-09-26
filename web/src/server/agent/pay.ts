/**
 * Scout pays for its pick with x402 (exact scheme on Sui), funded by the brand's mandate.
 *
 * The agent is a real x402 client of brandmystuff's own gate (/api/x402/leases):
 *   1. POST without payment → 402 + PAYMENT-REQUIRED (amount, asset, payTo, intent)
 *   2. checks the requirements against its on-chain mandate (payee, per-ad cap, remaining)
 *   3. builds mandate::spend(amount → payTo) and signs it with its own key
 *   4. retries with PAYMENT-SIGNATURE; the gate verifies, settles on Sui, books the lease
 *   5. reads PAYMENT-RESPONSE (settlement digest) and the booking result
 */
import { toBase64 } from "@mysten/sui/utils";
import { SUI, blobUrl } from "@/lib/deployment";
import * as T from "@/lib/sui/tx";
import type { ScoutPaymentStep } from "@/lib/scout/types";
import { HttpError } from "../auth";
import { db, ok, q } from "../db";
import { sui } from "../sui";
import { enqueue } from "../notify";
import { b64, unb64, type PaymentRequired } from "../x402";
import { agentFor, ensureAgentGas, readMandate } from "./keys";
import type { Emit } from "./scout";

const usd = (atomic: string | number | bigint) => Number(atomic) / 10 ** SUI.usdcDecimals;

export async function payScout(userId: string, runId: string, origin: string, emit: Emit) {
  const run = await q(db().from("agent_runs").select("*").eq("id", runId).eq("user_id", userId).maybeSingle());
  if (!run) throw new HttpError(404, "Run not found");
  if (run.status === "paid") throw new HttpError(409, "This run already booked its ad");
  if (!run.pick_id) throw new HttpError(400, "This run has no pick to pay for");
  const u = await q(db().from("users").select("*").eq("id", userId).single());
  const agent = await agentFor(userId);
  if (!agent.mandateId) throw new HttpError(400, "No mandate");
  const pick = (run.candidates ?? []).find((c: any) => c.id === run.pick_id);
  const payment: Record<string, any> = { payer: agent.address };
  const events: any[] = run.events ?? [];
  const step = async (key: ScoutPaymentStep["key"], label: string, detail?: string) => {
    const e = { t: "pay" as const, step: { key, label, detail, at: Date.now() } };
    events.push({ ...e, at: e.step.at });
    await emit(e);
  };
  let refunded = false;
  const fail = async (msg: string) => {
    await emit({ t: "error", error: msg, stage: "pay", refunded });
    await ok(db().from("agent_runs").update({ status: "pay_failed", error: msg, payment: { ...payment, refunded }, events }).eq("id", runId));
  };

  try {
    const gas = await ensureAgentGas(agent.address);
    if (gas) await emit({ t: "log", text: `Topped up agent gas · tx ${gas.slice(0, 10)}…` });

    // 1) ask the gate — expect 402. An agent with an ENS identity names itself; the gate checks it.
    const url = `${origin}/api/x402/leases`;
    const ba = await q(db().from("brand_agents").select("ens_name, ens_status").eq("user_id", userId).single());
    const idHeaders: Record<string, string> = ba.ens_status === "registered" && ba.ens_name ? { "x-agent-ens": ba.ens_name } : {};
    const creativeUrl = u.brand_logo_blob_id ? blobUrl(u.brand_logo_blob_id) : `${origin}/api/agent/creative/${userId}`;
    const body = JSON.stringify({ spaceId: pick.id, weeks: 1, creativeUrl, landingUrl: u.website || `${process.env.APP_URL ?? origin}/${u.ens_name ?? ""}`, brand: (u.brand_name ?? u.handle ?? "brand").slice(0, 60) });
    const first = await fetch(url, { method: "POST", headers: { "content-type": "application/json", ...idHeaders }, body });
    if (first.status !== 402) throw new Error(`Expected 402 from the x402 gate, got ${first.status}: ${(await first.text()).slice(0, 200)}`);
    const prHeader = first.headers.get("payment-required");
    if (!prHeader) throw new Error("402 without a PAYMENT-REQUIRED header");
    const pr = unb64<PaymentRequired>(prHeader);
    const req = pr.accepts.find((a) => a.scheme === "exact" && a.network === "sui:testnet");
    if (!req) throw new Error("The gate offered no exact/sui:testnet payment option");
    payment.amount = usd(req.amount);
    payment.payTo = req.payTo;
    await step("quote", `402 Payment Required · ${usd(req.amount)} USDC`, `exact · ${req.network} · intent ${String(req.extra?.intentId ?? "").slice(0, 8)}…`);

    // 2) check against the mandate
    const m = await readMandate(agent.mandateId);
    if (!m?.active) throw new Error("Mandate is paused or revoked");
    if (req.payTo !== m.payee) throw new Error("The gate's payTo is not the mandate's payee");
    if (req.asset !== SUI.usdcType) throw new Error("Unexpected payment asset");
    if (usd(req.amount) > m.perAdCap) throw new Error(`Price ${usd(req.amount)} USDC is above the ${m.perAdCap} USDC per-ad cap`);
    if (usd(req.amount) > m.remaining) throw new Error(`Only ${m.remaining} USDC left in the mandate`);
    await step("mandate", "Mandate allows it", `${m.remaining} USDC left · cap ${m.perAdCap} · payee matches`);

    // 3) build + sign mandate::spend with the agent's own key
    const kp = agent.keypair();
    const tx = T.mandateSpend({ mandateId: m.id, amount: BigInt(req.amount), memo: `x402:${req.extra?.intentId ?? ""}` });
    tx.setSender(agent.address);
    const bytes = await tx.build({ client: sui() as any });
    const { signature } = await kp.signTransaction(bytes);
    await step("sign", "Signed mandate::spend", `agent ${agent.address.slice(0, 8)}… · ${bytes.length} bytes`);

    // 4) retry with the payment
    const header = b64({ x402Version: 2, resource: pr.resource, accepted: req, payload: { signature, transaction: toBase64(bytes) } });
    await step("submit", "Sent PAYMENT-SIGNATURE", "the gate verifies, simulates and settles on Sui");
    const second = await fetch(url, { method: "POST", headers: { "content-type": "application/json", "PAYMENT-SIGNATURE": header, ...idHeaders }, body });
    const resp = second.headers.get("payment-response");
    const out = await second.json().catch(() => ({}));
    if (resp) {
      const pres = unb64<{ success: boolean; transaction: string; payer: string }>(resp);
      payment.digest = pres.transaction;
      await step("settle", "Settled on Sui", `tx ${pres.transaction.slice(0, 12)}…`);
    }
    if (!second.ok) {
      // The gate refunds the payer (this agent) when booking fails; put the money back in the mandate.
      if (out.refundDigest) {
        try {
          const back = T.mandateRefund({ mandateId: m.id, amount: BigInt(req.amount) });
          back.setSender(agent.address);
          const r: any = await sui().signAndExecuteTransaction({ transaction: back, signer: kp, include: { effects: true } });
          if (r.Transaction) {
            refunded = true;
            await emit({ t: "log", text: `Refund returned to the mandate · tx ${r.Transaction.digest.slice(0, 10)}…` });
          }
        } catch {
          /* the USDC stays safe in the agent's address */
        }
      }
      throw new Error(out.error ?? `Payment was not accepted (${second.status})`);
    }

    // 5) booked
    payment.leaseEns = out.ensName;
    payment.escrowId = out.escrowId;
    await step("book", "Lease booked", `${out.ensName} · escrow ${String(out.escrowId).slice(0, 10)}…`);
    const after = await readMandate(agent.mandateId);
    payment.remainingAfter = after?.remaining;
    await emit({ t: "paid", payment: payment as any, mandate: after! });
    await ok(db().from("agent_runs").update({ status: "paid", payment, events, finished_at: new Date().toISOString() }).eq("id", runId));
    if (idHeaders["x-agent-ens"]) {
      // The agent registers a receipt subname for this purchase, and the mandate records are refreshed.
      await enqueue("ens_agent_receipt", { runId }, { dedupe: `ens_agent_receipt:${runId}` });
      await enqueue("ens_agent_sync", { userId }, { dedupe: `ens_agent_sync:${userId}:paid:${runId}` });
    }
    return payment;
  } catch (e: any) {
    await fail(e?.message ?? "Payment failed");
    throw e;
  }
}
