import { handler } from "@/server/http";
import { HttpError, requireUser } from "@/server/auth";
import { myPayouts } from "@/server/payouts/views";

export const GET = handler(async (req) => {
  const u = await requireUser(req);
  if (!u.sui_address) throw new HttpError(400, "No Sui wallet on this account");
  return myPayouts(u.sui_address);
});
