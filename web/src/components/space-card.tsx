"use client";
import Link from "next/link";
import { categoryByKey } from "@/lib/categories";
import { Badge, GradeBadge, Img, usdc } from "./ui";

export function SpaceCard({ s }: { s: any }) {
  const cat = categoryByKey(s.object?.category ?? "other");
  const week = Number(s.week_ms);
  return (
    <Link href={`/${s.ens_name}`} data-testid="space-card" className="group overflow-hidden rounded-2xl border border-line bg-surface transition hover:-translate-y-0.5 hover:shadow-lg">
      <div className="relative aspect-[4/3] overflow-hidden bg-black/5">
        <Img blob={s.closeup_blob_id} alt={s.label} className="h-full w-full transition duration-500 group-hover:scale-105" />
        <div className="absolute left-3 top-3 flex gap-1.5">
          <GradeBadge grade={s.grade} aqs={s.aqs} size="sm" />
          {(s.slot === "sponsored" || s.sponsored) && <Badge tone="sponsored">Sponsored</Badge>}
        </div>
        {s.offering_id && (
          <div className="absolute right-3 top-3">
            <Badge tone="brand">Tokenised</Badge>
          </div>
        )}
        <div className="absolute bottom-3 left-3 rounded-lg bg-black/60 px-2 py-1 text-xs text-white backdrop-blur">
          {s.width_mm / 10}×{s.height_mm / 10} cm · {s.placement}
        </div>
      </div>
      <div className="space-y-1 p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="truncate font-semibold">{s.label}</div>
            <div className="truncate text-sm text-muted">
              {cat.emoji} {s.object?.title}
              {s.object?.city ? ` · ${s.object.city}` : ""}
            </div>
          </div>
          <div className="text-right">
            <div className="font-semibold">{usdc(s.price_per_week)}</div>
            <div className="text-xs text-muted">per {week < 86400_000 ? `${week / 60000}-min demo week` : "week"}</div>
          </div>
        </div>
        <div className="flex items-center justify-between pt-1 text-xs text-muted">
          <span className="truncate font-mono">{s.ens_name}</span>
          {s.accepted_proofs > 0 && <span className="shrink-0">✓ {s.accepted_proofs} proofs</span>}
        </div>
      </div>
    </Link>
  );
}
