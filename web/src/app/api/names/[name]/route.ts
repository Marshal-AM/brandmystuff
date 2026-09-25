import { handler } from "@/server/http";
import { HttpError } from "@/server/auth";
import { db, q } from "@/server/db";
import { verifyName, ensText } from "@/server/ens/read";
import { spaceDetail } from "@/server/views";

export const GET = handler(async (req, ctx: { params: Promise<{ name: string }> }) => {
  const name = decodeURIComponent((await ctx.params).name).toLowerCase();
  const live = new URL(req.url).searchParams.get("live") !== "0";
  const ensRow = await q(db().from("ens_names").select("*").eq("name", name).maybeSingle());

  const space = await q(db().from("spaces").select("id").eq("ens_name", name).maybeSingle());
  if (space) {
    const d = await spaceDetail(space.id);
    const v = live ? await verifyName(name, space.id, ["class", "eth.brandmystuff.attested.aqs", "eth.brandmystuff.attested.grade", "eth.brandmystuff.price", "eth.brandmystuff.status"]) : null;
    return { kind: "space", ens: ensRow, verification: v, ...d };
  }
  const obj = await q(db().from("objects").select("*, owner:owner_user_id(handle, ens_name, display_name, avatar_blob_id)").eq("ens_name", name).maybeSingle());
  if (obj) {
    const spaces = await q(db().from("spaces").select("*").eq("object_id", obj.id).in("status", ["available", "paused"]).order("rank_score", { ascending: false }));
    const v = live ? await verifyName(name, obj.id, ["class", "eth.brandmystuff.category", "eth.brandmystuff.attested.sponsored"]) : null;
    return { kind: "object", ens: ensRow, verification: v, object: obj, spaces };
  }
  const user = await q(db().from("users").select("id, handle, ens_name, display_name, bio, avatar_blob_id, twitter, website, brand_name, sui_address, profile_id, created_at").eq("ens_name", name).maybeSingle());
  if (user) {
    const objects = await q(db().from("objects").select("*").eq("owner_user_id", user.id).order("created_at", { ascending: false }));
    const spaces = objects.length ? await q(db().from("spaces").select("*").in("object_id", objects.map((o: any) => o.id)).in("status", ["available", "paused"])) : [];
    const leases = await q(db().from("leases").select("status").eq("owner", user.sui_address ?? ""));
    const v = live ? { ...(await verifyName(name, user.profile_id, ["class", "eth.brandmystuff.attested.verified"])), description: await ensText(name, "description") } : null;
    return {
      kind: "account",
      ens: ensRow,
      verification: v,
      user,
      objects,
      spaces,
      reputation: { completedLeases: leases.filter((l: any) => l.status === "completed").length, totalLeases: leases.length },
    };
  }
  const label = name.split(".")[0];
  if (label.startsWith("l-")) {
    const parent = name.slice(label.length + 1);
    const sp = await q(db().from("spaces").select("id").eq("ens_name", parent).maybeSingle());
    const lease = sp ? await q(db().from("leases").select("*").eq("space_id", sp.id).eq("ens_label", label).maybeSingle()) : null;
    if (lease) {
      const v = live ? await verifyName(name, lease.escrow_id, ["class", "eth.brandmystuff.brand", "eth.brandmystuff.attested.state", "eth.brandmystuff.attested.proofs"]) : null;
      return { kind: "lease", ens: ensRow, verification: v, lease, spaceName: parent };
    }
  }
  throw new HttpError(404, `${name} is not a brandmystuff name`);
});
