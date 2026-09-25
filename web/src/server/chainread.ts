/** Read-only Move calls via simulation (e.g. accrued income from the accumulator). */
import { Transaction } from "@mysten/sui/transactions";
import { bcs } from "@mysten/sui/bcs";
import { SUI } from "@/lib/deployment";
import { sui } from "./sui";

export async function holdingOf(offeringId: string, address: string) {
  const tx = new Transaction();
  tx.setSender(SUI.platformAddress);
  tx.moveCall({ target: `${SUI.latestPackageId}::offering::holding_of`, typeArguments: [SUI.usdcType], arguments: [tx.object(offeringId), tx.pure.address(address)] });
  const r: any = await sui().simulateTransaction({ transaction: tx, include: { commandResults: true }, checksEnabled: false } as any);
  const t = r.Transaction ?? r.FailedTransaction;
  const rv = t?.commandResults?.[0]?.returnValues ?? r.commandResults?.[0]?.returnValues;
  if (!rv) return { units: 0n, listed: 0n, claimable: 0n };
  const dec = (v: any) => BigInt(bcs.u64().parse(Uint8Array.from(v.bcs ?? v)));
  return { units: dec(rv[0]), listed: dec(rv[1]), claimable: dec(rv[2]) };
}

export async function configSeq() {
  const r: any = await sui().getObject({ objectId: SUI.configId, include: { json: true } });
  const j = r.object?.json ?? {};
  return { offeringSeq: Number(j.offering_seq ?? 0), leaseSeq: Number(j.lease_seq ?? 0), weekMs: Number(j.week_ms ?? SUI.weekMs), demoMode: !!j.demo_mode };
}
