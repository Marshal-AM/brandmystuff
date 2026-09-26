/** Where our payout relayer lives on each chain (written by scripts/multibaas-setup.ts). */
import deployments from "@/lib/payout-deployments.json";

export const RELAYER_LABEL = "bms_payout_relayer";
export const RELAYER_ALIAS = "payout-relayer";
export const PAYOUT_DELIVERED_SIG = "PayoutDelivered(bytes32,address,uint256,bytes32,bytes32,uint64)";

type Deployed = { address: string; deployTx: string; startingBlock?: number; deployedAt: string };

export function relayerFor(chainKey: string): Deployed | null {
  return ((deployments as Record<string, Deployed | undefined>)[chainKey] ?? null) as Deployed | null;
}
