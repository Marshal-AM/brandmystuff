/**
 * Queues split-permission jobs for existing users (docs/ENS-INTEGRATION.md §12): wallet users get
 * their own resolver, brands with a Scout agent get its ENS identity. The worker does the chain work.
 * Run after deploying the worker: npx tsx scripts/ens-permissions-backfill.ts
 */
import { config } from "dotenv";
import { resolve } from "node:path";
config({ path: resolve(__dirname, "../../.env.local") });

async function main() {
  const { db, q } = await import("../src/server/db");
  const { enqueue } = await import("../src/server/notify");
  const users = await q(db().from("users").select("id, account_type").eq("ens_status", "registered").not("evm_address", "is", null));
  for (const u of users) await enqueue("ens_delegate", { userId: u.id }, { dedupe: `ens_delegate:${u.id}` });
  const agents = await q(db().from("brand_agents").select("user_id, users!inner(ens_status)").eq("users.ens_status", "registered"));
  for (const a of agents) await enqueue("ens_agent", { userId: a.user_id }, { dedupe: `ens_agent:${a.user_id}` });
  console.log(`queued ${users.length} delegations and ${agents.length} agent identities`);
}

main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
