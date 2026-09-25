import { handler } from "@/server/http";
import { db, q } from "@/server/db";
export const GET = handler(async () => {
  const rows = await q(db().from("offerings").select("*, spaces(label, ens_name, closeup_blob_id, aqs, grade, price_per_week, objects(title, category, city))").order("created_at", { ascending: false }).limit(100));
  return { offerings: rows };
});
