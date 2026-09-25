import { handler } from "@/server/http";
import { db, q } from "@/server/db";

/** Most common AI-derived object tags among live listings (used as marketplace filter chips). */
export const GET = handler(async () => {
  const rows = await q(db().from("objects").select("tags, spaces!inner(status)").eq("spaces.status", "available").limit(1000));
  const counts = new Map<string, number>();
  for (const r of rows) for (const t of r.tags ?? []) counts.set(t, (counts.get(t) ?? 0) + 1);
  return { tags: [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 24).map(([tag, count]) => ({ tag, count })) };
});
