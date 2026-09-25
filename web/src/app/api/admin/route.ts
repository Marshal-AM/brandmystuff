import { z } from "zod";
import { Transaction } from "@mysten/sui/transactions";
import { handler, body } from "@/server/http";
import { requireAdmin } from "@/server/auth";
import { db, q, ok } from "@/server/db";
import { execute, balances } from "@/server/sui";
import { ingestDigest } from "@/server/indexer";
import { enqueue } from "@/server/notify";
import { SUI } from "@/lib/deployment";
import * as T from "@/lib/sui/tx";
import { configSeq } from "@/server/chainread";

export const GET = handler(async (req) => {
  await requireAdmin(req);
  const count = async (t: string, f?: (x: any) => any) => {
    let qy: any = db().from(t).select("*", { count: "exact", head: true });
    if (f) qy = f(qy);
    return (await qy).count ?? 0;
  };
  const [users, objects, spaces, leases, analysesAcc, analysesRej, disputes, reports, jobsFailed, x402ok, x402all, plat, cfg, recentJobs, ensWrites, gates] = await Promise.all([
    count("users"),
    count("objects"),
    count("spaces", (x) => x.eq("status", "available")),
    count("leases"),
    count("space_analyses", (x) => x.eq("decision", "ACCEPTED")),
    count("space_analyses", (x) => x.eq("decision", "REJECTED")),
    q(db().from("leases").select("*, spaces(label, ens_name)").eq("status", "disputed")),
    q(db().from("reports").select("*").eq("status", "open").order("created_at", { ascending: false })),
    count("jobs", (x) => x.eq("status", "failed")),
    count("x402_intents", (x) => x.eq("status", "fulfilled")),
    count("x402_intents"),
    balances(SUI.platformAddress),
    configSeq(),
    q(db().from("jobs").select("id, kind, status, attempts, last_error, updated_at").order("id", { ascending: false }).limit(30)),
    q(db().from("ens_writes").select("*").order("id", { ascending: false }).limit(30)),
    q(db().from("space_analyses").select("gate").eq("decision", "REJECTED")),
  ]);
  const gateStats: Record<string, number> = {};
  for (const g of gates) gateStats[g.gate ?? "?"] = (gateStats[g.gate ?? "?"] ?? 0) + 1;
  const messages = reports.filter((r: any) => r.kind === "message").length
    ? await q(db().from("messages").select("*").in("id", reports.filter((r: any) => r.kind === "message").map((r: any) => r.target_id)))
    : [];
  const lastProcessed = await q(db().from("chain_events").select("ts, processed_at").not("processed_at", "is", null).order("processed_at", { ascending: false }).limit(1).maybeSingle());
  return {
    stats: { users, objects, spaces, leases, analysesAccepted: analysesAcc, analysesRejected: analysesRej, gateStats, jobsFailed, x402: { fulfilled: x402ok, total: x402all } },
    platform: { sui: plat.sui.toString(), usdc: plat.usdc.toString(), config: cfg },
    disputes,
    reports: reports.map((r: any) => ({ ...r, message: messages.find((m: any) => m.id === r.target_id) ?? null })),
    recentJobs,
    ensWrites,
    lastProcessed,
  };
});

const actions = z.discriminatedUnion("action", [
  z.object({ action: z.literal("resolve_dispute"), escrowId: z.string(), refund: z.boolean() }),
  z.object({ action: z.literal("takedown"), spaceId: z.string() }),
  z.object({ action: z.literal("freeze"), address: z.string(), frozen: z.boolean() }),
  z.object({ action: z.literal("rescore"), spaceId: z.string() }),
  z.object({ action: z.literal("set_week_ms"), weekMs: z.number().int().min(60_000) }),
  z.object({ action: z.literal("set_paused"), paused: z.boolean() }),
  z.object({ action: z.literal("set_demo_mode"), demo: z.boolean() }),
  z.object({ action: z.literal("remove_message"), messageId: z.string(), reportId: z.string().optional() }),
  z.object({ action: z.literal("dismiss_report"), reportId: z.string() }),
  z.object({ action: z.literal("retry_job"), jobId: z.number() }),
]);

export const POST = handler(async (req) => {
  const admin = await requireAdmin(req);
  const a = await body(req, actions);
  let digest: string | null = null;
  const run = async (tx: Transaction) => {
    const r = await execute(tx);
    digest = r.digest;
    await ingestDigest(r.digest);
  };
  const cfgCall = (fn: string, args: (tx: Transaction) => any[]) => {
    const tx = new Transaction();
    tx.moveCall({ target: `${SUI.packageId}::admin::${fn}`, arguments: [tx.object(SUI.adminCapId), tx.object(SUI.configId), ...args(tx)] });
    return tx;
  };
  switch (a.action) {
    case "resolve_dispute": {
      const l = await q(db().from("leases").select("space_id").eq("escrow_id", a.escrowId).single());
      await run(T.resolveDispute({ escrowId: a.escrowId, spaceId: l.space_id, refund: a.refund }));
      break;
    }
    case "takedown": {
      await run(T.takedown({ spaceId: a.spaceId }));
      const active = await q(db().from("leases").select("escrow_id").eq("space_id", a.spaceId).in("status", ["pending_approval", "awaiting_install", "live", "disputed"]));
      for (const l of active) await run(T.adminRefund({ escrowId: l.escrow_id, spaceId: a.spaceId }));
      break;
    }
    case "freeze":
      await run(T.setKycFrozen({ who: a.address, frozen: a.frozen }));
      break;
    case "rescore":
      await ok(db().from("spaces").update({ status: "scoring" }).eq("id", a.spaceId).eq("status", "available"));
      await enqueue("apply_score", { spaceId: a.spaceId }, { dedupe: `rescore:${a.spaceId}:${Date.now()}` });
      break;
    case "set_week_ms":
      await run(cfgCall("set_week_ms", (tx) => [tx.pure.u64(a.weekMs)]));
      break;
    case "set_paused":
      await run(cfgCall("set_paused", (tx) => [tx.pure.bool(a.paused)]));
      break;
    case "set_demo_mode":
      await run(cfgCall("set_demo_mode", (tx) => [tx.pure.bool(a.demo)]));
      break;
    case "remove_message":
      await ok(db().from("messages").update({ removed: true }).eq("id", a.messageId));
      if (a.reportId) await ok(db().from("reports").update({ status: "resolved" }).eq("id", a.reportId));
      break;
    case "dismiss_report":
      await ok(db().from("reports").update({ status: "dismissed" }).eq("id", a.reportId));
      break;
    case "retry_job":
      await ok(db().from("jobs").update({ status: "queued", attempts: 0, run_after: new Date().toISOString() }).eq("id", a.jobId));
      break;
  }
  await ok(db().from("admin_audit").insert({ actor_user_id: admin.id, action: a.action, target: JSON.stringify(a), data: a as any, digest }));
  return { ok: true, digest };
});
