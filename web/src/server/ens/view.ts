/** Read-only ENS views for the UI, built from the relayer's own bookkeeping (no chain calls). */
import { namehash } from "viem/ens";
import { ENS_DEPLOYMENT } from "@/lib/deployment";
import { db, q } from "../db";

/** brandmystuff.eth → user → object → space → lease, from the top down. */
export function nameChain(name: string) {
  const parent = ENS_DEPLOYMENT.parentName;
  if (!name.endsWith(`.${parent}`)) return [name];
  const labels = name.slice(0, -(parent.length + 1)).split(".");
  const out = [parent];
  for (let i = labels.length - 1; i >= 0; i--) out.push(`${labels.slice(i).join(".")}.${parent}`);
  return out;
}

/** Everything the UI shows about one name: status, where it lives, what's written, and the write log. */
export async function ensSnapshot(name: string) {
  const chain = nameChain(name);
  const [row, chainRows, writes, lastRecords] = await Promise.all([
    q(db().from("ens_names").select("*").eq("name", name).maybeSingle()),
    q(db().from("ens_names").select("name, kind, status").in("name", chain)),
    q(db().from("ens_writes").select("id, action, eth_tx, sui_digest, error, created_at").eq("name", name).order("id", { ascending: false }).limit(12)),
    q(db().from("ens_writes").select("payload, created_at").eq("name", name).eq("action", "records").order("id", { ascending: true })),
  ]);
  // The full record set: every relayer write merged in order (partial updates only carry changed keys).
  const merged = (lastRecords as any[]).reduce(
    (acc, w) => ({
      texts: { ...acc.texts, ...(w.payload?.texts ?? {}) },
      datas: { ...acc.datas, ...(w.payload?.datas ?? {}) },
      addrs: [...acc.addrs.filter((a: any) => !(w.payload?.addrs ?? []).some((b: any) => String(b.coinType) === String(a.coinType))), ...(w.payload?.addrs ?? [])],
      writtenAt: w.created_at,
    }),
    { texts: {}, datas: {}, addrs: [] as any[], writtenAt: null as string | null },
  );
  const byName = new Map((chainRows as any[]).map((r) => [r.name, r]));
  return {
    name,
    namehash: namehash(name),
    status: row?.status ?? "pending",
    kind: row?.kind ?? null,
    owner: row?.owner ?? null,
    expiry: row?.expiry ? Number(row.expiry) : null,
    registry: row?.subregistry ?? null,
    resolver: row?.resolver ?? ENS_DEPLOYMENT.platformResolver,
    updatedAt: row?.updated_at ?? null,
    chain: chain.map((n) => ({ name: n, kind: n === ENS_DEPLOYMENT.parentName ? "platform" : byName.get(n)?.kind ?? null, status: n === ENS_DEPLOYMENT.parentName ? "registered" : byName.get(n)?.status ?? "pending" })),
    records: (lastRecords as any[]).length ? merged : null,
    writes,
  };
}

/** Platform-wide pulse: how many names are live and the latest relayer writes. */
export async function ensPulse() {
  const [names, recent] = await Promise.all([
    q(db().from("ens_names").select("kind, status")),
    q(db().from("ens_writes").select("id, name, action, eth_tx, created_at").is("error", null).order("id", { ascending: false }).limit(8)),
  ]);
  const live = (names as any[]).filter((n) => n.status === "registered");
  const byKind: Record<string, number> = {};
  for (const n of live) byKind[n.kind] = (byKind[n.kind] ?? 0) + 1;
  return { total: live.length, byKind, recent };
}

/** Names under a user's account name (account, objects, spaces, leases) with their status. */
export async function namesUnder(accountName: string) {
  const rows = await q(db().from("ens_names").select("name, kind, status, expiry, updated_at").or(`name.eq.${accountName},name.like.%.${accountName}`).order("name"));
  return rows as { name: string; kind: string; status: string; expiry: number | null; updated_at: string }[];
}
