"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowUpRight, Bell as BellIcon, LogOut, Menu, Wallet, X } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useSession } from "@/lib/client/session";
import { Logo, LogoMark } from "./logo";
import { Button, EASE, TestnetBanner, cx, useToast, usdc, shortAddr, BusyDock } from "./ui";
import { EnsGlyph, EnsName, FitName } from "./ens";

const APP_NAV = [
  ["/explore", "Explore"],
  ["/offerings", "Invest"],
  ["/trade", "Trade"],
  ["/list", "List your stuff"],
  ["/dashboard", "Dashboard"],
  ["/messages", "Messages"],
] as const;

/** Brands don't list objects or invest: they get their agent, the marketplace and their ads. */
const BRAND_NAV = [
  ["/agent", "Agent"],
  ["/explore", "Explore"],
  ["/dashboard", "My ads"],
  ["/messages", "Messages"],
] as const;

const LANDING_NAV = [
  ["how-it-works", "How it works"],
  ["marketplace", "Marketplace"],
  ["agents", "Brand agent"],
  ["tokenise", "Tokenise"],
  ["faq", "FAQ"],
] as const;

function useClickAway<T extends HTMLElement>(open: boolean, close: () => void) {
  const ref = useRef<T>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && close();
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open, close]);
  return ref;
}

const dropdown = {
  initial: { opacity: 0, y: -8, scale: 0.96, filter: "blur(6px)" },
  animate: { opacity: 1, y: 0, scale: 1, filter: "blur(0px)" },
  exit: { opacity: 0, y: -6, scale: 0.97, filter: "blur(6px)" },
  transition: { type: "spring" as const, stiffness: 360, damping: 28 },
};

function Bell() {
  const { api, me, events, refresh } = useSession();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<any[]>([]);
  const toast = useToast();
  const ref = useClickAway<HTMLDivElement>(open, () => setOpen(false));
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
    <div className="relative" ref={ref}>
      <motion.button
        whileTap={{ scale: 0.9 }}
        aria-label="Notifications"
        onClick={async () => {
          setOpen(!open);
          if (!open) {
            await load();
            await api("/api/notifications", { method: "POST", json: { all: true } });
            refresh();
          }
        }}
        className="relative grid h-10 w-10 place-items-center rounded-full text-white/70 transition-colors hover:bg-white/[0.08] hover:text-white"
      >
        <motion.span animate={me?.unread ? { rotate: [0, -14, 12, -8, 0] } : {}} transition={{ duration: 0.7, repeat: me?.unread ? Infinity : 0, repeatDelay: 3 }}>
          <BellIcon className="h-[18px] w-[18px]" />
        </motion.span>
        <AnimatePresence>
          {!!me?.unread && (
            <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} transition={{ type: "spring", stiffness: 500, damping: 18 }} className="absolute right-1 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-p px-1 text-[10px] font-extrabold text-ink shadow-[0_0_12px_var(--p)]">
              {me.unread}
            </motion.span>
          )}
        </AnimatePresence>
      </motion.button>
      <AnimatePresence>
        {open && (
          <motion.div {...dropdown} className="absolute right-0 z-50 mt-3 w-[min(360px,90vw)] origin-top-right overflow-hidden rounded-3xl border border-line-strong bg-p-950/95 shadow-[0_30px_80px_rgba(0,0,0,0.6)] backdrop-blur-xl">
            <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
              <span className="text-sm font-bold">Notifications</span>
              <span className="text-[11px] text-muted">{items.length} total</span>
            </div>
            <div className="max-h-96 overflow-y-auto p-2">
              {!items.length && <p className="p-6 text-center text-sm text-muted">You&apos;re all caught up.</p>}
              {items.map((n, i) => (
                <motion.div key={n.id ?? n.created_at ?? i} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03, ease: EASE }}>
                  <Link href={n.link ?? "#"} onClick={() => setOpen(false)} className="block rounded-2xl px-3 py-3 text-sm transition-colors hover:bg-white/[0.05]">
                    <div className="flex items-start gap-3">
                      <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-p shadow-[0_0_8px_var(--p)]" />
                      <div className="min-w-0">
                        <div className="font-semibold">{n.title}</div>
                        {n.body && <div className="text-muted">{n.body}</div>}
                        <div className="mt-1 text-[11px] text-faint">{new Date(n.created_at ?? Date.now()).toLocaleString()}</div>
                      </div>
                    </div>
                  </Link>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Avatar({ letter, size = 32 }: { letter: string; size?: number }) {
  return (
    <span className="grid shrink-0 place-items-center rounded-full bg-gradient-to-br from-p-300 via-p to-p-700 font-extrabold text-ink" style={{ width: size, height: size, fontSize: size * 0.42 }}>
      {letter}
    </span>
  );
}

function UserMenu() {
  const { me, logout } = useSession();
  const [open, setOpen] = useState(false);
  const ref = useClickAway<HTMLDivElement>(open, () => setOpen(false));
  const u = me!.user;
  const links: [string, string][] = [
    ["/dashboard", "Dashboard"],
    ["/wallet", "Wallet"],
    ["/brand-kit", "Brand kit"],
    ["/verify", "Identity verification"],
    ["/settings", "Profile settings"],
    ["/agents", "Agent API"],
    ...(u.ens_name ? ([[`/${u.ens_name}`, "Public profile"]] as [string, string][]) : []),
    ...(u.is_admin ? ([["/admin", "Admin"]] as [string, string][]) : []),
  ];
  return (
    <div className="relative" ref={ref}>
      <motion.button whileTap={{ scale: 0.96 }} onClick={() => setOpen(!open)} className="flex items-center gap-2 rounded-full border border-line-strong bg-white/[0.04] py-1 pl-1 pr-3.5 text-sm transition-colors hover:border-p/50" data-testid="user-menu">
        <Avatar letter={(u.handle ?? "?")[0]?.toUpperCase()} />
        <span className="hidden max-w-[200px] items-center gap-1.5 font-semibold sm:inline-flex">{u.ens_name && <EnsGlyph className="text-p" />}<FitName text={u.ens_name ?? shortAddr(u.sui_address)} base={14} min={9} /></span>
      </motion.button>
      <AnimatePresence>
        {open && (
          <motion.div {...dropdown} className="absolute right-0 z-50 mt-3 w-72 origin-top-right overflow-hidden rounded-3xl border border-line-strong bg-p-950/95 p-2 shadow-[0_30px_80px_rgba(0,0,0,0.6)] backdrop-blur-xl">
            {/* balance card, Phantom style */}
            <div className="relative mb-2 overflow-hidden rounded-2xl bg-gradient-to-br from-p to-p-600 p-4 text-ink">
              <div aria-hidden className="absolute -right-8 -top-10 h-28 w-28 rounded-full bg-white/30 blur-2xl" />
              <div className="relative flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider opacity-70">
                <Wallet className="h-3.5 w-3.5" /> Balance
              </div>
              <div className="relative mt-1 text-2xl font-extrabold tracking-tight">{usdc(me!.balances.usdc)}</div>
              <div className="relative text-xs font-semibold opacity-70">{(Number(me!.balances.sui) / 1e9).toFixed(3)} SUI for gas</div>
            </div>
            {u.ens_name && (
              <div className="mb-2 rounded-2xl border border-line bg-white/[0.03] p-3">
                <div className="mb-1.5 flex items-center justify-between text-[10px] font-bold uppercase tracking-[0.12em] text-muted">
                  <span>Your ENS name</span>
                  <span className={u.ens_status === "registered" ? "text-p" : "text-p-300"}>{u.ens_status === "registered" ? "Live" : "Registering…"}</span>
                </div>
                <EnsName name={u.ens_name} status={u.ens_status} kind="account" size="xs" card={false} />
              </div>
            )}
            {links.map(([href, label], i) => (
              <motion.div key={href} initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.03 * i }}>
                <Link href={href} onClick={() => setOpen(false)} className="flex items-center justify-between rounded-xl px-3 py-2.5 text-sm font-medium text-white/80 transition-colors hover:bg-white/[0.06] hover:text-white">
                  {label}
                  <ArrowUpRight className="h-3.5 w-3.5 opacity-40" />
                </Link>
              </motion.div>
            ))}
            <button onClick={() => logout()} className="mt-1 flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-white/70 transition-colors hover:bg-white hover:text-ink">
              <LogOut className="h-4 w-4" /> Sign out
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function SignInButtons() {
  const { login, loginWithWallet } = useSession();
  const [wallet, setWallet] = useState(false);
  return (
    <div className="flex items-center gap-2">
      <Button onClick={login} data-testid="sign-in" size="md">
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

/** Soft drifting glow + grid behind every app page. */
function Ambient() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      <div className="absolute -left-[15vw] -top-[20vw] h-[55vw] w-[55vw] rounded-full bg-p-700/25 blur-[120px] [animation:drift_18s_ease-in-out_infinite_alternate]" />
      <div className="absolute -right-[20vw] top-[20vh] h-[45vw] w-[45vw] rounded-full bg-p-800/40 blur-[120px] [animation:drift_22s_ease-in-out_infinite_alternate-reverse]" />
      <div className="absolute bottom-[-20vw] left-1/3 h-[40vw] w-[40vw] rounded-full bg-p/10 blur-[140px] [animation:drift_26s_ease-in-out_infinite_alternate]" />
      <div
        className="absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage: "linear-gradient(rgba(171,159,242,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(171,159,242,0.06) 1px, transparent 1px)",
          backgroundSize: "64px 64px",
          maskImage: "radial-gradient(ellipse 80% 60% at 50% 0%, #000 20%, transparent 75%)",
          WebkitMaskImage: "radial-gradient(ellipse 80% 60% at 50% 0%, #000 20%, transparent 75%)",
        }}
      />
      <div className="grain" />
    </div>
  );
}

/** Thin purple sweep across the top on every route change. */
function RouteProgress({ path }: { path: string }) {
  return (
    <motion.div key={path} className="fixed inset-x-0 top-0 z-[90] h-[2px] origin-left bg-gradient-to-r from-p-600 via-p to-white shadow-[0_0_12px_var(--p)]" initial={{ scaleX: 0, opacity: 1 }} animate={{ scaleX: 1, opacity: [1, 1, 0] }} transition={{ duration: 0.9, ease: EASE, opacity: { duration: 0.9, times: [0, 0.7, 1] } }} />
  );
}

function AppFooter() {
  return (
    <footer className="relative z-10 mt-24 border-t border-line">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-6 py-10 text-xs text-muted md:flex-row">
        <Link href="/" className="text-white">
          <Logo />
        </Link>
        <p className="text-center">
          <span className="inline-flex items-center gap-1 align-middle"><EnsGlyph className="text-p" /> Every account, object, space and lease is an ENS name under <span className="font-mono text-p">brandmystuff.eth</span></span> (Sepolia ENSv2) · money moves on Sui testnet
        </p>
        <div className="flex gap-4">
          <Link className="hover:text-white" href="/explore">Explore</Link>
          <Link className="hover:text-white" href="/offerings">Invest</Link>
          <Link className="hover:text-white" href="/agents">Agent API</Link>
        </div>
      </div>
    </footer>
  );
}

export default function Shell({ children }: { children: ReactNode }) {
  const { ready, authenticated, me } = useSession();
  const path = usePathname();
  const router = useRouter();
  const [mobile, setMobile] = useState(false);
  const landing = path === "/";
  const isBrand = me?.user?.account_type === "brand";
  const nav = isBrand ? BRAND_NAV : APP_NAV;
  // Fixed-height, app-style pages: no footer so nothing scrolls past the viewport.
  const fixedPage = path.startsWith("/objects/") || /^\/messages\/[^/]+$/.test(path) || (path.endsWith(".brandmystuff.eth") && path.slice(1).split(".").length === 4);
  useEffect(() => {
    if (ready && authenticated && me?.needsOnboarding && path !== "/onboarding" && path !== "/wallet" && !path.startsWith("/capture/")) router.push(`/onboarding?next=${encodeURIComponent(path)}`);
  }, [ready, authenticated, me?.needsOnboarding, path, router]);
  useEffect(() => setMobile(false), [path]);
  // Remember the last page outside identity verification so /verify can send people back to it.
  useEffect(() => {
    if (path === "/verify" || path === "/onboarding") return;
    try {
      sessionStorage.setItem("bms:return-to", path + window.location.search);
    } catch {}
  }, [path]);
  useEffect(() => {
    if (isBrand && (path === "/list" || path.startsWith("/offerings") || path === "/trade")) router.replace("/agent");
  }, [isBrand, path, router]);

  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 110, behavior: "smooth" });
    setMobile(false);
  };
  const active = (href: string) => path === href || path.startsWith(`${href}/`);

  // The phone camera page opened from a photo link: no app chrome, no sign-in.
  if (path.startsWith("/capture/") || path === "/pitch") return <>{children}</>;

  return (
    <div className="relative flex min-h-screen flex-col">
      {!landing && <Ambient />}
      <RouteProgress path={path} />
      <div className="fixed inset-x-0 top-0 z-50">
        <TestnetBanner />
        <header className="px-3 pt-3 sm:px-4">
          <motion.div
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: EASE }}
            className="mx-auto flex max-w-7xl items-center gap-4 rounded-2xl border border-white/10 bg-ink/80 px-3 py-2 shadow-[0_12px_40px_rgba(0,0,0,0.35)] backdrop-blur-xl sm:px-4"
          >
            <Link href="/" className="shrink-0 text-white">
              <span className="hidden sm:block">
                <Logo />
              </span>
              <span className="sm:hidden">
                <LogoMark />
              </span>
            </Link>

            <nav className="hidden flex-1 items-center justify-center gap-0.5 lg:flex">
              {landing
                ? LANDING_NAV.map(([id, label]) => (
                    <button key={id} onClick={() => scrollTo(id)} className="rounded-full px-3.5 py-2 text-sm text-white/60 transition-colors hover:text-white">
                      {label}
                    </button>
                  ))
                : nav.map(([href, label]) => (
                    <Link key={href} href={href} className={cx("relative rounded-full px-3.5 py-2 text-sm font-medium transition-colors duration-300", active(href) ? "text-ink" : "text-white/60 hover:text-white")}>
                      {active(href) && <motion.span layoutId="nav-pill" className="absolute inset-0 rounded-full bg-p shadow-[0_0_24px_rgba(171,159,242,0.4)]" transition={{ type: "spring", stiffness: 380, damping: 32 }} />}
                      <span className="relative">{label}</span>
                    </Link>
                  ))}
            </nav>

            <div className="ml-auto flex items-center gap-1.5">
              {landing && (
                <Link href="/pitch" data-testid="pitch" className="hidden rounded-full border border-white/15 px-4 py-2 text-sm font-semibold text-white/85 transition-colors hover:border-p/60 hover:text-white md:block">
                  Pitch
                </Link>
              )}
              {landing && (
                <Link href="/explore" className="hidden px-3 text-sm font-semibold text-white/75 transition-colors hover:text-white md:block">
                  Launch app
                </Link>
              )}
              {!ready ? (
                <span className="shimmer h-9 w-28 rounded-full" />
              ) : authenticated ? (
                <>
                  <Bell />
                  <UserMenu />
                </>
              ) : (
                <SignInButtons />
              )}
              <button className="grid h-10 w-10 place-items-center rounded-full text-white lg:hidden" onClick={() => setMobile(!mobile)} aria-label="Menu">
                {mobile ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
            </div>
          </motion.div>

          <AnimatePresence>
            {mobile && (
              <motion.nav initial={{ opacity: 0, y: -10, height: 0 }} animate={{ opacity: 1, y: 0, height: "auto" }} exit={{ opacity: 0, y: -10, height: 0 }} transition={{ duration: 0.4, ease: EASE }} className="mx-auto mt-2 max-w-7xl overflow-hidden rounded-2xl border border-white/10 bg-ink/95 backdrop-blur-xl lg:hidden">
                <div className="grid gap-1 p-2">
                  {(landing ? LANDING_NAV.map(([id, label]) => ({ key: id, label, on: () => scrollTo(id) })) : nav.map(([href, label]) => ({ key: href, label, on: () => router.push(href) }))).map((n, i) => (
                    <motion.button key={n.key} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }} onClick={n.on} className="rounded-xl px-4 py-3 text-left text-sm font-semibold text-white/80 hover:bg-white/[0.06]">
                      {n.label}
                    </motion.button>
                  ))}
                  {landing && (
                    <Link href="/pitch" className="rounded-xl border border-white/15 px-4 py-3 text-left text-sm font-semibold text-white/85">
                      Pitch
                    </Link>
                  )}
                  {landing && (
                    <Link href="/explore" className="rounded-xl bg-p px-4 py-3 text-sm font-bold text-ink">
                      Launch app
                    </Link>
                  )}
                </div>
              </motion.nav>
            )}
          </AnimatePresence>
        </header>
      </div>

      <motion.main
        key={path}
        initial={{ opacity: 0, y: 14, filter: "blur(8px)" }}
        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
        transition={{ duration: 0.6, ease: EASE }}
        className={cx("relative z-10 flex-1", !landing && "pt-[140px]")}
      >
        {children}
      </motion.main>
      {!landing && !fixedPage && <AppFooter />}
      <BusyDock />
    </div>
  );
}
