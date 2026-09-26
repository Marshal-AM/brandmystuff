/**
 * CCTP smoke test, Sui → an EVM testnet, without the relayer: burns a small amount of the platform's
 * USDC on Sui (destination caller = the platform EVM key), waits for Circle's attestation, then
 * calls receiveMessage directly. Checks the Sui-side arguments, Iris polling and message decoding.
 * Run: npx tsx scripts/cctp-smoke.ts [chainKey] [atomicAmount]
 */
import { config } from "dotenv";
import { resolve } from "node:path";
config({ path: resolve(__dirname, "../../.env.local") });

import { Transaction } from "@mysten/sui/transactions";
import { createPublicClient, createWalletClient, erc20Abi, http, parseAbi } from "viem";
import { privateKeyToAccount } from "viem/accounts";

async function main() {
  const { SUI } = await import("../src/lib/deployment");
  const { chainByKey } = await import("../src/lib/payout-chains");
  const { CCTP_SUI, attestations, decodeBurnMessage, evmToBytes32 } = await import("../src/server/payouts/cctp");
  const { execute } = await import("../src/server/sui");
  const chain = chainByKey(process.argv[2] ?? "base-sepolia")!;
  const amount = BigInt(process.argv[3] ?? "10000");
  const acct = privateKeyToAccount(process.env.SEPOLIA_PLATFORM_PRIVATE_KEY as `0x${string}`);

  const tx = new Transaction();
  tx.moveCall({
    target: `${CCTP_SUI.tokenMessengerMinter}::deposit_for_burn::deposit_for_burn_with_caller`,
    typeArguments: [SUI.usdcType],
    arguments: [
      tx.coin({ type: SUI.usdcType, balance: amount }),
      tx.pure.u32(chain.domain),
      tx.pure.address(evmToBytes32(acct.address)),
      tx.pure.address(evmToBytes32(acct.address)),
      tx.object(CCTP_SUI.tokenMessengerMinterState),
      tx.object(CCTP_SUI.messageTransmitterState),
      tx.object(CCTP_SUI.denyList),
      tx.object(CCTP_SUI.usdcTreasury),
    ],
  });
  const r = await execute(tx);
  const burn = r.events.find((e) => e.type.endsWith("::deposit_for_burn::DepositForBurn"));
  console.log("sui burn", r.digest, burn?.json);

  const t0 = Date.now();
  let att = null;
  while (!att) {
    await new Promise((s) => setTimeout(s, 5000));
    att = await attestations(r.digest);
    process.stdout.write(`\rwaiting for Circle attestation… ${Math.round((Date.now() - t0) / 1000)}s`);
  }
  const m = decodeBurnMessage(att[0].message);
  console.log("\nattested", m);
  if (m.nonce !== String(burn?.json.nonce) || m.amount !== amount.toString() || m.mintRecipient.toLowerCase() !== acct.address.toLowerCase()) throw new Error("decoded message does not match the burn");

  const pub = createPublicClient({ transport: http(chain.rpc) });
  const wallet = createWalletClient({ account: acct, transport: http(chain.rpc) });
  const hash = await wallet.writeContract({ chain: null, address: chain.messageTransmitter, abi: parseAbi(["function receiveMessage(bytes message, bytes attestation) returns (bool)"]), functionName: "receiveMessage", args: [att[0].message as `0x${string}`, att[0].attestation as `0x${string}`] });
  const rc = await pub.waitForTransactionReceipt({ hash });
  // Read at the receipt's block on both sides: public RPCs are load-balanced and "latest" can lag.
  const at = (b: bigint) => pub.readContract({ address: chain.usdc, abi: erc20Abi, functionName: "balanceOf", args: [acct.address], blockNumber: b });
  const [before, after] = [await at(rc.blockNumber - 1n), await at(rc.blockNumber)];
  console.log(`${chain.name} mint ${rc.status} ${chain.explorer}/tx/${hash} · +${after - before} atomic USDC`);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
