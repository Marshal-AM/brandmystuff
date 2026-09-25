import { z } from "zod";
import { createHash } from "node:crypto";
import { verifyPersonalMessageSignature } from "@mysten/sui/verify";
import { handler, body } from "@/server/http";
import { HttpError, requireUser } from "@/server/auth";
import { db, ok } from "@/server/db";
import { sui } from "@/server/sui";

export const POST = handler(async (req) => {
  const u = await requireUser(req);
  const b = await body(req, z.object({ message: z.string().startsWith("brandmystuff:accept:"), signature: z.string(), role: z.enum(["owner", "investor"]), offeringId: z.string().optional(), units: z.number().int().optional() }));
  try {
    await verifyPersonalMessageSignature(new TextEncoder().encode(b.message), b.signature, { address: u.sui_address!, client: sui() as any });
  } catch {
    throw new HttpError(400, "Signature does not match your wallet");
  }
  const sigHash = createHash("sha256").update(b.signature).digest("hex");
  await ok(db().from("acceptances").insert({ offering_id: b.offeringId ?? null, signer: u.sui_address, role: b.role, message: b.message, signature: b.signature, sig_hash: sigHash, units: b.units ?? null }));
  return { sigHash };
});
