import { handler } from "@/server/http";
import { HttpError, requireUser } from "@/server/auth";
import { db, q } from "@/server/db";
import { fundEvmGas } from "@/server/ens/permissions";
import type { Address } from "viem";

/** A little Sepolia ETH for a user's own wallet, so it can sign its delegated ENS record edits. */
export const POST = handler(async (req) => {
  const u = await requireUser(req);
  const r = await q(db().from("ens_resolvers").select("manager, status").eq("key", `user:${u.id}`).maybeSingle());
  if (!r?.manager || r.status !== "active" || r.manager.toLowerCase() !== (u.evm_address ?? "").toLowerCase()) throw new HttpError(400, "Your names aren't self-managed yet");
  const recent = await q(db().from("ens_writes").select("id").eq("action", "gas").eq("name", u.ens_name ?? "").gt("created_at", new Date(Date.now() - 6 * 3600_000).toISOString()).limit(1));
  if (recent.length) throw new HttpError(429, "Gas was topped up recently");
  return { hash: await fundEvmGas(r.manager as Address, u.ens_name ?? undefined) };
});
