"use client";
import { CRITERIA } from "@/lib/categories";
import { GradeBadge } from "./ui";

export function Radar({ sub }: { sub: Record<string, number> }) {
  const keys = Object.keys(CRITERIA);
  const R = 90, cx = 110, cy = 110;
  const pt = (i: number, r: number) => {
    const a = (Math.PI * 2 * i) / keys.length - Math.PI / 2;
    return [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
  };
  const poly = keys.map((k, i) => pt(i, (R * (sub[k] ?? 0)) / 4).join(",")).join(" ");
  return (
    <svg viewBox="0 0 220 220" className="h-56 w-56">
      {[1, 2, 3, 4].map((l) => (
        <polygon key={l} points={keys.map((_, i) => pt(i, (R * l) / 4).join(",")).join(" ")} fill="none" stroke="#e7e4ee" />
      ))}
      <polygon points={poly} fill="rgba(109,40,217,0.18)" stroke="#6d28d9" strokeWidth={2} />
      {keys.map((k, i) => {
        const [x, y] = pt(i, R + 12);
        return (
          <text key={k} x={x} y={y} fontSize="9" textAnchor="middle" dominantBaseline="middle" fill="#6b6878">
            {k}
          </text>
        );
      })}
    </svg>
  );
}

export function AqsPanel({ r }: { r: { aqs: number; grade: number; confidence: number; subscores: Record<string, number>; strengths?: any[]; weaknesses?: any[]; tips?: string[]; surface?: string } }) {
  const conf = r.confidence >= 0.75 ? "High" : r.confidence >= 0.5 ? "Medium" : "Low";
  return (
    <div className="grid gap-4 md:grid-cols-[auto_1fr]">
      <div className="flex flex-col items-center">
        <GradeBadge grade={r.grade} aqs={r.aqs} size="lg" />
        <div className="mt-1 text-xs text-muted">Confidence: {conf}</div>
        <Radar sub={r.subscores ?? {}} />
      </div>
      <div className="space-y-3 text-sm">
        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
          {Object.entries(CRITERIA).map(([k, c]) => (
            <div key={k} className="flex items-center justify-between gap-2">
              <span className="text-muted">
                {c.name} <span className="text-[10px]">({c.weight})</span>
              </span>
              <span className="font-mono">{r.subscores?.[k] ?? "–"}/4</span>
            </div>
          ))}
        </div>
        {!!r.strengths?.length && (
          <div>
            <div className="font-medium text-emerald-700">Strengths</div>
            <ul className="list-disc pl-5 text-muted">
              {r.strengths.map((s: any) => (
                <li key={s.key}>
                  <b className="text-foreground">{s.name}:</b> {s.evidence}
                </li>
              ))}
            </ul>
          </div>
        )}
        {!!r.weaknesses?.length && (
          <div>
            <div className="font-medium text-amber-700">Weaknesses</div>
            <ul className="list-disc pl-5 text-muted">
              {r.weaknesses.map((s: any) => (
                <li key={s.key}>
                  <b className="text-foreground">{s.name}:</b> {s.evidence}
                </li>
              ))}
            </ul>
          </div>
        )}
        {!!r.tips?.length && (
          <div>
            <div className="font-medium">Tips</div>
            <ul className="list-disc pl-5 text-muted">
              {r.tips.map((t: string) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
