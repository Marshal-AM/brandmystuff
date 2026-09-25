/** Proof-of-display: AI verification of owner check-in photos and on-chain tranche release. */
import * as T from "@/lib/sui/tx";
import { HttpError, type AppUser } from "./auth";
import { db, q, ok } from "./db";
import { generateJson } from "./gemini";
import { ingestDigest } from "./indexer";
import { hamming, phash } from "./scoring/metrics";
import { PROOF_SCHEMA, PROOF_SYSTEM } from "./scoring/prompts";
import { execute } from "./sui";
import { readBlob, storeBlob } from "./walrus";

type ProofA = {
  observations: string;
  creative_visible: boolean;
  match_score_bps: number;
  object_match_bps: number;
  nonce_text: string;
  visible_text: { text: string; instruction_like: boolean }[];
  synthetic_suspicion: string;
  reason_if_rejected: string;
};

const norm = (s: string) => s.replace(/[^a-z0-9]/gi, "").toUpperCase();

export function periodWindow(l: { start_ms: any; week_ms: any; weeks: number }, period: number) {
  const start = Number(l.start_ms), week = Number(l.week_ms), cure = Math.floor((week * 3) / 7);
  if (period === 0) return { open: 0, close: start + week };
  return { open: start + (period - 1) * week, close: start + period * week + cure };
}

/** Next period the owner should prove (or null when nothing is due). */
export async function nextPeriod(escrowId: string) {
  const l = await q(db().from("leases").select("*").eq("escrow_id", escrowId).single());
  const done = new Set((await q(db().from("tranches").select("period").eq("escrow_id", escrowId))).map((t: any) => t.period));
  const now = Date.now();
  for (let k = 0; k <= l.weeks; k++) {
    if (done.has(k)) continue;
    const w = periodWindow(l, k);
    if (k === 0 && l.status !== "awaiting_install") continue;
    if (k > 0 && l.status !== "live") return null;
    if (now >= w.open && now < w.close) return { period: k, ...w };
    if (now < w.open) return { period: k, ...w, upcoming: true };
  }
  return null;
}

export async function submitProof(p: { user: AppUser; escrowId: string; image: Buffer; mime: string; captureCode: string }) {
  const l = await q(db().from("leases").select("*, spaces(closeup_blob_id, offering_id, id)").eq("escrow_id", p.escrowId).maybeSingle());
  if (!l) throw new HttpError(404, "Lease not found");
  if (l.owner !== p.user.sui_address) throw new HttpError(403, "Only the space owner can submit proofs");
  const code = await q(db().from("capture_codes").select("*").eq("code", p.captureCode).eq("user_id", p.user.id).maybeSingle());
  if (!code || code.used_at || new Date(code.expires_at).getTime() < Date.now()) throw new HttpError(400, "Capture code expired — get a new one");
  const np = await nextPeriod(p.escrowId);
  if (!np || (np as any).upcoming) throw new HttpError(400, np ? `The next proof window opens ${new Date(np.open).toLocaleString()}` : "No proof is due for this lease");

  const [closeup, creative] = await Promise.all([readBlob((l as any).spaces.closeup_blob_id), readBlob(l.creative_blob_id)]);
  const ph = await phash(p.image);
  const prev = await q(db().from("proofs").select("phash").eq("escrow_id", p.escrowId));
  const reused = prev.some((x: any) => x.phash && hamming(x.phash, ph) <= 6);

  const a = await generateJson<ProofA>({
    system: PROOF_SYSTEM,
    parts: [
      { text: "IMAGE A = listing close-up of the ad space:" },
      { image: closeup, mime: "image/jpeg" },
      { text: "IMAGE B = approved creative:" },
      { image: creative, mime: "image/png" },
      { text: `IMAGE C = new proof photo (period ${np.period}). Expected capture code: ${p.captureCode}` },
      { image: p.image, mime: p.mime },
    ],
    schema: PROOF_SCHEMA,
  });

  if (a.synthetic_suspicion === "high") {
    // Confirm with an independent sample before rejecting (single samples are noisy).
    const b = await generateJson<ProofA>({
      system: PROOF_SYSTEM,
      parts: [
        { text: "IMAGE A = listing close-up of the ad space:" },
        { image: closeup, mime: "image/jpeg" },
        { text: "IMAGE B = approved creative:" },
        { image: creative, mime: "image/png" },
        { text: `IMAGE C = new proof photo (period ${np.period}). Expected capture code: ${p.captureCode}` },
        { image: p.image, mime: p.mime },
      ],
      schema: PROOF_SCHEMA,
    });
    if (b.synthetic_suspicion !== "high") a.synthetic_suspicion = b.synthetic_suspicion;
  }
  const stored = await storeBlob(p.image, p.mime);
  let reason: string | null = null;
  if (reused) reason = "This photo was already used — take a new one.";
  else if (a.visible_text.some((t) => t.instruction_like)) reason = "Photo contains disallowed text.";
  else if (a.synthetic_suspicion === "high") reason = "Photo looks synthetic or like a photo of a screen.";
  else if (!norm(a.nonce_text).includes(norm(p.captureCode))) reason = `Capture code ${p.captureCode} is not visible — write it on a note next to the ad.`;
  else if (!a.creative_visible || a.match_score_bps < 8000) reason = a.reason_if_rejected || "The approved creative isn't clearly visible on the surface.";
  else if (a.object_match_bps < 8000) reason = "This doesn't look like the listed ad space.";

  await ok(db().from("capture_codes").update({ used_at: new Date().toISOString() }).eq("code", p.captureCode));
  const row = await q(
    db()
      .from("proofs")
      .insert({
        escrow_id: p.escrowId,
        period: np.period,
        photo_blob_id: stored.blobId,
        status: reason ? "rejected" : "accepted",
        match_bps: a.match_score_bps,
        object_bps: a.object_match_bps,
        reason,
        analysis: a as any,
        phash: ph,
        submitted_by: p.user.id,
      })
      .select("*")
      .single(),
  );
  if (reason) return { accepted: false, reason, period: np.period, analysis: a, proofId: row.id };

  const res = await execute(
    T.acceptProof({
      escrowId: p.escrowId,
      spaceId: (l as any).spaces.id,
      offeringId: (l as any).spaces.offering_id,
      period: np.period,
      photoBlobId: stored.blobId,
      matchBps: a.match_score_bps,
      objectBps: a.object_match_bps,
    }),
  );
  await ok(db().from("proofs").update({ digest: res.digest }).eq("id", row.id));
  await ingestDigest(res.digest);
  return { accepted: true, period: np.period, digest: res.digest, analysis: a, proofId: row.id };
}
