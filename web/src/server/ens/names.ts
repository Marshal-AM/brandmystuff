/**
 * ENS name management for users, objects, spaces and leases (ENS-INTEGRATION.md §2–§5).
 * Everything is written by the platform key; registries for children are deployed lazily.
 */
import type { Address, Hex } from "viem";
import { ENS_DEPLOYMENT, SUI } from "@/lib/deployment";
import { db, q, ok } from "../db";
import {
  ensClients,
  ensureUserRegistry,
  getState,
  nodeOf,
  registerName,
  renewName,
  reserveName,
  setRecords,
  setSubregistry,
  suiAddr,
  unregisterName,
  type Records,
} from "./client";
import { LEASE_NAME_ROLES, OWNER_NAME_ROLES, REGISTRY_ROOT_ALL } from "./contracts";

const FIVE_YEARS = 5 * 365 * 24 * 3600;
let clients: ReturnType<typeof ensClients> | undefined;
export const ens = () => (clients ??= ensClients(process.env.SEPOLIA_RPC_URL!, process.env.SEPOLIA_PLATFORM_PRIVATE_KEY as Hex));

const nowS = () => Math.floor(Date.now() / 1000);
const splitName = (name: string) => {
  const i = name.indexOf(".");
  return { label: name.slice(0, i), parent: name.slice(i + 1) };
};

async function logWrite(name: string, action: string, payload: unknown, suiDigest: string | null, res: any) {
  await ok(db().from("ens_writes").insert({
    name,
    action,
    payload: payload as any,
    sui_digest: suiDigest,
    eth_tx: res && "hash" in res ? res.hash : null,
  }));
  return res && "hash" in res ? (res.hash as string) : null;
}

/** Registry that holds the children of `name` (deploying and linking it if needed). */
async function childRegistry(name: string): Promise<Address> {
  if (name === ENS_DEPLOYMENT.parentName) return ENS_DEPLOYMENT.rootRegistry;
  const row = await q(db().from("ens_names").select("*").eq("name", name).maybeSingle());
  if (!row) throw new Error(`ENS name ${name} not registered yet`);
  const reg = await ensureUserRegistry(ens(), name, REGISTRY_ROOT_ALL, row.subregistry as Address | null);
  if (reg !== row.subregistry) {
    const { label, parent } = splitName(name);
    const parentReg = await childRegistry(parent);
    await setSubregistry(ens(), parentReg, label, reg);
    await ok(db().from("ens_names").update({ subregistry: reg, updated_at: new Date().toISOString() }).eq("name", name));
  }
  return reg;
}

export async function registerNameFor(p: {
  name: string;
  kind: "account" | "object" | "space" | "lease";
  owner: Address;
  roles: bigint;
  expiry: number;
  records: Records;
  suiRef: string;
  suiDigest?: string | null;
}) {
  const { label, parent } = splitName(p.name);
  const registry = await childRegistry(parent);
  const res = await registerName(ens(), {
    registry,
    label,
    owner: p.owner,
    resolver: ENS_DEPLOYMENT.platformResolver,
    roles: p.roles,
    expiry: BigInt(p.expiry),
  });
  const tx = await logWrite(p.name, "register", { owner: p.owner, expiry: p.expiry }, p.suiDigest ?? null, res);
  await ok(db().from("ens_names").upsert({
    name: p.name,
    label,
    parent,
    kind: p.kind,
    owner: p.owner,
    expiry: p.expiry,
    status: "registered",
    sui_ref: p.suiRef,
    updated_at: new Date().toISOString(),
  }));
  await writeRecords(p.name, p.records, p.suiDigest ?? null);
  return tx;
}

export async function writeRecords(name: string, r: Records, suiDigest: string | null = null) {
  const res = await setRecords(ens(), ENS_DEPLOYMENT.platformResolver, name, r);
  return logWrite(name, "records", { texts: r.texts, datas: r.datas, addrs: r.addrs?.map((a) => ({ coinType: String(a.coinType), value: a.value })) }, suiDigest, res);
}

export async function reserveLabel(name: string, expiry: number, suiDigest: string | null) {
  const { label, parent } = splitName(name);
  const registry = await childRegistry(parent);
  const res = await reserveName(ens(), { registry, label, resolver: ENS_DEPLOYMENT.platformResolver, expiry: BigInt(expiry) });
  await ok(db().from("ens_names").upsert({ name, label, parent, kind: "lease", status: "reserved", expiry, updated_at: new Date().toISOString() }));
  return logWrite(name, "reserve", { expiry }, suiDigest, res);
}

export async function renewLabel(name: string, expiry: number, suiDigest: string | null) {
  const { label, parent } = splitName(name);
  const registry = await childRegistry(parent);
  const res = await renewName(ens(), registry, label, BigInt(expiry));
  await ok(db().from("ens_names").update({ expiry, updated_at: new Date().toISOString() }).eq("name", name));
  return logWrite(name, "renew", { expiry }, suiDigest, res);
}

export async function unregisterLabel(name: string, suiDigest: string | null) {
  const { label, parent } = splitName(name);
  const registry = await childRegistry(parent);
  const res = await unregisterName(ens(), registry, label);
  await ok(db().from("ens_names").update({ status: "unregistered", updated_at: new Date().toISOString() }).eq("name", name));
  return logWrite(name, "unregister", {}, suiDigest, res);
}

export async function labelState(name: string) {
  const { label, parent } = splitName(name);
  return getState(ens(), await childRegistry(parent), label);
}

// ---------------- high-level operations used by the relayer ----------------

const bytes32 = (id: string) => (id.startsWith("0x") ? id : `0x${id}`) as Hex;
const platformOwner = () => ENS_DEPLOYMENT.platformKey;

export async function ensureAccountName(userId: string) {
  const u = await q(db().from("users").select("*").eq("id", userId).single());
  if (!u.ens_name) return;
  const owner = (u.evm_address ?? platformOwner()) as Address;
  await registerNameFor({
    name: u.ens_name,
    kind: "account",
    owner,
    roles: OWNER_NAME_ROLES,
    expiry: nowS() + FIVE_YEARS - 2 * 86400,
    suiRef: u.sui_address ?? "",
    records: {
      texts: {
        class: u.brand_name ? "Organization" : "Person",
        ...(u.display_name ? { name: u.display_name } : {}),
        ...(u.bio ? { description: u.bio } : {}),
        ...(u.twitter ? { "com.twitter": u.twitter } : {}),
        ...(u.website ? { url: u.website } : {}),
        ...(u.avatar_blob_id ? { avatar: `https://aggregator.walrus-testnet.walrus.space/v1/blobs/${u.avatar_blob_id}` } : {}),
      },
      addrs: [...(u.sui_address ? [suiAddr(u.sui_address)] : []), ...(u.evm_address ? [{ coinType: 60n, value: u.evm_address as Hex }] : [])],
      datas: u.profile_id ? { "eth.brandmystuff.sui.profile": bytes32(u.profile_id), "eth.brandmystuff.sui.object": bytes32(u.profile_id) } : {},
    },
  });
  await ok(db().from("users").update({ ens_status: "registered" }).eq("id", userId));
}

export async function ensureObjectName(objectId: string, suiDigest: string | null) {
  const o = await q(db().from("objects").select("*, users:owner_user_id(evm_address, ens_name)").eq("id", objectId).single());
  if (!o.ens_name) return;
  const parent = splitName(o.ens_name).parent;
  const pRow = await q(db().from("ens_names").select("name").eq("name", parent).maybeSingle());
  if (!pRow) throw new Error(`parent ${parent} not registered yet`);
  await registerNameFor({
    name: o.ens_name,
    kind: "object",
    owner: ((o as any).users?.evm_address ?? platformOwner()) as Address,
    roles: OWNER_NAME_ROLES,
    expiry: nowS() + FIVE_YEARS - 3 * 86400,
    suiRef: objectId,
    suiDigest,
    records: {
      texts: {
        class: "PhysicalAsset",
        description: o.description ?? o.title,
        avatar: `https://aggregator.walrus-testnet.walrus.space/v1/blobs/${o.hero_blob_id}`,
        "eth.brandmystuff.type": o.object_type ?? o.category ?? "object",
        "eth.brandmystuff.tags": (o.tags ?? []).join(","),
        ...(o.make ? { "eth.brandmystuff.make": o.make } : {}),
        ...(o.model ? { "eth.brandmystuff.model": o.model } : {}),
        ...(o.color ? { "eth.brandmystuff.color": o.color } : {}),
        ...(o.city ? { "eth.brandmystuff.city": o.city } : {}),
        "eth.brandmystuff.status": "live",
      },
      datas: { "eth.brandmystuff.sui.object": bytes32(objectId) },
      addrs: [suiAddr(o.owner_address)],
    },
  });
}

export async function ensureSpaceName(spaceId: string, suiDigest: string | null) {
  const s = await q(db().from("spaces").select("*, objects(ens_name, owner_user_id, users:owner_user_id(evm_address))").eq("id", spaceId).single());
  if (!s.ens_name) return;
  const objName = (s as any).objects?.ens_name;
  const pRow = await q(db().from("ens_names").select("name").eq("name", objName).maybeSingle());
  if (!pRow) throw new Error(`object ${objName} not registered yet`);
  await registerNameFor({
    name: s.ens_name,
    kind: "space",
    owner: ((s as any).objects?.users?.evm_address ?? platformOwner()) as Address,
    roles: OWNER_NAME_ROLES,
    expiry: nowS() + FIVE_YEARS - 4 * 86400,
    suiRef: spaceId,
    suiDigest,
    records: spaceRecords(s),
  });
}

export function spaceRecords(s: any): Records {
  const GR = ["—", "C", "B", "A", "A+"];
  return {
    texts: {
      class: "AdSpace",
      description: `${s.label} — ${s.width_mm / 10}×${s.height_mm / 10} cm, ${s.placement}`,
      avatar: `https://aggregator.walrus-testnet.walrus.space/v1/blobs/${s.closeup_blob_id}`,
      "eth.brandmystuff.dimensions": `${s.width_mm / 10}x${s.height_mm / 10}cm`,
      "eth.brandmystuff.placement": s.placement,
      "eth.brandmystuff.attested.aqs": String(s.aqs),
      "eth.brandmystuff.attested.grade": GR[s.grade] ?? "—",
      "eth.brandmystuff.attested.confidence": (s.confidence_bps / 10000).toFixed(2),
      "eth.brandmystuff.attested.rank": Number(s.rank_score).toFixed(2),
      "eth.brandmystuff.price": `usdc:${Number(s.price_per_week) / 1e6}/week`,
      "eth.brandmystuff.status": s.status,
      ...(s.offering_id ? { "eth.brandmystuff.token": `units:10000;offering:${s.offering_id}` } : {}),
    },
    datas: {
      "eth.brandmystuff.sui.object": bytes32(s.id),
      ...(s.report_hash ? { "eth.brandmystuff.attested.score-report": bytes32(s.report_hash) } : {}),
    },
  };
}

export async function leaseName(escrowId: string) {
  const l = await q(db().from("leases").select("ens_label, spaces(ens_name)").eq("escrow_id", escrowId).single());
  return `${l.ens_label}.${(l as any).spaces.ens_name}`;
}

export async function registerLeaseName(escrowId: string, suiDigest: string | null) {
  const l = await q(db().from("leases").select("*, spaces(ens_name)").eq("escrow_id", escrowId).single());
  const name = `${l.ens_label}.${(l as any).spaces.ens_name}`;
  const adv = await q(db().from("users").select("evm_address").eq("sui_address", l.advertiser).maybeSingle());
  const end = Math.floor((Number(l.start_ms) + Number(l.weeks) * Number(l.week_ms)) / 1000);
  await registerNameFor({
    name,
    kind: "lease",
    owner: ((adv as any)?.evm_address ?? platformOwner()) as Address,
    roles: LEASE_NAME_ROLES,
    expiry: Math.max(end, nowS() + 120),
    suiRef: escrowId,
    suiDigest,
    records: {
      texts: {
        class: "AdLease",
        avatar: `https://aggregator.walrus-testnet.walrus.space/v1/blobs/${l.creative_blob_id}`,
        url: `${process.env.APP_URL ?? "http://localhost:3000"}/r/${escrowId}`,
        "eth.brandmystuff.brand": l.brand ?? "",
        "eth.brandmystuff.attested.state": "awaiting-install",
        "eth.brandmystuff.attested.proofs": "0",
      },
      datas: { "eth.brandmystuff.attested.creative": bytes32(l.creative_hash), "eth.brandmystuff.sui.object": bytes32(escrowId) },
      addrs: [suiAddr(l.advertiser)],
    },
  });
}

export const SUI_PACKAGE = SUI.packageId;
export { nodeOf };
