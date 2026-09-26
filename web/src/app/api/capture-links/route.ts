import { z } from "zod";
import { handler, body } from "@/server/http";
import { requireUser } from "@/server/auth";
import { db, ok, q } from "@/server/db";
import { CAPTURE_LINK_MINUTES, PURPOSES, hashToken, newToken } from "@/server/capture";

/** Creates a photo link for the signed-in user. The raw token is returned only here, once. */
export const POST = handler(async (req) => {
  const u = await requireUser(req);
  const b = await body(req, z.object({ purpose: z.enum(PURPOSES) }));
  // One live link per purpose: a new one replaces the last.
  await ok(db().from("capture_links").update({ revoked_at: new Date().toISOString() }).eq("user_id", u.id).eq("purpose", b.purpose).is("revoked_at", null));
  const token = newToken();
  const expiresAt = new Date(Date.now() + CAPTURE_LINK_MINUTES * 60_000).toISOString();
  const row = await q(db().from("capture_links").insert({ user_id: u.id, purpose: b.purpose, token_hash: hashToken(token), expires_at: expiresAt }).select("id").single());
  return { id: row.id, token, expiresAt };
});
