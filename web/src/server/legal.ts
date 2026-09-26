/** Mock legal document pack for offerings (TOKENISATION-SPEC §1): generated PDFs on Walrus, hashed. */
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { sha256Hex, storeBlob, storeJson } from "./walrus";

type PackInput = {
  seriesNo: string;
  spaceEns: string;
  spaceId: string;
  ownerAddress: string;
  ownerName: string;
  revenueShareBps: number;
  retainedUnits: number;
  pricePerUnit: bigint;
  minRaiseUnits: number;
  saleDurationMs: number;
  perInvestorMax: number;
  termMonths: number;
  aqs: number;
  grade: string;
  completedLeases: number;
  pricePerWeek: bigint;
};

const usd = (a: bigint | number) => `${(Number(a) / 1e6).toFixed(6).replace(/0+$/, "").replace(/\.$/, "")} USDC`;

async function pdf(title: string, sections: [string, string][]) {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  let page = doc.addPage([595, 842]);
  let y = 790;
  const line = (text: string, f = font, size = 10, color = rgb(0.1, 0.1, 0.12)) => {
    const words = text.split(" ");
    let cur = "";
    const flush = () => {
      if (y < 60) {
        page = doc.addPage([595, 842]);
        y = 790;
      }
      page.drawText(cur, { x: 56, y, size, font: f, color });
      y -= size + 5;
      cur = "";
    };
    for (const w of words) {
      if (f.widthOfTextAtSize(cur + " " + w, size) > 483) flush();
      cur = cur ? cur + " " + w : w;
    }
    if (cur) flush();
  };
  page.drawRectangle({ x: 0, y: 812, width: 595, height: 30, color: rgb(0.98, 0.93, 0.8) });
  page.drawText("TESTNET DEMO — MOCK LEGAL DOCUMENT — NOT AN OFFER OF SECURITIES", { x: 56, y: 822, size: 9, font: bold, color: rgb(0.55, 0.3, 0) });
  line(title, bold, 16);
  y -= 6;
  for (const [h, body] of sections) {
    y -= 6;
    line(h, bold, 11);
    for (const para of body.split("\n")) line(para);
  }
  return Buffer.from(await doc.save());
}

/** Progress events emitted while a pack is built (streamed to the tokenise page). */
export type PackEvent =
  | { t: "draft"; key: string; title: string; bytes: number }
  | { t: "store"; key: string; title: string; blobId: string; sha256: string }
  | { t: "hash"; packHash: string }
  | { t: "index"; blobId: string };

export async function buildLegalPack(i: PackInput, onProgress?: (e: PackEvent) => void | Promise<void>) {
  const date = new Date().toISOString().slice(0, 10);
  const series = `BMS Assets LLC — Series ${i.seriesNo}`;
  const offered = 10_000 - i.retainedUnits;
  const docs: { key: string; title: string; buf: Buffer }[] = [];
  docs.push({
    key: "series-certificate",
    title: "Series Certificate",
    buf: await pdf(`Certificate of Designation — ${series}`, [
      ["Designation", `${series} is designated as a protected series of BMS Assets LLC (a mock Delaware series limited liability company) on ${date}.`],
      ["Asset", `The series holds the revenue participation rights of the ad space ${i.spaceEns} (Sui object ${i.spaceId}).`],
      ["Units", `10,000 revenue units are authorised. ${i.retainedUnits.toLocaleString()} are retained by the sponsor-owner and ${offered.toLocaleString()} are offered.`],
      ["Manager", "BrandMyStuff Inc. (mock) acts as managing member and platform operator."],
    ]),
  });
  docs.push({
    key: "revenue-participation-agreement",
    title: "Revenue Participation Agreement",
    buf: await pdf("Revenue Participation Agreement", [
      ["Parties", `Owner: ${i.ownerName} (${i.ownerAddress}). Series: ${series}.`],
      ["Assignment", `The Owner assigns to the Series ${(i.revenueShareBps / 100).toFixed(2)}% of the gross lease revenue of ${i.spaceEns} released from escrow on brandmystuff for a term of ${i.termMonths} months from the date of this agreement.`],
      ["Owner obligations", "The Owner shall (a) keep the object in normal use, (b) display leased creatives as approved, (c) submit proof-of-display photos every lease period, (d) maintain the surface in a condition consistent with its listing score, and (e) not sell or retire the object without assignment of this agreement."],
      ["Payment mechanics", "Revenue is escrowed on Sui and released per accepted proof. The platform fee (12%) is deducted first; the Series share is distributed pro-rata to all unit holders by the smart contract; the remainder is paid to the Owner."],
      ["Title", "The Owner retains physical title to the object. Only the revenue participation right is assigned."],
    ]),
  });
  docs.push({
    key: "offering-memorandum",
    title: "Offering Memorandum",
    buf: await pdf(`Offering Memorandum — ${series}`, [
      ["The space", `${i.spaceEns}. Ad-Space Quality Score ${i.aqs}/100 (grade ${i.grade}). Completed leases: ${i.completedLeases}. Current lease price: ${usd(i.pricePerWeek)} per week.`],
      ["The offering", `${offered.toLocaleString()} units at ${usd(i.pricePerUnit)} per unit (total ${usd(i.pricePerUnit * BigInt(offered))}). Minimum raise: ${i.minRaiseUnits.toLocaleString()} units. Maximum per investor: ${i.perInvestorMax.toLocaleString()} units. Sale window: ${Math.round(i.saleDurationMs / 60000)} minutes.`],
      ["Economics", `Unit holders receive ${(i.revenueShareBps / 100).toFixed(2)}% of every released lease tranche, shared pro-rata across all issued units. Distributions accrue on-chain and can be claimed at any time.`],
      ["Fees", "Platform lease fee 12% of gross. Origination fee 3% of the raise. Secondary trades 1%."],
      ["Transfers", "Units can only be held and traded by verified investors, on the brandmystuff internal market."],
    ]),
  });
  docs.push({
    key: "risk-factors",
    title: "Risk Factors",
    buf: await pdf("Risk Factors", [
      ["Demand risk", "There is no guarantee the space will be leased. Past leases do not predict future income."],
      ["Owner risk", "Income depends on the owner installing creatives and submitting proofs. Missed proofs are refunded to advertisers, not paid to holders."],
      ["Asset risk", "The object may be lost, damaged, sold or stop being used."],
      ["AI scoring risk", "Quality scores are produced by an AI model and may be wrong."],
      ["Smart-contract risk", "Contracts are unaudited testnet code. Funds are test USDC with no value."],
      ["Liquidity risk", "Units may be hard to sell; the internal market has no market maker."],
      ["Regulatory", "This is a testnet demonstration. No real securities are offered or sold."],
    ]),
  });
  docs.push({
    key: "subscription-agreement",
    title: "Subscription Agreement",
    buf: await pdf(`Subscription Agreement — ${series}`, [
      ["Subscription", `The Investor subscribes for the number of units stated in their on-chain purchase at ${usd(i.pricePerUnit)} per unit.`],
      ["Representations", "The Investor confirms they completed identity verification, read the Offering Memorandum and Risk Factors, and understand units are illiquid and may lose all value."],
      ["Acceptance", "The Investor accepts this agreement by signing the message brandmystuff:accept:<offering>:<pack hash>:<units> with their wallet; the signature hash is recorded on-chain with the purchase."],
    ]),
  });

  for (const d of docs) await onProgress?.({ t: "draft", key: d.key, title: d.title, bytes: d.buf.length });
  const stored = [];
  for (const d of docs) {
    const s = await storeBlob(d.buf, "application/pdf");
    stored.push({ key: d.key, title: d.title, blobId: s.blobId, sha256: s.sha256 });
    await onProgress?.({ t: "store", key: d.key, title: d.title, blobId: s.blobId, sha256: s.sha256 });
  }
  const packHash = sha256Hex(Buffer.from(stored.map((s) => s.sha256).sort().join(""), "hex"));
  await onProgress?.({ t: "hash", packHash });
  const index = { series, seriesNo: i.seriesNo, createdAt: new Date().toISOString(), packHash, documents: stored, testnetMock: true };
  const idx = await storeJson(index);
  await onProgress?.({ t: "index", blobId: idx.blobId });
  return { ...index, indexBlobId: idx.blobId };
}

export const acceptanceMessage = (ref: string, packHash: string, units: number) => `brandmystuff:accept:${ref}:${packHash}:${units}`;
