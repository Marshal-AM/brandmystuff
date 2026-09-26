import { z } from "zod";
import { handler, body } from "@/server/http";
import { HttpError, requireUser } from "@/server/auth";
import { sui } from "@/server/sui";
import { attachMandate } from "@/server/agent/keys";

/**
 * After the brand signs create_mandate, link the new on-chain mandate to its agent.
 * Accepts the creation digest (the mandate id is read from its MandateCreated event) or an id.
 */
export const POST = handler(async (req) => {
  const u = await requireUser(req);
  const b = await body(req, z.object({ mandateId: z.string().regex(/^0x[0-9a-f]{64}$/i).optional(), digest: z.string().min(20).optional() }));
  let id = b.mandateId;
  if (!id && b.digest) {
    const t: any = await sui().getTransaction({ digest: b.digest, include: { events: true } } as any);
    const evs = (t.Transaction ?? t.transaction)?.events ?? [];
    const ev = evs.find((e: any) => String(e.eventType ?? e.type).endsWith("::mandate::MandateCreated"));
    id = ev?.json?.mandate_id ?? ev?.parsedJson?.mandate_id;
  }
  if (!id) throw new HttpError(400, "Couldn't find the new mandate in that transaction");
  return { mandate: await attachMandate(u.id, id) };
});
