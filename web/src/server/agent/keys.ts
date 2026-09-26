/** One Scout agent per brand: its Sui key (encrypted at rest), gas, and mandate state. */
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import type { Hex } from "viem";
import { SUI } from "@/lib/deployment";
import * as T from "@/lib/sui/tx";
import { HttpError } from "../auth";
import { db, ok, q } from "../db";
import { execute, sui } from "../sui";
import { enqueue } from "../notify";
import type { ScoutMandate } from "@/lib/scout/types";

const GAS_TOPUP = 150_000_000n; // 0.15 SUI, enough for many mandate payments
const GAS_MIN = 40_000_000n;

function key() {
  const s = process.env.SESSION_SECRET;
  if (!s) throw new Error("SESSION_SECRET missing");
  return createHash("sha256").update(`${s}:brand-agent-keys`).digest();
}
function seal(plain: string) {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return [iv.toString("base64"), c.getAuthTag().toString("base64"), enc.toString("base64")].join(".");
}
function open(sealed: string) {
  const [iv, tag, enc] = sealed.split(".").map((x) => Buffer.from(x, "base64"));
  const d = createDecipheriv("aes-256-gcm", key(), iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(enc), d.final()]).toString("utf8");
}

/** The brand's agent (created on first use). One brand, one agent. */
export async function agentFor(userId: string) {
  let row = await q(db().from("brand_agents").select("*").eq("user_id", userId).maybeSingle());
  if (!row) {
    const kp = new Ed25519Keypair();
    const ins = { user_id: userId, agent_address: kp.toSuiAddress(), agent_secret_enc: seal(kp.getSecretKey()) };
    const { data, error } = await db().from("brand_agents").insert(ins).select("*").single();
    // Two requests racing to create: keep whichever landed first.
    row = error ? await q(db().from("brand_agents").select("*").eq("user_id", userId).single()) : data;
  }
  return { address: row.agent_address as string, mandateId: (row.mandate_id as string | null) ?? null, keypair: () => Ed25519Keypair.fromSecretKey(open(row.agent_secret_enc)) };
}

/**
 * The agent's EVM key: its ENS identity. It may only write its own agent records (ENSIP-26) and
 * register receipt subnames under its own name; the platform grants and revokes those roles.
 */
export async function agentEvmKey(userId: string): Promise<{ address: `0x${string}`; privateKey: Hex }> {
  await agentFor(userId);
  const row = await q(db().from("brand_agents").select("evm_address, evm_secret_enc").eq("user_id", userId).single());
  if (row.evm_secret_enc) return { address: row.evm_address, privateKey: open(row.evm_secret_enc) as Hex };
  const pk = generatePrivateKey();
  const address = privateKeyToAccount(pk).address;
  // Only set if still empty, so two racing callers can't end up with different keys.
  await ok(db().from("brand_agents").update({ evm_address: address, evm_secret_enc: seal(pk) }).eq("user_id", userId).is("evm_secret_enc", null));
  const fin = await q(db().from("brand_agents").select("evm_address, evm_secret_enc").eq("user_id", userId).single());
  return { address: fin.evm_address, privateKey: open(fin.evm_secret_enc) as Hex };
}

/** The agent pays its own gas; the platform tops it up with test SUI when it runs low. */
export async function ensureAgentGas(address: string) {
  const b: any = await sui().getBalance({ owner: address });
  if (BigInt(b.balance.balance) >= GAS_MIN) return null;
  const r = await execute(T.sendCoin({ coinType: "0x2::sui::SUI", amount: GAS_TOPUP, to: address }));
  return r.digest;
}

const usd = (atomic: bigint | number | string) => Number(atomic) / 10 ** SUI.usdcDecimals;

/** Reads the BudgetMandate object from chain. */
export async function readMandate(mandateId: string): Promise<(ScoutMandate & { active: boolean; brand: string; payee: string; payments: number }) | null> {
  const r: any = await sui().getObject({ objectId: mandateId, include: { json: true } } as any);
  const j = r.object?.json;
  if (!j) return null;
  const remaining = BigInt(j.funds?.value ?? j.funds ?? 0);
  return {
    id: mandateId,
    agent: j.agent,
    brand: j.brand,
    payee: j.payee,
    budget: usd(j.budget),
    spent: usd(j.spent),
    remaining: usd(remaining),
    perAdCap: usd(j.per_payment_cap),
    expiresMs: Number(j.expires_ms),
    active: !!j.active,
    payments: Number(j.payments ?? 0),
  };
}

/** Records a mandate the brand just created (after verifying it on chain). */
export async function attachMandate(userId: string, mandateId: string) {
  const a = await agentFor(userId);
  const m = await readMandate(mandateId);
  if (!m) throw new HttpError(404, "Mandate not found on chain");
  if (m.agent !== a.address) throw new HttpError(400, "That mandate names a different agent");
  if (m.payee !== SUI.platformAddress) throw new HttpError(400, "The mandate must pay the brandmystuff x402 address");
  const u = await q(db().from("users").select("sui_address").eq("id", userId).single());
  if (m.brand !== u.sui_address) throw new HttpError(403, "That mandate was funded by a different wallet");
  await ok(db().from("brand_agents").update({ mandate_id: mandateId }).eq("user_id", userId));
  // Its ENS identity (created once) now attests this mandate.
  await enqueue("ens_agent", { userId }, { dedupe: `ens_agent:${userId}` });
  await enqueue("ens_agent_sync", { userId }, { dedupe: `ens_agent_sync:${userId}:${mandateId}` });
  return m;
}
