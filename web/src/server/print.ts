/** Print-ready files for an approved creative: exact space size (3 mm bleed + cut line) and S/M/L sizes. */
import sharp from "sharp";
import { PDFDocument, rgb } from "pdf-lib";

export const PRINT_SIZES = { exact: null, S: 50, M: 100, L: 200 } as const; // long side in mm
export type PrintSize = keyof typeof PRINT_SIZES;

const DPI = 300;
const BLEED_MM = 3;
const mmToPx = (mm: number) => Math.round((mm / 25.4) * DPI);
const mmToPt = (mm: number) => (mm / 25.4) * 72;

/** Target trim box in mm for the requested size, preserving the creative's aspect ratio. */
async function trimMm(creative: Buffer, size: PrintSize, space: { widthMm: number; heightMm: number }) {
  const m = await sharp(creative).metadata();
  const ar = (m.width ?? 1) / (m.height ?? 1);
  if (size === "exact") return { w: space.widthMm, h: space.heightMm, fit: "contain" as const };
  const long = PRINT_SIZES[size]!;
  return ar >= 1 ? { w: long, h: long / ar, fit: "fill" as const } : { w: long * ar, h: long, fit: "fill" as const };
}

async function raster(creative: Buffer, wMm: number, hMm: number) {
  const W = mmToPx(wMm + 2 * BLEED_MM), H = mmToPx(hMm + 2 * BLEED_MM);
  return sharp(creative)
    .flatten({ background: "#ffffff" })
    .resize(W, H, { fit: "contain", background: "#ffffff" })
    .withMetadata({ density: DPI })
    .png()
    .toBuffer();
}

export async function printFile(creative: Buffer, size: PrintSize, format: "pdf" | "png", space: { widthMm: number; heightMm: number; label: string; leaseName: string }) {
  const t = await trimMm(creative, size, space);
  const png = await raster(creative, t.w, t.h);
  if (format === "png") return { buf: png, mime: "image/png", filename: `${space.leaseName}-${size}.png` };
  const doc = await PDFDocument.create();
  const pageW = mmToPt(t.w + 2 * BLEED_MM + 20), pageH = mmToPt(t.h + 2 * BLEED_MM + 20);
  const page = doc.addPage([pageW, pageH]);
  const img = await doc.embedPng(png);
  const x0 = mmToPt(10), y0 = mmToPt(10);
  page.drawImage(img, { x: x0, y: y0, width: mmToPt(t.w + 2 * BLEED_MM), height: mmToPt(t.h + 2 * BLEED_MM) });
  // cut line (trim box)
  page.drawRectangle({
    x: x0 + mmToPt(BLEED_MM),
    y: y0 + mmToPt(BLEED_MM),
    width: mmToPt(t.w),
    height: mmToPt(t.h),
    borderColor: rgb(0.9, 0, 0.5),
    borderWidth: 0.5,
    borderDashArray: [3, 2],
  });
  page.drawText(`${space.leaseName} · ${size === "exact" ? `${space.label} ${t.w}×${t.h} mm` : `${size} ${Math.round(t.w)}×${Math.round(t.h)} mm`} · 3 mm bleed · cut on dashed line`, {
    x: x0,
    y: mmToPt(4),
    size: 6,
    color: rgb(0.3, 0.3, 0.3),
  });
  return { buf: Buffer.from(await doc.save()), mime: "application/pdf", filename: `${space.leaseName}-${size}.pdf` };
}
