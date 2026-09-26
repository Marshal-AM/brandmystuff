"use client";
/**
 * Signs ENS record edits with the user's own embedded Ethereum wallet (Privy). Only used for
 * names on the user's own resolver, where that wallet holds key-scoped ROLE_SET_TEXT
 * (docs/ENS-INTEGRATION.md §12); the resolver itself rejects any other key.
 */
import { useWallets } from "@privy-io/react-auth";
import { createPublicClient, createWalletClient, custom, encodeFunctionData, parseAbi, toHex, type Address } from "viem";
import { sepolia } from "viem/chains";
import { normalize, packetToBytes } from "viem/ens";
import { useSession } from "./session";

const abi = parseAbi(["function setText(bytes name, string key, string value)", "function multicall(bytes[] calls) returns (bytes[])"]);

export function useEnsSigner() {
  const { wallets } = useWallets();
  const { me, api } = useSession();
  const d = me?.ensDelegation;
  const w = d ? wallets.find((x) => x.address.toLowerCase() === d.manager.toLowerCase()) : undefined;

  /** One multicall of setText calls on the user's resolver; resolves once mined. */
  async function setTexts(edits: { name: string; key: string; value: string }[]) {
    if (!d || !w) throw new Error("Your wallet can't edit ENS records yet");
    await api("/api/ens/gas", { method: "POST" }).catch(() => null); // tops up only when low
    await w.switchChain(sepolia.id);
    const provider = await w.getEthereumProvider();
    const wallet = createWalletClient({ account: w.address as Address, chain: sepolia, transport: custom(provider) });
    const pub = createPublicClient({ chain: sepolia, transport: custom(provider) });
    const calls = edits.map((e) => encodeFunctionData({ abi, functionName: "setText", args: [toHex(packetToBytes(normalize(e.name))), e.key, e.value] }));
    const hash = await wallet.writeContract({ address: d.address, abi, functionName: "multicall", args: [calls] });
    const r = await pub.waitForTransactionReceipt({ hash, timeout: 180_000 });
    if (r.status !== "success") throw new Error("The ENS transaction reverted");
    return hash;
  }

  return { ready: !!d && !!w, manager: d?.manager ?? null, keys: d?.managed_keys ?? [], setTexts };
}
