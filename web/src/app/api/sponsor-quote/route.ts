import { handler } from "@/server/http";
import { sponsorPrice } from "@/server/x402flows";
export const GET = handler(async (req) => {
  const p = new URL(req.url).searchParams;
  const tier = (Number(p.get("tier")) === 2 ? 2 : 1) as 1 | 2;
  const days = Math.max(1, Math.min(90, Number(p.get("days") ?? 1)));
  const perDay = await sponsorPrice(tier);
  return { tier, days, perDay: perDay.toString(), amount: (perDay * BigInt(days)).toString() };
});
