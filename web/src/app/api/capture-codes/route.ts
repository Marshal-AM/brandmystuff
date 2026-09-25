import { z } from "zod";
import { randomInt } from "node:crypto";
import { handler, body } from "@/server/http";
import { requireUser } from "@/server/auth";
import { db, ok } from "@/server/db";

const ALPHA = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const POST = handler(async (req) => {
  const u = await requireUser(req);
  const b = await body(req, z.object({ purpose: z.enum(["hero", "space", "proof"]) }));
  const code = Array.from({ length: 4 }, () => ALPHA[randomInt(ALPHA.length)]).join("");
  await ok(db().from("capture_codes").insert({ code, user_id: u.id, purpose: b.purpose, expires_at: new Date(Date.now() + 30 * 60_000).toISOString() }));
  return { code, expiresInMin: 30 };
});
