import { handler } from "@/server/http";
import { HttpError, requireUser } from "@/server/auth";
import { storeBlob } from "@/server/walrus";

const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/svg+xml", "application/pdf"];
export const POST = handler(async (req) => {
  await requireUser(req);
  const form = await req.formData();
  const f = form.get("file");
  if (!(f instanceof File)) throw new HttpError(400, "file is required");
  if (!ALLOWED.includes(f.type)) throw new HttpError(400, `Unsupported type ${f.type}`);
  if (f.size > 10 * 1024 * 1024) throw new HttpError(400, "Max 10 MB");
  const s = await storeBlob(Buffer.from(await f.arrayBuffer()), f.type);
  return { blobId: s.blobId, sha256: s.sha256, size: s.size, mime: f.type };
});
