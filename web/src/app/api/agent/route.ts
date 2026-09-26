import { handler } from "@/server/http";
import { HttpError, requireUser } from "@/server/auth";
import { db, q } from "@/server/db";
import { sui } from "@/server/sui";
import { agentFor, readMandate } from "@/server/agent/keys";

/** The signed-in brand's agent, its mandate, and recent runs. */
export const GET = handler(async (req) => {
  const u = await requireUser(req);
  const full = await q(db().from("users").select("account_type").eq("id", u.id).single());
  if (full.account_type !== "brand") throw new HttpError(403, "Only brand accounts have an agent");
  const a = await agentFor(u.id);
  const [mandate, bal, runs] = await Promise.all([
    a.mandateId ? readMandate(a.mandateId) : null,
    sui().getBalance({ owner: a.address }) as any,
    q(db().from("agent_runs").select("id, status, pick_id, candidates, payment, error, created_at").eq("user_id", u.id).order("created_at", { ascending: false }).limit(10)),
  ]);
  return {
    agent: { address: a.address, gasSui: Number(BigInt(bal.balance.balance)) / 1e9 },
    mandate,
    runs: runs.map((r: any) => {
      const pick = (r.candidates ?? []).find((c: any) => c.id === r.pick_id);
      return { id: r.id, status: r.status, createdAt: r.created_at, error: r.error, considered: (r.candidates ?? []).length, pick: pick ? { title: pick.title, objectTitle: pick.objectTitle, ensName: pick.ensName, match: pick.match, price: pick.price, imageUrl: pick.imageUrl } : null, payment: r.payment };
    }),
  };
});
