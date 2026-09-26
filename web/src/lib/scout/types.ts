/**
 * Data contract between the brand agent ("Scout") backend and the Scout experience UI.
 * The server streams ScoutEvent lines (NDJSON); the page folds them into a ScoutLive state.
 */

export type NodeIcon = "eye" | "drop" | "type" | "image" | "ear" | "wave" | "heart" | "key" | "users" | "pin" | "radar" | "coin";
export type LandId = "identity" | "voice" | "audience";

export type ScoutNode = { id: string; title: string; icon: NodeIcon; logs: string[]; result: string };
export type ScoutLand = { id: LandId; index: number; name: string; kicker: string; blurb: string; theme: "light" | "dark"; done: string; nodes: ScoutNode[] };

export type ScoutBrand = { name: string; short: string; url?: string; category: string; logoUrl?: string | null; location?: string | null };

/** A group of spaces (by object type) the agent "flies over" during the scan. */
export type ScoutDistrict = { id: string; name: string; listings: number; thought: string };

export type ArtKind = "billboard" | "metro" | "bus" | "podcast" | "creator" | "newsletter" | "screens" | "stadium" | "radio" | "magazine" | "video" | "cafe";

export type ScoutFactor = { k: string; score: number; weight: number; note: string };

/** One ad space the agent analysed, with everything it read from ENS and how it scored it. */
export type ScoutCandidate = {
  id: string; // Sui space object id
  ensName: string;
  title: string; // space label, e.g. "lid-right"
  objectTitle: string; // e.g. "MacBook Pro 14"
  district: string; // ScoutDistrict.id
  loc: string; // city or "—"
  art: ArtKind; // fallback illustration when there is no photo
  imageUrl: string | null; // real close-up photo of the space (Walrus)
  match: number; // 0-100 agent match score
  reach: string; // e.g. "seen from ~3 m"
  price: number; // USDC per week
  unit: string; // "wk"
  format: string; // e.g. "18×17 cm · rear"
  aqs: number;
  grade: string; // "A+", "A", …
  verified: boolean; // ENS ↔ Sui two-way commitment held
  ensRecords: Record<string, string>; // text records the agent read from ENS
  reasoning: string; // the agent's explanation for this score
  factors: ScoutFactor[]; // weighted breakdown behind `match`
  affordable: boolean; // within the mandate's per-ad cap and remaining budget
};

export type ScoutMandate = {
  id: string; // Sui object id of the BudgetMandate
  agent: string; // agent's Sui address
  budget: number; // USDC total authorised
  spent: number; // USDC spent so far
  remaining: number; // USDC left
  perAdCap: number; // USDC max per booking
  expiresMs: number;
};

export type ScoutPaymentStep = { key: "quote" | "mandate" | "sign" | "submit" | "settle" | "book"; label: string; detail?: string; at: number };

export type ScoutPayment = {
  status: "idle" | "running" | "done" | "failed";
  steps: ScoutPaymentStep[];
  amount?: number; // USDC
  payTo?: string;
  payer?: string; // agent address
  digest?: string; // Sui payment transaction digest
  leaseEns?: string;
  escrowId?: string;
  remainingAfter?: number;
  error?: string;
};

export type ScoutLive = {
  runId: string | null;
  brand: ScoutBrand;
  mandate: ScoutMandate | null;
  lands: ScoutLand[] | null; // null until the brand is decoded
  dna: { k: string; v: string }[] | null;
  universe: { names: number; districts: ScoutDistrict[] } | null; // ENS scan summary
  candidates: ScoutCandidate[] | null; // every analysed space, best first
  pickId: string | null;
  payment: ScoutPayment;
  logs: { at: number; text: string }[];
  error?: string;
};

/** Lines streamed by POST /api/agent/run (and the pay step). */
export type ScoutEvent =
  | { t: "run"; runId: string; brand: ScoutBrand; mandate: ScoutMandate }
  | { t: "log"; text: string }
  | { t: "lands"; lands: ScoutLand[]; dna: { k: string; v: string }[] }
  | { t: "universe"; names: number; districts: ScoutDistrict[] }
  | { t: "candidate"; candidate: ScoutCandidate }
  | { t: "ranked"; candidates: ScoutCandidate[]; pickId: string | null }
  | { t: "pay"; step: ScoutPaymentStep }
  | { t: "paid"; payment: Omit<ScoutPayment, "status" | "steps">; mandate: ScoutMandate }
  | { t: "error"; error: string; stage?: string }
  | { t: "done" };

export const emptyLive = (brand: ScoutBrand, mandate: ScoutMandate | null = null): ScoutLive => ({
  runId: null,
  brand,
  mandate,
  lands: null,
  dna: null,
  universe: null,
  candidates: null,
  pickId: null,
  payment: { status: "idle", steps: [] },
  logs: [],
});

/** Folds one streamed event into the live state (pure). */
export function reduceScout(s: ScoutLive, e: ScoutEvent & { at?: number }): ScoutLive {
  const at = e.at ?? Date.now();
  switch (e.t) {
    case "run":
      return { ...s, runId: e.runId, brand: e.brand, mandate: e.mandate };
    case "log":
      return { ...s, logs: [...s.logs, { at, text: e.text }] };
    case "lands":
      return { ...s, lands: e.lands, dna: e.dna };
    case "universe":
      return { ...s, universe: { names: e.names, districts: e.districts } };
    case "candidate":
      return { ...s, candidates: [...(s.candidates ?? []).filter((c) => c.id !== e.candidate.id), e.candidate] };
    case "ranked":
      return { ...s, candidates: e.candidates, pickId: e.pickId };
    case "pay":
      return { ...s, payment: { ...s.payment, status: "running", steps: [...s.payment.steps, e.step] } };
    case "paid":
      return { ...s, payment: { ...s.payment, ...e.payment, status: "done" }, mandate: e.mandate };
    case "error":
      return s.payment.status === "running" ? { ...s, payment: { ...s.payment, status: "failed", error: e.error }, error: e.error } : { ...s, error: e.error };
    default:
      return s;
  }
}
