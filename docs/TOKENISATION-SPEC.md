# brandmystuff — Tokenisation, Leasing & Payments Specification (Sui, testnet MVP)

> Status: v2.0 (2026-09-25) — **testnet MVP; everything in this document is built and working end-to-end on Sui testnet with test USDC.** Nothing here depends on a real legal entity, a real KYC provider or any regulatory approval. Legal and compliance parts are **realistically mocked** (§1, §5).
> Related: [PRD](./PRD.md) · [Idea & Flows](./IDEA-AND-FLOWS.md) · [ENS](./ENS-INTEGRATION.md) · [AQS](./AD-QUALITY-SCORING.md) · earlier input [rwa-impl-init.md](./rwa-impl-init.md)

---

## 0. Summary

- An **ad space** (e.g. `lid-center` on Alice's MacBook) earns income when advertisers lease it.
- The owner can **tokenise** it: a share of the space's future lease revenue is split into **10,000 units**. The owner keeps some and sells the rest to verified investors for USDC.
- Advertisers pay the **full lease upfront into escrow** on Sui, either from a wallet (humans) or via **x402** (AI agents).
- Escrow is released in **tranches** as the owner submits proof-of-display photos, which the platform verifies with AI.
- Each released tranche is split:
  - platform fee;
  - investor share, distributed pro-rata to all unit holders through a **reward-per-unit accumulator**;
  - the rest to the owner.
- Investors **claim** USDC any time, and can **resell units** on an internal market restricted to verified buyers.
- The legal wrapper (SPV series, revenue participation agreement, offering memorandum, subscription agreement) is a **realistic mock**: generated documents stored on Walrus, hashes on-chain, and acceptance signed with the investor's wallet.

### Design decisions
| Topic | Decision | Why |
|---|---|---|
| Unit representation | **Custom Move ledger** per space (`SpaceOffering` with `Table<address, Holding>`) | Sui's Permissioned Asset Standard, closed-loop tokens and regulated coins all key on a Move **type**, so each space would need its own published package (https://docs.sui.io/onchain-finance/types-of-assets). One package with per-space ledgers scales to any number of spaces. |
| Transfer restriction (ERC-3643 equivalent) | Units move only through module functions that call `kyc::assert_verified` | Sui objects without `store` / module-owned state can only be changed by the defining module (https://docs.sui.io/develop/objects/transfers/custom-rules) |
| Distributions | Lump-sum **reward-per-unit accumulator**, pull-based `claim` | O(1) per event, exact, no loops over holders (https://docs.sui.io/onchain-finance/examples-patterns/staking-rewards) |
| Secondary market | Internal fixed-price listing market in USDC, verified buyers only | DeepBook has no verification hook and needs `Coin<T>`; Kiosk purchases take `Coin<SUI>` only |
| Settlement asset | Circle native **USDC** on Sui testnet: `0xa1ec7fc00a6f40db9693ad1415d0c193ad3906494428cf252621037bd7117e29::usdc::USDC` | Faucet: https://faucet.circle.com (https://developers.circle.com/stablecoins/usdc-contract-addresses) |

---

## 1. Mocked legal layer (comprehensive, no real entity)

The UI and data model behave like a real tokenisation platform, but every legal artefact is a generated mock. A persistent banner says **"Testnet demo — mock legal documents, not an offer of securities."**

### 1.1 Mock structure
```
BrandMyStuff Inc. (mock platform manager)
   └── BMS Assets LLC (mock Delaware series LLC)
          ├── Series 000001  ← Revenue Participation Agreement for lid-center.macbook.alice
          ├── Series 000002  ← rear-panel.car.bob
          └── …                (series number = on-chain offering sequence)
```

### 1.2 Generated document pack (per offering)
When an owner creates an offering, the server fills Markdown/HTML templates with the offering parameters. It renders them to PDF, uploads each to **Walrus**, and computes `sha256`.

| Document | Contents (templated) | Signed by |
|---|---|---|
| **Series Certificate** | Series number, space ENS name, Sui offering ID, formation date | Platform (mock) |
| **Revenue Participation Agreement (RPA)** | Owner assigns `revenue_share_bps` of gross lease revenue of space S for `term_months` to the series. Owner obligations: display leased creatives, submit proofs, maintain the surface | Owner (wallet signature) |
| **Offering Memorandum** | Space summary, AQS report link, lease history, unit economics, fees, risks | — |
| **Risk Factors** | Standard risks: object loss, owner non-performance, demand, AI scoring errors, smart-contract risk, testnet-only | — |
| **Subscription Agreement** | Investor subscribes for N units at price P; acknowledges risks | Investor (wallet signature) |

- The **document pack hash** is `sha256(concat(sorted doc hashes))`. It is stored in `SpaceOffering.legal_pack_hash`, with the Walrus blob IDs in `legal_pack_blob_id` (a JSON index of all documents).
- **Signatures:** the owner, and each investor at purchase, sign a Sui personal message: `"brandmystuff:accept:<offeringId>:<legal_pack_hash>:<units>"`. The server checks it with `verifyPersonalMessageSignature` (`@mysten/sui/verify`) and stores it. Its hash is passed into `create` / `buy_primary` and emitted in the event, so every acceptance is anchored on-chain.
- The ENS data record `eth.brandmystuff.attested.legal` on the space holds `legal_pack_hash` ([ENS §4.3](./ENS-INTEGRATION.md)).

---

## 2. Architecture

```
                 ┌───────────── Web app (Next.js) ─────────────┐
                 │ Privy (embedded Sui + EVM wallets) · dApp Kit (external Sui wallets)
                 └──────┬───────────────┬───────────────┬──────┘
                        │ user-signed   │ media/docs    │ reads
                        │ PTBs          │               │
                ┌───────▼──────┐  ┌─────▼─────┐  ┌──────▼───────┐
                │ API: tx      │  │ Walrus    │  │ Read model   │◄── Sui event poller (GraphQL)
                │ builders,    │  │ (testnet) │  │ Supabase     │◄── ENS relayer log
                │ x402 server, │  └───────────┘  └──────────────┘
                │ MCP, workers │
                └───┬──────────┘
                    │ operator txs (OperatorCap): scores, proofs, x402 bookings, verification
                ┌───▼────────────────────────────────────────────┐
                │ Sui Move package `brandmystuff`                 │
                │ admin · profile · asset · kyc · lease ·         │
                │ offering · market · sponsor                     │
                └───┬────────────────────────────────────────────┘
                    │ events
             ┌──────▼─────┐        ┌──────────────────┐
             │ ens-relayer│──────► │ ENSv2 (Sepolia)  │
             └────────────┘        └──────────────────┘
```

### 2.1 Package layout (`move/brandmystuff/sources/`)
| Module | Responsibility |
|---|---|
| `admin` | `AdminCap`, `OperatorCap`. Shared `Config`: fee bps, sponsor prices, treasury address, pause flag, version |
| `profile` | `Profile` per user (ENS name + namehash, counters) |
| `asset` | `ListedObject` (shared), `AdSpace` records, status, AQS fields, prices |
| `kyc` | `KycRegistry`: mock verification records, `assert_verified` |
| `lease` | `SpaceCalendar`, `AdLease`, `LeaseEscrow<USDC>`: book, approve or reject, proofs, tranche release, refunds, disputes, extension |
| `offering` | `SpaceOffering<USDC>`: create, buy, close, refund, distribute, claim |
| `market` | Unit listings: list, fill, cancel |
| `sponsor` | Sponsored-tag purchase |

- Dependencies: the Sui framework and the USDC package (testnet).
- Every shared object has `version: u64`, checked against `Config.version`.
- The deployer (the platform's Sui CLI key) holds `AdminCap`, `OperatorCap` and `UpgradeCap`.

---

## 3. Data model (Move sketch)

```move
/// Shared, so the operator can write scores and statuses. Owner-gated functions check `ctx.sender() == owner`.
public struct ListedObject has key {
    id: UID, owner: address, category: u16 /* unused: always 0, listings are free-form */, title: String,
    ens_name: String, ens_namehash: vector<u8>,
    hero_blob_id: String, manifest_blob_id: String,
    object_aqs: u8, object_grade: u8,
    sponsored_until_ms: u64, status: u8,          // DRAFT, SCORING, LIVE, PAUSED, RETIRED
    spaces: vector<ID>,
}
/// One per ad space (the listing). Shared.
public struct AdSpace has key {
    id: UID, object_id: ID, owner: address, label: String,
    ens_name: String, ens_namehash: vector<u8>,
    width_mm: u32, height_mm: u32, placement: u8, closeup_blob_id: String,
    aqs: u8, grade: u8, confidence_bps: u16, rank_score_x100: u32,
    rubric_version: String, score_report_blob_id: String, score_report_hash: vector<u8>, scored_at_ms: u64,
    price_per_week_usdc: u64,                      // fixed price set by the owner
    offering_id: Option<ID>,
    status: u8,                                    // DRAFT, SCORING, AVAILABLE, PAUSED, RETIRED, REJECTED
    completed_leases: u32, accepted_proofs: u32,
}
```

- **Display** metadata (name, description, `image_url` = Walrus aggregator URL of the close-up) for `AdSpace` and `AdLease`, so wallets and explorers render them (https://docs.sui.io/develop/objects/display/using-display).
- Each `AdSpace` has exactly one `SpaceCalendar` (created alongside it) and at most one `SpaceOffering`. Their IDs are stored as fields.

---

## 4. Listing lifecycle & tokenisation

```
DRAFT ─scored─► AVAILABLE (leasable) ─tokenise─► OFFERING_OPEN ─close─► TOKENISED ─(term display only)
                                                     └── below min raise ─► REFUNDING ─► back to AVAILABLE (non-tokenised)
```

### 4.1 Listing & scoring
Scoring happens **before** a space goes on-chain. Rejected spaces never reach the chain.
1. The owner signs `asset::create_object` (paying SUI gas) once the hero photo passes the object-level checks, emitting `ObjectCreated`.
2. In the "Add space" modal, the owner uploads the close-up and enters the details. The AQS pipeline runs synchronously ([AQS §9](./AD-QUALITY-SCORING.md)):
   - **REJECTED:** the reason is shown and the owner retakes. Nothing is written on-chain.
   - **ACCEPTED:** the owner enters a **fixed price per week** and signs `asset::add_space(obj, label, dims, placement, closeup_blob_id, price_per_week, …)`. The space starts in `SCORING` and `SpaceAdded` is emitted.
3. In the same request, the operator calls `asset::apply_score(&OperatorCap, space, aqs, grade, confidence_bps, rank_score_x100, rubric_version, report_blob_id, report_hash, &Clock)`. It stores the score, sets `status = AVAILABLE` and emits `SpaceScored`. The space is now listed.
4. The owner can change the price at any time with `asset::set_price` (existing leases keep their price).
5. The ENS relayer mirrors every step.

### 4.2 Tokenisation eligibility (checked in `offering::create`)
- The space is `AVAILABLE`, `grade ≥ B` (AQS ≥ 55) and has no existing offering.
- The owner is verified in `KycRegistry` (mock flow, §5).
- `completed_leases ≥ 1` **or** `accepted_proofs ≥ 1`. **Testnet demo override:** `Config.demo_mode = true` waives this, so a fresh space can be tokenised during demos. The override is shown in the UI.

### 4.3 Offering parameters
| Param | Default | Bounds |
|---|---|---|
| `total_units` | 10,000 | fixed |
| `revenue_share_bps` (share of gross lease revenue paid to unit holders) | 6,000 | 1,000–8,800 (max = 100% − 12% platform fee) |
| `retained_units` (owner) | 2,000 | ≥ 1,000 |
| `price_per_unit_usdc` | set by the owner | > 0 |
| `min_raise_units` | 50% of units offered | 0–offered |
| `sale_duration_ms` | 3 days | **5 minutes** – 30 days (short windows are allowed for testnet demos) |
| `per_investor_max_units` | 2,500 | — |
| `term_months` | 24 | 6–36 (recorded and displayed) |

### 4.4 Price
The owner sets the **price per unit** directly. The UI shows only arithmetic, no valuation model: total raise at that price, and what one unit earns per 1 USDC of lease revenue (`revenue_share_bps / 10_000 / 10_000`).

### 4.5 Primary sale
```move
public fun create<C>(space: &mut AdSpace, reg: &KycRegistry, cfg: &Config, revenue_share_bps: u16, retained_units: u64,
    price_per_unit: u64, min_raise_units: u64, sale_duration_ms: u64, per_investor_max: u64, term_months: u16,
    legal_pack_hash: vector<u8>, legal_pack_blob_id: String, owner_accept_sig_hash: vector<u8>,
    clock: &Clock, ctx: &mut TxContext)                                   // shares SpaceOffering<C>
public fun buy_primary<C>(o: &mut SpaceOffering<C>, reg: &KycRegistry, pay: Coin<C>, units: u64,
    accept_sig_hash: vector<u8>, clock: &Clock, ctx: &mut TxContext)       // exact payment
public fun close<C>(o: &mut SpaceOffering<C>, space: &mut AdSpace, clock: &Clock, ctx: &mut TxContext) // anyone, after end or when sold out
public fun refund<C>(o: &mut SpaceOffering<C>, ctx: &mut TxContext): Coin<C>                           // REFUNDING state
```
- `create`: checks eligibility and sets `space.offering_id`. It credits `retained_units` to the owner's `Holding` and emits `OfferingOpened` (with the series number = offering sequence).
- `buy_primary`:
  - the buyer must be verified (`assert_verified`);
  - `units` ≤ remaining and ≤ `per_investor_max`;
  - payment must equal `units × price_per_unit` exactly;
  - USDC goes to `raise`, and units are credited;
  - emits `UnitsPurchased` with `accept_sig_hash`.
- `close`:
  - **Success** (units sold ≥ `min_raise_units`): `raise − 3% origination fee` goes to the owner and the fee to the treasury. Unsold units are credited to the owner. The offering becomes `TOKENISED`.
  - **Otherwise**: the offering becomes `REFUNDING`, `space.offering_id = none`, and investors call `refund`.

---

## 5. Mock identity verification (`kyc`)

```move
public struct KycRecord has store, drop {
    verified: bool, investor_type: u8,       // 1 accredited · 2 non-US · 3 retail (self-certified, display only)
    country: vector<u8>, expires_ms: u64, frozen: bool,
    ref_hash: vector<u8>,                    // sha256("mock:" + submissionId) — no PII on-chain
}
public struct KycRegistry has key { id: UID, version: u64, records: Table<address, KycRecord> }
public fun set_record(_: &OperatorCap, r: &mut KycRegistry, who: address, rec: KycRecord)
public fun freeze(_: &AdminCap, r: &mut KycRegistry, who: address)
public fun assert_verified(r: &KycRegistry, who: address, clock: &Clock)   // verified && !frozen && not expired
```

**Mock flow (UI → API → chain):**
1. **"Verify your identity"** is a 3-step form:
   1. Personal details: legal name, date of birth, country, address.
   2. Investor type self-certification: accredited, non-US or retail, with the relevant attestations as checkboxes.
   3. ID document: an upload field with a camera option. The file is only checked for type and size, then discarded.
2. A progress screen reads "Checking your documents…" for about 3 seconds. Small print says: *"Identity verification will be provided by Sumsub or Persona. This testnet demo auto-approves."*
3. The API stores the submission (PII) in the private DB only. The operator calls `kyc::set_record` with a 1-year expiry and emits `InvestorVerified`.
4. The ENS relayer writes `eth.brandmystuff.attested.verified=true` on the user's name.
5. The admin console can freeze or unfreeze a record, which blocks buying and resale.

**ERC-3643 mapping:**
| ERC-3643 | Here |
|---|---|
| Identity Registry | `KycRegistry` |
| Compliance `canTransfer` | `assert_verified` inside `buy_primary` and `market::fill` |
| Agent: freeze | `kyc::freeze` (AdminCap) |
| Token pause | `Config.paused` |

---

## 6. Leasing, escrow, proofs & revenue distribution

### 6.1 Booking (human)
```move
public struct SpaceCalendar has key { id: UID, space_id: ID, booked: Table<u64 /*week index since epoch*/, ID> }
public struct AdLease has key, store {        // owned by the advertiser (display NFT); state changes via shared LeaseEscrow
    id: UID, space_id: ID, escrow_id: ID, advertiser: address,
    start_week: u64, weeks: u16, total_usdc: u64,
    creative_blob_id: String, creative_hash: vector<u8>,   // chosen from the advertiser's brand kit
    landing_url: String, brand: String, ens_label: String,
}
public struct LeaseEscrow<phantom C> has key {  // shared; holds the state machine
    id: UID, lease_id: ID, space_id: ID, advertiser: address, owner: address,
    escrow: Balance<C>, tranches: u16, released: u16, per_tranche: u64,
    status: u8,          // PENDING_APPROVAL, AWAITING_INSTALL, LIVE, COMPLETED, DISPUTED, CANCELLED, REFUNDED
    approve_deadline_ms: u64, install_deadline_ms: u64,
    proofs: Table<u16 /*period*/, String /*photo blob id*/>, dispute_open_until_ms: u64,
}
public fun book<C>(space: &AdSpace, cal: &mut SpaceCalendar, pay: Coin<C>, start_week: u64, weeks: u16,
    creative_blob_id: String, creative_hash: vector<u8>, landing_url: String, brand: String, clock: &Clock, ctx: &mut TxContext)
public fun book_for<C>(_: &OperatorCap, /* same args */, advertiser: address, …)   // x402 path (§6.6)
```
1. **Checkout** is one PTB signed by the advertiser's wallet, which also pays SUI gas.
   - The advertiser chooses the start week and duration (`1 ≤ weeks ≤ 52`). The total is `price_per_week × weeks`.
   - It checks the space is `AVAILABLE`, the weeks are free and `start_week ≥ current week`.
   - `pay` must equal exactly `price_per_week × weeks`.
   - It marks the weeks, creates `LeaseEscrow`, mints `AdLease` to the advertiser, and emits `LeaseBooked`.
   - Full upfront payment is deliberate: BrandMyMac's deposit-then-invoice model saw 6 of 20 winners default (https://brandmymac.com/terms).
2. **Creative**: the creative is picked from the advertiser's **brand kit** (uploaded once in their profile; PRD §6.13). After approval, the owner downloads print-ready files of it in several sizes (the space's exact size plus standard S/M/L).
3. **Creative approval**: the owner signs `approve_creative` → `AWAITING_INSTALL`, or `reject_creative` → full refund, weeks freed. After `approve_deadline_ms` (5 days; scaled by `demo_week_ms` in demo mode), **anyone** can call `expire_unapproved`, which refunds.
4. **Install**: the first proof (period 0) is the install proof. If it isn't accepted by `install_deadline_ms`, anyone can call `expire_uninstalled`, which refunds the full escrow.

**Demo timescale:** `Config.demo_week_ms` (default 7 days) defines the length of a "week" for calendars, periods and deadlines. On testnet demos it can be set to e.g. **10 minutes**, so a full lease lifecycle (book → approve → install → periods → complete) runs in under an hour. All deadlines derive from it.

### 6.2 Proof-of-display & tranche release
Periods: one per lease week, plus the install proof (period 0). So `tranches = weeks + 1` and `per_tranche = total / tranches`, with the remainder added to the last tranche.

**Check-in pipeline (operator):**
1. The owner captures the photo in-app (or via the phone camera link); it is timestamped and stored on Walrus.
2. The proof service (`gemini-3.1-flash-lite`, structured output) checks:
   - the creative is present and matches the approved creative image (`match_score_bps`);
   - it is the same object and space as the listing close-up (`object_match_bps`);
   - it is not synthetic or a photo of a screen.
   It also checks the pHash against earlier proofs to catch reuse.
3. If it passes, the operator calls:
```move
public fun accept_proof<C>(_: &OperatorCap, esc: &mut LeaseEscrow<C>, space: &mut AdSpace, cfg: &Config,
    period: u16, photo_blob_id: String, match_score_bps: u16, object_match_bps: u16, clock: &Clock, ctx: &mut TxContext)
public fun accept_proof_tokenised<C>(/* same */, o: &mut SpaceOffering<C>)
```
On-chain checks:
- the period hasn't been submitted and falls inside its window (`start + period × week`, plus a 1-week grace window for period 0);
- `match_score_bps ≥ 8000` and `object_match_bps ≥ 8000`.

It then releases one tranche through §6.3 and emits `ProofAccepted` and `TrancheReleased`. After the last tranche, the lease is `COMPLETED` and `space.completed_leases++`.

**Missed period:** once a period's window plus a 72-hour cure window (scaled in demo mode) has passed, anyone can call `refund_missed(esc, period)`. That tranche goes back to the advertiser.

### 6.3 Revenue waterfall (per released tranche)
```
gross tranche (USDC)
 ├─ platform fee ........ 12%            → Config.treasury
 ├─ if tokenised: gross × revenue_share_bps / 10_000 → offering::distribute (all holders pro-rata, incl. owner's units)
 └─ remainder ........................... → owner
```
Not tokenised: 12% platform, 88% owner. All payouts use `transfer::public_transfer(coin, addr)`.

### 6.4 Accumulator distribution & claims (in `offering`)
```move
const PRECISION: u128 = 1_000_000_000_000_000_000;
public struct Holding has store { units: u64, listed_units: u64, reward_debt: u128, claimable: u64 }
public struct SpaceOffering<phantom C> has key {
    id: UID, version: u64, seq: u64 /*series no.*/, space_id: ID, owner: address,
    revenue_share_bps: u16, total_units: u64, sold_units: u64, retained_units: u64, min_raise_units: u64,
    price_per_unit: u64, per_investor_max: u64, sale_end_ms: u64, term_months: u16,
    legal_pack_hash: vector<u8>, legal_pack_blob_id: String,
    status: u8,                        // OPEN, TOKENISED, REFUNDING
    acc_per_unit: u128, dust: u128,
    holders: Table<address, Holding>, holder_count: u64,
    raise: Balance<C>, rewards: Balance<C>, total_distributed: u64,
}
public(package) fun distribute<C>(o: &mut SpaceOffering<C>, rev: Balance<C>) {
    let num = (rev.value() as u128) * PRECISION + o.dust;
    o.acc_per_unit = o.acc_per_unit + num / (o.total_units as u128);
    o.dust = num % (o.total_units as u128);
    o.total_distributed = o.total_distributed + rev.value();
    o.rewards.join(rev);
}
fun settle(o: &SpaceOffering<C>, h: &mut Holding) {
    let accrued = (h.units as u128) * o.acc_per_unit;
    h.claimable = h.claimable + (((accrued - h.reward_debt) / PRECISION) as u64);
    h.reward_debt = accrued;
}
public fun claim<C>(o: &mut SpaceOffering<C>, ctx: &mut TxContext): Coin<C>
```
- **Every unit movement** (buy, market fill, refund) calls `settle` on both parties **before** changing units, then sets `reward_debt = units × acc_per_unit`.
- Revenue that arrives while the offering is still `OPEN` is attributed across all 10,000 units. Unsold units' share accrues to the owner, because unsold units are credited to the owner on close.
- The portfolio shows accrued income computed off-chain (`units × acc − reward_debt`) and a **Claim** button.

### 6.5 Disputes & extension
- **Dispute:** the advertiser can call `open_dispute(esc)` within 72 hours after any accepted proof (scaled in demo mode). This freezes further releases.
- **Resolution:** the admin resolves with `resolve_dispute(&AdminCap, esc, refund_remaining: bool)`. `true` refunds the rest of the escrow to the advertiser; `false` resumes releases.
- **Extension:** the advertiser calls `extend(esc, cal, pay, extra_weeks)` to book the following weeks if free. This adds tranches, and ENS `renew` runs for the lease name.

### 6.6 x402 payments (AI agents & API clients)
Agents lease spaces over HTTP with **x402 v2** (https://github.com/x402-foundation/x402/blob/main/specs/x402-specification-v2.md), using the **`exact` scheme on Sui** (https://github.com/x402-foundation/x402/blob/main/specs/schemes/exact/scheme_exact_sui.md) and the HTTP headers `PAYMENT-REQUIRED` / `PAYMENT-SIGNATURE` / `PAYMENT-RESPONSE` (https://github.com/x402-foundation/x402/blob/main/specs/transports-v2/http.md).

```
Agent ── POST /api/x402/leases {spaceId, startWeek, weeks, creativeUrl, landingUrl, brand}
API   ── 402 + PAYMENT-REQUIRED: base64({x402Version:2, resource, accepts:[{
            scheme:"exact", network:"sui:testnet", amount:"<USDC atomic>",
            asset:"<USDC coin type>", payTo:"<platform treasury>", maxTimeoutSeconds:120,
            extra:{ intentId }}]})
Agent ── builds + signs a Sui tx transferring exactly `amount` USDC to payTo (pays own gas)
Agent ── same POST + PAYMENT-SIGNATURE: base64({x402Version:2, accepted, payload:{signature, transaction}})
API   ── verify → settle (§15)
      ── operator PTB: lease::book_for(&OperatorCap, …, Coin<USDC> from treasury, advertiser = payer)
      ── 200 + PAYMENT-RESPONSE: base64({success:true, transaction:<digest>, network, payer}) + {leaseId, ensName}
```
- **Idempotency:** the intent ID binds the quote. Each payment digest can settle at most once.
- **Failure after settlement:** if `book_for` fails, the operator refunds the USDC to the payer and returns a 409 with the refund digest.
- **Creative upload:** the server fetches `creativeUrl` (image, ≤ 10 MB), stores it on Walrus and hashes it.
- **Same pattern** for `POST /api/x402/sponsorships` (§8).
- **Discovery:** the MCP tool `quote_lease` returns the exact `PaymentRequired`. `agent.brandmystuff.eth` advertises the endpoint (ENSIP-26).

---

## 7. Secondary market (`market`)
```move
public struct Listing has key { id: UID, offering_id: ID, seller: address, units: u64, price_per_unit: u64 }
public fun list<C>(o: &mut SpaceOffering<C>, units: u64, price_per_unit: u64, ctx: &mut TxContext)       // shares a Listing
public fun fill<C>(o: &mut SpaceOffering<C>, l: &mut Listing, reg: &KycRegistry, cfg: &Config, pay: Coin<C>, units: u64, clock: &Clock, ctx: &mut TxContext)
public fun cancel<C>(o: &mut SpaceOffering<C>, l: Listing, ctx: &mut TxContext)
```
- `list`: only allowed when the offering is `TOKENISED`. Units move from `units` to `listed_units` (not transferable while listed).
- `fill`, in order:
  1. `assert_verified(buyer)`;
  2. `per_investor_max` check;
  3. `settle` seller and buyer;
  4. move units;
  5. pay the seller `price × units − 1% fee`, with the fee to the treasury;
  6. emit `Trade`.
  Partial fills are allowed; a listing with 0 units left is deleted.
- `cancel`: returns `listed_units` to the seller.
- UI: an order list per offering (cheapest first), with Buy and List buttons in the portfolio.

---

## 8. Sponsored listings (`sponsor`)
```move
public fun buy_sponsorship<C>(obj: &mut ListedObject, cfg: &Config, pay: Coin<C>, tier: u8, days: u16, clock: &Clock, ctx: &mut TxContext)
public fun buy_sponsorship_for<C>(_: &OperatorCap, /* same */, payer: address)   // x402 path
```
- Price = `cfg.sponsor_price_per_day[tier] × days`: tier 1 is 3 USDC/day (search/listing slots), tier 2 is 10 USDC/day (homepage rail). The payment goes to the treasury.
- It sets `sponsored_until_ms = max(existing, now) + days × day_ms` (`day_ms` scales with the demo timescale) and emits `Sponsored`. The ENS relayer writes `attested.sponsored` and `sponsored-until`.
- Eligibility: the object is `LIVE` with at least one listed space. It never changes AQS or rank.

---

## 9. Pause, retire & admin
- `asset::pause_space` / `unpause_space` (owner): blocks new bookings; existing leases continue.
- `asset::retire_space` (owner): only when there are no active leases and no offering.
- `admin::set_paused(&AdminCap, cfg, bool)`: global pause of booking, buying and trading.
- `asset::takedown(&AdminCap, space)`: sets the status to `REJECTED`, refunds any active lease escrow and blocks new bookings (moderation).

## 10. Operator model
The platform's `OperatorCap` holder (the backend) writes scores, proof results, verification records and x402 bookings. Auditability comes from publishing every score report and proof photo on Walrus, with the blob ID and hash on-chain. `AdminCap` can mint a new `OperatorCap` and the old one can be destroyed (rotation).

## 11. Storage: Walrus
| Data | Access |
|---|---|
| Hero, close-up and context photos | public |
| Score reports (JSON) | public, hash on-chain + ENS |
| Mock legal document pack (PDF + index JSON) | public, hash on-chain + ENS |
| Creatives | public |
| Proof-of-display photos | public |
| Verification submissions, precise location, emails | **private DB only** |

- Upload: the server uses the testnet publisher `PUT https://publisher.walrus-testnet.walrus.space/v1/blobs?epochs=N`.
- Read: `GET https://aggregator.walrus-testnet.walrus.space/v1/blobs/<blobId>` (https://docs.wal.app/docs/http-api/storing-blobs).
- A testnet epoch is 1 day, so uploads use `epochs=53` (the maximum).

## 12. Wallets, gas & payments
- **Privy embedded Sui wallet** (Tier 2: Privy signs, we build and broadcast — https://docs.privy.io/wallets/overview/chains):
  - TEE execution enabled in the dashboard;
  - create with `createWallet({chainType:'sui'})` from `@privy-io/react-auth/extended-chains`;
  - sign via `useSignRawHash` over `blake2b256(messageWithIntent('TransactionData', bytes))`, wrapped in a custom `Signer` (https://docs.privy.io/wallets/using-wallets/other-chains/sui).
- **External wallets** via `@mysten/dapp-kit-react`.
- **Gas:** users pay their own SUI gas. The platform key pays operator transactions.
- **Wallet panel:**
  - SUI and USDC balances, and a copy-address button;
  - a **Send** screen (SUI or USDC to any address, signed by the user);
  - a **"Get test funds"** button: the platform key transfers configurable testnet amounts (default 0.2 SUI + 1 USDC) to the user. Limited to once per user per 24 h, tracked in Supabase, and only while the treasury holds a configurable reserve;
  - links to https://faucet.sui.io and https://faucet.circle.com as fallbacks.
- **Payments:** USDC only. Humans pay inside Move calls; agents pay via x402.
- **Client:** `@mysten/sui` 2.x `SuiGrpcClient` (JSON-RPC on public nodes is deprecated — https://docs.sui.io/develop/accessing-data/json-rpc-migration).

## 13. Indexing & read model
- A TypeScript **event poller** reads `brandmystuff` package events (Sui GraphQL `events` query, cursor persisted) into **Supabase** (Postgres):
  - tables: `objects`, `spaces`, `leases`, `proofs`, `offerings`, `holdings`, `distributions`, `claims`, `listings`, `trades`, `sponsorships`, `kyc`.
  - The same stream drives the ENS relayer.
- Object state is re-read from chain for detail pages, so the chain is the source of truth.
- Portfolio accrued amounts are computed from the offering's `acc_per_unit` and the holding's `reward_debt`.

## 14. Security (testnet MVP)
| Area | Control |
|---|---|
| Keys | Platform Sui key (CLI keystore) holds the caps. Sepolia platform key in `.env.local` |
| Invariants | Σ holdings.units = total_units. Σ claimable ≤ rewards. Escrow = total − released − refunded. No double-booked weeks |
| Rounding | u128 math with carried `dust` |
| Input validation | All tx builders validate on the server. The Move code re-checks everything |
| Replay | x402 digests stored with a unique constraint |

## 15. x402 facilitator (self-hosted)
The API is its own facilitator for the Sui `exact` scheme:
1. **Verify:**
   1. `network == "sui:testnet"`.
   2. Decode the transaction; the sender is the signer (`verifyTransactionSignature`).
   3. Dry-run it with `simulateTransaction`.
   4. From the balance changes, the treasury address receives exactly `amount` of the USDC coin type.
   5. The digest hasn't been seen before.
2. **Settle:** execute with the payer's signature, wait for the checkpoint, and return `PAYMENT-RESPONSE`.
3. The network ID `sui:testnet` is configurable.

Spec: https://github.com/x402-foundation/x402/blob/main/specs/schemes/exact/scheme_exact_sui.md

## 16. Events
`ProfileCreated, ObjectCreated, SpaceAdded, SpaceScored, PriceChanged, SpacePaused, SpaceRetired, SpaceTakenDown, InvestorVerified, InvestorFrozen, OfferingOpened, UnitsPurchased, OfferingClosed, OfferingRefunding, Refunded, Listed, Trade, ListingCancelled, LeaseBooked, CreativeApproved, CreativeRejected, LeaseExpired, ProofAccepted, TrancheReleased, TrancheRefunded, Distributed, Claimed, DisputeOpened, DisputeResolved, LeaseExtended, LeaseCompleted, Sponsored`

Every event carries `space_id` / `object_id` and the relevant `ens_namehash`.

## 17. Testnet deployment checklist
1. `sui client publish` the `brandmystuff` package with the platform key. Record the package ID and the `Config` / `KycRegistry` IDs in `deployments/testnet.json` and in ENS `eth.brandmystuff.sui.package`.
2. Fund the platform key with testnet SUI (`sui client faucet`) and test USDC (https://faucet.circle.com). It serves operator gas and the "Get test funds" button.
3. Set `Config.demo_week_ms` for demos (e.g. 10 minutes) and `demo_mode = true`.
4. Run the ENS bootstrap ([ENS §9](./ENS-INTEGRATION.md)).
5. Run the end-to-end scripts:
   1. create object → add space (accepted and rejected cases);
   2. book → approve → proofs → complete;
   3. tokenise → buy → proof → distribute → claim → list → fill;
   4. x402 lease;
   5. sponsorship.
