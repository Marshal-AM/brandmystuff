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
const laptopSpace: SpaceInput = { label: "lid-right", widthMm: 180, heightMm: 170, placement: "rear", material: "anodised aluminium", categoryKey: "laptop", captureSource: "camera" };

async function main() {
  const t0 = Date.now();
  const hero = await analyzeHero({ image: img("laptop-hero.jpg"), mime: "image/jpeg", categoryKey: "laptop", captureCode: null, userId: uid, checkDuplicates: false });
  console.log("hero:", hero.decision, hero.gate ?? "", hero.reason ?? "", `synthetic=${hero.analysis.synthetic_suspicion}`);
  assert.equal(hero.decision, "ACCEPTED", "laptop hero accepted");

  const catMismatch = await analyzeHero({ image: img("car-hero.jpg"), mime: "image/jpeg", categoryKey: "laptop", captureCode: null, userId: uid, checkDuplicates: false });
  console.log("car-as-laptop hero:", catMismatch.decision, catMismatch.gate, catMismatch.reason);
  assert.equal(catMismatch.decision, "REJECTED", "wrong category rejected");

  const common = { hero: img("laptop-hero.jpg"), heroMime: "image/jpeg", closeupMime: "image/jpeg", heroProvenance: hero.provenance, userId: uid, checkDuplicates: false };
  const [good, blurry, injected, mismatched, carWindow] = await Promise.all([
    analyzeSpace({ ...common, closeup: img("laptop-lid-right.jpg"), input: laptopSpace }),
    analyzeSpace({ ...common, closeup: img("laptop-lid-blurry.jpg"), input: laptopSpace }),
    analyzeSpace({ ...common, closeup: img("laptop-lid-injection.jpg"), input: laptopSpace }),
    analyzeSpace({ ...common, closeup: img("car-rear-window.jpg"), input: laptopSpace }),
    analyzeSpace({
      ...common,
      hero: img("car-hero.jpg"),
      closeup: img("car-rear-window.jpg"),
      input: { label: "rear-window", widthMm: 1100, heightMm: 500, placement: "rear", material: "glass", categoryKey: "car", captureSource: "camera" },
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
