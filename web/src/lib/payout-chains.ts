/**
 * Chains a holder can receive their revenue share on. Revenue is earned on Sui; for these
 * chains it is burned on Sui and minted natively here with Circle CCTP (USDC stays USDC).
 * Addresses are Circle's CCTP V1 testnet deployments (Sui is V1-only until Circle ships V2).
 */
export type PayoutChainKey = "eth-sepolia" | "base-sepolia" | "arb-sepolia" | "op-sepolia";

export type PayoutChain = {
  key: PayoutChainKey;
  name: string;
  short: string;
  chainId: number;
  /** Circle CCTP domain */
  domain: number;
  usdc: `0x${string}`;
  messageTransmitter: `0x${string}`;
  explorer: string;
  rpc: string;
  /** env var prefix for this chain's MultiBaas deployment: `${prefix}_URL`, `${prefix}_KEY` */
  multibaasEnv: string;
};

export const SUI_CCTP_DOMAIN = 8;

export const PAYOUT_CHAINS: PayoutChain[] = [
  {
    key: "eth-sepolia",
    name: "Ethereum Sepolia",
    short: "Ethereum",
    chainId: 11155111,
    domain: 0,
    usdc: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238",
    messageTransmitter: "0x7865fAfC2db2093669d92c0F33AeEF291086BEFD",
    explorer: "https://sepolia.etherscan.io",
    rpc: "https://ethereum-sepolia-rpc.publicnode.com",
    multibaasEnv: "MULTIBAAS_ETH_SEPOLIA",
  },
  {
    key: "base-sepolia",
    name: "Base Sepolia",
    short: "Base",
    chainId: 84532,
    domain: 6,
    usdc: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
    messageTransmitter: "0x7865fAfC2db2093669d92c0F33AeEF291086BEFD",
    explorer: "https://sepolia.basescan.org",
    rpc: "https://sepolia.base.org",
    multibaasEnv: "MULTIBAAS_BASE_SEPOLIA",
  },
  {
    key: "arb-sepolia",
    name: "Arbitrum Sepolia",
    short: "Arbitrum",
    chainId: 421614,
    domain: 3,
    usdc: "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d",
    // Arbitrum Sepolia's V1 MessageTransmitter differs from the other three.
    messageTransmitter: "0xaCF1ceeF35caAc005e15888dDb8A3515C41B4872",
    explorer: "https://sepolia.arbiscan.io",
    rpc: "https://sepolia-rollup.arbitrum.io/rpc",
    multibaasEnv: "MULTIBAAS_ARB_SEPOLIA",
  },
  {
    key: "op-sepolia",
    name: "Optimism Sepolia",
    short: "Optimism",
    chainId: 11155420,
    domain: 2,
    usdc: "0x5fd84259d66Cd46123540766Be93DFE6D43130D7",
    messageTransmitter: "0x7865fAfC2db2093669d92c0F33AeEF291086BEFD",
    explorer: "https://sepolia-optimism.etherscan.io",
    rpc: "https://sepolia.optimism.io",
    multibaasEnv: "MULTIBAAS_OP_SEPOLIA",
  },
];

export const chainByKey = (k: string) => PAYOUT_CHAINS.find((c) => c.key === k) ?? null;
export const chainByDomain = (d: number) => PAYOUT_CHAINS.find((c) => c.domain === d) ?? null;
export const isEvmAddress = (a: string) => /^0x[0-9a-fA-F]{40}$/.test(a.trim());
