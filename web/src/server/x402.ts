/**
 * x402 v2 — `exact` scheme on Sui, self-hosted facilitator.
 * Spec: https://github.com/x402-foundation/x402/blob/main/specs/schemes/exact/scheme_exact_sui.md
 * Transport: PAYMENT-REQUIRED / PAYMENT-SIGNATURE / PAYMENT-RESPONSE headers (base64 JSON).
 */
import { Transaction } from "@mysten/sui/transactions";
import { verifyTransactionSignature } from "@mysten/sui/verify";
import { fromBase64 } from "@mysten/sui/utils";
import { SUI } from "@/lib/deployment";
import { HttpError } from "./auth";
import { db, q } from "./db";
import { sui } from "./sui";

export const NETWORK = "sui:testnet";

export type PaymentRequirements = {
  scheme: "exact";
  network: string;
  amount: string;
  asset: string;
  payTo: string;
  maxTimeoutSeconds: number;
  extra: Record<string, unknown>;
};

export type PaymentRequired = {
  x402Version: 2;
  error?: string;
  resource: { url: string; description: string; mimeType: string };
  accepts: PaymentRequirements[];
};

export const b64 = (v: unknown) => Buffer.from(JSON.stringify(v)).toString("base64");
export const unb64 = <T>(s: string): T => JSON.parse(Buffer.from(s, "base64").toString("utf8"));

export function requirements(amount: bigint, extra: Record<string, unknown>): PaymentRequirements {
  return {
    scheme: "exact",
    network: NETWORK,
    amount: amount.toString(),
    asset: SUI.usdcType,
    payTo: SUI.platformAddress,
    maxTimeoutSeconds: 120,
    extra: { name: "USDC", decimals: 6, ...extra },
  };
}

export function paymentRequiredResponse(pr: PaymentRequired, body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 402,
    headers: { "content-type": "application/json", "PAYMENT-REQUIRED": b64(pr) },
  });
}

type PaymentPayload = {
  x402Version: 2;
  resource?: unknown;
  accepted: PaymentRequirements;
  payload: { signature: string; transaction: string };
};

/** Verifies the signed payment transaction (signature, simulation, exact balance change, replay). */
export async function verifyPayment(header: string, expected: PaymentRequirements) {
  let pp: PaymentPayload;
  try {
    pp = unb64<PaymentPayload>(header);
  } catch {
    throw new HttpError(400, "Malformed PAYMENT-SIGNATURE header");
  }
  if (pp.x402Version !== 2) throw new HttpError(400, "Unsupported x402 version");
  const acc = pp.accepted;
  if (acc?.scheme !== "exact" || acc.network !== NETWORK) throw new HttpError(402, "Unsupported scheme or network", { reason: "invalid_network" });
  if (acc.amount !== expected.amount || acc.asset !== expected.asset || acc.payTo !== expected.payTo)
    throw new HttpError(402, "Accepted requirements do not match", { reason: "invalid_requirements" });

  const bytes = fromBase64(pp.payload.transaction);
  const tx = Transaction.from(bytes);
  const sender = tx.getData().sender;
  if (!sender) throw new HttpError(402, "Transaction has no sender", { reason: "invalid_transaction" });
  try {
    await verifyTransactionSignature(bytes, pp.payload.signature, { address: sender });
  } catch {
    throw new HttpError(402, "Invalid transaction signature", { reason: "invalid_signature" });
  }
  const digest = await tx.getDigest();
  const used = await q(db().from("x402_intents").select("id").eq("payment_digest", digest).maybeSingle());
  if (used) throw new HttpError(402, "Payment already used", { reason: "replay" });

  const sim: any = await sui().simulateTransaction({ transaction: bytes, include: { effects: true, balanceChanges: true } } as any);
  const t = sim.Transaction ?? sim.FailedTransaction;
  if (!sim.Transaction) throw new HttpError(402, `Payment simulation failed: ${JSON.stringify(t?.status?.error ?? t?.status)}`, { reason: "simulation_failed" });
  const norm = (a: string) => a.toLowerCase();
  const normType = (s: string) => s.replace(/^0x0*/, "0x");
  const received = (t.balanceChanges ?? [])
    .filter((c: any) => norm(c.address) === norm(SUI.platformAddress) && normType(c.coinType) === normType(SUI.usdcType))
    .reduce((a: bigint, c: any) => a + BigInt(c.amount), 0n);
  if (received !== BigInt(expected.amount))
    throw new HttpError(402, `Payment must transfer exactly ${expected.amount} to ${expected.payTo}`, { reason: "invalid_amount" });
  return { bytes, signature: pp.payload.signature, payer: sender, digest };
}

export async function settlePayment(v: { bytes: Uint8Array; signature: string; digest: string }) {
  const c = sui();
  const r: any = await c.executeTransaction({ transaction: v.bytes, signatures: [v.signature], include: { effects: true } });
  if (!r.Transaction) throw new HttpError(402, "Payment settlement failed", { reason: "settlement_failed" });
  await c.waitForTransaction({ digest: r.Transaction.digest });
  return r.Transaction.digest as string;
}

export function paymentResponseHeader(digest: string, payer: string, success = true) {
  return b64({ success, transaction: digest, network: NETWORK, payer });
}
