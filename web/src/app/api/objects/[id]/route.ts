import { handler } from "@/server/http";
import { HttpError } from "@/server/auth";
import { db, q } from "@/server/db";

export const GET = handler(async (_req, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const o = await q(db().from("objects").select("*, owner:owner_user_id(handle, ens_name, display_name, avatar_blob_id)").eq("id", id).maybeSingle());
  if (!o) throw new HttpError(404, "Object not found");
  const spaces = await q(db().from("spaces").select("*").eq("object_id", id).neq("status", "removed").order("rank_score", { ascending: false }));
  return { object: o, spaces };
});
