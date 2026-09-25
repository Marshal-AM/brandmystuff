/** Server-side Sui client and platform (operator/admin) signer. */
import { SuiGrpcClient } from "@mysten/sui/grpc";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import type { Signer } from "@mysten/sui/cryptography";
import type { Transaction } from "@mysten/sui/transactions";
import { SUI } from "@/lib/deployment";

let client: SuiGrpcClient | undefined;
export function sui(): SuiGrpcClient {
  if (!client) client = new SuiGrpcClient({ network: SUI.network, baseUrl: SUI.grpcUrl });
  return client;
}

let platform: Ed25519Keypair | undefined;
export function platformSigner(): Ed25519Keypair {
  if (!platform) {
    const k = process.env.SUI_PLATFORM_PRIVATE_KEY;
    if (!k) throw new Error("SUI_PLATFORM_PRIVATE_KEY missing");
    platform = Ed25519Keypair.fromSecretKey(k);
    if (platform.toSuiAddress() !== SUI.platformAddress) throw new Error("platform key does not match deployment");
  }
  return platform;
}

export type ExecResult = {
  digest: string;
  events: { type: string; json: any }[];
  created: { id: string; type: string }[];
};

/** Serialises platform-signed transactions to avoid gas-coin/object version races. */
let queue: Promise<unknown> = Promise.resolve();

export async function execute(tx: Transaction, signer: Signer = platformSigner()): Promise<ExecResult> {
  const run = async () => {
    const c = sui();
    tx.setSenderIfNotSet(signer.toSuiAddress());
    const res: any = await c.signAndExecuteTransaction({
      transaction: tx,
      signer,
      include: { effects: true, events: true, objectTypes: true },
    });
    const t = res.Transaction ?? res.FailedTransaction;
    if (!res.Transaction) {
      throw new Error(`Sui tx failed ${t?.digest}: ${JSON.stringify(t?.status?.error ?? t?.status)}`);
    }
    await c.waitForTransaction({ digest: t.digest });
    const types: Record<string, string> = t.objectTypes ?? {};
    const created = (t.effects?.changedObjects ?? [])
      .filter((o: any) => o.idOperation === "Created")
      .map((o: any) => ({ id: o.objectId, type: types[o.objectId] ?? "" }));
    const events = (t.events ?? []).map((e: any) => ({ type: e.eventType ?? e.type, json: e.json ?? e.parsedJson }));
    return { digest: t.digest, events, created };
  };
  if (signer.toSuiAddress() !== SUI.platformAddress) return run();
  const p = queue.then(run, run);
  queue = p.catch(() => undefined);
  return p;
}

export const findEvent = (r: ExecResult, name: string) => r.events.find((e) => e.type.endsWith(`::${name}`))?.json;
export const findCreated = (r: ExecResult, typeSuffix: string) => r.created.find((o) => o.type.includes(typeSuffix))?.id;

export async function balances(owner: string) {
  const c = sui();
  const [s, u] = await Promise.all([
    c.getBalance({ owner }),
    c.getBalance({ owner, coinType: SUI.usdcType }),
  ]);
  return { sui: BigInt((s as any).balance.balance), usdc: BigInt((u as any).balance.balance) };
}
