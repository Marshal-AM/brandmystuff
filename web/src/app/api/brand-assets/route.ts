import sharp from "sharp";
import { handler } from "@/server/http";
import { HttpError, requireUser } from "@/server/auth";
import { db, q, ok } from "@/server/db";
import { storeBlob } from "@/server/walrus";

export const GET = handler(async (req) => {
  const u = await requireUser(req);
  return { assets: await q(db().from("brand_assets").select("*").eq("user_id", u.id).order("created_at", { ascending: false })) };
});

export const POST = handler(async (req) => {
  const u = await requireUser(req);
  const f = await req.formData();
  const file = f.get("file");
  if (!(file instanceof File)) throw new HttpError(400, "file is required");
  if (!["image/png", "image/jpeg", "image/webp", "image/svg+xml"].includes(file.type)) throw new HttpError(400, "Use PNG, JPEG, WEBP or SVG");
  let buf = Buffer.from(await file.arrayBuffer());
  // Normalise to a high-resolution PNG so print files and AI checks get a raster
  const img = sharp(buf, { density: 600 });
  const meta = await img.metadata();
  if (file.type === "image/svg+xml" || (meta.width ?? 0) < 1000) buf = await sharp(buf, { density: 600 }).resize({ width: 3000, withoutEnlargement: file.type !== "image/svg+xml" }).png().toBuffer();
  else buf = await sharp(buf).png().toBuffer();
  const m2 = await sharp(buf).metadata();
  const s = await storeBlob(buf, "image/png");
  const row = await q(
    db()
      .from("brand_assets")
      .insert({ user_id: u.id, name: String(f.get("name") ?? file.name).slice(0, 80), blob_id: s.blobId, mime: "image/png", width: m2.width, height: m2.height, sha256: s.sha256 })
      .select("*")
      .single(),
  );
  return { asset: row };
});

export const DELETE = handler(async (req) => {
  const u = await requireUser(req);
  const id = new URL(req.url).searchParams.get("id");
  await ok(db().from("brand_assets").delete().eq("id", id!).eq("user_id", u.id));
  return { ok: true };
});
