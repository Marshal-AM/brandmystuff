import { z } from "zod";
import { handler, body } from "@/server/http";
import { ingestDigest } from "@/server/indexer";

export const POST = handler(async (req) => {
  const b = await body(req, z.object({ digest: z.string().min(20) }));
  const events = await ingestDigest(b.digest);
  return { events: events.map((e) => ({ type: e.type.split("::").slice(1).join("::"), json: e.json })) };
});
