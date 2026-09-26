import { HttpError, requireUser } from "@/server/auth";
import { db, q } from "@/server/db";
import { handler } from "@/server/http";

const UUID = /^[0-9a-f-]{36}$/i;

/** The captured photograph, for the user who asked for the link. */
export const GET = handler(async (req, ctx: { params: Promise<{ id: string }> }) => {
  const u = await requireUser(req);
  const { id } = await ctx.params;
  if (!UUID.test(id)) throw new HttpError(404, "Photo link not found");
  const l = await q(db().from("capture_links").select("user_id, photo_b64, photo_mime").eq("id", id).maybeSingle());
  if (!l || l.user_id !== u.id) throw new HttpError(404, "Photo link not found");
  if (!l.photo_b64) throw new HttpError(404, "No photo has been taken with this link yet");
  return new Response(Buffer.from(l.photo_b64, "base64"), { headers: { "content-type": l.photo_mime ?? "image/jpeg", "cache-control": "private, no-store" } });
});
