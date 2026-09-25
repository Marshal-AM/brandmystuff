/**
 * Full-stack e2e (F1–F20 backend): real HTTP API + Sui testnet + Walrus + Gemini + ENSv2 relayer.
 * Actors are fresh keypairs that sign in with "Sign in with Sui". Requires `pnpm dev` (web on :3010 + worker).
 * Run: npx tsx e2e/flows.e2e.ts
 */
import { config } from "dotenv";
import { resolve } from "node:path";
config({ path: resolve(__dirname, "../../.env.local") });

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import sharp from "sharp";
import postgres from "postgres";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { Transaction } from "@mysten/sui/transactions";
import { toBase64 } from "@mysten/sui/utils";
import { SUI } from "../src/lib/deployment";
import * as T from "../src/lib/sui/tx";
import { balances, execute, sui } from "../src/server/sui";

const BASE = process.env.E2E_BASE ?? "http://localhost:3010";
const fx = (f: string) => readFileSync(resolve(__dirname, "fixtures", f));
const step = (s: string) => console.log(`\n▶ ${s}`);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const rand = Math.random().toString(36).slice(2, 7);

type Actor = { name: string; kp: Ed25519Keypair; address: string; token?: string; userId?: string };
const actor = (name: string): Actor => {
  const kp = new Ed25519Keypair();
  return { name, kp, address: kp.toSuiAddress() };
};

async function http(a: Actor | null, path: string, init: RequestInit & { json?: unknown } = {}) {
  const headers = new Headers(init.headers);
  if (a?.token) headers.set("authorization", `Bearer ${a.token}`);
  let body = init.body;
  if (init.json !== undefined) {
    headers.set("content-type", "application/json");
    body = JSON.stringify(init.json);
  }
  const res = await fetch(BASE + path, { ...init, headers, body });
  const ct = res.headers.get("content-type") ?? "";
  const data: any = ct.includes("json") ? await res.json() : await res.arrayBuffer();
  return { status: res.status, data, headers: res.headers };
}
async function api(a: Actor | null, path: string, init: RequestInit & { json?: unknown } = {}) {
  const r = await http(a, path, init);
  if (r.status >= 400) throw new Error(`${init.method ?? "GET"} ${path} → ${r.status}: ${JSON.stringify(r.data).slice(0, 400)}`);
  return r.data;
}
const form = (fields: Record<string, string | Blob>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return f;
};
const file = (buf: Buffer, name: string, type = "image/jpeg") => new File([new Uint8Array(buf)], name, { type });

async function signIn(a: Actor) {
  const n = await api(null, `/api/auth/sui/nonce?address=${a.address}`);
  const { signature } = await a.kp.signPersonalMessage(new TextEncoder().encode(n.message));
  const r = await api(null, "/api/auth/sui/verify", { method: "POST", json: { address: a.address, message: n.message, signature } });
  a.token = r.token;
  a.userId = r.user.id;
}

async function runTx(a: Actor, tx: Transaction) {
  const r = await execute(tx, a.kp);
  const synced = await api(a, "/api/sync", { method: "POST", json: { digest: r.digest } });
  return { digest: r.digest, events: synced.events as { type: string; json: any }[] };
}
const ev = (r: { events: any[] }, name: string) => r.events.find((e) => e.type.endsWith(name))?.json;

async function fund(to: string, suiMist: bigint, usdc: bigint) {
  const tx = new Transaction();
  tx.transferObjects([tx.coin({ balance: suiMist })], tx.pure.address(to));
  if (usdc > 0n) tx.transferObjects([tx.coin({ type: SUI.usdcType, balance: usdc })], tx.pure.address(to));
  await execute(tx);
}

async function sweep(a: Actor) {
  try {
    const b = await balances(a.address);
    if (b.usdc > 0n) await execute(T.sendCoin({ coinType: SUI.usdcType, amount: b.usdc, to: SUI.platformAddress }), a.kp);
    const s = (await balances(a.address)).sui;
    if (s > 10_000_000n) await execute(T.sendCoin({ coinType: "0x2::sui::SUI", amount: s - 10_000_000n, to: SUI.platformAddress }), a.kp);
  } catch (e: any) {
    console.warn("sweep", a.name, e.message);
  }
}

async function logoPng(text: string) {
  return sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="600"><rect width="1200" height="600" rx="60" fill="#ff5a1f"/><text x="600" y="380" font-size="260" font-family="Helvetica" font-weight="bold" text-anchor="middle" fill="#fff">${text}</text></svg>`))
    .png()
    .toBuffer();
}

/** Simulates a fresh proof photo: a different framing of the lid each time, with the creative stuck on it and a note with the capture code. */
const FRAMES = [
  { x0: 0.5, y0: 0.1, x1: 0.97, y1: 0.8, rot: 0 },
  { x0: 0.38, y0: 0.05, x1: 0.9, y1: 0.7, rot: 7 },
  { x0: 0.55, y0: 0.2, x1: 0.99, y1: 0.95, rot: -6 },
  { x0: 0.3, y0: 0.12, x1: 0.85, y1: 0.9, rot: 4 },
  { x0: 0.45, y0: 0.0, x1: 0.95, y1: 0.6, rot: -9 },
  { x0: 0.35, y0: 0.25, x1: 0.95, y1: 0.98, rot: 10 },
];
async function proofPhoto(creative: Buffer, code: string, variant: number) {
  const src = sharp(fx("laptop-hero.jpg"));
  const m = await src.metadata();
  const f = FRAMES[variant % FRAMES.length];
  const region = await sharp(fx("laptop-hero.jpg"))
    .extract({ left: Math.round(f.x0 * m.width!), top: Math.round(f.y0 * m.height!), width: Math.round((f.x1 - f.x0) * m.width!), height: Math.round((f.y1 - f.y0) * m.height!) })
    .resize(1800)
    .toBuffer();
  const rm = await sharp(region).metadata();
  const W = rm.width!, H = rm.height!;
  const sticker = await sharp(creative).resize(Math.round(W * 0.42)).png().toBuffer();
  const sm = await sharp(sticker).metadata();
  const note = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.round(W * 0.34)}" height="${Math.round(H * 0.14)}"><rect width="100%" height="100%" fill="#fff8b0" stroke="#d6c95a" stroke-width="6"/><text x="50%" y="70%" font-size="${Math.round(H * 0.09)}" font-family="Courier" font-weight="bold" text-anchor="middle" fill="#111">${code}</text></svg>`,
  );
  const composed = await sharp(region)
    .composite([
      { input: sticker, left: Math.round((W - sm.width!) / 2), top: Math.round(H * 0.25) },
      { input: note, left: Math.round(W * 0.06), top: Math.round(H * 0.8) },
    ])
    .toBuffer();
  return sharp(composed).rotate(f.rot, { background: "#e9e6e1" }).jpeg({ quality: 90 }).toBuffer();
}

/** The owner writes the capture code on a note placed in the hero photo. */
async function withNote(img: Buffer, code: string) {
  const m = await sharp(img).metadata();
  const W = m.width!, H = m.height!;
  const note = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.round(W * 0.2)}" height="${Math.round(H * 0.12)}"><rect width="100%" height="100%" fill="#fff8b0" stroke="#d6c95a" stroke-width="6"/><text x="50%" y="70%" font-size="${Math.round(H * 0.075)}" font-family="Courier" font-weight="bold" text-anchor="middle" fill="#111">${code}</text></svg>`,
  );
  return sharp(img).composite([{ input: note, left: Math.round(W * 0.74), top: Math.round(H * 0.84) }]).jpeg({ quality: 90 }).toBuffer();
}

async function main() {
  const t0 = Date.now();
  const owner = actor("owner"), adv = actor("advertiser"), inv = actor("investor"), agent = actor("agent");
  const all = [owner, adv, inv, agent];
  console.log(Object.fromEntries(all.map((a) => [a.name, a.address])));
  const sql = postgres(process.env.SUPABASE_DB_URL!, { ssl: "require", prepare: false, max: 1 });

  try {
    step("clean up data from previous e2e runs (users with e2e- handles)");
    await sql.begin(async (tx) => {
      const users = await tx`select id, sui_address from users where handle like 'e2e-%' or display_name like 'E2E %'`;
      const ids = users.map((u: any) => u.id), addrs = users.map((u: any) => u.sui_address).filter(Boolean);
      if (!ids.length) return;
      const objs = (await tx`select id from objects where owner_user_id in ${tx(ids)} or owner_address in ${tx(addrs)}`).map((o: any) => o.id);
      const spaces = objs.length ? (await tx`select id from spaces where object_id in ${tx(objs)}`).map((x: any) => x.id) : [];
      if (spaces.length) {
        const leases = (await tx`select escrow_id from leases where space_id in ${tx(spaces)}`).map((x: any) => x.escrow_id);
        const offs = (await tx`select id from offerings where space_id in ${tx(spaces)}`).map((x: any) => x.id);
        if (offs.length) {
          await tx`delete from unit_events where offering_id in ${tx(offs)}`;
          await tx`delete from listings where offering_id in ${tx(offs)}`;
          await tx`delete from holdings where offering_id in ${tx(offs)}`;
          await tx`delete from acceptances where offering_id in ${tx(offs)}`;
          await tx`delete from offerings where id in ${tx(offs)}`;
        }
        if (leases.length) {
          await tx`delete from proofs where escrow_id in ${tx(leases)}`;
          await tx`delete from tranches where escrow_id in ${tx(leases)}`;
          await tx`delete from clicks where escrow_id in ${tx(leases)}`;
        }
        await tx`delete from messages where conversation_id in (select id from conversations where space_id in ${tx(spaces)})`;
        await tx`delete from conversations where space_id in ${tx(spaces)}`;
        await tx`delete from leases where space_id in ${tx(spaces)}`;
        await tx`delete from activity where space_id in ${tx(spaces)}`;
      }
      if (objs.length) {
        await tx`delete from sponsorships where object_id in ${tx(objs)}`;
        await tx`delete from activity where object_id in ${tx(objs)}`;
        await tx`delete from objects where id in ${tx(objs)}`;
      }
      await tx`delete from space_analyses where user_id in ${tx(ids)}`;
    });
    step("F1 fund actors (platform) and sign in with Sui");
    await fund(owner.address, 150_000_000n, 300_000n);
    await fund(adv.address, 100_000_000n, 0n);
    await fund(inv.address, 100_000_000n, 1_500_000n);
    await fund(agent.address, 60_000_000n, 1_100_000n);
    for (const a of [owner, adv, inv]) await signIn(a);

    step("F1 wallet: test funds for the advertiser (0.2 SUI + 5 USDC)");
    const tf = await api(adv, "/api/wallet/test-funds", { method: "POST" });
    assert.ok(tf.digest);
    const again = await http(adv, "/api/wallet/test-funds", { method: "POST" });
    assert.equal(again.status, 429, "test funds rate-limited to once per 24h");

    step("F1 onboarding: handles + on-chain profiles");
    for (const a of [owner, adv, inv]) {
      const r = await api(a, "/api/me/profile", { method: "POST", json: { handle: `e2e-${a.name.slice(0, 3)}-${rand}`, displayName: `E2E ${a.name}`, ...(a === adv ? { brandName: "Acme", website: "https://example.com" } : {}) } });
      await runTx(a, T.createProfile({ ensName: r.ensName, ensNamehash: r.ensNamehash }));
    }
    await sql`update users set is_admin = true where id = ${owner.userId!}`;
    const me = await api(owner, "/api/me");
    assert.ok(me.user.profile_id, "profile indexed");

    step("F2 list object: hero check (AI) + create_object + confirm");
    const heroCode = (await api(owner, "/api/capture-codes", { method: "POST", json: { purpose: "hero" } })).code;
    const check = await api(owner, "/api/objects/check", {
      method: "POST",
      body: form({ image: file(await withNote(fx("laptop-hero.jpg"), heroCode), "hero.jpg"), category: "laptop", title: "E2E MacBook Pro", city: "Tokyo", make: "Apple", model: "MacBook Pro 17", description: "Carried to cafés daily", captureCode: heroCode, captureSource: "camera" }),
    });
    assert.equal(check.decision, "ACCEPTED", `hero accepted: ${check.reason}`);
    const created = await runTx(owner, T.createObject(check.tx));
    const conf = await api(owner, "/api/objects/confirm", { method: "POST", json: { digest: created.digest, draft: check.draft } });
    const objectId = conf.object.id;

    step("F3 add space: rejected (blurry) then accepted + listed");
    const spaceForm = (img: Buffer) => form({ objectId, label: "lid-right", widthCm: "18", heightCm: "17", placement: "rear", material: "anodised aluminium", captureSource: "camera", image: file(img, "closeup.jpg") });
    const bad = await api(owner, "/api/spaces/analyze", { method: "POST", body: spaceForm(fx("laptop-lid-blurry.jpg")) });
    assert.equal(bad.result.decision, "REJECTED");
    assert.equal(bad.tx, null, "rejected space gets no tx");
    const good = await api(owner, "/api/spaces/analyze", { method: "POST", body: spaceForm(fx("laptop-lid-right.jpg")) });
    assert.equal(good.result.decision, "ACCEPTED", `space accepted: ${good.result.reason}`);
    console.log(`   AQS ${good.result.aqs} grade ${good.result.grade}`, good.result.subscores);
    const added = await runTx(owner, T.addSpace({ ...good.tx, pricePerWeek: 500_000n }));
    const fin = await api(owner, "/api/spaces/finalize", { method: "POST", json: { analysisId: good.analysisId, digest: added.digest } });
    const space = fin.space;
    assert.equal(space.status, "available");
    assert.equal(space.aqs, good.result.aqs);

    step("F5 marketplace search + public ENS page data");
    const market = await api(null, "/api/market?q=MacBook&category=laptop");
    assert.ok(market.results.some((s: any) => s.id === space.id), "space in marketplace search");
    const page = await api(null, `/api/names/${space.ens_name}?live=0`);
    assert.equal(page.kind, "space");

    step("F18 brand kit upload (advertiser)");
    const creative = await logoPng("ACME");
    const asset = (await api(adv, "/api/brand-assets", { method: "POST", body: form({ file: file(creative, "acme.png", "image/png"), name: "Acme logo" }) })).asset;

    step("F17 chat: advertiser → owner with an image attachment");
    const conv = await api(adv, "/api/conversations", { method: "POST", json: { spaceId: space.id } });
    await api(adv, `/api/conversations/${conv.id}`, { method: "POST", body: form({ body: "Hi! Can we put our logo on your lid?", files: file(creative, "acme.png", "image/png") }) });
    await api(owner, `/api/conversations/${conv.id}`, { method: "POST", body: form({ body: "Sure — book it and I'll approve." }) });
    const thread = await api(owner, `/api/conversations/${conv.id}`);
    assert.equal(thread.messages.length, 2);
    assert.ok(thread.messages[0].attachments[0].url, "attachment has a signed URL");

    step("F6 human lease: book current week (0.5 USDC escrow)");
    const week = BigInt(Math.floor(Date.now() / SUI.weekMs));
    const booked = await runTx(adv, T.book({ spaceId: space.id, calendarId: space.calendar_id, amount: 500_000n, startWeek: week, weeks: 1, creativeBlobId: asset.blob_id, creativeHash: asset.sha256, landingUrl: "https://example.com", brand: "Acme" }));
    const escrow1 = ev(booked, "LeaseBooked").escrow_id;

    step("F8 owner approves; print files");
    const ownerBefore = (await balances(owner.address)).usdc;
    await runTx(owner, T.approveCreative({ escrowId: escrow1 }));
    const pdf = await http(owner, `/api/leases/${escrow1}/print?size=exact&format=pdf`);
    assert.equal(pdf.headers.get("content-type"), "application/pdf");
    const png = await http(owner, `/api/leases/${escrow1}/print?size=L&format=png`);
    assert.equal(png.headers.get("content-type"), "image/png");

    step("F9 proofs: install (period 0) then period 1 — AI-verified, tranches released");
    for (const period of [0, 1]) {
      let accepted = false;
      for (let attempt = 0; attempt < 3 && !accepted; attempt++) {
        const code = (await api(owner, "/api/capture-codes", { method: "POST", json: { purpose: "proof" } })).code;
        const photo = await proofPhoto(creative, code, period * 3 + attempt);
        const r = await api(owner, "/api/proofs", { method: "POST", body: form({ escrowId: escrow1, captureCode: code, image: file(photo, "proof.jpg") }) });
        console.log(`   period ${period} attempt ${attempt}: ${r.accepted ? "accepted" : "rejected — " + r.reason}`);
        accepted = r.accepted;
        if (accepted) assert.equal(r.period, period);
      }
      assert.ok(accepted, `proof for period ${period} accepted`);
    }
    const lease1 = await api(owner, `/api/leases/${escrow1}`);
    assert.equal(lease1.lease.status, "completed");
    const gained = (await balances(owner.address)).usdc - ownerBefore;
    assert.equal(gained, 440_000n, "owner nets 88% of 0.5 USDC");
    const dash = await api(owner, "/api/dashboard");
    assert.equal(dash.owner.totals.earned, 440_000);

    step("F14 sponsorship (tier 1, 1 day)");
    const q = await api(null, "/api/sponsor-quote?tier=1&days=1");
    await runTx(owner, T.buySponsorship({ objectId, amount: BigInt(q.amount), tier: 1, days: 1 }));
    const sponsoredMarket = await api(null, "/api/market?sponsored=1");
    assert.ok(sponsoredMarket.results.some((s: any) => s.id === space.id), "sponsored filter finds it");

    step("F12 mock identity verification (owner + investor)");
    const idDoc = await sharp({ create: { width: 900, height: 600, channels: 3, background: "#dfe7f5" } }).jpeg({ quality: 95 }).toBuffer();
    for (const a of [owner, inv]) {
      const f = form({ legalName: `E2E ${a.name}`, dateOfBirth: "1990-01-01", country: "IN", addressLine: "1 Test Street, Bengaluru", investorType: "non_us", idDocument: file(Buffer.concat([idDoc, Buffer.alloc(12_000)]), "id.jpg") });
      f.append("attestations", "I am not a US person and am not investing on behalf of one.");
      f.append("attestations", "I understand these units are illiquid and may lose all value.");
      const k = await api(a, "/api/kyc", { method: "POST", body: f });
      assert.equal(k.status, "approved");
    }

    step("F11 tokenise: legal pack → owner signs → offering opened");
    const params = { spaceId: space.id, revenueShareBps: 6000, retainedUnits: 2000, pricePerUnit: "100", minRaiseUnits: 4000, saleDurationMs: 300_000, perInvestorMax: 8000, termMonths: 24 };
    const prep = await api(owner, "/api/offerings/prepare", { method: "POST", json: params });
    assert.equal(prep.pack.documents.length, 5, "5 mock legal documents");
    const oSig = await owner.kp.signPersonalMessage(new TextEncoder().encode(prep.message));
    const oAcc = await api(owner, "/api/acceptances", { method: "POST", json: { message: prep.message, signature: oSig.signature, role: "owner", units: 2000 } });
    const opened = await runTx(owner, T.createOffering({ ...params, pricePerUnit: 100n, saleDurationMs: 300_000n, legalPackHash: prep.pack.packHash, legalPackBlobId: prep.pack.indexBlobId, ownerAcceptSigHash: oAcc.sigHash }));
    const offeringId = ev(opened, "OfferingOpened").offering_id;

    step("F12 investor signs subscription + buys all 8000 units; offering closes");
    const off = await api(inv, `/api/offerings/${offeringId}`);
    assert.equal(off.mine.verified, true);
    const msg = `brandmystuff:accept:${offeringId}:${off.offering.legal_pack_hash.replace(/^0x/, "")}:8000`;
    const iSig = await inv.kp.signPersonalMessage(new TextEncoder().encode(msg));
    const iAcc = await api(inv, "/api/acceptances", { method: "POST", json: { message: msg, signature: iSig.signature, role: "investor", offeringId, units: 8000 } });
    await runTx(inv, T.buyPrimary({ offeringId, units: 8000, amount: 800_000n, acceptSigHash: iAcc.sigHash }));
    const closed = await runTx(inv, T.closeOffering({ offeringId, spaceId: space.id }));
    assert.equal(ev(closed, "OfferingClosed").success, true);

    step("F13 second lease on the tokenised space → proof → distribution → claim");
    const b2 = await runTx(adv, T.book({ spaceId: space.id, calendarId: space.calendar_id, amount: 500_000n, startWeek: week + 1n, weeks: 1, creativeBlobId: asset.blob_id, creativeHash: asset.sha256, landingUrl: "https://example.com", brand: "Acme" }));
    const escrow2 = ev(b2, "LeaseBooked").escrow_id;
    await runTx(owner, T.approveCreative({ escrowId: escrow2 }));
    let ok2 = false;
    for (let attempt = 0; attempt < 3 && !ok2; attempt++) {
      const code = (await api(owner, "/api/capture-codes", { method: "POST", json: { purpose: "proof" } })).code;
      const r = await api(owner, "/api/proofs", { method: "POST", body: form({ escrowId: escrow2, captureCode: code, image: file(await proofPhoto(creative, code, 3 + ((attempt + 2) % 3)), "proof.jpg") }) });
      console.log(`   tokenised install proof attempt ${attempt}: ${r.accepted ? "accepted" : r.reason}`);
      ok2 = r.accepted;
    }
    assert.ok(ok2, "tokenised install proof accepted");
    const pf = await api(inv, "/api/portfolio");
    const h = pf.holdings.find((x: any) => x.offering_id === offeringId);
    assert.equal(h.onchain.claimable, "120000", "investor accrues 8000/10000 × 60% × 0.25 USDC");
    const invBefore = (await balances(inv.address)).usdc;
    await runTx(inv, T.claim({ offeringId }));
    assert.equal((await balances(inv.address)).usdc - invBefore, 120_000n);

    step("F13 secondary market: investor lists 1000, owner buys 500, investor cancels");
    const listed = await runTx(inv, T.listUnits({ offeringId, units: 1000, pricePerUnit: 200n }));
    const listingId = ev(listed, "Listed").listing_id;
    await runTx(owner, T.fillListing({ offeringId, listingId, units: 500, amount: 100_000n }));
    await runTx(inv, T.cancelListing({ offeringId, listingId }));
    const off2 = await api(owner, `/api/offerings/${offeringId}`);
    assert.equal(off2.mine.units, 2500, "owner now holds 2000 + 500 units");

    step("F10 dispute on lease 2 → admin refunds the remainder");
    await runTx(adv, T.openDispute({ escrowId: escrow2 }));
    await api(owner, "/api/admin", { method: "POST", json: { action: "resolve_dispute", escrowId: escrow2, refund: true } });
    const l2 = await api(adv, `/api/leases/${escrow2}`);
    assert.equal(l2.lease.status, "refunded");

    step("F7 x402: agent leases via HTTP 402 → pays USDC → booked");
    const body = { spaceId: space.id, weeks: 1, creativeUrl: `${BASE}/logo.svg`, landingUrl: "https://agent.example", brand: "AgentCo" };
    const first = await http(null, "/api/x402/leases", { method: "POST", json: body });
    assert.equal(first.status, 402);
    const pr = JSON.parse(Buffer.from(first.headers.get("payment-required")!, "base64").toString());
    const reqs = pr.accepts[0];
    assert.equal(reqs.network, "sui:testnet");
    const pay = new Transaction();
    pay.setSender(agent.address);
    pay.transferObjects([pay.coin({ type: reqs.asset, balance: BigInt(reqs.amount) })], pay.pure.address(reqs.payTo));
    const bytes = await pay.build({ client: sui() });
    const { signature } = await agent.kp.signTransaction(bytes);
    const header = Buffer.from(JSON.stringify({ x402Version: 2, resource: pr.resource, accepted: reqs, payload: { signature, transaction: toBase64(bytes) } })).toString("base64");
    const paid = await http(null, "/api/x402/leases", { method: "POST", json: body, headers: { "PAYMENT-SIGNATURE": header } });
    assert.equal(paid.status, 200, JSON.stringify(paid.data));
    assert.ok(paid.headers.get("payment-response"));
    assert.ok(paid.data.escrowId && paid.data.ensName.startsWith("l-"));
    const agentLease = await api(null, `/api/leases/${paid.data.escrowId}`);
    assert.equal(agentLease.lease.advertiser, agent.address);
    const replay = await http(null, "/api/x402/leases", { method: "POST", json: body, headers: { "PAYMENT-SIGNATURE": header } });
    assert.equal(replay.data.escrowId, paid.data.escrowId, "replayed payment returns the same fulfilment, no double booking");

    step("F16 MCP: tools/list, search_spaces, quote_lease");
    const tools = await api(null, "/api/mcp", { method: "POST", json: { jsonrpc: "2.0", id: 1, method: "tools/list" } });
    assert.ok(tools.result.tools.some((t: any) => t.name === "quote_lease"));
    const found = await api(null, "/api/mcp", { method: "POST", json: { jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "search_spaces", arguments: { category: "laptop" } } } });
    assert.ok(found.result.structuredContent.spaces.some((s: any) => s.spaceId === space.id));
    const quote = await api(null, "/api/mcp", { method: "POST", json: { jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "quote_lease", arguments: { spaceId: space.id, weeks: 2 } } } });
    assert.equal(quote.result.structuredContent.amountUsdc, 1);

    step("F20 activity feed + notifications + click tracking");
    const act = await api(null, `/api/activity?spaceId=${space.id}`);
    for (const k of ["space_scored", "lease_booked", "proof_accepted", "tranche_released", "offering_opened", "units_traded", "dispute_resolved"])
      assert.ok(act.activity.some((a: any) => a.kind === k), `activity has ${k}`);
    const notes = await api(owner, "/api/notifications");
    assert.ok(notes.notifications.some((n: any) => n.kind === "lease_request"));
    const click = await fetch(`${BASE}/r/${escrow1}`, { redirect: "manual" });
    assert.equal(click.status, 302);
    assert.ok(click.headers.get("location")!.includes("utm_source=brandmystuff"));

    step("ENS: relayer registers account, object, space and lease names; live verification (up to 8 min)");
    const deadline = Date.now() + 8 * 60_000;
    const lease1Name = `${lease1.lease.ens_label}.${space.ens_name}`;
    let verified: Record<string, boolean> = {};
    while (Date.now() < deadline) {
      const names = [me.user.ens_name, conf.object.ens_name, space.ens_name, lease1Name];
      for (const n of names) {
        if (verified[n]) continue;
        const r = await http(null, `/api/names/${n}`);
        verified[n] = r.status === 200 && !!r.data.verification?.verified;
      }
      console.log("   ", Object.entries(verified).map(([k, v]) => `${v ? "✓" : "…"} ${k}`).join("  "));
      if (Object.values(verified).length === 4 && Object.values(verified).every(Boolean)) break;
      await sleep(20_000);
    }
    assert.ok(Object.values(verified).every(Boolean), "all ENS names verified against Sui");
    const spacePage = await api(null, `/api/names/${space.ens_name}`);
    assert.equal(spacePage.verification.records["eth.brandmystuff.attested.aqs"], String(space.aqs), "AQS readable from ENS");

    console.log(`\n✅ flows e2e passed in ${Math.round((Date.now() - t0) / 1000)}s`);
  } finally {
    step("sweep test funds back to the platform");
    for (const a of all) await sweep(a);
    await sql.end();
  }
}

main().catch((e) => {
  console.error("\n❌ flows e2e failed:", e);
  process.exit(1);
});
