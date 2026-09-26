import { handler } from "@/server/http";
import { HttpError, requireUser } from "@/server/auth";
import { db, q } from "@/server/db";

export const GET = handler(async (req, ctx: { params: Promise<{ id: string }> }) => {
  const u = await requireUser(req);
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new HttpError(404, "Run not found");
  const r = await q(db().from("agent_runs").select("*").eq("id", id).eq("user_id", u.id).maybeSingle());
  if (!r) throw new HttpError(404, "Run not found");
  return { run: r };
});
