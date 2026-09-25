"use client";
import Link from "next/link";
import { createContext, useCallback, useContext, useEffect, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { blobUrl, SUI, ENS_DEPLOYMENT } from "@/lib/deployment";
import { GRADE_LABEL } from "@/lib/categories";

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

export function Button({ variant = "primary", size = "md", loading, className, children, ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" | "danger"; size?: "sm" | "md" | "lg"; loading?: boolean }) {
  return (
    <button
      {...p}
      disabled={p.disabled || loading}
      className={cx(
        "inline-flex items-center justify-center gap-2 rounded-xl font-medium transition disabled:opacity-50 disabled:cursor-not-allowed",
        size === "sm" && "px-3 py-1.5 text-sm",
        size === "md" && "px-4 py-2.5 text-sm",
        size === "lg" && "px-6 py-3 text-base",
        variant === "primary" && "bg-brand text-white hover:bg-violet-800 shadow-sm",
        variant === "secondary" && "bg-surface text-foreground border border-line hover:border-violet-300",
        variant === "ghost" && "text-muted hover:text-foreground hover:bg-black/5",
        variant === "danger" && "bg-bad text-white hover:bg-red-700",
        className,
      )}
    >
      {loading && <Spinner className="h-4 w-4" />}
      {children}
    </button>
  );
}

export const LinkButton = ({ href, children, variant = "primary", className }: { href: string; children: ReactNode; variant?: "primary" | "secondary"; className?: string }) => (
  <Link
    href={href}
    className={cx(
      "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition",
      variant === "primary" ? "bg-brand text-white hover:bg-violet-800" : "bg-surface border border-line hover:border-violet-300",
      className,
    )}
  >
    {children}
  </Link>
);

export function Spinner({ className }: { className?: string }) {
  return <span className={cx("inline-block animate-spin rounded-full border-2 border-current border-t-transparent", className ?? "h-5 w-5")} />;
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx("rounded-2xl border border-line bg-surface p-5 shadow-[0_1px_2px_rgba(20,10,40,0.04)]", className)}>{children}</div>;
}

export function Field({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium">{label}</span>
      {children}
      {hint && <span className="block text-xs text-muted">{hint}</span>}
    </label>
  );
}

const inputCls = "w-full rounded-xl border border-line bg-white px-3 py-2.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-violet-100";
export const Input = (p: InputHTMLAttributes<HTMLInputElement>) => <input {...p} className={cx(inputCls, p.className)} />;
export const Textarea = (p: TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea {...p} className={cx(inputCls, p.className)} />;
export const Select = (p: SelectHTMLAttributes<HTMLSelectElement>) => <select {...p} className={cx(inputCls, p.className)} />;

export function Badge({ children, tone = "neutral", className }: { children: ReactNode; tone?: "neutral" | "brand" | "ok" | "warn" | "bad" | "sponsored"; className?: string }) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
        tone === "neutral" && "bg-black/5 text-muted",
        tone === "brand" && "bg-violet-100 text-violet-800",
        tone === "ok" && "bg-emerald-100 text-emerald-800",
        tone === "warn" && "bg-amber-100 text-amber-800",
        tone === "bad" && "bg-red-100 text-red-800",
        tone === "sponsored" && "bg-amber-400 text-amber-950",
        className,
      )}
    >
      {children}
    </span>
  );
}

export function GradeBadge({ grade, aqs, size = "md" }: { grade: number; aqs?: number; size?: "sm" | "md" | "lg" }) {
  const g = GRADE_LABEL[grade] ?? "—";
  const color = grade >= 4 ? "from-emerald-500 to-teal-500" : grade === 3 ? "from-violet-600 to-fuchsia-500" : grade === 2 ? "from-sky-500 to-indigo-500" : "from-slate-400 to-slate-500";
  return (
    <span className={cx("inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-br px-2.5 py-1 font-semibold text-white shadow-sm", color, size === "lg" ? "text-lg" : size === "sm" ? "text-xs" : "text-sm")}>
      {g}
      {aqs != null && <span className="font-normal opacity-90">· {aqs}</span>}
    </span>
  );
}

export const usdc = (atomic: string | number | bigint | null | undefined, digits = 2) => {
  const n = Number(atomic ?? 0) / 1e6;
  return `${n.toLocaleString(undefined, { minimumFractionDigits: n < 1 && n > 0 ? Math.min(6, digits + 2) : digits, maximumFractionDigits: n < 1 && n > 0 ? 6 : digits })} USDC`;
};

export const shortAddr = (a?: string | null) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "");
export const suiscan = (kind: "tx" | "object" | "account", id: string) => `${SUI.explorer}/${kind}/${id}`;
export const etherscanTx = (h: string) => `${ENS_DEPLOYMENT.explorer}/tx/${h}`;
export const img = blobUrl;

export function Img({ blob, alt, className }: { blob?: string | null; alt: string; className?: string }) {
  if (!blob) return <div className={cx("bg-gradient-to-br from-violet-100 to-amber-50", className)} />;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={blobUrl(blob)} alt={alt} className={cx("object-cover", className)} loading="lazy" />;
}

export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 backdrop-blur-sm sm:items-center sm:p-6" onClick={onClose}>
      <div className={cx("max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-surface p-6 shadow-2xl sm:rounded-3xl", wide ? "sm:max-w-3xl" : "sm:max-w-lg")} onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button onClick={onClose} className="rounded-full p-1 text-muted hover:bg-black/5" aria-label="Close">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-line bg-surface/60 p-10 text-center">
      <p className="font-medium">{title}</p>
      {children && <div className="mt-2 text-sm text-muted">{children}</div>}
    </div>
  );
}

export function Stat({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <div className="text-xs uppercase tracking-wide text-muted">{label}</div>
      <div className="mt-1 text-xl font-semibold">{value}</div>
      {sub && <div className="text-xs text-muted">{sub}</div>}
    </div>
  );
}

export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: { id: T; label: ReactNode }[]; value: T; onChange: (t: T) => void }) {
  return (
    <div className="flex gap-1 rounded-xl bg-black/5 p-1">
      {tabs.map((t) => (
        <button key={t.id} onClick={() => onChange(t.id)} className={cx("rounded-lg px-3 py-1.5 text-sm font-medium transition", value === t.id ? "bg-surface shadow-sm" : "text-muted hover:text-foreground")}>
          {t.label}
        </button>
      ))}
    </div>
  );
}

// ---------------- toasts ----------------
type Toast = { id: number; text: string; tone: "ok" | "bad" | "info"; link?: { href: string; label: string } };
const ToastCtx = createContext<(t: Omit<Toast, "id">) => void>(() => {});
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const push = useCallback((t: Omit<Toast, "id">) => {
    const id = Date.now() + Math.random();
    setItems((x) => [...x, { ...t, id }]);
    setTimeout(() => setItems((x) => x.filter((i) => i.id !== id)), 6000);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="fixed bottom-4 right-4 z-[60] flex max-w-sm flex-col gap-2">
        {items.map((t) => (
          <div key={t.id} role="status" className={cx("rounded-xl px-4 py-3 text-sm shadow-lg", t.tone === "ok" ? "bg-emerald-600 text-white" : t.tone === "bad" ? "bg-red-600 text-white" : "bg-foreground text-white")}>
            {t.text}
            {t.link && (
              <a className="ml-2 underline" href={t.link.href} target="_blank" rel="noreferrer">
                {t.link.label}
              </a>
            )}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
export const useToast = () => useContext(ToastCtx);

/** Wraps an async action with loading state + error toast. */
export function useAction() {
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const run = useCallback(
    async <T,>(key: string, fn: () => Promise<T>, ok?: string): Promise<T | undefined> => {
      setBusy(key);
      try {
        const r = await fn();
        if (ok) toast({ text: ok, tone: "ok" });
        return r;
      } catch (e: any) {
        toast({ text: e?.message ?? String(e), tone: "bad" });
        return undefined;
      } finally {
        setBusy(null);
      }
    },
    [toast],
  );
  return { busy, run };
}

/** Photo picker with a camera-first option; reports whether the camera was used. */
export function PhotoInput({ onChange, label = "Photo", preview, testId }: { onChange: (f: File, source: "camera" | "upload") => void; label?: string; preview?: string | null; testId?: string }) {
  return (
    <div className="space-y-2">
      <span className="text-sm font-medium">{label}</span>
      <div className="flex items-center gap-3">
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="preview" className="h-24 w-24 rounded-xl object-cover" />
        ) : (
          <div className="grid h-24 w-24 place-items-center rounded-xl border border-dashed border-line text-2xl text-muted">📷</div>
        )}
        <div className="flex flex-col gap-2">
          <label className="cursor-pointer rounded-xl bg-brand px-3 py-2 text-center text-sm font-medium text-white hover:bg-violet-800">
            Take photo
            <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => e.target.files?.[0] && onChange(e.target.files[0], "camera")} />
          </label>
          <label className="cursor-pointer rounded-xl border border-line bg-white px-3 py-2 text-center text-sm font-medium hover:border-violet-300">
            Upload
            <input data-testid={testId} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && onChange(e.target.files[0], "upload")} />
          </label>
        </div>
      </div>
    </div>
  );
}

export function TestnetBanner() {
  return (
    <div className="bg-amber-100 px-4 py-1.5 text-center text-xs font-medium text-amber-900">
      Testnet demo · Sui testnet + Ethereum Sepolia (ENSv2) · test USDC only · legal documents and identity checks are mocked · not an offer of securities
    </div>
  );
}
