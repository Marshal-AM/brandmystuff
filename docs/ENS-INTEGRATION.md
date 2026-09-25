# brandmystuff — ENSv2 Integration Specification (Sepolia)

> Status: v2.0 (2026-09-25, testnet MVP — everything here is built and working on Sepolia today) · Network: **Ethereum Sepolia — ENSv2 Beta** · Related: [PRD](./PRD.md) · [Idea & Flows](./IDEA-AND-FLOWS.md) · [Tokenisation](./TOKENISATION-SPEC.md) · [AQS](./AD-QUALITY-SCORING.md)

ENS is brandmystuff's **naming, identity, metadata and permission backbone**. Every user, object, ad space and lease is an ENSv2 name; every piece of public listing metadata is an ENS record; every "who may change what, and until when" decision is an ENSv2 role or an ENSv2 expiry. Sui holds the money and the tokenised economic rights ([Tokenisation spec](./TOKENISATION-SPEC.md)); ENS holds *what the thing is, who it belongs to, and who may touch it*.

---

## 0. Ground truth about ENSv2 (as of 2026-09-25) — read before building

| Fact | Source |
|---|---|
| ENSv2 ships on **Ethereum L1**; the planned Namechain L2 was cancelled (Feb 2026) after post-Fusaka L1 gas fell ~99%. | https://www.theblock.co/post/388932/ens-labs-scraps-namechain-l2-shifts-ensv2-fully-ethereum-mainnet · https://www.coindesk.com/tech/2026/02/06/ethereum-s-ens-identity-system-scraps-planned-rollup-amid-vitalik-s-warning-about-layer-2-networks |
| **ENSv2 Beta on Sepolia** launched 2026-08-12 as "the last major public testing phase"; no mainnet date. | https://ens.domains/blog/post/ensv2-beta-public-testing |
| Contracts "not yet final and may change prior to mainnet deployment". Sepolia was **reset** between Alpha and Beta; addresses changed (2026-06-29 → 2026-09-15 deploy). Post-audit commits still landing. | https://docs.ens.domains/ensv2/overview · https://github.com/ensdomains/contracts-v2 |
| Reads are v2-ready in viem ≥ 2.35.0, ethers ≥ 6.17.0, ENSjs ≥ 4.2.3. **Writes** only in preview (ENSjs v5 alpha) → we hand-roll viem calls. | https://docs.ens.domains/web/ensv2-readiness |
| ENS cannot enumerate or query by value, so an index is required. We use our relayer log + read model (ENSNode optional). | https://docs.ens.domains/ensv2/indexing · https://ensnode.io/docs |
| Apps: ENS App v2 Beta https://app.ens.dev · Explorer https://explorer.ens.dev · Deployments https://docs.ens.domains/learn/deployments#sepolia-ensv2-beta | |
| AI tooling: https://docs.ens.domains/building-with-ai (llms.txt / llms-full.txt, Context7 MCP, community MCPs e.g. https://github.com/thenamespace/ens-mcp) | |

**Engineering consequences**
1. **Sepolia ENS data is disposable.** An idempotent `ens-reseed` job rebuilds the whole namespace from Sui state + Walrus + the DB.
2. **Never hardcode addresses** other than via a versioned `ens.deployments.sepolia.json` loaded at boot; never cache token IDs (they regenerate — https://docs.ens.domains/ensv2/mutable-token-ids). Key everything by **namehash / labelhash**.
3. Resolve through the **Universal Resolver** shipped by viem; do not bypass it.

### 0.1 Sepolia ENSv2 Beta addresses (pinned deploy 2026-09-15, commit `71a3b73`)
Source: https://raw.githubusercontent.com/ensdomains/contracts-v2/71a3b7339dbc55ab47667abdfe8303bac4f4c24e/contracts/docs/addresses/sepolia.md — **re-verify at build time** against https://docs.ens.domains/learn/deployments#sepolia-ensv2-beta.

| Contract | Address |
|---|---|
| RootRegistry | `0x9703dbd26dab89504490994138cf2c575251a9ce` |
| ETHRegistry | `0x657ea849311d3d5823348dded7c2aaafb3ede09e` |
| ETHRegistrar | `0xabe76f6c8dfced81aa5a2bb8034202a7136b94ca` |
| StandardRentPriceOracle | `0x9b0b9c65bdaf9794ff7697e4dcfb1f50581072bb` |
| VerifiableFactory | `0x9e726eb570beb6bceb495ab8cda7df517d4e841c` |
| PermissionedResolverImpl | `0x14f09fd05d4585759e54844dc9b00147131cf243` |
| UserRegistryImpl | `0xa80338aaa8d23831cea25e858d1774534abb0263` |
| UniversalResolver (proxy; libs ship it) | `0xeEeEEEeE14D718C2B47D9923Deab1335E144EeEe` |
| UniversalHelper | `0x33f571aa8a160a21b877cf6e0fb8806692b97df5` |
| PublicResolverV2 | `0xd7e590ad0e92a6ac1d81f4483a9b951d3585a50f` |
| MockUSDC (public `mint`) | `0x16f95d91dba7da3aca778ec053df0ff6c6a8aa8e` |
| Circle Sepolia USDC | `0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238` |

---

## 1. ENSv2 concepts we rely on (with links)

| Concept | Summary | Doc |
|---|---|---|
| Hierarchical registries | Each name has its own `subregistry` + `resolver`; resolution walks down; deepest resolver wins; **expired parent ⇒ entire subtree stops resolving** | https://docs.ens.domains/ensv2/registry-hierarchy |
| Permissioned Registry | ERC1155Singleton; entry `{subregistry, resolver, expiry(uint64), …}`; states AVAILABLE / RESERVED / REGISTERED; `register`, `renew` (extend only), `unregister`, `setSubregistry`, `setResolver`, `setURI` | https://docs.ens.domains/ensv2/permissioned-registry |
| UserRegistry | UUPS proxy per name for its subnames; "Managed" vs "Emancipated" patterns | https://docs.ens.domains/ensv2/registry-template |
| VerifiableFactory | CREATE2 77-byte proxies; addresses precomputable (`keccak256("UserRegistry", namehash, version)`, `keccak256("OwnedResolver", owner, version)`) | https://docs.ens.domains/ensv2/verifiable-factory |
| Enhanced Access Control (EAC) | Resource-scoped, revocable roles; ROOT roles = master key; admin role = `role << 128`; **max 15 holders per role per resource**; admin roles on a name only assignable **at registration** | https://docs.ens.domains/ensv2/enhanced-access-control |
| Permissioned Resolver | One per account; per-key/per-coinType role scoping, **not per-name**; `setText`, `setAddress`, `setData` (ENSIP-24), `setContenthash`, `multicall`, `linkToNode`/`linkToRecord`, default record | https://docs.ens.domains/ensv2/permissioned-resolver |
| Mutable token IDs | Token ID regenerates on role change/re-registration → key by namehash | https://docs.ens.domains/ensv2/mutable-token-ids |
| ETH Registrar | Commit-reveal (60s–24h), ERC-20 fees (MockUSDC on Sepolia), $8/yr 5+ chars | https://docs.ens.domains/ensv2/eth-registrar |
| Universal Resolver V2 | Single entry point for resolution incl. CCIP-Read | https://docs.ens.domains/ensv2/universal-resolver-v2 |
| Indexing | Registry & resolver events; `VerifiableFactory.ProxyDeployed` for discovery | https://docs.ens.domains/ensv2/indexing |
| Tutorials | App developers / contract developers (SimpleSubnameRegistrar) | https://docs.ens.domains/ensv2/tutorial-app-developers · https://docs.ens.domains/ensv2/tutorial-contract-developers |

ENSIPs used: ENSIP-5 text records https://docs.ens.domains/ensip/5 · ENSIP-9/11 multichain addresses https://docs.ens.domains/ensip/9 https://docs.ens.domains/ensip/11 · ENSIP-12 avatar https://docs.ens.domains/ensip/12 · ENSIP-15 normalisation https://docs.ens.domains/ensip/15 · ENSIP-18 profile keys https://docs.ens.domains/ensip/18 · ENSIP-24 data records (draft) https://docs.ens.domains/ensip/24 · ENSIP-26 agent records https://docs.ens.domains/ensip/26 · ENSIP-27 node classification (draft) https://docs.ens.domains/ensip/27.

---

## 2. Name hierarchy

```
brandmystuff.eth                                             PLATFORM ROOT (registered via ETHRegistrar; owner = platform key)
│  subregistry: R_root (UserRegistry)
│
├─ alice.brandmystuff.eth                                    USER ACCOUNT
│  │  subregistry: R_alice (UserRegistry)
│  └─ macbook.alice.brandmystuff.eth                         OBJECT
│     │  subregistry: R_obj (UserRegistry)
│     └─ lid-center.macbook.alice.brandmystuff.eth           AD SPACE  (the listing)
│        │  subregistry: R_space (UserRegistry)
│        └─ l-7.lid-center.macbook.alice.brandmystuff.eth    LEASE     (expiry = lease end)
│
├─ acme.brandmystuff.eth                                     ADVERTISER ACCOUNT (same shape as a user)
└─ agent.brandmystuff.eth                                    PLATFORM AI AGENT / MCP endpoint (ENSIP-26)
```

**Label rules** (ENSIP-15 normalisation, https://docs.ens.domains/ensip/15):
- Labels are normalised with `normalize()`.
- Accounts must match `[a-z0-9-]{3,32}`; objects and spaces `[a-z0-9-]{2,32}`.
- Reserved labels: `www, app, api, agent, admin, sponsored, lease, l-*`.
- On a collision, the app suggests the same label with a numeric suffix.
- Lease labels are system-generated as `l-<leaseSeq>`.

**Registries:** each name that has children gets its own **UserRegistry** proxy, deployed through the **VerifiableFactory** (https://docs.ens.domains/ensv2/verifiable-factory). The name is then pointed at it with `setSubregistry`. Leaf names (leases) need no registry.

---

## 3. Ownership & roles (all writes by the platform key)

The platform key:
- owns `brandmystuff.eth`;
- holds **ROOT roles** on every UserRegistry it deploys (`REGISTRAR`, `RENEW`, `UNREGISTER`, `SET_RESOLVER`, `SET_SUBREGISTRY`);
- pays all Sepolia gas.

Users and advertisers never sign ENS transactions. They do **own** their names, and hold the name-level roles listed below.

| Name | ERC1155 owner | Name-level roles granted at registration |
|---|---|---|
| `brandmystuff.eth` | Platform key | ETHRegistrar default set |
| `alice.…` | Alice's Privy EVM wallet | `ROLE_SET_RESOLVER`; **no** `ROLE_CAN_TRANSFER_ADMIN` (soulbound account) |
| `macbook.alice.…` | Alice's EVM wallet | `ROLE_SET_RESOLVER` (no transfer) |
| `lid-center.macbook.…` | Alice's EVM wallet | `ROLE_SET_RESOLVER` (no transfer) |
| `l-7.lid-center.…` | Advertiser's EVM wallet. For **x402 agents** with no EVM address, the platform key holds it in custody, and the agent's Sui address is stored in `addr(784)` | `ROLE_SET_RESOLVER` only; no transfer. **Expiry = lease end** |

- Users get the EVM wallet silently from Privy (`embeddedWallets.ethereum.createOnLogin`); it is only used as the ENS owner address.
- Role constants (bit values from https://docs.ens.domains/ensv2/permissioned-registry):
  - `REGISTRAR = 1<<0`, `UNREGISTER = 1<<12`, `RENEW = 1<<16`, `SET_SUBREGISTRY = 1<<20`, `SET_RESOLVER = 1<<24`;
  - admin roles are `role << 128`;
  - `CAN_TRANSFER_ADMIN = (1<<28)<<128`.

---

## 4. Resolver & records

### 4.1 One platform resolver
- A single **PermissionedResolver** proxy (`RES_PLATFORM`), deployed via VerifiableFactory, serves every name.
- The platform key holds its roles.
- Records are written with batched `multicall` (https://docs.ens.domains/ensv2/permissioned-resolver).
- Keys the platform guarantees are namespaced `eth.brandmystuff.attested.*`. All other keys mirror what the owner entered in the app.

### 4.2 Key conventions
- **Standard keys** per ENSIP-18: `description`, `url`, `avatar`, `com.twitter` (https://docs.ens.domains/ensip/18).
- **Custom keys** use the service prefix `eth.brandmystuff.*` (ENSIP-5, https://docs.ens.domains/ensip/5).
- **Node classification** uses `class` + `schema` (ENSIP-27 draft, https://docs.ens.domains/ensip/27).
- **Sui object IDs and hashes** go in ENSIP-24 `data` records via `setData` (https://docs.ens.domains/ensip/24).
- **Sui addresses** use **coinType 784** (SLIP-44 SUI) via `setAddress(name, 784, <32 bytes>)` (https://github.com/ensdomains/address-encoder/blob/main/src/coin/sui.ts).
- **Images:** `avatar` holds the Walrus aggregator HTTPS URL (ENSIP-12 accepts https).
- **No PII.** Location is city-level only.

### 4.3 Record catalogue

**`brandmystuff.eth`**
| Key | Value |
|---|---|
| `description`, `url`, `avatar` | brand profile |
| `class` / `schema` | `Platform` / Walrus URL of the JSON schemas |
| `eth.brandmystuff.sui.package` | Move package ID |
| `eth.brandmystuff.sui.network` | `testnet` |
| `eth.brandmystuff.aqs.rubric` | `aqs-1.0.0` |
| addr(784) | platform Sui treasury |
| addr(60) | platform key |

**`agent.brandmystuff.eth`** — `agent-context` (what the agent does) and `agent-endpoint[mcp]` (MCP URL), per ENSIP-26 (https://docs.ens.domains/ensip/26), plus `eth.brandmystuff.x402` (base URL of the x402 endpoints).

**`alice.brandmystuff.eth` (user / advertiser)**
| Key | Value |
|---|---|
| `class` | `Person` |
| `description`, `avatar`, `url`, `com.twitter` | profile |
| addr(60) | EVM wallet |
| **addr(784)** | Sui address |
| `eth.brandmystuff.sui.profile` (data) | Sui `Profile` ID |
| `eth.brandmystuff.attested.verified` | `true`/`false` (mock investor verification) |
| `eth.brandmystuff.attested.reputation` | JSON: leases completed, proof on-time % |
| `eth.brandmystuff.brandkit` (data) | advertisers only: Walrus blob ID of the brand-kit index (logos and creatives) |

**`macbook.alice.brandmystuff.eth` (object)**
| Key | Value |
|---|---|
| `class` | `PhysicalAsset` |
| `description`, `avatar` (hero photo) | |
| `eth.brandmystuff.category` | e.g. `laptop` |
| `eth.brandmystuff.make` / `.model` / `.color` | |
| `eth.brandmystuff.city` | coarse city (optional; listing filter only) |
| `eth.brandmystuff.attested.aqs` / `.grade` | object AQS |
| `eth.brandmystuff.attested.sponsored` / `.sponsored-until` | `true` / unix seconds |
| `eth.brandmystuff.sui.object` (data) | Sui `ListedObject` ID |
| `eth.brandmystuff.status` | `scoring|live|paused|retired` |

**`lid-center.macbook.alice.brandmystuff.eth` (ad space)**
| Key | Value |
|---|---|
| `class` | `AdSpace` |
| `description`, `avatar` (close-up photo) | |
| `eth.brandmystuff.dimensions` | `20x13cm` |
| `eth.brandmystuff.placement` | `rear` |
| `eth.brandmystuff.attested.aqs` / `.grade` / `.confidence` / `.rank` | AQS |
| `eth.brandmystuff.attested.score-report` (data) | Walrus blob ID + sha256 of the report |
| `eth.brandmystuff.price` | `usdc:45/week` (fixed, owner-set) |
| `eth.brandmystuff.status` | `available|leased|paused|retired|removed` |
| `eth.brandmystuff.lease.current` | current lease label |
| `eth.brandmystuff.token` | `units:10000;sold:6200;offering:<id>` when tokenised |
| `eth.brandmystuff.attested.legal` (data) | mock legal pack hash |
| `eth.brandmystuff.sui.object` (data) | Sui `AdSpace` ID |

**`l-7.lid-center.….eth` (lease)** — expiry = lease end
| Key | Value |
|---|---|
| `class` | `AdLease` |
| `avatar` | creative (Walrus URL) |
| `url` | landing page with UTM `utm_source=brandmystuff&utm_medium=sponsor` |
| `eth.brandmystuff.brand` | brand name |
| addr(784) | advertiser Sui address |
| `eth.brandmystuff.attested.creative` (data) | sha256 of the approved creative |
| `eth.brandmystuff.attested.proofs` | accepted proof count |
| `eth.brandmystuff.attested.state` | `pending|awaiting-install|live|disputed|completed|refunded` |
| `eth.brandmystuff.sui.object` (data) | Sui `LeaseEscrow` ID |

---

## 5. Permissions & leases with ENSv2

### 5.1 Lease = subname with expiry
| Sui event | ENS action (platform key) |
|---|---|
| `LeaseBooked` | `R_space.register("l-<seq>", …)` in **RESERVED** state (no owner) until the creative is approved, which blocks the label |
| `CreativeApproved` | Register `l-<seq>` → advertiser (or custody), `ROLE_SET_RESOLVER`, **expiry = lease end**; write lease records; set space `status=leased`, `lease.current` |
| `ProofAccepted` | Update `attested.proofs` and `state` |
| `LeaseExtended` | `R_space.renew(labelhash, newEnd)` (extend only) |
| `CreativeRejected` / `LeaseExpired` / refunds / dispute refund | `R_space.unregister(labelhash)`; lease `state` updated |
| `LeaseCompleted` | `state=completed`. The name **expires by itself** at the end time; at `block.timestamp ≥ expiry`, `ownerOf` returns 0 and it stops resolving |

- Leases are non-transferable because `ROLE_CAN_TRANSFER_ADMIN` is never granted.
- The advertiser owns the lease name and holds `ROLE_SET_RESOLVER` on it for the lease period. This is the permission model: ownership and roles run only until expiry.

### 5.2 Moderation
An admin takedown (`SpaceTakenDown` on Sui) triggers `unregister` of the space's active lease names and sets `status=removed`.

### 5.3 Pitfalls enforced in code
- Admin roles can only be set at registration, so role bitmaps are constants.
- Token IDs regenerate on role changes, so we never persist them and key everything by namehash.
- `brandmystuff.eth` is registered for 5+ years (the Sepolia fee is paid in mintable MockUSDC).

---

## 6. Reading & querying

| Layer | Role |
|---|---|
| **ENSv2 contracts** (canonical) | Names, owners, expiries, roles, records |
| **Relayer log** (Supabase) | Every write the relayer made: name, key, value, tx hash, Sui digest. Doubles as the index for listing subnames and filtering by record values |
| **Read model** (Supabase) | Marketplace queries; rebuilt from Sui events + the relayer log |
| **Direct resolution** | Detail pages and the "Verify on-chain" panel resolve live through the Universal Resolver with viem (`getEnsText`, `getEnsAddress({coinType: 784n})`), so anyone can check a listing without trusting our API |

ENSNode (https://ensnode.io/docs) can replace the relayer log as the index when its hosted `sepolia-v2` endpoint is stable. It is optional for v1.

---

## 7. Cross-chain integrity (ENS ↔ Sui)
1. Every Sui core object (`Profile`, `ListedObject`, `AdSpace`, `LeaseEscrow`) stores its ENS name and `namehash`.
2. Every ENS name stores its Sui object ID (`eth.brandmystuff.sui.object`) and the relevant Sui address (addr 784).
3. The relayer writes ENS only in response to a finalised Sui event and logs `(sui_digest → eth_tx_hash)`. The log is shown as a public audit feed.
4. The "Verify on-chain" panel checks both directions (`ENS.sui.object == object.id` and `object.ens_namehash == namehash(name)`) and shows a **Verified** or **Mismatch** badge.

---

## 8. Sponsored listings in ENS
- On `Sponsored`, the relayer writes `attested.sponsored=true` and `attested.sponsored-until=<unix>` on the object.
- A scheduled job sets `sponsored=false` after expiry.
- Organic `attested.rank` is never changed by sponsorship.

---

## 9. Bootstrap & implementation

### 9.1 Bootstrap script (`ens-bootstrap`, idempotent)
1. Mint MockUSDC to the platform key and `approve` the ETHRegistrar.
2. `commit(makeCommitment("brandmystuff", platformKey, secret, …))`, wait ≥ 60 s, then `register(…)` for 5 years (https://docs.ens.domains/ensv2/eth-registrar). Verify the exact ABI against the deployed contract at build time.
3. Deploy `RES_PLATFORM` (PermissionedResolver proxy) via `VerifiableFactory.deployProxy(PermissionedResolverImpl, salt, initData)`, then set it as the resolver of `brandmystuff.eth`.
4. Deploy `R_root` (UserRegistry proxy) via the factory with the platform key's ROOT roles, then `ETHRegistry.setSubregistry(brandmystuff, R_root)`.
5. Register `agent` and write the platform and agent records.
6. Save all addresses to `deployments/ens.sepolia.json`.

### 9.2 Relayer (`ens-relayer`)
- Consumes Sui events from the event poller at-least-once, deduped by `(tx digest, event seq)`.
- For each new parent, deploys its UserRegistry the first time a child is created.
- Batches record writes with `multicall`, uses a nonce manager, and retries with backoff.
- Target: Sui→ENS in under 60 s.
- `ens-reseed` mode rebuilds everything from Sui state after a Sepolia reset.

### 9.3 Snippets (viem)
```ts
import { createPublicClient, http, parseAbi, encodeFunctionData, toHex } from 'viem'
import { sepolia } from 'viem/chains'
import { normalize, packetToBytes } from 'viem/ens'

const pub = createPublicClient({ chain: sepolia, transport: http(process.env.SEPOLIA_RPC_URL) })
const regAbi = parseAbi([
  'function register(string label,address owner,address registry,address resolver,uint256 roleBitmap,uint64 expiry) returns (uint256)',
  'function renew(uint256 anyId,uint64 newExpiry)',
  'function unregister(uint256 anyId)',
  'function setSubregistry(uint256 anyId,address registry)',
])
const resAbi = parseAbi([
  'function setText(bytes name,string key,string value)',
  'function setAddress(bytes name,uint256 coinType,bytes value)',
  'function setData(bytes name,string key,bytes value)',
  'function multicall(bytes[] calls) returns (bytes[])',
])
const dns = (n: string) => toHex(packetToBytes(normalize(n)))

// lease name with expiry = lease end
await platform.writeContract({ address: spaceRegistry, abi: regAbi, functionName: 'register',
  args: ['l-7', advertiserEvm, '0x0000000000000000000000000000000000000000', RES_PLATFORM, 1n << 24n, BigInt(leaseEndUnix)] })

// batched records
const name = 'lid-center.macbook.alice.brandmystuff.eth'
await platform.writeContract({ address: RES_PLATFORM, abi: resAbi, functionName: 'multicall', args: [[
  encodeFunctionData({ abi: resAbi, functionName: 'setText', args: [dns(name), 'eth.brandmystuff.attested.aqs', '78'] }),
  encodeFunctionData({ abi: resAbi, functionName: 'setAddress', args: [dns(name), 784n, suiAddr32] }),
]]})

// verification read (any client)
await pub.getEnsText({ name: normalize(name), key: 'eth.brandmystuff.attested.aqs' })
```
All exact ABIs (registrar `commit`/`register`, factory `deployProxy`, UserRegistry and PermissionedResolver `initialize`) are taken from the verified sources in https://github.com/ensdomains/contracts-v2 at the deployed commit before use.

---

## 10. Feature map — every place ENS is used

| Product feature | ENS mechanism | Doc |
|---|---|---|
| Signup → handle `alice.brandmystuff.eth` | UserRegistry `register` | /ensv2/registry-template |
| Profile (avatar, bio, socials) | ENSIP-5/12/18 text records | /ensip/5, /ensip/12, /ensip/18 |
| Wallet addresses | addr(60), addr(784) | /ensip/9, /ensip/11 |
| Object creation | subname + UserRegistry + records | /ensv2/permissioned-registry |
| Ad-space listing (created only for spaces the AI accepted) | subname + records + `class=AdSpace` | /ensip/27 |
| Sui object linkage, report and legal hashes | ENSIP-24 data records | /ensip/24 |
| AI score publication | `attested.*` records | /ensv2/permissioned-resolver |
| Lease | subname with expiry; RESERVED during checkout | /ensv2/permissioned-registry#name-lifecycle |
| Lease extension / termination | `renew` / `unregister` | same |
| Advertiser permission over the lease | ownership + `ROLE_SET_RESOLVER` until expiry | /ensv2/enhanced-access-control |
| Soulbound accounts and leases | withholding `ROLE_CAN_TRANSFER_ADMIN` | /ensv2/permissioned-registry#transfers |
| Investor verification flag | `attested.verified` | — |
| Sponsored tag | `attested.sponsored*` | — |
| Tokenisation summary | `eth.brandmystuff.token` | — |
| Moderation | `unregister` | /ensv2/permissioned-registry |
| AI agent discovery (MCP + x402) | ENSIP-26 on `agent.brandmystuff.eth` | /ensip/26, /building-with-ai |
| Public verification | Universal Resolver reads | /ensv2/universal-resolver-v2 |

---

## 11. Limitations & mitigations
| Limitation | Mitigation |
|---|---|
| ENS can't be queried or enumerated | Relayer log + read model; live Universal Resolver reads for verification |
| Beta contracts may reset | Versioned deployments file; `ens-bootstrap` + `ens-reseed` |
| Write SDK immature | Thin internal viem wrapper with ABIs from contracts-v2 |
| Everything is public | No PII; hashes and Walrus pointers only |
| Platform key is a single point of trust (testnet) | Every write is logged against its Sui digest; the public audit feed shows it |
| No Sui reverse resolution | `Profile.ens_name` on Sui + read model |
