/**
 * Upgrades the brandmystuff package to v3 (adds `payout` + offering::take_claimable) and creates
 * the shared PayoutRegistry. Signed by the platform key, which owns the UpgradeCap and AdminCap.
 *
 * Build first (needs a Sui CLI that matches the package toolchain, 1.80.x):
 *   cd move/brandmystuff && sui move build -e testnet --dump-bytecode-as-base64 > .v3-bytecode.json
 * Run: npx tsx scripts/upgrade-v3.ts
 */
import { config } from "dotenv";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { Transaction } from "@mysten/sui/transactions";

config({ path: resolve(__dirname, "../../.env.local") });

const CCTP_DOMAINS = [0, 2, 3, 6]; // Ethereum Sepolia, OP Sepolia, Arbitrum Sepolia, Base Sepolia

async function main() {
  const { execute } = await import("../src/server/sui");
  const depPath = resolve(__dirname, "../../deployments/sui.testnet.json");
  const dep = JSON.parse(readFileSync(depPath, "utf8"));
  if (dep.upgrades?.some((u: any) => u.version === 3)) throw new Error("v3 already published");
  const built = JSON.parse(readFileSync(resolve(__dirname, "../../move/brandmystuff/.v3-bytecode.json"), "utf8"));

  // 1) authorize → upgrade → commit
  const tx = new Transaction();
  const ticket = tx.moveCall({ target: "0x2::package::authorize_upgrade", arguments: [tx.object(dep.upgradeCapId), tx.pure.u8(0), tx.pure.vector("u8", built.digest)] });
  const receipt = tx.upgrade({ modules: built.modules, dependencies: built.dependencies, package: dep.latestPackageId, ticket });
  tx.moveCall({ target: "0x2::package::commit_upgrade", arguments: [tx.object(dep.upgradeCapId), receipt] });
  const r = await execute(tx);
  const pkg = r.created.find((o) => o.type === "package")?.id;
  if (!pkg) throw new Error(`upgrade ${r.digest}: new package id not found`);
  console.log("upgraded to v3", pkg, "digest", r.digest);

  // 2) create the shared PayoutRegistry
  const tx2 = new Transaction();
  tx2.moveCall({ target: `${pkg}::payout::create_registry`, arguments: [tx2.object(dep.adminCapId), tx2.pure.vector("u32", CCTP_DOMAINS)] });
  const r2 = await execute(tx2);
  const registry = r2.created.find((o) => o.type.endsWith("::payout::PayoutRegistry"))?.id;
  console.log("payout registry", registry, "digest", r2.digest);

  dep.latestPackageId = pkg;
  dep.payoutRegistryId = registry;
  dep.upgrades = [...(dep.upgrades ?? []), { version: 3, packageId: pkg, digest: r.digest, adds: ["payout (cross-chain payout routes)", "offering::take_claimable"] }];
  writeFileSync(depPath, JSON.stringify(dep, null, 2));

  // keep Published.toml in step with the chain
  const pubPath = resolve(__dirname, "../../move/brandmystuff/Published.toml");
  const pub = readFileSync(pubPath, "utf8").replace(/published-at = "0x[0-9a-f]+"/, `published-at = "${pkg}"`).replace(/version = \d+/, "version = 3");
  writeFileSync(pubPath, pub);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
