import { handler } from "@/server/http";
import { HttpError, optionalUser } from "@/server/auth";
import { db, q } from "@/server/db";
import { nextPeriod, periodWindow } from "@/server/proofs";

export const GET = handler(async (req, ctx: { params: Promise<{ escrowId: string }> }) => {
  const { escrowId } = await ctx.params;
  const me = await optionalUser(req);
  const l = await q(db().from("leases").select("*, spaces(*, objects(title, ens_name, hero_blob_id, category))").eq("escrow_id", escrowId).maybeSingle());
  if (!l) throw new HttpError(404, "Lease not found");
  const [proofs, tranches, clicks, conv] = await Promise.all([
    q(db().from("proofs").select("*").eq("escrow_id", escrowId).order("created_at", { ascending: false })),
    q(db().from("tranches").select("*").eq("escrow_id", escrowId).order("period")),
    db().from("clicks").select("*", { count: "exact", head: true }).eq("escrow_id", escrowId),
    me ? q(db().from("conversations").select("id").eq("escrow_id", escrowId).maybeSingle()) : null,
  ]);
  const myAgent = me ? await q(db().from("brand_agents").select("agent_address").eq("user_id", me.id).maybeSingle()) : null;
  const role = me?.sui_address === l.owner ? "owner" : me?.sui_address === l.advertiser || (myAgent && myAgent.agent_address === l.advertiser) ? "advertiser" : me?.is_admin ? "admin" : "public";
  const periods = Array.from({ length: l.weeks + 1 }, (_, k) => {
    const w = periodWindow(l, k);
    const t = tranches.find((x: any) => x.period === k);
    return { period: k, open: w.open, close: w.close, status: t ? t.kind : Date.now() > w.close ? "overdue" : Date.now() >= w.open ? "due" : "upcoming", tranche: t ?? null };
  });
  const lastProof = proofs.find((p: any) => p.status === "accepted");
  const disputeOpenUntil = lastProof ? new Date(lastProof.created_at).getTime() + Math.floor((Number(l.week_ms) * 3) / 7) : 0;
  return {
    lease: l,
    role,
    proofs: role === "public" ? proofs.filter((p: any) => p.status === "accepted") : proofs,
    tranches,
    periods,
    next: role === "owner" ? await nextPeriod(escrowId) : null,
    clicks: clicks.count ?? 0,
    conversationId: conv?.id ?? null,
    endMs: Number(l.start_ms) + l.weeks * Number(l.week_ms),
    disputeOpenUntil,
  };
});
