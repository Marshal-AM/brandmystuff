/**
 * Demo submit: lets a presenter push the photo-gated steps (object hero, ad space close-up, proof of
 * display) through instantly with a known-good sample photo. Nothing slow runs: no AI judge, no image
 * analysis and no Walrus round trip (the sample photos are pre-uploaded by scripts/demo-blobs.ts).
 * The step is approved with fixed scores above 90. On unless DEMO_SUBMIT=0.
 */
import { CRITERIA, gradeOf } from "@/lib/categories";
import { RUBRIC_VERSION } from "./scoring/prompts";
import { sha256Hex, storeBlob } from "./walrus";
import blobs from "./demo-blobs.json";

export const demoSubmitEnabled = () => process.env.DEMO_SUBMIT !== "0";
/** True when the request asked for demo mode and the server allows it. */
export const isDemo = (v: unknown) => demoSubmitEnabled() && (v === "1" || v === true || v === "true");

/** Fixed, high-quality image metrics for the sample photos. */
const METRICS = { sharpness: 420, noise: 3.1, clipPct: 0.4, meanL: 168, contrastRatio: 4.8, uniformity: 0.93, pxPerCm: 46, eqi: 0.94, retakeReasons: [] as string[], width: 1536, height: 1024 };

/** Walrus blob for a sample photo: the pre-uploaded id when it matches, otherwise a real upload. */
export async function demoBlob(buf: Buffer, mime: string) {
  const sha256 = sha256Hex(buf);
  const hit = (blobs.images as Record<string, { blobId: string }>)[sha256];
  return hit ? { blobId: hit.blobId, sha256, size: buf.length } : storeBlob(buf, mime);
}
export const DEMO_MANIFEST_BLOB = blobs.manifestBlobId;
export const DEMO_REPORT_BLOB = blobs.reportBlobId;

export async function demoHero(image: Buffer, name: string, description: string) {
  const metrics = { ...METRICS, phash: sha256Hex(image).slice(0, 16) };
  const analysis = {
    image_description: `A clear, well-lit photo of ${name}.`,
    object_type: "laptop",
    matches_name: "yes" as const,
    match_evidence: `The photo shows ${name}, matching the owner's description.`,
    exposure_class: "portable_device" as const,
    viewer_mode: "static" as const,
    typical_viewing_distance_m: 2,
    prohibited_zones: ["keyboard", "screen"],
    tags: ["laptop", "tech", "portable", "office"],
    visible_text: [],
    synthetic_suspicion: "none" as const,
    synthetic_evidence: "",
    brand_safety: [],
    condition_summary: description || "Excellent condition, clean surfaces.",
  };
  const profile = { objectType: "laptop", exposureClass: "portable_device" as const, viewerMode: "static" as const, viewingDistanceM: 2, prohibitedZones: analysis.prohibited_zones, tags: analysis.tags };
  return { decision: "ACCEPTED" as const, tips: [], metrics, analysis, provenance: 1, liveCamera: true, profile };
}

export async function demoSpace(closeup: Buffer, widthMm: number, heightMm: number, viewingDistanceM: number, label: string) {
  const metrics = { ...METRICS, phash: sha256Hex(closeup).slice(0, 16) };
  const sub: Record<string, number> = { V1: 4, V2: 4, V3: 4, L: 4, S1: 4, S2: 4, S3: 3, C1: 4, C2: 4, K: 4, D: 4 };
  const aqs = 96;
  const wM = widthMm / 1000, hM = heightMm / 1000;
  const thetaDeg = (2 * Math.atan(Math.sqrt(wM * hM) / (2 * viewingDistanceM)) * 180) / Math.PI;
  const evidence: Record<string, { observations: string; evidence: string }> = {};
  for (const k of Object.keys(CRITERIA)) evidence[k] = { observations: `${CRITERIA[k].name}: strong.`, evidence: "demo" };
  const ranked = Object.keys(CRITERIA).map((k) => ({ key: k, name: CRITERIA[k].name, score: sub[k], evidence: evidence[k].observations }));
  return {
    decision: "ACCEPTED" as const,
    aqs,
    grade: gradeOf(aqs),
    confidence: 0.95,
    rankScore: aqs,
    subscores: sub,
    evidence,
    strengths: ranked.filter((r) => r.score === 4).slice(0, 3),
    weaknesses: [],
    tips: [],
    surface: label,
    metrics: { ...metrics, thetaDeg, legibleM: viewingDistanceM * 3, viewingDistanceM },
    integrity: { observations: "Clean, flat surface that belongs to the object.", belongs_to_object: "yes", belongs_evidence: "Matches the object photo.", scale_card_detected: true, card_box_2d: [], space_box_2d: [], prohibited_zone: false, prohibited_reason: "", visible_text: [], synthetic_suspicion: "none", brand_safety: [] },
    samples: 3,
    rubricVersion: RUBRIC_VERSION,
    model: "demo",
  };
}

export async function demoProof(image: Buffer) {
  return {
    phash: sha256Hex(image).slice(0, 16),
    analysis: {
      creative_visible: true,
      match_score_bps: 9700,
      object_match_bps: 9600,
      visible_text: [],
      synthetic_suspicion: "none",
      reason_if_rejected: "",
    },
  };
}
