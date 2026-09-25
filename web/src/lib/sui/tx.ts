/**
 * Transaction builders for every brandmystuff Move entry point.
 * Isomorphic: used by the browser (user-signed) and the server (operator / tests).
 */
import { Transaction } from "@mysten/sui/transactions";
import { SUI } from "../deployment";

const t = (m: string, f: string) => `${SUI.packageId}::${m}::${f}`;
const U = SUI.usdcType;
const bytes = (tx: Transaction, v: Uint8Array | number[]) => tx.pure.vector("u8", Array.from(v));
const hexBytes = (hex: string) => {
  const h = hex.replace(/^0x/, "");
  const out = new Uint8Array(h.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(h.slice(i * 2, i * 2 + 2), 16);
  return out;
};
export { hexBytes };

// === profile ===
export function createProfile(p: { ensName: string; ensNamehash: string }) {
  const tx = new Transaction();
  tx.moveCall({ target: t("profile", "create"), arguments: [tx.pure.string(p.ensName), bytes(tx, hexBytes(p.ensNamehash)), tx.object.clock()] });
  return tx;
}

// === asset ===
export function createObject(p: {
  category: number; title: string; city: string; ensName: string; ensNamehash: string; heroBlobId: string; manifestBlobId: string;
}) {
  const tx = new Transaction();
  tx.moveCall({
    target: t("asset", "create_object"),
    arguments: [
      tx.object(SUI.configId), tx.pure.u16(p.category), tx.pure.string(p.title), tx.pure.string(p.city),
      tx.pure.string(p.ensName), bytes(tx, hexBytes(p.ensNamehash)), tx.pure.string(p.heroBlobId), tx.pure.string(p.manifestBlobId), tx.object.clock(),
    ],
  });
  return tx;
}

export function addSpace(p: {
  objectId: string; label: string; ensName: string; ensNamehash: string; widthMm: number; heightMm: number;
  placement: number; closeupBlobId: string; pricePerWeek: bigint;
}) {
  const tx = new Transaction();
  tx.moveCall({
    target: t("asset", "add_space"),
    arguments: [
      tx.object(SUI.configId), tx.object(p.objectId), tx.pure.string(p.label), tx.pure.string(p.ensName), bytes(tx, hexBytes(p.ensNamehash)),
      tx.pure.u32(p.widthMm), tx.pure.u32(p.heightMm), tx.pure.u8(p.placement), tx.pure.string(p.closeupBlobId), tx.pure.u64(p.pricePerWeek), tx.object.clock(),
    ],
  });
  return tx;
}

export function applyScore(tx: Transaction, p: {
  spaceId: string; aqs: number; grade: number; confidenceBps: number; rankX100: number; rubric: string; reportBlobId: string; reportHash: string;
}) {
  tx.moveCall({
    target: t("asset", "apply_score"),
    arguments: [
      tx.object(SUI.operatorCapId), tx.object(SUI.configId), tx.object(p.spaceId), tx.pure.u8(p.aqs), tx.pure.u8(p.grade),
      tx.pure.u16(p.confidenceBps), tx.pure.u32(p.rankX100), tx.pure.string(p.rubric), tx.pure.string(p.reportBlobId), bytes(tx, hexBytes(p.reportHash)), tx.object.clock(),
    ],
  });
  return tx;
}

export function setObjectScore(tx: Transaction, p: { objectId: string; aqs: number; grade: number }) {
  tx.moveCall({ target: t("asset", "set_object_score"), arguments: [tx.object(SUI.operatorCapId), tx.object(p.objectId), tx.pure.u8(p.aqs), tx.pure.u8(p.grade)] });
  return tx;
}

export function setPrice(p: { spaceId: string; pricePerWeek: bigint }) {
  const tx = new Transaction();
  tx.moveCall({ target: t("asset", "set_price"), arguments: [tx.object(p.spaceId), tx.pure.u64(p.pricePerWeek)] });
  return tx;
}

export function spaceStatus(p: { spaceId: string; action: "pause_space" | "unpause_space" | "retire_space" }) {
  const tx = new Transaction();
  tx.moveCall({ target: t("asset", p.action), arguments: [tx.object(p.spaceId)] });
  return tx;
}

export function takedown(p: { spaceId: string }) {
  const tx = new Transaction();
  tx.moveCall({ target: t("asset", "takedown"), arguments: [tx.object(SUI.adminCapId), tx.object(p.spaceId)] });
  return tx;
}

// === lease ===
type BookArgs = {
  spaceId: string; calendarId: string; amount: bigint; startWeek: bigint; weeks: number;
  creativeBlobId: string; creativeHash: string; landingUrl: string; brand: string;
};

export function book(p: BookArgs) {
  const tx = new Transaction();
  tx.moveCall({
    target: t("lease", "book"),
    typeArguments: [U],
    arguments: [
      tx.object(SUI.configId), tx.object(p.spaceId), tx.object(p.calendarId), tx.coin({ type: U, balance: p.amount }),
      tx.pure.u64(p.startWeek), tx.pure.u64(p.weeks), tx.pure.string(p.creativeBlobId), bytes(tx, hexBytes(p.creativeHash)),
      tx.pure.string(p.landingUrl), tx.pure.string(p.brand), tx.object.clock(),
    ],
  });
  return tx;
}

/** Operator books on behalf of an x402 payer, funding escrow from the treasury's USDC. */
export function bookFor(p: BookArgs & { advertiser: string }) {
  const tx = new Transaction();
  tx.moveCall({
    target: t("lease", "book_for"),
    typeArguments: [U],
    arguments: [
      tx.object(SUI.operatorCapId), tx.object(SUI.configId), tx.object(p.spaceId), tx.object(p.calendarId), tx.coin({ type: U, balance: p.amount }),
      tx.pure.u64(p.startWeek), tx.pure.u64(p.weeks), tx.pure.string(p.creativeBlobId), bytes(tx, hexBytes(p.creativeHash)),
      tx.pure.string(p.landingUrl), tx.pure.string(p.brand), tx.pure.address(p.advertiser), tx.object.clock(),
    ],
  });
  return tx;
}

export function approveCreative(p: { escrowId: string }) {
  const tx = new Transaction();
  tx.moveCall({ target: t("lease", "approve_creative"), typeArguments: [U], arguments: [tx.object(p.escrowId), tx.object.clock()] });
  return tx;
}

export function rejectCreative(p: { escrowId: string; spaceId: string; calendarId: string }) {
  const tx = new Transaction();
  tx.moveCall({ target: t("lease", "reject_creative"), typeArguments: [U], arguments: [tx.object(p.escrowId), tx.object(p.spaceId), tx.object(p.calendarId)] });
  return tx;
}

export function expireUnapproved(p: { escrowId: string; spaceId: string; calendarId: string }) {
  const tx = new Transaction();
  tx.moveCall({ target: t("lease", "expire_unapproved"), typeArguments: [U], arguments: [tx.object(p.escrowId), tx.object(p.spaceId), tx.object(p.calendarId), tx.object.clock()] });
  return tx;
}

export function acceptProof(p: {
  escrowId: string; spaceId: string; offeringId?: string | null; period: number; photoBlobId: string; matchBps: number; objectBps: number;
}) {
  const tx = new Transaction();
  const common = [tx.pure.u64(p.period), tx.pure.string(p.photoBlobId), tx.pure.u16(p.matchBps), tx.pure.u16(p.objectBps), tx.object.clock()];
  if (p.offeringId) {
    tx.moveCall({
      target: t("lease", "accept_proof_tokenised"),
      typeArguments: [U],
      arguments: [tx.object(SUI.operatorCapId), tx.object(SUI.configId), tx.object(p.escrowId), tx.object(p.spaceId), tx.object(p.offeringId), ...common],
    });
  } else {
    tx.moveCall({
      target: t("lease", "accept_proof"),
      typeArguments: [U],
      arguments: [tx.object(SUI.operatorCapId), tx.object(SUI.configId), tx.object(p.escrowId), tx.object(p.spaceId), ...common],
    });
  }
  return tx;
}

export function refundMissed(p: { escrowId: string; spaceId: string; period: number }) {
  const tx = new Transaction();
  tx.moveCall({ target: t("lease", "refund_missed"), typeArguments: [U], arguments: [tx.object(p.escrowId), tx.object(p.spaceId), tx.pure.u64(p.period), tx.object.clock()] });
  return tx;
}

export function openDispute(p: { escrowId: string }) {
  const tx = new Transaction();
  tx.moveCall({ target: t("lease", "open_dispute"), typeArguments: [U], arguments: [tx.object(p.escrowId), tx.object.clock()] });
  return tx;
}

export function resolveDispute(p: { escrowId: string; spaceId: string; refund: boolean }) {
  const tx = new Transaction();
  tx.moveCall({ target: t("lease", "resolve_dispute"), typeArguments: [U], arguments: [tx.object(SUI.adminCapId), tx.object(p.escrowId), tx.object(p.spaceId), tx.pure.bool(p.refund)] });
  return tx;
}

export function adminRefund(p: { escrowId: string; spaceId: string }) {
  const tx = new Transaction();
  tx.moveCall({ target: t("lease", "admin_refund"), typeArguments: [U], arguments: [tx.object(SUI.adminCapId), tx.object(p.escrowId), tx.object(p.spaceId)] });
  return tx;
}

export function extendLease(p: { escrowId: string; leaseId: string; spaceId: string; calendarId: string; amount: bigint; extraWeeks: number }) {
  const tx = new Transaction();
  tx.moveCall({
    target: t("lease", "extend"),
    typeArguments: [U],
    arguments: [tx.object(SUI.configId), tx.object(p.escrowId), tx.object(p.leaseId), tx.object(p.spaceId), tx.object(p.calendarId), tx.coin({ type: U, balance: p.amount }), tx.pure.u64(p.extraWeeks)],
  });
  return tx;
}

// === kyc ===
export function setKycRecord(p: { who: string; investorType: number; country: string; expiresMs: bigint; refHash: string }) {
  const tx = new Transaction();
  tx.moveCall({
    target: t("kyc", "set_record"),
    arguments: [
      tx.object(SUI.operatorCapId), tx.object(SUI.kycRegistryId), tx.pure.address(p.who), tx.pure.u8(p.investorType),
      bytes(tx, new TextEncoder().encode(p.country)), tx.pure.u64(p.expiresMs), bytes(tx, hexBytes(p.refHash)),
    ],
  });
  return tx;
}

export function setKycFrozen(p: { who: string; frozen: boolean }) {
  const tx = new Transaction();
  tx.moveCall({ target: t("kyc", "set_frozen"), arguments: [tx.object(SUI.adminCapId), tx.object(SUI.kycRegistryId), tx.pure.address(p.who), tx.pure.bool(p.frozen)] });
  return tx;
}

// === offering ===
export function createOffering(p: {
  spaceId: string; revenueShareBps: number; retainedUnits: number; pricePerUnit: bigint; minRaiseUnits: number; saleDurationMs: bigint;
  perInvestorMax: number; termMonths: number; legalPackHash: string; legalPackBlobId: string; ownerAcceptSigHash: string;
}) {
  const tx = new Transaction();
  tx.moveCall({
    target: t("offering", "create"),
    typeArguments: [U],
    arguments: [
      tx.object(SUI.configId), tx.object(p.spaceId), tx.object(SUI.kycRegistryId), tx.pure.u64(p.revenueShareBps), tx.pure.u64(p.retainedUnits),
      tx.pure.u64(p.pricePerUnit), tx.pure.u64(p.minRaiseUnits), tx.pure.u64(p.saleDurationMs), tx.pure.u64(p.perInvestorMax), tx.pure.u64(p.termMonths),
      bytes(tx, hexBytes(p.legalPackHash)), tx.pure.string(p.legalPackBlobId), bytes(tx, hexBytes(p.ownerAcceptSigHash)), tx.object.clock(),
    ],
  });
  return tx;
}

export function buyPrimary(p: { offeringId: string; units: number; amount: bigint; acceptSigHash: string }) {
  const tx = new Transaction();
  tx.moveCall({
    target: t("offering", "buy_primary"),
    typeArguments: [U],
    arguments: [
      tx.object(SUI.configId), tx.object(p.offeringId), tx.object(SUI.kycRegistryId), tx.coin({ type: U, balance: p.amount }),
      tx.pure.u64(p.units), bytes(tx, hexBytes(p.acceptSigHash)), tx.object.clock(),
    ],
  });
  return tx;
}

export function closeOffering(p: { offeringId: string; spaceId: string }) {
  const tx = new Transaction();
  tx.moveCall({ target: t("offering", "close"), typeArguments: [U], arguments: [tx.object(SUI.configId), tx.object(p.offeringId), tx.object(p.spaceId), tx.object.clock()] });
  return tx;
}

export function refundOffering(p: { offeringId: string }) {
  const tx = new Transaction();
  tx.moveCall({ target: t("offering", "refund"), typeArguments: [U], arguments: [tx.object(p.offeringId)] });
  return tx;
}

export function claim(p: { offeringId: string }) {
  const tx = new Transaction();
  tx.moveCall({ target: t("offering", "claim"), typeArguments: [U], arguments: [tx.object(p.offeringId)] });
  return tx;
}

// === market ===
export function listUnits(p: { offeringId: string; units: number; pricePerUnit: bigint }) {
  const tx = new Transaction();
  tx.moveCall({ target: t("market", "list"), typeArguments: [U], arguments: [tx.object(SUI.configId), tx.object(p.offeringId), tx.pure.u64(p.units), tx.pure.u64(p.pricePerUnit)] });
  return tx;
}

export function fillListing(p: { offeringId: string; listingId: string; units: number; amount: bigint }) {
  const tx = new Transaction();
  tx.moveCall({
    target: t("market", "fill"),
    typeArguments: [U],
    arguments: [
      tx.object(SUI.configId), tx.object(p.offeringId), tx.object(p.listingId), tx.object(SUI.kycRegistryId),
      tx.coin({ type: U, balance: p.amount }), tx.pure.u64(p.units), tx.object.clock(),
    ],
  });
  return tx;
}

export function cancelListing(p: { offeringId: string; listingId: string }) {
  const tx = new Transaction();
  tx.moveCall({ target: t("market", "cancel"), typeArguments: [U], arguments: [tx.object(p.offeringId), tx.object(p.listingId)] });
  return tx;
}

// === sponsor ===
export function buySponsorship(p: { objectId: string; amount: bigint; tier: 1 | 2; days: number }) {
  const tx = new Transaction();
  tx.moveCall({
    target: t("sponsor", "buy_sponsorship"),
    typeArguments: [U],
    arguments: [tx.object(SUI.configId), tx.object(p.objectId), tx.coin({ type: U, balance: p.amount }), tx.pure.u8(p.tier), tx.pure.u64(p.days), tx.object.clock()],
  });
  return tx;
}

export function buySponsorshipFor(p: { objectId: string; amount: bigint; tier: 1 | 2; days: number; payer: string }) {
  const tx = new Transaction();
  tx.moveCall({
    target: t("sponsor", "buy_sponsorship_for"),
    typeArguments: [U],
    arguments: [
      tx.object(SUI.operatorCapId), tx.object(SUI.configId), tx.object(p.objectId), tx.coin({ type: U, balance: p.amount }),
      tx.pure.u8(p.tier), tx.pure.u64(p.days), tx.pure.address(p.payer), tx.object.clock(),
    ],
  });
  return tx;
}

// === wallet ===
export function sendCoin(p: { coinType: string; amount: bigint; to: string }) {
  const tx = new Transaction();
  tx.transferObjects([tx.coin({ type: p.coinType, balance: p.amount })], tx.pure.address(p.to));
  return tx;
}

export const EVENT = (module: string, name: string) => `${SUI.packageId}::${module}::${name}`;
export const MODULES = ["admin", "profile", "asset", "kyc", "lease", "offering", "market", "sponsor"] as const;
