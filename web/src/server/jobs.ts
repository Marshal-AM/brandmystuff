/** Background job runner (ENS relayer + operator tasks) and the deadline scheduler. */
import { db, q, ok } from "./db";
import {
  ensureAccountName,
  ensureObjectName,
  ensureSpaceName,
  labelState,
  leaseName,
  registerLeaseName,
  renewLabel,
  reserveLabel,
  spaceRecords,
  unregisterLabel,
  writeRecords,
} from "./ens/names";
import { applySpaceScore, refreshObjectScore } from "./listing";
import { execute } from "./sui";
import { ingestDigest } from "./indexer";
import * as T from "@/lib/sui/tx";

type Job = { id: number; kind: string; payload: any; attempts: number };

const handlers: Record<string, (p: any) => Promise<void>> = {
  ens_account: async (p) => ensureAccountName(p.userId),
  ens_object: async (p) => ensureObjectName(p.objectId, p.digest ?? null),
  ens_space: async (p) => {
    const s = await q(db().from("spaces").select("*").eq("id", p.spaceId).single());
    const reg = await q(db().from("ens_names").select("status").eq("name", s.ens_name).maybeSingle());
    if (reg?.status === "registered") await writeRecords(s.ens_name, spaceRecords(s), p.digest ?? null);
    else await ensureSpaceName(p.spaceId, p.digest ?? null);
  },
  ens_space_records: async (p) => {
    const s = await q(db().from("spaces").select("*").eq("id", p.spaceId).single());
    const reg = await q(db().from("ens_names").select("status").eq("name", s.ens_name).maybeSingle());
    if (reg?.status !== "registered") throw new Error("space name not registered yet");
    await writeRecords(s.ens_name, spaceRecords(s), p.digest ?? null);
  },
  ens_lease_reserve: async (p) => {
    const l = await q(db().from("leases").select("*").eq("escrow_id", p.escrowId).single());
    if (l.status !== "pending_approval") return;
    const name = await leaseName(p.escrowId);
    const s = await q(db().from("spaces").select("ens_name").eq("id", l.space_id).single());
    const reg = await q(db().from("ens_names").select("status").eq("name", s.ens_name).maybeSingle());
    if (reg?.status !== "registered") throw new Error("space name not registered yet");
    await reserveLabel(name, Math.floor(Date.now() / 1000) + 30 * 86400, p.digest ?? null);
  },
  ens_lease_register: async (p) => {
    const l = await q(db().from("leases").select("status").eq("escrow_id", p.escrowId).single());
    if (!["awaiting_install", "live", "disputed", "completed"].includes(l.status)) return;
    await registerLeaseName(p.escrowId, p.digest ?? null);
  },
  ens_lease_state: async (p) => {
    const l = await q(db().from("leases").select("status").eq("escrow_id", p.escrowId).single());
    const name = await leaseName(p.escrowId);
    const reg = await q(db().from("ens_names").select("status").eq("name", name).maybeSingle());
    if (reg?.status !== "registered") throw new Error("lease name not registered yet");
    const { count } = await db().from("proofs").select("*", { count: "exact", head: true }).eq("escrow_id", p.escrowId).eq("status", "accepted");
    const state = { awaiting_install: "awaiting-install", live: "live", disputed: "disputed", completed: "completed", refunded: "refunded", cancelled: "cancelled" }[l.status as string] ?? l.status;
    await writeRecords(name, { texts: { "eth.brandmystuff.attested.state": state, "eth.brandmystuff.attested.proofs": String(count ?? 0) } }, p.digest ?? null);
  },
  ens_lease_unregister: async (p) => {
    const name = await leaseName(p.escrowId);
    const st = await labelState(name).catch(() => null);
    if (!st || st.status === 0) return;
    await unregisterLabel(name, p.digest ?? null);
  },
  ens_lease_renew: async (p) => {
    const name = await leaseName(p.escrowId);
    await renewLabel(name, Math.floor(Number(p.endMs) / 1000), p.digest ?? null);
  },
  ens_verified: async (p) => {
    const u = await q(db().from("users").select("ens_name, ens_status").eq("id", p.userId).single());
    if (!u.ens_name || u.ens_status !== "registered") throw new Error("account name not registered yet");
    await writeRecords(u.ens_name, { texts: { "eth.brandmystuff.attested.verified": p.frozen ? "frozen" : "true" } });
  },
  ens_sponsored: async (p) => {
    const o = await q(db().from("objects").select("ens_name, sponsored_until").eq("id", p.objectId).single());
    const reg = await q(db().from("ens_names").select("status").eq("name", o.ens_name).maybeSingle());
    if (reg?.status !== "registered") throw new Error("object name not registered yet");
    const active = o.sponsored_until && new Date(o.sponsored_until).getTime() > Date.now();
    await writeRecords(o.ens_name, {
      texts: {
        "eth.brandmystuff.attested.sponsored": active ? "true" : "false",
        "eth.brandmystuff.attested.sponsored-until": o.sponsored_until ? String(Math.floor(new Date(o.sponsored_until).getTime() / 1000)) : "0",
      },
    }, p.digest ?? null);
  },
  apply_score: async (p) => {
    await applySpaceScore(p.spaceId);
  },
  object_score: async (p) => refreshObjectScore(p.objectId),
};

export async function runJobs(limit = 20) {
  const jobs = await q(
    db().from("jobs").select("*").eq("status", "queued").lte("run_after", new Date().toISOString()).order("id").limit(limit),
  );
  for (const j of jobs as Job[]) {
    const { data: claimed } = await db().from("jobs").update({ status: "running", updated_at: new Date().toISOString() }).eq("id", j.id).eq("status", "queued").select("id");
    if (!claimed?.length) continue;
    try {
      const h = handlers[j.kind];
      if (!h) throw new Error(`unknown job ${j.kind}`);
      await h(j.payload);
      await ok(db().from("jobs").update({ status: "done", updated_at: new Date().toISOString() }).eq("id", j.id));
    } catch (e: any) {
      if (/single JSON object/.test(String(e?.message)) && j.attempts >= 2) {
        // The record this job refers to no longer exists — nothing to do.
        await ok(db().from("jobs").update({ status: "skipped", last_error: "record not found", updated_at: new Date().toISOString() }).eq("id", j.id));
        continue;
      }
      const attempts = j.attempts + 1;
      const delay = Math.min(600_000, 5_000 * 2 ** Math.min(attempts, 7));
      await ok(db()
        .from("jobs")
        .update({
          status: attempts >= 15 ? "failed" : "queued",
          attempts,
          last_error: String(e?.message ?? e).slice(0, 800),
          run_after: new Date(Date.now() + delay).toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", j.id));
      console.warn(`[jobs] ${j.kind}#${j.id} failed (attempt ${attempts}):`, String(e?.message ?? e).slice(0, 200));
    }
  }
}

/** Enforces on-chain deadlines anyone may trigger (the platform does it automatically). */
export async function runScheduler() {
  const now = Date.now();
  const leases = await q(db().from("leases").select("*").in("status", ["pending_approval", "awaiting_install", "live"]));
  for (const l of leases) {
    const start = Number(l.start_ms), week = Number(l.week_ms);
    const cure = Math.floor((week * 3) / 7);
    try {
      if (l.status === "pending_approval" && Number(l.approve_deadline_ms) + 60_000 < now) {
        const r = await execute(T.expireUnapproved({ escrowId: l.escrow_id, spaceId: l.space_id, calendarId: (await calendarOf(l.space_id))! }));
        await ingestDigest(r.digest);
      } else if (l.status === "awaiting_install" && start + week + 30_000 < now) {
        const r = await execute(T.refundMissed({ escrowId: l.escrow_id, spaceId: l.space_id, period: 0 }));
        await ingestDigest(r.digest);
      } else if (l.status === "live") {
        const done = new Set((await q(db().from("tranches").select("period").eq("escrow_id", l.escrow_id))).map((t: any) => t.period));
        for (let k = 1; k <= l.weeks; k++) {
          if (done.has(k)) continue;
          if (start + k * week + cure + 30_000 < now) {
            const r = await execute(T.refundMissed({ escrowId: l.escrow_id, spaceId: l.space_id, period: k }));
            await ingestDigest(r.digest);
          }
        }
      }
    } catch (e: any) {
      console.warn("[scheduler] lease", l.escrow_id, String(e?.message ?? e).slice(0, 200));
    }
  }
  const offerings = await q(db().from("offerings").select("id, space_id, sale_end_ms").eq("status", "open"));
  for (const o of offerings) {
    if (Number(o.sale_end_ms) + 10_000 < now) {
      try {
        const r = await execute(T.closeOffering({ offeringId: o.id, spaceId: o.space_id }));
        await ingestDigest(r.digest);
      } catch (e: any) {
        console.warn("[scheduler] close offering", o.id, String(e?.message ?? e).slice(0, 200));
      }
    }
  }
  const expired = await q(db().from("objects").select("id").not("sponsor_tier", "is", null).lt("sponsored_until", new Date().toISOString()));
  for (const o of expired) {
    await ok(db().from("objects").update({ sponsor_tier: null }).eq("id", o.id));
    await ok(db().from("jobs").insert({ kind: "ens_sponsored", payload: { objectId: o.id } }));
  }
}

async function calendarOf(spaceId: string) {
  const s = await q(db().from("spaces").select("calendar_id").eq("id", spaceId).single());
  return s.calendar_id as string;
}
