"use client";
/**
 * Typeform-style building blocks: one question per screen, big type, no card.
 * The form sits straight on the page background; Enter moves forward.
 */
import { useCallback, useEffect, useRef, useState, type InputHTMLAttributes, type KeyboardEvent, type ReactNode, type TextareaHTMLAttributes } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Check, ChevronDown, ChevronUp, CornerDownLeft, X } from "lucide-react";
import { Button, EASE, cx } from "./ui";

export function useFlow(total: number, start = 0) {
  const [i, setI] = useState(start);
  const [dir, setDir] = useState(1);
  const go = useCallback(
    (n: number) => {
      const to = Math.max(0, Math.min(total - 1, n));
      setDir(to >= i ? 1 : -1);
      setI(to);
    },
    [i, total],
  );
  return { i, dir, go, next: () => go(i + 1), back: () => go(i - 1), total };
}

/** The stage: slim progress bar, one animated question at a time, and ↑ ↓ controls. */
export function FlowFrame({
  flow,
  canNext,
  onEnter,
  children,
  chapters,
  className,
}: {
  flow: ReturnType<typeof useFlow>;
  canNext?: boolean;
  onEnter?: () => void;
  children: ReactNode;
  chapters?: { label: string; from: number }[];
  className?: string;
}) {
  const { i, dir, total } = flow;
  const pct = ((i + 1) / total) * 100;
  // Enter anywhere outside a field moves on (fields handle their own Enter).
  useEffect(() => {
    const h = (e: globalThis.KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (e.key !== "Enter" || e.shiftKey || e.isComposing) return;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "BUTTON" || t.tagName === "A" || t.isContentEditable)) return;
      if (canNext && onEnter) {
        e.preventDefault();
        onEnter();
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [canNext, onEnter]);
  const chapter = chapters ? [...chapters].reverse().find((c) => i >= c.from) : null;
  return (
    <div className={cx("relative", className)}>
      {/* progress */}
      <div className="mb-10 flex items-center gap-4">
        <div className="relative h-1 flex-1 overflow-hidden rounded-full bg-white/[0.07]">
          <motion.div className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-p-600 via-p to-p-200 shadow-[0_0_14px_rgba(171,159,242,0.6)]" initial={false} animate={{ width: `${pct}%` }} transition={{ duration: 0.6, ease: EASE }} />
        </div>
        <div className="flex shrink-0 items-center gap-2 text-xs font-semibold tabular-nums text-muted">
          {chapter && (
            <AnimatePresence mode="wait">
              <motion.span key={chapter.label} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} className="rounded-full border border-p/25 bg-p/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-p">
                {chapter.label}
              </motion.span>
            </AnimatePresence>
          )}
          {i + 1} / {total}
        </div>
      </div>

      <div className="relative flex min-h-[min(62vh,560px)] items-start">
        <AnimatePresence mode="wait" custom={dir} initial={false}>
          <motion.div
            key={i}
            custom={dir}
            variants={{
              enter: (d: number) => ({ opacity: 0, y: d * 48, filter: "blur(8px)" }),
              center: { opacity: 1, y: 0, filter: "blur(0px)" },
              exit: (d: number) => ({ opacity: 0, y: d * -48, filter: "blur(8px)" }),
            }}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.45, ease: EASE }}
            className="w-full"
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* up / down, bottom-right like Typeform */}
      <div className="mt-10 flex items-center justify-end gap-1.5">
        <button type="button" aria-label="Previous" disabled={i === 0} onClick={flow.back} className="grid h-9 w-9 place-items-center rounded-xl bg-white/[0.06] text-white/80 transition-colors hover:bg-p hover:text-ink disabled:pointer-events-none disabled:opacity-30">
          <ChevronUp className="h-4 w-4" />
        </button>
        <button type="button" aria-label="Next" disabled={!canNext || i === total - 1} onClick={onEnter} className="grid h-9 w-9 place-items-center rounded-xl bg-white/[0.06] text-white/80 transition-colors hover:bg-p hover:text-ink disabled:pointer-events-none disabled:opacity-30">
          <ChevronDown className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

/** One question: number, big title, optional helper, then the answer area. */
export function FlowQuestion({ n, title, sub, required, children, aside }: { n: number; title: ReactNode; sub?: ReactNode; required?: boolean; children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="flex gap-4 sm:gap-6">
      <div className="hidden pt-2 sm:block">
        <span className="inline-flex items-center gap-1 text-sm font-bold tabular-nums text-p">
          {n} <ArrowRight className="h-3.5 w-3.5" />
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-[1.75rem] font-extrabold leading-[1.15] tracking-tight sm:text-4xl">
              <span className="mr-2 text-p sm:hidden">{n}.</span>
              {title}
              {required && <span className="ml-1 text-p">*</span>}
            </h2>
            {sub && <p className="mt-3 max-w-2xl text-base leading-relaxed text-muted sm:text-lg">{sub}</p>}
          </div>
          {aside}
        </div>
        <div className="mt-8">{children}</div>
      </div>
    </div>
  );
}

const bigField =
  "w-full border-0 border-b-2 border-white/15 bg-transparent px-0 pb-3 pt-1 text-2xl font-semibold text-white outline-none transition-colors duration-300 placeholder:font-medium placeholder:text-white/20 focus:border-p sm:text-3xl";

/** Underlined, borderless input in large type. Enter calls onEnter. */
export function FlowInput({ onEnter, className, autoFocus = true, ...p }: InputHTMLAttributes<HTMLInputElement> & { onEnter?: () => void }) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (autoFocus) setTimeout(() => ref.current?.focus({ preventScroll: true }), 420);
  }, [autoFocus]);
  return (
    <input
      ref={ref}
      {...p}
      onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
        p.onKeyDown?.(e);
        if (e.key === "Enter" && !e.nativeEvent.isComposing && onEnter) {
          e.preventDefault();
          onEnter();
        }
      }}
      className={cx(bigField, className)}
    />
  );
}

/** Growing textarea in large type. Enter moves on; Shift+Enter adds a line. */
export function FlowTextarea({ onEnter, className, autoFocus = true, ...p }: TextareaHTMLAttributes<HTMLTextAreaElement> & { onEnter?: () => void }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (autoFocus) setTimeout(() => ref.current?.focus({ preventScroll: true }), 420);
  }, [autoFocus]);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [p.value]);
  return (
    <textarea
      ref={ref}
      rows={1}
      {...p}
      onKeyDown={(e) => {
        p.onKeyDown?.(e);
        if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing && onEnter) {
          e.preventDefault();
          onEnter();
        }
      }}
      className={cx(bigField, "resize-none overflow-hidden text-xl leading-snug sm:text-2xl", className)}
    />
  );
}

/** OK / Continue button with the Enter hint next to it. */
export function FlowNext({ onClick, disabled, loading, label = "OK", testId, hint = true, skip }: { onClick?: () => void; disabled?: boolean; loading?: boolean; label?: ReactNode; testId?: string; hint?: boolean; skip?: boolean }) {
  return (
    <div className="mt-8 flex flex-wrap items-center gap-4">
      <Button size="lg" onClick={onClick} disabled={disabled} loading={loading} data-testid={testId}>
        {label} {!loading && (skip ? <ArrowRight className="h-4 w-4" /> : <Check className="h-4 w-4" strokeWidth={3} />)}
      </Button>
      {hint && !disabled && (
        <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="hidden items-center gap-1.5 text-xs text-muted sm:inline-flex">
          press <kbd className="inline-flex items-center gap-1 rounded-md border border-line-strong bg-white/[0.05] px-1.5 py-0.5 font-sans text-[11px] font-bold text-white/80">Enter <CornerDownLeft className="h-3 w-3" /></kbd>
        </motion.span>
      )}
    </div>
  );
}

/** Typeform-style lettered choices; pressing the letter picks it. */
export function FlowChoice<T extends string>({ options, value, onChange, columns = 1 }: { options: { id: T; label: ReactNode; sub?: ReactNode }[]; value: T | null | undefined; onChange: (v: T) => void; columns?: 1 | 2 | 3 }) {
  useEffect(() => {
    const h = (e: globalThis.KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
      const k = e.key.toUpperCase();
      const idx = k.charCodeAt(0) - 65;
      if (k.length === 1 && idx >= 0 && idx < options.length) onChange(options[idx].id);
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [options, onChange]);
  return (
    <div className={cx("grid gap-2.5", columns === 2 && "sm:grid-cols-2", columns === 3 && "sm:grid-cols-3")}>
      {options.map((o, k) => {
        const on = value === o.id;
        return (
          <motion.button
            key={o.id}
            type="button"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 + k * 0.04, ease: EASE }}
            whileTap={{ scale: 0.98 }}
            onClick={() => onChange(o.id)}
            className={cx("group relative flex items-center gap-3 overflow-hidden rounded-2xl border px-4 py-3 text-left transition-colors", on ? "border-p bg-p/[0.12]" : "border-line-strong bg-white/[0.02] hover:border-p/50 hover:bg-p/[0.05]")}
          >
            <span className={cx("grid h-7 w-7 shrink-0 place-items-center rounded-lg border text-xs font-bold transition-colors", on ? "border-p bg-p text-ink" : "border-line-strong text-white/70 group-hover:border-p/60")}>{String.fromCharCode(65 + k)}</span>
            <span className="min-w-0 flex-1">
              <span className="block text-base font-semibold capitalize">{o.label}</span>
              {o.sub && <span className="mt-0.5 block text-xs text-muted">{o.sub}</span>}
            </span>
            <AnimatePresence>{on && <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}><Check className="h-4 w-4 text-p" strokeWidth={3} /></motion.span>}</AnimatePresence>
          </motion.button>
        );
      })}
    </div>
  );
}

/** Full-screen stage for flows opened from a page (replaces a modal dialog). */
export function FlowOverlay({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const h = (e: globalThis.KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", h);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);
  if (typeof document === "undefined") return null;
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }} className="fixed inset-0 z-[70] overflow-y-auto bg-ink">
          <div aria-hidden className="pointer-events-none fixed -left-40 top-1/4 h-[28rem] w-[28rem] rounded-full bg-p/10 blur-3xl" />
          <div aria-hidden className="pointer-events-none fixed -right-40 bottom-0 h-[24rem] w-[24rem] rounded-full bg-p-600/10 blur-3xl" />
          <div className="relative mx-auto max-w-3xl px-5 pb-16 pt-6 sm:px-8">
            <div className="mb-10 flex items-center justify-between">
              <span className="text-sm font-bold text-white/80">{title}</span>
              <motion.button whileHover={{ rotate: 90 }} whileTap={{ scale: 0.9 }} onClick={onClose} aria-label="Close" className="grid h-10 w-10 place-items-center rounded-full bg-white/[0.06] text-muted hover:bg-white/10 hover:text-white">
                <X className="h-4 w-4" />
              </motion.button>
            </div>
            <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: EASE, delay: 0.05 }}>
              {children}
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
