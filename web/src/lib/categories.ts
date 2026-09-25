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

export type Category = {
  code: number;
  key: string;
  label: string;
  emoji: string;
  /** typical viewing distance (m) per placement; `default` otherwise */
  dTyp: Partial<Record<Placement, number>> & { default: number };
  viewer: "static" | "moving";
  prohibited: string;
  tips: string;
};

export const CATEGORIES: Category[] = [
  { code: 1, key: "laptop", label: "Laptop", emoji: "💻", dTyp: { default: 4 }, viewer: "static", prohibited: "screen bezel, keyboard deck, vents", tips: "Photograph the lid face-on in daylight; place an ID card for scale." },
  { code: 2, key: "car", label: "Car / SUV", emoji: "🚗", dTyp: { rear: 12, left: 8, right: 8, top: 15, front: 15, default: 10 }, viewer: "moving", prohibited: "windscreen, front side windows, lights, number plates", tips: "Stand 1–2 m from the panel; avoid reflections." },
  { code: 3, key: "motorcycle", label: "Motorcycle / scooter", emoji: "🏍️", dTyp: { default: 6 }, viewer: "moving", prohibited: "lights, number plates", tips: "Tank and fairings work best." },
  { code: 4, key: "bicycle", label: "Bicycle", emoji: "🚲", dTyp: { default: 5 }, viewer: "moving", prohibited: "reflectors", tips: "Frame tubes are narrow — rear boxes score better." },
  { code: 5, key: "helmet", label: "Helmet", emoji: "⛑️", dTyp: { default: 5 }, viewer: "moving", prohibited: "certification labels, visor", tips: "Back of the helmet is most visible." },
  { code: 6, key: "backpack", label: "Backpack / bag", emoji: "🎒", dTyp: { default: 3 }, viewer: "moving", prohibited: "—", tips: "Flat back panels score best." },
  { code: 7, key: "instrument_case", label: "Instrument case", emoji: "🎸", dTyp: { default: 4 }, viewer: "static", prohibited: "—", tips: "Hard cases print best." },
  { code: 8, key: "board", label: "Skateboard / surfboard", emoji: "🛹", dTyp: { default: 4 }, viewer: "moving", prohibited: "grip-tape area", tips: "Deck underside is the canvas." },
  { code: 9, key: "van", label: "Food truck / van", emoji: "🚚", dTyp: { rear: 12, default: 10 }, viewer: "moving", prohibited: "as car", tips: "Large flat sides are premium inventory." },
  { code: 10, key: "storefront_window", label: "Storefront window", emoji: "🪟", dTyp: { default: 6 }, viewer: "static", prohibited: "fire exits, required signage", tips: "Check local sign rules." },
  { code: 11, key: "wall", label: "Wall / fence", emoji: "🧱", dTyp: { default: 15 }, viewer: "static", prohibited: "—", tips: "Check local planning rules." },
  { code: 12, key: "stream_setup", label: "Stream / desk setup", emoji: "🎙️", dTyp: { default: 1.5 }, viewer: "static", prohibited: "—", tips: "Items visible on camera." },
  { code: 13, key: "apparel", label: "Apparel", emoji: "🧥", dTyp: { default: 4 }, viewer: "moving", prohibited: "—", tips: "Jacket backs work best." },
  { code: 14, key: "other", label: "Other", emoji: "📦", dTyp: { default: 5 }, viewer: "static", prohibited: "judged case by case", tips: "Describe the object well." },
];

export const categoryByKey = (k: string) => CATEGORIES.find((c) => c.key === k) ?? CATEGORIES[CATEGORIES.length - 1];
export const categoryByCode = (c: number) => CATEGORIES.find((x) => x.code === c) ?? CATEGORIES[CATEGORIES.length - 1];

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
