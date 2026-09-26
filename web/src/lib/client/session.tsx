"use client";
/**
 * App session: Privy (embedded Sui wallet) or an external Sui wallet (dApp Kit),
 * an authenticated `api()` helper and a unified `run(tx)` that signs, executes and syncs.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { useSignRawHash } from "@privy-io/react-auth/extended-chains";
import { useCurrentAccount, useDAppKit } from "@mysten/dapp-kit-react";
import { SuiGrpcClient } from "@mysten/sui/grpc";
import type { Transaction } from "@mysten/sui/transactions";
import { toBase64 } from "@mysten/sui/utils";
import { SUI } from "@/lib/deployment";
import { PrivySuiSigner, decodePublicKey } from "./privySigner";

export type Me = {
  user: any;
  balances: { sui: string; usdc: string };
  kyc: any;
  unread: number;
  needsOnboarding: boolean;
};

type Ctx = {
  ready: boolean;
  authenticated: boolean;
  mode: "privy" | "sui" | null;
  me: Me | null;
  refresh: () => Promise<void>;
  login: () => void;
  loginWithWallet: () => Promise<void>;
  logout: () => Promise<void>;
  api: <T = any>(path: string, init?: RequestInit & { json?: unknown }) => Promise<T>;
  token: () => Promise<string | null>;
  run: (tx: Transaction) => Promise<{ digest: string; events: { type: string; json: any }[] }>;
  signMessage: (msg: string) => Promise<string>;
  address: string | null;
  events: EventTarget;
};

const SessionCtx = createContext<Ctx | null>(null);
export const client = new SuiGrpcClient({ network: SUI.network, baseUrl: SUI.grpcUrl });

export class ApiError extends Error {
  constructor(public status: number, message: string, public data: any) {
    super(message);
  }
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const privy = usePrivy();
  const { signRawHash } = useSignRawHash();
  const account = useCurrentAccount();
  const dAppKit = useDAppKit();
  const [me, setMe] = useState<Me | null>(null);
  const [suiSession, setSuiSession] = useState<boolean>(false);
  const [bootstrapped, setBootstrapped] = useState(false);
  const events = useRef(new EventTarget()).current;

  const mode: Ctx["mode"] = privy.authenticated ? "privy" : suiSession ? "sui" : null;

  // usePrivy() hands back a new object on most renders. Read it through a ref so
  // token/api/refresh keep a stable identity; otherwise every consumer effect
  // re-runs, /api/me is refetched in a loop and forms seeded from `me` get wiped.
  const privyRef = useRef(privy);
  useEffect(() => {
    privyRef.current = privy;
  }, [privy]);
  const token = useCallback(async () => (privyRef.current.authenticated ? await privyRef.current.getAccessToken() : null), []);

  const api = useCallback(
    async <T,>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> => {
      const headers = new Headers(init.headers);
      const t = await token();
      if (t) headers.set("authorization", `Bearer ${t}`);
      let body = init.body;
      if (init.json !== undefined) {
        headers.set("content-type", "application/json");
        body = JSON.stringify(init.json);
      }
      const res = await fetch(path, { ...init, headers, body, credentials: "include" });
      const ct = res.headers.get("content-type") ?? "";
      const data = ct.includes("json") ? await res.json() : await res.text();
      if (!res.ok) throw new ApiError(res.status, (data as any)?.error ?? `Request failed (${res.status})`, data);
      return data as T;
    },
    [token],
  );

  const refresh = useCallback(async () => {
    try {
      const m = await api<Me>("/api/me");
      setMe(m);
      if (!privyRef.current.authenticated) setSuiSession(true);
    } catch (e: any) {
      if (e?.status === 401) {
        setMe(null);
        setSuiSession(false);
      }
    }
  }, [api]);

  useEffect(() => {
    if (!privy.ready) return;
    refresh().finally(() => setBootstrapped(true));
  }, [privy.ready, privy.authenticated, refresh]);

  const loginWithWallet = useCallback(async () => {
    if (!account) throw new Error("Connect a Sui wallet first");
    const n = await api<{ message: string }>(`/api/auth/sui/nonce?address=${account.address}`);
    const signed = await dAppKit.signPersonalMessage({ message: new TextEncoder().encode(n.message) });
    await api("/api/auth/sui/verify", { method: "POST", json: { address: account.address, message: n.message, signature: signed.signature } });
    setSuiSession(true);
    await refresh();
  }, [account, api, dAppKit, refresh]);

  const logout = useCallback(async () => {
    if (privyRef.current.authenticated) await privyRef.current.logout();
    await fetch("/api/auth/logout", { method: "POST" });
    try {
      await dAppKit.disconnectWallet();
    } catch {}
    setSuiSession(false);
    setMe(null);
  }, [dAppKit]);

  const privySigner = useMemo(() => {
    const u = me?.user;
    if (mode !== "privy" || !u?.sui_address) return null;
    const linked = (privy.user?.linkedAccounts ?? []).find((a: any) => a.type === "wallet" && a.chainType === "sui") as any;
    const pk = linked?.publicKey ?? u.sui_public_key;
    if (!pk) return null;
    return new PrivySuiSigner(u.sui_address, decodePublicKey(pk, u.sui_address), signRawHash as any);
  }, [mode, me, privy.user, signRawHash]);

  const run = useCallback(
    async (tx: Transaction) => {
      let digest: string;
      if (mode === "privy") {
        if (!privySigner) throw new Error("Your Sui wallet is still being set up — try again in a moment");
        tx.setSenderIfNotSet(privySigner.toSuiAddress());
        const r: any = await client.signAndExecuteTransaction({ transaction: tx, signer: privySigner, include: { effects: true } });
        if (!r.Transaction) throw new Error(`Transaction failed: ${JSON.stringify(r.FailedTransaction?.status?.error ?? "")}`);
        digest = r.Transaction.digest;
      } else if (mode === "sui") {
        const r: any = await dAppKit.signAndExecuteTransaction({ transaction: tx });
        if (r.FailedTransaction || r.$kind === "FailedTransaction") throw new Error(`Transaction failed: ${JSON.stringify(r.FailedTransaction?.status?.error ?? "")}`);
        digest = r.Transaction?.digest ?? r.digest;
      } else throw new Error("Sign in first");
      const synced = await api<{ events: any[] }>("/api/sync", { method: "POST", json: { digest } });
      refresh();
      return { digest, events: synced.events };
    },
    [mode, privySigner, dAppKit, api, refresh],
  );

  const signMessage = useCallback(
    async (msg: string) => {
      const bytes = new TextEncoder().encode(msg);
      if (mode === "privy") {
        if (!privySigner) throw new Error("Wallet not ready");
        const r = await privySigner.signPersonalMessage(bytes);
        return r.signature;
      }
      const r = await dAppKit.signPersonalMessage({ message: bytes });
      return r.signature;
    },
    [mode, privySigner, dAppKit],
  );

  // Live notifications / messages over SSE
  useEffect(() => {
    if (!me?.user?.id) return;
    let es: EventSource | null = null;
    let stop = false;
    (async () => {
      const t = await token();
      if (stop) return;
      es = new EventSource(`/api/stream${t ? `?token=${encodeURIComponent(t)}` : ""}`, { withCredentials: true });
      es.addEventListener("notification", (e) => {
        events.dispatchEvent(new CustomEvent("notification", { detail: JSON.parse((e as MessageEvent).data) }));
        setMe((m) => (m ? { ...m, unread: m.unread + 1 } : m));
      });
      es.addEventListener("message", (e) => events.dispatchEvent(new CustomEvent("message", { detail: JSON.parse((e as MessageEvent).data) })));
    })();
    return () => {
      stop = true;
      es?.close();
    };
  }, [me?.user?.id, token, events]);

  const value: Ctx = {
    ready: privy.ready && bootstrapped,
    authenticated: !!me,
    mode,
    me,
    refresh,
    login: () => privy.login(),
    loginWithWallet,
    logout,
    api,
    token,
    run,
    signMessage,
    address: me?.user?.sui_address ?? null,
    events,
  };
  return <SessionCtx.Provider value={value}>{children}</SessionCtx.Provider>;
}

export function useSession() {
  const c = useContext(SessionCtx);
  if (!c) throw new Error("useSession outside provider");
  return c;
}

export { toBase64 };
