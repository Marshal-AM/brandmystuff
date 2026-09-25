"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useSession } from "@/lib/client/session";
import { Badge, Button, TestnetBanner, cx, useToast, usdc, shortAddr } from "./ui";

function Bell() {
  const { api, me, events, refresh } = useSession();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<any[]>([]);
  const toast = useToast();
  useEffect(() => {
    const h = (e: Event) => {
      const n = (e as CustomEvent).detail;
      toast({ text: n.title, tone: "info" });
      setItems((x) => [n, ...x]);
    };
    events.addEventListener("notification", h);
    return () => events.removeEventListener("notification", h);
  }, [events, toast]);
  const load = async () => {
    const r = await api<{ notifications: any[] }>("/api/notifications");
    setItems(r.notifications);
  };
  return (
    <div className="relative">
      <button
        aria-label="Notifications"
        onClick={async () => {
          setOpen(!open);
          if (!open) {
            await load();
            await api("/api/notifications", { method: "POST", json: { all: true } });
            refresh();
          }
        }}
        className="relative rounded-full p-2 hover:bg-black/5"
      >
        🔔
        {!!me?.unread && <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-bad px-1 text-[10px] font-bold text-white">{me.unread}</span>}
      </button>
      {open && (
        <div className="absolute right-0 z-40 mt-2 w-80 overflow-hidden rounded-2xl border border-line bg-surface shadow-xl">
          <div className="border-b border-line px-4 py-2 text-sm font-semibold">Notifications</div>
          <div className="max-h-96 overflow-y-auto">
            {!items.length && <p className="p-4 text-sm text-muted">Nothing yet.</p>}
            {items.map((n) => (
              <Link key={n.id ?? n.created_at} href={n.link ?? "#"} onClick={() => setOpen(false)} className="block border-b border-line px-4 py-3 text-sm hover:bg-black/[0.02]">
                <div className="font-medium">{n.title}</div>
                {n.body && <div className="text-muted">{n.body}</div>}
                <div className="mt-1 text-[11px] text-muted">{new Date(n.created_at ?? Date.now()).toLocaleString()}</div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function UserMenu() {
  const { me, logout } = useSession();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener("click", h);
    return () => document.removeEventListener("click", h);
  }, []);
  const u = me!.user;
  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(!open)} className="flex items-center gap-2 rounded-full border border-line bg-surface py-1 pl-1 pr-3 text-sm hover:border-violet-300" data-testid="user-menu">
        <span className="grid h-7 w-7 place-items-center rounded-full bg-gradient-to-br from-violet-600 to-amber-400 text-xs font-bold text-white">{(u.handle ?? "?")[0]?.toUpperCase()}</span>
        <span className="hidden font-medium sm:inline">{u.ens_name ?? shortAddr(u.sui_address)}</span>
      </button>
      {open && (
        <div className="absolute right-0 z-40 mt-2 w-64 rounded-2xl border border-line bg-surface p-2 shadow-xl">
          <div className="px-3 py-2 text-xs text-muted">
            {usdc(me!.balances.usdc)} · {(Number(me!.balances.sui) / 1e9).toFixed(3)} SUI
          </div>
          {[
            ["/dashboard", "Dashboard"],
            ["/wallet", "Wallet"],
            ["/brand-kit", "Brand kit"],
            ["/verify", "Identity verification"],
            ["/settings", "Profile settings"],
            ...(u.ens_name ? [[`/${u.ens_name}`, "Public profile"]] : []),
            ...(u.is_admin ? [["/admin", "Admin"]] : []),
          ].map(([href, label]) => (
            <Link key={href} href={href} onClick={() => setOpen(false)} className="block rounded-lg px-3 py-2 text-sm hover:bg-black/5">
              {label}
            </Link>
          ))}
          <button onClick={() => logout()} className="block w-full rounded-lg px-3 py-2 text-left text-sm text-bad hover:bg-red-50">
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}

export function SignInButtons() {
  const { login, loginWithWallet } = useSession();
  const [wallet, setWallet] = useState(false);
  return (
    <div className="flex items-center gap-2">
      <Button onClick={login} data-testid="sign-in">
        Sign in
      </Button>
      <Button variant="secondary" onClick={() => setWallet(true)}>
        Sui wallet
      </Button>
      {wallet && <WalletConnect onClose={() => setWallet(false)} onConnected={loginWithWallet} />}
    </div>
  );
}

function WalletConnect({ onClose, onConnected }: { onClose: () => void; onConnected: () => Promise<void> }) {
  const [W, setW] = useState<any>(null);
  useEffect(() => {
    import("./wallet-connect").then((m) => setW(() => m.default));
  }, []);
  return W ? <W onClose={onClose} onConnected={onConnected} /> : null;
}

export default function Shell({ children }: { children: ReactNode }) {
  const { ready, authenticated, me } = useSession();
  const path = usePathname();
  const router = useRouter();
  useEffect(() => {
    if (ready && authenticated && me?.needsOnboarding && path !== "/onboarding" && path !== "/wallet") router.push(`/onboarding?next=${encodeURIComponent(path)}`);
  }, [ready, authenticated, me?.needsOnboarding, path, router]);
  const nav = [
    ["/", "Explore"],
    ["/offerings", "Invest"],
    ["/list", "List your stuff"],
    ["/dashboard", "Dashboard"],
    ["/messages", "Messages"],
    ["/agents", "For agents"],
  ];
  return (
    <div className="flex min-h-screen flex-col">
      <TestnetBanner />
      <header className="sticky top-0 z-30 border-b border-line bg-background/85 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-6 px-4 py-3">
          <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.svg" alt="" className="h-8 w-8" />
            <span className="text-lg">brandmystuff</span>
          </Link>
          <nav className="hidden flex-1 items-center gap-1 md:flex">
            {nav.map(([href, label]) => (
              <Link key={href} href={href} className={cx("rounded-lg px-3 py-1.5 text-sm", (href === "/" ? path === "/" : path.startsWith(href)) ? "bg-black/5 font-medium" : "text-muted hover:text-foreground")}>
                {label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            {!ready ? null : authenticated ? (
              <>
                <Bell />
                <UserMenu />
              </>
            ) : (
              <SignInButtons />
            )}
          </div>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t border-line py-8 text-center text-xs text-muted">
        brandmystuff · listings are ENS names under <span className="font-mono">brandmystuff.eth</span> (Sepolia ENSv2) · money moves on Sui testnet ·{" "}
        <Link href="/agents" className="underline">
          x402 & MCP for agents
        </Link>
        <div className="mt-1">
          <Badge tone="warn">Testnet</Badge>
        </div>
      </footer>
    </div>
  );
}
