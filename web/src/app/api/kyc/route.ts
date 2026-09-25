import { z } from "zod";
import { createHash } from "node:crypto";
import { handler } from "@/server/http";
import { HttpError, requireUser } from "@/server/auth";
import { db, q, ok } from "@/server/db";
import { execute } from "@/server/sui";
import { ingestDigest } from "@/server/indexer";
import * as T from "@/lib/sui/tx";

const TYPES = { accredited: 1, non_us: 2, retail: 3 } as const;
const schema = z.object({
  legalName: z.string().min(3).max(120),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  country: z.string().length(2),
  addressLine: z.string().min(5).max(300),
  investorType: z.enum(["accredited", "non_us", "retail"]),
  attestations: z.array(z.string()).min(2),
});

export const GET = handler(async (req) => {
  const u = await requireUser(req);
  return { submission: await q(db().from("kyc_submissions").select("status, investor_type, country, expires_at, created_at").eq("user_id", u.id).order("created_at", { ascending: false }).limit(1).maybeSingle()) };
});

export const POST = handler(async (req) => {
  const u = await requireUser(req);
  if (!u.sui_address) throw new HttpError(400, "No Sui wallet");
  const f = await req.formData();
  const b = schema.parse({
    legalName: f.get("legalName"),
    dateOfBirth: f.get("dateOfBirth"),
    country: String(f.get("country") ?? "").toUpperCase(),
    addressLine: f.get("addressLine"),
    investorType: f.get("investorType"),
    attestations: f.getAll("attestations").map(String),
  });
  const age = (Date.now() - new Date(b.dateOfBirth).getTime()) / (365.25 * 86400_000);
  if (age < 18) throw new HttpError(400, "You must be 18 or older");
  const doc = f.get("idDocument");
  if (!(doc instanceof File) || doc.size < 10_000) throw new HttpError(400, "Upload a clear photo of your ID document");
  if (!/^(image\/|application\/pdf)/.test(doc.type)) throw new HttpError(400, "ID must be an image or PDF");
  // Mock verification: the document is checked for type/size only and discarded (never stored).
  await new Promise((r) => setTimeout(r, 1500));
  const expires = new Date(Date.now() + 365 * 86400_000);
  const sub = await q(
    db()
      .from("kyc_submissions")
      .insert({
        user_id: u.id,
        address: u.sui_address,
        legal_name: b.legalName,
        date_of_birth: b.dateOfBirth,
        country: b.country,
        address_line: b.addressLine,
        investor_type: b.investorType,
        attestations: b.attestations,
        id_document_meta: { name: doc.name, type: doc.type, size: doc.size, discarded: true },
        status: "approved",
        expires_at: expires.toISOString(),
      })
      .select("id")
      .single(),
  );
  const ref = createHash("sha256").update(`mock:${sub.id}`).digest("hex");
  const r = await execute(T.setKycRecord({ who: u.sui_address, investorType: TYPES[b.investorType], country: b.country, expiresMs: BigInt(expires.getTime()), refHash: ref }));
  await ok(db().from("kyc_submissions").update({ digest: r.digest }).eq("id", sub.id));
  await ingestDigest(r.digest);
  return { status: "approved", digest: r.digest, expiresAt: expires.toISOString(), provider: "mock (Sumsub/Persona coming soon)" };
});
