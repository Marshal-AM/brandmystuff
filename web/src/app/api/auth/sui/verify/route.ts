import { z } from "zod";
import { verifyPersonalMessageSignature } from "@mysten/sui/verify";
import { handler, body, json } from "@/server/http";
import { HttpError, issueSession } from "@/server/auth";
import { db, q, ok } from "@/server/db";
import { sui } from "@/server/sui";

export const POST = handler(async (req) => {
  const b = await body(req, z.object({ address: z.string(), message: z.string(), signature: z.string() }));
  const nonce = b.message.match(/Nonce: ([0-9a-f]+)/)?.[1];
  const row = nonce ? await q(db().from("auth_nonces").select("*").eq("nonce", nonce).maybeSingle()) : null;
  if (!row || row.address !== b.address || new Date(row.expires_at).getTime() < Date.now()) throw new HttpError(401, "Nonce expired");
  try {
    await verifyPersonalMessageSignature(new TextEncoder().encode(b.message), b.signature, { address: b.address, client: sui() as any });
  } catch {
    throw new HttpError(401, "Invalid signature");
  }
  await ok(db().from("auth_nonces").delete().eq("nonce", nonce!));
  let user = await q(db().from("users").select("*").eq("sui_address", b.address).maybeSingle());
  if (!user) user = await q(db().from("users").insert({ sui_address: b.address, wallet_kind: "external" }).select("*").single());
  await ok(db().from("linked_wallets").upsert({ address: b.address, user_id: user.id, kind: "external" }));
  const token = await issueSession(user.id, b.address);
  return json({ token, user }, { headers: { "set-cookie": `bms_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800` } });
});
