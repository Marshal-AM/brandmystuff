/** Walrus testnet storage via the public HTTP publisher/aggregator. */
import { createHash } from "node:crypto";
import { WALRUS } from "@/lib/deployment";

export type Stored = { blobId: string; sha256: string; size: number };

export async function storeBlob(data: Uint8Array | Buffer, contentType = "application/octet-stream"): Promise<Stored> {
  const buf = Buffer.from(data);
  let lastErr: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(`${WALRUS.publisher}/v1/blobs?epochs=${WALRUS.epochs}`, {
        method: "PUT",
        body: buf,
        headers: { "content-type": contentType },
      });
      if (!res.ok) throw new Error(`walrus ${res.status}: ${await res.text()}`);
      const j: any = await res.json();
      const blobId = j.newlyCreated?.blobObject?.blobId ?? j.alreadyCertified?.blobId;
      if (!blobId) throw new Error(`walrus: unexpected response ${JSON.stringify(j).slice(0, 200)}`);
      return { blobId, sha256: createHash("sha256").update(buf).digest("hex"), size: buf.length };
    } catch (e) {
      lastErr = e;
      await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
    }
  }
  throw lastErr;
}

export async function storeJson(obj: unknown) {
  return storeBlob(Buffer.from(JSON.stringify(obj)), "application/json");
}

export async function readBlob(blobId: string): Promise<Buffer> {
  const res = await fetch(`${WALRUS.aggregator}/v1/blobs/${blobId}`);
  if (!res.ok) throw new Error(`walrus read ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

export const sha256Hex = (b: Uint8Array | Buffer | string) => createHash("sha256").update(b).digest("hex");
