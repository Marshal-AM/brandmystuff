import { z } from "zod";
import { handler, body } from "@/server/http";
import { requireUser } from "@/server/auth";
import { db, q } from "@/server/db";

export const GET = handler(async (req) => {
  const u = await requireUser(req);
  return { notifications: await q(db().from("notifications").select("*").eq("user_id", u.id).order("created_at", { ascending: false }).limit(50)) };
});

export const POST = handler(async (req) => {
  const u = await requireUser(req);
  const b = await body(req, z.object({ ids: z.array(z.string()).optional(), all: z.boolean().optional() }));
  let qy = db().from("notifications").update({ read: true }).eq("user_id", u.id);
  if (!b.all) qy = qy.in("id", b.ids ?? []);
  await qy;
  return { ok: true };
});
