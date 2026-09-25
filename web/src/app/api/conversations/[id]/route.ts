import { randomUUID } from "node:crypto";
import { handler } from "@/server/http";
import { HttpError, requireUser, type AppUser } from "@/server/auth";
import { db, q, ok } from "@/server/db";
import { notify } from "@/server/notify";
import { signAttachments } from "@/server/chat";

async function member(u: AppUser, id: string) {
  const c = await q(db().from("conversations").select("*, spaces(label, ens_name, closeup_blob_id)").eq("id", id).maybeSingle());
  if (!c) throw new HttpError(404, "Conversation not found");
  if (c.advertiser_user_id !== u.id && c.owner_user_id !== u.id && !u.is_admin) throw new HttpError(403, "Not a participant");
  return c;
}

export const GET = handler(async (req, ctx: { params: Promise<{ id: string }> }) => {
  const u = await requireUser(req);
  const { id } = await ctx.params;
  const c = await member(u, id);
  const msgs = await q(db().from("messages").select("*").eq("conversation_id", id).eq("removed", false).order("created_at").limit(500));
  await ok(db().from("messages").update({ read_at: new Date().toISOString() }).eq("conversation_id", id).neq("sender_user_id", u.id).is("read_at", null));
  const people = await q(db().from("users").select("id, handle, display_name, brand_name, avatar_blob_id, ens_name").in("id", [c.advertiser_user_id, c.owner_user_id]));
  return { conversation: c, people, messages: await signAttachments(msgs), me: u.id };
});

export const POST = handler(async (req, ctx: { params: Promise<{ id: string }> }) => {
  const u = await requireUser(req);
  const { id } = await ctx.params;
  const c = await member(u, id);
  const f = await req.formData();
  const text = String(f.get("body") ?? "").trim().slice(0, 4000);
  const files = f.getAll("files").filter((x): x is File => x instanceof File && x.size > 0);
  if (!text && !files.length) throw new HttpError(400, "Empty message");
  const attachments = [];
  for (const file of files.slice(0, 5)) {
    if (file.size > 25 * 1024 * 1024) throw new HttpError(400, "Attachments are limited to 25 MB");
    if (!/^(image\/|video\/|application\/pdf)/.test(file.type)) throw new HttpError(400, "Images, PDFs and short videos only");
    const path = `${id}/${randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const { error } = await db().storage.from("chat-media").upload(path, Buffer.from(await file.arrayBuffer()), { contentType: file.type });
    if (error) throw new HttpError(500, `upload failed: ${error.message}`);
    attachments.push({ path, name: file.name, mime: file.type, size: file.size });
  }
  const msg = await q(db().from("messages").insert({ conversation_id: id, sender_user_id: u.id, body: text || null, attachments }).select("*").single());
  await ok(db().from("conversations").update({ last_message_at: new Date().toISOString() }).eq("id", id));
  const other = c.advertiser_user_id === u.id ? c.owner_user_id : c.advertiser_user_id;
  await notify(other, { kind: "message", title: `New message about ${(c as any).spaces.label}`, body: text.slice(0, 120) || `${attachments.length} attachment(s)`, link: `/messages/${id}` });
  return { message: (await signAttachments([msg]))[0] };
});

export const PATCH = handler(async (req, ctx: { params: Promise<{ id: string }> }) => {
  const u = await requireUser(req);
  const { id } = await ctx.params;
  await member(u, id);
  const { messageId } = await req.json();
  await ok(db().from("messages").update({ reported: true }).eq("id", messageId).eq("conversation_id", id));
  await ok(db().from("reports").insert({ kind: "message", target_id: messageId, reporter_user_id: u.id, reason: "reported from chat" }));
  return { ok: true };
});
