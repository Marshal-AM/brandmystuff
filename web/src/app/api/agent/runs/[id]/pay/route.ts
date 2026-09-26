import { requireUser } from "@/server/auth";
import { ndjson } from "@/server/http";
import { payScout } from "@/server/agent/pay";

export const maxDuration = 300;

/** Scout pays for its pick through the x402 gate, from the brand's mandate (NDJSON stream). */
export const POST = async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const u = await requireUser(req).catch(() => null);
  if (!u) return new Response(JSON.stringify({ error: "Sign in first" }), { status: 401, headers: { "content-type": "application/json" } });
  const { id } = await ctx.params;
  const origin = process.env.APP_INTERNAL_URL ?? new URL(req.url).origin;
  return ndjson(async (emit) => {
    await payScout(u.id, id, origin, emit as any);
  });
};
