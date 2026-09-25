import { z } from "zod";
import { handler, body } from "@/server/http";
import { HttpError, requireUser } from "@/server/auth";
import { db, q, ok } from "@/server/db";
import { ingestDigest } from "@/server/indexer";
import { applySpaceScore } from "@/server/listing";

export const POST = handler(async (req) => {
  const u = await requireUser(req);
  const b = await body(req, z.object({ analysisId: z.string().uuid(), digest: z.string() }));
  const a = await q(db().from("space_analyses").select("*").eq("id", b.analysisId).single());
  if (a.user_id !== u.id) throw new HttpError(403, "Not your analysis");
  if (a.decision !== "ACCEPTED") throw new HttpError(400, "Only accepted spaces can be listed");
  const events = await ingestDigest(b.digest);
  const added = events.find((e) => e.type.endsWith("::SpaceAdded"))?.json;
  if (!added || added.closeup_blob_id !== a.closeup_blob_id || added.object_id !== a.object_id) throw new HttpError(400, "Transaction does not match this analysis");
  await ok(db().from("space_analyses").update({ space_id: added.space_id }).eq("id", a.id));
  await applySpaceScore(added.space_id);
  return { space: await q(db().from("spaces").select("*").eq("id", added.space_id).single()) };
});
