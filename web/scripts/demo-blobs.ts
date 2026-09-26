/**
 * Uploads the demo-submit sample images (and a generic manifest / score report) to Walrus once and
 * records their blob ids, so a demo submission never waits on Walrus.
 * Run again whenever web/public/demo changes: npx tsx scripts/demo-blobs.ts
 */
import { config } from "dotenv";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
config({ path: resolve(__dirname, "../../.env.local") });

(async () => {
  const { storeBlob, storeJson, sha256Hex } = await import("../src/server/walrus");
  const out: { images: Record<string, { file: string; blobId: string }>; manifestBlobId: string; reportBlobId: string } = { images: {}, manifestBlobId: "", reportBlobId: "" };
  for (const f of ["hero.jpg", "space.jpg", "proof.jpg"]) {
    const buf = readFileSync(resolve(__dirname, "../public/demo", f));
    const r = await storeBlob(buf, "image/jpeg");
    out.images[sha256Hex(buf)] = { file: f, blobId: r.blobId };
    console.log(f, r.blobId);
  }
  out.manifestBlobId = (await storeJson({ demo: true, note: "brandmystuff demo-submit object manifest" })).blobId;
  out.reportBlobId = (await storeJson({ demo: true, note: "brandmystuff demo-submit score report" })).blobId;
  writeFileSync(resolve(__dirname, "../src/server/demo-blobs.json"), JSON.stringify(out, null, 2) + "\n");
  console.log("manifest", out.manifestBlobId, "report", out.reportBlobId);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
