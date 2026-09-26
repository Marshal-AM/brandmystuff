"use client";
import Link from "next/link";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useInView, type HTMLMotionProps } from "framer-motion";
import { AlertTriangle, Check, Info, X } from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { blobUrl, SUI, ENS_DEPLOYMENT } from "@/lib/deployment";
import { GRADE_LABEL } from "@/lib/categories";

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");
export const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];
const SPRING = { type: "spring" as const, stiffness: 420, damping: 28 };

// ---------------- buttons ----------------
type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const btnBase =
  "group/btn relative inline-flex select-none items-center justify-center gap-2 overflow-hidden rounded-full font-semibold tracking-tight transition-[background-color,border-color,color,box-shadow] duration-300 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-p/25";
const btnSize: Record<Size, string> = { sm: "h-8 px-3.5 text-xs", md: "h-11 px-5 text-sm", lg: "h-13 px-7 text-[15px]" };
const btnVariant: Record<Variant, string> = {
  primary: "bg-p text-ink shadow-[0_10px_30px_-8px_rgba(171,159,242,0.6)] hover:shadow-[0_14px_40px_-6px_rgba(171,159,242,0.75)]",
  secondary: "border border-line-strong bg-white/[0.04] text-white hover:border-p/50 hover:bg-p/10",
  ghost: "text-muted hover:bg-white/[0.06] hover:text-white",
  danger: "border border-white/25 bg-transparent text-white hover:bg-white hover:text-ink",
};

function Sheen() {
  return (
    <span aria-hidden className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/40 to-transparent transition-transform duration-700 ease-out group-hover/btn:translate-x-full" />
  );
}

export function Button({
  variant = "primary",
  size = "md",
  loading,
  className,
  children,
  ...p
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size; loading?: boolean }) {
  const disabled = p.disabled || loading;
  return (
    <motion.button
      {...(p as HTMLMotionProps<"button">)}
      disabled={disabled}
      aria-busy={loading || undefined}
      whileTap={disabled ? undefined : { scale: 0.96 }}
      whileHover={disabled ? undefined : { y: -1 }}
      transition={SPRING}
      className={cx(
        btnBase,
        btnSize[size],
        btnVariant[variant],
        // disabled = greyed out; loading = full colour, busy cursor, animated
        p.disabled && !loading && "cursor-not-allowed opacity-40",
        loading && "cursor-wait",
        loading && variant === "primary" && "animate-[btn-pulse_1.6s_ease-in-out_infinite]",
        className,
      )}
    >
      {variant === "primary" && !loading && <Sheen />}
      {loading && (
        <span aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]">
          <span className={cx("absolute inset-y-0 -left-1/2 w-1/2 skew-x-[-20deg] bg-gradient-to-r from-transparent to-transparent [animation:btn-sweep_1.1s_linear_infinite]", variant === "primary" ? "via-white/55" : "via-p/35")} />
        </span>
      )}
      <AnimatePresence initial={false} mode="popLayout">
        {loading && (
          <motion.span key="spin" initial={{ opacity: 0, scale: 0.4, width: 0 }} animate={{ opacity: 1, scale: 1, width: "auto" }} exit={{ opacity: 0, scale: 0.4, width: 0 }} className="relative">
            <Spinner className="h-4 w-4" />
          </motion.span>
        )}
      </AnimatePresence>
      <span className="relative inline-flex items-center gap-2">{children}</span>
    </motion.button>
  );
}

export const LinkButton = ({ href, children, variant = "primary", size = "md", className }: { href: string; children: ReactNode; variant?: "primary" | "secondary" | "ghost"; size?: Size; className?: string }) => (
  <motion.span whileTap={{ scale: 0.96 }} whileHover={{ y: -1 }} transition={SPRING} className={cx("inline-flex", className?.includes("w-full") && "w-full")}>
    <Link href={href} className={cx(btnBase, btnSize[size], btnVariant[variant], className)}>
      {variant === "primary" && <Sheen />}
      <span className="relative inline-flex items-center gap-2">{children}</span>
    </Link>
  </motion.span>
);

// ---------------- loaders ----------------
export function Spinner({ className }: { className?: string }) {
  // SVG arc (not border colours) so it always renders in the current text colour.
  return (
    <svg viewBox="0 0 24 24" fill="none" className={cx("shrink-0 animate-spin [animation-duration:0.75s]", className ?? "h-5 w-5")} role="img" aria-label="Loading">
      <circle cx="12" cy="12" r="9.5" stroke="currentColor" strokeOpacity="0.22" strokeWidth="2.75" />
      <path d="M21.5 12a9.5 9.5 0 0 0-9.5-9.5" stroke="currentColor" strokeWidth="2.75" strokeLinecap="round" />
    </svg>
  );
}

/** Full-area loader: three orbiting dots around the brand mark. */
export function PageLoader({ label = "Loading" }: { label?: string }) {
  return (
    <div className="grid place-items-center py-28" role="status">
      <div className="relative h-16 w-16">
        <motion.div className="absolute inset-0" animate={{ rotate: 360 }} transition={{ duration: 1.6, repeat: Infinity, ease: "linear" }}>
          {[0, 120, 240].map((d, i) => (
            <span key={d} className="absolute inset-0" style={{ transform: `rotate(${d}deg)` }}>
              <span className="absolute left-1/2 top-0 h-2.5 w-2.5 -translate-x-1/2 rounded-full bg-p shadow-[0_0_12px_var(--p)]" style={{ opacity: 1 - i * 0.25 }} />
            </span>
          ))}
        </motion.div>
        <div className="absolute inset-3 grid place-items-center rounded-full bg-p">
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
            <rect x="3" y="5" width="18" height="13" rx="6.5" fill="#0a0a0b" />
            <motion.rect x="8" y="9" width="2.6" height="5" rx="1.3" fill="#ab9ff2" animate={{ scaleY: [1, 0.1, 1] }} transition={{ duration: 2.4, repeat: Infinity, times: [0, 0.05, 0.1] }} style={{ originY: 0.5 }} />
            <motion.rect x="13.4" y="9" width="2.6" height="5" rx="1.3" fill="#ab9ff2" animate={{ scaleY: [1, 0.1, 1] }} transition={{ duration: 2.4, repeat: Infinity, times: [0, 0.05, 0.1] }} style={{ originY: 0.5 }} />
          </svg>
        </div>
      </div>
      <p className="mt-5 text-xs font-semibold uppercase tracking-[0.18em] text-muted">{label}…</p>
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx("shimmer rounded-2xl", className)} />;
}

// ---------------- motion helpers ----------------
export function Reveal({ children, delay = 0, y = 18, className }: { children: ReactNode; delay?: number; y?: number; className?: string }) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y, filter: "blur(8px)" }}
      whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.7, delay, ease: EASE }}
    >
      {children}
    </motion.div>
  );
}

const staggerParent = { hidden: {}, show: { transition: { staggerChildren: 0.06, delayChildren: 0.05 } } };
const staggerChild = { hidden: { opacity: 0, y: 22, scale: 0.98, filter: "blur(8px)" }, show: { opacity: 1, y: 0, scale: 1, filter: "blur(0px)", transition: { duration: 0.65, ease: EASE } } };

export function Stagger({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div className={className} variants={staggerParent} initial="hidden" animate="show">
      {children}
    </motion.div>
  );
}
export function StaggerItem({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div className={className} variants={staggerChild} layout>
      {children}
    </motion.div>
  );
}

/** Counts up to a number when it scrolls into view. */
const decimalsOf = (v: number) => (Number.isInteger(v) ? 0 : Math.min(4, (String(v).split(".")[1] ?? "").length));

export function AnimatedNumber({ value, format, duration = 1200 }: { value: number; format?: (n: number) => string; duration?: number }) {
  const d = decimalsOf(value);
  const fmt = format ?? ((n: number) => n.toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d }));
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!inView) return;
    let raf = 0;
    const t0 = performance.now();
    const from = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / duration);
      setN(from + (value - from) * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, value, duration]);
  return <span ref={ref} className="tabular-nums">{fmt(inView ? n : 0)}</span>;
}

export function Kicker({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={cx("inline-flex items-center gap-2 rounded-full border border-p/25 bg-p/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-p", className)}>
      <span className="h-1.5 w-1.5 rounded-full bg-p shadow-[0_0_10px_var(--p)] [animation:live-dot_1.8s_ease-in-out_infinite]" />
      {children}
    </span>
  );
}

/** Page title block: kicker, word-by-word title reveal, subtitle and actions. */
export function PageHeader({ kicker, title, sub, actions, className }: { kicker?: ReactNode; title: string; sub?: ReactNode; actions?: ReactNode; className?: string }) {
  const words = title.split(" ");
  return (
    <div className={cx("mb-8 flex flex-wrap items-end justify-between gap-6", className)}>
      <div className="min-w-0 max-w-3xl">
        {kicker && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: EASE }}>
            <Kicker>{kicker}</Kicker>
          </motion.div>
        )}
        <h1 className="mt-4 text-4xl font-extrabold leading-[1.02] tracking-[-0.04em] text-white sm:text-5xl">
          {words.map((w, i) => (
            <span key={i} className="mr-[0.24em] inline-block overflow-hidden pb-1 align-top last:mr-0">
              <motion.span className="inline-block" initial={{ y: "105%" }} animate={{ y: "0%" }} transition={{ duration: 0.75, delay: 0.05 + i * 0.05, ease: EASE }}>
                {w}
              </motion.span>
            </span>
          ))}
        </h1>
        {sub && (
          <motion.p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-muted" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.7, delay: 0.35 }}>
            {sub}
          </motion.p>
        )}
      </div>
      {actions && (
        <motion.div className="flex flex-wrap items-center gap-2" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.3, ease: EASE }}>
          {actions}
        </motion.div>
      )}
    </div>
  );
}

// ---------------- surfaces ----------------
export function Card({ children, className, delay = 0, hover }: { children: ReactNode; className?: string; delay?: number; hover?: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 18, filter: "blur(6px)" }}
      whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      viewport={{ once: true, margin: "-30px" }}
      transition={{ duration: 0.65, delay, ease: EASE }}
      className={cx(
        "glass relative rounded-3xl shadow-[0_20px_60px_-30px_rgba(0,0,0,0.8)]",
        !/(^|\s)!?p-(\d|\[)/.test(className ?? "") && "p-6",
        hover && "transition-[border-color,transform] duration-300 hover:-translate-y-0.5 hover:border-p/40",
        className,
      )}
    >
      {children}
    </motion.div>
  );
}

export function SectionTitle({ children, action, className }: { children: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cx("mb-4 flex items-center justify-between gap-3", className)}>
      <h2 className="text-[15px] font-bold tracking-tight text-white">{children}</h2>
      {action}
    </div>
  );
}

// ---------------- form controls ----------------
export function Field({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <label className="block space-y-2">
      <span className="text-[13px] font-semibold text-white/80">{label}</span>
      {children}
      {hint && <span className="block text-xs text-muted">{hint}</span>}
    </label>
  );
}

const inputCls =
  "w-full rounded-2xl border border-line-strong bg-white/[0.04] px-4 py-3 text-sm text-white outline-none transition-[border-color,box-shadow,background-color] duration-300 placeholder:text-white/30 hover:border-white/20 focus:border-p focus:bg-p/[0.06] focus:ring-4 focus:ring-p/15";
export const Input = (p: InputHTMLAttributes<HTMLInputElement>) => <input {...p} className={cx(inputCls, p.className)} />;
export const Textarea = (p: TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea {...p} className={cx(inputCls, "resize-none", p.className)} />;
export const Select = (p: SelectHTMLAttributes<HTMLSelectElement>) => (
  <select
    {...p}
    className={cx(inputCls, "cursor-pointer appearance-none bg-[length:14px] bg-[right_14px_center] bg-no-repeat pr-10", p.className)}
    style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23ab9ff2' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")", ...p.style }}
  />
);

// ---------------- badges ----------------
type Tone = "neutral" | "brand" | "ok" | "warn" | "bad" | "sponsored";
export function Badge({ children, tone = "neutral", className }: { children: ReactNode; tone?: Tone; className?: string }) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-bold tracking-wide",
        tone === "neutral" && "bg-white/[0.07] text-white/70",
        tone === "brand" && "bg-p/15 text-p ring-1 ring-inset ring-p/25",
        tone === "ok" && "bg-p text-ink",
        tone === "warn" && "bg-p-300/10 text-p-300 ring-1 ring-inset ring-p-300/30",
        tone === "bad" && "bg-white text-ink",
        tone === "sponsored" && "bg-gradient-to-r from-p-300 to-p text-ink",
        className,
      )}
    >
      {tone === "warn" && <span className="h-1.5 w-1.5 rounded-full bg-p-300 [animation:live-dot_1.4s_ease-in-out_infinite]" />}
      {tone === "bad" && <X className="h-3 w-3" strokeWidth={3} />}
      {tone === "ok" && <Check className="h-3 w-3" strokeWidth={3.5} />}
      {children}
    </span>
  );
}

export function GradeBadge({ grade, aqs, size = "md" }: { grade: number; aqs?: number; size?: "sm" | "md" | "lg" }) {
  const g = GRADE_LABEL[grade] ?? "—";
  const top = grade >= 4;
  return (
    <span
      className={cx(
        "relative inline-flex items-center gap-1.5 overflow-hidden whitespace-nowrap font-extrabold tracking-tight",
        top ? "bg-p text-ink" : grade === 3 ? "bg-ink text-p ring-1 ring-p/40" : grade === 2 ? "bg-p-800 text-p-200" : "bg-white/10 text-white/70",
        size === "lg" ? "rounded-2xl px-3.5 py-1.5 text-xl" : size === "sm" ? "rounded-lg px-2 py-0.5 text-[11px]" : "rounded-xl px-2.5 py-1 text-sm",
      )}
    >
      {top && <span aria-hidden className="absolute inset-y-0 -left-1/2 w-1/3 skew-x-[-20deg] bg-white/50 [animation:sweep_2.8s_ease-in-out_infinite]" />}
      <span className="relative">{g}</span>
      {aqs != null && <span className="relative font-semibold opacity-75">· {aqs}</span>}
    </span>
  );
}

// ---------------- formatting ----------------
export const usdc = (atomic: string | number | bigint | null | undefined, digits = 2) => {
  const n = Number(atomic ?? 0) / 1e6;
  return `${n.toLocaleString(undefined, { minimumFractionDigits: n < 1 && n > 0 ? Math.min(6, digits + 2) : digits, maximumFractionDigits: n < 1 && n > 0 ? 6 : digits })} USDC`;
};
export const shortAddr = (a?: string | null) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "");
export const suiscan = (kind: "tx" | "object" | "account", id: string) => `${SUI.explorer}/${kind}/${id}`;
export const etherscanTx = (h: string) => `${ENS_DEPLOYMENT.explorer}/tx/${h}`;
export const img = blobUrl;

/** Walrus image with a shimmer placeholder that sharpens into focus once loaded. */
export function Img({ blob, alt, className }: { blob?: string | null; alt: string; className?: string }) {
  const [loaded, setLoaded] = useState(false);
  if (!blob)
    return (
      <div className={cx("relative overflow-hidden bg-gradient-to-br from-p-900 via-p-950 to-ink", className)}>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(171,159,242,0.25),transparent_60%)]" />
      </div>
    );
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={blobUrl(blob)}
      alt={alt}
      loading="lazy"
      onLoad={() => setLoaded(true)}
      className={cx("object-cover transition-[filter,transform,opacity] duration-700 ease-out", loaded ? "blur-none" : "shimmer blur-md", className)}
    />
  );
}

// ---------------- overlays ----------------
export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    const prev = document.body.style.overflow;
    if (open) document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", h);
      document.body.style.overflow = prev;
    };
  }, [onClose, open]);
  // Portal to <body>: ancestors with backdrop-filter/transform (the header) would otherwise
  // become the containing block for `fixed` and pin the dialog to them instead of the viewport.
  if (typeof document === "undefined") return null;
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-ink/70 p-4 backdrop-blur-md sm:p-6"
          onClick={onClose}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          <motion.div
            className={cx(
              "relative max-h-[88vh] w-full overflow-y-auto rounded-[2rem] border border-line-strong bg-gradient-to-b from-p-900 to-p-950 p-6 shadow-[0_40px_120px_rgba(0,0,0,0.7)] sm:p-7",
              wide ? "sm:max-w-3xl" : "sm:max-w-lg",
            )}
            onClick={(e) => e.stopPropagation()}
            initial={{ opacity: 0, y: 60, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 40, scale: 0.96 }}
            transition={{ type: "spring", stiffness: 260, damping: 26 }}
          >
            <div aria-hidden className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-p/20 blur-3xl" />
            <div className="relative mb-5 flex items-center justify-between gap-4">
              <h2 className="text-xl font-extrabold tracking-tight">{title}</h2>
              <motion.button whileHover={{ rotate: 90 }} whileTap={{ scale: 0.9 }} onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full bg-white/[0.06] text-muted hover:bg-white/10 hover:text-white" aria-label="Close">
                <X className="h-4 w-4" />
              </motion.button>
            </div>
            <div className="relative">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

// ---------------- empty / stats / tabs ----------------
function MiniBot() {
  return (
    <motion.svg width="64" height="72" viewBox="0 0 64 72" animate={{ y: [0, -6, 0] }} transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }} aria-hidden>
      <ellipse cx="32" cy="69" rx="14" ry="2.5" fill="#000" opacity="0.4" />
      <line x1="32" y1="10" x2="32" y2="4" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
      <motion.circle cx="32" cy="4" r="3" fill="#ab9ff2" animate={{ opacity: [0.5, 1, 0.5] }} transition={{ duration: 1.6, repeat: Infinity }} />
      <rect x="10" y="10" width="44" height="34" rx="16" fill="#fff" />
      <rect x="15" y="16" width="34" height="22" rx="10" fill="#0a0a0b" />
      <motion.g animate={{ scaleY: [1, 0.1, 1] }} transition={{ duration: 3.6, repeat: Infinity, times: [0, 0.04, 0.08] }} style={{ originY: 0.5 }}>
        <rect x="24" y="22" width="4" height="8" rx="2" fill="#ab9ff2" />
        <rect x="36" y="22" width="4" height="8" rx="2" fill="#ab9ff2" />
      </motion.g>
      <rect x="20" y="46" width="24" height="18" rx="9" fill="#fff" />
      <circle cx="32" cy="55" r="3" fill="#ab9ff2" />
    </motion.svg>
  );
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.6, ease: EASE }}
      className="relative overflow-hidden rounded-3xl border border-dashed border-line-strong bg-white/[0.02] px-6 py-12 text-center"
    >
      <div aria-hidden className="absolute left-1/2 top-0 h-40 w-72 -translate-x-1/2 rounded-full bg-p/10 blur-3xl" />
      <div className="relative mx-auto mb-4 w-fit">
        <MiniBot />
      </div>
      <p className="relative text-lg font-bold tracking-tight">{title}</p>
      {children && <div className="relative mx-auto mt-2 max-w-md text-sm text-muted">{children}</div>}
    </motion.div>
  );
}

/** Keeps its content on one line, shrinking the font until it fits the box. */
export function FitText({ children, max = 26, min = 13, className }: { children: ReactNode; max?: number; min?: number; className?: string }) {
  const box = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const b = box.current, i = inner.current;
    if (!b || !i) return;
    const fit = () => {
      i.style.fontSize = `${max}px`;
      const w = i.scrollWidth, avail = b.clientWidth;
      i.style.fontSize = `${w > avail ? Math.max(min, Math.floor(((max * avail) / w) * 10) / 10) : max}px`;
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(b);
    const mo = new MutationObserver(fit);
    mo.observe(i, { subtree: true, childList: true, characterData: true });
    return () => { ro.disconnect(); mo.disconnect(); };
  }, [max, min]);
  return (
    <div ref={box} className={cx("min-w-0 overflow-hidden", className)}>
      <span ref={inner} className="inline-block whitespace-nowrap leading-tight" style={{ fontSize: max }}>{children}</span>
    </div>
  );
}

/** A small muted unit after a figure, e.g. 12.50 <Unit>USDC</Unit>. */
export function Unit({ children }: { children: ReactNode }) {
  return <span className="ml-1 text-[0.55em] font-bold tracking-normal text-muted">{children}</span>;
}

/** Splits "12.5 USDC" / "300 units" so the unit renders small. */
function withUnit(v: ReactNode) {
  if (typeof v !== "string") return v;
  const m = v.match(/^(.*\d)\s+(USDC|SUI|units?)$/);
  return m ? <>{m[1]}<Unit>{m[2]}</Unit></> : v;
}

export function Stat({ label, value, sub, delay = 0 }: { label: string; value: ReactNode; sub?: ReactNode; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6, delay, ease: EASE }}
      whileHover={{ y: -3 }}
      className="glass group relative min-w-0 overflow-hidden rounded-3xl p-5"
    >
      <div aria-hidden className="absolute -right-10 -top-10 h-28 w-28 rounded-full bg-p/0 blur-2xl transition-colors duration-500 group-hover:bg-p/20" />
      <div className="relative truncate text-[11px] font-bold uppercase tracking-[0.12em] text-muted" title={label}>{label}</div>
      <motion.div className="relative mt-2" initial={{ opacity: 0, filter: "blur(6px)" }} whileInView={{ opacity: 1, filter: "blur(0px)" }} viewport={{ once: true }} transition={{ duration: 0.8, delay: delay + 0.15 }}>
        <FitText className="font-extrabold tabular-nums tracking-tight">{withUnit(value)}</FitText>
      </motion.div>
      {sub && <div className="relative mt-1 truncate text-xs text-muted">{sub}</div>}
    </motion.div>
  );
}

/** Fixed-height list that scrolls inside itself, with soft fades at the edges while there is more to see. */
export function ScrollArea({ children, className, max = 320 }: { children: ReactNode; className?: string; max?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [edge, setEdge] = useState({ top: false, bottom: false });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const upd = () => setEdge({ top: el.scrollTop > 2, bottom: el.scrollTop + el.clientHeight < el.scrollHeight - 2 });
    upd();
    el.addEventListener("scroll", upd, { passive: true });
    const ro = new ResizeObserver(upd);
    ro.observe(el);
    if (el.firstElementChild) ro.observe(el.firstElementChild);
    return () => { el.removeEventListener("scroll", upd); ro.disconnect(); };
  }, []);
  const mask = `linear-gradient(to bottom, ${edge.top ? "transparent" : "#000"} 0, #000 28px, #000 calc(100% - 28px), ${edge.bottom ? "transparent" : "#000"} 100%)`;
  return (
    <div ref={ref} className={cx("overflow-y-auto overscroll-contain pr-1", className)} style={{ maxHeight: max, maskImage: mask, WebkitMaskImage: mask }}>
      <div>{children}</div>
    </div>
  );
}

export function Tabs<T extends string>({ tabs, value, onChange, size = "md" }: { tabs: { id: T; label: ReactNode }[]; value: T; onChange: (t: T) => void; size?: "sm" | "md" }) {
  const id = useId();
  return (
    <div className="inline-flex max-w-full gap-1 overflow-x-auto rounded-full border border-line bg-white/[0.03] p-1 [scrollbar-width:none]">
      {tabs.map((t) => (
        <button key={t.id} type="button" onClick={() => onChange(t.id)} className={cx("relative shrink-0 whitespace-nowrap rounded-full font-semibold transition-colors duration-300", size === "sm" ? "px-3 py-1.5 text-xs" : "px-4 py-2 text-sm", value === t.id ? "text-ink" : "text-muted hover:text-white")}>
          {value === t.id && <motion.span layoutId={`tab-${id}`} className="absolute inset-0 rounded-full bg-p shadow-[0_0_24px_rgba(171,159,242,0.45)]" transition={{ type: "spring", stiffness: 380, damping: 30 }} />}
          <span className="relative">{t.label}</span>
        </button>
      ))}
    </div>
  );
}

// ---------------- toasts ----------------
type Toast = { id: number; text: string; tone: "ok" | "bad" | "info"; link?: { href: string; label: string } };
const ToastCtx = createContext<(t: Omit<Toast, "id">) => void>(() => {});
const TOAST_MS = 6000;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const push = useCallback((t: Omit<Toast, "id">) => {
    const id = Date.now() + Math.random();
    setItems((x) => [...x, { ...t, id }]);
    setTimeout(() => setItems((x) => x.filter((i) => i.id !== id)), TOAST_MS);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed bottom-5 right-5 z-[80] flex w-[min(380px,calc(100vw-2.5rem))] flex-col gap-2">
        <AnimatePresence initial={false}>
          {items.map((t) => (
            <motion.div
              key={t.id}
              role="status"
              layout
              initial={{ opacity: 0, x: 60, scale: 0.9, filter: "blur(6px)" }}
              animate={{ opacity: 1, x: 0, scale: 1, filter: "blur(0px)" }}
              exit={{ opacity: 0, x: 60, scale: 0.9, filter: "blur(6px)" }}
              transition={{ type: "spring", stiffness: 300, damping: 26 }}
              className="pointer-events-auto relative overflow-hidden rounded-2xl border border-line-strong bg-p-950/95 p-4 pr-5 text-sm shadow-[0_24px_60px_rgba(0,0,0,0.6)] backdrop-blur-xl"
            >
              <div className="flex items-start gap-3">
                <span className={cx("grid h-7 w-7 shrink-0 place-items-center rounded-full", t.tone === "ok" ? "bg-p text-ink" : t.tone === "bad" ? "bg-white text-ink" : "bg-p/15 text-p")}>
                  {t.tone === "ok" ? <Check className="h-4 w-4" strokeWidth={3} /> : t.tone === "bad" ? <AlertTriangle className="h-3.5 w-3.5" strokeWidth={2.5} /> : <Info className="h-4 w-4" />}
                </span>
                <div className="min-w-0 pt-0.5 leading-relaxed text-white/90">
                  {t.text}
                  {t.link && (
                    <a className="ml-2 font-semibold text-p underline underline-offset-2" href={t.link.href} target="_blank" rel="noreferrer">
                      {t.link.label}
                    </a>
                  )}
                </div>
              </div>
              <motion.span className={cx("absolute bottom-0 left-0 h-0.5", t.tone === "bad" ? "bg-white" : "bg-p")} initial={{ width: "100%" }} animate={{ width: "0%" }} transition={{ duration: TOAST_MS / 1000, ease: "linear" }} />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastCtx.Provider>
  );
}
export const useToast = () => useContext(ToastCtx);

/** Wraps an async action with loading state + error toast. */
// ---------------- activity (what the app is doing right now) ----------------
type Activity = { id: number; label: string; detail?: string; since: number };
let acts: Activity[] = [];
let nextAct = 1;
const actListeners = new Set<() => void>();
const emitActs = () => actListeners.forEach((l) => l());

/** A tiny global store of running processes, shown by <BusyDock />. */
export const activity = {
  start(label: string, detail?: string) {
    const id = nextAct++;
    acts = [...acts, { id, label, detail, since: Date.now() }];
    emitActs();
    return id;
  },
  update(id: number, label: string, detail?: string) {
    acts = acts.map((a) => (a.id === id ? { ...a, label, detail } : a));
    emitActs();
  },
  end(id: number) {
    acts = acts.filter((a) => a.id !== id);
    emitActs();
  },
};
const EMPTY: Activity[] = [];
function useActivities() {
  return useSyncExternalStore(
    (l) => {
      actListeners.add(l);
      return () => actListeners.delete(l);
    },
    () => acts,
    () => EMPTY,
  );
}

/** Floating status for whatever is running: a top progress line plus a pill with the current step. */
export function BusyDock() {
  const list = useActivities();
  const cur = list[list.length - 1];
  const [now, setNow] = useState(0);
  useEffect(() => {
    if (!cur) return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [cur]);
  const secs = cur && now ? Math.max(0, Math.floor((now - cur.since) / 1000)) : 0;
  return (
    <AnimatePresence>
      {cur && (
        <>
          <motion.div key="bar" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="pointer-events-none fixed inset-x-0 top-0 z-[95] h-[3px] overflow-hidden bg-p/10">
            <span className="absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-p to-transparent shadow-[0_0_12px_rgba(171,159,242,0.9)] [animation:btn-sweep_1.3s_ease-in-out_infinite]" />
          </motion.div>
          <motion.div
            key="dock"
            role="status"
            aria-live="polite"
            initial={{ opacity: 0, y: -18, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.96 }}
            transition={{ type: "spring", stiffness: 380, damping: 30 }}
            className="pointer-events-none fixed inset-x-0 top-[124px] z-[95] mx-auto w-[min(92vw,420px)]"
          >
            <div className="relative flex items-center gap-3 overflow-hidden rounded-2xl border border-p/30 bg-p-950/95 px-4 py-3 shadow-[0_24px_70px_-10px_rgba(0,0,0,0.8),0_0_40px_-12px_rgba(171,159,242,0.5)] backdrop-blur-xl">
              <span className="relative grid h-9 w-9 shrink-0 place-items-center rounded-full bg-p/15 text-p">
                <span className="absolute inset-0 animate-ping rounded-full bg-p/20" />
                <Spinner className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <AnimatePresence mode="wait" initial={false}>
                  <motion.div key={cur.label} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.2 }} className="truncate text-sm font-semibold text-white">
                    {cur.label}
                  </motion.div>
                </AnimatePresence>
                <div className="truncate text-[11px] text-muted">{cur.detail ?? "Please keep this page open"}</div>
              </div>
              <span className="shrink-0 font-mono text-[11px] tabular-nums text-muted">{secs}s</span>
              <span aria-hidden className="absolute inset-x-0 bottom-0 h-[2px] overflow-hidden">
                <span className="absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-p to-transparent [animation:btn-sweep_1.3s_ease-in-out_infinite]" />
              </span>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

/** What the BusyDock says for the common action keys (a call can pass its own label instead). */
const ACTION_LABEL: Record<string, string> = {
  analyze: "AI is scoring your space…",
  check: "Checking your photo…",
  create: "Creating it on-chain…",
  list: "Listing your space…",
  save: "Creating your profile…",
  fund: "Sending test funds…",
  kyc: "Verifying your identity…",
  send: "Sending…",
  prep: "Building the legal pack…",
  pay: "Paying into escrow…",
  buy: "Buying units…",
  claim: "Claiming your income…",
  close: "Closing the offering…",
  refund: "Refunding…",
  approve: "Approving the creative…",
  reject: "Rejecting and refunding…",
  proof: "Checking your proof photo…",
  code: "Getting a capture code…",
  order: "Placing your order…",
  transfer: "Transferring units…",
  extend: "Extending the lease…",
  dispute: "Opening a dispute…",
  msg: "Opening the conversation…",
  s: "Saving…",
  up: "Uploading…",
};

/** Runs an async action with busy state, toasts, and a BusyDock entry while it runs. */
export function useAction() {
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const run = useCallback(
    async <T,>(key: string, fn: () => Promise<T>, ok?: string, label?: string): Promise<T | undefined> => {
      setBusy(key);
      const id = activity.start(label ?? ACTION_LABEL[key] ?? "Working on it…");
      try {
        const r = await fn();
        if (ok) toast({ text: ok, tone: "ok" });
        return r;
      } catch (e: any) {
        toast({ text: e?.message ?? String(e), tone: "bad" });
        return undefined;
      } finally {
        activity.end(id);
        setBusy(null);
      }
    },
    [toast],
  );
  return { busy, run };
}

export function TestnetBanner() {
  return (
    <div className="relative z-40 overflow-hidden border-b border-line bg-p-950 px-4 py-1.5 text-center text-[11px] font-medium text-white/55">
      <span className="mr-2 inline-flex items-center gap-1.5 rounded-full bg-p/15 px-2 py-0.5 font-bold text-p">
        <span className="h-1.5 w-1.5 rounded-full bg-p [animation:live-dot_1.6s_ease-in-out_infinite]" />
        Testnet
      </span>
      Sui testnet + Ethereum Sepolia (ENSv2) · test USDC only · legal documents and identity checks are mocked · not an offer of securities
    </div>
  );
}
