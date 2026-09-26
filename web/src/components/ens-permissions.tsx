"use client";
/**
 * "Permissions" tab of the on-chain panel: who may write each record of a name, proven live from
 * ENSv2 Enhanced Access Control roles, and the history of grants and revocations.
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { Bot, Check, FlaskConical, KeyRound, Lock, PenLine, X } from "lucide-react";
import { ENS_DEPLOYMENT } from "@/lib/deployment";
import { useSession } from "@/lib/client/session";
import { useEnsSigner } from "@/lib/client/ens-signer";
import { Button, Input, Select, cx, shortAddr, useToast } from "./ui";
import { EnsHint, EnsWrites, prettyKey } from "./ens";

type Perms = {
  name: string;
  kind?: string;
  status: string;
  delegated: boolean;
  resolver?: string;
  admin?: string;
  manager?: string | null;
  managerRole?: "owner" | "advertiser" | "agent";
  resolverStatus?: string | null;
  keys?: { key: string; writer: string; set: boolean }[];
  token?: { owner: string; roles: string[]; expiry: number; registry: string; transferable: boolean };
  onchain?: { manager: string; sampleManaged: string | null; canManaged: boolean; sampleAttested: string; canAttested: boolean; probe?: { key: string; ok: boolean; error?: string }[] } | null;
  history?: any[];
};

const ROLE_COPY = { owner: "owner", advertiser: "advertiser", agent: "agent key" } as const;
const addrUrl = (a: string) => `${ENS_DEPLOYMENT.explorer}/address/${a}`;

function Label({ children }: { children: React.ReactNode }) {
  return <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-faint">{children}</div>;
}

function KeyChip({ k, tone, dim }: { k: string; tone: "platform" | "self"; dim?: boolean }) {
  return (
    <span className={cx("inline-flex items-center rounded-full px-2 py-0.5 font-mono text-[10.5px]", tone === "platform" ? "bg-white/[0.06] text-white/75" : "bg-p/15 text-p", dim && "opacity-50")} title={k}>
      {prettyKey(k)}
    </span>
  );
}

function Proof({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 text-xs">
      <span className={cx("mt-px grid h-4 w-4 shrink-0 place-items-center rounded-full", ok ? "bg-p text-ink" : "bg-white/10 text-white/70")}>{ok ? <Check className="h-2.5 w-2.5" strokeWidth={3} /> : <X className="h-2.5 w-2.5" strokeWidth={3} />}</span>
      <span className="min-w-0 text-white/80">{children}</span>
    </div>
  );
}

/** Lets the manager (owner or advertiser) sign an edit of one of the keys they control. */
function SelfEdit({ name, keys, onDone }: { name: string; keys: string[]; onDone: () => void }) {
  const signer = useEnsSigner();
  const toast = useToast();
  const [key, setKey] = useState(keys.includes("description") ? "description" : keys[0]);
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  if (!signer.ready) return null;
  return (
    <div className="rounded-2xl border border-p/25 bg-p/[0.05] p-3">
      <Label>Edit as {shortAddr(signer.manager!)}</Label>
      <div className="mt-2 flex flex-col gap-2 sm:flex-row">
        <Select value={key} onChange={(e) => setKey(e.target.value)} className="sm:w-40">
          {keys.map((k) => <option key={k} value={k}>{prettyKey(k)}</option>)}
        </Select>
        <Input value={value} onChange={(e) => setValue(e.target.value)} placeholder="New value" className="min-w-0 flex-1" />
        <Button
          size="sm"
          loading={busy}
          disabled={!value.trim()}
          onClick={async () => {
            setBusy(true);
            try {
              await signer.setTexts([{ name, key, value: value.trim() }]);
              toast({ text: `${prettyKey(key)} updated, signed by your wallet`, tone: "ok" });
              setValue("");
              onDone();
            } catch (e: any) {
              toast({ text: e?.shortMessage ?? e?.message ?? "Signing failed", tone: "bad" });
            } finally {
              setBusy(false);
            }
          }}
        >
          <PenLine className="h-3.5 w-3.5" /> Sign
        </Button>
      </div>
    </div>
  );
}

export function EnsPermissions({ name }: { name: string }) {
  const { me } = useSession();
  const [probe, setProbe] = useState(false);
  const { data: p, refetch, isFetching } = useQuery<Perms>({
    queryKey: ["ens-perms", name, probe],
    queryFn: () => fetch(`/api/names/${encodeURIComponent(name)}/permissions${probe ? "?probe=1" : ""}`).then((r) => r.json()),
    staleTime: 30_000,
  });
  if (!p) return <div className="space-y-2">{[0, 1, 2].map((i) => <div key={i} className="shimmer h-12 rounded-2xl" />)}</div>;
  if (p.status !== "registered") return <p className="text-sm text-muted">Permissions appear once the name is live on ENS.</p>;

  const self = (p.keys ?? []).filter((k) => k.writer !== "platform");
  const platform = (p.keys ?? []).filter((k) => k.writer === "platform");
  const role = ROLE_COPY[p.managerRole ?? "owner"];
  const RoleIcon = p.managerRole === "agent" ? Bot : PenLine;
  const mine = !!p.manager && me?.ensDelegation?.manager?.toLowerCase() === p.manager.toLowerCase() && me?.ensDelegation?.address?.toLowerCase() === p.resolver?.toLowerCase();

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className={cx("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold", p.delegated ? "bg-p/15 text-p ring-1 ring-inset ring-p/25" : "bg-white/[0.06] text-white/70")}>
          <KeyRound className="h-3 w-3" /> {p.delegated ? (p.resolverStatus === "revoked" ? `${role} rights revoked` : `Split rights · ${role} + platform`) : "Platform-managed"}
        </span>
        <a href={addrUrl(p.resolver!)} target="_blank" rel="noreferrer" className="font-mono text-[10.5px] text-faint hover:text-p">
          resolver {shortAddr(p.resolver!)}
        </a>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <div className="rounded-2xl border border-line bg-white/[0.02] p-3">
          <div className="flex items-center gap-1.5"><Lock className="h-3 w-3 text-faint" /><Label>Attested by brandmystuff</Label></div>
          <div className="mt-2 flex flex-wrap gap-1">{platform.length ? platform.map((k) => <KeyChip key={k.key} k={k.key} tone="platform" />) : <span className="text-xs text-muted">—</span>}</div>
        </div>
        <div className={cx("rounded-2xl border p-3", p.delegated ? "border-p/25 bg-p/[0.04]" : "border-dashed border-line bg-transparent")}>
          <div className="flex items-center gap-1.5"><RoleIcon className="h-3 w-3 text-p" /><Label>Set by {role}</Label></div>
          {p.delegated ? (
            <>
              <div className="mt-2 flex flex-wrap gap-1">{self.map((k) => <KeyChip key={k.key} k={k.key} tone="self" dim={!k.set} />)}</div>
              {p.manager && <a href={addrUrl(p.manager)} target="_blank" rel="noreferrer" className="mt-2 block font-mono text-[10.5px] text-muted hover:text-p">signer {shortAddr(p.manager)}</a>}
            </>
          ) : (
            <p className="mt-2 text-[11px] leading-relaxed text-muted">Nothing yet. Owners who sign in with an embedded wallet get their own resolver and edit their profile records themselves.</p>
          )}
        </div>
      </div>

      {p.token && (
        <div className="rounded-2xl border border-line bg-white/[0.02] p-3">
          <Label>Name token</Label>
          <div className="mt-1.5 grid gap-1 text-xs text-white/80 sm:grid-cols-2">
            <span>Held by <a href={addrUrl(p.token.owner)} target="_blank" rel="noreferrer" className="font-mono hover:text-p">{p.token.owner?.toLowerCase() === p.admin?.toLowerCase() ? "brandmystuff" : shortAddr(p.token.owner)}</a></span>
            <span>Expires {p.token.expiry ? new Date(p.token.expiry * 1000).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "—"}</span>
            <span className="sm:col-span-2 text-muted">
              Holder roles: <span className="font-mono text-white/80">{p.token.roles.length ? p.token.roles.join(", ") : "none"}</span>
              {!p.token.roles.includes("SET_RESOLVER") && " · can't repoint the resolver"} · non-transferable · revocable by brandmystuff
            </span>
          </div>
        </div>
      )}

      {p.onchain && (
        <div className="rounded-2xl border border-line bg-white/[0.02] p-3">
          <div className="flex items-center justify-between gap-2">
            <Label>Checked live on Sepolia</Label>
            <button onClick={() => (probe ? refetch() : setProbe(true))} disabled={isFetching} className="inline-flex items-center gap-1 text-[11px] font-semibold text-p hover:underline disabled:opacity-50">
              <FlaskConical className="h-3 w-3" /> {isFetching ? "Simulating…" : "Simulate writes"}
            </button>
          </div>
          <div className="mt-2 space-y-1.5">
            {p.onchain.sampleManaged && <Proof ok={p.onchain.canManaged}>{role} may write <span className="font-mono text-p">{prettyKey(p.onchain.sampleManaged)}</span></Proof>}
            <Proof ok={!p.onchain.canAttested}>{role} can&apos;t write <span className="font-mono text-white">{prettyKey(p.onchain.sampleAttested)}</span></Proof>
          </div>
          <AnimatePresence>
            {p.onchain.probe && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="mt-2 overflow-hidden border-t border-line pt-2 font-mono text-[10.5px] text-muted">
                {p.onchain.probe.map((r) => (
                  <div key={r.key} className="flex flex-wrap gap-x-2">
                    <span>eth_call setText(&quot;{prettyKey(r.key)}&quot;) from {shortAddr(p.onchain!.manager)}</span>
                    <span className={r.ok ? "text-p" : "text-white/80"}>→ {r.ok ? "allowed" : r.error}</span>
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {mine && p.resolverStatus === "active" && self.length > 0 && <SelfEdit name={p.name} keys={self.map((k) => k.key)} onDone={() => refetch()} />}

      {!!p.history?.length && (
        <details className="group rounded-2xl border border-line bg-white/[0.02] p-3 [&_summary::-webkit-details-marker]:hidden">
          <summary className="flex cursor-pointer list-none items-center justify-between text-xs font-semibold text-white/80">
            Permission history <span className="text-[10px] text-faint group-open:hidden">{p.history.length} events</span>
          </summary>
          <div className="mt-3"><EnsWrites writes={p.history} /></div>
        </details>
      )}

      <EnsHint>
        ENSv2 roles are scoped per record key on a resolver, so each {p.managerRole === "agent" ? "agent" : "account"} gets its own resolver. brandmystuff keeps admin and the attested keys; the {role} signs only its own.
      </EnsHint>
    </div>
  );
}
