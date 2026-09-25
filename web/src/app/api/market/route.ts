import { handler } from "@/server/http";
import { db, q } from "@/server/db";

const SEL = "id, label, ens_name, width_mm, height_mm, placement, material, closeup_blob_id, price_per_week, aqs, grade, confidence_bps, rank_score, status, offering_id, accepted_proofs, completed_leases, created_at, week_ms, object_id, objects!inner(id, title, category, object_type, tags, city, ens_name, hero_blob_id, sponsored_until, sponsor_tier, owner_address, search)";

export const GET = handler(async (req) => {
  const p = new URL(req.url).searchParams;
  let query = db().from("spaces").select(SEL).eq("status", "available").gte("aqs", 40);
  const qs = p.get("q")?.trim();
  if (qs) {
    const term = qs.split(/\s+/).map((w) => w.replace(/[^a-z0-9]/gi, "")).filter(Boolean).join(" & ");
    if (term) query = query.or(`label.ilike.%${qs}%,ens_name.ilike.%${qs}%`, {}) as any;
  }
  if (p.get("tag")) query = query.contains("objects.tags", [p.get("tag")!.toLowerCase().trim()]);
  if (p.get("city")) query = query.ilike("objects.city", `%${p.get("city")}%`);
  if (p.get("placement")) query = query.eq("placement", p.get("placement")!);
  if (p.get("minGrade")) query = query.gte("grade", Number(p.get("minGrade")));
  if (p.get("maxPrice")) query = query.lte("price_per_week", Math.round(Number(p.get("maxPrice")) * 1e6));
  if (p.get("minPrice")) query = query.gte("price_per_week", Math.round(Number(p.get("minPrice")) * 1e6));
  if (p.get("minAreaCm2")) query = query.gte("width_mm", 0); // area filtered below
  if (p.get("tokenised") === "1") query = query.not("offering_id", "is", null);
  const sort = p.get("sort") ?? "rank";
  query =
    sort === "price_asc" ? query.order("price_per_week", { ascending: true })
    : sort === "price_desc" ? query.order("price_per_week", { ascending: false })
    : sort === "newest" ? query.order("created_at", { ascending: false })
    : query.order("rank_score", { ascending: false }).order("accepted_proofs", { ascending: false }).order("created_at", { ascending: true });
  let rows: any[] = await q(query.limit(300));

  // keyword search across object title/description/type/city too (full text on objects.search)
  if (qs) {
    const extra: any[] = await q(
      db().from("spaces").select(SEL).eq("status", "available").gte("aqs", 40).textSearch("objects.search", qs.split(/\s+/).join(" | "), { config: "simple" }).limit(300),
    ).catch(() => []);
    const seen = new Set(rows.map((r) => r.id));
    rows = [...rows, ...extra.filter((r) => !seen.has(r.id))];
  }
  const minArea = Number(p.get("minAreaCm2") ?? 0);
  if (minArea) rows = rows.filter((r) => (r.width_mm * r.height_mm) / 100 >= minArea);
  const now = Date.now();
  const sponsoredOnly = p.get("sponsored") === "1";
  const isSponsored = (r: any) => r.objects.sponsored_until && new Date(r.objects.sponsored_until).getTime() > now;
  if (sponsoredOnly) rows = rows.filter(isSponsored);

  // Sponsored slots: positions 1, 7, 13… from sponsored objects matching the filters; organic order untouched.
  const sponsored = rows.filter(isSponsored);
  const organic = [...rows];
  const out: any[] = [];
  let si = 0;
  const used = new Set<string>();
  for (let i = 0; organic.length || si < sponsored.length; i++) {
    if (!organic.length) break;
    if (i % 6 === 0 && si < sponsored.length) {
      const s = sponsored[si++];
      out.push({ ...s, slot: "sponsored" });
      used.add(s.id);
      continue;
    }
    const o = organic.shift()!;
    out.push({ ...o, slot: "organic", sponsored: isSponsored(o) });
  }
  const rail = sponsored.filter((r) => r.objects.sponsor_tier === 2).slice(0, 8);
  return { results: out.map(({ objects, ...r }) => ({ ...r, object: objects })), rail: rail.map(({ objects, ...r }) => ({ ...r, object: objects })), total: rows.length };
});
