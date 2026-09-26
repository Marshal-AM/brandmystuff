import { handler } from "@/server/http";
import { HttpError, requireUser } from "@/server/auth";
import { db, q } from "@/server/db";
import { sui } from "@/server/sui";
import { agentFor, readMandate } from "@/server/agent/keys";
import { enqueue } from "@/server/notify";

/** The signed-in brand's agent, its mandate, and recent runs. */
export const GET = handler(async (req) => {
  const u = await requireUser(req);
  const full = await q(db().from("users").select("account_type, ens_status").eq("id", u.id).single());
  if (full.account_type !== "brand") throw new HttpError(403, "Only brand accounts have an agent");
  const a = await agentFor(u.id);
  const ba = await q(db().from("brand_agents").select("ens_name, ens_status, evm_address, ens_state").eq("user_id", u.id).single());
  // The agent's ENS identity is created once the brand's own name is live.
  if (ba.ens_status !== "registered" && full.ens_status === "registered") await enqueue("ens_agent", { userId: u.id }, { dedupe: `ens_agent:${u.id}` });
  const [mandate, bal, runs] = await Promise.all([
    a.mandateId ? readMandate(a.mandateId) : null,
    sui().getBalance({ owner: a.address }) as any,
    q(db().from("agent_runs").select("id, status, pick_id, candidates, payment, error, created_at").eq("user_id", u.id).order("created_at", { ascending: false }).limit(10)),
  ]);
  return {
    agent: { address: a.address, gasSui: Number(BigInt(bal.balance.balance)) / 1e9 },
    ens: { name: ba.ens_name, status: ba.ens_status ?? "pending", key: ba.evm_address, state: (ba.ens_state as any)?.texts?.["eth.brandmystuff.attested.agent.status"] ?? null },
    mandate,
    runs: runs.map((r: any) => {
      const pick = (r.candidates ?? []).find((c: any) => c.id === r.pick_id);
      return { id: r.id, status: r.status, createdAt: r.created_at, error: r.error, considered: (r.candidates ?? []).length, pick: pick ? { title: pick.title, objectTitle: pick.objectTitle, ensName: pick.ensName, match: pick.match, price: pick.price, imageUrl: pick.imageUrl } : null, payment: r.payment };
    }),
  };
});
