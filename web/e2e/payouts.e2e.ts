/**
 * Cross-chain payout e2e, all real: Sui testnet → Circle CCTP (Iris sandbox) → our relayer on an EVM
 * testnet, driven through Curvegrid MultiBaas.
 *
 * An investor picks an EVM payout chain at onboarding (set_route in the same tx as their profile), buys
 * units of a tokenised ad space, a brand leases it, the install proof releases revenue, and the
 * investor's share must arrive as native USDC at their EVM address.
 *
 * Requires: `pnpm dev` (web on :3010 + worker), MultiBaas env for the chain, `scripts/multibaas-setup.ts` run.
 * Run: npx tsx e2e/payouts.e2e.ts          (E2E_PAYOUT_CHAIN=arb-sepolia to pick a chain)
 */
import { config } from "dotenv";
import { resolve } from "node:path";
config({ path: resolve(__dirname, "../../.env.local") });

import assert from "node:assert/strict";
import sharp from "sharp";
import { Transaction } from "@mysten/sui/transactions";
import { createPublicClient, erc20Abi, http as viemHttp, parseAbiItem, type Address } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { SUI } from "../src/lib/deployment";
import { chainByKey } from "../src/lib/payout-chains";
import * as T from "../src/lib/sui/tx";
import { actor, api, ev, file, form, fund, fx, logoPng, proofPhoto, rand, runTx, signIn, sleep, step, sweep } from "./helpers";

const PAYOUT_DELIVERED = parseAbiItem("event PayoutDelivered(bytes32 indexed suiHolder, address indexed recipient, uint256 amount, bytes32 indexed offeringId, bytes32 suiTx, uint64 nonce)");

async function main() {
  const t0 = Date.now();
  const owner = actor("owner"), adv = actor("advertiser"), inv = actor("investor");
  console.log(Object.fromEntries([owner, adv, inv].map((a) => [a.name, a.address])));

  step("payout chains live (MultiBaas deployment + relayer)");
  const { chains } = await api(null, "/api/payouts/chains");
  const live = chains.filter((c: any) => c.enabled);
  console.table(chains.map((c: any) => ({ chain: c.key, enabled: c.enabled, relayer: c.relayer })));
  const target = process.env.E2E_PAYOUT_CHAIN ? live.find((c: any) => c.key === process.env.E2E_PAYOUT_CHAIN) : live[0];
  assert.ok(target, "no live payout chain: add MULTIBAAS_<CHAIN>_URL/_KEY and run scripts/multibaas-setup.ts");
  const chain = chainByKey(target.key)!;
  const recipient = privateKeyToAccount(generatePrivateKey()).address; // fresh address: its balance is exactly what we deliver
  const evm = createPublicClient({ transport: viemHttp(chain.rpc) });
  console.log(`   paying out on ${chain.name} to ${recipient}`);

  try {
    step("fund actors and sign in with Sui");
    await fund(owner.address, 150_000_000n, 0n);
    await fund(adv.address, 100_000_000n, 600_000n);
    await fund(inv.address, 100_000_000n, 900_000n);
    for (const a of [owner, adv, inv]) await signIn(a);

    step(`onboarding: profiles; the investor picks ${chain.short} for payouts in the same transaction`);
    for (const a of [owner, adv, inv]) {
      const r = await api(a, "/api/me/profile", { method: "POST", json: { handle: `e2e-p${a.name.slice(0, 2)}-${rand}`, displayName: `E2E ${a.name}` } });
      const tx = T.createProfile({ ensName: r.ensName, ensNamehash: r.ensNamehash }, new Transaction());
      if (a === inv) T.setPayoutRoute({ domain: chain.domain, recipient }, tx);
      const res = await runTx(a, tx);
      if (a === inv) assert.ok(ev(res, "RouteSet"), "RouteSet emitted");
    }
    const mine0 = await api(inv, "/api/me/payouts");
    assert.equal(mine0.route?.chain, chain.key, "route recorded from the RouteSet event");
    assert.equal(mine0.route.recipient.toLowerCase(), recipient.toLowerCase());

    step("list object + ad space (AI-checked)");
    const check = await api(owner, "/api/objects/check", {
      method: "POST",
      body: form({ image: file(fx("laptop-hero.jpg"), "hero.jpg"), title: "E2E MacBook Pro", city: "Tokyo", make: "Apple", model: "MacBook Pro 17", description: "Silver 17-inch laptop I carry to cafés daily", captureSource: "camera" }),
    });
    assert.equal(check.decision, "ACCEPTED", `hero accepted: ${check.reason}`);
    const created = await runTx(owner, T.createObject(check.tx));
    const objectId = (await api(owner, "/api/objects/confirm", { method: "POST", json: { digest: created.digest, draft: check.draft } })).object.id;
    const good = await api(owner, "/api/spaces/analyze", {
      method: "POST",
      body: form({ objectId, label: "lid-right", widthCm: "18", heightCm: "17", placement: "rear", material: "anodised aluminium", captureSource: "camera", image: file(fx("laptop-lid-right.jpg"), "closeup.jpg") }),
    });
    assert.equal(good.result.decision, "ACCEPTED", `space accepted: ${good.result.reason}`);
    const added = await runTx(owner, T.addSpace({ ...good.tx, pricePerWeek: 500_000n }));
    const space = (await api(owner, "/api/spaces/finalize", { method: "POST", json: { analysisId: good.analysisId, digest: added.digest } })).space;

    step("identity verification (owner + investor)");
    const idDoc = await sharp({ create: { width: 900, height: 600, channels: 3, background: "#dfe7f5" } }).jpeg({ quality: 95 }).toBuffer();
    for (const a of [owner, inv]) {
      const f = form({ legalName: `E2E ${a.name}`, dateOfBirth: "1990-01-01", country: "IN", addressLine: "1 Test Street, Bengaluru", investorType: "non_us", idDocument: file(Buffer.concat([idDoc, Buffer.alloc(12_000)]), "id.jpg") });
      f.append("attestations", "I am not a US person and am not investing on behalf of one.");
      f.append("attestations", "I understand these units are illiquid and may lose all value.");
      assert.equal((await api(a, "/api/kyc", { method: "POST", body: f })).status, "approved");
    }

    step("tokenise the space; the investor buys 8000 of 10000 units");
    const params = { spaceId: space.id, revenueShareBps: 6000, retainedUnits: 2000, pricePerUnit: "100", minRaiseUnits: 4000, saleDurationMs: 300_000, perInvestorMax: 8000, termMonths: 24 };
    const prep = await api(owner, "/api/offerings/prepare", { method: "POST", json: params });
    const oSig = await owner.kp.signPersonalMessage(new TextEncoder().encode(prep.message));
    const oAcc = await api(owner, "/api/acceptances", { method: "POST", json: { message: prep.message, signature: oSig.signature, role: "owner", units: 2000 } });
    const opened = await runTx(owner, T.createOffering({ ...params, pricePerUnit: 100n, saleDurationMs: 300_000n, legalPackHash: prep.pack.packHash, legalPackBlobId: prep.pack.indexBlobId, ownerAcceptSigHash: oAcc.sigHash }));
    const offeringId = ev(opened, "OfferingOpened").offering_id;
    const off = await api(inv, `/api/offerings/${offeringId}`);
    const msg = `brandmystuff:accept:${offeringId}:${off.offering.legal_pack_hash.replace(/^0x/, "")}:8000`;
    const iSig = await inv.kp.signPersonalMessage(new TextEncoder().encode(msg));
    const iAcc = await api(inv, "/api/acceptances", { method: "POST", json: { message: msg, signature: iSig.signature, role: "investor", offeringId, units: 8000 } });
    await runTx(inv, T.buyPrimary({ offeringId, units: 8000, amount: 800_000n, acceptSigHash: iAcc.sigHash }));
    assert.equal(ev(await runTx(inv, T.closeOffering({ offeringId, spaceId: space.id })), "OfferingClosed").success, true);

    step("a brand leases the tokenised space; the install proof releases revenue to holders");
    const creative = await logoPng("ACME");
    const asset = (await api(adv, "/api/brand-assets", { method: "POST", body: form({ file: file(creative, "acme.png", "image/png"), name: "Acme logo" }) })).asset;
    const week = BigInt(Math.floor(Date.now() / SUI.weekMs));
    const booked = await runTx(adv, T.book({ spaceId: space.id, calendarId: space.calendar_id, amount: 500_000n, startWeek: week, weeks: 1, creativeBlobId: asset.blob_id, creativeHash: asset.sha256, landingUrl: "https://example.com", brand: "Acme" }));
    const escrow = ev(booked, "LeaseBooked").escrow_id;
    await runTx(owner, T.approveCreative({ escrowId: escrow }));
    let accepted = false;
    for (let attempt = 0; attempt < 3 && !accepted; attempt++) {
      const r = await api(owner, "/api/proofs", { method: "POST", body: form({ escrowId: escrow, image: file(await proofPhoto(creative, attempt), "proof.jpg") }) });
      console.log(`   install proof attempt ${attempt}: ${r.accepted ? "accepted" : r.reason}`);
      accepted = r.accepted;
    }
    assert.ok(accepted, "install proof accepted");
    const tDist = Date.now();

    step(`cross-chain delivery: Sui release+burn → Circle attestation → relayer on ${chain.short} via MultiBaas`);
    let last = "";
    let payout: any = null;
    const deadline = Date.now() + 25 * 60_000;
    while (Date.now() < deadline) {
      const mine = await api(inv, "/api/me/payouts");
      payout = mine.payouts.find((p: any) => p.offering_id === offeringId);
      const s = payout ? `${payout.status}${payout.error ? ` (${payout.error.slice(0, 80)})` : ""}` : "waiting for release";
      if (s !== last) console.log(`   +${Math.round((Date.now() - tDist) / 1000)}s ${s}${payout?.release_digest && !last.startsWith("released") && payout.status === "released" ? ` · sui ${payout.release_digest}` : ""}${payout?.evm_tx && payout.status !== "released" ? ` · ${chain.short} ${payout.evm_tx}` : ""}`);
      last = s;
      if (payout?.status === "delivered") break;
      await sleep(5000);
    }
    assert.equal(payout?.status, "delivered", "payout delivered within 25 minutes");
    assert.equal(payout.amount, "120000", "investor share: 8000/10000 × 60% × 0.25 USDC released at install");
    assert.equal(payout.chain, chain.key);

    step("verify on the destination chain, independently of MultiBaas");
    const rc = await evm.waitForTransactionReceipt({ hash: payout.evm_tx, timeout: 120_000 });
    assert.equal(rc.status, "success");
    // At the receipt's block: public RPCs are load-balanced and "latest" can lag behind it.
    const bal = await evm.readContract({ address: chain.usdc, abi: erc20Abi, functionName: "balanceOf", args: [recipient as Address], blockNumber: rc.blockNumber });
    assert.equal(bal, 120_000n, `${recipient} holds exactly the delivered USDC on ${chain.name}`);
    const logs = await evm.getLogs({ address: target.relayer as Address, event: PAYOUT_DELIVERED, args: { recipient: recipient as Address }, fromBlock: rc.blockNumber, toBlock: rc.blockNumber });
    assert.equal(logs.length, 1, "relayer emitted PayoutDelivered");
    assert.equal(logs[0].args.amount, 120_000n);
    console.log(`   ${chain.explorer}/tx/${payout.evm_tx}`);

    step("verify on Sui: nothing left to claim, released on-chain");
    const pf = await api(inv, "/api/portfolio");
    const h = pf.holdings.find((x: any) => x.offering_id === offeringId);
    assert.equal(String(h.onchain.claimable), "0", "share left Sui, nothing double-claimable");

    step("MultiBaas read model: lifetime delivered (event query) and balance (contract call)");
    let mine: any = null;
    for (let i = 0; i < 24; i++) {
      mine = await api(inv, "/api/me/payouts");
      if (mine.onchain?.delivered === "120000") break;
      await sleep(5000);
    }
    console.log("   ", mine.onchain);
    assert.equal(mine.onchain?.balance, "120000", "MultiBaas USDC balanceOf");
    assert.equal(mine.onchain?.delivered, "120000", "MultiBaas event query over PayoutDelivered");

    console.log(`\n✅ cross-chain payout e2e passed in ${Math.round((Date.now() - t0) / 1000)}s (${Math.round((Date.now() - tDist) / 1000)}s from distribution to ${chain.short})`);
  } finally {
    step("sweep Sui test funds back to the platform");
    for (const a of [owner, adv, inv]) await sweep(a);
  }
}

main().catch((e) => {
  console.error("\n❌", e);
  process.exit(1);
});
