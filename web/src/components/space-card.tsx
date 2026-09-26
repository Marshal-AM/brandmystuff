"use client";
import Link from "next/link";
import { motion, useMotionTemplate, useMotionValue, useSpring, useTransform } from "framer-motion";
import { Camera, Ruler } from "lucide-react";
import type { MouseEvent } from "react";
import { Badge, GradeBadge, Img, usdc } from "./ui";
import { EnsName } from "./ens";

export function SpaceCard({ s }: { s: any }) {
  const week = Number(s.week_ms);
  const mx = useMotionValue(0.5);
  const my = useMotionValue(0.5);
  const rx = useSpring(useTransform(my, [0, 1], [6, -6]), { stiffness: 220, damping: 20 });
  const ry = useSpring(useTransform(mx, [0, 1], [-8, 8]), { stiffness: 220, damping: 20 });
  const gx = useTransform(mx, (v) => `${v * 100}%`);
  const gy = useTransform(my, (v) => `${v * 100}%`);
  const spotlight = useMotionTemplate`radial-gradient(420px circle at ${gx} ${gy}, rgba(171,159,242,0.22), transparent 55%)`;
  const onMove = (e: MouseEvent<HTMLAnchorElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    mx.set((e.clientX - r.left) / r.width);
    my.set((e.clientY - r.top) / r.height);
  };
  const reset = () => {
    mx.set(0.5);
    my.set(0.5);
  };
  return (
    <motion.div style={{ perspective: 1000 }} className="h-full">
      <motion.div style={{ rotateX: rx, rotateY: ry, transformStyle: "preserve-3d" }} className="h-full">
        <Link
          href={`/${s.ens_name}`}
          data-testid="space-card"
          onMouseMove={onMove}
          onMouseLeave={reset}
          className="group relative flex h-full flex-col overflow-hidden rounded-3xl border border-line bg-gradient-to-b from-white/[0.05] to-white/[0.015] transition-[border-color,box-shadow] duration-500 hover:border-p/50 hover:shadow-[0_30px_80px_-30px_rgba(171,159,242,0.45)]"
        >
          <motion.div aria-hidden className="pointer-events-none absolute inset-0 z-10 opacity-0 transition-opacity duration-500 group-hover:opacity-100" style={{ background: spotlight }} />
          <div className="relative aspect-[4/3] overflow-hidden">
            <Img blob={s.closeup_blob_id} alt={s.label} className="h-full w-full transition-transform duration-[900ms] ease-out group-hover:scale-110" />
            <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/20 to-transparent opacity-90" />
            <div className="absolute left-3 top-3 flex gap-1.5">
              <GradeBadge grade={s.grade} aqs={s.aqs} size="sm" />
              {(s.slot === "sponsored" || s.sponsored) && <Badge tone="sponsored">Sponsored</Badge>}
            </div>
            {s.offering_id && (
              <div className="absolute right-3 top-3">
                <Badge tone="brand" className="bg-ink/75 backdrop-blur-md">Tokenised</Badge>
              </div>
            )}
            <div className="absolute inset-x-3 bottom-3 flex items-end justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-ink/60 px-2.5 py-1 text-[11px] font-semibold text-white/85 backdrop-blur-md">
                <Ruler className="h-3 w-3 text-p" />
                {s.width_mm / 10}×{s.height_mm / 10} cm · {s.placement}
              </span>
              <motion.span className="rounded-2xl bg-p px-3 py-1.5 text-right text-ink shadow-[0_8px_24px_-6px_rgba(171,159,242,0.7)] transition-transform duration-500 group-hover:-translate-y-1" style={{ transform: "translateZ(30px)" }}>
                <span className="block text-sm font-extrabold leading-tight">{usdc(s.price_per_week)}</span>
                <span className="block text-[10px] font-semibold leading-tight opacity-70">per {week < 86400_000 ? `${week / 60000}-min week` : "week"}</span>
              </motion.span>
            </div>
          </div>
          <div className="relative flex flex-1 flex-col gap-1 p-4">
            <div className="truncate text-[15px] font-bold tracking-tight">{s.label}</div>
            <div className="truncate text-sm text-muted">
              {s.object?.title}
              {s.object?.city ? ` · ${s.object.city}` : ""}
            </div>
            <div className="mt-auto flex items-center justify-between gap-3 pt-3 text-[11px] text-faint">
              <span className="min-w-0"><EnsName name={s.ens_name} kind="space" size="xs" /></span>
              {s.accepted_proofs > 0 && (
                <span className="flex shrink-0 items-center gap-1 text-p">
                  <Camera className="h-3 w-3" /> {s.accepted_proofs}
                </span>
              )}
            </div>
          </div>
        </Link>
      </motion.div>
    </motion.div>
  );
}
