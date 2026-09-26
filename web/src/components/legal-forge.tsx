"use client";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, FileText, Fingerprint, Hash, Loader2, ScrollText, ShieldCheck, Stamp, Upload, X } from "lucide-react";
import { WALRUS } from "@/lib/deployment";
import { Button, EASE, Modal, cx } from "./ui";

export type ForgeEvent = { t: string; at: number; [k: string]: any };

const DOCS = [
  { key: "series-certificate", title: "Series Certificate" },
  { key: "revenue-participation-agreement", title: "Revenue Participation Agreement" },
  { key: "offering-memorandum", title: "Offering Memorandum" },
  { key: "risk-factors", title: "Risk Factors" },
  { key: "subscription-agreement", title: "Subscription Agreement" },
];

const kb = (n: number) => `${(n / 1024).toFixed(1)} KB`;
const short = (s: string, n = 8) => (s.length > n * 2 ? `${s.slice(0, n)}…${s.slice(-4)}` : s);

/** One line of the live log for an event. */
function describe(e: ForgeEvent): { icon: typeof Check; text: string } {
  switch (e.t) {
    case "check":
      return { icon: ShieldCheck, text: `Eligibility passed: grade ${e.grade} (${e.aqs}/100), ${Number(e.offered).toLocaleString()} units to offer${e.demoMode ? ", demo mode" : ""}` };
    case "series":
      return { icon: Hash, text: `Reserved series BMS Assets LLC #${e.seriesNo}` };
    case "draft":
      return { icon: FileText, text: `Drafted ${e.title} (${kb(e.bytes)} PDF)` };
    case "store":
      return { icon: Upload, text: `Sealed ${e.title} on Walrus · blob ${short(e.blobId)} · sha256 ${short(e.sha256, 6)}` };
    case "hash":
      return { icon: Fingerprint, text: `Pack fingerprint ${short(e.packHash, 10)}` };
    case "index":
      return { icon: ScrollText, text: `Published the pack index · blob ${short(e.blobId)}` };
    case "done":
      return { icon: Check, text: "Legal pack ready to sign" };
    case "error":
      return { icon: X, text: e.error };
    default:
      return { icon: Check, text: e.t };
  }
}

/**
 * The legal pack being built, live: what the server is doing right now, document by
 * document, with every Walrus blob and hash as it lands.
 */
export function LegalForge({ open, events, onClose, onRetry }: { open: boolean; events: ForgeEvent[]; onClose: () => void; onRetry: () => void }) {
  const start = events[0]?.at ?? 0;
  const has = (t: string) => events.some((e) => e.t === t);
  const drafted = new Map(events.filter((e) => e.t === "draft").map((e) => [e.key, e]));
  const stored = new Map(events.filter((e) => e.t === "store").map((e) => [e.key, e]));
  const done = events.find((e) => e.t === "done");
  const failed = events.find((e) => e.t === "error");
  const series = events.find((e) => e.t === "series")?.seriesNo;
  const hash = events.find((e) => e.t === "hash")?.packHash;

  const stages = [
    { key: "check", label: "Checking eligibility", done: has("check") },
    { key: "series", label: "Reserving the series", done: has("series") },
    { key: "draft", label: "Drafting 5 documents", done: drafted.size === DOCS.length, count: `${drafted.size}/${DOCS.length}` },
    { key: "store", label: "Sealing on Walrus", done: stored.size === DOCS.length, count: `${stored.size}/${DOCS.length}` },
    { key: "hash", label: "Fingerprinting the pack", done: has("hash") },
    { key: "index", label: "Publishing the index", done: has("index") },
  ];
  const activeIdx = failed ? -1 : stages.findIndex((s) => !s.done);
  const progress = done ? 1 : (stages.filter((s) => s.done).length + (stored.size / DOCS.length) * 0.5) / (stages.length + 0.5);

  // elapsed clock
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!open || done || failed) return;
    const t = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(t);
  }, [open, done, failed]);
  const elapsed = start ? (((done ?? failed)?.at ?? now) - start) / 1000 : 0;

  // keep the log pinned to the newest line (scrolls the log only)
  const logRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [events.length]);

  return (
    <Modal open={open} onClose={done || failed ? onClose : () => {}} title="Building your legal pack" wide>
      <div className="space-y-5">
        {/* header strip */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <AnimatePresence>
            {series && (
              <motion.span initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} className="rounded-full border border-p/30 bg-p/10 px-2.5 py-1 font-mono font-semibold text-p">
                Series #{series}
              </motion.span>
            )}
          </AnimatePresence>
          <span className="rounded-full bg-white/[0.05] px-2.5 py-1 font-mono tabular-nums text-muted">{elapsed.toFixed(1)}s</span>
          <span className={cx("ml-auto inline-flex items-center gap-1.5 font-semibold", done ? "text-p" : failed ? "text-white" : "text-p-200")}>
            {done ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : failed ? <X className="h-3.5 w-3.5" /> : <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {done ? "Ready" : failed ? "Stopped" : "Working"}
          </span>
        </div>
        <div className="relative h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
          <motion.div className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-p-600 via-p to-p-200 shadow-[0_0_16px_rgba(171,159,242,0.7)]" animate={{ width: `${Math.max(4, progress * 100)}%` }} transition={{ duration: 0.6, ease: EASE }} />
          {!done && !failed && <span className="absolute inset-y-0 w-1/4 bg-gradient-to-r from-transparent via-white/40 to-transparent [animation:sweep_1.6s_linear_infinite]" />}
        </div>

        <div className="grid gap-5 md:grid-cols-[210px_1fr]">
          {/* stages */}
          <ol className="relative space-y-1">
            <span aria-hidden className="absolute bottom-3 left-[13px] top-3 w-px bg-white/10" />
            {stages.map((s, i) => {
              const state = s.done ? "done" : i === activeIdx ? "run" : "todo";
              return (
                <li key={s.key} className={cx("relative flex items-center gap-3 rounded-xl px-1 py-1.5 text-sm transition-opacity", state === "todo" && "opacity-40")}>
                  <span className={cx("relative grid h-7 w-7 shrink-0 place-items-center rounded-full transition-colors duration-500", state === "done" ? "bg-p text-ink" : state === "run" ? "bg-p/15 text-p ring-1 ring-p/50" : "bg-p-950 text-muted ring-1 ring-line-strong")}>
                    {state === "run" && <span className="absolute inset-0 animate-ping rounded-full bg-p/25" />}
                    {state === "done" ? (
                      <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 500, damping: 20 }}><Check className="h-3.5 w-3.5" strokeWidth={3} /></motion.span>
                    ) : state === "run" ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <span className="text-[10px] font-bold">{i + 1}</span>
                    )}
                  </span>
                  <span className={cx("min-w-0 flex-1", state === "run" ? "font-semibold text-white" : "text-white/80")}>{s.label}</span>
                  {s.count && state !== "todo" && <span className="font-mono text-[10px] text-muted">{s.count}</span>}
                </li>
              );
            })}
          </ol>

          {/* documents */}
          <div className="grid content-start gap-2 sm:grid-cols-2">
            {DOCS.map((d, i) => {
              const dr = drafted.get(d.key);
              const st = stored.get(d.key);
              const state = st ? "sealed" : dr ? (activeIdx === 3 && [...stored.keys()].length === DOCS.findIndex((x) => x.key === d.key) ? "sealing" : "drafted") : has("series") && !failed ? "drafting" : "waiting";
              return (
                <motion.div
                  key={d.key}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05, ease: EASE }}
                  className={cx(
                    "relative overflow-hidden rounded-2xl border p-3 transition-colors duration-500",
                    state === "sealed" ? "border-p/40 bg-p/[0.07]" : state === "sealing" ? "border-p/50 bg-white/[0.03]" : "border-line bg-white/[0.02]",
                    i === DOCS.length - 1 && "sm:col-span-2",
                  )}
                >
                  {(state === "sealing" || state === "drafting") && <span aria-hidden className="absolute inset-y-0 -left-1/3 w-1/3 bg-gradient-to-r from-transparent via-p/20 to-transparent [animation:sweep_1.4s_ease-in-out_infinite]" />}
                  <div className="relative flex items-start gap-3">
                    <span className={cx("relative grid h-9 w-9 shrink-0 place-items-center rounded-xl transition-colors duration-500", state === "sealed" ? "bg-p text-ink" : "bg-p/15 text-p")}>
                      <FileText className="h-4 w-4" />
                      <AnimatePresence>
                        {state === "sealed" && (
                          <motion.span initial={{ scale: 2.4, opacity: 0, rotate: -30 }} animate={{ scale: 1, opacity: 1, rotate: 0 }} transition={{ type: "spring", stiffness: 380, damping: 16 }} className="absolute -bottom-1 -right-1 grid h-4 w-4 place-items-center rounded-full bg-ink text-p ring-2 ring-ink">
                            <Stamp className="h-2.5 w-2.5" />
                          </motion.span>
                        )}
                      </AnimatePresence>
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold">{d.title}</div>
                      <div className="mt-0.5 truncate text-[11px] text-muted">
                        {state === "sealed" ? (
                          <a href={`${WALRUS.aggregator}/v1/blobs/${st!.blobId}`} target="_blank" rel="noreferrer" className="font-mono text-p-200 hover:text-p">
                            blob {short(st!.blobId, 6)} · {short(st!.sha256, 4)}
                          </a>
                        ) : state === "sealing" ? (
                          "Sealing on Walrus…"
                        ) : state === "drafted" ? (
                          `Drafted · ${kb(dr!.bytes)} · queued for Walrus`
                        ) : state === "drafting" ? (
                          "Drafting…"
                        ) : (
                          "Waiting"
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* live log */}
        <div className="overflow-hidden rounded-2xl border border-line bg-ink">
          <div className="flex items-center gap-2 border-b border-line px-3 py-2 text-[11px] text-muted">
            <span className="flex gap-1"><span className="h-2 w-2 rounded-full bg-white/15" /><span className="h-2 w-2 rounded-full bg-white/15" /><span className="h-2 w-2 rounded-full bg-p/60" /></span>
            <span className="font-mono">legal-pack.log</span>
          </div>
          <div ref={logRef} className="max-h-44 space-y-1 overflow-y-auto overscroll-contain p-3 font-mono text-[11.5px] leading-relaxed">
            <AnimatePresence initial={false}>
              {events.map((e, i) => {
                const { icon: Icon, text } = describe(e);
                return (
                  <motion.div key={i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.25 }} className={cx("flex items-start gap-2", e.t === "error" ? "text-white" : e.t === "done" ? "text-p" : "text-white/75")}>
                    <span className="w-14 shrink-0 text-right tabular-nums text-faint">+{((e.at - start) / 1000).toFixed(2)}s</span>
                    <Icon className={cx("mt-0.5 h-3.5 w-3.5 shrink-0", e.t === "error" ? "text-white" : "text-p")} />
                    <span className="min-w-0 break-words">{text}</span>
                  </motion.div>
                );
              })}
            </AnimatePresence>
            {!done && !failed && (
              <div className="flex items-center gap-2 text-faint">
                <span className="w-14" />
                <span className="inline-block h-3.5 w-1.5 bg-p [animation:caret-blink_1s_steps(1)_infinite]" />
              </div>
            )}
          </div>
        </div>

        {/* outcome */}
        <AnimatePresence>
          {done && (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ ease: EASE }} className="flex flex-wrap items-center gap-4 rounded-2xl border border-p/40 bg-p/[0.08] p-4">
              <motion.span initial={{ scale: 0, rotate: -60 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring", stiffness: 300, damping: 14 }} className="grid h-11 w-11 place-items-center rounded-full bg-p text-ink shadow-[0_0_30px_rgba(171,159,242,0.6)]">
                <Check className="h-5 w-5" strokeWidth={3} />
              </motion.span>
              <div className="min-w-0 flex-1">
                <div className="font-bold">5 documents sealed, pack ready to sign</div>
                {hash && <div className="truncate font-mono text-[11px] text-muted">fingerprint {hash}</div>}
              </div>
              <Button onClick={onClose}>Review & sign</Button>
            </motion.div>
          )}
          {failed && (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="flex flex-wrap items-center gap-3 rounded-2xl border border-white/20 bg-white/[0.04] p-4">
              <X className="h-5 w-5 shrink-0" />
              <div className="min-w-0 flex-1 text-sm">{failed.error}</div>
              <Button variant="secondary" onClick={onClose}>Close</Button>
              <Button onClick={onRetry}>Try again</Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Modal>
  );
}
