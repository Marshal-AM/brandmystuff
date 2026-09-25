import { cx } from "./ui";

export function LogoMark({ size = 32, className }: { size?: number; className?: string }) {
  return (
    <span className={cx("relative grid shrink-0 place-items-center rounded-full bg-p", className)} style={{ width: size, height: size }}>
      <svg viewBox="0 0 24 24" width={size / 2} height={size / 2} aria-hidden>
        <rect x="3" y="5" width="18" height="13" rx="6.5" fill="#0a0a0b" />
        <rect x="8" y="9" width="2.6" height="5" rx="1.3" fill="#ab9ff2" />
        <rect x="13.4" y="9" width="2.6" height="5" rx="1.3" fill="#ab9ff2" />
      </svg>
    </span>
  );
}

export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={cx("flex items-center gap-2.5", className)}>
      <LogoMark />
      <span className="text-[15px] font-bold tracking-tight">brandmystuff</span>
    </span>
  );
}
