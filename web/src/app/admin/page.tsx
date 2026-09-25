"use client";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "@/lib/client/session";
import { Badge, Button, Card, Empty, Input, Spinner, Stat, etherscanTx, suiscan, useAction, usdc } from "@/components/ui";
import { useState } from "react";

export default function Admin() {
  const { api, me } = useSession();
  const { data, refetch } = useQuery({ queryKey: ["admin"], queryFn: () => api<any>("/api/admin"), enabled: !!me?.user?.is_admin, refetchInterval: 15000 });
  const { busy, run } = useAction();
  const [addr, setAddr] = useState("");
  const [space, setSpace] = useState("");
  const [week, setWeek] = useState("");
  if (!me?.user?.is_admin) return <div className="p-10"><Empty title="Admins only" /></div>;
  if (!data) return <div className="grid place-items-center py-24"><Spinner /></div>;
  const act = (key: string, body: any, ok: string) => run(key, async () => { await api("/api/admin", { method: "POST", json: body }); refetch(); }, ok);
  const st = data.stats;
  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8">
      <h1 className="text-3xl font-semibold">Admin</h1>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-8">
        <Stat label="Users" value={st.users} />
        <Stat label="Objects" value={st.objects} />
        <Stat label="Live spaces" value={st.spaces} />
        <Stat label="Leases" value={st.leases} />
        <Stat label="Accepted analyses" value={st.analysesAccepted} />
        <Stat label="Rejected analyses" value={st.analysesRejected} sub={Object.entries(st.gateStats).map(([g, n]) => `${g}:${n}`).join(" ")} />
        <Stat label="x402" value={`${st.x402.fulfilled}/${st.x402.total}`} sub="fulfilled/total" />
        <Stat label="Failed jobs" value={st.jobsFailed} />
      </div>
      <Card>
        <h2 className="font-semibold">Platform</h2>
        <p className="mt-1 text-sm text-muted">Treasury {usdc(data.platform.usdc)} · {(Number(data.platform.sui) / 1e9).toFixed(3)} SUI · week = {data.platform.config.weekMs / 60000} min · demo mode {String(data.platform.config.demoMode)} · last indexed {data.lastProcessed?.processed_at ? new Date(data.lastProcessed.processed_at).toLocaleTimeString() : "—"}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Input className="w-40" placeholder="week ms" value={week} onChange={(e) => setWeek(e.target.value)} />
          <Button size="sm" variant="secondary" loading={busy === "w"} onClick={() => act("w", { action: "set_week_ms", weekMs: Number(week) }, "Week length set")}>Set week length</Button>
          <Button size="sm" variant="secondary" loading={busy === "dm"} onClick={() => act("dm", { action: "set_demo_mode", demo: !data.platform.config.demoMode }, "Demo mode toggled")}>Toggle demo mode</Button>
          <Button size="sm" variant="danger" loading={busy === "p"} onClick={() => act("p", { action: "set_paused", paused: true }, "Paused")}>Pause platform</Button>
          <Button size="sm" variant="secondary" loading={busy === "up"} onClick={() => act("up", { action: "set_paused", paused: false }, "Unpaused")}>Unpause</Button>
        </div>
      </Card>
      <Card>
        <h2 className="mb-3 font-semibold">Disputes</h2>
        {!data.disputes.length && <p className="text-sm text-muted">No open disputes.</p>}
        {data.disputes.map((l: any) => (
          <div key={l.escrow_id} className="flex flex-wrap items-center justify-between gap-2 border-b border-line py-2 text-sm last:border-0">
            <Link className="underline" href={`/leases/${l.escrow_id}`}>{l.spaces.label} · {l.brand} · {usdc(l.total_paid)}</Link>
            <span className="flex gap-2">
              <Button size="sm" variant="danger" loading={busy === `r${l.escrow_id}`} onClick={() => act(`r${l.escrow_id}`, { action: "resolve_dispute", escrowId: l.escrow_id, refund: true }, "Refunded")}>Refund advertiser</Button>
              <Button size="sm" variant="secondary" loading={busy === `c${l.escrow_id}`} onClick={() => act(`c${l.escrow_id}`, { action: "resolve_dispute", escrowId: l.escrow_id, refund: false }, "Resumed")}>Resume lease</Button>
            </span>
          </div>
        ))}
      </Card>
      <Card>
        <h2 className="mb-3 font-semibold">Reports</h2>
        {!data.reports.length && <p className="text-sm text-muted">Nothing reported.</p>}
        {data.reports.map((r: any) => (
          <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-line py-2 text-sm last:border-0">
            <span>{r.kind}: {r.message?.body ?? r.target_id}</span>
            <span className="flex gap-2">
              {r.kind === "message" && <Button size="sm" variant="danger" onClick={() => act(`m${r.id}`, { action: "remove_message", messageId: r.target_id, reportId: r.id }, "Removed")}>Remove message</Button>}
              <Button size="sm" variant="secondary" onClick={() => act(`d${r.id}`, { action: "dismiss_report", reportId: r.id }, "Dismissed")}>Dismiss</Button>
            </span>
          </div>
        ))}
      </Card>
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="space-y-2">
          <h2 className="font-semibold">Moderation</h2>
          <Input placeholder="Space id" value={space} onChange={(e) => setSpace(e.target.value)} />
          <div className="flex gap-2">
            <Button size="sm" variant="danger" loading={busy === "td"} onClick={() => act("td", { action: "takedown", spaceId: space }, "Taken down and refunded")}>Take down + refund</Button>
            <Button size="sm" variant="secondary" loading={busy === "rs"} onClick={() => act("rs", { action: "rescore", spaceId: space }, "Re-score queued")}>Re-apply score</Button>
          </div>
          <Input placeholder="Investor Sui address" value={addr} onChange={(e) => setAddr(e.target.value)} />
          <div className="flex gap-2">
            <Button size="sm" variant="danger" onClick={() => act("fz", { action: "freeze", address: addr, frozen: true }, "Frozen")}>Freeze</Button>
            <Button size="sm" variant="secondary" onClick={() => act("ufz", { action: "freeze", address: addr, frozen: false }, "Unfrozen")}>Unfreeze</Button>
          </div>
        </Card>
        <Card>
          <h2 className="mb-2 font-semibold">ENS relayer log</h2>
          <div className="max-h-72 space-y-1 overflow-y-auto text-xs">
            {data.ensWrites.map((w: any) => (
              <div key={w.id} className="flex justify-between gap-2">
                <span className="truncate font-mono">{w.action} {w.name}</span>
                <span className="flex shrink-0 gap-2">
                  {w.sui_digest && <a className="text-brand underline" href={suiscan("tx", w.sui_digest)} target="_blank" rel="noreferrer">sui</a>}
                  {w.eth_tx && <a className="text-brand underline" href={etherscanTx(w.eth_tx)} target="_blank" rel="noreferrer">eth</a>}
                </span>
              </div>
            ))}
          </div>
        </Card>
      </div>
      <Card>
        <h2 className="mb-2 font-semibold">Jobs</h2>
        <div className="space-y-1 text-xs">
          {data.recentJobs.map((j: any) => (
            <div key={j.id} className="flex items-center justify-between gap-2">
              <span className="font-mono">#{j.id} {j.kind}</span>
              <span className="truncate text-muted">{j.last_error}</span>
              <span className="flex items-center gap-2">
                <Badge tone={j.status === "done" ? "ok" : j.status === "failed" ? "bad" : "neutral"}>{j.status}</Badge>
                {j.status === "failed" && <button className="underline" onClick={() => act(`j${j.id}`, { action: "retry_job", jobId: j.id }, "Retrying")}>retry</button>}
              </span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
