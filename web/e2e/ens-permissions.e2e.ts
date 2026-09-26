/**
 * ENSv2 permissions e2e (docs/ENS-INTEGRATION.md §12), live on Sepolia with a throwaway user:
 * owner-managed profile keys vs platform-attested keys, leases held and edited by the advertiser,
 * and a brand agent with its own key, receipts under its own name, revocation and x402 identity.
 * Needs `pnpm dev` (for the API checks). Run: npx tsx e2e/ens-permissions.e2e.ts
 */
import { config } from "dotenv";
import { resolve } from "node:path";
config({ path: resolve(__dirname, "../../.env.local") });

import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import postgres from "postgres";
import type { Address, Hex } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { dnsName, ensClients, getResolverOf, labelId, nameRoles, setRecords } from "../src/server/ens/client";
import { registryAbi, resolverAbi, RR } from "../src/server/ens/contracts";
import { childRegistry, ens, ensureAccountName, registerLeaseName, unregisterLabel, writeRecords } from "../src/server/ens/names";
import { applyAgentStatus, checkAgentIdentity, delegateUser, ensureAgentIdentity, fundEvmGas, permissionsView, syncAgent, writeAgentReceipt } from "../src/server/ens/permissions";
import { ensSuiAddr, ensText } from "../src/server/ens/read";
import { agentEvmKey, agentFor } from "../src/server/agent/keys";

const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3010";
const t0 = Date.now();
const step = (s: string) => console.log(`\n▶ ${s}  (+${Math.round((Date.now() - t0) / 1000)}s)`);
const rand = randomBytes(3).toString("hex");

/** eth_call as `from`: resolves if allowed, rejects with the contract's error otherwise. */
async function simulate(from: Address, address: Address, abi: any, functionName: string, args: any[]) {
  await ens().pub.simulateContract({ address, abi, functionName, args, account: from } as any);
}
const denied = /EACUnauthorizedAccountRoles|EACCannot|reverted/;

async function main() {
  const sql = postgres(process.env.SUPABASE_DB_URL!, { ssl: "require", prepare: false, max: 1 });
  const ownerKey = generatePrivateKey();
  const owner = privateKeyToAccount(ownerKey);
  const uid = randomUUID();
  const handle = `e2e-perm-${rand}`;
  const acct = `${handle}.brandmystuff.eth`;
  const sui = `0x${randomBytes(32).toString("hex")}`;
  const cleanup: string[] = []; // names to unregister, children first
  let escrowId: string | null = null;
  let runId: string | null = null;
  try {
    await sql`insert into users (id, handle, ens_name, sui_address, evm_address, display_name, bio, brand_name, account_type)
              values (${uid}, ${handle}, ${acct}, ${sui}, ${owner.address}, 'Perm E2E', 'Registered by the platform', 'PermCo', 'brand')`;

    step("account name on the shared platform resolver (existing path, unchanged)");
    await ensureAccountName(uid);
    cleanup.unshift(acct);
    const [row0] = await sql`select resolver, delegated from ens_names where name = ${acct}`;
    assert.equal(row0.resolver, null);
    assert.equal(await ensText(acct, "description"), "Registered by the platform");
    assert.ok((await nameRoles(ens(), await childRegistry("brandmystuff.eth"), handle, owner.address)) & RR.SET_RESOLVER, "legacy owner holds SET_RESOLVER");

    step("delegation: own PermissionedResolver, owner-scoped keys, name moved, SET_RESOLVER revoked");
    await delegateUser(uid);
    const [res] = await sql`select * from ens_resolvers where key = ${"user:" + uid}`;
    const resolver = res.address as Address;
    const [row1] = await sql`select resolver, delegated from ens_names where name = ${acct}`;
    assert.equal(row1.resolver.toLowerCase(), resolver.toLowerCase());
    assert.equal(row1.delegated, true);
    assert.equal((await getResolverOf(ens(), await childRegistry("brandmystuff.eth"), handle)).toLowerCase(), resolver.toLowerCase());
    assert.equal(await ensText(acct, "description"), "Registered by the platform", "records copied before the switch");
    assert.equal(await nameRoles(ens(), await childRegistry("brandmystuff.eth"), handle, owner.address), 0n, "owner can no longer repoint the resolver");

    step("owner signs its own description; attested keys and repointing are rejected on-chain");
    await fundEvmGas(owner.address);
    const oc = ensClients(process.env.SEPOLIA_RPC_URL!, ownerKey);
    await setRecords(oc, resolver, acct, { texts: { description: "Edited by my own wallet" } });
    assert.equal(await ensText(acct, "description"), "Edited by my own wallet");
    await assert.rejects(simulate(owner.address, resolver, resolverAbi, "setText", [dnsName(acct), "eth.brandmystuff.attested.verified", "true"]), denied);
    await assert.rejects(simulate(owner.address, await childRegistry("brandmystuff.eth"), registryAbi, "setResolver", [labelId(handle), owner.address]), denied);

    step("platform updates keep attesting but never clobber the owner's keys");
    await sql`update users set bio = 'Changed in the app database' where id = ${uid}`;
    await ensureAccountName(uid); // what a profile save triggers
    await writeRecords(acct, { texts: { "eth.brandmystuff.attested.verified": "true" } });
    assert.equal(await ensText(acct, "description"), "Edited by my own wallet");
    assert.equal(await ensText(acct, "eth.brandmystuff.attested.verified"), "true");

    step("permissions view: split rights proven by live role reads and eth_call probes");
    const pv: any = await permissionsView(acct, true);
    assert.equal(pv.delegated, true);
    assert.equal(pv.keys.find((k: any) => k.key === "description").writer, "owner");
    assert.equal(pv.keys.find((k: any) => k.key === "eth.brandmystuff.attested.verified").writer, "platform");
    assert.equal(pv.onchain.canManaged, true);
    assert.equal(pv.onchain.canAttested, false);
    assert.equal(pv.onchain.probe[0].ok, true);
    assert.match(pv.onchain.probe[1].error, /EACUnauthorizedAccountRoles/);
    assert.deepEqual(pv.token.roles, []);

    step("lease: the advertiser holds the expiring name on its own resolver and edits url, not state");
    const [space] = await sql`select s.id, s.ens_name from spaces s join ens_names n on n.name = s.ens_name where n.status = 'registered' and s.status = 'available' limit 1`;
    assert.ok(space, "a registered space exists");
    escrowId = `0x${randomBytes(32).toString("hex")}`;
    const label = `l-e2e${rand}`;
    await sql`insert into leases (escrow_id, lease_id, seq, ens_label, space_id, advertiser, owner, start_ms, week_ms, weeks, total_paid, status, creative_blob_id, creative_hash, brand)
              values (${escrowId}, ${escrowId}, 0, ${label}, ${space.id}, ${sui}, ${sui}, ${Date.now()}, 600000, 1, 500000, 'awaiting_install', 'e2e', ${"0x" + "ab".repeat(32)}, 'PermCo')`;
    await registerLeaseName(escrowId, null);
    const lease = `${label}.${space.ens_name}`;
    cleanup.unshift(lease);
    const [lrow] = await sql`select owner, resolver, delegated from ens_names where name = ${lease}`;
    assert.equal(lrow.owner.toLowerCase(), owner.address.toLowerCase());
    assert.equal(lrow.resolver.toLowerCase(), resolver.toLowerCase());
    assert.equal(await nameRoles(ens(), await childRegistry(space.ens_name), label, owner.address), 0n, "no registry roles: non-transferable, can't repoint");
    await setRecords(oc, resolver, lease, { texts: { url: "https://permco.example/campaign" } });
    assert.equal(await ensText(lease, "url"), "https://permco.example/campaign");
    await assert.rejects(simulate(owner.address, resolver, resolverAbi, "setText", [dnsName(lease), "eth.brandmystuff.attested.state", "live"]), denied);

    step("agent identity: scout.<brand> on its own resolver, owned by the brand, agent key scoped to agent keys");
    const agent = await agentFor(uid);
    const ak = await agentEvmKey(uid);
    const idn = await ensureAgentIdentity(uid);
    const scout = (idn as any).name as string;
    cleanup.unshift(scout);
    assert.equal(scout, `scout.${acct}`);
    const agentResolver = (idn as any).resolver as Address;
    assert.equal(((await ensSuiAddr(scout)) ?? "").toLowerCase(), `0x${agent.address.replace(/^0x/, "").padStart(64, "0")}`.toLowerCase());
    const ac = ensClients(process.env.SEPOLIA_RPC_URL!, ak.privateKey);
    await fundEvmGas(ak.address);
    await setRecords(ac, agentResolver, scout, { texts: { "agent-context": "Scout for PermCo (written by the agent key)" } });
    assert.equal(await ensText(scout, "agent-context"), "Scout for PermCo (written by the agent key)");
    await assert.rejects(simulate(ak.address, agentResolver, resolverAbi, "setText", [dnsName(scout), "eth.brandmystuff.attested.agent.status", "active"]), denied);
    await assert.rejects(simulate(ak.address, resolver, resolverAbi, "setText", [dnsName(acct), "agent-context", "x"]), denied, "agent roles don't reach the brand's resolver");
    const acctRegistry = await childRegistry(acct);
    await assert.rejects(simulate(ak.address, acctRegistry, registryAbi, "register", ["hijack", ak.address, "0x0000000000000000000000000000000000000000", agentResolver, 0n, BigInt(Math.floor(Date.now() / 1000) + 86400)]), denied, "agent can't register in the brand's registry");
    assert.equal(await syncAgent(uid), "no-mandate");
    assert.equal(await ensText(scout, "eth.brandmystuff.attested.agent.status"), "no-mandate");

    step("receipt: the agent registers buy-1 under its own name and records its pick; the platform attests payment");
    runId = randomUUID();
    await sql`insert into agent_runs (id, user_id, status, pick_id, candidates, payment, finished_at)
              values (${runId}, ${uid}, 'paid', ${space.id}, ${sql.json([{ id: space.id, ensName: space.ens_name, reasoning: "Best reach for the price" }])},
                      ${sql.json({ digest: "E2EdigestPermissions", amount: 0.5, leaseEns: lease, escrowId })}, now())`;
    const rc: any = await writeAgentReceipt(runId);
    const receipt = rc.receipt as string;
    cleanup.unshift(receipt);
    assert.equal(receipt, `buy-1.${scout}`);
    assert.equal(await ensText(receipt, "eth.brandmystuff.receipt.pick"), space.ens_name);
    assert.equal(await ensText(receipt, "eth.brandmystuff.attested.payment"), "E2EdigestPermissions");
    assert.equal(await ensText(scout, "eth.brandmystuff.agent.last-pick"), space.ens_name);
    const [rrow] = await sql`select kind, owner from ens_names where name = ${receipt}`;
    assert.equal(rrow.kind, "receipt");
    assert.equal(rrow.owner.toLowerCase(), owner.address.toLowerCase(), "receipt is held by the brand");

    step("revocation strips the agent's roles; x402 identity follows the ENS name");
    await applyAgentStatus(uid, "revoked");
    await writeRecords(scout, { texts: { "eth.brandmystuff.attested.agent.status": "revoked" } });
    await assert.rejects(simulate(ak.address, agentResolver, resolverAbi, "setText", [dnsName(scout), "agent-context", "x"]), denied);
    const scoutRegistry = await childRegistry(scout);
    assert.equal(await ens().pub.readContract({ address: scoutRegistry, abi: registryAbi, functionName: "hasRootRoles", args: [RR.REGISTRAR, ak.address] }), false);
    await assert.rejects(checkAgentIdentity(scout, agent.address), /revoked/);
    await applyAgentStatus(uid, "active");
    await writeRecords(scout, { texts: { "eth.brandmystuff.attested.agent.status": "active" } });
    await simulate(ak.address, agentResolver, resolverAbi, "setText", [dnsName(scout), "agent-context", "x"]);
    assert.equal((await checkAgentIdentity(scout, agent.address))?.name, scout);
    await assert.rejects(checkAgentIdentity(scout, sui), /does not resolve/);

    step("API: names route and permissions route for agent and account names");
    const nr = await fetch(`${BASE}/api/names/${scout}?live=0`).then((r) => r.json());
    assert.equal(nr.kind, "agent");
    const pr = await fetch(`${BASE}/api/names/${scout}/permissions`).then((r) => r.json());
    assert.equal(pr.managerRole, "agent");
    assert.ok(pr.keys.some((k: any) => k.key === "agent-context" && k.writer === "agent"));
    assert.ok(pr.history.some((h: any) => h.action === "revoke"));
    const pa = await fetch(`${BASE}/api/names/${acct}/permissions`).then((r) => r.json());
    assert.equal(pa.onchain.canAttested, false);

    console.log(`\n✅ ENS permissions e2e passed in ${Math.round((Date.now() - t0) / 1000)}s`);
  } finally {
    step("cleanup: release the test names on-chain and delete the rows");
    for (const n of cleanup) {
      try {
        await unregisterLabel(n, null);
      } catch (e: any) {
        console.warn("  unregister", n, String(e?.message ?? e).slice(0, 120));
      }
    }
    const like = `%${handle}.brandmystuff.eth`;
    if (runId) await sql`delete from agent_runs where id = ${runId}`;
    if (escrowId) await sql`delete from leases where escrow_id = ${escrowId}`;
    await sql`delete from brand_agents where user_id = ${uid}`;
    await sql`delete from ens_resolvers where key in (${"user:" + uid}, ${"agent:" + uid})`;
    const names = [...new Set([...cleanup, acct])];
    await sql`delete from ens_writes where name like ${like} or name in ${sql(names)}`;
    await sql`delete from ens_names where name like ${like} or name in ${sql(names)}`;
    await sql`delete from users where id = ${uid}`;
    await sql.end();
  }
}

main().then(
  () => process.exit(0),
  (e) => {
    console.error("\n❌", e);
    process.exit(1);
  },
);
