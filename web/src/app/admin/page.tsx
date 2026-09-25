"use client";
import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Activity, Flag, Gavel, RotateCcw, ScrollText, Server, ShieldBan } from "lucide-react";
import { useSession } from "@/lib/client/session";
import { Badge, Button, Card, EASE, Empty, Input, PageHeader, PageLoader, Stat, cx, etherscanTx, suiscan, useAction, usdc } from "@/components/ui";

function Head({ icon: Icon, children, count }: { icon: any; children: React.ReactNode; count?: number }) {
  return (
    <div className="mb-4 flex items-center gap-3">
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-p/15 text-p"><Icon className="h-4 w-4" /></span>
      <h2 className="flex-1 text-lg font-bold">{children}</h2>
      {count !== undefined && <Badge tone={count ? "brand" : "neutral"}>{count}</Badge>}
    </div>
  );
}

const Row = ({ children, i }: { children: React.ReactNode; i: number }) => (
  <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04, duration: 0.4, ease: EASE }} className="flex flex-wrap items-center justify-between gap-2 border-b border-line py-3 text-sm last:border-0">
    {children}
  </motion.div>
);

export default function Admin() {
  const { api, me } = useSession();
  const { data, refetch } = useQuery({ queryKey: ["admin"], queryFn: () => api<any>("/api/admin"), enabled: !!me?.user?.is_admin, refetchInterval: 15000 });
  const { busy, run } = useAction();
  const [addr, setAddr] = useState("");
  const [space, setSpace] = useState("");
  const [week, setWeek] = useState("");
  if (!me?.user?.is_admin) return <div className="mx-auto max-w-xl p-10"><Empty title="Admins only" /></div>;
  if (!data) return <PageLoader label="Loading admin" />;
  const act = (key: string, body: any, ok: string) => run(key, async () => { await api("/api/admin", { method: "POST", json: body }); refetch(); }, ok);
  const st = data.stats;
  const cfg = data.platform.config;
  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 sm:px-6">
      <PageHeader kicker="Operator" title="Admin console" sub={`Last indexed ${data.lastProcessed?.processed_at ? new Date(data.lastProcessed.processed_at).toLocaleTimeString() : "—"} · refreshes every 15s`} />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat delay={0} label="Users" value={st.users} />
        <Stat delay={0.04} label="Objects" value={st.objects} />
        <Stat delay={0.08} label="Live spaces" value={st.spaces} />
        <Stat delay={0.12} label="Leases" value={st.leases} />
        <Stat delay={0.16} label="Accepted analyses" value={st.analysesAccepted} />
        <Stat delay={0.2} label="Rejected analyses" value={st.analysesRejected} sub={Object.entries(st.gateStats).map(([g, n]) => `${g}:${n}`).join(" ")} />
        <Stat delay={0.24} label="x402" value={`${st.x402.fulfilled}/${st.x402.total}`} sub="fulfilled/total" />
        <Stat delay={0.28} label="Failed jobs" value={st.jobsFailed} />
      </div>

      <Card className="relative overflow-hidden">
        <div aria-hidden className="absolute -right-20 -top-20 h-56 w-56 rounded-full bg-p/15 blur-3xl" />
        <div className="relative">
          <Head icon={Server}>Platform</Head>
          <div className="grid gap-3 sm:grid-cols-4">
            {[
              ["Treasury", usdc(data.platform.usdc)],
              ["Gas", `${(Number(data.platform.sui) / 1e9).toFixed(3)} SUI`],
              ["Week length", `${cfg.weekMs / 60000} min`],
              ["Demo mode", String(cfg.demoMode)],
            ].map(([k, v]) => (
              <div key={k} className="rounded-2xl bg-white/[0.04] p-3">
                <div className="text-[11px] uppercase tracking-wider text-muted">{k}</div>
                <div className="mt-0.5 font-mono font-semibold">{v}</div>
              </div>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Input className="w-40" placeholder="week ms" value={week} onChange={(e) => setWeek(e.target.value)} />
            <Button size="sm" variant="secondary" loading={busy === "w"} onClick={() => act("w", { action: "set_week_ms", weekMs: Number(week) }, "Week length set")}>Set week length</Button>
            <Button size="sm" variant="secondary" loading={busy === "dm"} onClick={() => act("dm", { action: "set_demo_mode", demo: !cfg.demoMode }, "Demo mode toggled")}>Toggle demo mode</Button>
            <Button size="sm" variant="danger" loading={busy === "p"} onClick={() => act("p", { action: "set_paused", paused: true }, "Paused")}>Pause platform</Button>
            <Button size="sm" variant="secondary" loading={busy === "up"} onClick={() => act("up", { action: "set_paused", paused: false }, "Unpaused")}>Unpause</Button>
          </div>
        </div>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card delay={0.05}>
          <Head icon={Gavel} count={data.disputes.length}>Disputes</Head>
          {!data.disputes.length && <p className="text-sm text-muted">No open disputes.</p>}
          {data.disputes.map((l: any, i: number) => (
            <Row key={l.escrow_id} i={i}>
              <Link className="font-semibold hover:text-p" href={`/leases/${l.escrow_id}`}>{l.spaces.label} · {l.brand} · {usdc(l.total_paid)}</Link>
              <span className="flex gap-2">
                <Button size="sm" variant="danger" loading={busy === `r${l.escrow_id}`} onClick={() => act(`r${l.escrow_id}`, { action: "resolve_dispute", escrowId: l.escrow_id, refund: true }, "Refunded")}>Refund advertiser</Button>
                <Button size="sm" variant="secondary" loading={busy === `c${l.escrow_id}`} onClick={() => act(`c${l.escrow_id}`, { action: "resolve_dispute", escrowId: l.escrow_id, refund: false }, "Resumed")}>Resume lease</Button>
              </span>
            </Row>
          ))}
        </Card>
        <Card delay={0.1}>
          <Head icon={Flag} count={data.reports.length}>Reports</Head>
          {!data.reports.length && <p className="text-sm text-muted">Nothing reported.</p>}
          {data.reports.map((r: any, i: number) => (
            <Row key={r.id} i={i}>
              <span className="min-w-0 flex-1 truncate"><Badge>{r.kind}</Badge> <span className="ml-1 text-white/80">{r.message?.body ?? r.target_id}</span></span>
              <span className="flex gap-2">
                {r.kind === "message" && <Button size="sm" variant="danger" onClick={() => act(`m${r.id}`, { action: "remove_message", messageId: r.target_id, reportId: r.id }, "Removed")}>Remove message</Button>}
                <Button size="sm" variant="secondary" onClick={() => act(`d${r.id}`, { action: "dismiss_report", reportId: r.id }, "Dismissed")}>Dismiss</Button>
              </span>
            </Row>
          ))}
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card delay={0.05} className="space-y-3">
          <Head icon={ShieldBan}>Moderation</Head>
          <Input placeholder="Space id" value={space} onChange={(e) => setSpace(e.target.value)} className="font-mono" />
          <div className="flex gap-2">
            <Button size="sm" variant="danger" loading={busy === "td"} onClick={() => act("td", { action: "takedown", spaceId: space }, "Taken down and refunded")}>Take down + refund</Button>
            <Button size="sm" variant="secondary" loading={busy === "rs"} onClick={() => act("rs", { action: "rescore", spaceId: space }, "Re-score queued")}>Re-apply score</Button>
          </div>
          <Input placeholder="Investor Sui address" value={addr} onChange={(e) => setAddr(e.target.value)} className="font-mono" />
          <div className="flex gap-2">
            <Button size="sm" variant="danger" onClick={() => act("fz", { action: "freeze", address: addr, frozen: true }, "Frozen")}>Freeze</Button>
            <Button size="sm" variant="secondary" onClick={() => act("ufz", { action: "freeze", address: addr, frozen: false }, "Unfrozen")}>Unfreeze</Button>
          </div>
        </Card>
        <Card delay={0.1}>
          <Head icon={ScrollText}>ENS relayer log</Head>
          <div className="max-h-72 space-y-1 overflow-y-auto pr-1 text-xs">
            {data.ensWrites.map((w: any) => (
              <div key={w.id} className="flex justify-between gap-2 rounded-lg px-2 py-1.5 hover:bg-white/[0.04]">
                <span className="truncate font-mono text-white/80"><span className="text-p">{w.action}</span> {w.name}</span>
                <span className="flex shrink-0 gap-2">
                  {w.sui_digest && <a className="font-semibold text-p hover:underline" href={suiscan("tx", w.sui_digest)} target="_blank" rel="noreferrer">sui</a>}
                  {w.eth_tx && <a className="font-semibold text-p hover:underline" href={etherscanTx(w.eth_tx)} target="_blank" rel="noreferrer">eth</a>}
                </span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card delay={0.05}>
        <Head icon={Activity}>Jobs</Head>
        <div className="space-y-1 text-xs">
          {data.recentJobs.map((j: any) => (
            <div key={j.id} className={cx("flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 hover:bg-white/[0.04]", j.status === "failed" && "bg-white/[0.03]")}>
              <span className="shrink-0 font-mono">#{j.id} {j.kind}</span>
              <span className="min-w-0 flex-1 truncate text-muted">{j.last_error}</span>
              <span className="flex shrink-0 items-center gap-2">
                <Badge tone={j.status === "done" ? "ok" : j.status === "failed" ? "bad" : "neutral"}>{j.status}</Badge>
                {j.status === "failed" && (
                  <button className="inline-flex items-center gap-1 font-semibold text-p hover:underline" onClick={() => act(`j${j.id}`, { action: "retry_job", jobId: j.id }, "Retrying")}>
                    <RotateCcw className="h-3 w-3" /> retry
                  </button>
                )}
              </span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
