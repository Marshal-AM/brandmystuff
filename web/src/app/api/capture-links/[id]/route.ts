import { handler } from "@/server/http";
import { HttpError, requireUser } from "@/server/auth";
import { ownLink } from "@/server/capture";

const UUID = /^[0-9a-f-]{36}$/i;

/** Status of one of the user's photo links; the originating page polls this. */
export const GET = handler(async (req, ctx: { params: Promise<{ id: string }> }) => {
  const u = await requireUser(req);
  const { id } = await ctx.params;
  if (!UUID.test(id)) throw new HttpError(404, "Photo link not found");
  const l = await ownLink(id, u.id);
  return {
    link: {
      id: l.id,
      purpose: l.purpose,
      expiresAt: l.expires_at,
      expired: new Date(l.expires_at).getTime() < Date.now(),
      revoked: !!l.revoked_at,
      captured: !!l.captured_at,
      capturedAt: l.captured_at,
      attempts: l.attempts,
      lastRejectReason: l.last_reject_reason,
    },
  };
});
