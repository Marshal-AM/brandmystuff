import { Transaction } from "@mysten/sui/transactions";
import { handler } from "@/server/http";
import { HttpError, requireUser } from "@/server/auth";
import { db, ok } from "@/server/db";
import { balances, execute } from "@/server/sui";
import { SUI } from "@/lib/deployment";

const SUI_MIST = BigInt(process.env.TEST_FUNDS_SUI_MIST ?? 200_000_000);
const USDC = BigInt(process.env.TEST_FUNDS_USDC ?? 1_000_000);

export const POST = handler(async (req) => {
  const u = await requireUser(req);
  if (!u.sui_address) throw new HttpError(400, "No Sui wallet");
  const full: any = (await db().from("users").select("test_funds_at").eq("id", u.id).single()).data;
  if (full?.test_funds_at && Date.now() - new Date(full.test_funds_at).getTime() < 24 * 3600_000)
    throw new HttpError(429, "Test funds can be requested once every 24 hours");
  const plat = await balances(SUI.platformAddress);
  const usdc = plat.usdc - USDC >= 1_000_000n ? USDC : 0n;
  if (plat.sui - SUI_MIST < 500_000_000n) throw new HttpError(503, "The platform faucet is empty — use faucet.sui.io");
  const tx = new Transaction();
  tx.transferObjects([tx.coin({ balance: SUI_MIST })], tx.pure.address(u.sui_address));
  if (usdc > 0n) tx.transferObjects([tx.coin({ type: SUI.usdcType, balance: usdc })], tx.pure.address(u.sui_address));
  const r = await execute(tx);
  await ok(db().from("users").update({ test_funds_at: new Date().toISOString() }).eq("id", u.id));
  await ok(db().from("test_fund_grants").insert({ user_id: u.id, address: u.sui_address, sui_mist: String(SUI_MIST), usdc: String(usdc), digest: r.digest }));
  return { digest: r.digest, sui: SUI_MIST.toString(), usdc: usdc.toString(), usdcNote: usdc === 0n ? "Platform USDC is low — use faucet.circle.com" : null };
});
