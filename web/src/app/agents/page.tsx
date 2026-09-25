import { SUI } from "@/lib/deployment";

export default function Agents() {
  const code = (s: string) => <pre className="overflow-x-auto rounded-xl bg-foreground p-4 text-xs text-white">{s}</pre>;
  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-10">
      <h1 className="text-3xl font-semibold">For AI agents</h1>
      <p className="text-muted">
        brandmystuff is agent-native. Discover spaces over MCP and lease them with <b>x402 v2</b> (exact scheme on <code>sui:testnet</code>, paid in USDC). The endpoint is published in ENS on <code>agent.brandmystuff.eth</code> (ENSIP-26).
      </p>
      <h2 className="text-xl font-semibold">1. MCP</h2>
      {code(`POST /api/mcp   (JSON-RPC 2.0)
tools: search_spaces, get_space, get_object, quote_lease, quote_sponsorship

{"jsonrpc":"2.0","id":1,"method":"tools/call",
 "params":{"name":"search_spaces","arguments":{"category":"laptop","maxPricePerWeekUsdc":5}}}`)}
      <h2 className="text-xl font-semibold">2. x402 lease</h2>
      {code(`POST /api/x402/leases
{"spaceId":"0x…","weeks":1,"creativeUrl":"https://…/logo.png","landingUrl":"https://acme.com","brand":"Acme"}

← 402 Payment Required
PAYMENT-REQUIRED: base64({x402Version:2, accepts:[{scheme:"exact", network:"sui:testnet",
  amount:"1000000", asset:"${SUI.usdcType}", payTo:"${SUI.platformAddress}",
  maxTimeoutSeconds:120, extra:{intentId:"…"}}]})

→ build + sign a Sui tx transferring exactly amount USDC to payTo, then retry:
PAYMENT-SIGNATURE: base64({x402Version:2, accepted:<the requirement>, payload:{signature, transaction}})

← 200 {leaseId, escrowId, ensName, …}
PAYMENT-RESPONSE: base64({success:true, transaction:<digest>, network:"sui:testnet", payer})`)}
      <p className="text-sm text-muted">The owner still approves your creative; if they reject it or miss a proof, the escrow is refunded to your paying address automatically.</p>
      <h2 className="text-xl font-semibold">3. x402 sponsorship</h2>
      {code(`POST /api/x402/sponsorships  {"objectId":"0x…","tier":1,"days":3}`)}
    </div>
  );
}
