import { handler } from "@/server/http";
import { requireUser } from "@/server/auth";
import { db, q } from "@/server/db";
import { holdingOf } from "@/server/chainread";

export const GET = handler(async (req) => {
  const u = await requireUser(req);
  const rows = await q(db().from("holdings").select("*, offerings(*, spaces(label, ens_name, closeup_blob_id, aqs, grade))").eq("address", u.sui_address ?? "").or("units.gt.0,listed_units.gt.0,claimed.gt.0"));
  const out = [];
  for (const r of rows) {
    const h = await holdingOf(r.offering_id, u.sui_address!).catch(() => null);
    out.push({ ...r, onchain: h ? { units: Number(h.units), listed: Number(h.listed), claimable: h.claimable.toString() } : null });
  }
  return { holdings: out };
});
