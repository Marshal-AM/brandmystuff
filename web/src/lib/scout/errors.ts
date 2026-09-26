/**
 * Turns raw agent/x402/Move errors into something a brand can act on.
 * The raw message is always kept for the "technical details" disclosure.
 */
export type Explained = { title: string; body: string; next: string; tone: "retry" | "config" | "wait"; raw: string };

const RULES: { test: RegExp; title: string; body: string; next: string; tone: Explained["tone"] }[] = [
  {
    test: /EStartInPast|start week is in the past/i,
    title: "That week just rolled over on-chain",
    body: "Scout paid, but the booking week ended on Sui while the payment was settling (demo weeks are only 10 minutes long).",
    next: "Run Scout again. It will book the next free week.",
    tone: "retry",
  },
  {
    test: /per-ad cap|per.payment cap|EOverCap/i,
    title: "Above your per-ad cap",
    body: "The space costs more than the mandate lets Scout spend on a single ad.",
    next: "Raise the per-ad cap on a new mandate, or let Scout pick a cheaper space.",
    tone: "config",
  },
  {
    test: /USDC left|no budget left|EOverBudget|would exceed/i,
    title: "Not enough budget left",
    body: "The mandate doesn't have enough USDC left for this booking.",
    next: "Top up the mandate, then run Scout again.",
    tone: "config",
  },
  {
    test: /paused or revoked|EInactive/i,
    title: "Your mandate is paused",
    body: "Scout can't spend while the mandate is paused or revoked.",
    next: "Resume the mandate (or set a new one) on the agent page.",
    tone: "config",
  },
  {
    test: /expired|EExpired/i,
    title: "Something expired",
    body: "Either the mandate reached its end date or the x402 quote timed out before payment.",
    next: "Check the mandate's expiry, then run Scout again for a fresh quote.",
    tone: "retry",
  },
  {
    test: /ENotAgent/i,
    title: "Wrong signer",
    body: "Only this brand's agent key can spend from the mandate, and the payment was signed by something else.",
    next: "Set a new mandate from the agent page so it names your current agent.",
    tone: "config",
  },
  {
    test: /not available|already booked|ESpaceUnavailable/i,
    title: "The space was just taken",
    body: "Someone booked or paused this space while Scout was paying.",
    next: "Run Scout again to pick the next best space.",
    tone: "retry",
  },
  {
    test: /simulation failed|invalid_amount|invalid_signature|invalid_requirements|replay/i,
    title: "The payment didn't pass the gate's checks",
    body: "brandmystuff's x402 gate verifies every payment before settling it, and this one didn't match what it asked for.",
    next: "Run Scout again. It will request a fresh 402 quote.",
    tone: "retry",
  },
  {
    test: /no live ad spaces|no pick|fits inside the mandate/i,
    title: "Nothing to book right now",
    body: "No verified ad space fits inside the mandate at the moment.",
    next: "Raise the per-ad cap or try again when new spaces are listed.",
    tone: "wait",
  },
  {
    test: /connection|network|fetch failed|ECONNRESET|timed? ?out/i,
    title: "Lost the connection",
    body: "The connection to Scout dropped mid-way.",
    next: "Check the run in Scout's history, then try again.",
    tone: "retry",
  },
  {
    test: /Set a budget mandate/i,
    title: "Scout needs a mandate first",
    body: "Scout can't spend anything until you give it a budget mandate.",
    next: "Set the mandate on the agent page.",
    tone: "config",
  },
];

export function explainError(raw: string | undefined | null): Explained {
  const msg = (raw ?? "").trim() || "Unknown error";
  const r = RULES.find((x) => x.test.test(msg));
  if (r) return { title: r.title, body: r.body, next: r.next, tone: r.tone, raw: msg };
  return { title: "Scout hit a snag", body: "Something unexpected went wrong.", next: "Try again. If it keeps happening, check the technical details below.", tone: "retry", raw: msg };
}
