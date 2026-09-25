/** P0 deterministic evidence metrics (AQS §3.1), computed with sharp on raw pixels. */
import sharp from "sharp";

export type Metrics = {
  width: number;
  height: number;
  shortSide: number;
  sharpness: number;
  clipPct: number;
  noise: number;
  meanL: number;
  contrastRatio: number;
  uniformity: number;
  phash: string;
  pxPerCm: number | null;
  eqi: number;
  retakeReasons: string[];
};

async function gray(buf: Buffer, longSide: number) {
  const img = sharp(buf, { failOn: "none" }).rotate();
  const { data, info } = await img
    .resize({ width: longSide, height: longSide, fit: "inside", withoutEnlargement: true })
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { data, w: info.width, h: info.height };
}

function laplacian(d: Buffer, w: number, h: number) {
  const out = new Float32Array((w - 2) * (h - 2));
  let k = 0;
  for (let y = 1; y < h - 1; y++)
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      out[k++] = d[i - w] + d[i + w] + d[i - 1] + d[i + 1] - 4 * d[i];
    }
  return out;
}

function variance(a: Float32Array) {
  let m = 0;
  for (const v of a) m += v;
  m /= a.length;
  let s = 0;
  for (const v of a) s += (v - m) ** 2;
  return s / a.length;
}

function median(a: number[]) {
  const s = [...a].sort((x, y) => x - y);
  return s[Math.floor(s.length / 2)] ?? 0;
}

/** DCT-based 64-bit perceptual hash (hex). */
export async function phash(buf: Buffer): Promise<string> {
  const N = 32;
  const { data } = await sharp(buf, { failOn: "none" }).rotate().resize(N, N, { fit: "fill" }).greyscale().raw().toBuffer({ resolveWithObject: true });
  const dct: number[][] = [];
  for (let u = 0; u < 8; u++) {
    dct[u] = [];
    for (let v = 0; v < 8; v++) {
      let s = 0;
      for (let x = 0; x < N; x++)
        for (let y = 0; y < N; y++)
          s += data[y * N + x] * Math.cos(((2 * x + 1) * u * Math.PI) / (2 * N)) * Math.cos(((2 * y + 1) * v * Math.PI) / (2 * N));
      dct[u][v] = s;
    }
  }
  const vals: number[] = [];
  for (let u = 0; u < 8; u++) for (let v = 0; v < 8; v++) if (u + v > 0) vals.push(dct[u][v]);
  const med = median(vals);
  let bits = "";
  for (let u = 0; u < 8; u++) for (let v = 0; v < 8; v++) bits += dct[u][v] > med ? "1" : "0";
  return BigInt("0b" + bits).toString(16).padStart(16, "0");
}

export function hamming(a: string, b: string) {
  let x = BigInt("0x" + a) ^ BigInt("0x" + b);
  let n = 0;
  while (x) {
    n += Number(x & 1n);
    x >>= 1n;
  }
  return n;
}

export async function computeMetrics(buf: Buffer, dims?: { widthMm: number; heightMm: number }): Promise<Metrics> {
  const meta = await sharp(buf, { failOn: "none" }).rotate().metadata();
  const width = meta.autoOrient?.width ?? meta.width ?? 0;
  const height = meta.autoOrient?.height ?? meta.height ?? 0;
  const shortSide = Math.min(width, height);
  const { data, w, h } = await gray(buf, 1024);

  const lap = laplacian(data, w, h);
  const sharpness = variance(lap);
  const absLap: number[] = [];
  for (let i = 0; i < lap.length; i += 7) absLap.push(Math.abs(lap[i]));
  const noise = median(absLap) / 0.6745;

  let clipped = 0,
    sum = 0;
  for (const v of data) {
    if (v <= 2 || v >= 253) clipped++;
    sum += v;
  }
  const clipPct = clipped / data.length;
  const meanL = sum / data.length;

  // Conspicuity: centre region (inner 60%) vs surrounding ring.
  let cSum = 0, cSq = 0, cN = 0, rSum = 0, rN = 0;
  const x0 = Math.floor(w * 0.2), x1 = Math.floor(w * 0.8), y0 = Math.floor(h * 0.2), y1 = Math.floor(h * 0.8);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const v = data[y * w + x];
      if (x >= x0 && x < x1 && y >= y0 && y < y1) {
        cSum += v;
        cSq += v * v;
        cN++;
      } else {
        rSum += v;
        rN++;
      }
    }
  const cMean = cSum / cN, rMean = rSum / rN;
  const lum = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const la = lum(cMean) + 0.05, lb = lum(rMean) + 0.05;
  const contrastRatio = Math.max(la, lb) / Math.min(la, lb);
  const uniformity = Math.sqrt(Math.max(0, cSq / cN - cMean ** 2));

  const pxPerCm = dims ? (shortSide * 0.8) / (Math.min(dims.widthMm, dims.heightMm) / 10) : null;
  const ph = await phash(buf);

  // Evidence Quality Index (weighted geometric mean of normalised factors).
  const nSharp = Math.min(1, sharpness / 250);
  const nClip = 1 - Math.min(1, clipPct * 5);
  const nNoise = 1 - Math.min(1, noise / 20);
  const nRes = pxPerCm == null ? Math.min(1, shortSide / 1500) : Math.min(1, pxPerCm / 40);
  const eqi = Math.pow(Math.max(0.01, nSharp), 0.35) * Math.pow(Math.max(0.01, nClip), 0.25) * Math.pow(Math.max(0.01, nNoise), 0.15) * Math.pow(Math.max(0.01, nRes), 0.25);

  const retakeReasons: string[] = [];
  if (sharpness < 100) retakeReasons.push("The photo is blurry — hold steady and tap to focus.");
  if (clipPct > 0.1) retakeReasons.push("The photo is over- or under-exposed — avoid glare and harsh light.");
  if (shortSide < 1500) retakeReasons.push("The photo resolution is too low — move closer or use the main camera.");

  return { width, height, shortSide, sharpness, clipPct, noise, meanL, contrastRatio, uniformity, phash: ph, pxPerCm, eqi, retakeReasons };
}

/** Detects an embedded C2PA manifest and whether it declares an AI (trained algorithmic) source. */
export function c2paScan(buf: Buffer): { hasManifest: boolean; aiGenerated: boolean } {
  const s = buf.toString("latin1");
  const hasManifest = s.includes("c2pa") && (s.includes("jumb") || s.includes("jumd"));
  const aiGenerated = hasManifest && /trainedAlgorithmicMedia|compositeWithTrainedAlgorithmicMedia/.test(s);
  return { hasManifest, aiGenerated };
}
