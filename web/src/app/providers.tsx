"use client";
import { PrivyProvider } from "@privy-io/react-auth";
import { DAppKitProvider } from "@mysten/dapp-kit-react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { dAppKit } from "@/lib/client/dappkit";
import { SessionProvider } from "@/lib/client/session";
import { ToastProvider } from "@/components/ui";

export default function Providers({ children }: { children: ReactNode }) {
  const [qc] = useState(() => new QueryClient({ defaultOptions: { queries: { staleTime: 5_000, refetchOnWindowFocus: false } } }));
  return (
    <PrivyProvider
      appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID!}
      config={{
        loginMethods: ["email", "google", "apple", "twitter", "passkey"],
        appearance: { theme: "dark", accentColor: "#ab9ff2", logo: "/logo.svg", landingHeader: "Sign in to brandmystuff", walletChainType: "ethereum-only" },
        embeddedWallets: { ethereum: { createOnLogin: "all-users" } },
      }}
    >
      <DAppKitProvider dAppKit={dAppKit}>
        <QueryClientProvider client={qc}>
          <ToastProvider>
            <SessionProvider>{children}</SessionProvider>
          </ToastProvider>
        </QueryClientProvider>
      </DAppKitProvider>
    </PrivyProvider>
  );
}
