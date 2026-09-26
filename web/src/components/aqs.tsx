"use client";
import { motion, useInView } from "framer-motion";
import { Lightbulb, Minus, Plus } from "lucide-react";
import { useRef } from "react";
import { CRITERIA } from "@/lib/categories";
import { EASE, GradeBadge } from "./ui";

export function Radar({ sub }: { sub: Record<string, number> }) {
  const ref = useRef<SVGSVGElement>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  const keys = Object.keys(CRITERIA);
  const R = 88, cx = 120, cy = 120;
  const pt = (i: number, r: number) => {
    const a = (Math.PI * 2 * i) / keys.length - Math.PI / 2;
    return [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
  };
  const target = keys.map((k, i) => pt(i, (R * (sub[k] ?? 0)) / 4).join(",")).join(" ");
  const center = keys.map(() => `${cx},${cy}`).join(" ");
  return (
    <svg ref={ref} viewBox="0 0 240 240" className="h-60 w-60">
      <defs>
        <radialGradient id="radar-fill" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#ab9ff2" stopOpacity="0.35" />
        </radialGradient>
      </defs>
      {[1, 2, 3, 4].map((l) => (
        <motion.polygon
          key={l}
          points={keys.map((_, i) => pt(i, (R * l) / 4).join(",")).join(" ")}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeDasharray={l === 4 ? "0" : "2 4"}
          initial={{ opacity: 0, scale: 0.6 }}
          animate={inView ? { opacity: 1, scale: 1 } : {}}
          transition={{ delay: l * 0.06, duration: 0.6, ease: EASE }}
          style={{ originX: "50%", originY: "50%" }}
        />
      ))}
      {keys.map((_, i) => {
        const [x, y] = pt(i, R);
        return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="rgba(255,255,255,0.05)" />;
      })}
      <motion.polygon
        initial={{ points: center }}
        animate={inView ? { points: target } : {}}
        transition={{ duration: 1.4, delay: 0.3, ease: EASE }}
        fill="url(#radar-fill)"
        stroke="#ab9ff2"
        strokeWidth={2}
        strokeLinejoin="round"
        style={{ filter: "drop-shadow(0 0 12px rgba(171,159,242,0.55))" }}
      />
      {keys.map((k, i) => {
        const [x, y] = pt(i, (R * (sub[k] ?? 0)) / 4);
        return <motion.circle key={`d${k}`} cx={x} cy={y} r={3} fill="#fff" initial={{ opacity: 0, scale: 0 }} animate={inView ? { opacity: 1, scale: 1 } : {}} transition={{ delay: 1.2 + i * 0.04, type: "spring", stiffness: 500, damping: 18 }} />;
      })}
      {keys.map((k, i) => {
        const [x, y] = pt(i, R + 16);
        return (
          <text key={k} x={x} y={y} fontSize="9" fontWeight="700" textAnchor="middle" dominantBaseline="middle" fill="rgba(255,255,255,0.45)" fontFamily="var(--font-jetbrains), monospace">
            {k}
          </text>
        );
      })}
    </svg>
  );
}

function ConfidenceRing({ value }: { value: number }) {
  const r = 26, c = 2 * Math.PI * r;
  return (
    <div className="relative h-16 w-16">
      <svg viewBox="0 0 64 64" className="h-16 w-16 -rotate-90">
        <circle cx="32" cy="32" r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="5" />
        <motion.circle cx="32" cy="32" r={r} fill="none" stroke="#ab9ff2" strokeWidth="5" strokeLinecap="round" strokeDasharray={c} initial={{ strokeDashoffset: c }} whileInView={{ strokeDashoffset: c * (1 - value) }} viewport={{ once: true }} transition={{ duration: 1.4, ease: EASE }} />
      </svg>
      <span className="absolute inset-0 grid place-items-center text-xs font-extrabold">{Math.round(value * 100)}%</span>
    </div>
  );
}

export function AqsPanel({ r }: { r: { aqs: number; grade: number; confidence: number; subscores: Record<string, number>; strengths?: any[]; weaknesses?: any[]; tips?: string[]; surface?: string } }) {
  const conf = r.confidence >= 0.75 ? "High" : r.confidence >= 0.5 ? "Medium" : "Low";
  return (
    <div className="grid items-start gap-6 lg:grid-cols-[auto_1fr]">
      {/* stays in view while the breakdown scrolls, so there is no empty column under the radar */}
      <div className="flex flex-col items-center gap-4 lg:sticky lg:top-0">
        <div className="flex w-full items-center justify-between gap-4 rounded-2xl border border-line bg-white/[0.03] p-3">
          <div>
            <GradeBadge grade={r.grade} aqs={r.aqs} size="lg" />
            <div className="mt-2 text-[11px] font-bold uppercase tracking-wider text-muted">Confidence: {conf}</div>
          </div>
          <ConfidenceRing value={Math.max(0, Math.min(1, r.confidence))} />
        </div>
        <Radar sub={r.subscores ?? {}} />
      </div>
      <div className="space-y-5 text-sm">
        <div className="grid gap-x-6 gap-y-2.5 sm:grid-cols-2">
          {Object.entries(CRITERIA).map(([k, c], i) => {
            const v = r.subscores?.[k];
            return (
              <div key={k} className="group">
                <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                  <span className="text-white/70 transition-colors group-hover:text-white">
                    {c.name} <span className="text-[10px] text-faint">({c.weight})</span>
                  </span>
                  <span className="font-mono font-semibold">{v ?? "–"}/4</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                  <motion.div className="h-full rounded-full bg-gradient-to-r from-p-600 via-p to-white" initial={{ width: 0 }} whileInView={{ width: `${((v ?? 0) / 4) * 100}%` }} viewport={{ once: true }} transition={{ duration: 1.1, delay: 0.2 + i * 0.05, ease: EASE }} />
                </div>
              </div>
            );
          })}
        </div>
        {!!r.strengths?.length && (
          <div className="space-y-2">
            <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-p">Strengths</div>
            {r.strengths.map((s: any, i: number) => (
              <motion.div key={s.key} initial={{ opacity: 0, x: -10 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.06 }} className="flex gap-3 rounded-2xl border border-p/20 bg-p/[0.07] p-3">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-p text-ink"><Plus className="h-3.5 w-3.5" strokeWidth={3} /></span>
                <p className="text-white/70"><b className="text-white">{s.name}:</b> {s.evidence}</p>
              </motion.div>
            ))}
          </div>
        )}
        {!!r.weaknesses?.length && (
          <div className="space-y-2">
            <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted">Weaknesses</div>
            {r.weaknesses.map((s: any, i: number) => (
              <motion.div key={s.key} initial={{ opacity: 0, x: -10 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.06 }} className="flex gap-3 rounded-2xl border border-line bg-white/[0.03] p-3">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-white/10 text-white"><Minus className="h-3.5 w-3.5" strokeWidth={3} /></span>
                <p className="text-white/70"><b className="text-white">{s.name}:</b> {s.evidence}</p>
              </motion.div>
            ))}
          </div>
        )}
        {!!r.tips?.length && (
          <div className="space-y-2">
            <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted">Tips</div>
            {r.tips.map((t: string) => (
              <div key={t} className="flex gap-3 text-white/70">
                <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-p" /> {t}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
