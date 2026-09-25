import { handler } from "@/server/http";
import { requireUser } from "@/server/auth";
import { balances } from "@/server/sui";
import { db, q } from "@/server/db";

export const GET = handler(async (req) => {
  const u = await requireUser(req);
  const [bal, kyc, unread] = await Promise.all([
    u.sui_address ? balances(u.sui_address).catch(() => ({ sui: 0n, usdc: 0n })) : { sui: 0n, usdc: 0n },
    q(db().from("kyc_submissions").select("status, investor_type, expires_at").eq("user_id", u.id).order("created_at", { ascending: false }).limit(1).maybeSingle()),
    db().from("notifications").select("*", { count: "exact", head: true }).eq("user_id", u.id).eq("read", false),
  ]);
  const full = await q(db().from("users").select("*").eq("id", u.id).single());
  return {
    user: full,
    balances: { sui: bal.sui.toString(), usdc: bal.usdc.toString() },
    kyc,
    unread: unread.count ?? 0,
    needsOnboarding: !full.handle,
  };
});
