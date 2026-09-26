import { namehash, normalize } from "viem/ens";
import { handler } from "@/server/http";
import { HttpError, requireUser } from "@/server/auth";
import { db, q } from "@/server/db";
import { analyzeSpace } from "@/server/scoring/pipeline";
import { readBlob, sha256Hex, storeBlob, storeJson } from "@/server/walrus";
import { PLACEMENTS, type Placement } from "@/lib/categories";
import { demoSpace, isDemo } from "@/server/demo";

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 32);

export const POST = handler(async (req) => {
  const u = await requireUser(req);
  const f = await req.formData();
  const objectId = String(f.get("objectId") ?? "");
  const o = await q(db().from("objects").select("*").eq("id", objectId).maybeSingle());
  if (!o) throw new HttpError(404, "Object not found");
  if (o.owner_address !== u.sui_address) throw new HttpError(403, "Not your object");
  const image = f.get("image");
  if (!(image instanceof File)) throw new HttpError(400, "image is required");
  const label = slug(String(f.get("label") ?? ""));
  if (label.length < 2) throw new HttpError(400, "Name the space (2+ characters)");
  const widthMm = Math.round(Number(f.get("widthCm")) * 10), heightMm = Math.round(Number(f.get("heightCm")) * 10);
  if (!(widthMm > 0 && heightMm > 0)) throw new HttpError(400, "Enter the space size");
  const placement = String(f.get("placement") ?? "other") as Placement;
  if (!PLACEMENTS.includes(placement)) throw new HttpError(400, "Invalid placement");
  const ensName = normalize(`${label}.${o.ens_name}`);
  const exists = await q(db().from("spaces").select("id").eq("ens_name", ensName).maybeSingle());
  if (exists) throw new HttpError(409, `This object already has a space called "${label}"`);
  const { count } = await db().from("spaces").select("*", { count: "exact", head: true }).eq("object_id", objectId);
  if ((count ?? 0) >= 20) throw new HttpError(400, "An object can have at most 20 spaces");

  const closeup = Buffer.from(await image.arrayBuffer());
  const hero = await readBlob(o.hero_blob_id);
  const input = {
    label,
    widthMm,
    heightMm,
    placement,
    material: String(f.get("material") ?? "other"),
    objectName: o.title,
    objectDescription: o.description ?? "",
    profile: {
      objectType: o.object_type ?? o.category ?? "object",
      exposureClass: (o.exposure_class ?? "other") as any,
      viewerMode: (o.viewer_mode ?? "static") as any,
      viewingDistanceM: Number(o.viewing_distance_m ?? 5),
      prohibitedZones: o.prohibited_zones ?? [],
      tags: o.tags ?? [],
    },
    captureSource: (String(f.get("captureSource") ?? "upload") === "camera" ? "camera" : "upload") as "camera" | "upload",
  };
  const result: Awaited<ReturnType<typeof analyzeSpace>> = isDemo(f.get("demo"))
    ? ((await demoSpace(closeup, widthMm, heightMm, input.profile.viewingDistanceM, label)) as any)
    : await analyzeSpace({
    hero,
    heroMime: "image/jpeg",
    closeup,
    closeupMime: image.type || "image/jpeg",
    input,
    heroProvenance: o.hero_check?.provenance ?? 0.5,
    userId: u.id,
  });
  const stored = await storeBlob(closeup, image.type || "image/jpeg");
  const report = await storeJson({ space: ensName, object: objectId, input, result, createdAt: new Date().toISOString() });
  const row = await q(
    db()
      .from("space_analyses")
      .insert({
        user_id: u.id,
        object_id: objectId,
        input,
        closeup_blob_id: stored.blobId,
        decision: result.decision,
        reject_reason: result.reason ?? null,
        gate: result.gate ?? null,
        result: result as any,
        report_blob_id: report.blobId,
        report_hash: sha256Hex(Buffer.from(JSON.stringify(result))),
      })
      .select("id")
      .single(),
  );
  return {
    analysisId: row.id,
    result,
    tx: result.decision === "ACCEPTED" ? { objectId, label, ensName, ensNamehash: namehash(ensName), widthMm, heightMm, placement: PLACEMENTS.indexOf(placement), closeupBlobId: stored.blobId } : null,
  };
});
