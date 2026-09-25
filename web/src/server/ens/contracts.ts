/**
 * ENSv2 (Sepolia Beta) contract addresses, ABIs and role constants.
 * ABIs are taken from ensdomains/contracts-v2 at the deployed commit 71a3b73 (2026-09-15).
 */
import { parseAbi } from "viem";

export const ENS = {
  rootRegistry: "0x9703dbd26dab89504490994138cf2c575251a9ce",
  ethRegistry: "0x657ea849311d3d5823348dded7c2aaafb3ede09e",
  ethRegistrar: "0xabe76f6c8dfced81aa5a2bb8034202a7136b94ca",
  verifiableFactory: "0x9e726eb570beb6bceb495ab8cda7df517d4e841c",
  permissionedResolverImpl: "0x14f09fd05d4585759e54844dc9b00147131cf243",
  userRegistryImpl: "0xa80338aaa8d23831cea25e858d1774534abb0263",
  universalResolver: "0xeEeEEEeE14D718C2B47D9923Deab1335E144EeEe",
  mockUsdc: "0x16f95d91dba7da3aca778ec053df0ff6c6a8aa8e",
} as const;

export const PARENT_LABEL = "brandmystuff";
export const PARENT_NAME = "brandmystuff.eth";
export const SUI_COIN_TYPE = 784n;

// Registry roles (RegistryRolesLib)
export const RR = {
  REGISTRAR: 1n << 0n,
  REGISTER_RESERVED: 1n << 4n,
  SET_PARENT: 1n << 8n,
  UNREGISTER: 1n << 12n,
  RENEW: 1n << 16n,
  SET_SUBREGISTRY: 1n << 20n,
  SET_RESOLVER: 1n << 24n,
  SET_URI: 1n << 36n,
  UPGRADE: 1n << 124n,
} as const;
export const CAN_TRANSFER_ADMIN = (1n << 28n) << 128n;
const withAdmin = (r: bigint) => r | (r << 128n);
export const REGISTRY_ROOT_ALL = Object.values(RR).reduce((a, r) => a | withAdmin(r), 0n);

// Resolver roles (PermissionedResolverLib)
export const RES = {
  SET_ADDRESS: 1n << 0n,
  SET_TEXT: 1n << 4n,
  SET_CONTENTHASH: 1n << 8n,
  SET_ABI: 1n << 12n,
  SET_INTERFACE: 1n << 16n,
  SET_NAME: 1n << 20n,
  SET_DATA: 1n << 24n,
  LINK: 1n << 28n,
  UPGRADE: 1n << 124n,
} as const;
export const RESOLVER_ROOT_ALL = Object.values(RES).reduce((a, r) => a | withAdmin(r), 0n);

/** Name-level roles granted to owners of account/object/space names (no transfer). */
export const OWNER_NAME_ROLES = RR.SET_RESOLVER;
/** Lease names: advertiser controls the resolver until expiry; non-transferable. */
export const LEASE_NAME_ROLES = RR.SET_RESOLVER;

export const registryAbi = parseAbi([
  "struct Grant { address account; uint256 roleBitmap; }",
  "struct State { uint8 status; uint64 expiry; address latestOwner; uint256 tokenId; uint256 resource; }",
  "function initialize(Grant[] grants)",
  "function register(string label, address owner, address registry, address resolver, uint256 roleBitmap, uint64 expiry) returns (uint256)",
  "function renew(uint256 anyId, uint64 newExpiry)",
  "function unregister(uint256 anyId)",
  "function setSubregistry(uint256 anyId, address registry)",
  "function setResolver(uint256 anyId, address resolver)",
  "function setParent(address parent, string label)",
  "function getState(uint256 anyId) view returns (State)",
  "function getSubregistry(string label) view returns (address)",
  "function getResolver(string label) view returns (address)",
  "function ownerOf(uint256 tokenId) view returns (address)",
  "function hasRootRoles(uint256 roleBitmap, address account) view returns (bool)",
]);

export const resolverAbi = parseAbi([
  "struct Grant { address account; uint256 roleBitmap; }",
  "function initialize(Grant[] grants, bytes[] calls)",
  "function setText(bytes name, string key, string value)",
  "function setAddress(bytes name, uint256 coinType, bytes addressBytes)",
  "function setData(bytes name, string key, bytes value)",
  "function multicall(bytes[] calls) returns (bytes[])",
  "function text(bytes32 node, string key) view returns (string)",
]);

export const factoryAbi = parseAbi([
  "function deployProxy(address implementation, uint256 salt, bytes data) returns (address)",
  "function predictProxyAddress(address deployer, uint256 salt) view returns (address)",
  "event ProxyDeployed(address indexed sender, address indexed proxyAddress, uint256 salt, address implementation)",
]);

export const registrarAbi = parseAbi([
  "function commit(bytes32 commitment)",
  "function register(string label, address owner, bytes32 secret, address subregistry, address resolver, uint64 duration, address paymentToken, bytes32 referrer) returns (uint256)",
  "function makeCommitment(string label, address owner, bytes32 secret, address subregistry, address resolver, uint64 duration, bytes32 referrer) pure returns (bytes32)",
  "function isAvailable(string label) view returns (bool)",
  "function getRegisterPrice(string label, uint64 duration, address paymentToken) view returns (uint256 base, uint256 premium)",
]);

export const erc20Abi = parseAbi([
  "function mint(address to, uint256 amount)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
]);
