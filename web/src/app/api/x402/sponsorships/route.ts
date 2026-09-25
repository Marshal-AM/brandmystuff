import { z } from "zod";
import { handler } from "@/server/http";
import { x402Handle } from "@/server/x402route";
import { createSponsorIntent } from "@/server/x402flows";

const schema = z.object({ objectId: z.string().optional(), ensName: z.string().optional(), tier: z.union([z.literal(1), z.literal(2)]), days: z.number().int().min(1).max(90) });

export const POST = handler(async (req) => {
  const raw = await req.clone().json().catch(() => ({}));
  return x402Handle(req, async () => createSponsorIntent(schema.parse(raw)), "Sponsor a brandmystuff object listing");
});
