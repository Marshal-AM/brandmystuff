/** Compiles contracts/evm/BrandMyStuffPayoutRelayer.sol into src/server/payouts/relayer-artifact.json. */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const solc = require("solc");

const file = "BrandMyStuffPayoutRelayer.sol";
const source = readFileSync(resolve(__dirname, "../../contracts/evm", file), "utf8");
const input = { language: "Solidity", sources: { [file]: { content: source } }, settings: { optimizer: { enabled: true, runs: 200 }, evmVersion: "paris", outputSelection: { "*": { "*": ["abi", "evm.bytecode.object", "devdoc", "userdoc", "metadata"] } } } };
const out = JSON.parse(solc.compile(JSON.stringify(input)));
const errors = (out.errors ?? []).filter((e: any) => e.severity === "error");
if (errors.length) {
  console.error(errors.map((e: any) => e.formattedMessage).join("\n"));
  process.exit(1);
}
const c = out.contracts[file].BrandMyStuffPayoutRelayer;
const artifact = { contractName: "BrandMyStuffPayoutRelayer", version: "1.0", compiler: solc.version(), abi: c.abi, bytecode: "0x" + c.evm.bytecode.object, devdoc: c.devdoc, userdoc: c.userdoc };
writeFileSync(resolve(__dirname, "../src/server/payouts/relayer-artifact.json"), JSON.stringify(artifact, null, 2));
console.log("compiled", artifact.contractName, "with", artifact.compiler, "·", c.evm.bytecode.object.length / 2, "bytes");
