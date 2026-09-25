/** Applies supabase/migrations/*.sql in order, tracking applied files. Run: npx tsx scripts/db-migrate.ts */
import { config } from "dotenv";
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import postgres from "postgres";

config({ path: resolve(__dirname, "../../.env.local") });

async function main() {
  const url = process.env.SUPABASE_DB_URL;
  if (!url || url.includes("[YOUR-PASSWORD]")) throw new Error("SUPABASE_DB_URL is missing or still has the [YOUR-PASSWORD] placeholder");
  const sql = postgres(url, { ssl: "require", max: 1, prepare: false });
  await sql`create table if not exists _migrations (name text primary key, applied_at timestamptz not null default now())`;
  const dir = resolve(__dirname, "../supabase/migrations");
  for (const f of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
    const done = await sql`select 1 from _migrations where name = ${f}`;
    if (done.length) continue;
    console.log("applying", f);
    await sql.begin(async (tx) => {
      await tx.unsafe(readFileSync(resolve(dir, f), "utf8"));
      await tx`insert into _migrations (name) values (${f})`;
    });
  }
  await sql`alter table _migrations enable row level security`;
  console.log("migrations up to date");
  await sql.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
