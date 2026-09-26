/**
 * Demo submit: lets a presenter push the photo-gated steps (object hero, ad space close-up, proof of
 * display) through instantly with a known-good sample photo. The AI judge is skipped and the step is
 * approved with a high score. On unless DEMO_SUBMIT=0.
 */
import { computeMetrics, phash as phashOf } from "./scoring/metrics";
import { CRITERIA, gradeOf } from "@/lib/categories";
import { RUBRIC_VERSION } from "./scoring/prompts";

export const demoSubmitEnabled = () => process.env.DEMO_SUBMIT !== "0";
/** True when the request asked for demo mode and the server allows it. */
export const isDemo = (v: unknown) => demoSubmitEnabled() && (v === "1" || v === true || v === "true");

export async function demoHero(image: Buffer, name: string, description: string) {
  const metrics = await computeMetrics(image);
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
  const metrics = await computeMetrics(closeup);
  const sub: Record<string, number> = { V1: 4, V2: 4, V3: 3, L: 4, S1: 4, S2: 4, S3: 3, C1: 4, C2: 3, K: 4, D: 4 };
  const raw = Object.keys(CRITERIA).reduce((a, k) => a + (CRITERIA[k].weight * (sub[k] ?? 3)) / 4, 0);
  const aqs = Math.max(88, Math.round(raw));
  const wM = widthMm / 1000, hM = heightMm / 1000;
  const thetaDeg = (2 * Math.atan(Math.sqrt(wM * hM) / (2 * viewingDistanceM)) * 180) / Math.PI;
  const evidence: Record<string, { observations: string; evidence: string }> = {};
  for (const k of Object.keys(CRITERIA)) evidence[k] = { observations: `${CRITERIA[k].name}: strong.`, evidence: "demo" };
  const ranked = Object.keys(CRITERIA).map((k) => ({ key: k, name: CRITERIA[k].name, score: sub[k], evidence: evidence[k].observations }));
  return {
    decision: "ACCEPTED" as const,
    aqs,
    grade: gradeOf(aqs),
    confidence: 0.94,
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
    phash: await phashOf(image),
    analysis: {
      creative_visible: true,
      match_score_bps: 9600,
      object_match_bps: 9500,
      visible_text: [],
      synthetic_suspicion: "none",
      reason_if_rejected: "",
    },
  };
}
