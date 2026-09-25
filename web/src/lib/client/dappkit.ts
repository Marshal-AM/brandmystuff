"use client";
import { createDAppKit } from "@mysten/dapp-kit-react";
import { SuiGrpcClient } from "@mysten/sui/grpc";
import { SUI } from "@/lib/deployment";

export const dAppKit = createDAppKit({
  networks: ["testnet"],
  createClient: (network) => new SuiGrpcClient({ network, baseUrl: SUI.grpcUrl }),
  autoConnect: true,
});

declare module "@mysten/dapp-kit-react" {
  interface Register {
    dAppKit: typeof dAppKit;
  }
}
