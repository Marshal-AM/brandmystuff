import { createHash, randomBytes } from "node:crypto";
import { HttpError } from "./auth";
import { db, q } from "./db";

/** How long a photo link stays open, so the photo is always fresh. */
export const CAPTURE_LINK_MINUTES = 60;
export const MAX_PHOTO_BYTES = 8 * 1024 * 1024;
export const MAX_ATTEMPTS = 20;
export const ACCEPTED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
export const PURPOSES = ["hero", "space", "proof", "kyc"] as const;
export type CapturePurpose = (typeof PURPOSES)[number];

/** What the camera page tells whoever is holding the phone. */
export const PURPOSE_COPY: Record<CapturePurpose, { title: string; steps: string[] }> = {
  hero: { title: "Photo of the whole object", steps: ["Step back until the whole object fits in the frame.", "Find good, even light and avoid strong glare.", "Take the photo and send it."] },
  space: { title: "Close-up of the ad space", steps: ["Frame just this section of the object.", "Place an ID card beside it for scale if you can.", "Take the photo and send it."] },
  proof: { title: "Proof of display", steps: ["Show the installed ad on the space.", "Keep your capture-code note in frame.", "Take the photo and send it."] },
  kyc: { title: "ID document", steps: ["Lay your passport, national ID or driving licence flat.", "Make sure all four corners and the text are sharp.", "Take the photo and send it."] },
};

export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");
export const newToken = () => randomBytes(24).toString("base64url");

/** Finds the live link behind a token, or explains why it can't be used. */
export async function resolveToken(token: string) {
  if (!token || token.length < 20) throw new HttpError(404, "This photo link is not valid");
  const link = await q(db().from("capture_links").select("id, user_id, purpose, expires_at, revoked_at, captured_at, attempts").eq("token_hash", hashToken(token)).maybeSingle());
  if (!link) throw new HttpError(404, "This photo link is not valid");
  if (link.revoked_at) throw new HttpError(410, "This link has been replaced by a newer one. Ask for a fresh link");
  if (new Date(link.expires_at).getTime() < Date.now()) throw new HttpError(410, `This link has expired. Links last ${CAPTURE_LINK_MINUTES} minutes, so ask for a new one`);
  return link as { id: string; user_id: string; purpose: CapturePurpose; expires_at: string; revoked_at: string | null; captured_at: string | null; attempts: number };
}

/** A link the signed-in user owns, looked up by id. */
export async function ownLink(id: string, userId: string) {
  const link = await q(db().from("capture_links").select("id, user_id, purpose, expires_at, revoked_at, captured_at, attempts, last_reject_reason, photo_mime").eq("id", id).maybeSingle());
  if (!link || link.user_id !== userId) throw new HttpError(404, "Photo link not found");
  return link;
}

/**
 * True only when `image` is byte-for-byte the photo taken through one of this user's
 * camera links, i.e. it came from the live camera and not from a gallery or another site.
 */
export async function fromOwnCameraLink(linkId: string, userId: string, image: Buffer) {
  if (!/^[0-9a-f-]{36}$/i.test(linkId)) return false;
  const l = await q(db().from("capture_links").select("user_id, photo_b64").eq("id", linkId).maybeSingle());
  if (!l || l.user_id !== userId || !l.photo_b64) return false;
  return Buffer.from(l.photo_b64, "base64").equals(image);
}
