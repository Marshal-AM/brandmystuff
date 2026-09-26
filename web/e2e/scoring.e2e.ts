/**
 * Scoring e2e (AQS §8.1): runs the full AI pipeline (P0 metrics + Gemini integrity + rubric sampling +
 * aggregation) on the fixture set and asserts decisions, gates and orderings.
 * Run: npx tsx e2e/scoring.e2e.ts
 */
import { config } from "dotenv";
import { resolve } from "node:path";
config({ path: resolve(__dirname, "../../.env.local") });

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { analyzeHero, analyzeSpace, type SpaceInput } from "../src/server/scoring/pipeline";

const img = (f: string) => readFileSync(resolve(__dirname, "fixtures", f));
const uid = randomUUID();
const LAPTOP = { name: "My MacBook Pro 17", description: "Silver 17-inch laptop I carry to cafés and coworking spaces every day." };
const CAR = { name: "Honda Civic hatchback", description: "Grey hatchback I drive around the city and park on the street." };

/** In-app photos include a note with the capture code. */
async function withNote(img: Buffer, code: string) {
  const sharp = (await import("sharp")).default;
  const m = await sharp(img).metadata();
  const W = m.width!, H = m.height!;
  const note = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${Math.round(W * 0.2)}" height="${Math.round(H * 0.12)}"><rect width="100%" height="100%" fill="#fff8b0" stroke="#d6c95a" stroke-width="6"/><text x="50%" y="70%" font-size="${Math.round(H * 0.075)}" font-family="Courier" font-weight="bold" text-anchor="middle" fill="#111">${code}</text></svg>`);
  return sharp(img).composite([{ input: note, left: Math.round(W * 0.74), top: Math.round(H * 0.84) }]).jpeg({ quality: 90 }).toBuffer();
}

async function main() {
  const t0 = Date.now();
  const laptopHero = await withNote(img("laptop-hero.jpg"), "K7PX");
  const hero = await analyzeHero({ image: laptopHero, mime: "image/jpeg", ...LAPTOP, liveCamera: true, userId: uid, checkDuplicates: false });
  console.log("profile:", JSON.stringify(hero.profile));
  const laptopSpace: SpaceInput = { label: "lid-right", widthMm: 180, heightMm: 170, placement: "rear", material: "anodised aluminium", objectName: LAPTOP.name, objectDescription: LAPTOP.description, profile: hero.profile, captureSource: "camera" };
  console.log("hero:", hero.decision, hero.gate ?? "", hero.reason ?? "", `synthetic=${hero.analysis.synthetic_suspicion}`);
  assert.equal(hero.decision, "ACCEPTED", "laptop hero accepted");

  const mismatch = await analyzeHero({ image: img("car-hero.jpg"), mime: "image/jpeg", ...LAPTOP, userId: uid, checkDuplicates: false });
  console.log("car photo named as a laptop:", mismatch.decision, mismatch.gate, mismatch.reason);
  assert.equal(mismatch.gate, "G8", "photo that doesn't match the name → G8");
  const car = await analyzeHero({ image: img("car-hero.jpg"), mime: "image/jpeg", ...CAR, userId: uid, checkDuplicates: false });
  assert.equal(car.decision, "ACCEPTED", "car hero accepted under its own name");

  const common = { hero: laptopHero, heroMime: "image/jpeg", closeupMime: "image/jpeg", heroProvenance: hero.provenance, userId: uid, checkDuplicates: false };
  const [good, blurry, injected, mismatched, carWindow] = await Promise.all([
    analyzeSpace({ ...common, closeup: img("laptop-lid-right.jpg"), input: laptopSpace }),
    analyzeSpace({ ...common, closeup: img("laptop-lid-blurry.jpg"), input: laptopSpace }),
    analyzeSpace({ ...common, closeup: img("laptop-lid-injection.jpg"), input: laptopSpace }),
    analyzeSpace({ ...common, closeup: img("car-rear-window.jpg"), input: laptopSpace }),
    analyzeSpace({
      ...common,
      hero: img("car-hero.jpg"),
      closeup: img("car-rear-window.jpg"),
      input: { label: "rear-window", widthMm: 1100, heightMm: 500, placement: "rear", material: "glass", objectName: CAR.name, objectDescription: CAR.description, profile: car.profile, captureSource: "camera" },
    }),
  ]);

  const show = (n: string, r: any) => console.log(`${n}: ${r.decision} ${r.gate ?? ""} aqs=${r.aqs} grade=${r.grade} conf=${r.confidence} ${r.reason ?? ""}`, r.decision === "ACCEPTED" ? JSON.stringify(r.subscores) : "");
  show("lid-right", good);
  show("blurry", blurry);
  show("injection", injected);
  show("mismatched", mismatched);
  show("car window", carWindow);

  assert.equal(good.decision, "ACCEPTED", "clean lid accepted");
  assert.ok(good.aqs >= 55, "clean lid scores at least grade B");
  assert.equal(blurry.decision, "REJECTED");
  assert.equal(blurry.gate, "G6", "blurry → G6");
  assert.equal(injected.decision, "REJECTED");
  assert.equal(injected.gate, "G4", "injection → G4");
  assert.equal(mismatched.decision, "REJECTED");
  assert.equal(mismatched.gate, "G3", "close-up from another object → G3");
  assert.equal(carWindow.decision, "REJECTED");
  assert.equal(carWindow.gate, "G5", "vehicle window → G5");
  console.log(`\n✅ scoring e2e passed in ${((Date.now() - t0) / 1000).toFixed(0)}s`);
}

main().catch((e) => {
  console.error("\n❌ scoring e2e failed:", e);
  process.exit(1);
});
