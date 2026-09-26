import { handler } from "@/server/http";
import { requireUser } from "@/server/auth";
import { db, q } from "@/server/db";
import { namesUnder } from "@/server/ens/view";

/** The signed-in user's ENS names, including ones the relayer hasn't written yet. */
export const GET = handler(async (req) => {
  const u = await requireUser(req);
  if (!u.ens_name) return { account: null, names: [] };
  const [written, objects] = await Promise.all([namesUnder(u.ens_name), q(db().from("objects").select("id, ens_name").eq("owner_user_id", u.id))]);
  const spaces = objects.length ? await q(db().from("spaces").select("ens_name").in("object_id", objects.map((o: any) => o.id)).neq("status", "removed")) : [];
  const known = new Map(written.map((w) => [w.name, w]));
  const expected: { name: string; kind: string }[] = [
    { name: u.ens_name, kind: "account" },
    ...objects.filter((o: any) => o.ens_name).map((o: any) => ({ name: o.ens_name, kind: "object" })),
    ...spaces.filter((s: any) => s.ens_name).map((s: any) => ({ name: s.ens_name, kind: "space" })),
  ];
  for (const e of expected) if (!known.has(e.name)) known.set(e.name, { name: e.name, kind: e.kind, status: "pending", expiry: null, updated_at: "" });
  return { account: u.ens_name, names: [...known.values()] };
});
