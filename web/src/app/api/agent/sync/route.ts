import { handler } from "@/server/http";
import { requireUser } from "@/server/auth";
import { enqueue } from "@/server/notify";

/** Mirror the brand's mandate onto its agent's ENS name now (after pause / resume / revoke). */
export const POST = handler(async (req) => {
  const u = await requireUser(req);
  await enqueue("ens_agent_sync", { userId: u.id }, { dedupe: `ens_agent_sync:${u.id}:ui:${Date.now()}` });
  return { ok: true };
});
