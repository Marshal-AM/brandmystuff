/** x402 paid flows: lease booking and sponsorship on behalf of agents. */
import { createHash } from "node:crypto";
import sharp from "sharp";
import { SUI } from "@/lib/deployment";
import * as T from "@/lib/sui/tx";
import { HttpError } from "./auth";
import { db, q, ok } from "./db";
import { ingestDigest } from "./indexer";
import { execute, findEvent } from "./sui";
import { storeBlob } from "./walrus";
import { sui } from "./sui";
import { requirements, type PaymentRequirements } from "./x402";

export async function resolveSpace(ref: { spaceId?: string; ensName?: string }) {
  const s = ref.spaceId
    ? await q(db().from("spaces").select("*").eq("id", ref.spaceId).maybeSingle())
    : await q(db().from("spaces").select("*").eq("ens_name", (ref.ensName ?? "").toLowerCase()).maybeSingle());
  if (!s) throw new HttpError(404, "Space not found");
  return s;
}

export async function bookedWeeks(spaceId: string) {
  const ls = await q(db().from("leases").select("start_ms, week_ms, weeks").eq("space_id", spaceId).neq("status", "cancelled"));
  return new Set(ls.flatMap((l: any) => Array.from({ length: l.weeks }, (_, i) => Math.floor(Number(l.start_ms) / Number(l.week_ms)) + i)));
}

export async function quoteLease(s: any, weeks: number, startWeek?: number) {
  if (s.status !== "available") throw new HttpError(409, "Space is not available");
  if (!(weeks >= 1 && weeks <= 52)) throw new HttpError(400, "weeks must be 1-52");
  const wk = Number(s.week_ms);
  const current = Math.floor(Date.now() / wk);
  const booked = await bookedWeeks(s.id);
  let start = startWeek ?? current;
  if (startWeek == null) {
    while ([...Array(weeks).keys()].some((i) => booked.has(start + i))) start++;
  } else {
    if (start < current) throw new HttpError(400, "startWeek is in the past");
    if ([...Array(weeks).keys()].some((i) => booked.has(start + i))) throw new HttpError(409, "Requested weeks are already booked");
  }
  const amount = BigInt(s.price_per_week) * BigInt(weeks);
  return { startWeek: start, weeks, amount, startMs: start * wk, endMs: (start + weeks) * wk, weekMs: wk };
}

async function fetchCreative(url: string) {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    throw new HttpError(400, "creativeUrl is not a valid URL");
  }
  if (!["https:", "http:"].includes(u.protocol)) throw new HttpError(400, "creativeUrl must be http(s)");
  const r = await fetch(u, { redirect: "follow" });
  if (!r.ok) throw new HttpError(400, `Could not fetch creative (${r.status})`);
  const buf = Buffer.from(await r.arrayBuffer());
  if (buf.length > 10 * 1024 * 1024) throw new HttpError(400, "Creative must be ≤ 10 MB");
  let png: Buffer;
  try {
    png = await sharp(buf, { density: 600 }).png().toBuffer();
  } catch {
    throw new HttpError(400, "Creative must be an image (PNG/JPEG/WEBP/SVG)");
  }
  return png;
}

export async function createLeaseIntent(input: { spaceId?: string; ensName?: string; weeks: number; startWeek?: number; creativeUrl: string; landingUrl: string; brand: string }) {
  const s = await resolveSpace(input);
  const qt = await quoteLease(s, input.weeks, input.startWeek);
  const png = await fetchCreative(input.creativeUrl);
  const stored = await storeBlob(png, "image/png");
  const payload = {
    spaceId: s.id,
    calendarId: s.calendar_id,
    ensName: s.ens_name,
    startWeek: qt.startWeek,
    weeks: input.weeks,
    creativeBlobId: stored.blobId,
    creativeHash: createHash("sha256").update(png).digest("hex"),
    landingUrl: input.landingUrl,
    brand: input.brand,
  };
  const intent = await q(
    db().from("x402_intents").insert({ kind: "lease", payload, amount: String(qt.amount), pay_to: SUI.platformAddress, expires_at: new Date(Date.now() + 10 * 60_000).toISOString() }).select("*").single(),
  );
  return { intent, requirements: requirements(qt.amount, { intentId: intent.id, kind: "lease", space: s.ens_name, startWeek: qt.startWeek, weeks: input.weeks }), quote: qt };
}

export async function sponsorPrice(tier: 1 | 2) {
  const r: any = await sui().getObject({ objectId: SUI.configId, include: { json: true } });
  const prices = r.object?.json?.sponsor_price_per_day ?? [100000, 300000];
  return BigInt(prices[tier - 1]);
}

export async function createSponsorIntent(input: { objectId?: string; ensName?: string; tier: 1 | 2; days: number }) {
  const o = input.objectId
    ? await q(db().from("objects").select("*").eq("id", input.objectId).maybeSingle())
    : await q(db().from("objects").select("*").eq("ens_name", (input.ensName ?? "").toLowerCase()).maybeSingle());
  if (!o) throw new HttpError(404, "Object not found");
  if (!(input.days >= 1 && input.days <= 90)) throw new HttpError(400, "days must be 1-90");
  const amount = (await sponsorPrice(input.tier)) * BigInt(input.days);
  const intent = await q(
    db()
      .from("x402_intents")
      .insert({ kind: "sponsorship", payload: { objectId: o.id, tier: input.tier, days: input.days }, amount: String(amount), pay_to: SUI.platformAddress, expires_at: new Date(Date.now() + 10 * 60_000).toISOString() })
      .select("*")
      .single(),
  );
  return { intent, requirements: requirements(amount, { intentId: intent.id, kind: "sponsorship", object: o.ens_name, tier: input.tier, days: input.days }) };
}

/** After settlement: perform the paid action with the received USDC; refund on failure. */
export async function fulfil(intent: any, payer: string, paymentDigest: string) {
  const p = intent.payload;
  try {
    let result: any;
    if (intent.kind === "lease") {
      const r = await execute(
        T.bookFor({
          spaceId: p.spaceId,
          calendarId: p.calendarId,
          amount: BigInt(intent.amount),
          startWeek: BigInt(p.startWeek),
          weeks: p.weeks,
          creativeBlobId: p.creativeBlobId,
          creativeHash: p.creativeHash,
          landingUrl: p.landingUrl,
          brand: p.brand,
          advertiser: payer,
        }),
      );
      await ingestDigest(r.digest);
      const ev = findEvent(r, "LeaseBooked");
      result = { leaseId: ev.lease_id, escrowId: ev.escrow_id, ensName: `${ev.ens_label}.${p.ensName}`, startMs: String(ev.start_ms), weeks: Number(ev.weeks), bookingDigest: r.digest, status: "pending_approval" };
    } else {
      const r = await execute(T.buySponsorshipFor({ objectId: p.objectId, amount: BigInt(intent.amount), tier: p.tier, days: p.days, payer }));
      await ingestDigest(r.digest);
      const ev = findEvent(r, "Sponsored");
      result = { objectId: p.objectId, sponsoredUntil: new Date(Number(ev.sponsored_until_ms)).toISOString(), digest: r.digest };
    }
    await ok(db().from("x402_intents").update({ status: "fulfilled", payer, payment_digest: paymentDigest, result }).eq("id", intent.id));
    return { ok: true as const, result };
  } catch (e: any) {
    const refund = await execute(T.sendCoin({ coinType: SUI.usdcType, amount: BigInt(intent.amount), to: payer }));
    await ok(db().from("x402_intents").update({ status: "refunded", payer, payment_digest: paymentDigest, error: String(e?.message ?? e).slice(0, 500), result: { refundDigest: refund.digest } }).eq("id", intent.id));
    return { ok: false as const, error: String(e?.message ?? e), refundDigest: refund.digest };
  }
}

export type { PaymentRequirements };
