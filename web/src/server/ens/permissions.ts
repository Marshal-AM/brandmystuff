/**
 * ENSv2 permissions (docs/ENS-INTEGRATION.md §12), built on Enhanced Access Control.
 *
 * ENSv2 resolver roles are scoped per record key, resolver-wide (never per name), so every identity
 * that edits its own records gets its own PermissionedResolver:
 *  - owners/advertisers (`user:<id>`): their wallet may write OWNER_TEXT_KEYS on their account, object,
 *    space and lease names; eth.brandmystuff.attested.* stays platform-only; the names carry no
 *    registry roles, so nobody can repoint them at a resolver serving a forged score.
 *  - brand agents (`agent:<id>`): scout.<brand>.brandmystuff.eth, whose own EVM key may write only its
 *    ENSIP-26 records and run log, and register buy-<n> receipt subnames under its own name. The
 *    platform attests the mandate and strips those roles when the brand revokes it on Sui.
 * brandmystuff keeps admin on every resolver (it grants and revokes); users without an EVM wallet
 * stay on the shared platform resolver, unchanged.
 */
import { formatEther, parseEther, type Address, type Hex } from "viem";
import { ENS_DEPLOYMENT } from "@/lib/deployment";
import { db, ok, q } from "../db";
import { HttpError } from "../auth";
import { agentEvmKey, agentFor, readMandate } from "../agent/keys";
import {
  canSetText,
  dnsName,
  ensClients,
  ensureResolver,
  getState,
  grantTextKeys,
  nameRoles,
  registerName,
  revokeNameRoles,
  revokeTextKeys,
  setRecords,
  setResolver,
  setRootRoles,
  suiAddr,
  suiAddressBytes,
  type Records,
} from "./client";
import { AGENT_TEXT_KEYS, OWNER_TEXT_KEYS, RESOLVER_ROOT_ALL, RR, resolverAbi } from "./contracts";
import { childRegistry, ens, logWrite, platformOwner, registerNameFor, splitName, writeRecords } from "./names";
import { strictAgentRecords } from "./read";

export const AGENT_LABEL = "scout";
const APP = () => process.env.APP_URL ?? "http://localhost:3000";
const nowS = () => Math.floor(Date.now() / 1000);
const bytes32 = (id: string) => (id.startsWith("0x") ? id : `0x${id}`) as Hex;
/** Permission-relevant write-log actions (shown as the permission history in the UI). */
export const PERMISSION_ACTIONS = ["resolver", "grant", "revoke", "set_resolver", "agent_records", "agent_register", "gas"];

type ResolverRow = { key: string; address: Address; manager: Address | null; managed_keys: string[]; status: string };

async function resolverRow(key: string): Promise<ResolverRow | null> {
  return q(db().from("ens_resolvers").select("*").eq("key", key).maybeSingle());
}

async function saveResolver(row: Omit<ResolverRow, "status"> & { status?: string }) {
  await ok(db().from("ens_resolvers").upsert({ ...row, managed_keys: [...row.managed_keys], updated_at: new Date().toISOString() }));
}

/** Tops up an EVM key with a little Sepolia ETH so it can sign its own ENS writes. */
export async function fundEvmGas(address: Address, logName?: string) {
  const c = ens();
  const bal = await c.pub.getBalance({ address });
  if (bal >= parseEther("0.0006")) return null;
  const hash = await c.wallet.sendTransaction({ to: address, value: parseEther("0.0015") } as any);
  await c.pub.waitForTransactionReceipt({ hash, timeout: 180_000 });
  if (logName) await logWrite(logName, "gas", { to: address, eth: "0.0015", before: formatEther(bal) }, null, { hash });
  return hash;
}

/** The full record set the platform has written for a name (all record writes merged, latest wins). */
async function currentRecords(name: string): Promise<Records> {
  const rows = await q(db().from("ens_writes").select("payload").eq("name", name).eq("action", "records").order("id", { ascending: true }));
  const texts: Record<string, string> = {};
  const datas: Record<string, Hex> = {};
  const addrs = new Map<string, Hex>();
  for (const r of rows as any[]) {
    Object.assign(texts, r.payload?.texts ?? {});
    Object.assign(datas, r.payload?.datas ?? {});
    for (const a of r.payload?.addrs ?? []) addrs.set(String(a.coinType), a.value);
  }
  return { texts, datas, addrs: [...addrs].map(([coinType, value]) => ({ coinType: BigInt(coinType), value })) };
}

/**
 * Moves a registered name onto `resolver`: copy its records first, then switch the registry pointer,
 * then drop the owner's SET_RESOLVER so the name can't be repointed. Each step is idempotent.
 */
async function moveName(n: { name: string; owner: string | null }, resolver: Address) {
  const { label, parent } = splitName(n.name);
  const registry = await childRegistry(parent);
  const rec = await currentRecords(n.name);
  const w = await setRecords(ens(), resolver, n.name, rec);
  await logWrite(n.name, "records", { texts: rec.texts, datas: rec.datas, addrs: rec.addrs?.map((a) => ({ coinType: String(a.coinType), value: a.value })) }, null, w);
  const s = await setResolver(ens(), registry, label, resolver);
  await logWrite(n.name, "set_resolver", { resolver }, null, s);
  if (n.owner && n.owner.toLowerCase() !== platformOwner().toLowerCase()) {
    const r = await revokeNameRoles(ens(), registry, label, n.owner as Address, RR.SET_RESOLVER);
    if (!("skipped" in r)) await logWrite(n.name, "revoke", { account: n.owner, roles: ["SET_RESOLVER"], scope: "registry" }, null, r);
  }
  await ok(db().from("ens_names").update({ resolver, delegated: true, updated_at: new Date().toISOString() }).eq("name", n.name));
}

// ---------------------------------------------------------------- owners and advertisers

/**
 * Gives a user (with an EVM wallet) their own resolver: their wallet may write OWNER_TEXT_KEYS,
 * brandmystuff keeps the attested keys. Their registered names move onto it.
 */
export async function delegateUser(userId: string) {
  const u = await q(db().from("users").select("id, evm_address, ens_name, ens_status").eq("id", userId).single());
  if (!u.evm_address || !u.ens_name || u.ens_status !== "registered") return { skipped: true };
  const key = `user:${userId}`;
  const prev = await resolverRow(key);
  const address = await ensureResolver(ens(), key, RESOLVER_ROOT_ALL, prev?.address);
  if (!prev || prev.address.toLowerCase() !== address.toLowerCase() || prev.manager?.toLowerCase() !== u.evm_address.toLowerCase()) {
    await saveResolver({ key, address, manager: u.evm_address, managed_keys: [...OWNER_TEXT_KEYS], status: "active" });
    if (!prev) await logWrite(u.ens_name, "resolver", { resolver: address, admin: platformOwner(), manager: u.evm_address }, null, null);
  }
  const g = await grantTextKeys(ens(), address, u.evm_address as Address, OWNER_TEXT_KEYS);
  if (!("skipped" in g)) await logWrite(u.ens_name, "grant", { account: u.evm_address, role: "SET_TEXT", keys: g.keys, scope: "resolver" }, null, g);

  // Every live name this wallet holds (account, objects, spaces, leases) moves onto the resolver.
  const names = await q(
    db().from("ens_names").select("name, owner, resolver, expiry").eq("status", "registered").ilike("owner", u.evm_address).in("kind", ["account", "object", "space", "lease"]),
  );
  const soon = nowS() + 300;
  for (const n of names as any[]) {
    if (n.resolver?.toLowerCase() === address.toLowerCase()) continue;
    if (n.expiry && Number(n.expiry) < soon) continue; // about to expire: leave it
    await moveName(n, address);
  }
  return { resolver: address, moved: (names as any[]).length };
}

// ---------------------------------------------------------------- brand agents

/** The agent's own clients: writes signed by its EVM key, which only holds its delegated roles. */
async function agentClients(userId: string) {
  const k = await agentEvmKey(userId);
  return { k, c: ensClients(process.env.SEPOLIA_RPC_URL!, k.privateKey) };
}

/** Text writes signed by the agent itself (possibly several of its names in one multicall). */
async function agentWrite(userId: string, writes: { name: string; texts: Record<string, string> }[]) {
  const { k, c } = await agentClients(userId);
  const row = await resolverRow(`agent:${userId}`);
  if (!row || row.status !== "active") throw new Error("agent roles are revoked");
  await fundEvmGas(k.address, writes[0].name);
  const { encodeFunctionData } = await import("viem");
  const calls = writes.flatMap((w) => Object.entries(w.texts).map(([key, v]) => encodeFunctionData({ abi: resolverAbi, functionName: "setText", args: [dnsName(w.name), key, v] })));
  const { request } = await c.pub.simulateContract({ address: row.address, abi: resolverAbi, functionName: "multicall", args: [calls], account: c.account });
  const hash = await c.wallet.writeContract(request as any);
  await c.pub.waitForTransactionReceipt({ hash, timeout: 180_000 });
  for (const w of writes) await logWrite(w.name, "agent_records", { texts: w.texts, by: k.address }, null, { hash });
  return hash;
}

function agentContext(brand: string, brandName: string) {
  return `Scout, the ad-buying agent of ${brandName} (${brand}). It finds physical ad spaces on brandmystuff, checks each space's ENS records against Sui, and pays through x402 within an on-chain budget mandate the brand can revoke at any time.`;
}

/**
 * Creates the brand agent's ENS identity: scout.<brand>.brandmystuff.eth on its own resolver,
 * owned by the brand's wallet (no registry roles), plus a receipts subregistry where only the agent
 * may register. Idempotent; safe to re-run.
 */
export async function ensureAgentIdentity(userId: string) {
  const u = await q(db().from("users").select("id, account_type, ens_name, ens_status, evm_address, brand_name, handle").eq("id", userId).single());
  if (u.account_type !== "brand" || !u.ens_name) return { skipped: true };
  // Not live yet: account registration queues this job again once the brand's name is registered.
  if (u.ens_status !== "registered") return { skipped: true };
  const a = await agentFor(userId);
  const k = await agentEvmKey(userId);
  const name = `${AGENT_LABEL}.${u.ens_name}`;
  const key = `agent:${userId}`;
  const prev = await resolverRow(key);
  const resolver = await ensureResolver(ens(), key, RESOLVER_ROOT_ALL, prev?.address);
  if (!prev || prev.address.toLowerCase() !== resolver.toLowerCase()) {
    await saveResolver({ key, address: resolver, manager: k.address, managed_keys: [...AGENT_TEXT_KEYS], status: prev?.status ?? "active" });
    await logWrite(name, "resolver", { resolver, admin: platformOwner(), manager: k.address }, null, null);
  }
  const status = (await resolverRow(key))!.status;
  if (status === "active") {
    const g = await grantTextKeys(ens(), resolver, k.address, AGENT_TEXT_KEYS);
    if (!("skipped" in g)) await logWrite(name, "grant", { account: k.address, role: "SET_TEXT", keys: g.keys, scope: "resolver" }, null, g);
  }

  const parent = await q(db().from("ens_names").select("expiry").eq("name", u.ens_name).maybeSingle());
  const expiry = Math.min(nowS() + 365 * 86400, Number(parent?.expiry ?? nowS() + 365 * 86400) - 86400);
  const brandName = u.brand_name ?? u.handle ?? "the brand";
  await registerNameFor({
    name,
    kind: "agent",
    owner: (u.evm_address ?? platformOwner()) as Address,
    roles: 0n,
    expiry,
    suiRef: a.address,
    resolver,
    records: {
      texts: {
        class: "Agent",
        description: `${brandName}'s Scout agent`,
        "agent-context": agentContext(u.ens_name, brandName),
        "agent-endpoint[x402]": `${APP()}/api/x402/leases`,
        "agent-endpoint[mcp]": `${APP()}/api/mcp`,
        "eth.brandmystuff.agent.brand": u.ens_name,
        "eth.brandmystuff.attested.agent.status": "no-mandate",
      },
      addrs: [suiAddr(a.address), { coinType: 60n, value: k.address }],
      datas: { "eth.brandmystuff.sui.object": bytes32(suiAddressBytes(a.address)) },
    },
  });

  // Receipts live under the agent's own name; only the agent's key may register there.
  const sub = await childRegistry(name);
  const r = await setRootRoles(ens(), sub, k.address, RR.REGISTRAR, status === "active");
  if (!("skipped" in r)) await logWrite(name, status === "active" ? "grant" : "revoke", { account: k.address, roles: ["REGISTRAR"], scope: "registry", registry: sub }, null, r);
  await ok(db().from("brand_agents").update({ ens_name: name, ens_status: "registered" }).eq("user_id", userId));
  return { name, resolver, agentEvm: k.address };
}

const canonical = (v: unknown): string =>
  v && typeof v === "object" && !Array.isArray(v)
    ? `{${Object.keys(v as object).sort().map((k) => `${JSON.stringify(k)}:${canonical((v as any)[k])}`).join(",")}}`
    : JSON.stringify(v ?? null);

export type AgentStatus = "active" | "paused" | "exhausted" | "revoked" | "expired" | "no-mandate";

/** Grants or strips the agent's roles for a mandate status; revoked/expired agents lose them. */
export async function applyAgentStatus(userId: string, status: AgentStatus) {
  const row = await resolverRow(`agent:${userId}`);
  const ba = await q(db().from("brand_agents").select("ens_name, evm_address").eq("user_id", userId).single());
  if (!row || !ba.ens_name || !ba.evm_address) return;
  const allowed = status !== "revoked" && status !== "expired";
  const k = ba.evm_address as Address;
  const sub = await childRegistry(ba.ens_name);
  if (allowed) {
    const g = await grantTextKeys(ens(), row.address, k, AGENT_TEXT_KEYS);
    if (!("skipped" in g)) await logWrite(ba.ens_name, "grant", { account: k, role: "SET_TEXT", keys: g.keys, scope: "resolver", reason: status }, null, g);
  } else {
    const r = await revokeTextKeys(ens(), row.address, k, AGENT_TEXT_KEYS);
    if (!("skipped" in r)) await logWrite(ba.ens_name, "revoke", { account: k, role: "SET_TEXT", keys: r.keys, scope: "resolver", reason: status }, null, r);
  }
  const rr = await setRootRoles(ens(), sub, k, RR.REGISTRAR, allowed);
  if (!("skipped" in rr)) await logWrite(ba.ens_name, allowed ? "grant" : "revoke", { account: k, roles: ["REGISTRAR"], scope: "registry", registry: sub, reason: status }, null, rr);
  if (row.status !== (allowed ? "active" : "revoked")) await ok(db().from("ens_resolvers").update({ status: allowed ? "active" : "revoked", updated_at: new Date().toISOString() }).eq("key", row.key));
}

/** Mirrors the brand's Sui mandate onto the agent's name (attested) and enforces it on its roles. */
export async function syncAgent(userId: string) {
  const ba = await q(db().from("brand_agents").select("*").eq("user_id", userId).maybeSingle());
  if (!ba?.ens_name || ba.ens_status !== "registered") return;
  const m = ba.mandate_id ? await readMandate(ba.mandate_id) : null;
  const status: AgentStatus = !m
    ? "no-mandate"
    : !m.active
      ? m.remaining > 0 ? "paused" : "revoked"
      : m.expiresMs < Date.now() ? "expired" : m.remaining <= 0 ? "exhausted" : "active";
  const texts: Record<string, string> = { "eth.brandmystuff.attested.agent.status": status };
  if (m) {
    texts["eth.brandmystuff.attested.mandate.budget"] = String(m.budget);
    texts["eth.brandmystuff.attested.mandate.remaining"] = String(m.remaining);
    texts["eth.brandmystuff.attested.mandate.cap"] = String(m.perAdCap);
    texts["eth.brandmystuff.attested.mandate.expires"] = new Date(m.expiresMs).toISOString();
  }
  const state = { texts, mandate: m?.id ?? null };
  // jsonb reorders keys, so compare canonically; only write on-chain when something really changed.
  if (canonical(state) !== canonical(ba.ens_state)) {
    await writeRecords(ba.ens_name, { texts, ...(m ? { datas: { "eth.brandmystuff.mandate": bytes32(m.id) } } : {}) });
  }
  await applyAgentStatus(userId, status);
  await ok(db().from("brand_agents").update({ ens_state: state, ens_synced_at: new Date().toISOString() }).eq("user_id", userId));
  return status;
}

/**
 * After a paid run: the agent registers buy-<n>.scout.<brand> itself (REGISTRAR on its own
 * subregistry only) and records what it picked and why; the platform attests the payment.
 */
export async function writeAgentReceipt(runId: string) {
  const run = await q(db().from("agent_runs").select("*").eq("id", runId).single());
  if (run.status !== "paid" || !run.payment?.digest) return { skipped: true };
  const ba = await q(db().from("brand_agents").select("ens_name, ens_status").eq("user_id", run.user_id).single());
  if (ba.ens_status !== "registered" || !ba.ens_name) throw new Error("agent name not registered yet");
  const row = await resolverRow(`agent:${run.user_id}`);
  if (!row || row.status !== "active") return { skipped: true };
  const u = await q(db().from("users").select("evm_address").eq("id", run.user_id).single());
  const pick = (run.candidates ?? []).find((c: any) => c.id === run.pick_id);

  let receipt: string | undefined = run.payment.ensReceipt;
  if (!receipt) {
    const { count } = await db().from("ens_names").select("*", { count: "exact", head: true }).eq("parent", ba.ens_name).eq("kind", "receipt");
    receipt = `buy-${(count ?? 0) + 1}.${ba.ens_name}`;
    await ok(db().from("agent_runs").update({ payment: { ...run.payment, ensReceipt: receipt } }).eq("id", runId));
  }
  const { label, parent } = splitName(receipt);
  const sub = await childRegistry(parent);
  const agentName = await q(db().from("ens_names").select("expiry").eq("name", parent).single());
  const expiry = Number(agentName.expiry) - 86400;
  const { k, c } = await agentClients(run.user_id);
  await fundEvmGas(k.address, parent);
  const res = await registerName(c, { registry: sub, label, owner: (u.evm_address ?? platformOwner()) as Address, resolver: row.address, roles: 0n, expiry: BigInt(expiry) });
  await logWrite(receipt, "agent_register", { by: k.address, owner: u.evm_address ?? platformOwner(), expiry }, null, res);
  await ok(db().from("ens_names").upsert({
    name: receipt, label, parent, kind: "receipt", owner: u.evm_address ?? platformOwner(), expiry, status: "registered",
    sui_ref: run.payment.escrowId ?? null, resolver: row.address, delegated: true, updated_at: new Date().toISOString(),
  }));
  // Facts: attested by the platform. Choices: written by the agent itself.
  await writeRecords(receipt, {
    texts: {
      class: "AgentReceipt",
      "eth.brandmystuff.attested.payment": run.payment.digest,
      "eth.brandmystuff.attested.amount": `usdc:${run.payment.amount}`,
      ...(run.payment.leaseEns ? { "eth.brandmystuff.attested.lease": run.payment.leaseEns } : {}),
    },
    ...(run.payment.escrowId ? { datas: { "eth.brandmystuff.sui.object": bytes32(run.payment.escrowId) } } : {}),
  }, run.payment.digest, { seed: true });
  const at = new Date(run.finished_at ?? Date.now()).toISOString();
  await agentWrite(run.user_id, [
    { name: receipt, texts: { "eth.brandmystuff.receipt.pick": pick?.ensName ?? "", "eth.brandmystuff.receipt.reason": String(pick?.reasoning ?? "").slice(0, 280) } },
    { name: parent, texts: { "eth.brandmystuff.agent.last-run": at, "eth.brandmystuff.agent.last-pick": pick?.ensName ?? "" } },
  ]);
  return { receipt };
}

/**
 * x402 payer identity: an agent that names itself must resolve (via the Universal Resolver) to the
 * paying Sui address, and must not be revoked.
 */
export async function checkAgentIdentity(name: string, payerSui: string) {
  const n = name.trim().toLowerCase();
  if (!n.endsWith(`.${ENS_DEPLOYMENT.parentName}`)) throw new HttpError(400, "x-agent-ens must be a brandmystuff.eth name");
  let rec: { addr: string | null; text: string | null };
  try {
    rec = await strictAgentRecords(n, "eth.brandmystuff.attested.agent.status");
  } catch (e: any) {
    // Sepolia unreachable: settle exactly as without the header (the payment itself is fully verified), just untagged.
    console.warn("[x402] agent ENS check skipped, RPC unavailable:", String(e?.shortMessage ?? e?.message ?? e).slice(0, 120));
    return null;
  }
  const { addr, text: status } = rec;
  if (!addr || addr.toLowerCase() !== suiAddressBytes(payerSui)) throw new HttpError(403, `${n} does not resolve to the paying Sui address`);
  if (status === "revoked" || status === "expired") throw new HttpError(403, `${n} is ${status}`);
  return { name: n, status: status ?? null };
}

// ---------------------------------------------------------------- read model for the UI

const ROLE_NAMES: [bigint, string][] = Object.entries(RR).map(([k, v]) => [v, k]);
const decodeRoles = (bits: bigint) => ROLE_NAMES.filter(([v]) => (bits & v) !== 0n).map(([, k]) => k);
const SAMPLE_ATTESTED: Record<string, string> = {
  account: "eth.brandmystuff.attested.verified",
  object: "eth.brandmystuff.attested.sponsored",
  space: "eth.brandmystuff.attested.aqs",
  lease: "eth.brandmystuff.attested.state",
  agent: "eth.brandmystuff.attested.agent.status",
  receipt: "eth.brandmystuff.attested.payment",
};

/** Who can write what on a name, proven with live on-chain role reads, plus the permission history. */
export async function permissionsView(name: string, probe = false) {
  const row = await q(db().from("ens_names").select("*").eq("name", name).maybeSingle());
  if (!row || row.status !== "registered") return { name, status: row?.status ?? "pending", delegated: false };
  const resolver = (row.resolver ?? ENS_DEPLOYMENT.platformResolver) as Address;
  const rr = row.resolver ? await q(db().from("ens_resolvers").select("*").ilike("address", row.resolver).limit(1).maybeSingle()) : null;
  const managed: string[] = rr?.status === "active" ? rr.managed_keys : [];
  const role = row.kind === "agent" || row.kind === "receipt" ? "agent" : row.kind === "lease" ? "advertiser" : "owner";
  const recs = await currentRecords(name);
  const keys = [...new Set([...Object.keys(recs.texts ?? {}), ...(rr ? rr.managed_keys : [])])].map((k) => ({
    key: k,
    writer: managed.includes(k) ? role : "platform",
    set: k in (recs.texts ?? {}),
  }));

  const { label, parent } = splitName(name);
  const c = ens();
  const registry = await childRegistry(parent);
  const [st, ownerRoles] = await Promise.all([getState(c, registry, label), row.owner ? nameRoles(c, registry, label, row.owner as Address) : Promise.resolve(0n)]);
  const sampleManaged = managed.find((k) => k === "description") ?? managed[0] ?? null;
  const sampleAttested = SAMPLE_ATTESTED[row.kind] ?? "eth.brandmystuff.attested.state";
  let onchain: any = null;
  if (rr?.manager) {
    const [canManaged, canAttested] = await Promise.all([
      sampleManaged ? canSetText(c, resolver, sampleManaged, rr.manager) : Promise.resolve(false),
      canSetText(c, resolver, sampleAttested, rr.manager),
    ]);
    onchain = { manager: rr.manager, sampleManaged, canManaged, sampleAttested, canAttested };
    if (probe) onchain.probe = await probeWrites(resolver, name, rr.manager, sampleManaged, sampleAttested);
  }
  // Permission history: this name plus the identity-level events (resolver deploy, grants) logged on its root name.
  const root = rr?.key?.startsWith("agent:") ? (row.kind === "receipt" ? parent : name) : await accountNameFor(row.owner);
  const writes = await q(
    db().from("ens_writes").select("id, name, action, payload, eth_tx, created_at").in("name", [...new Set([name, root].filter(Boolean) as string[])]).in("action", PERMISSION_ACTIONS).order("id", { ascending: false }).limit(20),
  );
  return {
    name,
    kind: row.kind,
    status: row.status,
    delegated: !!row.delegated,
    resolver,
    platformResolver: ENS_DEPLOYMENT.platformResolver,
    admin: platformOwner(),
    manager: rr?.manager ?? null,
    managerRole: role,
    resolverStatus: rr?.status ?? null,
    keys,
    token: { owner: st.status === 2 ? st.latestOwner : row.owner, roles: decodeRoles(ownerRoles), expiry: Number(st.expiry), registry, transferable: false },
    onchain,
    history: writes,
  };
}

async function accountNameFor(owner: string | null) {
  if (!owner) return null;
  const u = await q(db().from("users").select("ens_name").ilike("evm_address", owner).limit(1).maybeSingle());
  return u?.ens_name ?? null;
}

/** Simulates (eth_call, no gas) the manager writing an allowed and a platform-only key. */
async function probeWrites(resolver: Address, name: string, manager: Address, allowedKey: string | null, attestedKey: string) {
  const c = ens();
  const sim = async (key: string) => {
    try {
      await c.pub.simulateContract({ address: resolver, abi: resolverAbi, functionName: "setText", args: [dnsName(name), key, "probe"], account: manager });
      return { key, ok: true as const };
    } catch (e: any) {
      const err = e?.cause?.data?.errorName ?? e?.shortMessage ?? "reverted";
      return { key, ok: false as const, error: String(err).slice(0, 120) };
    }
  };
  return Promise.all([...(allowedKey ? [sim(allowedKey)] : []), sim(attestedKey)]);
}
