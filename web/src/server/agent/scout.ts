/**
 * Scout — the brand's own agent.
 *
 * 1. Decodes the brand (name, about, location, logo) with Gemini.
 * 2. Discovers every live ad space through ENS: each space is a subname of brandmystuff.eth,
 *    and the agent reads its text records (class, score, grade, price, placement…) live
 *    from Sepolia through the Universal Resolver, checking the ENS ↔ Sui commitment.
 * 3. Scores every space against the brand with weighted, explained factors.
 * 4. Picks the single best affordable, verified space.
 * Paying for it (x402 from the budget mandate) is in pay.ts.
 */
import { ENS_DEPLOYMENT, SUI, blobUrl } from "@/lib/deployment";
import type { ArtKind, ScoutBrand, ScoutCandidate, ScoutDistrict, ScoutEvent, ScoutFactor, ScoutLand, NodeIcon } from "@/lib/scout/types";
import { HttpError } from "../auth";
import { db, ok, q } from "../db";
import { ensText, verifyName } from "../ens/read";
import { generateJson } from "../gemini";
import { agentFor, readMandate } from "./keys";

export type Emit = (e: ScoutEvent) => void | Promise<void>;
const GR = ["—", "C", "B", "A", "A+"];

// ---------------------------------------------------------------- brand
const LAND_SHAPE: { id: ScoutLand["id"]; name: string; kicker: string; theme: "light" | "dark"; done: string; nodes: { id: string; title: string; icon: NodeIcon }[] }[] = [
  {
    id: "identity",
    name: "Identity Meadow",
    kicker: "Visual identity",
    theme: "light",
    done: "Visual identity decoded",
    nodes: [
      { id: "logo", title: "Logo Vision", icon: "eye" },
      { id: "palette", title: "Palette Extractor", icon: "drop" },
      { id: "type", title: "Type Detector", icon: "type" },
      { id: "imagery", title: "Imagery Lens", icon: "image" },
    ],
  },
  {
    id: "voice",
    name: "Voice Lagoon",
    kicker: "Tone & positioning",
    theme: "dark",
    done: "Brand voice decoded",
    nodes: [
      { id: "listen", title: "Story Reader", icon: "ear" },
      { id: "tone", title: "Tone Classifier", icon: "wave" },
      { id: "sentiment", title: "Personality Engine", icon: "heart" },
      { id: "keywords", title: "Keyword Miner", icon: "key" },
    ],
  },
  {
    id: "audience",
    name: "Audience Summit",
    kicker: "Audience & market",
    theme: "light",
    done: "Audience & market decoded",
    nodes: [
      { id: "persona", title: "Persona Builder", icon: "users" },
      { id: "geo", title: "Geo Mapper", icon: "pin" },
      { id: "competitors", title: "Competitor Radar", icon: "radar" },
      { id: "budget", title: "Budget Oracle", icon: "coin" },
    ],
  },
];

const nodeSchema = { type: "object", properties: { logs: { type: "array", items: { type: "string" }, minItems: 3, maxItems: 4 }, result: { type: "string" } }, required: ["logs", "result"] };
const BRAND_SCHEMA = {
  type: "object",
  properties: {
    short: { type: "string", description: "one-word short name" },
    category: { type: "string", description: "e.g. 'D2C specialty coffee'" },
    blurbs: { type: "object", properties: { identity: { type: "string" }, voice: { type: "string" }, audience: { type: "string" } }, required: ["identity", "voice", "audience"] },
    nodes: {
      type: "object",
      properties: Object.fromEntries(LAND_SHAPE.flatMap((l) => l.nodes.map((n) => [n.id, nodeSchema]))),
      required: LAND_SHAPE.flatMap((l) => l.nodes.map((n) => n.id)),
    },
    dna: {
      type: "object",
      properties: { archetype: { type: "string" }, voice: { type: "string" }, audience: { type: "string" }, hotspots: { type: "string" }, idealPlacements: { type: "string" } },
      required: ["archetype", "voice", "audience", "hotspots", "idealPlacements"],
    },
  },
  required: ["short", "category", "blurbs", "nodes", "dna"],
};
type BrandA = { short: string; category: string; blurbs: Record<string, string>; nodes: Record<string, { logs: string[]; result: string }>; dna: Record<string, string> };

const BRAND_SYSTEM = `You are Scout, the ad-buying agent of one brand on brandmystuff (a marketplace for ad spaces on everyday physical objects: laptop lids, cars, helmets, shop windows…).
Decode the brand from what the owner gave you (name, about, location, logo image). Be concrete and specific to THIS brand; never invent statistics, follower counts, reviews or crawled data you were not given. Where you infer, say so briefly.
For each analysis node, write 3-4 short terminal-style log lines describing what you examined and concluded (lowercase, like "reading wordmark · rounded sans"), and a 2-5 word result.
Nodes: logo (the mark itself), palette (colours in the logo), type (lettering style), imagery (imagery that would fit the brand), listen (what the story/about says), tone (voice), sentiment (brand personality), keywords (intent keywords), persona (who buys), geo (where, from the location), competitors (category landscape from general knowledge), budget (how to use the mandate: given budget and per-ad cap in USDC).
DNA: archetype, voice (3 words · separated), audience, hotspots (places), idealPlacements (what kinds of physical ad spaces suit it).`;

async function decodeBrand(brand: { name: string; about: string; location: string; logo: Buffer | null; logoMime: string }, mandate: { budget: number; perAdCap: number }) {
  const parts: any[] = [
    { text: `Brand name: ${brand.name}\nAbout: ${brand.about || "(not given)"}\nLocation: ${brand.location || "(not given)"}\nBudget mandate: ${mandate.budget} USDC total, at most ${mandate.perAdCap} USDC per ad.` },
  ];
  if (brand.logo) parts.push({ text: "Brand logo:" }, { image: brand.logo, mime: brand.logoMime });
  return generateJson<BrandA>({ system: BRAND_SYSTEM, parts, schema: BRAND_SCHEMA });
}

// ---------------------------------------------------------------- scoring
const FACTORS = [
  { key: "audience", k: "Audience fit", weight: 0.3 },
  { key: "context", k: "Context & placement", weight: 0.2 },
  { key: "visibility", k: "Visibility & quality", weight: 0.2 },
  { key: "safety", k: "Brand safety & tone", weight: 0.15 },
  { key: "value", k: "Value for budget", weight: 0.15 },
] as const;
const fs = { type: "object", properties: { score: { type: "integer", minimum: 0, maximum: 100 }, note: { type: "string" } }, required: ["score", "note"] };
const SCORE_SCHEMA = {
  type: "object",
  properties: {
    spaces: {
      type: "array",
      items: {
        type: "object",
        properties: { id: { type: "string" }, reasoning: { type: "string" }, ...Object.fromEntries(FACTORS.map((f) => [f.key, fs])) },
        required: ["id", "reasoning", ...FACTORS.map((f) => f.key)],
      },
    },
    districts: { type: "array", items: { type: "object", properties: { id: { type: "string" }, thought: { type: "string" } }, required: ["id", "thought"] } },
  },
  required: ["spaces", "districts"],
};
type ScoreA = { spaces: ({ id: string; reasoning: string } & Record<(typeof FACTORS)[number]["key"], { score: number; note: string }>)[]; districts: { id: string; thought: string }[] };

const SCORE_SYSTEM = `You are Scout, choosing where to place ONE ad for your brand. You are given the brand profile and every live ad space on brandmystuff with the ENS text records you just read for it (class, attested AQS score and grade, price, placement, dimensions) plus its object description and photo.
Score each space 0-100 on: audience (would the brand's audience see this object where it's used?), context (does the object and placement suit the brand's story and style?), visibility (size, viewing distance, attested AQS/grade and confidence), safety (brand-safety and tone fit), value (reach and quality for the price, relative to the per-ad cap). Give a one-line note per factor and a 2-3 sentence reasoning in first person ("I…"). Be discerning: scores should spread out. Also give a short, playful first-person "thought" for each district (object type) id.`;

const art = (type: string): ArtKind => {
  const t = type.toLowerCase();
  if (/laptop|tablet|screen|monitor|phone/.test(t)) return "screens";
  if (/car|van|bus|truck|bike|scooter|vehicle|boat/.test(t)) return "bus";
  if (/helmet|bag|backpack|jacket|shirt|cap|apparel/.test(t)) return "creator";
  if (/guitar|drum|instrument|case|speaker/.test(t)) return "podcast";
  if (/fridge|window|door|wall|shop|fence/.test(t)) return "billboard";
  if (/cup|mug|cafe|table/.test(t)) return "cafe";
  return "billboard";
};

const TEXT_KEYS = ["class", "description", "eth.brandmystuff.attested.aqs", "eth.brandmystuff.attested.grade", "eth.brandmystuff.attested.confidence", "eth.brandmystuff.price", "eth.brandmystuff.placement", "eth.brandmystuff.dimensions", "eth.brandmystuff.status"];

async function pool<T, R>(items: T[], n: number, fn: (t: T, i: number) => Promise<R>) {
  const out: R[] = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) {
      const k = i++;
      out[k] = await fn(items[k], k);
    }
  }));
  return out;
}

async function fetchImage(blob: string | null | undefined) {
  if (!blob) return null;
  try {
    const r = await fetch(blobUrl(blob));
    if (!r.ok) return null;
    return { buf: Buffer.from(await r.arrayBuffer()), mime: r.headers.get("content-type") || "image/jpeg" };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------- run
export async function runScout(userId: string, emit: Emit) {
  const u = await q(db().from("users").select("*").eq("id", userId).single());
  if (u.account_type !== "brand") throw new HttpError(403, "Only brand accounts have an agent");
  const agent = await agentFor(userId);
  if (!agent.mandateId) throw new HttpError(400, "Set a budget mandate for your agent first");
  const mandate = await readMandate(agent.mandateId);
  if (!mandate?.active) throw new HttpError(400, "Your mandate is paused or revoked");
  if (mandate.expiresMs < Date.now()) throw new HttpError(400, "Your mandate has expired");
  if (mandate.remaining <= 0) throw new HttpError(400, "Your mandate has no budget left");

  const brand: ScoutBrand = { name: u.brand_name ?? u.display_name ?? u.handle, short: (u.brand_name ?? u.handle ?? "brand").split(/\s+/)[0], category: "", logoUrl: u.brand_logo_blob_id ? blobUrl(u.brand_logo_blob_id) : null, location: u.brand_location ?? null, url: u.website ?? undefined };
  const run = await q(db().from("agent_runs").insert({ user_id: userId, brand, status: "running" }).select("id").single());
  const events: any[] = [];
  const out: Emit = async (e) => {
    events.push({ ...e, at: Date.now() });
    await emit(e);
  };
  const save = (patch: Record<string, unknown>) => ok(db().from("agent_runs").update({ ...patch, events }).eq("id", run.id));

  try {
    await out({ t: "run", runId: run.id, brand, mandate });
    await out({ t: "log", text: `Mandate ${mandate.id.slice(0, 10)}… · ${mandate.remaining} of ${mandate.budget} USDC left · max ${mandate.perAdCap} USDC per ad` });

    // 1) decode the brand
    await out({ t: "log", text: `Reading ${brand.name}: story, location${u.brand_logo_blob_id ? ", logo" : ""}` });
    const logo = await fetchImage(u.brand_logo_blob_id);
    const b = await decodeBrand({ name: brand.name, about: u.brand_about ?? u.bio ?? "", location: u.brand_location ?? "", logo: logo?.buf ?? null, logoMime: logo?.mime ?? "image/png" }, mandate);
    brand.short = b.short || brand.short;
    brand.category = b.category;
    const lands: ScoutLand[] = LAND_SHAPE.map((l, i) => ({
      id: l.id,
      index: i + 1,
      name: l.name,
      kicker: l.kicker,
      blurb: b.blurbs[l.id] ?? "",
      theme: l.theme,
      done: l.done,
      nodes: l.nodes.map((n) => ({ ...n, logs: b.nodes[n.id]?.logs ?? [], result: b.nodes[n.id]?.result ?? "" })),
    }));
    const dna = [
      { k: "Archetype", v: b.dna.archetype },
      { k: "Voice", v: b.dna.voice },
      { k: "Audience", v: b.dna.audience },
      { k: "Hotspots", v: b.dna.hotspots },
      { k: "Mandate", v: `${mandate.remaining} USDC · ≤ ${mandate.perAdCap} per ad` },
    ];
    await out({ t: "run", runId: run.id, brand, mandate });
    await out({ t: "lands", lands, dna });
    await save({ brand, lands, dna });

    // 2) discover spaces through ENS
    const spaces = await q(db().from("spaces").select("*, objects(title, description, city, object_type, category, tags, hero_blob_id, viewing_distance_m)").eq("status", "available").not("ens_name", "is", null).order("rank_score", { ascending: false }).limit(24));
    const ensLive = await q(db().from("ens_names").select("name", { count: "exact", head: false }).eq("status", "registered"));
    const districtsMap = new Map<string, ScoutDistrict>();
    for (const s of spaces) {
      const t = ((s as any).objects?.object_type ?? "object").toLowerCase();
      const d = districtsMap.get(t) ?? { id: t, name: t.replace(/\b\w/g, (m: string) => m.toUpperCase()), listings: 0, thought: "" };
      d.listings++;
      districtsMap.set(t, d);
    }
    await out({ t: "log", text: `Resolving subnames of ${ENS_DEPLOYMENT.parentName} on Sepolia · ${spaces.length} live ad spaces` });
    await out({ t: "universe", names: (ensLive as any[]).length, districts: [...districtsMap.values()] });
    if (!spaces.length) throw new HttpError(404, "There are no live ad spaces to consider yet");

    const read = await pool(spaces, 4, async (s: any) => {
      const [records, v] = await Promise.all([
        Promise.all(TEXT_KEYS.map(async (k) => [k, (await ensText(s.ens_name, k)) ?? ""] as const)),
        verifyName(s.ens_name, s.id, []),
      ]);
      const rec = Object.fromEntries(records.filter(([, val]) => val));
      await out({ t: "log", text: `ENS ${s.ens_name} · ${Object.keys(rec).length} records · ${v.verified ? "sui.object verified" : "unverified"}` });
      return { s, rec, verified: v.verified };
    });

    // 3) score every space
    await out({ t: "log", text: `Scoring ${read.length} spaces against ${brand.name}` });
    const photos = await pool(read, 4, async (r) => fetchImage(r.s.closeup_blob_id));
    const parts: any[] = [{ text: `BRAND PROFILE\n${JSON.stringify({ name: brand.name, category: b.category, dna: b.dna, about: u.brand_about, location: u.brand_location, mandate: { remaining: mandate.remaining, perAdCap: mandate.perAdCap } })}` }];
    read.forEach((r, i) => {
      const o = r.s.objects ?? {};
      parts.push({ text: `SPACE id=${r.s.id} district=${(o.object_type ?? "object").toLowerCase()}\nENS ${r.s.ens_name}\nrecords ${JSON.stringify(r.rec)}\nobject "${o.title}" — ${o.description ?? ""} · city ${o.city ?? "—"} · seen from ~${r.s.viewing_distance_m ?? o.viewing_distance_m ?? "?"} m\nprice ${Number(r.s.price_per_week) / 1e6} USDC/week · ENS↔Sui verified: ${r.verified}` });
      if (photos[i]) parts.push({ image: photos[i]!.buf, mime: photos[i]!.mime });
    });
    const sc = await generateJson<ScoreA>({ system: SCORE_SYSTEM, parts, schema: SCORE_SCHEMA });
    for (const d of sc.districts ?? []) {
      const x = districtsMap.get(d.id.toLowerCase());
      if (x) x.thought = d.thought;
    }

    const candidates: ScoutCandidate[] = read.map((r) => {
      const a = sc.spaces.find((x) => x.id === r.s.id);
      const o = r.s.objects ?? {};
      const factors: ScoutFactor[] = FACTORS.map((f) => ({ k: f.k, weight: f.weight, score: Math.max(0, Math.min(100, a?.[f.key]?.score ?? 0)), note: a?.[f.key]?.note ?? "" }));
      const price = Number(r.s.price_per_week) / 1e6;
      const affordable = price <= mandate.perAdCap && price <= mandate.remaining;
      return {
        id: r.s.id,
        ensName: r.s.ens_name,
        title: r.s.label,
        objectTitle: o.title ?? "",
        district: (o.object_type ?? "object").toLowerCase(),
        loc: o.city ?? "—",
        art: art(o.object_type ?? ""),
        imageUrl: r.s.closeup_blob_id ? blobUrl(r.s.closeup_blob_id) : null,
        match: Math.round(factors.reduce((t, f) => t + f.score * f.weight, 0)),
        reach: `seen from ~${r.s.viewing_distance_m ?? o.viewing_distance_m ?? "?"} m`,
        price,
        unit: "wk",
        format: `${r.s.width_mm / 10}×${r.s.height_mm / 10} cm · ${r.s.placement}`,
        aqs: r.s.aqs,
        grade: GR[r.s.grade] ?? "—",
        verified: r.verified,
        ensRecords: r.rec,
        reasoning: a?.reasoning ?? "I couldn't assess this space.",
        factors,
        affordable,
      };
    });
    candidates.sort((x, y) => y.match - x.match);
    for (const c of candidates) await out({ t: "candidate", candidate: c });
    const pick = candidates.find((c) => c.affordable && c.verified) ?? null;
    await out({ t: "universe", names: (ensLive as any[]).length, districts: [...districtsMap.values()] });
    await out({ t: "ranked", candidates, pickId: pick?.id ?? null });
    await out({ t: "log", text: pick ? `Best fit: ${pick.title} on ${pick.objectTitle} · match ${pick.match} · ${pick.price} USDC/wk` : "No verified space fits inside the mandate" });
    await save({ status: pick ? "ranked" : "no_pick", universe: { names: (ensLive as any[]).length, districts: [...districtsMap.values()] }, candidates, pick_id: pick?.id ?? null });
    return run.id as string;
  } catch (e: any) {
    await out({ t: "error", error: e?.message ?? "Scout hit a problem", stage: "scout" });
    await save({ status: "failed", error: String(e?.message ?? e).slice(0, 500), finished_at: new Date().toISOString() });
    throw e;
  }
}

export { SUI };
