/**
 * Publishes move/mandate (the brand-agent BudgetMandate package) to Sui testnet with the
 * platform key and records its id in deployments/sui.testnet.json.
 * Build first: `cd move/mandate && sui move build`. Run: npx tsx scripts/publish-mandate.ts
 */
import { config } from "dotenv";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { Transaction } from "@mysten/sui/transactions";

config({ path: resolve(__dirname, "../../.env.local") });

async function main() {
  const { execute, platformSigner } = await import("../src/server/sui");
  const dir = resolve(__dirname, "../../move/mandate/build/brandmystuff_mandate/bytecode_modules");
  const modules = readdirSync(dir).filter((f) => f.endsWith(".mv")).map((f) => readFileSync(resolve(dir, f)).toString("base64"));
  if (!modules.length) throw new Error("No compiled modules; run `sui move build` in move/mandate first");
  const tx = new Transaction();
  const [cap] = tx.publish({ modules, dependencies: ["0x1", "0x2"] });
  tx.transferObjects([cap], platformSigner().toSuiAddress());
  const r = await execute(tx);
  const pkg = r.created.find((o) => o.type === "package")?.id ?? (await pkgFrom(r.digest));
  const upgradeCap = r.created.find((o) => o.type.includes("::package::UpgradeCap"))?.id;
  console.log("published", pkg, "upgradeCap", upgradeCap, "digest", r.digest);
  const depPath = resolve(__dirname, "../../deployments/sui.testnet.json");
  const dep = JSON.parse(readFileSync(depPath, "utf8"));
  dep.mandate = { packageId: pkg, upgradeCapId: upgradeCap, publishDigest: r.digest, module: "mandate", publishedAt: new Date().toISOString() };
  writeFileSync(depPath, JSON.stringify(dep, null, 2));
}

async function pkgFrom(digest: string) {
  const { sui } = await import("../src/server/sui");
  const t: any = await sui().getTransaction({ digest, include: { effects: true } } as any);
  const ch = (t.Transaction ?? t.transaction)?.effects?.changedObjects ?? [];
  return ch.find((o: any) => o.outputState === "PackageWrite" || o.objectType === "package")?.objectId;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
