import { handler } from "@/server/http";
import { HttpError } from "@/server/auth";
import { db, ok } from "@/server/db";
import { ACCEPTED_TYPES, MAX_ATTEMPTS, MAX_PHOTO_BYTES, PURPOSE_COPY, resolveToken } from "@/server/capture";

/**
 * The public side of a photo link. No sign-in: the token in the URL is the credential.
 * GET describes the link for the camera page; POST receives the photograph.
 */
export const GET = handler(async (_req, ctx: { params: Promise<{ token: string }> }) => {
  const { token } = await ctx.params;
  const link = await resolveToken(token);
  return { purpose: link.purpose, ...PURPOSE_COPY[link.purpose], expiresAt: link.expires_at, alreadyCaptured: !!link.captured_at, photoCount: 1 };
});

export const POST = handler(async (req, ctx: { params: Promise<{ token: string }> }) => {
  const { token } = await ctx.params;
  const link = await resolveToken(token);
  if (link.attempts >= MAX_ATTEMPTS) throw new HttpError(429, "Too many attempts on this link. Ask for a new one");
  const refuse = async (reason: string, status = 400) => {
    await ok(db().from("capture_links").update({ attempts: link.attempts + 1, last_reject_reason: reason }).eq("id", link.id));
    throw new HttpError(status, reason);
  };
  const f = await req.formData();
  const photo = f.get("photo");
  if (!(photo instanceof File) || photo.size === 0) return refuse("Take the photograph before sending");
  if (!ACCEPTED_TYPES.has(photo.type)) return refuse("Only photographs can be sent from this page");
  if (photo.size > MAX_PHOTO_BYTES) return refuse("That photo is too large. Try again", 413);
  const buf = Buffer.from(await photo.arrayBuffer());
  await ok(
    db()
      .from("capture_links")
      .update({ photo_b64: buf.toString("base64"), photo_mime: photo.type, captured_at: new Date().toISOString(), attempts: link.attempts + 1, last_reject_reason: null })
      .eq("id", link.id),
  );
  return { captured: true };
});
