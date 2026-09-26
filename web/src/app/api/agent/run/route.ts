import { requireUser } from "@/server/auth";
import { ndjson } from "@/server/http";
import { runScout } from "@/server/agent/scout";

export const maxDuration = 300;

/** Runs Scout and streams every step (NDJSON) to the agent page. */
export const POST = async (req: Request) => {
  const u = await requireUser(req).catch(() => null);
  if (!u) return new Response(JSON.stringify({ error: "Sign in first" }), { status: 401, headers: { "content-type": "application/json" } });
  return ndjson(async (emit) => {
    await runScout(u.id, emit as any);
  });
};
