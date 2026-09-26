/**
 * Circle CCTP, Sui side (V1: Sui is V1-only until Circle ships Sui V2; keep this the only
 * file that knows CCTP package ids/versions so the swap is local).
 *
 * One Sui transaction per offering pays every routed holder:
 *   payout::release_routed(holder)  → Coin<USDC> (only works if the holder set a route)
 *   deposit_for_burn_with_caller(coin, domain, holder's EVM recipient, our relayer, …)
 * Circle then attests each burn message, and our relayer on the destination chain mints it.
 */
import { Transaction } from "@mysten/sui/transactions";
import { SUI } from "@/lib/deployment";
import { SUI_CCTP_DOMAIN } from "@/lib/payout-chains";
import { execute, type ExecResult } from "../sui";

export const CCTP_SUI = {
  version: 1,
  tokenMessengerMinter: "0x31cc14d80c175ae39777c0238f20594c6d4869cfab199f40b69f3319956b8beb",
  messageTransmitter: "0x4931e06dce648b3931f890035bd196920770e913e43e45990b383f6486fdd0a5",
  tokenMessengerMinterState: "0x5252abd1137094ed1db3e0d75bc36abcd287aee4bc310f8e047727ef5682e7c2",
  messageTransmitterState: "0x98234bd0fa9ac12cc0a20a144a22e36d6a32f7e0a97baaeaf9c76cdc6d122d2e",
  usdcTreasury: "0x7170137d4a6431bf83351ac025baf462909bffe2877d87716374fb42b9629ebe",
  denyList: "0x403",
  iris: "https://iris-api-sandbox.circle.com",
};

/** EVM address → 32-byte Sui `address` (left-padded), the CCTP mint-recipient/caller format. */
export const evmToBytes32 = (evm: string) => `0x${evm.toLowerCase().replace(/^0x/, "").padStart(64, "0")}`;

export type RoutedHolder = { holder: string; domain: number; recipient: string; relayer: string };

/** Releases each routed holder's claimable revenue and burns it to their chosen chain, in one tx. */
export async function releaseAndBurn(offeringId: string, holders: RoutedHolder[]): Promise<ExecResult> {
  const tx = new Transaction();
  for (const h of holders) {
    const coin = tx.moveCall({
      target: `${SUI.latestPackageId}::payout::release_routed`,
      typeArguments: [SUI.usdcType],
      arguments: [tx.object(SUI.operatorCapId), tx.object(SUI.payoutRegistryId), tx.object(offeringId), tx.pure.address(h.holder)],
    });
    tx.moveCall({
      target: `${CCTP_SUI.tokenMessengerMinter}::deposit_for_burn::deposit_for_burn_with_caller`,
      typeArguments: [SUI.usdcType],
      arguments: [
        coin,
        tx.pure.u32(h.domain),
        tx.pure.address(evmToBytes32(h.recipient)),
        tx.pure.address(evmToBytes32(h.relayer)),
        tx.object(CCTP_SUI.tokenMessengerMinterState),
        tx.object(CCTP_SUI.messageTransmitterState),
        tx.object(CCTP_SUI.denyList),
        tx.object(CCTP_SUI.usdcTreasury),
      ],
    });
  }
  return execute(tx);
}

export type Attested = { message: string; attestation: string; nonce: string };

/**
 * Circle's attestation for every CCTP message in a Sui transaction. Returns null while any is
 * still pending (V1 sandbox: GET /v1/messages/{sourceDomain}/{base58 digest}).
 */
export async function attestations(digest: string): Promise<Attested[] | null> {
  const r = await fetch(`${CCTP_SUI.iris}/v1/messages/${SUI_CCTP_DOMAIN}/${digest}`, { cache: "no-store" });
  if (r.status === 404) return null;
  if (r.status === 429) throw new Error("Circle attestation API rate limit (429); retrying later");
  if (!r.ok) throw new Error(`Circle attestation API ${r.status}`);
  const j = (await r.json()) as { messages?: { attestation: string; message: string; eventNonce: string }[] };
  const msgs = j.messages ?? [];
  if (!msgs.length || msgs.some((m) => !m.attestation || m.attestation === "PENDING")) return null;
  return msgs.map((m) => ({ message: m.message, attestation: m.attestation, nonce: String(m.eventNonce) }));
}

/** Reads mintRecipient + amount out of a CCTP V1 message (116-byte header + burn body). */
export function decodeBurnMessage(hex: string) {
  const b = hex.replace(/^0x/, "");
  const at = (start: number, len: number) => b.slice(start * 2, (start + len) * 2);
  return {
    sourceDomain: parseInt(at(4, 4), 16),
    destinationDomain: parseInt(at(8, 4), 16),
    nonce: BigInt("0x" + at(12, 8)).toString(),
    mintRecipient: "0x" + at(152, 32).slice(24),
    amount: BigInt("0x" + at(184, 32)).toString(),
  };
}
