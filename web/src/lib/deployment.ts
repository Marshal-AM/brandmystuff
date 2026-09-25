/** Public deployment constants (Sui testnet + Sepolia ENSv2). Mirrors /deployments/*.json. */
export const SUI = {
  network: "testnet" as const,
  grpcUrl: "https://fullnode.testnet.sui.io:443",
  graphqlUrl: "https://graphql.testnet.sui.io/graphql",
  packageId: "0x926603f13f1a32f95057f50203dddb01bc24f1f799005cc40486fdf6969d201b",
  configId: "0x9486d765ff202d4531a02f19b133ca198b989b61c9ac5193f3f654e48b5c4082",
  kycRegistryId: "0xcf5585232728b0688cc83a7b21a851db7e0377a9f5044348d6ad77eb7ecb6202",
  adminCapId: "0x3f7e222ae88bd1715b1da113930905c66f63be0b9aeca3c00c32613d6a23ecaa",
  operatorCapId: "0x4359cc4198760c344e5e7b3530f279861469c4345d97799eda92b982845a5ffc",
  platformAddress: "0xc01af55e5dd68d924bd50e9c1556e07cd07cc1582e0f14cc0fdea17017c03848",
  usdcType: "0xa1ec7fc00a6f40db9693ad1415d0c193ad3906494428cf252621037bd7117e29::usdc::USDC",
  usdcDecimals: 6,
  weekMs: 600_000,
  explorer: "https://suiscan.xyz/testnet",
};

export const ENS_DEPLOYMENT = {
  parentName: "brandmystuff.eth",
  platformResolver: "0x74F61f74Dce90068f35d1B3D4f7b4a3886BDE54c" as `0x${string}`,
  rootRegistry: "0xeF15c35f03215bAdE4A054F034382534D8f1f30f" as `0x${string}`,
  platformKey: "0x2514844F312c02Ae3C9d4fEb40db4eC8830b6844" as `0x${string}`,
  explorer: "https://sepolia.etherscan.io",
  appUrl: "https://app.ens.dev",
};

export const WALRUS = {
  publisher: "https://publisher.walrus-testnet.walrus.space",
  aggregator: "https://aggregator.walrus-testnet.walrus.space",
  epochs: 53,
};

export const blobUrl = (blobId: string) => `${WALRUS.aggregator}/v1/blobs/${blobId}`;

export const usdc = (atomic: bigint | number | string) => Number(BigInt(atomic)) / 10 ** SUI.usdcDecimals;
export const toAtomic = (amount: number) => BigInt(Math.round(amount * 10 ** SUI.usdcDecimals));
