import { z } from "zod";
import { handler, body } from "@/server/http";
import { HttpError, requireUser } from "@/server/auth";
import { db, q } from "@/server/db";

export const GET = handler(async (req) => {
  const u = await requireUser(req);
  const convs = await q(
    db()
      .from("conversations")
      .select("*, spaces(label, ens_name, closeup_blob_id), adv:advertiser_user_id(id, handle, display_name, brand_name, avatar_blob_id), own:owner_user_id(id, handle, display_name, avatar_blob_id)")
      .or(`advertiser_user_id.eq.${u.id},owner_user_id.eq.${u.id}`)
      .order("last_message_at", { ascending: false }),
  );
  const ids = convs.map((c: any) => c.id);
  const unread = ids.length ? await q(db().from("messages").select("conversation_id").in("conversation_id", ids).neq("sender_user_id", u.id).is("read_at", null)) : [];
  return { conversations: convs.map((c: any) => ({ ...c, unread: unread.filter((m: any) => m.conversation_id === c.id).length })) };
});

export const POST = handler(async (req) => {
  const u = await requireUser(req);
  const b = await body(req, z.object({ spaceId: z.string() }));
  const s = await q(db().from("spaces").select("owner_address").eq("id", b.spaceId).single());
  const owner = await q(db().from("users").select("id").eq("sui_address", s.owner_address).maybeSingle());
  if (!owner) throw new HttpError(404, "Owner not found");
  if (owner.id === u.id) throw new HttpError(400, "This is your own space");
  const existing = await q(db().from("conversations").select("id").eq("space_id", b.spaceId).eq("advertiser_user_id", u.id).maybeSingle());
  if (existing) return { id: existing.id };
  const row = await q(db().from("conversations").insert({ space_id: b.spaceId, advertiser_user_id: u.id, owner_user_id: owner.id }).select("id").single());
  return { id: row.id };
});
