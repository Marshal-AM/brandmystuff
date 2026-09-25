# brandmystuff (testnet MVP)

Rent, lease and tokenise the ad spaces on the things you own. Specs live in [`docs/`](./docs).

| Layer | Where |
|---|---|
| Move package (Sui testnet) | `move/brandmystuff` — deployed IDs in `deployments/sui.testnet.json` |
| ENSv2 (Sepolia) | `brandmystuff.eth`, platform resolver + root registry in `deployments/ens.sepolia.json` |
| App (Next.js 16) | `web/` — UI, API routes, x402 facilitator, MCP server |
| Worker | `web/scripts/worker.ts` — Sui event indexer, ENS relayer jobs, deadline scheduler |
| Data | Supabase (read model, chat, notifications, jobs); Walrus testnet (media, reports, legal docs) |
| AI | Gemini `gemini-3.1-flash-lite` (scoring, proofs); free-tier rate limit handled (14 req/min) |

## Run

```bash
cd web
pnpm install
pnpm db:migrate          # applies supabase/migrations (needs SUPABASE_DB_URL)
pnpm dev                 # web on http://localhost:3010 + worker
```

Secrets are in `/.env.local` (symlinked into `web/`). Port 3010 is used because another app occupies 3000; add `http://localhost:3010` to the Privy app's allowed origins.

One-off / maintenance scripts:

| Script | Purpose |
|---|---|
| `pnpm ens:bootstrap` | (Re)register `brandmystuff.eth`, deploy resolver/registry, write platform + agent records |
| `npx tsx scripts/ens-agent-records.ts` | Point ENS URL / MCP / x402 records at `APP_URL` |
| `npx tsx scripts/reset-readmodel.ts [--keep-users]` | Wipe the Supabase read model and fast-forward event cursors |

Demo timing: a lease "week" is 10 minutes on this deployment (`Config.week_ms`, adjustable from `/admin`).

## Tests (one e2e per area, no unit tests)

| Command | Covers | Time |
|---|---|---|
| `pnpm e2e:flows` | Every backend flow via the real API: sign-in, test funds, onboarding, listing + AI scoring, chat, brand kit, booking, approval, print files, AI-verified proofs + payouts, sponsorship, mock KYC, tokenisation (legal pack, primary sale, distribution, claim), secondary market, disputes, x402 agent lease, MCP, activity/notifications/click tracking, ENS registration + live verification | ~7 min |
| `pnpm e2e:scoring` | AQS pipeline on the fixture set (accept, G3/G4/G5/G6 rejections, category mismatch) | ~2.5 min |
| `pnpm e2e:ui` | Browser: Privy email login (test account), onboarding with Privy-signed Sui tx, wallet, marketplace, space page, main pages | ~20 s (first run ~90 s) |

`e2e:flows` and `e2e:ui` need `pnpm dev` running. Test actors are funded from, and swept back to, the platform address — keep it topped up with testnet SUI/USDC.

## Operations

- Make someone an admin: `update users set is_admin = true where handle = '<handle>';` then use `/admin` (disputes, takedowns, investor freeze, week length, demo mode, pause, job retries, ENS relayer log).
- Platform wallet `0xc01a…3848` pays operator gas, the "Get test funds" button (0.2 SUI + 5 USDC per user per 24 h) and is the x402 `payTo` treasury.
