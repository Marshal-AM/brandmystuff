import { z } from "zod";
import { handler, body } from "@/server/http";
import { HttpError, requireUser } from "@/server/auth";
import { db, q, ok } from "@/server/db";
import { readDraft } from "@/server/drafts";
import { ingestDigest } from "@/server/indexer";
import { categoryByKey } from "@/lib/categories";

export const POST = handler(async (req) => {
  const u = await requireUser(req);
  const b = await body(req, z.object({ digest: z.string(), draft: z.string() }));
  const d: any = await readDraft(b.draft);
  if (d.uid !== u.id) throw new HttpError(403, "Draft belongs to another user");
  const events = await ingestDigest(b.digest);
  const created = events.find((e) => e.type.endsWith("::ObjectCreated"))?.json;
  if (!created || created.owner !== u.sui_address || created.ens_name !== d.ensName) throw new HttpError(400, "Transaction did not create this object");
  await ok(db()
    .from("objects")
    .update({
      owner_user_id: u.id,
      category: d.category,
      category_code: categoryByKey(d.category).code,
      description: d.description || null,
      make: d.make || null,
      model: d.model || null,
      color: d.color || null,
      manifest_blob_id: d.manifestBlobId,
      hero_check: d.heroCheck,
    })
    .eq("id", created.object_id));
  return { object: await q(db().from("objects").select("*").eq("id", created.object_id).single()) };
});
