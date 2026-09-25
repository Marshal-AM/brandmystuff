"use client";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Copy, ExternalLink, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { ENS_DEPLOYMENT } from "@/lib/deployment";
import { Badge, Card, suiscan } from "./ui";

function CopyBtn({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      onClick={(e) => {
        e.preventDefault();
        navigator.clipboard.writeText(text);
        setDone(true);
        setTimeout(() => setDone(false), 1200);
      }}
      className="grid h-6 w-6 shrink-0 place-items-center rounded-lg text-faint transition-colors hover:bg-white/10 hover:text-white"
      aria-label="Copy"
    >
      <AnimatePresence mode="popLayout" initial={false}>
        {done ? (
          <motion.span key="c" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
            <Check className="h-3.5 w-3.5 text-p" />
          </motion.span>
        ) : (
          <motion.span key="x" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
            <Copy className="h-3.5 w-3.5" />
          </motion.span>
        )}
      </AnimatePresence>
    </button>
  );
}

function Row({ label, value, href }: { label: string; value: string; href?: string }) {
  return (
    <div className="rounded-2xl border border-line bg-white/[0.02] p-3">
      <dt className="text-[10px] font-bold uppercase tracking-[0.12em] text-faint">{label}</dt>
      <dd className="mt-1 flex items-start gap-2">
        {href ? (
          <a className="min-w-0 flex-1 break-all font-mono text-xs text-white/85 transition-colors hover:text-p" href={href} target="_blank" rel="noreferrer">
            {value} <ExternalLink className="inline h-3 w-3 opacity-50" />
          </a>
        ) : (
          <span className="min-w-0 flex-1 break-all font-mono text-xs text-white/85">{value || "—"}</span>
        )}
        {value && <CopyBtn text={value} />}
      </dd>
    </div>
  );
}

export function VerifyPanel({ name, suiId, v, ens }: { name: string; suiId?: string | null; v: any; ens: any }) {
  return (
    <Card>
      <div className="flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 font-bold">
          <span className="grid h-8 w-8 place-items-center rounded-xl bg-p/15 text-p">
            <ShieldCheck className="h-4 w-4" />
          </span>
          Verify on-chain
        </h3>
        {v == null ? (
          <span className="shimmer h-6 w-24 rounded-full" />
        ) : v.verified ? (
          <motion.span initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 400, damping: 18 }}>
            <Badge tone="ok">ENS ↔ Sui verified</Badge>
          </motion.span>
        ) : (
          <Badge tone="warn">{ens?.status === "registered" ? "Mismatch" : "ENS pending"}</Badge>
        )}
      </div>
      <dl className="mt-4 space-y-2">
        <Row label={`ENS name · ${ens?.status ?? "pending"}`} value={name} href={`${ENS_DEPLOYMENT.appUrl}/${name}`} />
        {suiId && <Row label="Sui object" value={suiId} href={suiscan("object", suiId)} />}
        {v?.suiRef && <Row label="ENS record eth.brandmystuff.sui.object" value={v.suiRef} />}
        {v?.records && Object.entries(v.records).map(([k, val]) => <Row key={k} label={k} value={(val as string) || ""} />)}
      </dl>
    </Card>
  );
}
