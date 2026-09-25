/**
 * Sui event indexer: polls package events (and ingests specific digests on demand), stores them in
 * chain_events and projects them into the Supabase read model, activity feed, notifications and ENS jobs.
 */
import { SUI } from "@/lib/deployment";
import { MODULES } from "@/lib/sui/tx";
import { PLACEMENTS } from "@/lib/categories";
import { db, q, ok } from "./db";
import { activity, enqueue, notifyAddress } from "./notify";
import { sui } from "./sui";

type Ev = { digest: string; seq: number; type: string; module: string; json: any; ts?: string | null; checkpoint?: string | null };

const b64hex = (v: any) => (typeof v === "string" && !v.startsWith("0x") ? "0x" + Buffer.from(v, "base64").toString("hex") : v);
const n = (v: any) => (v == null ? 0 : Number(v));
const now = () => new Date().toISOString();

// ------------------------------------------------------------------ ingestion

async function store(evs: Ev[]) {
  if (!evs.length) return;
  const rows = evs.map((e) => ({
    digest: e.digest,
    event_seq: e.seq,
    event_type: e.type,
    module: e.module,
    json: e.json,
    checkpoint: e.checkpoint ? Number(e.checkpoint) : null,
    ts: e.ts ?? null,
  }));
  await ok(db().from("chain_events").upsert(rows, { onConflict: "digest,event_seq", ignoreDuplicates: true }));
}

/** Ingest a specific transaction immediately (called by the API right after a user tx). */
export async function ingestDigest(digest: string) {
  const c = sui();
  await c.waitForTransaction({ digest });
  const r: any = await c.getTransaction({ digest, include: { events: true } });
  const t = r.Transaction ?? r.FailedTransaction;
  const evs: Ev[] = (t?.events ?? [])
    .map((e: any, i: number) => ({ digest, seq: i, type: e.eventType, module: e.module, json: e.json }))
    .filter((e: Ev) => e.type.startsWith(SUI.packageId));
  await store(evs);
  await processPending();
  return evs;
}

/** One polling pass over every module's events since the stored cursor. */
export async function pollOnce() {
  const c = sui();
  for (const mod of MODULES) {
    const name = `events:${mod}`;
    const cur = await q(db().from("cursors").select("cursor").eq("name", name).maybeSingle());
    let after: any = cur?.cursor ?? undefined;
    for (let page = 0; page < 10; page++) {
      const res: any = await c.listEvents({
        filter: { emitModule: `${SUI.packageId}::${mod}` },
        ...(after ? { after } : {}),
        order: "ascending",
        limit: 50,
      } as any);
      const evs: Ev[] = (res.events ?? []).map((e: any) => ({
        digest: e.transactionDigest,
        seq: Number(e.eventIndex ?? 0),
        type: e.eventType,
        module: mod,
        json: e.json,
        checkpoint: e.checkpoint != null ? String(e.checkpoint) : null,
      }));
      await store(evs);
      if (res.endCursor) {
        after = res.endCursor;
        await ok(db().from("cursors").upsert({ name, cursor: after, updated_at: now() }));
      }
      if (!res.hasNextPage || !evs.length) break;
    }
  }
  await processPending();
}

let processing: Promise<void> | null = null;
export function processPending() {
  if (!processing) {
    processing = (async () => {
      try {
        for (;;) {
          const rows = await q(
            db()
              .from("chain_events")
              .select("*")
              .is("processed_at", null)
              .order("checkpoint", { ascending: true, nullsFirst: false })
              .order("digest")
              .order("event_seq")
              .limit(100),
          );
          if (!rows.length) break;
          for (const r of rows) {
            let error: string | null = null;
            try {
              await project({ digest: r.digest, seq: r.event_seq, type: r.event_type, module: r.module, json: r.json });
            } catch (e: any) {
              error = String(e?.message ?? e).slice(0, 500);
              console.error("[indexer] project failed", r.event_type, error);
            }
            await ok(db().from("chain_events").update({ processed_at: now(), error }).eq("digest", r.digest).eq("event_seq", r.event_seq));
          }
        }
      } finally {
        processing = null;
      }
    })();
  }
  return processing;
}

// ------------------------------------------------------------------ projection

const leaseStatus = ["pending_approval", "awaiting_install", "live", "completed", "disputed", "cancelled", "refunded"];

async function userIdByAddress(addr: string): Promise<string | null> {
  const u = await q(db().from("users").select("id").eq("sui_address", addr).maybeSingle());
  if (u) return u.id;
  const w = await q(db().from("linked_wallets").select("user_id").eq("address", addr).maybeSingle());
  return w?.user_id ?? null;
}

async function project(e: Ev) {
  const j = e.json;
  const name = e.type.split("::").pop()!;
  const d = e.digest;
  switch (name) {
    // ---------------- profile ----------------
    case "ProfileCreated": {
      const uid = await userIdByAddress(j.owner);
      if (uid) {
        await ok(db().from("users").update({ profile_id: j.profile_id }).eq("id", uid));
        await enqueue("ens_account", { userId: uid }, { dedupe: `ens_account:${uid}:${d}` });
      }
      return;
    }
    // ---------------- asset ----------------
    case "ObjectCreated": {
      const uid = await userIdByAddress(j.owner);
      const { data: existing } = await db().from("objects").select("id").eq("id", j.object_id).maybeSingle();
      if (!existing) {
        await ok(db().from("objects").insert({
          id: j.object_id,
          owner_user_id: uid,
          owner_address: j.owner,
          category: "other",
          category_code: n(j.category),
          title: j.title,
          city: j.city,
          ens_name: j.ens_name,
          hero_blob_id: j.hero_blob_id,
          created_digest: d,
        }));
      }
      await activity({ kind: "object_listed", object_id: j.object_id, actor: j.owner, sui_digest: d, data: { title: j.title } });
      await enqueue("ens_object", { objectId: j.object_id, digest: d }, { dedupe: `ens_object:${j.object_id}` });
      return;
    }
    case "SpaceAdded": {
      await ok(db().from("spaces").upsert(
        {
          id: j.space_id,
          object_id: j.object_id,
          calendar_id: j.calendar_id,
          owner_address: j.owner,
          label: j.label,
          ens_name: j.ens_name,
          width_mm: n(j.width_mm),
          height_mm: n(j.height_mm),
          placement: PLACEMENTS[n(j.placement)] ?? "other",
          closeup_blob_id: j.closeup_blob_id,
          price_per_week: String(j.price_per_week),
          week_ms: String(j.week_ms),
        },
        { onConflict: "id", ignoreDuplicates: true },
      ));
      // Link the pre-chain AI analysis and schedule the score write if the API hasn't done it.
      await ok(db()
        .from("space_analyses")
        .update({ space_id: j.space_id })
        .eq("object_id", j.object_id)
        .eq("closeup_blob_id", j.closeup_blob_id)
        .eq("decision", "ACCEPTED")
        .is("space_id", null));
      await enqueue("apply_score", { spaceId: j.space_id }, { dedupe: `apply_score:${j.space_id}`, runAfter: new Date(Date.now() + 20_000) });
      return;
    }
    case "SpaceScored": {
      const a = await q(db().from("space_analyses").select("*").eq("space_id", j.space_id).order("created_at", { ascending: false }).limit(1).maybeSingle());
      const r: any = a?.result ?? {};
      await ok(db()
        .from("spaces")
        .update({
          aqs: n(j.aqs),
          grade: n(j.grade),
          confidence_bps: n(j.confidence_bps),
          rank_score: n(j.rank_score_x100) / 100,
          rubric_version: j.rubric_version,
          report_blob_id: j.score_report_blob_id,
          report_hash: b64hex(j.score_report_hash),
          subscores: r.subscores ?? null,
          strengths: r.strengths ?? null,
          weaknesses: r.weaknesses ?? null,
          tips: r.tips ?? null,
          material: a?.input?.material ?? null,
          status: "available",
        })
        .eq("id", j.space_id));
      const s = await q(db().from("spaces").select("object_id, aqs").eq("id", j.space_id).single());
      await activity({ kind: "space_scored", space_id: j.space_id, object_id: s.object_id, sui_digest: d, data: { aqs: n(j.aqs), grade: n(j.grade) } });
      await enqueue("object_score", { objectId: s.object_id }, { dedupe: `object_score:${s.object_id}:${d}` });
      await enqueue("ens_space", { spaceId: j.space_id, digest: d }, { dedupe: `ens_space:${j.space_id}:${d}` });
      return;
    }
    case "ObjectScored": {
      await ok(db().from("objects").update({ object_aqs: n(j.aqs), object_grade: n(j.grade) }).eq("id", j.object_id));
      return;
    }
    case "PriceChanged": {
      await ok(db().from("spaces").update({ price_per_week: String(j.price_per_week) }).eq("id", j.space_id));
      await activity({ kind: "price_changed", space_id: j.space_id, amount: j.price_per_week, sui_digest: d });
      await enqueue("ens_space_records", { spaceId: j.space_id, digest: d }, { dedupe: `ens_space_records:${j.space_id}:${d}` });
      return;
    }
    case "SpaceStatusChanged": {
      const st = ["scoring", "available", "paused", "retired", "removed"][n(j.status)] ?? "available";
      await ok(db().from("spaces").update({ status: st }).eq("id", j.space_id));
      await activity({ kind: `space_${st}`, space_id: j.space_id, sui_digest: d });
      if (st !== "available" || true) await enqueue("ens_space_records", { spaceId: j.space_id, digest: d }, { dedupe: `ens_space_records:${j.space_id}:${d}` });
      return;
    }
    // ---------------- lease ----------------
    case "LeaseBooked": {
      const sp = await q(db().from("spaces").select("object_id").eq("id", j.space_id).single());
      const [ownerUid, advUid] = await Promise.all([userIdByAddress(j.owner), userIdByAddress(j.advertiser)]);
      await ok(db().from("leases").upsert(
        {
          escrow_id: j.escrow_id,
          lease_id: j.lease_id,
          seq: String(j.seq),
          ens_label: j.ens_label,
          space_id: j.space_id,
          advertiser: j.advertiser,
          owner: j.owner,
          start_ms: String(j.start_ms),
          week_ms: String(j.week_ms),
          weeks: n(j.weeks),
          total_paid: String(j.total_paid),
          creative_blob_id: j.creative_blob_id,
          creative_hash: b64hex(j.creative_hash),
          landing_url: j.landing_url,
          brand: j.brand,
          via_operator: !!j.via_operator,
          approve_deadline_ms: String(Math.floor(Date.now() + (n(j.week_ms) * 5) / 7)),
          booked_digest: d,
        },
        { onConflict: "escrow_id", ignoreDuplicates: true },
      ));
      await ok(db().from("spaces").update({ active_leases: await activeCount(j.space_id) }).eq("id", j.space_id));
      if (ownerUid && advUid) {
        const { data: conv } = await db().from("conversations").select("id").eq("space_id", j.space_id).eq("advertiser_user_id", advUid).maybeSingle();
        if (conv) await ok(db().from("conversations").update({ escrow_id: j.escrow_id }).eq("id", conv.id));
        else await ok(db().from("conversations").insert({ space_id: j.space_id, advertiser_user_id: advUid, owner_user_id: ownerUid, escrow_id: j.escrow_id }));
      }
      await activity({ kind: "lease_booked", space_id: j.space_id, object_id: sp.object_id, actor: j.advertiser, amount: j.total_paid, sui_digest: d, data: { brand: j.brand, weeks: n(j.weeks) } });
      await notifyAddress(j.owner, { kind: "lease_request", title: `New lease request from ${j.brand}`, body: `${n(j.weeks)} week(s), ${n(j.total_paid) / 1e6} USDC in escrow. Approve within the deadline.`, link: `/leases/${j.escrow_id}` });
      await enqueue("ens_lease_reserve", { escrowId: j.escrow_id, digest: d }, { dedupe: `ens_lease_reserve:${j.escrow_id}` });
      return;
    }
    case "CreativeApproved": {
      await setLease(j.escrow_id, { status: "awaiting_install" });
      await activity({ kind: "creative_approved", space_id: j.space_id, sui_digest: d });
      const l = await leaseRow(j.escrow_id);
      await notifyAddress(l.advertiser, { kind: "creative_approved", title: "Your creative was approved", body: "The owner will install it and upload proof.", link: `/leases/${j.escrow_id}` });
      await enqueue("ens_lease_register", { escrowId: j.escrow_id, digest: d }, { dedupe: `ens_lease_register:${j.escrow_id}` });
      return;
    }
    case "CreativeRejected":
    case "LeaseExpired": {
      const refunded = String(j.refunded);
      const st = name === "CreativeRejected" ? "cancelled" : n(j.reason) === 0 ? "cancelled" : "refunded";
      const l = await leaseRow(j.escrow_id);
      await setLease(j.escrow_id, { status: st, refunded: String(n(l.refunded) + n(refunded)) });
      await ok(db().from("spaces").update({ active_leases: await activeCount(j.space_id) }).eq("id", j.space_id));
      await activity({ kind: name === "CreativeRejected" ? "creative_rejected" : "lease_expired", space_id: j.space_id, amount: refunded, sui_digest: d });
      await notifyAddress(l.advertiser, { kind: "refund", title: name === "CreativeRejected" ? "Creative rejected — refunded" : "Lease expired — refunded", body: `${n(refunded) / 1e6} USDC returned to your wallet.`, link: `/leases/${j.escrow_id}` });
      await enqueue("ens_lease_unregister", { escrowId: j.escrow_id, digest: d }, { dedupe: `ens_lease_unregister:${j.escrow_id}` });
      return;
    }
    case "ProofAccepted": {
      await ok(db()
        .from("proofs")
        .update({ digest: d })
        .eq("escrow_id", j.escrow_id)
        .eq("period", n(j.period))
        .eq("status", "accepted")
        .is("digest", null));
      const l = await leaseRow(j.escrow_id);
      if (l.status === "awaiting_install") await setLease(j.escrow_id, { status: "live" });
      await ok(db().from("spaces").update({ accepted_proofs: await proofCount(j.space_id) }).eq("id", j.space_id));
      await activity({ kind: "proof_accepted", space_id: j.space_id, sui_digest: d, data: { period: n(j.period), photo: j.photo_blob_id } });
      await notifyAddress(l.advertiser, { kind: "proof", title: `Proof of display accepted (period ${n(j.period)})`, link: `/leases/${j.escrow_id}` });
      await enqueue("ens_lease_state", { escrowId: j.escrow_id, digest: d }, { dedupe: `ens_lease_state:${j.escrow_id}:${d}` });
      return;
    }
    case "TrancheReleased": {
      await ok(db().from("tranches").upsert(
        {
          escrow_id: j.escrow_id,
          space_id: j.space_id,
          period: n(j.period),
          kind: "released",
          gross: String(j.gross),
          platform_fee: String(j.platform_fee),
          investor_share: String(j.investor_share),
          to_owner: String(j.to_owner),
          digest: d,
        },
        { onConflict: "escrow_id,period", ignoreDuplicates: true },
      ));
      const l = await leaseRow(j.escrow_id);
      await setLease(j.escrow_id, { released: String(n(l.released) + n(j.gross)) });
      await activity({ kind: "tranche_released", space_id: j.space_id, amount: j.gross, sui_digest: d, data: { period: n(j.period), to_owner: String(j.to_owner), investor_share: String(j.investor_share) } });
      await notifyAddress(l.owner, { kind: "payout", title: `You earned ${n(j.to_owner) / 1e6} USDC`, body: `Period ${n(j.period)} of lease ${l.ens_label}.`, link: `/leases/${j.escrow_id}` });
      return;
    }
    case "TrancheRefunded": {
      await ok(db().from("tranches").upsert(
        { escrow_id: j.escrow_id, space_id: j.space_id, period: n(j.period), kind: "refunded", gross: String(j.amount), digest: d },
        { onConflict: "escrow_id,period", ignoreDuplicates: true },
      ));
      const l = await leaseRow(j.escrow_id);
      await setLease(j.escrow_id, { refunded: String(n(l.refunded) + n(j.amount)) });
      await activity({ kind: "tranche_refunded", space_id: j.space_id, amount: j.amount, sui_digest: d, data: { period: n(j.period) } });
      await notifyAddress(l.advertiser, { kind: "refund", title: `Missed period ${n(j.period)} refunded`, body: `${n(j.amount) / 1e6} USDC returned.`, link: `/leases/${j.escrow_id}` });
      return;
    }
    case "DisputeOpened": {
      await setLease(j.escrow_id, { status: "disputed" });
      await activity({ kind: "dispute_opened", space_id: j.space_id, sui_digest: d });
      const l = await leaseRow(j.escrow_id);
      await notifyAddress(l.owner, { kind: "dispute", title: "The advertiser opened a dispute", link: `/leases/${j.escrow_id}` });
      await enqueue("ens_lease_state", { escrowId: j.escrow_id, digest: d }, { dedupe: `ens_lease_state:${j.escrow_id}:${d}` });
      return;
    }
    case "DisputeResolved": {
      const refunded = n(j.refunded);
      const l = await leaseRow(j.escrow_id);
      await setLease(j.escrow_id, { status: refunded > 0 ? "refunded" : "live", refunded: String(n(l.refunded) + refunded) });
      await ok(db().from("spaces").update({ active_leases: await activeCount(j.space_id) }).eq("id", j.space_id));
      await activity({ kind: "dispute_resolved", space_id: j.space_id, amount: j.refunded, sui_digest: d });
      for (const a of [l.owner, l.advertiser]) await notifyAddress(a, { kind: "dispute", title: refunded > 0 ? "Dispute resolved — remaining escrow refunded" : "Dispute resolved — lease continues", link: `/leases/${j.escrow_id}` });
      if (refunded > 0) await enqueue("ens_lease_unregister", { escrowId: j.escrow_id, digest: d }, { dedupe: `ens_lease_unregister:${j.escrow_id}` });
      else await enqueue("ens_lease_state", { escrowId: j.escrow_id, digest: d }, { dedupe: `ens_lease_state:${j.escrow_id}:${d}` });
      return;
    }
    case "LeaseExtended": {
      const l = await leaseRow(j.escrow_id);
      await setLease(j.escrow_id, { weeks: l.weeks + n(j.extra_weeks), total_paid: String(n(l.total_paid) + n(j.paid)) });
      await activity({ kind: "lease_extended", space_id: j.space_id, amount: j.paid, sui_digest: d, data: { extra_weeks: n(j.extra_weeks) } });
      await notifyAddress(l.owner, { kind: "lease_extended", title: `Lease ${l.ens_label} extended by ${n(j.extra_weeks)} week(s)`, link: `/leases/${j.escrow_id}` });
      await enqueue("ens_lease_renew", { escrowId: j.escrow_id, endMs: String(j.new_end_ms), digest: d }, { dedupe: `ens_lease_renew:${j.escrow_id}:${d}` });
      return;
    }
    case "LeaseCompleted": {
      await setLease(j.escrow_id, { status: "completed" });
      await ok(db()
        .from("spaces")
        .update({ active_leases: await activeCount(j.space_id), completed_leases: await completedCount(j.space_id) })
        .eq("id", j.space_id));
      await activity({ kind: "lease_completed", space_id: j.space_id, amount: j.released, sui_digest: d });
      await enqueue("ens_lease_state", { escrowId: j.escrow_id, digest: d }, { dedupe: `ens_lease_state:${j.escrow_id}:${d}` });
      return;
    }
    // ---------------- kyc ----------------
    case "InvestorVerified":
    case "InvestorFrozen": {
      const uid = await userIdByAddress(j.investor);
      if (uid) await enqueue("ens_verified", { userId: uid, frozen: name === "InvestorFrozen" ? !!j.frozen : false }, { dedupe: `ens_verified:${uid}:${d}` });
      return;
    }
    // ---------------- offering ----------------
    case "OfferingOpened": {
      await ok(db().from("offerings").upsert(
        {
          id: j.offering_id,
          seq: String(j.seq),
          space_id: j.space_id,
          owner: j.owner,
          revenue_share_bps: n(j.revenue_share_bps),
          retained_units: n(j.retained_units),
          offered_units: n(j.offered_units),
          price_per_unit: String(j.price_per_unit),
          min_raise_units: n(j.min_raise_units),
          per_investor_max: n(j.per_investor_max),
          sale_end_ms: String(j.sale_end_ms),
          term_months: n(j.term_months),
          legal_pack_hash: b64hex(j.legal_pack_hash),
          legal_pack_blob_id: j.legal_pack_blob_id,
        },
        { onConflict: "id", ignoreDuplicates: true },
      ));
      await ok(db().from("holdings").upsert({ offering_id: j.offering_id, address: j.owner, units: n(j.retained_units) }, { onConflict: "offering_id,address", ignoreDuplicates: true }));
      await ok(db().from("spaces").update({ offering_id: j.offering_id }).eq("id", j.space_id));
      await unitEvent(j.offering_id, "opened", j.owner, null, n(j.retained_units), null, d, { seq: String(j.seq) });
      await activity({ kind: "offering_opened", space_id: j.space_id, offering_id: j.offering_id, actor: j.owner, sui_digest: d, data: { offered: n(j.offered_units), price: String(j.price_per_unit) } });
      await enqueue("ens_space_records", { spaceId: j.space_id, digest: d }, { dedupe: `ens_space_records:${j.space_id}:${d}` });
      return;
    }
    case "UnitsPurchased": {
      const h = await holding(j.offering_id, j.buyer);
      await ok(db().from("holdings").upsert({ offering_id: j.offering_id, address: j.buyer, units: h.units + n(j.units), listed_units: h.listed_units, paid: String(n(h.paid) + n(j.paid)), claimed: String(h.claimed) }));
      const o = await q(db().from("offerings").select("sold_units, raised, space_id, owner").eq("id", j.offering_id).single());
      await ok(db().from("offerings").update({ sold_units: o.sold_units + n(j.units), raised: String(n(o.raised) + n(j.paid)) }).eq("id", j.offering_id));
      await unitEvent(j.offering_id, "purchase", j.buyer, null, n(j.units), j.paid, d, null);
      await activity({ kind: "units_purchased", space_id: o.space_id, offering_id: j.offering_id, actor: j.buyer, amount: j.paid, sui_digest: d, data: { units: n(j.units) } });
      await notifyAddress(o.owner, { kind: "offering", title: `An investor bought ${n(j.units)} units`, link: `/offerings/${j.offering_id}` });
      return;
    }
    case "OfferingClosed": {
      const o = await q(db().from("offerings").select("*").eq("id", j.offering_id).single());
      await ok(db().from("offerings").update({ status: j.success ? "tokenised" : "refunding" }).eq("id", j.offering_id));
      if (j.success) {
        const unsold = o.offered_units - n(j.sold_units);
        if (unsold > 0) {
          const h = await holding(j.offering_id, o.owner);
          await ok(db().from("holdings").upsert({ offering_id: j.offering_id, address: o.owner, units: h.units + unsold, listed_units: h.listed_units, paid: String(h.paid), claimed: String(h.claimed) }));
        }
      } else {
        await ok(db().from("spaces").update({ offering_id: null }).eq("id", o.space_id));
      }
      await unitEvent(j.offering_id, j.success ? "closed" : "failed", o.owner, null, null, j.to_owner, d, { raised: String(j.raised), fee: String(j.fee) });
      await activity({ kind: j.success ? "offering_closed" : "offering_failed", space_id: o.space_id, offering_id: j.offering_id, amount: j.raised, sui_digest: d });
      await notifyAddress(o.owner, { kind: "offering", title: j.success ? `Offering closed — ${n(j.to_owner) / 1e6} USDC raised` : "Offering missed its minimum — investors can refund", link: `/offerings/${j.offering_id}` });
      await enqueue("ens_space_records", { spaceId: o.space_id, digest: d }, { dedupe: `ens_space_records:${o.space_id}:${d}` });
      return;
    }
    case "Refunded": {
      const h = await holding(j.offering_id, j.holder);
      await ok(db().from("holdings").upsert({ offering_id: j.offering_id, address: j.holder, units: 0, listed_units: 0, paid: "0", claimed: String(h.claimed) }));
      await unitEvent(j.offering_id, "refund", j.holder, null, h.units, j.amount, d, null);
      return;
    }
    case "Distributed": {
      const o = await q(db().from("offerings").select("total_distributed, space_id").eq("id", j.offering_id).single());
      await ok(db().from("offerings").update({ total_distributed: String(n(o.total_distributed) + n(j.amount)) }).eq("id", j.offering_id));
      await unitEvent(j.offering_id, "distribution", null, null, null, j.amount, d, { acc_per_unit: String(j.acc_per_unit) });
      const holders = await q(db().from("holdings").select("address").eq("offering_id", j.offering_id).gt("units", 0));
      for (const h of holders) await notifyAddress(h.address, { kind: "income", title: `New revenue distributed (${n(j.amount) / 1e6} USDC to holders)`, body: "Claim it from your portfolio.", link: `/offerings/${j.offering_id}` });
      return;
    }
    case "Claimed": {
      const h = await holding(j.offering_id, j.holder);
      await ok(db().from("holdings").upsert({ offering_id: j.offering_id, address: j.holder, units: h.units, listed_units: h.listed_units, paid: String(h.paid), claimed: String(n(h.claimed) + n(j.amount)) }));
      await unitEvent(j.offering_id, "claim", j.holder, null, null, j.amount, d, null);
      return;
    }
    // ---------------- market ----------------
    case "Listed": {
      await ok(db().from("listings").upsert({ id: j.listing_id, offering_id: j.offering_id, seller: j.seller, units: n(j.units), price_per_unit: String(j.price_per_unit) }, { onConflict: "id", ignoreDuplicates: true }));
      const h = await holding(j.offering_id, j.seller);
      await ok(db().from("holdings").upsert({ offering_id: j.offering_id, address: j.seller, units: h.units - n(j.units), listed_units: h.listed_units + n(j.units), paid: String(h.paid), claimed: String(h.claimed) }));
      await unitEvent(j.offering_id, "listed", j.seller, null, n(j.units), j.price_per_unit, d, { listing_id: j.listing_id });
      return;
    }
    case "Trade": {
      const l = await q(db().from("listings").select("units").eq("id", j.listing_id).single());
      const left = l.units - n(j.units);
      await ok(db().from("listings").update({ units: left, status: left === 0 ? "filled" : "open" }).eq("id", j.listing_id));
      const s = await holding(j.offering_id, j.seller);
      await ok(db().from("holdings").upsert({ offering_id: j.offering_id, address: j.seller, units: s.units, listed_units: s.listed_units - n(j.units), paid: String(s.paid), claimed: String(s.claimed) }));
      const b = await holding(j.offering_id, j.buyer);
      await ok(db().from("holdings").upsert({ offering_id: j.offering_id, address: j.buyer, units: b.units + n(j.units), listed_units: b.listed_units, paid: String(n(b.paid) + n(j.units) * n(j.price_per_unit)), claimed: String(b.claimed) }));
      await unitEvent(j.offering_id, "trade", j.buyer, j.seller, n(j.units), String(n(j.units) * n(j.price_per_unit)), d, { listing_id: j.listing_id, fee: String(j.fee) });
      const o = await q(db().from("offerings").select("space_id").eq("id", j.offering_id).single());
      await activity({ kind: "units_traded", space_id: o.space_id, offering_id: j.offering_id, actor: j.buyer, amount: String(n(j.units) * n(j.price_per_unit)), sui_digest: d, data: { units: n(j.units) } });
      await notifyAddress(j.seller, { kind: "trade", title: `You sold ${n(j.units)} units`, link: `/offerings/${j.offering_id}` });
      return;
    }
    case "ListingCancelled": {
      await ok(db().from("listings").update({ status: "cancelled", units: 0 }).eq("id", j.listing_id));
      const h = await holding(j.offering_id, j.seller);
      await ok(db().from("holdings").upsert({ offering_id: j.offering_id, address: j.seller, units: h.units + n(j.units), listed_units: Math.max(0, h.listed_units - n(j.units)), paid: String(h.paid), claimed: String(h.claimed) }));
      await unitEvent(j.offering_id, "cancel", j.seller, null, n(j.units), null, d, { listing_id: j.listing_id });
      return;
    }
    // ---------------- sponsor ----------------
    case "Sponsored": {
      const until = new Date(n(j.sponsored_until_ms)).toISOString();
      await ok(db().from("objects").update({ sponsored_until: until, sponsor_tier: n(j.tier) }).eq("id", j.object_id));
      await ok(db().from("sponsorships").upsert({ object_id: j.object_id, payer: j.payer, tier: n(j.tier), days: n(j.days), paid: String(j.paid), sponsored_until: until, digest: d }, { onConflict: "digest", ignoreDuplicates: true }));
      await activity({ kind: "sponsored", object_id: j.object_id, actor: j.payer, amount: j.paid, sui_digest: d, data: { tier: n(j.tier), days: n(j.days) } });
      await enqueue("ens_sponsored", { objectId: j.object_id, digest: d }, { dedupe: `ens_sponsored:${j.object_id}:${d}` });
      return;
    }
    default:
      return;
  }
}

async function leaseRow(escrowId: string) {
  return q(db().from("leases").select("*").eq("escrow_id", escrowId).single());
}
async function setLease(escrowId: string, patch: Record<string, unknown>) {
  await ok(db().from("leases").update({ ...patch, updated_at: now() }).eq("escrow_id", escrowId));
}
async function activeCount(spaceId: string) {
  const { count } = await db().from("leases").select("*", { count: "exact", head: true }).eq("space_id", spaceId).in("status", ["pending_approval", "awaiting_install", "live", "disputed"]);
  return count ?? 0;
}
async function completedCount(spaceId: string) {
  const { count } = await db().from("leases").select("*", { count: "exact", head: true }).eq("space_id", spaceId).eq("status", "completed");
  return count ?? 0;
}
async function proofCount(spaceId: string) {
  const { data } = await db().from("proofs").select("id, leases!inner(space_id)").eq("leases.space_id", spaceId).eq("status", "accepted");
  return data?.length ?? 0;
}
async function holding(offeringId: string, address: string) {
  const h = await q(db().from("holdings").select("*").eq("offering_id", offeringId).eq("address", address).maybeSingle());
  return { units: h?.units ?? 0, listed_units: h?.listed_units ?? 0, paid: h?.paid ?? "0", claimed: h?.claimed ?? "0" };
}
async function unitEvent(offeringId: string, kind: string, address: string | null, counterparty: string | null, units: number | null, amount: any, digest: string, data: any) {
  await ok(db().from("unit_events").insert({ offering_id: offeringId, kind, address, counterparty, units, amount: amount == null ? null : String(amount), digest, data }));
}

export { leaseStatus };
