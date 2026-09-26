/** A realistic ScoutLive sample for previewing the Scout experience without the backend. */
import type { ScoutCandidate, ScoutLand, ScoutLive, ScoutPaymentStep } from "@/lib/scout/types";

const WALRUS = "https://aggregator.walrus-testnet.walrus.space/v1/blobs/";

export const FIXTURE_LANDS: ScoutLand[] = [
  {
    id: "identity",
    index: 1,
    name: "Identity Meadow",
    kicker: "Visual identity",
    blurb: "Reading the logo, palette, type and imagery",
    theme: "light",
    done: "Visual identity decoded",
    nodes: [
      { id: "logo", title: "Logo Vision", icon: "eye", logs: ["GET walrus blob · logo.png", "vision model: gemini", "mark: sunrise over a cup"], result: "Warm, geometric mark" },
      { id: "palette", title: "Palette Extractor", icon: "drop", logs: ["sampling logo pixels", "deep roast / cream / sunrise"], result: "Earthy, premium palette" },
      { id: "type", title: "Type Detector", icon: "type", logs: ["reading wordmark", "geometric sans · rounded"], result: "Modern, friendly type" },
      { id: "imagery", title: "Imagery Lens", icon: "image", logs: ["themes: morning light, hands"], result: "Warm lifestyle imagery" },
    ],
  },
  {
    id: "voice",
    index: 2,
    name: "Voice Lagoon",
    kicker: "Tone & keywords",
    blurb: "Listening to how the brand describes itself",
    theme: "dark",
    done: "Brand voice decoded",
    nodes: [
      { id: "listen", title: "About Reader", icon: "ear", logs: ["parsing brand story · 64 words", "entities: cold brew, oat latte"], result: "Craft coffee, made slow" },
      { id: "tone", title: "Tone Classifier", icon: "wave", logs: ["warm 0.81 · witty 0.64", "formal 0.12"], result: "Warm & witty voice" },
      { id: "sentiment", title: "Values Engine", icon: "heart", logs: ["values: craft, calm, community"], result: "Calm, craft-first values" },
      { id: "keywords", title: "Keyword Miner", icon: "key", logs: ['"slow mornings" "single origin"', '"desk ritual"'], result: "12 intent keywords" },
    ],
  },
  {
    id: "audience",
    index: 3,
    name: "Audience Summit",
    kicker: "Audience & market",
    blurb: "Mapping who buys, and where they see things",
    theme: "light",
    done: "Audience & market decoded",
    nodes: [
      { id: "persona", title: "Persona Builder", icon: "users", logs: ["3 clusters found", "urban creators 24–34 · 41%"], result: "Urban creators, 24–34" },
      { id: "geo", title: "Geo Mapper", icon: "pin", logs: ["home base: Tokyo", "cafés · coworking · transit"], result: "Tokyo, café belt" },
      { id: "competitors", title: "Placement Radar", icon: "radar", logs: ["best surfaces: laptops, bags", "avoid: vehicles at speed"], result: "Carried, close-up surfaces" },
      { id: "budget", title: "Budget Oracle", icon: "coin", logs: ["mandate: 5.00 USDC", "cap: 1.00 USDC per ad"], result: "≤ 1 USDC per booking" },
    ],
  },
];

const pick: ScoutCandidate = {
  id: "0x72cbd892be236dea4e40e714bba024b8fa34cb0c9a2ac9d981d5d78743faa6d0",
  ensName: "lid-right.e2e-macbook-pro.e2e-own-us98k.brandmystuff.eth",
  title: "lid-right",
  objectTitle: "E2E MacBook Pro",
  district: "laptop",
  loc: "Tokyo",
  art: "screens",
  imageUrl: WALRUS + "DKs-l3gBN-pX-yEZhrPyMgNq9hYhJbyV147RyWweZ_0",
  match: 91,
  reach: "seen from ~3 m",
  price: 0.5,
  unit: "wk",
  format: "18×17 cm · rear",
  aqs: 93,
  grade: "A+",
  verified: true,
  ensRecords: {
    class: "AdSpace",
    description: "lid-right — 18×17 cm, rear",
    "eth.brandmystuff.attested.aqs": "93",
    "eth.brandmystuff.attested.grade": "A+",
    "eth.brandmystuff.price": "usdc:0.5/week",
    "eth.brandmystuff.placement": "rear",
    "eth.brandmystuff.status": "available",
  },
  reasoning:
    "A laptop lid in Tokyo cafés puts the brand at eye level for exactly the creators it wants, for hours at a time. A+ quality, a clean anodised surface and a price well inside the per-ad cap make it the strongest option.",
  factors: [
    { k: "Audience fit", score: 94, weight: 0.35, note: "Café and coworking creators, 24–34." },
    { k: "Visibility", score: 88, weight: 0.25, note: "Seen at ~3 m, long dwell time." },
    { k: "Quality (AQS)", score: 93, weight: 0.2, note: "A+ · clean, flat surface." },
    { k: "Price vs mandate", score: 90, weight: 0.2, note: "0.50 USDC of a 1.00 USDC cap." },
  ],
  affordable: true,
};

export const FIXTURE_CANDIDATES: ScoutCandidate[] = [
  pick,
  {
    ...pick,
    id: "0x2",
    ensName: "rear-window.honda-fit.kenji.brandmystuff.eth",
    title: "rear-window",
    objectTitle: "Honda Fit",
    district: "car",
    loc: "Osaka",
    art: "bus",
    imageUrl: null,
    match: 58,
    price: 2,
    format: "60×20 cm · rear",
    aqs: 71,
    grade: "B",
    reasoning: "Wide reach, but seen at speed from 10–15 m and in the wrong city for this brand. Also above the per-ad cap.",
    factors: [
      { k: "Audience fit", score: 52, weight: 0.35, note: "Drivers, not café creators." },
      { k: "Visibility", score: 70, weight: 0.25, note: "Large, but read at speed." },
      { k: "Quality (AQS)", score: 71, weight: 0.2, note: "B · curved glass." },
      { k: "Price vs mandate", score: 20, weight: 0.2, note: "2.00 USDC exceeds the 1.00 cap." },
    ],
    affordable: false,
    ensRecords: { class: "AdSpace", "eth.brandmystuff.attested.aqs": "71", "eth.brandmystuff.price": "usdc:2/week" },
  },
  {
    ...pick,
    id: "0x3",
    ensName: "case-front.guitar-case.mika.brandmystuff.eth",
    title: "case-front",
    objectTitle: "Guitar case",
    district: "instrument",
    loc: "Tokyo",
    art: "creator",
    imageUrl: null,
    match: 74,
    price: 0.8,
    format: "30×22 cm · front",
    aqs: 82,
    grade: "A",
    reasoning: "Carried through Tokyo by a gigging musician: good city match and a creative crowd, but less dwell time than a laptop in a café.",
    factors: [
      { k: "Audience fit", score: 78, weight: 0.35, note: "Creative, but nightlife-leaning." },
      { k: "Visibility", score: 66, weight: 0.25, note: "Mostly seen in transit." },
      { k: "Quality (AQS)", score: 82, weight: 0.2, note: "A · textured fabric." },
      { k: "Price vs mandate", score: 72, weight: 0.2, note: "0.80 USDC of a 1.00 cap." },
    ],
    ensRecords: { class: "AdSpace", "eth.brandmystuff.attested.aqs": "82", "eth.brandmystuff.price": "usdc:0.8/week" },
  },
];

const t0 = Date.now();
export const FIXTURE_STEPS: ScoutPaymentStep[] = [
  { key: "quote", label: "402 Payment Required", detail: "0.50 USDC → brandmystuff · intent 7c1e…", at: t0 },
  { key: "mandate", label: "Mandate check passed", detail: "0.50 ≤ 1.00 cap · 5.00 left", at: t0 + 400 },
  { key: "sign", label: "Signed mandate::spend", detail: "agent 0x5c7e…a41b", at: t0 + 800 },
  { key: "submit", label: "PAYMENT-SIGNATURE sent", detail: "retrying /api/x402/leases", at: t0 + 1200 },
  { key: "settle", label: "Settled on Sui", detail: "digest 8Hq3…pX2d", at: t0 + 2400 },
  { key: "book", label: "Lease booked", detail: "l-14.lid-right…brandmystuff.eth", at: t0 + 3000 },
];

export const FIXTURE: ScoutLive = {
  runId: "run-fixture",
  brand: { name: "Lumen Coffee Co.", short: "Lumen", url: "lumen.coffee", category: "Specialty coffee", logoUrl: null, location: "Tokyo" },
  mandate: { id: "0x9b1e5c0000000000000000000000000000000000000000000000000000e5c0", agent: "0x5c7e00000000000000000000000000000000000000000000000000000000a41b", budget: 5, spent: 0, remaining: 5, perAdCap: 1, expiresMs: t0 + 30 * 86400_000 },
  lands: FIXTURE_LANDS,
  dna: [
    { k: "Archetype", v: "The Everyday Creator" },
    { k: "Voice", v: "Warm · Witty · Unhurried" },
    { k: "Audience", v: "Urban creators, 24–34" },
    { k: "Hotspots", v: "Tokyo cafés & coworking" },
    { k: "Mandate", v: "5 USDC · ≤ 1 per ad" },
  ],
  universe: {
    names: 38,
    districts: [
      { id: "laptop", name: "Laptops & devices", listings: 1, thought: "Creators work on laptops…" },
      { id: "car", name: "Cars & vehicles", listings: 1, thought: "Big, but seen at speed…" },
      { id: "instrument", name: "Instrument cases", listings: 1, thought: "Carried through the city…" },
    ],
  },
  candidates: FIXTURE_CANDIDATES,
  pickId: pick.id,
  payment: {
    status: "done",
    steps: FIXTURE_STEPS,
    amount: 0.5,
    payTo: "0xc01af55e5dd68d924bd50e9c1556e07cd07cc1582e0f14cc0fdea17017c03848",
    payer: "0x5c7e00000000000000000000000000000000000000000000000000000000a41b",
    digest: "8Hq3xK2mZpX2dAbCdEfGhJkLmNoPqRsTuVwXyZ12345",
    leaseEns: "l-14.lid-right.e2e-macbook-pro.e2e-own-us98k.brandmystuff.eth",
    escrowId: "0xescrow",
    remainingAfter: 4.5,
  },
  logs: [],
};
