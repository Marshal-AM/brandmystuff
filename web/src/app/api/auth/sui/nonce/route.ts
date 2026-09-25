import { randomBytes } from "node:crypto";
import { handler } from "@/server/http";
import { db, ok } from "@/server/db";

export const GET = handler(async (req) => {
  const address = new URL(req.url).searchParams.get("address") ?? "";
  if (!/^0x[0-9a-f]{64}$/.test(address)) return new Response(JSON.stringify({ error: "invalid address" }), { status: 400 });
  const nonce = randomBytes(16).toString("hex");
  await ok(db().from("auth_nonces").insert({ nonce, address, expires_at: new Date(Date.now() + 10 * 60_000).toISOString() }));
  return { nonce, message: `Sign in to brandmystuff\nAddress: ${address}\nNonce: ${nonce}` };
});
