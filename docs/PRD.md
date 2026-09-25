# brandmystuff — Product Requirements Document

| | |
|---|---|
| Version | 2.0 (2026-09-25) |
| Status | **Testnet MVP — every requirement in this document is built and working end-to-end on Sui testnet + Sepolia today.** No real legal entity, KYC provider or regulatory approval is involved; legal and compliance parts are realistically mocked |
| Chains | **Sui testnet** (money, tokenisation, leases) · **Ethereum Sepolia ENSv2 Beta** (names, metadata, permissions) |
| Payments | **USDC on Sui**, from a wallet (humans) or via **x402** (agents) |
| AI | Gemini API model `gemini-3.1-flash-lite` for every AI task (object checks, space scoring, proof checks). No image generation, no other Google APIs |
| Companion specs | [Idea & Flows](./IDEA-AND-FLOWS.md) · [AQS Scoring Metrics](./AD-QUALITY-SCORING.md) · [Tokenisation (Sui)](./TOKENISATION-SPEC.md) · [ENSv2 Integration](./ENS-INTEGRATION.md) · earlier input [rwa-impl-init.md](./rwa-impl-init.md) |

---

## 1. Summary

brandmystuff is a Sui-native marketplace that lets anyone turn a physical object they own into **ad spaces**. Brands and AI agents lease the spaces for fixed periods with USDC, and owners can **tokenise** a space's future lease income for investors.

Each space is scored by a multimodal AI judge with a transparent, calibrated **Ad-Space Quality Score (AQS)** and is shown with its own close-up photo. Leases are escrowed on Sui and paid out against proof-of-display photos verified by AI. Every user, object, space and lease is an **ENSv2 name** carrying its metadata and permissions.

## 2. Problem & opportunity

- **Demand signal.** "Brand My Mac" got 10.38M views and raised €7,955 for 20 sticker spots (https://x.com/VynseDev/status/2092544016315306400, https://brandmymac.com). It spawned BrandMyLaptop and many copycats.
- **Gaps in current solutions:**
  1. Laptop-only or one-off sites.
  2. No quality signal: BrandMyLaptop has 1,632 free spots against 32 taken.
  3. Weak proof-of-display.
  4. Payment defaults: 6 of 20 BrandMyMac winners never paid.
  5. Owners can't capitalise future income.
  6. No way for AI agents to buy.
- **Opportunity.** Combine:
  - a trustworthy **quality score** that ranks inventory;
  - **escrowed, proof-gated** crypto payments;
  - **agent-native purchasing (x402)**;
  - **RWA-style tokenisation** of ad income;
  - an **open identity/metadata layer on ENS**.

## 3. Goals, non-goals, success metrics

### 3.1 Goals
| # | Goal |
|---|---|
| G1 | Any user can list any supported object with named, sized, photographed spaces in under 5 minutes on mobile |
| G2 | Every space gets an explainable AQS, calibrated so low-performing spaces rank low |
| G3 | Advertisers (human or agent) can find, lease, pay in USDC and verify display |
| G4 | Owners can tokenise eligible spaces; verified investors can buy, earn, claim and trade units on Sui |
| G5 | ENSv2 is the public source of truth for names, metadata, permissions and lease expiry |
| G6 | Minimal UX: social login, embedded wallet, no seed phrases |

### 3.2 Explicitly not in this build
Card or fiat payments, onramps, gas sponsorship, AI image generation, real KYC providers, real legal entities or securities filings, TEE attestations, encryption of creatives and proofs, auctions, email/SMS notifications, and anything on mainnet.

### 3.3 Acceptance criteria
| Criterion | Target |
|---|---|
| Every flow in [Idea & Flows](./IDEA-AND-FLOWS.md) F1–F20 | Passes its end-to-end test on Sui testnet + Sepolia |
| Scoring fixture set | All expected gate outcomes and orderings hold ([AQS §8.1](./AD-QUALITY-SCORING.md)) |
| Full lease lifecycle in demo timescale | Book → approve → install → all periods → completed in under 1 hour |
| Tokenisation loop | Create → buy → close → proof → distribute → claim → list → fill, with exact USDC accounting |
| x402 lease | 402 → pay → 200 with lease + ENS name; replayed payment rejected |
| Sui → ENS propagation | Under 60 s |

## 4. Personas

| Persona | Description | Top jobs |
|---|---|---|
| **Maya — student creator** | MacBook, helmet, backpack; campus and cafés | List quickly; approve brands; get paid |
| **Raj — rideshare driver** | Car used 8 h/day | Lease panels; tokenise for upfront cash |
| **Lena — shop owner** | Storefront window | Rent decal space to complementary brands |
| **Theo — indie SaaS founder** (advertiser) | $300–3,000 budgets, crypto-native | Find placements, pay USDC, see proof |
| **Growth agent** (AI) | Autonomous marketing agent with a USDC wallet | Search via MCP, pay via x402, track proofs |
| **Kenji — investor** | Wants small, diversified yield | Browse offerings; claim; exit |
| **Ops reviewer** | Moderation | Queues, evidence, tools |

## 5. Release scope

| Release | Scope |
|---|---|
| **v1 (testnet, today)** | Everything in §6: auth + wallets, object and space wizard, AQS pipeline, marketplace, human USDC checkout, x402 agent checkout, creative approval, proofs and tranches, disputes and extensions, sponsored listings, tokenisation (mock verification, mock legal pack, offerings, distributions, claims, secondary market), ENS for all entities, admin console, MCP endpoint, in-app notifications |

---

## 6. Functional requirements

### 6.1 Authentication & wallets (FR-AUTH)
| ID | Requirement | Implementation / docs |
|---|---|---|
| AUTH-1 | Login with Google, Apple, X, email OTP, passkey | Privy `@privy-io/react-auth` — https://docs.privy.io/authentication/user-authentication/privy-auth |
| AUTH-2 | On first login, silently create a Sui embedded wallet | `useCreateWallet` from `@privy-io/react-auth/extended-chains` with `chainType:'sui'`. Needs TEE execution — https://docs.privy.io/wallets/using-wallets/other-chains/sui |
| AUTH-3 | Silently create an Ethereum embedded wallet that owns the user's ENS names (never signs in v1) | `embeddedWallets.ethereum.createOnLogin` |
| AUTH-4 | Sign Sui transactions with the Privy wallet | `PrivySuiSigner` (custom `Signer`) over `useSignRawHash` with `blake2b256(intent‖bytes)` — https://docs.privy.io/recipes/tier-2-wallet-integration |
| AUTH-5 | Connect an external Sui wallet (Slush, Suiet, Phantom) | `@mysten/dapp-kit-react` — https://sdk.mystenlabs.com/dapp-kit |
| AUTH-6 | Wallet panel: SUI and USDC balances, copy address, **Send** (SUI/USDC to any address), **"Get test funds"** (the platform key sends 0.2 SUI + 5 USDC, once per user per 24 h), faucet links as fallback | `SuiGrpcClient`; [Tokenisation §12](./TOKENISATION-SPEC.md) |
| AUTH-7 | Choose a handle → `handle.brandmystuff.eth` | [ENS §2–3](./ENS-INTEGRATION.md) |

### 6.2 Objects & spaces (FR-OBJ)
| ID | Requirement |
|---|---|
| OBJ-1 | Free-form listing: the owner gives any **name** and a **description** (≥ 10 chars). No categories. The AI derives the object profile (type, tags, viewer mode, viewing distance, prohibited zones) and shows it |
| OBJ-2 | Object name, make, model, colour, description |
| OBJ-3 | Hero photo via in-app camera (gallery allowed, lower provenance confidence), with a capture code written on a note |
| OBJ-4 | Optional city (marketplace filter only; not scored) |
| OBJ-5 | **"Add space" modal** (repeat 1–20 times): name (ENS-normalisable label), W×H cm, placement, material, close-up photo (optional ID-1 card for scale). The AI analysis runs **in the modal** and shows **Accepted** (score + grade + breakdown) or **Rejected** (reason + Retake). Only accepted spaces are added: the owner enters a fixed **price per week** and signs `add_space` ([AQS §9](./AD-QUALITY-SCORING.md)) |
| OBJ-6 | Light on-device pre-checks (blur, glare) before upload |
| OBJ-7 | Media on Walrus; IDs on Sui and ENS |
| OBJ-8 | Edit a space (triggers a re-score); pause, unpause or retire spaces and objects |

### 6.3 AI scoring (FR-SCORE): full spec in [AD-QUALITY-SCORING.md](./AD-QUALITY-SCORING.md)
| ID | Requirement |
|---|---|
| SCORE-1 | P0 deterministic metrics; poor photo quality → rejected with reason "retake the photo" |
| SCORE-2 | P1 integrity gates: capture code, C2PA, duplicates (pHash), AI/stock/screen-photo check by the model, close-up ∈ object, photo matches name & description (G8), dimensions |
| SCORE-3 | P2 brand safety (GARM floor → reject) and prompt-injection defence (→ reject) |
| SCORE-4 | P3 per-space rubric: 11 object-intrinsic criteria, anchored 0–4, N=3, median; 2 extra samples when the samples disagree |
| SCORE-5 | P5 aggregation in code: weights, soft caps, confidence, rank score, grade; **accepted if no gate fails and AQS ≥ 40**, otherwise rejected and not listed |
| SCORE-6 | Result shown synchronously in the upload modal: radar, strengths and weaknesses with evidence, tips; Retake on rejection |
| SCORE-7 | Results written on-chain by the operator (`score::apply`) and to ENS `attested.*`; full report on Walrus |
| SCORE-8 | Fixture set + scoring e2e test |
| SCORE-9 | Re-scoring: owner retake or edit, admin re-score |

### 6.4 Marketplace (FR-MKT): see §7
| ID | Requirement |
|---|---|
| MKT-1 | Space grid sorted by `rank_score` (default) |
| MKT-2 | Filters: keyword search, AI-derived tag chips, location, grade, size, placement, price, availability, suitability tier, tokenised, sponsored |
| MKT-3 | Object view: hero photo + list of its spaces, each with its close-up photo |
| MKT-4 | Space detail: see §7.3 |
| MKT-5 | Sponsored slots, labelled, never reorder organic results |
| MKT-6 | "Verify on-chain" panel showing ENS name + records and Sui object links |
| MKT-7 | **Keyword search** across space, object, owner and brand names and descriptions (Postgres full-text search in Supabase), combined with filters and sorting |
| MKT-8 | **Per-space activity feed:** every on-chain event (listed, booked, approved, proofs, tranches, tokenised, trades, sponsored) with time, amounts and links to Suiscan (testnet) and Sepolia Etherscan |

### 6.5 Leasing & payments (FR-LEASE): [Tokenisation §6](./TOKENISATION-SPEC.md)
| ID | Requirement |
|---|---|
| LEASE-1 | Owner-set **fixed price per week**. The advertiser picks the start week and duration (1–52 weeks) on a calendar; total = price × weeks |
| LEASE-2 | Creative **chosen from the advertiser's brand kit** (§6.13), with a fit preview on the close-up photo and a legibility estimate |
| LEASE-3 | **Human checkout:** pay the full amount in USDC from the wallet in one PTB (`lease::book`); the user pays SUI gas |
| LEASE-4 | **Agent checkout via x402 v2** (`exact` scheme on Sui): `POST /api/x402/leases` → 402 `PAYMENT-REQUIRED` → retry with `PAYMENT-SIGNATURE` → self-hosted verify and settle → operator `lease::book_for` → 200 + `PAYMENT-RESPONSE`. Auto-refund if booking fails ([Tokenisation §6.6, §15](./TOKENISATION-SPEC.md)) |
| LEASE-5 | Escrow on Sui; `AdLease` minted to the advertiser; ENS lease label RESERVED |
| LEASE-6 | Owner approves or rejects the creative within 5 days; auto-refund otherwise |
| LEASE-7 | On approval, an ENS lease subname with expiry = end, holding creative, url and brand records |
| LEASE-8 | Install proof within 7 days of start, else auto-refund. The owner downloads print-ready files of the creative in several sizes (§6.13). A rejected proof photo shows the reason and the owner simply retries |
| LEASE-9 | Period proofs release tranches; 72-hour cure window; refunds for missed tranches |
| LEASE-10 | Disputes: 72-hour window per proof; arbiter resolution |
| LEASE-11 | Extension (Sui extend + ENS renew) |
| LEASE-12 | **Demo timescale:** `Config.demo_week_ms` (e.g. 10 minutes) scales weeks, periods and every deadline, so a full lease lifecycle can be demonstrated in under an hour |

### 6.6 Proof-of-display (FR-PROOF)
| ID | Requirement |
|---|---|
| PROOF-1 | In-app capture with a fresh capture code, timestamp and coarse GPS |
| PROOF-2 | AI verification (`gemini-3.1-flash-lite`): creative present and matching; same object and space; code visible; no reuse (pHash); time and city consistent |
| PROOF-3 | Operator `lease::accept_proof` releases the tranche; the photo is public on Walrus |
| PROOF-4 | Advertiser proof timeline and UTM stats |
| PROOF-5 | Reminders 24 h before each period deadline |

### 6.7 Tokenisation, investing & secondary market (FR-TOKEN): [Tokenisation §4–7](./TOKENISATION-SPEC.md)
| ID | Requirement |
|---|---|
| TOKEN-1 | Eligibility gate: grade ≥ B, owner verified, ≥ 1 completed lease or accepted proof (waived by `demo_mode`, with a UI notice) |
| TOKEN-2 | Tokenise wizard: revenue share %, term, retained units, price per unit (owner-set), min raise, sale window (≥ 5 min on testnet), per-investor max |
| TOKEN-3 | **Mock legal pack**: series certificate, RPA, offering memorandum, risk factors and subscription agreement, generated as PDFs on Walrus. The pack hash is on-chain; the owner and investors accept by wallet-signing a message whose hash is recorded on-chain ([Tokenisation §1](./TOKENISATION-SPEC.md)) |
| TOKEN-4 | **Mock identity verification**: a 3-step form (details, investor type, ID upload), a simulated check, then `KycRecord` on-chain. The UI notes subtly that Sumsub/Persona will provide verification |
| TOKEN-5 | `SpaceOffering` with 10,000 units; primary buy (verified only, per-investor cap, exact USDC); close → proceeds to owner minus 3%, or refunds below min raise |
| TOKEN-6 | Accumulator distribution of the investor share on every released tranche; claim any time |
| TOKEN-7 | Secondary: list, fill (verified buyers only), cancel; 1% fee |
| TOKEN-8 | Portfolio: holdings, accrued, claimed, yield, per-space performance, documents |
| TOKEN-9 | Offering page: raise progress, holders, lease occupancy, proofs, distributions, documents |

### 6.8 Sponsored listings (FR-SPON)
| ID | Requirement |
|---|---|
| SPON-1 | Owner buys sponsorship per object (tier × days) with USDC via `sponsor::buy_sponsorship`, or via x402 |
| SPON-2 | `sponsored_until_ms` on Sui; ENS `attested.sponsored=true`, `sponsored-until` |
| SPON-3 | Sponsored label on cards and detail pages |
| SPON-4 | Eligibility: object LIVE with at least one listed space |
| SPON-5 | Never alters AQS or `rank_score`; at most 1 in 6 cards |
| SPON-6 | Expiry job clears flags |

### 6.9 ENS (FR-ENS): [ENS spec](./ENS-INTEGRATION.md)
| ID | Requirement |
|---|---|
| ENS-1 | `brandmystuff.eth` registered on Sepolia ENSv2 by the platform key; one UserRegistry per parent name; one platform PermissionedResolver |
| ENS-2 | Names for users, objects, spaces and leases with the role bitmaps in ENS §3 |
| ENS-3 | Records per ENS §4.3, including addr(784) Sui addresses and ENSIP-24 data records |
| ENS-4 | Lease = subname with expiry; RESERVED during checkout; renew or unregister |
| ENS-5 | Relayer: Sui events → ENS writes; idempotent; audit feed |
| ENS-6 | Relayer log + read model for querying; live Universal Resolver reads for verification |
| ENS-7 | `ens-reseed` job for Sepolia resets |
| ENS-8 | Cross-chain verification badge (ENS ↔ Sui commitments) |
| ENS-9 | ENSIP-26 agent records; ENSIP-27 class and schema records |

### 6.10 Admin & moderation (FR-ADMIN)
Queues:
- open disputes
- reported creatives
- reported chat messages

Tools:
- ENS unregister / takedown
- Sui global pause, space takedown, investor freeze/unfreeze, dispute resolution, re-score
- config (fees, sponsor prices, demo timescale)

Every admin action is written to an audit log.

### 6.11 AI agent access (FR-AGENT)
- The MCP server exposes `search_spaces`, `get_space`, `get_object` and `quote_lease`. `quote_lease` returns the x402 `PaymentRequired`.
- Paid actions go through the x402 endpoints (LEASE-4, SPON-1, TOKEN-5).
- The endpoint is published via ENSIP-26 records on `agent.brandmystuff.eth` (https://docs.ens.domains/building-with-ai, https://docs.ens.domains/ensip/26).

### 6.12 Notifications (FR-NOTIF)
In-app notification centre (bell + list, stored in Supabase, pushed live via Supabase Realtime) for:
- new chat message
- new lease
- approval deadline
- install and proof deadlines
- tranche released
- dispute
- offering milestones
- claimable income
- sponsorship expiry
- score ready

### 6.13 Advertiser brand kit & print files (FR-BRAND)
| ID | Requirement |
|---|---|
| BRAND-1 | An advertiser profile has a **brand kit**: brand name, website, and uploaded logos/creatives (PNG, SVG or PDF, ≥ 1000 px or vector) stored on Walrus. The index is kept in Supabase and mirrored to ENS `eth.brandmystuff.brandkit` |
| BRAND-2 | At checkout the advertiser picks one brand-kit asset as the lease creative (or uploads a new one straight into the kit). x402 agents pass a `creativeUrl`, which is added to their kit |
| BRAND-3 | After approval, the owner downloads **print-ready files** in several sizes: exact space size (W×H mm, 3 mm bleed, cut line), plus standard S (5 cm), M (10 cm) and L (20 cm) on the long side. Each comes as PDF + PNG at 300 dpi, generated on the server (sharp + pdf-lib), with aspect ratio preserved and fitted inside the space |

### 6.14 Owner ↔ advertiser chat (FR-CHAT)
| ID | Requirement |
|---|---|
| CHAT-1 | A conversation per (advertiser, space). It can be started from the space page before booking, and is linked to the lease once booked |
| CHAT-2 | Text messages plus media attachments (images, PDF, short video ≤ 25 MB) stored in a private **Supabase Storage** bucket and served through short-lived signed URLs |
| CHAT-3 | Real-time delivery: the client authenticates with Privy; the API verifies the token and streams new messages (Supabase Realtime server-side → SSE to the client); read receipts; unread badge |
| CHAT-4 | Report message → admin queue; admins can remove messages |

### 6.15 Dashboards (FR-DASH)
| ID | Requirement |
|---|---|
| DASH-1 | **Owner dashboard:** objects and spaces with status and AQS; lease requests awaiting approval (countdown); proofs due (countdown, "Upload proof" action); active leases; print-file downloads; earnings history per released tranche (gross, fee, investor share, net); offerings created; unread chats |
| DASH-2 | **Advertiser dashboard:** leases by status; per-lease proof photo timeline; link clicks from the `/r/<lease>` redirect; spend, refunds and escrow remaining; brand kit; open disputes; unread chats |
| DASH-3 | **Investor portfolio** (TOKEN-8): holdings, accrued, claimed, listings, trades |
| DASH-4 | One account can act as owner, advertiser and investor; the dashboard shows the relevant tabs |

### 6.16 Public ENS pages (FR-PUB)
| ID | Requirement |
|---|---|
| PUB-1 | Route `/[ensName]` for any `*.brandmystuff.eth` name: user profile (objects, spaces, reputation), object page, space page, lease page (brand, creative, period, proofs) |
| PUB-2 | Page data is resolved live from ENS (Universal Resolver via viem) and Sui, with the read model only as a cache. The page shows the verification badge (ENS ↔ Sui commitment check) |

---

## 7. Marketplace presentation & ranking

### 7.1 Ranking
- **Organic order = `rank_score` descending** ([AQS §5.4](./AD-QUALITY-SCORING.md)): AQS shrunk toward the mean of its AI-derived exposure-class cohort by confidence.
- Tie-breakers, in order: accepted proofs, listing age.
- Only accepted spaces exist in the marketplace (AQS ≥ 40, all gates passed).

### 7.2 Space card (grid)
| Element | Source |
|---|---|
| Space close-up photo | Walrus |
| Space name · object name | ENS labels |
| Grade badge + AQS + confidence dot | ENS `attested.*` / Sui `AdSpace` |
| Size · placement | ENS |
| Price per week (USDC) | Sui `AdSpace` |
| Next available week | Sui calendar via indexer |
| City · object type · tags | ENS |
| Badges: Verified proofs (n), Tokenised (x% sold), **Sponsored** | Sui + ENS |

### 7.3 Space detail page
1. **Photos:** the space close-up (primary) and the full-object hero photo.
2. **AQS panel:** grade, AQS, confidence, 11-criterion radar, strengths and weaknesses with evidence, rubric version, full report link.
3. **Specs:** dimensions, placement, surface, object type, estimated viewing distance, legible distance, zones where ads aren't allowed on this object.
4. **Calendar + fixed weekly price;** "Lease this space" and "Message owner" CTAs; a "For agents: x402 endpoint" snippet.
5. **Owner card:** ENS name, avatar, reputation, other spaces.
6. **Lease history and public proof gallery.**
7. **Tokenisation panel** (if an offering exists).
8. **Verify on-chain:** ENS records (app.ens.dev / Sepolia explorer), Sui object IDs (Suiscan), commitment check.

### 7.4 Sponsored placement rules
- Sponsored cards take at most 1 in 6 grid positions (1, 7, 13…), plus a homepage "Sponsored" rail.
- Each has a visible "Sponsored" label and still shows its true AQS.
- A sponsored card must still match the active filters.
- The flag is public in ENS and on Sui.

### 7.5 Visual design direction
- A clean, photo-first aesthetic with bold grade badges.
- Mobile-first owner flows; desktop-first advertiser flows. Dark and light themes. WCAG 2.2 AA.

---

## 8. Pricing & fees

| Item | Default |
|---|---|
| Listing | Free |
| Lease platform fee | 12% of gross |
| Tokenisation origination | 3% of raise |
| Investor share (tokenised spaces) | `revenue_share_bps` of gross, set by the owner |
| Secondary trades | 1% |
| Sponsorship | Tier 1 (search/listing slots) 3 USDC/day, Tier 2 (homepage rail) 10 USDC/day |
| Gas | Users pay SUI gas; the platform pays operator transactions and all ENS gas |

All prices are **set by the owner**: a fixed price per week for leases and a price per unit for offerings. The platform never computes or suggests prices.

---

## 9. Technical architecture

### 9.1 Stack
| Layer | Choice |
|---|---|
| Web app | Next.js (App Router) + TypeScript, Tailwind + shadcn/ui, PWA camera capture |
| Auth / wallets | Privy (`@privy-io/react-auth`, `@privy-io/node`), `@mysten/dapp-kit-react` |
| Sui | `@mysten/sui` 2.x (`SuiGrpcClient`), Walrus HTTP publisher/aggregator; Move package `brandmystuff` |
| ENS | viem (reads/writes) against the deployed ENSv2 contracts directly (ABIs from `ensdomains/contracts-v2`); Foundry/cast for bootstrap |
| AI | Gemini REST `generateContent` (`gemini-3.1-flash-lite`, `x-goog-api-key` header) from the Node server |
| Image metrics | In the Node server: `sharp` (raw pixels → Laplacian sharpness, exposure clipping, noise, contrast), perceptual hash (DCT pHash on `sharp` grayscale), `@contentauth/c2pa-node`. **Single TypeScript runtime**, no Python |
| Payments | USDC on Sui; x402 v2 `exact` Sui scheme, self-hosted facilitator |
| Jobs | Supabase-table job queue: proofs, relaying, scheduler (deadlines, refunds, sponsor expiry). Scoring runs synchronously in the upload request |
| Data | **Supabase**: Postgres (read model, relayer log, chat, notifications, jobs, mock-KYC submissions), Realtime (chat and notifications), Storage (private chat media). Sui event poller (GraphQL, persisted cursor). Server-side access with the service-role key; the client never talks to Supabase directly |
| Testing | One end-to-end test per feature/flow, no unit tests (see §9.6) |

### 9.2 Services
```
web (Next.js) ── api (tx builders, auth, x402 server+facilitator, MCP)
                    │
   ┌────────────────┼────────────────┬───────────────┬───────────────┐
 scoring-worker   proof-worker     ens-relayer     scheduler       event-poller
 (Gemini, py      (Gemini proof    (Sui events →   (deadlines,     (Sui events →
  metrics)        checks)          ENSv2)          refunds,        Supabase read
                                                    sponsor expiry) model)
```

### 9.3 Keys (v1)
| Key | Holds |
|---|---|
| **Sepolia platform key** (env) | Owns `brandmystuff.eth`, ROOT roles on the registries, pays all ENS gas, runs the relayer |
| **Sui platform key** (Sui CLI active address) | Package deployer; `AdminCap`, `OperatorCap`, `ComplianceCap`; x402 `payTo` treasury; pays operator gas |

### 9.4 Data ownership matrix
| Data | Canonical store | Mirrors |
|---|---|---|
| Names, ownership, permissions, lease expiry | **ENSv2** | Supabase (relayer log) |
| Public listing metadata | **ENSv2 records** | Sui fields (economic subset), Supabase |
| Money: escrow, payouts, fees, units, holdings, distributions, trades | **Sui** | ENS summary records, Supabase |
| Media, score reports, proofs, legal docs | **Walrus** | IDs and hashes in ENS + Sui |
| Verification form data, emails, chat messages and media | Supabase (private) | never on-chain |
| Search / sort / filter | Supabase read model (rebuildable) | — |

### 9.5 Key sequence: x402 lease
1. `POST /api/x402/leases` (no payment header): validate the space, weeks and creative; create an intent; return **402** with a `PAYMENT-REQUIRED` header.
2. The client retries with `PAYMENT-SIGNATURE`.
3. The server verifies:
   1. the network;
   2. the signature over the transaction bytes;
   3. a dry-run of the transaction;
   4. that the treasury balance change equals the amount in USDC;
   5. that the digest hasn't been used before.
   Then it executes.
4. The operator runs `lease::book_for(advertiser = payer)` using the received USDC.
5. The server returns 200 with a `PAYMENT-RESPONSE` header and body `{leaseId, ensName}`. If step 4 fails, the USDC is refunded to the payer and a 409 is returned.

---

### 9.6 Environment & test harness
- **Development environment:** local `next dev` (http://localhost:3000) against **Sui testnet**, **Sepolia ENSv2** and the **hosted Supabase project**. No deployment in this phase.
- **x402 and MCP** are exercised locally by a **scripted agent** (a Node script with its own Sui keypair) that discovers spaces via MCP, gets the 402, pays and books.
- **Browser e2e:** Playwright logs in through a Privy **test account** (fixed email + OTP from the Privy dashboard).
- **Multi-actor flows** (owner, advertiser, investor, agent): the harness generates Sui keypairs funded by the platform address (SUI + USDC), and signs with them directly. `Config.demo_week_ms` is set short so full lifecycles finish within one test run.
- **Fixtures:** scoring photos in `scoring/fixtures/` (AQS §8.1), plus sample creatives.

## 10. Non-functional requirements

| Area | Requirement |
|---|---|
| Performance | Marketplace first contentful paint ≤ 1.5 s p75; search ≤ 300 ms p95; scoring end-to-end ≤ 3 min p95 for 5 spaces |
| Reliability | Event poller, relayer and scheduler run at-least-once with idempotency; persisted cursors |
| Security | Caps held by the platform key (testnet); rate limits per user and IP; x402 replay protection; input validation on every tx builder |
| Privacy | No PII on ENS, Sui or Walrus; coarse location only |
| AI safety | Injection defences, brand-safety gates, human review queue ([AQS §8.2](./AD-QUALITY-SCORING.md)), pinned model IDs |
| Accessibility | WCAG 2.2 AA |
| Cost | AI < $0.15 per object scored (`gemini-3.1-flash-lite`) |

## 11. Policy, legal & compliance
- **Content policy.** GARM floor categories prohibited. The owner approves every creative. The platform can take content down. The brand warrants IP rights. Leases are described as "paid placement, not endorsement".
- **Disclosure.** Owners are prompted to label paid placements in social posts ("#ad", or "Publicité" in France), per 16 CFR 255 (https://www.ecfr.gov/current/title-16/chapter-I/subchapter-B/part-255).
- **Vehicles.** The AI's prohibited zones block windows, lights and plates, with a local-rules notice. **Walls and storefronts** get a sign-permit notice.
- **Securities.** Tokenisation runs on testnet funds only with mock legal documents and a persistent "Testnet demo — not an offer of securities" banner ([Tokenisation §1](./TOKENISATION-SPEC.md)).
- **Anti-scam.** Never ask owners to pay upfront.

## 12. Admin stats
The admin console shows:
- funnel counts (signups → objects → scored → published → leased);
- gate hit rates and retake rate;
- proof on-time %;
- x402 402→200 conversions;
- relayer lag;
- failed transactions.

## 13. Risks & mitigations
| Risk | Mitigation |
|---|---|
| Demand scarcity | AQS ranking, agent buyers via x402/MCP, tag-based discovery |
| ENSv2 Sepolia resets or contract changes | Versioned config, `ens-reseed`, smoke tests |
| Users lacking SUI for gas | Balance warnings, faucet links (testnet); gas costs are tiny |
| Regulatory perception | Testnet funds only; mock documents clearly labelled; persistent demo banner |
| AI mis-scoring or gaming | Gates, injection defence, N-sample medians, calibration, human review |
| Fake photos | In-app capture, capture codes, C2PA, duplicate detection, model check for AI/stock/screen photos |
| Owner non-performance | Escrow tranches, cure windows, refunds, disputes, reputation |
| Operator key trust (no attestations in v1) | Public evidence on Walrus + hashes on-chain; key rotation via `AdminCap` |
| x402 Sui testnet network id not canonical | Use `sui:testnet` as facilitators do; configurable |

## 14. Build order (one e2e test per feature)
1. Monorepo, Move package, Supabase schema, platform bootstrap (register `brandmystuff.eth` on ENSv2 Sepolia, deploy registries/resolver; publish Sui package, caps, config).
2. Auth + wallets (send, test funds) + profile + ENS account name.
3. Object creation + "Add space" modal with instant AQS accept/reject + Walrus + ENS object and space names.
4. Marketplace (event poller, read model, ranking, filters, keyword search, detail, activity feed) + public ENS pages.
5. Brand kit + human lease checkout + creative approval + print files + ENS lease names.
6. Owner ↔ advertiser chat + notifications.
7. Proof-of-display + tranches + refunds + disputes + extensions.
8. Owner and advertiser dashboards.
9. x402 agent checkout + MCP + scripted agent.
10. Sponsored listings.
11. Tokenisation: mock verification, mock legal pack, offerings, distributions, claims, secondary market, portfolio.
12. Admin console.

## 15. References
- **Trend:** https://brandmymac.com · https://brandmylaptop.com/stats · https://x.com/VynseDev/status/2092544016315306400
- **ENSv2:** https://docs.ens.domains/ensv2/overview · https://docs.ens.domains/building-with-ai · https://docs.ens.domains/learn/deployments#sepolia-ensv2-beta
- **Sui:** https://docs.sui.io/onchain-finance/examples-patterns/staking-rewards · https://docs.wal.app · https://sdk.mystenlabs.com
- **x402:** https://github.com/x402-foundation/x402/blob/main/specs/x402-specification-v2.md · https://github.com/x402-foundation/x402/blob/main/specs/schemes/exact/scheme_exact_sui.md · https://github.com/x402-foundation/x402/blob/main/specs/transports-v2/http.md
- **Privy:** https://docs.privy.io/wallets/using-wallets/other-chains/sui
- **Gemini:** https://ai.google.dev/gemini-api/docs/models · https://ai.google.dev/gemini-api/docs/image-understanding · https://ai.google.dev/gemini-api/docs/generate-content/structured-output
- **Measurement:** https://geopath.org/glossary/ · https://www.route.org.uk/attention.php · https://usscfoundation.org/wp-content/uploads/2018/03/USSC-Guideline-Standards-for-On-Premise-Signs-2018.pdf
