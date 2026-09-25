import { z } from "zod";
import { handler } from "@/server/http";
import { x402Handle } from "@/server/x402route";
import { createLeaseIntent } from "@/server/x402flows";

const schema = z.object({
  spaceId: z.string().optional(),
  ensName: z.string().optional(),
  weeks: z.number().int().min(1).max(52),
  startWeek: z.number().int().optional(),
  creativeUrl: z.string().url(),
  landingUrl: z.string().url(),
  brand: z.string().min(1).max(60),
});

export const POST = handler(async (req) => {
  const raw = await req.clone().json().catch(() => ({}));
  return x402Handle(req, async () => createLeaseIntent(schema.parse(raw)), "Lease a brandmystuff ad space (USDC escrow on Sui)");
});
