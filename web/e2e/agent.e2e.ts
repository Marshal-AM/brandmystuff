/** Brand agent end to end: brand onboarding → mandate → Scout run (ENS + scoring) → x402 payment from the mandate. Run: npm run e2e:agent */
import { config } from "dotenv";
import { resolve } from "node:path";
config({ path: resolve(__dirname, "../../.env.local") });
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
const BASE = process.env.E2E_BASE ?? "http://localhost:3010";
(async () => {
  const { createMandate } = await import("../src/lib/sui/tx");
  const { sui } = await import("../src/server/sui");
  const { SUI } = await import("../src/lib/deployment");
  const kp = new Ed25519Keypair();
  const address = kp.getPublicKey().toSuiAddress();
  const j = async (path: string, init: any = {}) => { const r = await fetch(BASE + path, init); const t = await r.text(); try { return { status: r.status, body: JSON.parse(t) }; } catch { return { status: r.status, body: t }; } };
  const n = await j(`/api/auth/sui/nonce?address=${address}`);
  const { signature } = await kp.signPersonalMessage(new TextEncoder().encode(n.body.message));
  const v = await j("/api/auth/sui/verify", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ address, message: n.body.message, signature }) });
  const H = { "content-type": "application/json", cookie: `bms_session=${v.body.token}` };
  const handle = "br-" + Math.random().toString(36).slice(2, 7);
  const p = await j("/api/me/profile", { method: "POST", headers: H, body: JSON.stringify({ handle, accountType: "brand", brandName: "Lumen Coffee Co.", displayName: "Lumen Coffee Co.", brandAbout: "Small-batch specialty coffee roasted in Bengaluru for people who like slow mornings, good laptops on café tables and a proper desk ritual.", brandLocation: "Bengaluru, India" }) });
  console.log("profile", p.status, handle, p.body.user?.account_type);
  const f = await j("/api/wallet/test-funds", { method: "POST", headers: H });
  console.log("funds", f.status, f.body.usdc, f.body.sui);
  await new Promise((r) => setTimeout(r, 4000));
  const a = await j("/api/agent", { headers: H });
  console.log("agent", a.status, a.body.agent?.address);
  const tx = createMandate({ amount: 1_000_000n, agent: a.body.agent.address, payee: SUI.platformAddress, perPaymentCap: 900_000n, expiresMs: BigInt(Date.now() + 7 * 86400_000) });
  tx.setSender(address);
  const r: any = await sui().signAndExecuteTransaction({ transaction: tx, signer: kp, include: { effects: true } });
  const digest = r.Transaction?.digest;
  console.log("create_mandate", digest ?? JSON.stringify(r.FailedTransaction?.status));
  await sui().waitForTransaction({ digest });
  const m = await j("/api/agent/mandate", { method: "POST", headers: H, body: JSON.stringify({ digest }) });
  console.log("mandate", m.status, JSON.stringify(m.body).slice(0, 220));
  const stream = async (path: string) => {
    const res = await fetch(BASE + path, { method: "POST", headers: H });
    const txt = await res.text();
    return txt.trim().split("\n").map((l) => JSON.parse(l));
  };
  const t0 = Date.now();
  const evs = await stream("/api/agent/run");
  for (const e of evs) {
    const s = e.t === "log" ? e.text : e.t === "lands" ? `lands ${e.lands.map((l: any) => l.nodes.map((n: any) => n.result).join(" | ")).join(" || ")} DNA ${JSON.stringify(e.dna)}` : e.t === "candidate" ? `${e.candidate.title} match ${e.candidate.match} afford ${e.candidate.affordable} verified ${e.candidate.verified} :: ${e.candidate.reasoning.slice(0, 120)}` : e.t === "ranked" ? `pick ${e.pickId}` : e.t === "universe" ? `universe names ${e.names} districts ${e.districts.map((d: any) => d.id + ":" + d.thought).join(" ; ")}` : e.t === "error" ? `ERROR ${e.error}` : e.t;
    console.log(`+${((e.at - t0) / 1000).toFixed(1)}s`, e.t, "·", String(s).slice(0, 400));
  }
  const runId = evs.find((e) => e.t === "run")?.runId;
  if (!evs.find((e) => e.t === "ranked")?.pickId) return;
  const t1 = Date.now();
  const pay = await stream(`/api/agent/runs/${runId}/pay`);
  for (const e of pay) console.log(`+${((e.at - t1) / 1000).toFixed(1)}s`, e.t, "·", JSON.stringify(e.step ?? e.payment ?? e.text ?? e.error ?? "").slice(0, 300));
})();
