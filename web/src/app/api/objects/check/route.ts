import { namehash, normalize } from "viem/ens";
import { handler } from "@/server/http";
import { HttpError, requireUser } from "@/server/auth";
import { db, q } from "@/server/db";
import { analyzeHero } from "@/server/scoring/pipeline";
import { storeBlob, storeJson } from "@/server/walrus";
import { signDraft } from "@/server/drafts";
import { fromOwnCameraLink } from "@/server/capture";
import { demoHero, isDemo } from "@/server/demo";

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 28) || "object";

export const POST = handler(async (req) => {
  const u = await requireUser(req);
  if (!u.handle || !u.ens_name) throw new HttpError(400, "Choose a handle first");
  const f = await req.formData();
  const image = f.get("image");
  if (!(image instanceof File)) throw new HttpError(400, "image is required");
  const title = String(f.get("title") ?? "").trim();
  if (title.length < 2) throw new HttpError(400, "Give your object a name");
  const description = String(f.get("description") ?? "").trim();
  if (description.length < 10) throw new HttpError(400, "Describe your object in a sentence or two (what it is and how you use it)");
  const buf = Buffer.from(await image.arrayBuffer());
  const liveCamera = await fromOwnCameraLink(String(f.get("captureLinkId") ?? ""), u.id, buf);

  const r: Awaited<ReturnType<typeof analyzeHero>> = isDemo(f.get("demo"))
    ? ((await demoHero(buf, title, description)) as any)
    : await analyzeHero({ image: buf, mime: image.type || "image/jpeg", name: title, description, liveCamera, userId: u.id });
  if (r.decision === "REJECTED") return { decision: r.decision, gate: r.gate, reason: r.reason, tips: r.tips };

  const hero = await storeBlob(buf, image.type || "image/jpeg");
  // unique object label under the user's name
  const base = slug(title);
  let label = base;
  for (let i = 2; ; i++) {
    const taken = await q(db().from("objects").select("id").eq("ens_name", `${label}.${u.ens_name}`).maybeSingle());
    if (!taken) break;
    label = `${base}-${i}`;
  }
  const ensName = normalize(`${label}.${u.ens_name}`);
  const meta = {
    title,
    description,
    profile: r.profile,
    make: String(f.get("make") ?? ""),
    model: String(f.get("model") ?? ""),
    color: String(f.get("color") ?? ""),
    city: String(f.get("city") ?? ""),
  };
  const manifest = await storeJson({ ...meta, ensName, heroBlobId: hero.blobId, heroSha256: hero.sha256, owner: u.sui_address, heroCheck: { analysis: r.analysis, metrics: r.metrics } });
  const heroCheck = { metrics: { phash: r.metrics.phash, eqi: r.metrics.eqi, sharpness: r.metrics.sharpness }, analysis: r.analysis, provenance: r.provenance, liveCamera: r.liveCamera };
  const draft = await signDraft({ uid: u.id, ...meta, ensName, heroBlobId: hero.blobId, manifestBlobId: manifest.blobId, heroCheck });
  return {
    decision: "ACCEPTED",
    tips: r.tips,
    analysis: { description: r.analysis.image_description, condition: r.analysis.condition_summary, match: r.analysis.match_evidence },
    profile: r.profile,
    tx: { category: 0, title, city: meta.city, ensName, ensNamehash: namehash(ensName), heroBlobId: hero.blobId, manifestBlobId: manifest.blobId },
    draft,
  };
});
