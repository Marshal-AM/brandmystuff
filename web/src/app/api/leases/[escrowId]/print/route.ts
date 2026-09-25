import { HttpError, requireUser } from "@/server/auth";
import { db, q } from "@/server/db";
import { handler } from "@/server/http";
import { printFile, PRINT_SIZES, type PrintSize } from "@/server/print";
import { readBlob } from "@/server/walrus";

export const GET = handler(async (req, ctx: { params: Promise<{ escrowId: string }> }) => {
  const u = await requireUser(req);
  const { escrowId } = await ctx.params;
  const p = new URL(req.url).searchParams;
  const size = (p.get("size") ?? "exact") as PrintSize;
  const format = p.get("format") === "png" ? "png" : "pdf";
  if (!(size in PRINT_SIZES)) throw new HttpError(400, "size must be exact|S|M|L");
  const l = await q(db().from("leases").select("*, spaces(label, ens_name, width_mm, height_mm)").eq("escrow_id", escrowId).single());
  if (u.sui_address !== l.owner && u.sui_address !== l.advertiser && !u.is_admin) throw new HttpError(403, "Not a party to this lease");
  if (l.status === "pending_approval") throw new HttpError(400, "Approve the creative first");
  const creative = await readBlob(l.creative_blob_id);
  const out = await printFile(creative, size, format, {
    widthMm: (l as any).spaces.width_mm,
    heightMm: (l as any).spaces.height_mm,
    label: (l as any).spaces.label,
    leaseName: `${l.ens_label}.${(l as any).spaces.ens_name}`,
  });
  return new Response(new Uint8Array(out.buf), { headers: { "content-type": out.mime, "content-disposition": `attachment; filename="${out.filename}"` } });
});
