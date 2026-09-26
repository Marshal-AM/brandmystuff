"use client";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Copy, ExternalLink, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { ENS_DEPLOYMENT } from "@/lib/deployment";
import { Badge, Card, Tabs, suiscan } from "./ui";
import { EnsHint, EnsName, EnsRecords, EnsTree, EnsWrites, ensAppUrl } from "./ens";

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

type Tab = "name" | "records" | "activity";

export function VerifyPanel({ name, suiId, v, ens, info }: { name: string; suiId?: string | null; v: any; ens: any; info?: any }) {
  const [tab, setTab] = useState<Tab>("name");
  const status = info?.status ?? ens?.status ?? "pending";
  const expiry = info?.expiry ? new Date(info.expiry * 1000) : null;
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
          <Badge tone="warn">{status === "registered" ? "Mismatch" : "ENS pending"}</Badge>
        )}
      </div>
      <div className="mt-3">
        <EnsName name={name} status={status} kind={info?.kind ?? ens?.kind} size="md" full />
      </div>
      <div className="mt-4">
        <Tabs<Tab>
          tabs={[
            { id: "name", label: "Name" },
            { id: "records", label: <>Records{info?.records?.texts ? <span className="ml-1 text-[10px] opacity-60">{Object.keys(info.records.texts).length}</span> : null}</> },
            { id: "activity", label: <>Activity{info?.writes?.length ? <span className="ml-1 text-[10px] opacity-60">{info.writes.length}</span> : null}</> },
          ]}
          value={tab}
          onChange={setTab}
        />
      </div>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.25 }} className="mt-4">
          {tab === "name" && (
            <div className="space-y-4">
              {info?.chain && <EnsTree chain={info.chain} current={name} />}
              <dl className="grid grid-cols-2 gap-2">
                <div className="rounded-2xl border border-line bg-white/[0.02] p-3">
                  <dt className="text-[10px] font-bold uppercase tracking-[0.12em] text-faint">Network</dt>
                  <dd className="mt-1 text-xs text-white/85">Sepolia · ENSv2</dd>
                </div>
                <div className="rounded-2xl border border-line bg-white/[0.02] p-3">
                  <dt className="text-[10px] font-bold uppercase tracking-[0.12em] text-faint">Expires</dt>
                  <dd className="mt-1 text-xs text-white/85">{expiry ? expiry.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "—"}</dd>
                </div>
              </dl>
              <dl className="space-y-2">
                {suiId && <Row label="Sui object" value={suiId} href={suiscan("object", suiId)} />}
                {v?.suiRef && <Row label="ENS record eth.brandmystuff.sui.object" value={v.suiRef} />}
                <Row label="Resolver" value={info?.resolver ?? ENS_DEPLOYMENT.platformResolver} href={`${ENS_DEPLOYMENT.explorer}/address/${info?.resolver ?? ENS_DEPLOYMENT.platformResolver}`} />
                {info?.namehash && <Row label="Namehash" value={info.namehash} />}
              </dl>
              <EnsHint>The name&apos;s <span className="font-mono text-white/70">sui.object</span> record must equal the Sui object id, and the Sui object stores this name. Both sides are read live, so the check doesn&apos;t rely on brandmystuff.</EnsHint>
            </div>
          )}
          {tab === "records" && <EnsRecords records={info?.records} live={v?.records} />}
          {tab === "activity" && <EnsWrites writes={info?.writes ?? []} />}
        </motion.div>
      </AnimatePresence>
      <a href={ensAppUrl(name)} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-p hover:underline">
        View in the ENS app <ExternalLink className="h-3 w-3" />
      </a>
    </Card>
  );
}
