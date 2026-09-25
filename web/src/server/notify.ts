import { db, ok } from "./db";

export async function notify(userId: string | null | undefined, n: { kind: string; title: string; body?: string; link?: string }) {
  if (!userId) return;
  await ok(db().from("notifications").insert({ user_id: userId, ...n }));
}

export async function notifyAddress(address: string | null | undefined, n: { kind: string; title: string; body?: string; link?: string }) {
  if (!address) return;
  const { data } = await db().from("users").select("id").eq("sui_address", address).maybeSingle();
  if (data) return notify(data.id, n);
  const { data: lw } = await db().from("linked_wallets").select("user_id").eq("address", address).maybeSingle();
  if (lw) return notify(lw.user_id, n);
}

export async function activity(a: {
  kind: string;
  space_id?: string | null;
  object_id?: string | null;
  offering_id?: string | null;
  actor?: string | null;
  amount?: bigint | number | string | null;
  data?: unknown;
  sui_digest?: string | null;
  eth_tx?: string | null;
}) {
  await ok(db()
    .from("activity")
    .insert({ ...a, amount: a.amount == null ? null : String(a.amount) }));
}

export async function enqueue(kind: string, payload: unknown, opts: { dedupe?: string; runAfter?: Date } = {}) {
  const row: any = { kind, payload, dedupe_key: opts.dedupe ?? null, run_after: (opts.runAfter ?? new Date()).toISOString() };
  const { error } = await db().from("jobs").insert(row);
  if (error && !String(error.message).includes("duplicate")) throw new Error(error.message);
}
