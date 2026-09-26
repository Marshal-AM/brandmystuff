/**
 * Curvegrid MultiBaas client, one deployment per EVM chain (a deployment is bound to a network).
 *
 * MultiBaas is the backend's whole EVM layer: it builds every transaction (nonce, gas, EIP-1559
 * fees), submits and tracks it, holds the contract library/aliases, indexes contract events,
 * answers event queries and pushes webhooks. The platform EVM key only signs the transaction
 * MultiBaas composed (Cloud Wallet signing needs Azure Key Vault; see docs), and the signed bytes
 * go straight back to MultiBaas for submission. No RPC node, nonce tracking or log indexer here.
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import { privateKeyToAccount } from "viem/accounts";
import { PAYOUT_CHAINS, type PayoutChain, type PayoutChainKey } from "@/lib/payout-chains";

export type MbChain = PayoutChain & { baseUrl: string; apiKey: string };

/** Chains whose MultiBaas deployment is configured in the environment. */
export function multibaasChains(): MbChain[] {
  return PAYOUT_CHAINS.flatMap((c) => {
    const url = process.env[`${c.multibaasEnv}_URL`];
    const key = process.env[`${c.multibaasEnv}_KEY`];
    return url && key ? [{ ...c, baseUrl: url.replace(/\/+$/, ""), apiKey: key }] : [];
  });
}
export const mbChain = (k: string) => multibaasChains().find((c) => c.key === k) ?? null;

export class MultiBaasError extends Error {
  constructor(public status: number, message: string, public chain: string) {
    super(`MultiBaas ${chain}: ${message}`);
  }
}

async function mb<T = any>(c: MbChain, method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${c.baseUrl}/api/v0${path}`, {
    method,
    headers: { authorization: `Bearer ${c.apiKey}`, ...(body !== undefined ? { "content-type": "application/json" } : {}) },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  const text = await res.text();
  let j: any;
  try {
    j = JSON.parse(text);
  } catch {
    throw new MultiBaasError(res.status, text.slice(0, 200) || res.statusText, c.key);
  }
  if (!res.ok || (j.status && j.status >= 400)) throw new MultiBaasError(j.status ?? res.status, j.message ?? res.statusText, c.key);
  return j.result as T;
}

// ---------------------------------------------------------------- signer
function signer() {
  const k = process.env.SEPOLIA_PLATFORM_PRIVATE_KEY;
  if (!k) throw new Error("SEPOLIA_PLATFORM_PRIVATE_KEY missing");
  return privateKeyToAccount(k as `0x${string}`);
}
export const platformEvmAddress = () => signer().address;

// One in-flight write per chain: MultiBaas assigns the nonce when it composes the tx.
const queues = new Map<string, Promise<unknown>>();
function serial<T>(chain: string, fn: () => Promise<T>): Promise<T> {
  const prev = queues.get(chain) ?? Promise.resolve();
  const p = prev.then(fn, fn);
  queues.set(chain, p.catch(() => undefined));
  return p;
}

type UnsignedTx = { nonce: number; gas: number; gasFeeCap?: string; gasTipCap?: string; gasPrice?: string; from: string; to?: string | null; value: string; data: string; type: number };

/** Signs a MultiBaas-composed transaction locally and submits it back through MultiBaas. */
async function signAndSubmit(c: MbChain, tx: UnsignedTx): Promise<string> {
  const acct = signer();
  const common = { chainId: c.chainId, nonce: tx.nonce, gas: BigInt(tx.gas), value: BigInt(tx.value || "0"), data: tx.data as `0x${string}`, ...(tx.to ? { to: tx.to as `0x${string}` } : {}) };
  const signedTx =
    tx.type === 2 || tx.gasFeeCap
      ? await acct.signTransaction({ ...common, type: "eip1559", maxFeePerGas: BigInt(tx.gasFeeCap!), maxPriorityFeePerGas: BigInt(tx.gasTipCap ?? "0") })
      : await acct.signTransaction({ ...common, type: "legacy", gasPrice: BigInt(tx.gasPrice!) });
  const r = await mb<{ tx: { hash: string } }>(c, "POST", "/chains/ethereum/transactions/submit", { signedTx });
  return r.tx.hash;
}

// ---------------------------------------------------------------- contracts
export async function uploadContract(c: MbChain, label: string, a: { contractName: string; version: string; abi: unknown; bytecode?: string; devdoc?: unknown; userdoc?: unknown }) {
  try {
    return await mb(c, "GET", `/contracts/${label}/${a.version}`);
  } catch (e) {
    if (!(e instanceof MultiBaasError) || e.status !== 404) throw e;
  }
  return mb(c, "POST", `/contracts/${label}`, {
    label,
    contractName: a.contractName,
    version: a.version,
    rawAbi: JSON.stringify(a.abi),
    // MultiBaas requires bytecode; ABI-only entries (Circle, USDC) are linked to existing addresses, never deployed.
    bin: a.bytecode ?? "0x",
    ...(a.devdoc ? { developerDoc: JSON.stringify(a.devdoc) } : {}),
    ...(a.userdoc ? { userDoc: JSON.stringify(a.userdoc) } : {}),
  });
}

/** Deploys an uploaded contract (MultiBaas composes the create tx; we sign; MultiBaas submits). */
export async function deployContract(c: MbChain, label: string, version: string, args: unknown[]) {
  return serial(c.key, async () => {
    const r = await mb<{ tx: UnsignedTx; deployAt: string }>(c, "POST", `/contracts/${label}/${version}/deploy`, { args, from: platformEvmAddress() });
    const hash = await signAndSubmit(c, r.tx);
    return { address: r.deployAt, hash };
  });
}

export async function setAlias(c: MbChain, alias: string, address: string) {
  try {
    return await mb(c, "POST", "/chains/ethereum/addresses", { alias, address });
  } catch (e) {
    if (e instanceof MultiBaasError && /exist|conflict|duplicate/i.test(e.message)) return null;
    throw e;
  }
}

/** Links an address to a contract label; with `startingBlock`, MultiBaas also indexes its events from there. */
export async function linkContract(c: MbChain, addressOrAlias: string, label: string, version: string, startingBlock?: string) {
  try {
    // No startingBlock = linked for calls only (no event indexing); the free plan indexes few events/sec.
    return await mb(c, "POST", `/chains/ethereum/addresses/${addressOrAlias}/contracts`, { label, version, ...(startingBlock ? { startingBlock } : {}) });
  } catch (e) {
    if (e instanceof MultiBaasError && /already|exist/i.test(e.message)) return null;
    throw e;
  }
}

/** Read-only contract call. */
export async function readMethod<T = any>(c: MbChain, addressOrAlias: string, label: string, method: string, args: unknown[], contractOverride = false): Promise<T> {
  const r = await mb<{ kind: string; output: T }>(c, "POST", `/chains/ethereum/addresses/${addressOrAlias}/contracts/${label}/methods/${method}`, { args, ...(contractOverride ? { contractOverride: true } : {}) });
  return r.output;
}

/** State-changing contract call: composed by MultiBaas, signed by the platform key, submitted via MultiBaas. */
export async function writeMethod(c: MbChain, addressOrAlias: string, label: string, method: string, args: unknown[]) {
  return serial(c.key, async () => {
    const r = await mb<{ kind: string; tx: UnsignedTx }>(c, "POST", `/chains/ethereum/addresses/${addressOrAlias}/contracts/${label}/methods/${method}`, { args, from: platformEvmAddress() });
    if (r.kind !== "TransactionToSignResponse") throw new MultiBaasError(500, `${method} is not a write method`, c.key);
    return signAndSubmit(c, r.tx);
  });
}

export async function receipt(c: MbChain, hash: string) {
  try {
    return await mb<{ data: { status: string; blockNumber: string }; events: any[] }>(c, "GET", `/chains/ethereum/transactions/receipt/${hash}?include=contract`);
  } catch (e) {
    if (e instanceof MultiBaasError && e.status === 404) return null;
    throw e;
  }
}

export async function chainStatus(c: MbChain) {
  return mb<{ blockNumber: number; chainID: number }>(c, "GET", "/chains/ethereum/status");
}

export async function addressInfo(c: MbChain, address: string) {
  return mb<{ address: string; balance?: string; nonce?: number; alias?: string }>(c, "GET", `/chains/ethereum/addresses/${address}?include=balance&include=nonce`);
}

// ---------------------------------------------------------------- events
export type MbEvent = {
  triggeredAt: string;
  event: { name: string; signature: string; inputs: { name: string; value: any; type: string }[]; contract: { address: string; addressAlias?: string; addressLabel?: string; label: string } };
  transaction: { txHash: string; blockNumber: number; from: string };
};

export async function listEvents(c: MbChain, q: { contract_label?: string; event_signature?: string; tx_hash?: string; limit?: number; offset?: number }) {
  const qs = new URLSearchParams(Object.entries(q).filter(([, v]) => v != null).map(([k, v]) => [k, String(v)]));
  return mb<MbEvent[]>(c, "GET", `/events?${qs}`);
}

/** Ad-hoc aggregation over indexed events (MultiBaas Event Queries). */
export async function eventQuery<T = Record<string, any>>(c: MbChain, query: unknown) {
  const r = await mb<{ rows: T[] }>(c, "POST", "/queries?limit=500", query);
  return r.rows ?? [];
}

// ---------------------------------------------------------------- webhooks
export async function ensureWebhook(c: MbChain, url: string) {
  const hooks = await mb<{ id: number; url: string; label: string; secret: string }[]>(c, "GET", "/webhooks?limit=50");
  const found = hooks.find((h) => h.url === url);
  if (found) return found;
  return mb<{ id: number; secret: string }>(c, "POST", "/webhooks", { label: `brandmystuff-payouts-${c.key}`, url, subscriptions: ["event.emitted", "transaction.included"] });
}

/** MultiBaas webhook signature: hex HMAC-SHA256(secret, rawBody || timestamp). */
export function verifyWebhook(rawBody: string, timestamp: string | null, signature: string | null, secret: string) {
  if (!timestamp || !signature) return false;
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 600) return false; // 10-minute replay window
  const mac = createHmac("sha256", secret).update(rawBody).update(timestamp).digest("hex");
  const a = Buffer.from(mac, "hex"), b = Buffer.from(signature, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

export type { PayoutChainKey };
