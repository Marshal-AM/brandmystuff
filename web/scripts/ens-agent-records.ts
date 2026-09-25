/** Updates agent.brandmystuff.eth / brandmystuff.eth URL records to the current APP_URL. */
import { config } from "dotenv";
import { resolve } from "node:path";
config({ path: resolve(__dirname, "../../.env.local") });
import type { Hex } from "viem";
import { ensClients, setRecords } from "../src/server/ens/client";
import { ENS_DEPLOYMENT } from "../src/lib/deployment";

(async () => {
  const APP = process.env.APP_URL!;
  const c = ensClients(process.env.SEPOLIA_RPC_URL!, process.env.SEPOLIA_PLATFORM_PRIVATE_KEY as Hex);
  await setRecords(c, ENS_DEPLOYMENT.platformResolver, "brandmystuff.eth", { texts: { url: APP } });
  await setRecords(c, ENS_DEPLOYMENT.platformResolver, "agent.brandmystuff.eth", { texts: { "agent-endpoint[mcp]": `${APP}/api/mcp`, "eth.brandmystuff.x402": `${APP}/api/x402` } });
  console.log("ENS URL records now point at", APP);
})();
