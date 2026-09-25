import { handler } from "@/server/http";
import { HttpError, requireUser } from "@/server/auth";
import { submitProof } from "@/server/proofs";

export const POST = handler(async (req) => {
  const u = await requireUser(req);
  const f = await req.formData();
  const image = f.get("image");
  if (!(image instanceof File)) throw new HttpError(400, "image is required");
  return submitProof({
    user: u,
    escrowId: String(f.get("escrowId")),
    captureCode: String(f.get("captureCode") ?? "").toUpperCase(),
    image: Buffer.from(await image.arrayBuffer()),
    mime: image.type || "image/jpeg",
  });
});
