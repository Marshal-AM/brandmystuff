import { HttpError } from "./auth";
import { db, q, ok } from "./db";
import { json } from "./http";
import { fulfil } from "./x402flows";
import { checkAgentIdentity } from "./ens/permissions";
import { paymentRequiredResponse, paymentResponseHeader, requirements, settlePayment, unb64, verifyPayment, type PaymentRequired } from "./x402";

/** Shared x402 request handling: 402 on first call, verify + settle + fulfil on retry. */
export async function x402Handle(req: Request, create: () => Promise<{ intent: any; requirements: any; quote?: any }>, description: string) {
  const header = req.headers.get("payment-signature");
  if (!header) {
    const { intent, requirements: reqs, quote } = await create();
    const pr: PaymentRequired = { x402Version: 2, error: "PAYMENT-SIGNATURE header is required", resource: { url: req.url, description, mimeType: "application/json" }, accepts: [reqs] };
    return paymentRequiredResponse(pr, { ...pr, intentId: intent.id, quote: quote ? { ...quote, amount: String(quote.amount) } : undefined });
  }
  let intentId: string | undefined;
  try {
    intentId = (unb64<any>(header).accepted?.extra?.intentId as string) ?? undefined;
  } catch {}
  if (!intentId) throw new HttpError(400, "accepted.extra.intentId missing");
  const intent = await q(db().from("x402_intents").select("*").eq("id", intentId).maybeSingle());
  if (!intent) throw new HttpError(404, "Unknown payment intent");
  if (intent.status !== "awaiting_payment") {
    if (intent.status === "fulfilled") return json({ ...intent.result, intentId }, { headers: { "PAYMENT-RESPONSE": paymentResponseHeader(intent.payment_digest, intent.payer) } });
    throw new HttpError(409, `Intent is ${intent.status}`);
  }
  if (new Date(intent.expires_at).getTime() < Date.now()) throw new HttpError(410, "Payment intent expired — request a new quote");
  const expected = requirements(BigInt(intent.amount), unb64<any>(header).accepted.extra);
  const v = await verifyPayment(header, expected);
  // Optional agent identity: an ENS name that must resolve (addr 784) to the paying Sui address.
  // Checked before settling, so a mismatch never moves funds.
  const agentEns = req.headers.get("x-agent-ens");
  const who = agentEns ? await checkAgentIdentity(agentEns, v.payer) : null;
  await ok(db().from("x402_intents").update({ status: "settling", payer: v.payer, payment_digest: v.digest, ...(who ? { payer_ens: who.name } : {}) }).eq("id", intent.id).eq("status", "awaiting_payment"));
  const digest = await settlePayment(v);
  const out = await fulfil(intent, v.payer, digest);
  if (!out.ok) return json({ error: out.error, refundDigest: out.refundDigest }, { status: 409, headers: { "PAYMENT-RESPONSE": paymentResponseHeader(digest, v.payer, true) } });
  return json({ ...out.result, intentId }, { headers: { "PAYMENT-RESPONSE": paymentResponseHeader(digest, v.payer) } });
}
