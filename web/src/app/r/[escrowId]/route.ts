import { db, ok } from "@/server/db";

export async function GET(req: Request, ctx: { params: Promise<{ escrowId: string }> }) {
  const { escrowId } = await ctx.params;
  const { data } = await db().from("leases").select("landing_url").eq("escrow_id", escrowId).maybeSingle();
  if (!data?.landing_url) return new Response("Not found", { status: 404 });
  await ok(db().from("clicks").insert({ escrow_id: escrowId, referer: req.headers.get("referer"), user_agent: req.headers.get("user-agent")?.slice(0, 300) }));
  const u = new URL(data.landing_url);
  u.searchParams.set("utm_source", "brandmystuff");
  u.searchParams.set("utm_medium", "sponsor");
  u.searchParams.set("utm_campaign", escrowId.slice(0, 10));
  return Response.redirect(u.toString(), 302);
}
