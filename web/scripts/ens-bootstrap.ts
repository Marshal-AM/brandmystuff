/**
 * Idempotent ENSv2 (Sepolia) bootstrap for brandmystuff.eth:
 *  1. deploy the platform PermissionedResolver + root UserRegistry (VerifiableFactory proxies)
 *  2. register brandmystuff.eth via ETHRegistrar (commit-reveal, MockUSDC fee), pointing at them
 *  3. write platform records and register agent.brandmystuff.eth
 * Writes deployments/ens.sepolia.json.
 */
import "dotenv/config";
import { config as loadEnv } from "dotenv";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { keccak256, toBytes, zeroHash, type Hex } from "viem";
import {
  ENS,
  PARENT_LABEL,
  PARENT_NAME,
  REGISTRY_ROOT_ALL,
  RESOLVER_ROOT_ALL,
  RR,
  erc20Abi,
  registrarAbi,
  registryAbi,
} from "../src/server/ens/contracts";
import {
  ensClients,
  ensureResolver,
  ensureUserRegistry,
  getState,
  registerName,
  send,
  setRecords,
  suiAddr,
} from "../src/server/ens/client";

loadEnv({ path: resolve(__dirname, "../../.env.local") });

const root = resolve(__dirname, "../..");
const sui = JSON.parse(readFileSync(resolve(root, "deployments/sui.testnet.json"), "utf8"));
const APP_URL = process.env.APP_URL ?? "http://localhost:3000";
const FIVE_YEARS = 5n * 365n * 24n * 3600n;

async function main() {
  const c = ensClients(process.env.SEPOLIA_RPC_URL!, process.env.SEPOLIA_PLATFORM_PRIVATE_KEY as Hex);
  const me = c.account.address;
  console.log("platform key", me);

  const outPath = resolve(root, "deployments/ens.sepolia.json");
  const prev = existsSync(outPath) ? JSON.parse(readFileSync(outPath, "utf8")) : {};
  const save = (o: object) => writeFileSync(outPath, JSON.stringify({ ...prev, ...o, updatedAt: new Date().toISOString() }, null, 2));
  const resolver = await ensureResolver(c, "platform", RESOLVER_ROOT_ALL, prev.platformResolver);
  prev.platformResolver = resolver;
  save({ platformResolver: resolver });
  console.log("platform resolver", resolver);
  const rootRegistry = await ensureUserRegistry(c, PARENT_NAME, REGISTRY_ROOT_ALL, prev.rootRegistry);
  prev.rootRegistry = rootRegistry;
  save({ rootRegistry });
  console.log("root registry", rootRegistry);

  const st = await getState(c, ENS.ethRegistry, PARENT_LABEL);
  if (st.status !== 2) {
    const secret = keccak256(toBytes(`brandmystuff-secret-${me}`));
    const referrer = zeroHash;
    const commitment = (await c.pub.readContract({
      address: ENS.ethRegistrar,
      abi: registrarAbi,
      functionName: "makeCommitment",
      args: [PARENT_LABEL, me, secret, rootRegistry, resolver, FIVE_YEARS, referrer],
    })) as Hex;
    const [base, premium] = (await c.pub.readContract({
      address: ENS.ethRegistrar,
      abi: registrarAbi,
      functionName: "getRegisterPrice",
      args: [PARENT_LABEL, FIVE_YEARS, ENS.mockUsdc],
    })) as [bigint, bigint];
    const price = base + premium;
    console.log("price (MockUSDC atomic)", price);
    await send(c, { address: ENS.mockUsdc, abi: erc20Abi, functionName: "mint", args: [me, price * 2n] });
    await send(c, { address: ENS.mockUsdc, abi: erc20Abi, functionName: "approve", args: [ENS.ethRegistrar, price * 2n] });
    await send(c, { address: ENS.ethRegistrar, abi: registrarAbi, functionName: "commit", args: [commitment] });
    console.log("committed; waiting 70s for min commitment age");
    await new Promise((r) => setTimeout(r, 70_000));
    await send(c, {
      address: ENS.ethRegistrar,
      abi: registrarAbi,
      functionName: "register",
      args: [PARENT_LABEL, me, secret, rootRegistry, resolver, FIVE_YEARS, ENS.mockUsdc, referrer],
    });
    console.log("registered", PARENT_NAME);
  } else {
    console.log(PARENT_NAME, "already registered, expiry", st.expiry);
  }

  // Parent pointer for canonical-name discovery.
  await send(c, { address: rootRegistry, abi: registryAbi, functionName: "setParent", args: [ENS.ethRegistry, PARENT_LABEL] });

  await setRecords(c, resolver, PARENT_NAME, {
    texts: {
      description: "brandmystuff — rent, lease and tokenise ad spaces on the things you own.",
      url: APP_URL,
      class: "Platform",
      "eth.brandmystuff.sui.package": sui.packageId,
      "eth.brandmystuff.sui.network": "testnet",
      "eth.brandmystuff.aqs.rubric": "aqs-1.0.0",
    },
    addrs: [suiAddr(sui.platformAddress), { coinType: 60n, value: me }],
  });

  const expiry = BigInt(Math.floor(Date.now() / 1000)) + FIVE_YEARS - 86_400n;
  await registerName(c, { registry: rootRegistry, label: "agent", owner: me, resolver, roles: RR.SET_RESOLVER, expiry });
  await setRecords(c, resolver, `agent.${PARENT_NAME}`, {
    texts: {
      class: "Agent",
      description: "brandmystuff agent endpoint: discover ad spaces over MCP and lease them with x402 (USDC on Sui).",
      "agent-context": "Search and lease physical ad spaces. Tools: search_spaces, get_space, get_object, quote_lease. Paid actions use x402 v2 exact scheme on sui:testnet.",
      "agent-endpoint[mcp]": `${APP_URL}/api/mcp`,
      "eth.brandmystuff.x402": `${APP_URL}/api/x402`,
    },
  });

  const out = {
    network: "sepolia",
    parentName: PARENT_NAME,
    platformKey: me,
    platformResolver: resolver,
    rootRegistry,
    contracts: ENS,
    updatedAt: new Date().toISOString(),
  };
  save(out);
  console.log("done", out);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
