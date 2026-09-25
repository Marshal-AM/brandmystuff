import { handler } from "@/server/http";
import { db, q } from "@/server/db";
export const GET = handler(async (req) => {
  const p = new URL(req.url).searchParams;
  let query = db().from("activity").select("*").order("created_at", { ascending: false }).limit(Number(p.get("limit") ?? 50));
  if (p.get("spaceId")) query = query.eq("space_id", p.get("spaceId")!);
  if (p.get("objectId")) query = query.eq("object_id", p.get("objectId")!);
  if (p.get("offeringId")) query = query.eq("offering_id", p.get("offeringId")!);
  return { activity: await q(query) };
});
