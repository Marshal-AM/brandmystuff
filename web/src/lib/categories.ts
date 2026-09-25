/** Object category catalogue (AQS §6). Shared by client and server. */
export type Placement = "front" | "rear" | "left" | "right" | "top" | "bottom" | "interior" | "other";
export const PLACEMENTS: Placement[] = ["front", "rear", "left", "right", "top", "bottom", "interior", "other"];
export const placementCode = (p: Placement) => PLACEMENTS.indexOf(p);

export const MATERIALS = [
  "painted metal",
  "anodised aluminium",
  "glass",
  "smooth plastic",
  "textured plastic",
  "fabric",
  "leather",
  "wood",
  "brick / concrete",
  "other",
] as const;

/**
 * There are no user-facing categories: owners list anything with a name + description.
 * The AI derives an object profile from the photo, name and description (AD-QUALITY-SCORING §2.2).
 * The exposure class is internal only (scoring defaults + ranking cohort), never chosen by the user.
 */
export type ExposureClass = "portable_device" | "wearable" | "vehicle" | "fixed_surface" | "on_camera" | "other";
export type ViewerMode = "static" | "carried" | "moving";

export const EXPOSURE_CLASSES: Record<ExposureClass, { label: string; defaultDistanceM: number; viewer: ViewerMode }> = {
  portable_device: { label: "Portable device", defaultDistanceM: 4, viewer: "static" },
  wearable: { label: "Wearable / carried item", defaultDistanceM: 4, viewer: "carried" },
  vehicle: { label: "Vehicle", defaultDistanceM: 10, viewer: "moving" },
  fixed_surface: { label: "Fixed surface", defaultDistanceM: 10, viewer: "static" },
  on_camera: { label: "On-camera setup", defaultDistanceM: 1.5, viewer: "static" },
  other: { label: "Other", defaultDistanceM: 5, viewer: "static" },
};
export const EXPOSURE_KEYS = Object.keys(EXPOSURE_CLASSES) as ExposureClass[];

export type ObjectProfile = {
  objectType: string;
  exposureClass: ExposureClass;
  viewerMode: ViewerMode;
  viewingDistanceM: number;
  prohibitedZones: string[];
  tags: string[];
};

/** Keeps AI-estimated viewing distances in a sane, stable range. */
export const clampDistance = (d: number | null | undefined, fallback = 5) => {
  const v = Number.isFinite(d as number) && (d as number) > 0 ? (d as number) : fallback;
  return Math.round(Math.min(30, Math.max(0.5, v)) * 10) / 10;
};

export const GRADE_LABEL = ["—", "C", "B", "A", "A+"] as const;
export const gradeOf = (aqs: number) => (aqs >= 85 ? 4 : aqs >= 70 ? 3 : aqs >= 55 ? 2 : aqs >= 40 ? 1 : 0);

export const CRITERIA: Record<string, { name: string; weight: number; group: string }> = {
  V1: { name: "Angular size", weight: 12, group: "Visibility" },
  V2: { name: "Orientation to viewer", weight: 10, group: "Visibility" },
  V3: { name: "Occlusion in use", weight: 8, group: "Visibility" },
  L: { name: "Legibility capacity", weight: 12, group: "Legibility" },
  S1: { name: "Surface geometry", weight: 7, group: "Surface" },
  S2: { name: "Material & texture", weight: 6, group: "Surface" },
  S3: { name: "Interruptions", weight: 5, group: "Surface" },
  C1: { name: "Condition", weight: 9, group: "Condition" },
  C2: { name: "Clutter & competing marks", weight: 8, group: "Condition" },
  K: { name: "Conspicuity & contrast", weight: 11, group: "Conspicuity" },
  D: { name: "Durability & exposure", weight: 12, group: "Durability" },
};
