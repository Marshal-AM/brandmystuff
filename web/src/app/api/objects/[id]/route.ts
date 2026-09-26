import { handler } from "@/server/http";
import { HttpError } from "@/server/auth";
import { db, q } from "@/server/db";

export const GET = handler(async (_req, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const o = await q(db().from("objects").select("*, owner:owner_user_id(handle, ens_name, display_name, avatar_blob_id)").eq("id", id).maybeSingle());
  if (!o) throw new HttpError(404, "Object not found");
  const spaces = await q(db().from("spaces").select("*").eq("object_id", id).neq("status", "removed").order("rank_score", { ascending: false }));
  const names = [o.ens_name, ...spaces.map((x: any) => x.ens_name)].filter(Boolean);
  const rows = names.length ? await q(db().from("ens_names").select("name, status").in("name", names)) : [];
  const ensStatus = Object.fromEntries(names.map((n: string) => [n, rows.find((r: any) => r.name === n)?.status ?? "pending"]));
  return { object: o, spaces, ensStatus };
});
