import { z } from "zod";
import { namehash, normalize } from "viem/ens";
import { handler, body } from "@/server/http";
import { HttpError, requireUser } from "@/server/auth";
import { db, q } from "@/server/db";
import { enqueue } from "@/server/notify";

const RESERVED = new Set(["www", "app", "api", "agent", "admin", "sponsored", "lease"]);
const schema = z.object({
  handle: z.string().regex(/^[a-z0-9-]{3,32}$/, "3–32 lowercase letters, digits or dashes").optional(),
  displayName: z.string().max(60).optional(),
  bio: z.string().max(280).optional(),
  twitter: z.string().max(40).optional(),
  website: z.string().url().max(200).optional().or(z.literal("")),
  brandName: z.string().max(60).optional(),
  avatarBlobId: z.string().optional(),
});

export const POST = handler(async (req) => {
  const u = await requireUser(req);
  const b = await body(req, schema);
  const patch: Record<string, unknown> = {
    display_name: b.displayName ?? undefined,
    bio: b.bio ?? undefined,
    twitter: b.twitter ?? undefined,
    website: b.website || undefined,
    brand_name: b.brandName ?? undefined,
    avatar_blob_id: b.avatarBlobId ?? undefined,
  };
  let ensName = u.ens_name;
  if (b.handle && !u.handle) {
    if (RESERVED.has(b.handle) || b.handle.startsWith("l-")) throw new HttpError(400, "That handle is reserved");
    const taken = await q(db().from("users").select("id").eq("handle", b.handle).maybeSingle());
    if (taken) throw new HttpError(409, "Handle already taken");
    ensName = normalize(`${b.handle}.brandmystuff.eth`);
    patch.handle = b.handle;
    patch.ens_name = ensName;
  }
  const row = await q(db().from("users").update(patch).eq("id", u.id).select("*").single());
  if (row.ens_status === "registered") await enqueue("ens_account", { userId: u.id }, { dedupe: `ens_account:${u.id}:${Date.now()}` });
  return { user: row, ensName, ensNamehash: ensName ? namehash(ensName) : null, needsProfileTx: !row.profile_id };
});
