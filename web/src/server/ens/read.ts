/** Live ENS reads through the Universal Resolver (used for public verification). */
import { createPublicClient, decodeAbiParameters, encodeFunctionData, http, parseAbi, type Hex } from "viem";
import { sepolia } from "viem/chains";
import { namehash, normalize, packetToBytes } from "viem/ens";
import { toHex } from "viem";
import { ENS } from "./contracts";

const pub = () => createPublicClient({ chain: sepolia, transport: http(process.env.SEPOLIA_RPC_URL, { retryCount: 2, timeout: 20_000 }) });
const urAbi = parseAbi(["function resolve(bytes name, bytes data) view returns (bytes, address)"]);
const profileAbi = parseAbi([
  "function text(bytes32 node, string key) view returns (string)",
  "function data(bytes32 node, string key) view returns (bytes)",
  "function addr(bytes32 node, uint256 coinType) view returns (bytes)",
]);

async function resolveCall(name: string, data: Hex) {
  const [out] = (await pub().readContract({
    address: ENS.universalResolver,
    abi: urAbi,
    functionName: "resolve",
    args: [toHex(packetToBytes(normalize(name))), data],
  })) as [Hex, string];
  return out;
}

export async function ensText(name: string, key: string) {
  try {
    const out = await resolveCall(name, encodeFunctionData({ abi: profileAbi, functionName: "text", args: [namehash(name), key] }));
    return decodeAbiParameters([{ type: "string" }], out)[0];
  } catch {
    return null;
  }
}

export async function ensData(name: string, key: string) {
  try {
    const out = await resolveCall(name, encodeFunctionData({ abi: profileAbi, functionName: "data", args: [namehash(name), key] }));
    return decodeAbiParameters([{ type: "bytes" }], out)[0];
  } catch {
    return null;
  }
}

export async function ensSuiAddr(name: string) {
  try {
    const out = await resolveCall(name, encodeFunctionData({ abi: profileAbi, functionName: "addr", args: [namehash(name), 784n] }));
    return decodeAbiParameters([{ type: "bytes" }], out)[0];
  } catch {
    return null;
  }
}

/** Two-way commitment check: ENS → Sui object id, and the Sui object stores this name. */
export async function verifyName(name: string, expectedSuiId: string | null, keys: string[] = []) {
  const [suiRef, ...texts] = await Promise.all([ensData(name, "eth.brandmystuff.sui.object"), ...keys.map((k) => ensText(name, k))]);
  const records: Record<string, string | null> = {};
  keys.forEach((k, i) => (records[k] = texts[i]));
  const ok = !!expectedSuiId && !!suiRef && suiRef.toLowerCase() === expectedSuiId.toLowerCase();
  return { name, suiRef, verified: ok, records };
}
