"use client";
import dynamic from "next/dynamic";
import type { ReactNode } from "react";
import { Spinner } from "@/components/ui";

const Providers = dynamic(() => import("./providers"), { ssr: false, loading: () => <div className="grid min-h-screen place-items-center"><Spinner /></div> });
const Shell = dynamic(() => import("@/components/shell"), { ssr: false });

export default function ClientRoot({ children }: { children: ReactNode }) {
  return (
    <Providers>
      <Shell>{children}</Shell>
    </Providers>
  );
}
