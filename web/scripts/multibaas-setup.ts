/**
 * Sets up cross-chain payouts on every chain that has a MultiBaas deployment configured
 * (MULTIBAAS_<CHAIN>_URL + MULTIBAAS_<CHAIN>_KEY in the root .env.local). Idempotent.
 *
 * Per chain, all through the MultiBaas REST API:
 *  - uploads the BrandMyStuffPayoutRelayer contract (ABI + bytecode), Circle's MessageTransmitter ABI, and an ERC-20 ABI
 *  - deploys the relayer (MultiBaas composes the create tx, the platform key signs, MultiBaas submits)
 *  - aliases + links it with event indexing on (PayoutDelivered), aliases + links Circle USDC for balance reads
 *  - registers a webhook when MULTIBAAS_WEBHOOK_URL is set (public URL of /api/webhooks/multibaas)
 * Writes relayer addresses to src/lib/payout-deployments.json.
 *
 * Run: npx tsx scripts/multibaas-setup.ts
 */
import { config } from "dotenv";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

config({ path: resolve(__dirname, "../../.env.local") });

const ERC20_ABI = [
  { type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ name: "account", type: "address" }], outputs: [{ name: "", type: "uint256" }] },
  { type: "function", name: "decimals", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint8" }] },
  { type: "function", name: "symbol", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "string" }] },
  { type: "event", name: "Transfer", anonymous: false, inputs: [{ name: "from", type: "address", indexed: true }, { name: "to", type: "address", indexed: true }, { name: "value", type: "uint256", indexed: false }] },
];
const MESSAGE_TRANSMITTER_ABI = [
  { type: "function", name: "receiveMessage", stateMutability: "nonpayable", inputs: [{ name: "message", type: "bytes" }, { name: "attestation", type: "bytes" }], outputs: [{ name: "success", type: "bool" }] },
  { type: "function", name: "usedNonces", stateMutability: "view", inputs: [{ name: "", type: "bytes32" }], outputs: [{ name: "", type: "uint256" }] },
  { type: "function", name: "localDomain", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint32" }] },
  { type: "event", name: "MessageReceived", anonymous: false, inputs: [{ name: "caller", type: "address", indexed: true }, { name: "sourceDomain", type: "uint32", indexed: false }, { name: "nonce", type: "uint64", indexed: true }, { name: "sender", type: "bytes32", indexed: false }, { name: "messageBody", type: "bytes", indexed: false }] },
];

async function main() {
  const mb = await import("../src/server/payouts/multibaas");
  const { RELAYER_ALIAS, RELAYER_LABEL } = await import("../src/server/payouts/registry");
  const { db, ok } = await import("../src/server/db");
  const chains = mb.multibaasChains();
  if (!chains.length) throw new Error("No MultiBaas deployments configured (set MULTIBAAS_<CHAIN>_URL and _KEY in .env.local)");
  const artifact = JSON.parse(readFileSync(resolve(__dirname, "../src/server/payouts/relayer-artifact.json"), "utf8"));
  const depPath = resolve(__dirname, "../src/lib/payout-deployments.json");
  const deployed: Record<string, any> = JSON.parse(readFileSync(depPath, "utf8"));
  console.log("platform EVM signer", mb.platformEvmAddress());

  for (const c of chains) {
    console.log(`\n== ${c.name} (${c.baseUrl})`);
    const st = await mb.chainStatus(c);
    if (Number(st.chainID) !== c.chainId) throw new Error(`${c.key}: deployment is on chain ${st.chainID}, expected ${c.chainId}`);
    const me = await mb.addressInfo(c, mb.platformEvmAddress());
    console.log(`  block ${st.blockNumber} · signer balance ${Number(BigInt(me.balance ?? "0")) / 1e18} ETH`);

    await mb.uploadContract(c, RELAYER_LABEL, { contractName: artifact.contractName, version: artifact.version, abi: artifact.abi, bytecode: artifact.bytecode, devdoc: artifact.devdoc, userdoc: artifact.userdoc });
    await mb.uploadContract(c, "circle_message_transmitter", { contractName: "MessageTransmitter", version: "1.0", abi: MESSAGE_TRANSMITTER_ABI });
    await mb.uploadContract(c, "usdc_erc20", { contractName: "USDC", version: "1.0", abi: ERC20_ABI });
    console.log("  contracts uploaded to the MultiBaas library");

    if (!deployed[c.key]) {
      const d = await mb.deployContract(c, RELAYER_LABEL, artifact.version, [c.messageTransmitter]);
      console.log(`  relayer deploying at ${d.address} · tx ${d.hash}`);
      for (let i = 0; i < 40; i++) {
        const r = await mb.receipt(c, d.hash);
        if (r) {
          if (r.data.status !== "0x1") throw new Error(`${c.key}: relayer deployment reverted (${d.hash})`);
          deployed[c.key] = { address: d.address, deployTx: d.hash, startingBlock: Number(r.data.blockNumber), deployedAt: new Date().toISOString() };
          writeFileSync(depPath, JSON.stringify(deployed, null, 2) + "\n");
          break;
        }
        await new Promise((res) => setTimeout(res, 3000));
      }
      if (!deployed[c.key]) throw new Error(`${c.key}: relayer deployment not mined in time (${d.hash})`);
    }
    const relayer = deployed[c.key];
    await mb.setAlias(c, RELAYER_ALIAS, relayer.address);
    // Index PayoutDelivered from now on (the free plan looks back at most 100 blocks; the relayer has no events before its first payout).
    await mb.linkContract(c, RELAYER_ALIAS, RELAYER_LABEL, artifact.version, "-100");
    await mb.setAlias(c, "circle-message-transmitter", c.messageTransmitter);
    await mb.linkContract(c, "circle-message-transmitter", "circle_message_transmitter", "1.0", undefined);
    await mb.setAlias(c, "usdc", c.usdc);
    await mb.linkContract(c, "usdc", "usdc_erc20", "1.0", undefined);
    console.log(`  relayer ${relayer.address} linked with event indexing; Circle MessageTransmitter + USDC aliased`);

    const hookBase = process.env.MULTIBAAS_WEBHOOK_URL;
    if (hookBase) {
      const url = `${hookBase.replace(/\/+$/, "")}?chain=${c.key}`;
      const h: any = await mb.ensureWebhook(c, url);
      if (h.secret) await ok(db().from("multibaas_webhooks").upsert({ chain: c.key, webhook_id: h.id, url, secret: h.secret }));
      console.log(`  webhook → ${url}`);
    } else {
      console.log("  no MULTIBAAS_WEBHOOK_URL (localhost); deliveries are confirmed from MultiBaas's event index instead");
    }
  }
  console.log("\nDone. Relayers:", JSON.stringify(deployed));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
