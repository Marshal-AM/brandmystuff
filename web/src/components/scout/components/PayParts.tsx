"use client";
/** Payment building blocks: the agent signing on its own, the step timeline, and known-error cards. */
import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import type { ScoutPaymentStep } from "@/lib/scout/types";
import { explainError } from "@/lib/scout/errors";
import { Icon } from "./Icon";
import "./payparts.css";

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

/** Scout authorising the payment itself: no buttons, just the agent working through it. */
export function AgentSigning({ quoted, checked, signing, signed }: { quoted: boolean; checked: boolean; signing: boolean; signed: boolean }) {
  const rows = [
    { on: quoted, run: !quoted, label: quoted ? "Read the 402 quote" : "Reading the 402 quote" },
    { on: checked, run: quoted && !checked, label: checked ? "Mandate allows it" : "Checking the budget mandate" },
    { on: signed, run: checked && !signed, label: signed ? "Signed with the agent key" : "Signing mandate::spend" },
  ];
  return (
    <div className="pp-sign">
      <div className="pp-sign-bot">
        <motion.span className="pp-sign-avatar" animate={signing || (checked && !signed) ? { rotate: [0, -6, 6, 0] } : { rotate: 0 }} transition={{ duration: 0.9, repeat: signing ? Infinity : 0 }}>
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden>
            <rect x="3" y="5" width="18" height="13" rx="6.5" fill="var(--ink)" />
            <rect x="8" y="9" width="2.6" height="5" rx="1.3" fill="var(--p)" />
            <rect x="13.4" y="9" width="2.6" height="5" rx="1.3" fill="var(--p)" />
          </svg>
        </motion.span>
        <div className="pp-sign-copy">
          <b>{signed ? "Scout signed the payment" : "Scout is paying on its own"}</b>
          <span>Within your mandate, no approval needed</span>
        </div>
      </div>
      <ul className="pp-sign-rows">
        {rows.map((r, i) => (
          <motion.li key={i} className={r.on ? "is-on" : r.run ? "is-run" : ""} initial={{ opacity: 0, x: -6 }} animate={{ opacity: r.on || r.run ? 1 : 0.4, x: 0 }} transition={{ delay: 0.1 + i * 0.08 }}>
            <span className="pp-dot">{r.on ? <Icon name="check" size={10} stroke={3.4} /> : r.run ? <i className="pp-spin" /> : null}</span>
            {r.label}
          </motion.li>
        ))}
      </ul>
      {/* a signature being drawn while the agent key signs */}
      <div className="pp-sig">
        <svg viewBox="0 0 240 40" preserveAspectRatio="none" aria-hidden>
          <motion.path
            d="M4 28 C 22 6, 34 36, 50 20 S 78 8, 92 26 S 120 34, 134 16 S 164 10, 176 26 S 206 30, 236 12"
            fill="none"
            stroke="var(--p)"
            strokeWidth="2.4"
            strokeLinecap="round"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: signed ? 1 : checked ? 0.62 : 0, opacity: checked ? 1 : 0 }}
            transition={{ duration: signed ? 0.5 : 1.4, ease: EASE }}
          />
        </svg>
        <span className="pp-sig-key"><Icon name="key" size={12} stroke={2.4} /> agent key</span>
      </div>
    </div>
  );
}

const ORDER: ScoutPaymentStep["key"][] = ["quote", "mandate", "sign", "submit", "settle", "book"];
const PENDING: Record<ScoutPaymentStep["key"], string> = {
  quote: "Request the x402 quote",
  mandate: "Check the budget mandate",
  sign: "Sign mandate::spend",
  submit: "Send PAYMENT-SIGNATURE",
  settle: "Settle on Sui",
  book: "Book the lease",
};

/** The real steps as a quiet vertical timeline (label, wrapped detail, time since start). */
export function PayTimeline({ seen, failed, amount }: { seen: ScoutPaymentStep[]; failed: boolean; amount: number }) {
  const t0 = seen[0]?.at ?? 0;
  return (
    <ol className="pp-tl">
      {ORDER.map((k, i) => {
        const s = seen.find((x) => x.key === k);
        const done = !!s;
        const active = !done && seen.length === i && !failed;
        const stopped = !done && seen.length === i && failed;
        return (
          <motion.li key={k} className={`${done ? "is-done" : ""} ${active ? "is-active" : ""} ${stopped ? "is-stopped" : ""}`} initial={{ opacity: 0, y: 6 }} animate={{ opacity: done || active || stopped ? 1 : 0.38, y: 0 }} transition={{ delay: i * 0.05, ease: EASE }}>
            <span className="pp-tl-dot">
              <AnimatePresence mode="popLayout" initial={false}>
                {done ? (
                  <motion.span key="d" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 500, damping: 20 }}>
                    <Icon name="check" size={9} stroke={3.6} />
                  </motion.span>
                ) : active ? (
                  <motion.i key="a" className="pp-spin" />
                ) : stopped ? (
                  <motion.span key="x" initial={{ scale: 0 }} animate={{ scale: 1 }}>×</motion.span>
                ) : null}
              </AnimatePresence>
            </span>
            <div className="pp-tl-body">
              <div className="pp-tl-head">
                <span className="pp-tl-label">{s?.label ?? PENDING[k]}</span>
                {done && <span className="pp-tl-time">{k === "settle" ? `${amount.toLocaleString("en-US", { maximumFractionDigits: 4 })} USDC · ` : ""}+{((s!.at - t0) / 1000).toFixed(1)}s</span>}
              </div>
              {s?.detail && <div className="pp-tl-detail">{s.detail}</div>}
            </div>
          </motion.li>
        );
      })}
    </ol>
  );
}

/** A known (or unknown) error, explained in plain words, with the raw message tucked away. */
export function ScoutError({ error, refunded, onClose, onRetry, compact }: { error: string; refunded?: boolean; onClose?: () => void; onRetry?: () => void; compact?: boolean }) {
  const e = explainError(error);
  const [open, setOpen] = useState(false);
  return (
    <motion.div className={`pp-err ${compact ? "is-compact" : ""}`} initial={{ opacity: 0, y: 10, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.35, ease: EASE }} role="alert">
      <div className="pp-err-top">
        <span className="pp-err-ico">!</span>
        <div className="pp-err-copy">
          <b>{e.title}</b>
          <span>{e.body}</span>
        </div>
      </div>
      {refunded && (
        <div className="pp-err-refund">
          <Icon name="check" size={11} stroke={3.2} /> The payment was refunded to your mandate
        </div>
      )}
      <div className="pp-err-next">
        <span>Next</span>
        {e.next}
      </div>
      <button type="button" className="pp-err-tech" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        {open ? "Hide" : "Show"} technical details
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.pre initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="pp-err-raw">
            {e.raw}
          </motion.pre>
        )}
      </AnimatePresence>
      {(onClose || onRetry) && (
        <div className="pp-err-actions">
          {onClose && <button type="button" className="pp-btn ghost" onClick={onClose}>Close</button>}
          {onRetry && <button type="button" className="pp-btn" onClick={onRetry}>Try again</button>}
        </div>
      )}
    </motion.div>
  );
}
