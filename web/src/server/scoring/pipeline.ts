/**
 * Ad-Space Quality Score pipeline (AD-QUALITY-SCORING.md).
 *  analyzeHero  — object-level integrity checks before create_object
 *  analyzeSpace — full per-space pipeline run synchronously in the "Add space" modal
 */
import { CRITERIA, EXPOSURE_CLASSES, clampDistance, gradeOf, type ExposureClass, type ObjectProfile, type Placement, type ViewerMode } from "@/lib/categories";
import { db, ok } from "../db";
import { generateJson, type Part } from "../gemini";
import { c2paScan, computeMetrics, hamming, type Metrics } from "./metrics";
import {
  CLOSEUP_SCHEMA,
  CLOSEUP_SYSTEM,
  HERO_SCHEMA,
  HERO_SYSTEM,
  RUBRIC_SCHEMA,
  RUBRIC_SYSTEM,
  RUBRIC_VERSION,
} from "./prompts";

export type Gate = "G1" | "G2" | "G3" | "G4" | "G5" | "G6" | "G7" | "G8" | "MIN_SCORE";
export const GATE_REASON: Record<Gate, string> = {
  G1: "Content not allowed",
  G2: "Photo must be taken by you, in the app",
  G3: "This close-up doesn't match your object",
  G4: "Photo contains disallowed text",
  G5: "This area can't carry an ad",
  G6: "Retake the photo: blurry, dark or too far",
  G7: "Measured size doesn't match what you entered",
  G8: "The photo doesn't match the name and description you entered",
  MIN_SCORE: "Score below the listing minimum (40)",
};

type VText = { text: string; image_label: string; instruction_like: boolean };
type HeroA = {
  image_description: string;
  object_type: string;
  matches_name: "yes" | "no" | "uncertain";
  match_evidence: string;
  exposure_class: ExposureClass;
  viewer_mode: ViewerMode;
  typical_viewing_distance_m: number;
  prohibited_zones: string[];
  tags: string[];
  nonce_text: string;
  visible_text: VText[];
  synthetic_suspicion: "none" | "low" | "medium" | "high";
  synthetic_evidence: string;
  brand_safety: { garm_category: string; tier: string; evidence: string }[];
  condition_summary: string;
};

const norm = (s: string) => s.replace(/[^a-z0-9]/gi, "").toUpperCase();

async function duplicateOf(phash: string, excludeUser?: string): Promise<{ sameOwner: boolean } | null> {
  const { data: a } = await db().from("space_analyses").select("user_id, result").eq("decision", "ACCEPTED").limit(2000);
  const { data: o } = await db().from("objects").select("owner_user_id, hero_check").limit(2000);
  for (const r of a ?? []) {
    const p = (r as any).result?.metrics?.phash;
    if (p && hamming(p, phash) <= 8) return { sameOwner: r.user_id === excludeUser };
  }
  for (const r of o ?? []) {
    const p = (r as any).hero_check?.metrics?.phash;
    if (p && hamming(p, phash) <= 8) return { sameOwner: (r as any).owner_user_id === excludeUser };
  }
  return null;
}

// =============================== HERO ===============================

export type HeroResult = {
  decision: "ACCEPTED" | "REJECTED";
  gate?: Gate;
  reason?: string;
  tips: string[];
  metrics: Metrics;
  analysis: HeroA;
  provenance: number;
  nonceOk: boolean;
  profile: ObjectProfile;
};

export async function analyzeHero(p: {
  image: Buffer;
  mime: string;
  name: string;
  description: string;
  captureCode?: string | null;
  userId: string;
  checkDuplicates?: boolean;
}): Promise<HeroResult> {
  const metrics = await computeMetrics(p.image);
  const c2pa = c2paScan(p.image);
  const ownerText = `Owner's NAME: "${p.name}". Owner's DESCRIPTION: "${p.description || "(none)"}".`;
  const analysis = await generateJson<HeroA>({
    system: HERO_SYSTEM,
    parts: [
      { text: `${ownerText} A capture code may be written on a note in the photo.` },
      { text: "IMAGE A = full object (hero):" },
      { image: p.image, mime: p.mime },
    ],
    schema: HERO_SCHEMA,
  });
  if (analysis.synthetic_suspicion === "high") {
    // Confirm with an independent sample before rejecting (single samples are noisy).
    const second = await generateJson<HeroA>({ system: HERO_SYSTEM, parts: [{ text: ownerText }, { text: "IMAGE A = full object (hero):" }, { image: p.image, mime: p.mime }], schema: HERO_SCHEMA });
    if (second.synthetic_suspicion !== "high") analysis.synthetic_suspicion = second.synthetic_suspicion === "none" ? "low" : second.synthetic_suspicion;
  }
  const nonceSeen = norm(analysis.nonce_text ?? "");
  const nonceOk = !!p.captureCode && nonceSeen.length > 0 && nonceSeen.includes(norm(p.captureCode));
  const provenance = nonceOk ? 1 : nonceSeen.length === 0 ? 0.5 : 0.5;
  const cls = (EXPOSURE_CLASSES[analysis.exposure_class] ? analysis.exposure_class : "other") as ExposureClass;
  const profile: ObjectProfile = {
    objectType: (analysis.object_type || "object").toLowerCase().slice(0, 60),
    exposureClass: cls,
    viewerMode: analysis.viewer_mode ?? EXPOSURE_CLASSES[cls].viewer,
    viewingDistanceM: clampDistance(analysis.typical_viewing_distance_m, EXPOSURE_CLASSES[cls].defaultDistanceM),
    prohibitedZones: (analysis.prohibited_zones ?? []).slice(0, 10),
    tags: Array.from(new Set((analysis.tags ?? []).map((t) => t.toLowerCase().trim()).filter(Boolean))).slice(0, 8),
  };
  const reject = (gate: Gate, reason = GATE_REASON[gate], tips: string[] = []): HeroResult => ({
    decision: "REJECTED",
    gate,
    reason,
    tips,
    metrics,
    analysis,
    provenance,
    nonceOk,
    profile,
  });

  if (analysis.brand_safety.some((b) => b.tier === "floor")) return reject("G1");
  if (c2pa.aiGenerated || analysis.synthetic_suspicion === "high") return reject("G2", GATE_REASON.G2, ["Take a fresh photo of your own object with the in-app camera."]);
  if (p.captureCode && nonceSeen.length >= 3 && !nonceSeen.includes(norm(p.captureCode)))
    return reject("G2", "The capture code in the photo doesn't match the one we showed you.");
  const dup = p.checkDuplicates === false ? null : await duplicateOf(metrics.phash, p.userId);
  if (dup) return reject("G2", dup.sameOwner ? "You've already listed this photo." : GATE_REASON.G2);
  if (analysis.visible_text.some((t) => t.instruction_like)) return reject("G4");
  if (analysis.matches_name === "no") return reject("G8", `${GATE_REASON.G8}: this looks like ${analysis.object_type}. ${analysis.match_evidence}`.trim(), ["Use a name and description that describe this object."]);
  if (metrics.eqi < 0.35 || metrics.retakeReasons.length >= 2) return reject("G6", GATE_REASON.G6, metrics.retakeReasons);
  return { decision: "ACCEPTED", tips: metrics.retakeReasons, metrics, analysis, provenance, nonceOk, profile };
}

// =============================== SPACE ===============================

type Crit = { observations: string; evidence: string; cannot_assess: boolean; score: number; confidence: string };
type Rubric = Record<"V2" | "V3" | "S1" | "S2" | "S3" | "C1" | "C2" | "K" | "D", Crit> & {
  image_description: string;
  typical_viewing_distance_m: number;
  surface_label: string;
  owner_feedback: string[];
};
type CloseA = {
  observations: string;
  belongs_to_object: "yes" | "no" | "uncertain";
  belongs_evidence: string;
  scale_card_detected: boolean;
  card_box_2d: number[];
  space_box_2d: number[];
  prohibited_zone: boolean;
  prohibited_reason: string;
  visible_text: VText[];
  synthetic_suspicion: string;
  brand_safety: { garm_category: string; tier: string; evidence: string }[];
};

export type SpaceInput = {
  label: string;
  widthMm: number;
  heightMm: number;
  placement: Placement;
  material: string;
  objectName: string;
  objectDescription: string;
  profile: ObjectProfile;
  captureSource: "camera" | "upload";
};

export type SpaceResult = {
  decision: "ACCEPTED" | "REJECTED";
  gate?: Gate;
  reason?: string;
  aqs: number;
  grade: number;
  confidence: number;
  rankScore: number;
  subscores: Record<string, number>;
  evidence: Record<string, { observations: string; evidence: string }>;
  strengths: { key: string; name: string; score: number; evidence: string }[];
  weaknesses: { key: string; name: string; score: number; evidence: string }[];
  tips: string[];
  surface: string;
  metrics: Metrics & { thetaDeg: number; legibleM: number; viewingDistanceM: number };
  integrity: CloseA;
  samples: number;
  rubricVersion: string;
  model: string;
};

const VLM_KEYS = ["V2", "V3", "S1", "S2", "S3", "C1", "C2", "K", "D"] as const;
const med = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.floor((s[m - 1] + s[m]) / 2);
};

function angularScore(thetaDeg: number) {
  return thetaDeg >= 4 ? 4 : thetaDeg >= 2 ? 3 : thetaDeg >= 1 ? 2 : thetaDeg >= 0.5 ? 1 : 0;
}

function legibilityScore(ratio: number) {
  return ratio >= 1.5 ? 4 : ratio >= 1 ? 3 : ratio >= 0.6 ? 2 : ratio >= 0.3 ? 1 : 0;
}

/** Ranking cohort = the AI-derived exposure class (internal), not a user category. */
async function cohortMean(exposureClass: string) {
  const { data } = await db().from("spaces").select("aqs, objects!inner(exposure_class)").eq("objects.exposure_class", exposureClass).limit(500);
  const xs = (data ?? []).map((r: any) => r.aqs as number).filter((x) => x > 0);
  return xs.length >= 10 ? xs.reduce((a, b) => a + b, 0) / xs.length : 50;
}

export async function analyzeSpace(p: {
  hero: Buffer;
  heroMime: string;
  closeup: Buffer;
  closeupMime: string;
  input: SpaceInput;
  heroProvenance: number;
  userId: string;
  checkDuplicates?: boolean;
}): Promise<SpaceResult> {
  const prof = p.input.profile;
  const dims = { widthMm: p.input.widthMm, heightMm: p.input.heightMm };
  const metrics = await computeMetrics(p.closeup, dims);
  const c2pa = c2paScan(p.closeup);

  const context = {
    object: {
      owner_name: p.input.objectName,
      owner_description: p.input.objectDescription,
      object_type: prof.objectType,
      exposure_class: prof.exposureClass,
      viewer_mode: prof.viewerMode,
      object_typical_viewing_distance_m: prof.viewingDistanceM,
      prohibited_zones: prof.prohibitedZones,
    },
    space_name: p.input.label,
    stated_dimensions_mm: dims,
    placement: p.input.placement,
    owner_stated_material: p.input.material,
    measured: {
      sharpness_laplacian_var: Math.round(metrics.sharpness),
      clipped_pixels_pct: +(metrics.clipPct * 100).toFixed(2),
      centre_vs_surround_contrast_ratio: +metrics.contrastRatio.toFixed(2),
      centre_uniformity_std: +metrics.uniformity.toFixed(1),
    },
  };
  const images = (swap: boolean): Part[] => {
    const a: Part[] = [{ text: "IMAGE A = full object (hero):" }, { image: p.hero, mime: p.heroMime }];
    const b: Part[] = [{ text: `IMAGE B = close-up of ad space '${p.input.label}' (${p.input.widthMm}x${p.input.heightMm} mm):` }, { image: p.closeup, mime: p.closeupMime }];
    return swap ? [...b, ...a] : [...a, ...b];
  };

  const [integrity, ...samples] = await Promise.all([
    generateJson<CloseA>({ system: CLOSEUP_SYSTEM, parts: [...images(false), { text: `CONTEXT: ${JSON.stringify(context)}` }], schema: CLOSEUP_SCHEMA }),
    ...[false, true, false].map((swap) =>
      generateJson<Rubric>({
        system: RUBRIC_SYSTEM,
        parts: [{ text: `CONTEXT: ${JSON.stringify(context)}` }, ...images(swap), { text: "Score IMAGE B's ad space." }],
        schema: RUBRIC_SCHEMA,
        thinking: true,
      }),
    ),
  ]);

  // Extra samples where the three disagree (range ≥ 2).
  const disagree = VLM_KEYS.some((k) => {
    const xs = samples.map((s) => s[k].score);
    return Math.max(...xs) - Math.min(...xs) >= 2;
  });
  if (disagree) {
    const more = await Promise.all(
      [true, false].map((swap) =>
        generateJson<Rubric>({ system: RUBRIC_SYSTEM, parts: [{ text: `CONTEXT: ${JSON.stringify(context)}` }, ...images(swap), { text: "Score IMAGE B's ad space." }], schema: RUBRIC_SCHEMA, thinking: true }),
      ),
    );
    samples.push(...more);
  }

  // ---- code-computed criteria (V1, L) from the AI-estimated viewing distance (median of samples + object prior) ----
  const dTyp = clampDistance(med([...samples.map((x) => Math.round((x.typical_viewing_distance_m ?? prof.viewingDistanceM) * 10)), Math.round(prof.viewingDistanceM * 10)]) / 10, prof.viewingDistanceM);
  const wM = p.input.widthMm / 1000, hM = p.input.heightMm / 1000;
  const thetaDeg = (2 * Math.atan(Math.sqrt(wM * hM) / (2 * dTyp)) * 180) / Math.PI;
  const shortCm = Math.min(p.input.widthMm, p.input.heightMm) / 10;
  const letterIn = (0.35 * shortCm) / 2.54;
  const LI = prof.viewerMode === "moving" ? 25 : 30;
  const legibleM = (letterIn * LI) / 3.281;
  const ratio = legibleM / dTyp;

  // ---- gates ----
  const base = {
    aqs: 0,
    grade: 0,
    confidence: 0,
    rankScore: 0,
    subscores: {},
    evidence: {},
    strengths: [],
    weaknesses: [],
    surface: samples[0]?.surface_label ?? "",
    metrics: { ...metrics, thetaDeg, legibleM, viewingDistanceM: dTyp },
    integrity,
    samples: samples.length,
    rubricVersion: RUBRIC_VERSION,
    model: process.env.GEMINI_MODEL || "gemini-3.1-flash-lite",
  };
  const reject = (gate: Gate, reason = GATE_REASON[gate], tips: string[] = []): SpaceResult => ({ ...base, decision: "REJECTED", gate, reason, tips });

  if (integrity.synthetic_suspicion === "high") {
    const second = await generateJson<CloseA>({ system: CLOSEUP_SYSTEM, parts: [...images(true), { text: `CONTEXT: ${JSON.stringify(context)}` }], schema: CLOSEUP_SCHEMA });
    if (second.synthetic_suspicion !== "high") integrity.synthetic_suspicion = second.synthetic_suspicion;
  }
  if (integrity.brand_safety.some((b) => b.tier === "floor")) return reject("G1");
  if (c2pa.aiGenerated || integrity.synthetic_suspicion === "high") return reject("G2", GATE_REASON.G2, ["Use the in-app camera to photograph the real section."]);
  const dup = p.checkDuplicates === false ? null : await duplicateOf(metrics.phash, p.userId);
  if (dup) return reject("G2", dup.sameOwner ? "You've already listed this exact photo." : GATE_REASON.G2);
  if (integrity.belongs_to_object === "no") return reject("G3", GATE_REASON.G3, ["Photograph a section of the same object shown in your main photo."]);
  if (integrity.visible_text.some((t) => t.instruction_like)) return reject("G4");
  if (integrity.prohibited_zone) return reject("G5", `This area can't carry an ad: ${integrity.prohibited_reason}`.trim());
  if (metrics.eqi < 0.35 || metrics.retakeReasons.length >= 2) return reject("G6", GATE_REASON.G6, metrics.retakeReasons);
  if (integrity.scale_card_detected) {
    const cb = integrity.card_box_2d, sb = integrity.space_box_2d;
    const cw = ((cb[3] - cb[1]) / 1000) * metrics.width, ch = ((cb[2] - cb[0]) / 1000) * metrics.height;
    const cardLongPx = Math.max(cw, ch);
    if (cardLongPx > 10) {
      const mmPerPx = 85.6 / cardLongPx;
      const sw = ((sb[3] - sb[1]) / 1000) * metrics.width * mmPerPx, sh = ((sb[2] - sb[0]) / 1000) * metrics.height * mmPerPx;
      const measured = [Math.max(sw, sh), Math.min(sw, sh)];
      const stated = [Math.max(dims.widthMm, dims.heightMm), Math.min(dims.widthMm, dims.heightMm)];
      const off = Math.max(Math.abs(measured[0] - stated[0]) / stated[0], Math.abs(measured[1] - stated[1]) / stated[1]);
      if (off > 0.2)
        return reject("G7", `${GATE_REASON.G7} (measured ≈ ${Math.round(measured[0] / 10)}×${Math.round(measured[1] / 10)} cm).`);
    }
  }

  // ---- aggregation ----
  const sub: Record<string, number> = { V1: angularScore(thetaDeg), L: legibilityScore(ratio) };
  const ranges: number[] = [];
  let cannot = 0;
  for (const k of VLM_KEYS) {
    const xs = samples.map((s) => s[k].score);
    ranges.push(Math.max(...xs) - Math.min(...xs));
    const ca = samples.filter((s) => s[k].cannot_assess).length;
    if (ca >= Math.ceil(samples.length / 2)) {
      cannot++;
      sub[k] = Math.max(0, med(xs) - 1);
    } else sub[k] = med(xs);
  }
  let raw = 0;
  for (const [k, c] of Object.entries(CRITERIA)) raw += (c.weight * (sub[k] ?? 0)) / 4;
  if (sub.V2 === 0 || sub.V3 === 0) raw = Math.min(raw, 25);
  if (sub.D === 0) raw = Math.min(raw, 30);
  if (sub.L === 0 && sub.V1 <= 1) raw = Math.min(raw, 35);
  const aqs = Math.round(raw);

  const agree = 1 - ranges.reduce((a, b) => a + b / 4, 0) / ranges.length;
  const coverage = 1 - cannot / VLM_KEYS.length;
  const prov = p.input.captureSource === "camera" ? Math.max(0.8, p.heroProvenance) : 0.6;
  const conf = Math.pow(Math.max(0.01, Math.min(1, metrics.eqi)), 0.4) * Math.pow(Math.max(0.01, agree), 0.3) * Math.pow(Math.max(0.01, coverage), 0.2) * Math.pow(prov, 0.1);
  const mu = await cohortMean(prof.exposureClass);
  const rankScore = conf * aqs + (1 - conf) * Math.min(mu, aqs);

  const pick = samples[Math.floor(samples.length / 2)];
  const evidence: SpaceResult["evidence"] = {};
  for (const k of VLM_KEYS) evidence[k] = { observations: pick[k].observations, evidence: pick[k].evidence };
  evidence.V1 = { observations: `Subtends ${thetaDeg.toFixed(2)}° at the typical ${dTyp} m viewing distance.`, evidence: "computed" };
  evidence.L = { observations: `Text up to ${letterIn.toFixed(1)}" tall is legible at ≈${legibleM.toFixed(0)} m (typical distance ${dTyp} m).`, evidence: "computed" };
  const ranked = Object.keys(CRITERIA)
    .map((k) => ({ key: k, name: CRITERIA[k].name, score: sub[k], evidence: evidence[k]?.observations ?? "", w: CRITERIA[k].weight }))
    .sort((a, b) => b.score * b.w - a.score * a.w);
  const strengths = ranked.filter((r) => r.score >= 3).slice(0, 3).map(({ w: _w, ...r }) => r);
  const weaknesses = [...ranked].reverse().filter((r) => r.score <= 2).slice(0, 3).map(({ w: _w, ...r }) => r);
  const tips = Array.from(new Set(samples.flatMap((s) => s.owner_feedback ?? []))).slice(0, 5);

  const result: SpaceResult = {
    ...base,
    decision: aqs >= 40 ? "ACCEPTED" : "REJECTED",
    gate: aqs >= 40 ? undefined : "MIN_SCORE",
    reason: aqs >= 40 ? undefined : GATE_REASON.MIN_SCORE,
    aqs,
    grade: aqs >= 40 ? gradeOf(aqs) : 0,
    confidence: +conf.toFixed(3),
    rankScore: +rankScore.toFixed(2),
    subscores: sub,
    evidence,
    strengths,
    weaknesses,
    tips: [...tips, ...metrics.retakeReasons].slice(0, 6),
  };
  return result;
}

export function objectScore(spaces: { aqs: number; width_mm: number; height_mm: number }[]) {
  if (!spaces.length) return { aqs: 0, grade: 0 };
  const max = Math.max(...spaces.map((s) => s.aqs));
  const area = spaces.reduce((a, s) => a + s.width_mm * s.height_mm, 0);
  const wmean = spaces.reduce((a, s) => a + s.aqs * s.width_mm * s.height_mm, 0) / area;
  const aqs = Math.round(0.5 * max + 0.5 * wmean);
  return { aqs, grade: gradeOf(aqs) };
}
