import { HttpError } from "./auth";
import { db, q } from "./db";

export async function spaceDetail(id: string) {
  const s = await q(db().from("spaces").select("*").eq("id", id).maybeSingle());
  if (!s) throw new HttpError(404, "Space not found");
  const [object, leases, activity, offering, siblings] = await Promise.all([
    q(db().from("objects").select("*, owner:owner_user_id(id, handle, ens_name, display_name, avatar_blob_id, bio)").eq("id", s.object_id).single()),
    q(db().from("leases").select("escrow_id, ens_label, brand, start_ms, week_ms, weeks, status, creative_blob_id, total_paid, advertiser").eq("space_id", id).order("start_ms", { ascending: false })),
    q(db().from("activity").select("*").eq("space_id", id).order("created_at", { ascending: false }).limit(50)),
    s.offering_id ? q(db().from("offerings").select("*").eq("id", s.offering_id).maybeSingle()) : null,
    q(db().from("spaces").select("*").eq("object_id", s.object_id).neq("id", id).in("status", ["available", "paused"])),
  ]);
  const escrows = leases.map((l: any) => l.escrow_id);
  const proofs = escrows.length
    ? await q(db().from("proofs").select("escrow_id, period, photo_blob_id, created_at").in("escrow_id", escrows).eq("status", "accepted").order("created_at", { ascending: false }).limit(24))
    : [];
  const booked = leases
    .filter((l: any) => l.status !== "cancelled") // on-chain calendar only frees weeks on cancellation
    .flatMap((l: any) => Array.from({ length: l.weeks }, (_, i) => Math.floor(Number(l.start_ms) / Number(l.week_ms)) + i));
  const ownerStats = await q(db().from("spaces").select("completed_leases, accepted_proofs").eq("owner_address", s.owner_address));
  return {
    space: s,
    object,
    leases,
    proofs,
    activity,
    offering,
    siblings,
    bookedWeeks: booked,
    owner: {
      ...(object as any).owner,
      address: s.owner_address,
      completedLeases: ownerStats.reduce((a: number, r: any) => a + r.completed_leases, 0),
      acceptedProofs: ownerStats.reduce((a: number, r: any) => a + r.accepted_proofs, 0),
    },
  };
}
