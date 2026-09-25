/** Operator actions that finalise listings on-chain. */
import { Transaction } from "@mysten/sui/transactions";
import * as T from "@/lib/sui/tx";
import { db, q } from "./db";
import { objectScore } from "./scoring/pipeline";
import { execute } from "./sui";
import { processPending, ingestDigest } from "./indexer";

/** Writes the accepted analysis score for a space (idempotent). */
export async function applySpaceScore(spaceId: string) {
  const s = await q(db().from("spaces").select("id, status, object_id").eq("id", spaceId).maybeSingle());
  if (!s || s.status !== "scoring") return null;
  const a = await q(
    db().from("space_analyses").select("*").eq("space_id", spaceId).eq("decision", "ACCEPTED").order("created_at", { ascending: false }).limit(1).maybeSingle(),
  );
  if (!a) throw new Error(`no accepted analysis for space ${spaceId}`);
  const r: any = a.result;
  const tx = new Transaction();
  T.applyScore(tx, {
    spaceId,
    aqs: r.aqs,
    grade: r.grade,
    confidenceBps: Math.round(r.confidence * 10000),
    rankX100: Math.round(r.rankScore * 100),
    rubric: r.rubricVersion,
    reportBlobId: a.report_blob_id,
    reportHash: a.report_hash,
  });
  const res = await execute(tx);
  await ingestDigest(res.digest);
  await refreshObjectScore(s.object_id);
  return res.digest;
}

export async function refreshObjectScore(objectId: string) {
  const spaces = await q(db().from("spaces").select("aqs, width_mm, height_mm").eq("object_id", objectId).in("status", ["available", "paused"]));
  const o = await q(db().from("objects").select("object_aqs, object_grade").eq("id", objectId).single());
  const sc = objectScore(spaces as any);
  if (sc.aqs === o.object_aqs && sc.grade === o.object_grade) return;
  const tx = new Transaction();
  T.setObjectScore(tx, { objectId, aqs: sc.aqs, grade: sc.grade });
  const res = await execute(tx);
  await ingestDigest(res.digest);
}

export { processPending };
