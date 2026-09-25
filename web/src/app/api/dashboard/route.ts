import { handler } from "@/server/http";
import { requireUser } from "@/server/auth";
import { db, q } from "@/server/db";

export const GET = handler(async (req) => {
  const u = await requireUser(req);
  const addr = u.sui_address ?? "";
  const [objects, ownerLeases, advLeases, brandAssets] = await Promise.all([
    q(db().from("objects").select("*").eq("owner_address", addr).order("created_at", { ascending: false })),
    q(db().from("leases").select("*, spaces(label, ens_name, closeup_blob_id, offering_id)").eq("owner", addr).order("created_at", { ascending: false })),
    q(db().from("leases").select("*, spaces(label, ens_name, closeup_blob_id)").eq("advertiser", addr).order("created_at", { ascending: false })),
    q(db().from("brand_assets").select("*").eq("user_id", u.id).order("created_at", { ascending: false })),
  ]);
  const spaces = objects.length ? await q(db().from("spaces").select("*").in("object_id", objects.map((o: any) => o.id)).order("created_at")) : [];
  const ownerEscrows = ownerLeases.map((l: any) => l.escrow_id);
  const advEscrows = advLeases.map((l: any) => l.escrow_id);
  const [earnings, advTranches, proofs, clicks] = await Promise.all([
    ownerEscrows.length ? q(db().from("tranches").select("*").in("escrow_id", ownerEscrows).order("created_at", { ascending: false })) : [],
    advEscrows.length ? q(db().from("tranches").select("*").in("escrow_id", advEscrows)) : [],
    advEscrows.length ? q(db().from("proofs").select("*").in("escrow_id", advEscrows).eq("status", "accepted").order("created_at", { ascending: false })) : [],
    advEscrows.length ? q(db().from("clicks").select("escrow_id").in("escrow_id", advEscrows)) : [],
  ]);
  const now = Date.now();
  const dueProofs = ownerLeases
    .filter((l: any) => ["awaiting_install", "live"].includes(l.status))
    .map((l: any) => {
      const done = new Set(earnings.filter((t: any) => t.escrow_id === l.escrow_id).map((t: any) => t.period));
      const start = Number(l.start_ms), week = Number(l.week_ms), cure = Math.floor((week * 3) / 7);
      for (let k = 0; k <= l.weeks; k++) {
        if (done.has(k)) continue;
        const open = k === 0 ? 0 : start + (k - 1) * week, close = k === 0 ? start + week : start + k * week + cure;
        if (now < close) return { escrowId: l.escrow_id, lease: l, period: k, open, close, dueNow: now >= open };
      }
      return null;
    })
    .filter(Boolean);
  const pendingApprovals = ownerLeases.filter((l: any) => l.status === "pending_approval");
  return {
    owner: {
      objects,
      spaces,
      leases: ownerLeases,
      pendingApprovals,
      dueProofs,
      earnings,
      totals: {
        earned: earnings.filter((t: any) => t.kind === "released").reduce((a: number, t: any) => a + Number(t.to_owner), 0),
        activeLeases: ownerLeases.filter((l: any) => ["awaiting_install", "live"].includes(l.status)).length,
      },
    },
    advertiser: {
      leases: advLeases.map((l: any) => ({ ...l, clicks: clicks.filter((c: any) => c.escrow_id === l.escrow_id).length })),
      proofs,
      brandAssets,
      totals: {
        spent: advLeases.reduce((a: number, l: any) => a + Number(l.total_paid), 0),
        refunded: advLeases.reduce((a: number, l: any) => a + Number(l.refunded), 0),
        released: advTranches.filter((t: any) => t.kind === "released").reduce((a: number, t: any) => a + Number(t.gross), 0),
        clicks: clicks.length,
      },
    },
  };
});
