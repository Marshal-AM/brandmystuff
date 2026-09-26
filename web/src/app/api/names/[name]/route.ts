import { handler } from "@/server/http";
import { HttpError } from "@/server/auth";
import { db, q } from "@/server/db";
import { verifyName, ensText } from "@/server/ens/read";
import { spaceDetail } from "@/server/views";
import { ensSnapshot } from "@/server/ens/view";

export const GET = handler(async (req, ctx: { params: Promise<{ name: string }> }) => {
  const name = decodeURIComponent((await ctx.params).name).toLowerCase();
  const live = new URL(req.url).searchParams.get("live") !== "0";
  const [ensRow, ensInfo] = await Promise.all([q(db().from("ens_names").select("*").eq("name", name).maybeSingle()), ensSnapshot(name)]);

  const space = await q(db().from("spaces").select("id").eq("ens_name", name).maybeSingle());
  if (space) {
    const d = await spaceDetail(space.id);
    const v = live ? await verifyName(name, space.id, ["class", "eth.brandmystuff.attested.aqs", "eth.brandmystuff.attested.grade", "eth.brandmystuff.price", "eth.brandmystuff.status"]) : null;
    return { kind: "space", ens: ensRow, ensInfo, verification: v, ...d };
  }
  const obj = await q(db().from("objects").select("*, owner:owner_user_id(handle, ens_name, display_name, avatar_blob_id)").eq("ens_name", name).maybeSingle());
  if (obj) {
    const spaces = await q(db().from("spaces").select("*").eq("object_id", obj.id).in("status", ["available", "paused"]).order("rank_score", { ascending: false }));
    const v = live ? await verifyName(name, obj.id, ["class", "eth.brandmystuff.type", "eth.brandmystuff.attested.sponsored"]) : null;
    return { kind: "object", ens: ensRow, ensInfo, verification: v, object: obj, spaces };
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
      ensInfo,
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
      return { kind: "lease", ens: ensRow, ensInfo, verification: v, lease, spaceName: parent };
    }
  }
  // Brand agents (scout.<brand>) and the receipt subnames they register for each purchase.
  if (ensRow?.kind === "agent" || ensRow?.kind === "receipt") {
    const agentName = ensRow.kind === "agent" ? name : ensRow.parent;
    const ba = await q(db().from("brand_agents").select("user_id, agent_address, ens_state, users(handle, ens_name, brand_name, brand_logo_blob_id)").eq("ens_name", agentName).maybeSingle());
    if (ba) {
      const suiRef = ensRow.kind === "agent" ? `0x${ba.agent_address.replace(/^0x/, "").padStart(64, "0")}` : ensRow.sui_ref;
      const keys = ensRow.kind === "agent"
        ? ["class", "agent-context", "eth.brandmystuff.attested.agent.status", "eth.brandmystuff.attested.mandate.remaining", "eth.brandmystuff.agent.last-pick"]
        : ["class", "eth.brandmystuff.receipt.pick", "eth.brandmystuff.receipt.reason", "eth.brandmystuff.attested.payment", "eth.brandmystuff.attested.lease"];
      const v = live ? await verifyName(name, suiRef, keys) : null;
      const receipts = ensRow.kind === "agent" ? await q(db().from("ens_names").select("name, status, updated_at").eq("parent", name).eq("kind", "receipt").order("updated_at", { ascending: false })) : [];
      return { kind: ensRow.kind, ens: ensRow, ensInfo, verification: v, agent: { name: agentName, address: ba.agent_address, brand: (ba as any).users, state: ba.ens_state }, receipts };
    }
  }
  throw new HttpError(404, `${name} is not a brandmystuff name`);
});
