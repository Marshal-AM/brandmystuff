/** Dev utility: wipes the Supabase read model and fast-forwards event cursors to the chain head. */
import { config } from "dotenv";
import { resolve } from "node:path";
config({ path: resolve(__dirname, "../../.env.local") });
import postgres from "postgres";
import { SuiGrpcClient } from "@mysten/sui/grpc";
import { SUI } from "../src/lib/deployment";
import { MODULES } from "../src/lib/sui/tx";

(async () => {
  const sql = postgres(process.env.SUPABASE_DB_URL!, { ssl: "require", prepare: false, max: 1 });
  const keepUsers = process.argv.includes("--keep-users");
  const tables = ["activity", "unit_events", "listings", "holdings", "acceptances", "offerings", "tranches", "proofs", "clicks", "messages", "conversations", "leases", "space_analyses", "spaces", "sponsorships", "objects", "notifications", "reports", "chain_events", "cursors", "jobs", "x402_intents", "ens_writes", "kyc_submissions", "brand_assets", "test_fund_grants", "capture_codes", "admin_audit", "auth_nonces", "linked_wallets"];
  if (!keepUsers) tables.push("users");
  await sql.unsafe(`truncate ${tables.join(", ")} cascade`);
  await sql`delete from ens_names where kind <> 'platform'`;
  const c = new SuiGrpcClient({ network: "testnet", baseUrl: SUI.grpcUrl });
  for (const mod of MODULES) {
    let after: any;
    for (;;) {
      const r: any = await c.listEvents({ filter: { emitModule: `${SUI.packageId}::${mod}` }, ...(after ? { after } : {}), order: "ascending", limit: 50 } as any);
      if (r.endCursor) after = r.endCursor;
      if (!r.hasNextPage || !r.events?.length) break;
    }
    if (after) await sql`insert into cursors (name, cursor) values (${"events:" + mod}, ${after}) on conflict (name) do update set cursor = excluded.cursor`;
  }
  console.log("read model reset; cursors at chain head");
  await sql.end();
})();
