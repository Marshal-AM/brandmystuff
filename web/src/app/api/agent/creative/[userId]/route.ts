import { db, q } from "@/server/db";

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** A clean wordmark creative for brands that haven't uploaded a logo (used as the ad image). */
export const GET = async (_req: Request, ctx: { params: Promise<{ userId: string }> }) => {
  const { userId } = await ctx.params;
  const u = /^[0-9a-f-]{36}$/i.test(userId) ? await q(db().from("users").select("brand_name, handle").eq("id", userId).maybeSingle()) : null;
  const name = esc((u?.brand_name ?? u?.handle ?? "brand").slice(0, 28));
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1200" viewBox="0 0 1200 1200"><rect width="1200" height="1200" rx="120" fill="#0a0a0b"/><circle cx="600" cy="470" r="150" fill="#ab9ff2"/><text x="600" y="820" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="${name.length > 14 ? 90 : 130}" font-weight="800" fill="#ffffff">${name}</text></svg>`;
  return new Response(svg, { headers: { "content-type": "image/svg+xml", "cache-control": "public, max-age=300" } });
};
