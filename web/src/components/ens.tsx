"use client";
import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowUpRight, Check, Copy, ExternalLink } from "lucide-react";
import { ENS_DEPLOYMENT } from "@/lib/deployment";
import { EASE, cx, etherscanTx, shortAddr, suiscan } from "./ui";

export type EnsStatus = "registered" | "reserved" | "pending" | "unregistered" | string | null | undefined;

const PARENT = ENS_DEPLOYMENT.parentName;
export const ensAppUrl = (name: string) => `${ENS_DEPLOYMENT.appUrl}/${name}`;

export function ago(iso?: string | null) {
  if (!iso) return "";
  const s = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86400)}d ago`;
}

const STATUS: Record<string, { label: string; dot: string; text: string }> = {
  registered: { label: "Live on ENS", dot: "bg-p", text: "text-p" },
  reserved: { label: "Reserved on ENS", dot: "bg-p-300 animate-pulse", text: "text-p-300" },
  pending: { label: "Registering on ENS…", dot: "bg-p-300 animate-pulse", text: "text-p-300" },
  unregistered: { label: "Released", dot: "bg-white/40", text: "text-muted" },
};
const statusOf = (s: EnsStatus) => STATUS[s ?? "pending"] ?? STATUS.pending;

export const KIND_LABEL: Record<string, string> = { platform: "Platform", account: "Account", object: "Object", space: "Ad space", lease: "Lease" };

/** A small ENS mark: a faceted diamond, drawn in the brand purple. */
export function EnsGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={cx("h-3.5 w-3.5 shrink-0", className)} aria-hidden>
      <path d="M8 1.2 13.4 7 8 14.8 2.6 7Z" fill="currentColor" opacity=".22" />
      <path d="M8 1.2 13.4 7 8 14.8 2.6 7Z M2.6 7h10.8 M8 1.2 5.6 7 8 14.8 10.4 7Z" fill="none" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round" />
    </svg>
  );
}

function useCopy() {
  const [done, setDone] = useState(false);
  return {
    done,
    copy: (t: string) => {
      navigator.clipboard.writeText(t).catch(() => {});
      setDone(true);
      setTimeout(() => setDone(false), 1200);
    },
  };
}

/** Splits `lid-right.macbook.maya.brandmystuff.eth` into the leaf label and the rest. */
function split(name: string) {
  const i = name.indexOf(".");
  return i < 0 ? { leaf: name, rest: "" } : { leaf: name.slice(0, i), rest: name.slice(i) };
}

/**
 * An ENS name as a chip: diamond mark, the leaf label up front, the parent path
 * dimmed, and a status dot. Hovering shows what the name is and where it resolves.
 */
export function EnsName({ name, status, kind, size = "sm", className, card = true, full }: { name: string; status?: EnsStatus; kind?: string | null; size?: "xs" | "sm" | "md"; className?: string; card?: boolean; full?: boolean }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ x: number; y: number; up: boolean } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { leaf, rest } = split(name);
  const st = statusOf(status);
  const show = () => {
    if (!card) return;
    if (timer.current) clearTimeout(timer.current);
    const r = ref.current?.getBoundingClientRect();
    if (r) setPos({ x: Math.min(Math.max(12, r.left), window.innerWidth - 332), y: r.bottom + 8 > window.innerHeight - 240 ? r.top - 8 : r.bottom + 8, up: r.bottom + 8 > window.innerHeight - 240 });
    setOpen(true);
  };
  const hide = () => {
    timer.current = setTimeout(() => setOpen(false), 120);
  };
  const sz = size === "xs" ? "h-6 gap-1 px-2 text-[10.5px]" : size === "md" ? "h-9 gap-2 px-3.5 text-sm" : "h-7 gap-1.5 px-2.5 text-[11.5px]";
  return (
    <>
      <span
        ref={ref}
        onMouseEnter={show}
        onMouseLeave={hide}
        className={cx("group/ens inline-flex max-w-full items-center rounded-full border border-p/25 bg-p/[0.08] font-mono text-white/90 transition-colors hover:border-p/50 hover:bg-p/[0.14]", sz, className)}
      >
        <EnsGlyph className={cx("text-p", size === "md" && "h-4 w-4")} />
        <span className={cx("min-w-0", full ? "break-all" : "truncate")}>
          <span className="font-semibold text-white">{leaf}</span>
          <span className="text-white/45">{rest}</span>
        </span>
        {status !== undefined && <span className={cx("h-1.5 w-1.5 shrink-0 rounded-full", st.dot)} title={st.label} />}
      </span>
      {card && typeof document !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {open && pos && (
              <motion.div
                onMouseEnter={() => timer.current && clearTimeout(timer.current)}
                onMouseLeave={hide}
                initial={{ opacity: 0, y: pos.up ? 6 : -6, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.97 }}
                transition={{ duration: 0.18, ease: EASE }}
                style={{ left: pos.x, top: pos.y }}
                className="fixed z-[80] w-80"
              >
                <div className={cx("overflow-hidden rounded-2xl border border-line-strong bg-p-950/95 p-4 shadow-[0_30px_80px_rgba(0,0,0,0.6)] backdrop-blur-xl", pos.up && "-translate-y-full")}>
                  <EnsCardBody name={name} status={status} kind={kind} />
                </div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </>
  );
}

function EnsCardBody({ name, status, kind }: { name: string; status?: EnsStatus; kind?: string | null }) {
  const { done, copy } = useCopy();
  const st = statusOf(status);
  const depth = name.endsWith(`.${PARENT}`) ? name.slice(0, -(PARENT.length + 1)).split(".").length : 0;
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="grid h-8 w-8 place-items-center rounded-xl bg-p/15 text-p"><EnsGlyph className="h-4 w-4" /></span>
        <div className="min-w-0">
          <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted">ENS name{kind ? ` · ${KIND_LABEL[kind] ?? kind}` : ""}</div>
          <div className={cx("flex items-center gap-1.5 text-xs font-semibold", st.text)}><span className={cx("h-1.5 w-1.5 rounded-full", st.dot)} />{status === undefined ? "Sepolia · ENSv2" : st.label}</div>
        </div>
      </div>
      <div className="break-all rounded-xl bg-white/[0.04] px-3 py-2 font-mono text-xs text-white/90">{name}</div>
      <p className="text-[11px] leading-relaxed text-muted">
        {depth > 0 ? `A subname ${depth} level${depth > 1 ? "s" : ""} under ${PARENT}. ` : ""}Its records point back to the Sui object, so anyone can check this listing without trusting brandmystuff.
      </p>
      <div className="flex flex-wrap gap-1.5">
        <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); copy(name); }} className="inline-flex h-7 items-center gap-1.5 rounded-full bg-white/[0.06] px-3 text-[11px] font-semibold text-white/80 hover:bg-white/10">
          {done ? <Check className="h-3 w-3 text-p" strokeWidth={3} /> : <Copy className="h-3 w-3" />} {done ? "Copied" : "Copy"}
        </button>
        <a href={ensAppUrl(name)} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="inline-flex h-7 items-center gap-1.5 rounded-full bg-p/15 px-3 text-[11px] font-semibold text-p hover:bg-p hover:text-ink">
          ENS app <ArrowUpRight className="h-3 w-3" />
        </a>
        <Link href={`/${name}`} onClick={(e) => e.stopPropagation()} className="inline-flex h-7 items-center gap-1.5 rounded-full bg-white/[0.06] px-3 text-[11px] font-semibold text-white/80 hover:bg-white/10">
          Open page
        </Link>
      </div>
    </div>
  );
}

/** brandmystuff.eth → account → object → space → lease, drawn as a connected path. */
export function EnsTree({ chain, current }: { chain: { name: string; kind: string | null; status: string }[]; current: string }) {
  return (
    <ol className="relative space-y-1.5">
      <span aria-hidden className="absolute bottom-4 left-[11px] top-4 w-px bg-gradient-to-b from-p/70 via-p/30 to-p/10" />
      {chain.map((n, i) => {
        const here = n.name === current;
        const st = statusOf(n.status);
        return (
          <motion.li key={n.name} initial={{ opacity: 0, x: -10 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.08, duration: 0.45, ease: EASE }} className="relative flex items-center gap-3 pl-8">
            <span className={cx("absolute left-1 grid h-[22px] w-[22px] place-items-center rounded-full border-2", here ? "border-p bg-p text-ink shadow-[0_0_16px_rgba(171,159,242,0.6)]" : "border-p/40 bg-ink text-p")}>
              <EnsGlyph className="h-3 w-3" />
            </span>
            <div className={cx("min-w-0 flex-1 rounded-xl px-3 py-2 transition-colors", here ? "border border-p/35 bg-p/[0.08]" : "hover:bg-white/[0.03]")}>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted">{KIND_LABEL[n.kind ?? ""] ?? "Name"}</span>
                <span className={cx("inline-flex items-center gap-1 text-[10px] font-semibold", st.text)}><span className={cx("h-1.5 w-1.5 rounded-full", st.dot)} />{n.status}</span>
              </div>
              {here || n.kind === "platform" ? (
                <div className="truncate font-mono text-xs text-white/90">{n.name}</div>
              ) : (
                <Link href={`/${n.name}`} className="block truncate font-mono text-xs text-white/75 hover:text-p">{n.name}</Link>
              )}
            </div>
          </motion.li>
        );
      })}
    </ol>
  );
}

const prettyKey = (k: string) => k.replace(/^eth\.brandmystuff\./, "");
const ACTION_COPY: Record<string, string> = { register: "Name registered", records: "Records written", reserve: "Label reserved", renew: "Expiry renewed", unregister: "Name released" };

/** The records the relayer last wrote to this name. */
export function EnsRecords({ records, live }: { records: any; live?: Record<string, string | null> | null }) {
  if (!records) return <p className="text-sm text-muted">No records written yet. The relayer writes them right after the Sui transaction lands.</p>;
  const texts = Object.entries((records.texts ?? {}) as Record<string, string>).filter(([, v]) => v !== "");
  const datas = Object.entries((records.datas ?? {}) as Record<string, string>);
  const addrs = (records.addrs ?? []) as { coinType: string; value: string }[];
  const coin = (c: string) => (c === "784" ? "Sui" : c === "60" ? "Ethereum" : `coin ${c}`);
  return (
    <div className="space-y-4">
      <div className="grid gap-2 sm:grid-cols-2">
        {texts.map(([k, v], i) => (
          <motion.div key={k} initial={{ opacity: 0, y: 6 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: Math.min(i, 10) * 0.03 }} className={cx("min-w-0 rounded-2xl border border-line bg-white/[0.02] p-3", (k === "description" || k === "avatar") && "sm:col-span-2")}>
            <div className="flex items-center justify-between gap-2">
              <span className="truncate font-mono text-[10px] text-p">{prettyKey(k)}</span>
              {live && k in live && (live[k] === v ? <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-p"><Check className="h-3 w-3" strokeWidth={3} />live</span> : live[k] != null && <span className="text-[10px] text-muted">updating</span>)}
            </div>
            {k === "avatar" ? (
              <div className="mt-2 flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={v} alt="" className="h-12 w-12 rounded-xl object-cover ring-1 ring-line" />
                <span className="min-w-0 break-all font-mono text-[10.5px] text-white/60">{v}</span>
              </div>
            ) : (
              <div className="mt-1 break-words text-sm text-white/90">{v}</div>
            )}
          </motion.div>
        ))}
      </div>
      {(datas.length > 0 || addrs.length > 0) && (
        <div className="space-y-2">
          <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted">Addresses & data</div>
          {addrs.map((a) => (
            <div key={a.coinType} className="flex items-center justify-between gap-3 rounded-xl bg-white/[0.03] px-3 py-2 text-xs">
              <span className="text-muted">{coin(String(a.coinType))} address</span>
              <span className="truncate font-mono text-white/80">{shortAddr(a.value)}</span>
            </div>
          ))}
          {datas.map(([k, v]) => (
            <div key={k} className="flex items-center justify-between gap-3 rounded-xl bg-white/[0.03] px-3 py-2 text-xs">
              <span className="truncate font-mono text-p">{prettyKey(k)}</span>
              <span className="truncate font-mono text-white/80">{shortAddr(v)}</span>
            </div>
          ))}
        </div>
      )}
      {records.writtenAt && <p className="text-[11px] text-faint">Last written {ago(records.writtenAt)} by the brandmystuff relayer.</p>}
    </div>
  );
}

/** The relayer's writes for a name, each paired with the Sui transaction that triggered it. */
export function EnsWrites({ writes }: { writes: any[] }) {
  if (!writes?.length) return <p className="text-sm text-muted">No ENS writes yet.</p>;
  return (
    <ol className="relative space-y-2">
      <span aria-hidden className="absolute bottom-3 left-[7px] top-3 w-px bg-gradient-to-b from-p/60 via-line-strong to-transparent" />
      {writes.map((w, i) => (
        <motion.li key={w.id} initial={{ opacity: 0, x: -10 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: Math.min(i, 8) * 0.05, ease: EASE }} className="relative pl-7">
          <span className={cx("absolute left-[2px] top-3.5 h-[11px] w-[11px] rounded-full ring-4 ring-ink", w.error ? "bg-white/40" : "bg-p shadow-[0_0_10px_rgba(171,159,242,0.7)]")} />
          <div className="rounded-2xl border border-line bg-white/[0.02] px-3 py-2.5">
            <div className="flex items-center justify-between gap-2 text-sm">
              <span className="font-semibold">{ACTION_COPY[w.action] ?? w.action}</span>
              <span className="text-[11px] text-muted">{ago(w.created_at)}</span>
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[10.5px]">
              {w.sui_digest && (
                <a href={suiscan("tx", w.sui_digest)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-full bg-white/[0.06] px-2 py-0.5 font-mono text-white/70 hover:bg-white hover:text-ink">
                  Sui {w.sui_digest.slice(0, 6)}… <ExternalLink className="h-2.5 w-2.5" />
                </a>
              )}
              {w.sui_digest && w.eth_tx && <span className="text-faint">→</span>}
              {w.eth_tx && (
                <a href={etherscanTx(w.eth_tx)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-full bg-p/15 px-2 py-0.5 font-mono text-p hover:bg-p hover:text-ink">
                  <EnsGlyph className="h-2.5 w-2.5" /> Sepolia {w.eth_tx.slice(0, 8)}… <ExternalLink className="h-2.5 w-2.5" />
                </a>
              )}
              {w.error && <span className="text-muted">failed, retrying</span>}
            </div>
          </div>
        </motion.li>
      ))}
    </ol>
  );
}

/** A thin live strip: how many names are on ENS and the latest relayer write, cycling. */
export function EnsPulse({ className }: { className?: string }) {
  const { data } = useQuery({ queryKey: ["ens-pulse"], queryFn: () => fetch("/api/ens/pulse").then((r) => r.json()), refetchInterval: 30_000 });
  const [i, setI] = useState(0);
  const recent = (data?.recent ?? []) as any[];
  useEffect(() => {
    if (recent.length < 2) return;
    const t = setInterval(() => setI((x) => (x + 1) % recent.length), 3800);
    return () => clearInterval(t);
  }, [recent.length]);
  if (!data?.total) return null;
  const w = recent[i % Math.max(1, recent.length)];
  const kinds = ["account", "object", "space", "lease"].filter((k) => data.byKind?.[k]);
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: EASE }} className={cx("glass flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl px-4 py-2.5 text-xs", className)}>
      <span className="inline-flex items-center gap-2 font-bold text-white">
        <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-p opacity-70" /><span className="relative inline-flex h-2 w-2 rounded-full bg-p" /></span>
        <EnsGlyph className="text-p" /> Live on ENS
      </span>
      <span className="text-muted">
        <b className="text-white">{data.total}</b> names under <span className="font-mono text-p">{PARENT}</span>
        {kinds.length > 0 && <span className="hidden md:inline"> · {kinds.map((k) => `${data.byKind[k]} ${KIND_LABEL[k].toLowerCase()}${data.byKind[k] > 1 ? "s" : ""}`).join(" · ")}</span>}
      </span>
      {w && (
        <span className="relative ml-auto flex min-w-0 max-w-full flex-1 justify-end overflow-hidden sm:max-w-[55%]">
          <AnimatePresence mode="wait">
            <motion.a key={w.id} href={w.eth_tx ? etherscanTx(w.eth_tx) : undefined} target="_blank" rel="noreferrer" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.3 }} className="flex min-w-0 items-center gap-1.5 text-muted hover:text-white">
              <span className="shrink-0 font-semibold text-p">{ACTION_COPY[w.action] ?? w.action}</span>
              <span className="truncate font-mono text-white/70">{w.name}</span>
              <span className="shrink-0">{ago(w.created_at)}</span>
              <ArrowUpRight className="h-3 w-3 shrink-0" />
            </motion.a>
          </AnimatePresence>
        </span>
      )}
    </motion.div>
  );
}

/** Heading + small print used by the ENS sections in cards. */
export function EnsHint({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-start gap-2 text-[11px] leading-relaxed text-muted">
      <EnsGlyph className="mt-0.5 text-p" />
      <span>{children}</span>
    </p>
  );
}

/** The signed-in user's names as an indented tree: account → objects → spaces → leases. */
export function YourNames({ api }: { api: <T>(path: string) => Promise<T> }) {
  const { data } = useQuery({ queryKey: ["my-names"], queryFn: () => api<{ account: string | null; names: { name: string; kind: string; status: string }[] }>("/api/me/names"), refetchInterval: 20_000 });
  if (!data?.account) return null;
  const acct = data.account;
  const depth = (n: string) => (n === acct ? 0 : n.slice(0, -(acct.length + 1)).split(".").length);
  // parents before children: sort by reversed labels
  const names = [...data.names].sort((a, b) => a.name.split(".").reverse().join(".").localeCompare(b.name.split(".").reverse().join(".")));
  const live = names.filter((n) => n.status === "registered").length;
  return (
    <div className="glass relative overflow-hidden rounded-3xl p-6">
      <div aria-hidden className="absolute -right-16 -top-16 h-44 w-44 rounded-full bg-p/15 blur-3xl" />
      <div className="relative mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-lg font-bold"><EnsGlyph className="h-4 w-4 text-p" /> Your ENS names</h3>
          <p className="mt-0.5 text-xs text-muted">Every account, object and space you list gets its own name on Sepolia ENS. Brands and agents can look it up.</p>
        </div>
        <div className="flex gap-2 text-xs">
          <span className="rounded-full bg-p/15 px-2.5 py-1 font-bold text-p">{live} live</span>
          {names.length - live > 0 && <span className="rounded-full bg-white/[0.06] px-2.5 py-1 font-bold text-p-300">{names.length - live} registering</span>}
        </div>
      </div>
      <ScrollList>
        {names.map((n, i) => (
          <motion.div key={n.name} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: Math.min(i, 10) * 0.04 }} className="relative flex items-center justify-between gap-3 py-1.5" style={{ paddingLeft: depth(n.name) * 22 }}>
            {depth(n.name) > 0 && <span aria-hidden className="absolute top-1/2 h-px w-3 bg-p/40" style={{ left: depth(n.name) * 22 - 14 }} />}
            <Link href={`/${n.name}`} className="min-w-0"><EnsName name={n.name} status={n.status} kind={n.kind} size="xs" /></Link>
            <span className="shrink-0 text-[10px] font-bold uppercase tracking-[0.12em] text-faint">{KIND_LABEL[n.kind] ?? n.kind}</span>
          </motion.div>
        ))}
      </ScrollList>
    </div>
  );
}

function ScrollList({ children }: { children: ReactNode }) {
  return <div className="relative max-h-[300px] overflow-y-auto overscroll-contain pr-1">{children}</div>;
}
