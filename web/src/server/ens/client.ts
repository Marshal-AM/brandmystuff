/**
 * Thin viem wrapper over the ENSv2 contracts. All writes are made by the platform key.
 */
import {
  createPublicClient,
  createWalletClient,
  decodeEventLog,
  encodeFunctionData,
  http,
  keccak256,
  toBytes,
  toHex,
  type Address,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";
import { namehash, normalize, packetToBytes } from "viem/ens";
import {
  ENS,
  factoryAbi,
  registryAbi,
  resolverAbi,
  SUI_COIN_TYPE,
} from "./contracts";

export type Records = {
  texts?: Record<string, string>;
  datas?: Record<string, Hex>;
  addrs?: { coinType: bigint; value: Hex }[];
};

export function ensClients(rpcUrl: string, privateKey: Hex) {
  const account = privateKeyToAccount(privateKey);
  const transport = http(rpcUrl, { retryCount: 3, timeout: 60_000 });
  const pub = createPublicClient({ chain: sepolia, transport });
  const wallet = createWalletClient({ chain: sepolia, transport, account });
  return { pub, wallet, account };
}

export type EnsClients = ReturnType<typeof ensClients>;

export const labelId = (label: string) => BigInt(keccak256(toBytes(label)));
export const dnsName = (name: string): Hex => toHex(packetToBytes(normalize(name)));
export const nodeOf = (name: string): Hex => namehash(normalize(name));

/** Sui address (0x + 64 hex) → 32 raw bytes, as ENSIP-9 coinType 784 expects. */
export function suiAddressBytes(addr: string): Hex {
  const h = addr.toLowerCase().replace(/^0x/, "").padStart(64, "0");
  if (!/^[0-9a-f]{64}$/.test(h)) throw new Error(`invalid Sui address ${addr}`);
  return `0x${h}`;
}

export async function send(c: EnsClients, tx: { address: Address; abi: any; functionName: string; args: any[] }) {
  const { request } = await c.pub.simulateContract({ ...tx, account: c.account } as any);
  const hash = await c.wallet.writeContract(request as any);
  const receipt = await c.pub.waitForTransactionReceipt({ hash, timeout: 180_000 });
  if (receipt.status !== "success") throw new Error(`ENS tx reverted: ${hash}`);
  return { hash, receipt };
}

/** Deterministic salt for a proxy owned by the platform key. */
export const proxySalt = (kind: "registry" | "resolver", key: string) =>
  BigInt(keccak256(toBytes(`brandmystuff:${kind}:${key}`)));

async function isDeployed(c: EnsClients, addr: Address) {
  const code = await c.pub.getCode({ address: addr });
  return !!code && code !== "0x";
}

/** Deploys a proxy via VerifiableFactory and returns its address (from the ProxyDeployed event). */
async function deployProxy(c: EnsClients, implementation: Address, salt: bigint, data: Hex): Promise<Address> {
  const { receipt } = await send(c, {
    address: ENS.verifiableFactory,
    abi: factoryAbi,
    functionName: "deployProxy",
    args: [implementation, salt, data],
  });
  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== ENS.verifiableFactory.toLowerCase()) continue;
    try {
      const ev = decodeEventLog({ abi: factoryAbi, data: log.data, topics: log.topics });
      if (ev.eventName === "ProxyDeployed") return (ev.args as any).proxyAddress as Address;
    } catch {}
  }
  throw new Error("ProxyDeployed event not found");
}

/**
 * Deploys a UserRegistry proxy with the platform key holding the given ROOT roles.
 * `known` is a previously deployed address (cache); it is reused if it has code.
 */
export async function ensureUserRegistry(c: EnsClients, key: string, rootRoles: bigint, known?: Address | null): Promise<Address> {
  if (known && (await isDeployed(c, known))) return known;
  const data = encodeFunctionData({
    abi: registryAbi,
    functionName: "initialize",
    args: [[{ account: c.account.address, roleBitmap: rootRoles }]],
  });
  return deployProxy(c, ENS.userRegistryImpl, proxySalt("registry", key), data);
}

/** Deploys a PermissionedResolver proxy with the platform key holding the given ROOT roles. */
export async function ensureResolver(c: EnsClients, key: string, rootRoles: bigint, known?: Address | null): Promise<Address> {
  if (known && (await isDeployed(c, known))) return known;
  const data = encodeFunctionData({
    abi: resolverAbi,
    functionName: "initialize",
    args: [[{ account: c.account.address, roleBitmap: rootRoles }], []],
  });
  return deployProxy(c, ENS.permissionedResolverImpl, proxySalt("resolver", key), data);
}

export async function getState(c: EnsClients, registry: Address, label: string) {
  return c.pub.readContract({ address: registry, abi: registryAbi, functionName: "getState", args: [labelId(label)] }) as Promise<{
    status: number;
    expiry: bigint;
    latestOwner: Address;
    tokenId: bigint;
    resource: bigint;
  }>;
}

/** status: 0 AVAILABLE, 1 RESERVED, 2 REGISTERED */
export async function registerName(
  c: EnsClients,
  p: { registry: Address; label: string; owner: Address; subregistry?: Address; resolver: Address; roles: bigint; expiry: bigint },
) {
  const st = await getState(c, p.registry, p.label);
  if (st.status === 2 && st.expiry > BigInt(Math.floor(Date.now() / 1000))) return { skipped: true as const };
  return send(c, {
    address: p.registry,
    abi: registryAbi,
    functionName: "register",
    args: [
      p.label,
      p.owner,
      p.subregistry ?? "0x0000000000000000000000000000000000000000",
      p.resolver,
      p.roles,
      p.expiry,
    ],
  });
}

/** Reserves a label (no owner) so nobody else can take it until it is registered. */
export async function reserveName(c: EnsClients, p: { registry: Address; label: string; resolver: Address; expiry: bigint }) {
  const st = await getState(c, p.registry, p.label);
  if (st.status !== 0) return { skipped: true as const };
  return send(c, {
    address: p.registry,
    abi: registryAbi,
    functionName: "register",
    args: [p.label, "0x0000000000000000000000000000000000000000", "0x0000000000000000000000000000000000000000", p.resolver, 0n, p.expiry],
  });
}

export async function setSubregistry(c: EnsClients, registry: Address, label: string, sub: Address) {
  const cur = await c.pub.readContract({ address: registry, abi: registryAbi, functionName: "getSubregistry", args: [label] });
  if ((cur as string).toLowerCase() === sub.toLowerCase()) return { skipped: true as const };
  return send(c, { address: registry, abi: registryAbi, functionName: "setSubregistry", args: [labelId(label), sub] });
}

export async function renewName(c: EnsClients, registry: Address, label: string, expiry: bigint) {
  return send(c, { address: registry, abi: registryAbi, functionName: "renew", args: [labelId(label), expiry] });
}

export async function unregisterName(c: EnsClients, registry: Address, label: string) {
  const st = await getState(c, registry, label);
  if (st.status === 0) return { skipped: true as const };
  return send(c, { address: registry, abi: registryAbi, functionName: "unregister", args: [labelId(label)] });
}

export async function setRecords(c: EnsClients, resolver: Address, name: string, r: Records) {
  const dns = dnsName(name);
  const calls: Hex[] = [];
  for (const [k, v] of Object.entries(r.texts ?? {}))
    calls.push(encodeFunctionData({ abi: resolverAbi, functionName: "setText", args: [dns, k, v] }));
  for (const [k, v] of Object.entries(r.datas ?? {}))
    calls.push(encodeFunctionData({ abi: resolverAbi, functionName: "setData", args: [dns, k, v] }));
  for (const a of r.addrs ?? [])
    calls.push(encodeFunctionData({ abi: resolverAbi, functionName: "setAddress", args: [dns, a.coinType, a.value] }));
  if (!calls.length) return { skipped: true as const };
  return send(c, { address: resolver, abi: resolverAbi, functionName: "multicall", args: [calls] });
}

export const suiAddr = (sui: string) => ({ coinType: SUI_COIN_TYPE, value: suiAddressBytes(sui) });

export { decodeEventLog, namehash };
