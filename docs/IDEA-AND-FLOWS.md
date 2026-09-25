# brandmystuff — Finalized Idea & End-to-End Flows

> Status: v2.0 (2026-09-25) — **testnet MVP: every flow below works end-to-end on Sui testnet + Sepolia with test funds.** Legal and KYC parts are realistically mocked · Companion docs: [PRD](./PRD.md) · [AQS scoring](./AD-QUALITY-SCORING.md) · [Tokenisation (Sui)](./TOKENISATION-SPEC.md) · [ENSv2 integration](./ENS-INTEGRATION.md)

---

## 1. The idea in one paragraph

**brandmystuff turns any physical thing you own into rentable, tokenisable ad inventory.**

1. You photograph an object (a laptop, car, helmet, backpack, storefront window or wall) and mark its **ad spaces**, each with a name, a size and a close-up photo.
2. A Gemini vision judge scores every space with a transparent **Ad-Space Quality Score (AQS)**.
3. Each space is shown with the close-up photo the owner took of it, next to the full-object photo.
4. Each space becomes a listing that brands can **lease** for a period. Payment is USDC on **Sui**, made from a wallet or, for AI agents, through **x402**. The money is released only when the owner proves the ad is actually displayed.
5. Owners can go a step further and **tokenise** a space: sell fractional rights to its future lease income to verified investors, like real-estate RWA tokenisation, but for a laptop lid.

Every user, object, space and lease is an **ENSv2 name** (`lid-center.macbook.alice.brandmystuff.eth`) whose records hold the listing's public metadata, permissions and lease expiry.

## 2. Where it comes from — the "Brand My Mac" trend

| Evidence | Source |
|---|---|
| 2026-08-26: @VynseDev auctioned 10 sticker spots on the lid of a MacBook Pro he didn't own yet. The tweet got 10.38M views. | https://x.com/VynseDev/status/2092544016315306400 |
| The lid was split into 3 sizes: L 9.5×5.5 cm (3 spots), M 9.5×4 cm (3), S 4.5×4.5 cm (4). Palm-rest, charger and mouse spots were added in week 2. Starting prices were €125/€200/€400. | https://brandmymac.com |
| Result: €7,955 raised (315% of the €2,529 goal), 20 of 20 spots sold, 150 bids from 64 brands. The top spot went for €1,715. | https://brandmymac.com, https://www.techspot.com/news/113653-developer-auctions-off-sticker-space-macbook-doesnt-own.html |
| **6 of 20 winners defaulted** under a 20%-deposit-then-invoice model. | https://brandmymac.com/terms |
| The originator launched **BrandMyLaptop.com**, a marketplace for laptops only. It takes 10% (fixed price) or 15% (auction). Stats: **1,632 free spots vs 32 taken**, and a median of 14 page views for small sellers. | https://brandmylaptop.com/terms, https://brandmylaptop.com/stats |
| Variants: Brand my Tesla, brandmysuitcase, brandmybackpack.lol, outbid.lol, and adspaces.fun (a crypto-rails waitlist for "a suitcase, a race kit, a laptop lid, a forehead"). | research report |
| Vehicle-wrap incumbents (Carvertise, Wrapify, Nickelytics) verify display with install, monthly and removal photos. | https://carvertise.com/drivers/, https://wrapify.com/drive/ |

**What we learned and designed for**
1. **Demand and trust are the bottleneck, not supply.** So we rank by quality (AQS), let brands and agents book across many objects, and show verifiable proof.
2. **Buyers want evidence.** We provide an explainable score, periodic proof-of-display photos that are public and on-chain, and tracked links.
3. **Collect payment upfront.** The full lease amount sits in escrow on Sui and is released in tranches on proof.
4. **Owners should be able to capitalise future ad income.** Tokenisation is the differentiator.
5. **Generalise beyond laptops** with a predefined object catalogue.
6. **Let agents buy.** Agents can pay through x402, so an AI marketing agent can discover and lease inventory on its own.

## 3. Actors

| Actor | Wants | Key surfaces |
|---|---|---|
| **Owner** | Earn from things they already carry or own; optionally get cash now by tokenising | Onboarding, Object wizard, Space dashboard, Proof check-ins, Tokenise wizard, Earnings |
| **Advertiser** | Cheap, authentic, verifiable physical presence | Marketplace, Space detail, Checkout, Creative upload, Campaign dashboard |
| **AI agent** | Programmatic discovery and leasing | MCP tools + x402 endpoints, advertised via `agent.brandmystuff.eth` |
| **Investor** | Yield from ad-lease income | Offerings, Portfolio, Claims, Secondary market |
| **Platform ops** | Moderation, disputes, scoring quality | Admin console |

## 4. Core entities & naming

```
User  (Profile on Sui · alice.brandmystuff.eth)
 └── Object  (ListedObject · macbook.alice.brandmystuff.eth)           ← grouping only
      └── Ad Space  (AdSpace · lid-center.macbook.alice…)               ← THE LISTING: own AQS, size, price, calendar
           ├── Offering (SpaceOffering, optional tokenisation)         ← revenue units, holders, distributions
           └── Lease  (AdLease + LeaseEscrow · l-0007.lid-center.…)    ← advertiser, period, creative, proofs
```
The ad space is the **atomic listing**. Score, price, size, availability, tokenisation and leases are all space-specific. Objects and users are containers.

---

## 5. Flows

Each flow lists: **UX steps**, then the **system steps** that implement them, with the specs and docs involved.

### F1. Sign up / log in
**UX:** "Continue with Google / Apple / X / email / passkey" → choose a handle → done. Users with an external Sui wallet click "Connect wallet".

**System:**
1. **Privy** login (`@privy-io/react-auth`) (https://docs.privy.io/authentication/user-authentication/privy-auth).
2. Silently create the **Sui embedded wallet** with `createWallet({chainType:'sui'})` from `@privy-io/react-auth/extended-chains` (https://docs.privy.io/wallets/using-wallets/other-chains/sui). Also create the **Ethereum embedded wallet** (`embeddedWallets.ethereum.createOnLogin`), which owns the user's ENS names but never signs anything in v1.
3. For external wallets, use `@mysten/dapp-kit-react`: a "Sign in with Sui" nonce is signed and checked with `verifyPersonalMessageSignature` (https://sdk.mystenlabs.com/dapp-kit).
4. **Wallet panel:**
   - SUI and USDC balances and a copy-address button;
   - **Send** (SUI or USDC to any address);
   - **"Get test funds"**: the platform key sends 0.2 SUI + 1 USDC, once per user per 24 h;
   - faucet links as a fallback.
   Users pay their own (tiny) SUI gas.
5. The user signs `profile::create`.
6. The platform key registers `alice.brandmystuff.eth` → the user's EVM wallet and writes `addr(60)`, `addr(784)` (Sui) and `class=Person` ([ENS §3, §4.3](./ENS-INTEGRATION.md)). The platform pays all ENS gas.

### F2. List an object
**UX (mobile-first, in-app camera):**
1. **Name it and describe it** — anything the owner has (laptop, car, guitar case, fridge, shop window…). There are no categories. Optional make, model, colour and city.
3. **Hero photo** of the full object, with a 4-character capture code written on a note placed in the shot (anti-fraud, [AQS §2.3](./AD-QUALITY-SCORING.md)).
4. The hero photo is checked:
   - authenticity (capture code, C2PA, duplicate detection, AI/stock/screen-photo check by the model);
   - the photo matches the name and description (else rejected);
   - the AI derives the object profile: type, tags, viewer mode, typical viewing distance, prohibited zones (shown to the owner);
   - brand safety.
   **Rejected:** reason + Retake. **Accepted:** the owner signs `asset::create_object`, and the object page opens with an **"Add space"** button.

**System:** the photo goes to Walrus via the server-side publisher (https://docs.wal.app/docs/http-api/storing-blobs). After `ObjectCreated`, the platform key registers `macbook.alice…` in ENS ([ENS §2, §4.3](./ENS-INTEGRATION.md)).

### F3. Add a space (upload → instant AI analysis → listed or rejected)
Full spec: [AD-QUALITY-SCORING.md](./AD-QUALITY-SCORING.md).

**UX: the "Add space" modal**
1. Enter the details:
   - name;
   - W×H cm (optional ID-card scale reference);
   - placement and material.
   Then take the **close-up photo of that section alone**. Light on-device checks for blur and glare run before upload.
2. **Analysis runs right in the modal** (about 15–40 s), with live steps: "Checking photo quality → Checking authenticity → Scoring the space".
3. **Result:**
   - **Accepted:** grade badge, AQS, confidence, an 11-criterion radar, the top strengths and weaknesses with evidence, and tips. The owner enters the **fixed price per week** and taps **List space** (one signature). The space is live.
   - **Rejected:** the reason (e.g. "blurry photo", "doesn't match your object", "this area can't carry an ad", "score below 40") and tips, with a **Retake** button. Nothing is listed.
4. Repeat for more spaces.

**System (all within the upload request):**
1. **P0 metrics in code:** sharpness, exposure, noise, resolution, px/cm, pHash, C2PA, contrast.
2. **P1 integrity gates:**
   - duplicates
   - AI-generated detection
   - close-up belongs to the object
   - dimension sanity
3. **P2 brand safety** and **prompt-injection** defence.
4. **P3 rubric:** `gemini-3.1-flash-lite`, N=3, evidence before score, median. If the samples disagree, 2 more samples are drawn (median of 5).
5. **P5 aggregation in code** → AQS 0–100, grade, confidence, `rank_score`. Accepted if every gate passed and AQS ≥ 40.
6. **On accept:**
   - the report goes to Walrus;
   - the owner signs `asset::add_space(…, price_per_week)`;
   - the operator calls `asset::apply_score`, and the space becomes AVAILABLE;
   - the platform key registers `lid-center.macbook.alice…` in ENS and writes the `attested.*`, price and status records.
7. **On reject:** nothing is written on-chain or to ENS.

### F4. Change price / pause
- The owner can change the fixed weekly price any time (`asset::set_price`; existing leases keep their price).
- The owner can pause, unpause or retire a space.
- ENS `price` and `status` records follow.

### F5. Browse the marketplace (advertiser)
- **Default sort: AQS rank score.** Other sorts: price, newest.
- **Filters:** keyword search, AI-derived tag chips, city, grade, size, placement, price, availability, tokenised, sponsored.
- **Space card:**
  - the space's close-up photo;
  - names and ENS name;
  - grade + AQS;
  - size, placement, fixed price per week, next free week;
  - accepted-proof count;
  - **Sponsored** label if applicable.
- **Object view:** the hero photo plus a list of its spaces, each shown with its own close-up photo.
- **Sponsored** objects appear in clearly labelled slots and never change organic order ([PRD §7.4](./PRD.md)).
- **Data:** the Supabase read model (Sui events + ENS relayer log). Detail pages verify live against ENS and Sui ([ENS §6](./ENS-INTEGRATION.md)).
- **"Message owner"** opens the chat (F17).

### F6. Lease a space (advertiser, human)
1. Pick the start week and duration (1–52 weeks) on the calendar. The total is the owner's weekly price × weeks.
2. **Pick a creative from your brand kit** (F18), or upload one into the kit on the spot. A fit preview is shown on the close-up photo, with a legibility estimate.
3. Add the landing URL (a tracked `/r/<lease>` redirect is generated) and the brand name.
4. **Pay with USDC on Sui** from the embedded or external wallet. One PTB runs `lease::book`, which moves the full amount into `LeaseEscrow`, mints `AdLease{PENDING_APPROVAL}` and blocks the weeks. The advertiser pays SUI gas.
5. ENS: the platform key puts `l-<seq>` into **RESERVED** state under the space ([ENS §5.1](./ENS-INTEGRATION.md)). The owner and advertiser chat is linked to the lease.

### F7. Lease a space (AI agent, x402)
1. The agent finds a space via MCP `search_spaces`, then calls `quote_lease` to get the x402 `PaymentRequired`.
2. `POST /api/x402/leases` (with `creativeUrl`, which is added to the agent's brand kit) returns **402** + `PAYMENT-REQUIRED` when sent without payment:
   - scheme `exact`, network `sui:testnet`
   - asset: USDC coin type
   - amount (atomic)
   - payTo: treasury
   - extra: `intentId`
3. The agent signs a USDC transfer and retries with `PAYMENT-SIGNATURE`.
4. The server acts as its own facilitator:
   - verifies the signature, dry-run, exact balance change and no replay;
   - settles;
   - the operator calls `lease::book_for(advertiser = payer)` with the received USDC;
   - returns 200 + `PAYMENT-RESPONSE` + lease and ENS name.
5. If booking fails after settlement, the USDC is refunded automatically.
6. Spec: [Tokenisation §6.6 & §15](./TOKENISATION-SPEC.md); x402 Sui scheme: https://github.com/x402-foundation/x402/blob/main/specs/schemes/exact/scheme_exact_sui.md

### F8. Creative approval, printing & install
1. The owner is notified and has **5 days** to approve or reject; they can discuss it first in the chat. A rejection or no answer means an automatic full refund.
2. On approval:
   - the owner signs `lease::approve_creative`;
   - the platform key registers `l-7.lid-center…` → the advertiser's address with **expiry = lease end**, and writes creative, url and brand records ([ENS §5.1](./ENS-INTEGRATION.md)).
3. **Print files:** the owner downloads the creative in several sizes:
   - the **exact space size** (W×H mm, 3 mm bleed, cut line);
   - standard **S / M / L** sizes;
   - each as PDF + 300-dpi PNG.
   The owner prints and applies the sticker.
4. **Install proof** within 7 days of start: an in-app photo with a capture code, checked as in F9. It releases the first tranche.

### F9. Proof-of-display check-ins & payouts
1. Each period (each lease week, or each demo "week"), the app prompts "Snap your MacBook lid". The photo is captured in-app with a fresh code, time and GPS, then uploaded to Walrus.
2. The **proof service** (`gemini-3.1-flash-lite`) checks, straight away in the same modal:
   - the approved creative is present and matches;
   - it is the same object and space as the listing close-up;
   - the code is visible;
   - the photo isn't reused (pHash).
3. **Accepted:** the operator calls `lease::accept_proof`, which releases a tranche:
   - not tokenised: platform 12%, owner 88%
   - tokenised: platform 12%, investor share (`revenue_share_bps` of gross) → all unit holders pro-rata (including the owner's retained units), rest → owner
   [Tokenisation §6.2–6.4](./TOKENISATION-SPEC.md)
4. **Rejected:** the reason is shown and the owner simply **retakes**.
5. The advertiser sees a public proof timeline (photos, timestamps), click stats from the `/r/<lease>` redirect, and the ENS `attested.proofs` count.
6. If no proof is accepted by the end of a period's window plus its grace time, anyone can trigger the refund of that tranche to the advertiser.
7. Payouts land in the owner's USDC balance on Sui; **Send** in the wallet moves them anywhere.

### F10. Lease end / extension / dispute
- **End:** the ENS lease name expires automatically, the final tranche is released on the last proof, and the space returns to AVAILABLE. History stays visible on the space page (from the relayer log).
- **Extension:** `lease::extend` + ENS `renew`.
- **Dispute:** a 72-hour window after each proof; the arbiter resolves it with a pro-rata refund or release.

### F11. Tokenise a space (owner)
**Eligibility:**
- grade ≥ B;
- owner identity verified (mock flow, F12 step 1);
- at least 1 completed lease **or** 1 accepted proof. Testnet `demo_mode` waives this, and the UI says so.

**UX wizard:**
1. "Get cash now for your lid's future ad income."
2. Parameters:
   - revenue share % paid to investors (default 60% of gross);
   - term (default 24 months);
   - retained units (at least 1,000 of 10,000);
   - price per unit (set by the owner);
   - minimum raise;
   - sale window (≥ 5 minutes on testnet);
   - per-investor max.
3. **Review the generated legal pack**, all mock documents stored on Walrus:
   - Series Certificate ("BMS Assets LLC – Series 00000N")
   - Revenue Participation Agreement
   - Offering Memorandum
   - Risk Factors
   - Subscription Agreement template
4. **Sign** the acceptance message with the wallet.
5. Sign `offering::create`: the offering is shared, the retained units are credited, and the pack hash and signature hash are recorded on-chain.

A persistent banner reads "Testnet demo — mock legal documents, not an offer of securities". ENS writes `eth.brandmystuff.token` and `attested.legal`. [Tokenisation §1, §4](./TOKENISATION-SPEC.md)

### F12. Invest (primary sale)
1. **Identity verification (mock).**
   - A 3-step form: details, investor-type self-certification, ID upload.
   - "Checking your documents…" runs for about 3 seconds, then it is approved.
   - Small print: "Verification will be provided by Sumsub or Persona."
   - The operator writes a `KycRecord` on-chain, and ENS `attested.verified=true` is written.
   - [Tokenisation §5](./TOKENISATION-SPEC.md)
2. The offering page shows:
   - space, AQS report, proofs and lease history;
   - unit economics (estimates);
   - raise progress and holders;
   - the legal pack.
3. **Buy N units:**
   - sign the subscription acceptance message;
   - sign `offering::buy_primary` with exact USDC (verified buyers only, per-investor cap).
4. `offering::close` runs after the window, or as soon as the offering sells out:
   - **success**: proceeds go to the owner minus the 3% fee, and unsold units go to the owner;
   - **below minimum**: investors click **Refund**.

### F13. Earn, claim & trade (investor)
- Every tranche released on a tokenised space sends the investor share through `offering::distribute`.
- The portfolio shows holdings, accrued income (live), claimed amounts and yield per offering. **Claim** pays USDC to the wallet.
- **Resale:** list units at a price. Other verified investors can buy all or part (`market::fill`, 1% fee). The seller can cancel any time.

### F14. Sponsored listing (owner)
1. "Boost visibility": pick a tier (search/listing slots or homepage rail) and days, then pay USDC via `sponsor::buy_sponsorship`, or via `POST /api/x402/sponsorships`.
2. The platform key writes ENS `attested.sponsored=true` and `sponsored-until`.
3. The listing gets a "Sponsored" label. AQS and rank are unchanged.

### F15. Moderation & disputes (ops)
- **Queues:** open disputes, reported creatives, reported chat messages.
- **Tools:**
  - space takedown (Sui + ENS unregister);
  - global pause;
  - investor freeze;
  - dispute resolution;
  - re-score;
  - remove chat messages;
  - config (fees, sponsor prices, demo timescale, test-funds amounts).

### F16. AI-agent access
- `agent.brandmystuff.eth` publishes `agent-context` and `agent-endpoint[mcp]` (ENSIP-26, https://docs.ens.domains/ensip/26).
- MCP tools: `search_spaces`, `get_space`, `get_object`, `quote_lease` (returns the x402 `PaymentRequired`).
- Paid actions go through the x402 endpoints (F7).

### F17. Owner ↔ advertiser chat
1. The advertiser clicks **"Message owner"** on a space page, or opens the chat from a lease.
2. There is one conversation per (advertiser, space), linked to the lease once one is booked.
3. Messages are text plus media (images, PDF, short video ≤ 25 MB) with read receipts and unread badges, delivered in real time.
4. **System:**
   - messages are stored in Supabase;
   - media goes to a private Supabase Storage bucket and is served through signed URLs;
   - the API verifies the Privy token and streams new messages over SSE, fed by Supabase Realtime on the server;
   - any message can be reported to the admin queue.

### F18. Advertiser brand kit
1. In their profile, the advertiser adds brand name, website and **brand assets** (logos and creatives as PNG, SVG or PDF). The assets are stored on Walrus, indexed in Supabase and mirrored to ENS `eth.brandmystuff.brandkit`.
2. At checkout, the advertiser picks an asset as the lease creative.
3. After approval, the owner downloads that asset as print-ready files in multiple sizes (F8).

### F19. Dashboards
- **Owner:**
  - objects and spaces (status, AQS);
  - lease requests to approve, with a countdown;
  - proofs due, with a countdown and one-tap upload;
  - active leases and print-file downloads;
  - earnings history per released tranche (gross → fee → investor share → net);
  - offerings.
- **Advertiser:**
  - leases by status;
  - proof photo timeline;
  - link clicks;
  - spend, refunds and escrow remaining;
  - brand kit and disputes.
- **Investor:** portfolio (F13).
- One account can hold every role; tabs appear as relevant.

### F20. Public ENS pages, search & activity feed
- `/<name>.brandmystuff.eth` renders the user, object, space or lease page, resolved live from ENS + Sui, with a verification badge.
- Marketplace **keyword search** covers names, descriptions and brands (Supabase full-text), combined with filters.
- Each space page has an **activity feed** of every on-chain event, linking to Suiscan and Sepolia Etherscan.

---

## 6. Economics summary

| Stream | Rate (default) |
|---|---|
| Lease platform fee | 12% of gross |
| Investor share (tokenised spaces) | `revenue_share_bps` of gross (owner-chosen, default 60%) |
| Tokenisation origination fee | 3% of raise |
| Secondary market fee | 1% of trade |
| Sponsored listings | 3 USDC/day (search/listing slots), 10 USDC/day (homepage rail) |

- Owners of non-tokenised spaces net **88%**.
- For tokenised spaces, owners get the upfront raise, the remainder after the investor share, and their retained units' share of distributions.

## 7. Glossary
- **AQS**: Ad-Space Quality Score (0–100), see the [scoring spec](./AD-QUALITY-SCORING.md).
- **Tranche**: a portion of lease escrow released on an accepted proof.
- **Offering / units**: a tokenised revenue participation in one space for a fixed term.
- **x402**: HTTP-402-based crypto payment protocol used by agents.
- **Platform key**: the single key that owns `brandmystuff.eth`, relays ENS writes and holds the Sui operator capabilities in v1.
