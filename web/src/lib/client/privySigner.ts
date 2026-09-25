/** @mysten/sui Signer backed by a Privy embedded Sui wallet (raw hash signing, Ed25519). */
import { Signer, type SignatureScheme } from "@mysten/sui/cryptography";
import { Ed25519PublicKey } from "@mysten/sui/keypairs/ed25519";
import { fromBase58, fromBase64, fromHex, toHex } from "@mysten/sui/utils";

export type SignRawHash = (i: { address: string; chainType: "sui"; hash: `0x${string}` }) => Promise<{ signature: `0x${string}` }>;

export function decodePublicKey(pk: string, address: string): Ed25519PublicKey {
  const attempts: (() => Uint8Array)[] = [
    () => fromHex(pk.replace(/^0x/, "")),
    () => fromBase58(pk),
    () => fromBase64(pk),
  ];
  for (const a of attempts) {
    try {
      let raw = a();
      if (raw.length === 33 && raw[0] === 0) raw = raw.slice(1);
      if (raw.length !== 32) continue;
      const pub = new Ed25519PublicKey(raw);
      if (pub.toSuiAddress() === address) return pub;
    } catch {}
  }
  throw new Error("Could not decode the Privy Sui public key");
}

export class PrivySuiSigner extends Signer {
  constructor(private address: string, private pub: Ed25519PublicKey, private signRawHash: SignRawHash) {
    super();
  }
  getKeyScheme(): SignatureScheme {
    return "ED25519";
  }
  getPublicKey() {
    return this.pub;
  }
  toSuiAddress() {
    return this.address;
  }
  async sign(digest: Uint8Array) {
    const { signature } = await this.signRawHash({ address: this.address, chainType: "sui", hash: `0x${toHex(digest)}` });
    return fromHex(signature.replace(/^0x/, "")) as Uint8Array<ArrayBuffer>;
  }
}
