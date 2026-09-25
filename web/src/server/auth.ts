/**
 * Request authentication.
 *  - Privy users: `Authorization: Bearer <privy access token>`; wallets come from the Privy user record.
 *  - External Sui wallets: "Sign in with Sui" → our own session JWT (`bms_session` cookie or Bearer).
 */
import { PrivyClient } from "@privy-io/node";
import { jwtVerify, SignJWT } from "jose";
import { db, q, ok } from "./db";

export type AppUser = {
  id: string;
  privy_did: string | null;
  handle: string | null;
  ens_name: string | null;
  sui_address: string | null;
  evm_address: string | null;
  display_name: string | null;
  brand_name: string | null;
  is_admin: boolean;
  ens_status: string;
};

export class HttpError extends Error {
  constructor(public status: number, message: string, public extra?: Record<string, unknown>) {
    super(message);
  }
}

let privyClient: PrivyClient | undefined;
export function privy() {
  if (!privyClient) privyClient = new PrivyClient({ appId: process.env.PRIVY_APP_ID!, appSecret: process.env.PRIVY_APP_SECRET! });
  return privyClient;
}

const secret = () => new TextEncoder().encode(process.env.SESSION_SECRET!);

export async function issueSession(userId: string, address: string) {
  return new SignJWT({ uid: userId, addr: address })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret());
}

type PrivyWallets = { sui?: string; suiPublicKey?: string; evm?: string };

/** Reads the user's embedded Sui + Ethereum wallets from Privy, creating any that are missing. */
export async function privyWallets(did: string): Promise<PrivyWallets> {
  const read = (u: any): PrivyWallets => {
    const out: PrivyWallets = {};
    for (const a of u.linked_accounts ?? []) {
      if (a.type !== "wallet") continue;
      if (a.chain_type === "sui" && !out.sui) {
        out.sui = a.address;
        out.suiPublicKey = a.public_key;
      }
      if (a.chain_type === "ethereum" && a.wallet_client_type === "privy" && !out.evm) out.evm = a.address;
    }
    return out;
  };
  let user = await privy().users()._get(did);
  let w = read(user);
  const missing: { chain_type: any }[] = [];
  if (!w.sui) missing.push({ chain_type: "sui" });
  if (!w.evm) missing.push({ chain_type: "ethereum" });
  if (missing.length) {
    user = await privy().users().pregenerateWallets(did, { wallets: missing } as any);
    w = read(user);
  }
  return w;
}

async function userFromPrivy(token: string): Promise<AppUser> {
  let claims;
  try {
    claims = await privy().utils().auth().verifyAccessToken(token);
  } catch {
    throw new HttpError(401, "Invalid or expired session");
  }
  const did = (claims as any).user_id as string;
  const existing = await q(db().from("users").select("*").eq("privy_did", did).maybeSingle());
  if (existing?.sui_address && existing?.evm_address && existing?.sui_public_key) return existing as AppUser;
  const w = await privyWallets(did);
  if (!w.sui) throw new HttpError(500, "Could not provision a Sui wallet");
  const row = await q(
    db()
      .from("users")
      .upsert({ privy_did: did, sui_address: w.sui, sui_public_key: w.suiPublicKey ?? null, evm_address: w.evm ?? null, wallet_kind: "privy" }, { onConflict: "privy_did" })
      .select("*")
      .single(),
  );
  await ok(db().from("linked_wallets").upsert({ address: w.sui, user_id: row.id, kind: "privy_embedded" }));
  return row as AppUser;
}

async function userFromSession(token: string): Promise<AppUser | null> {
  try {
    const { payload } = await jwtVerify(token, secret());
    const row = await q(db().from("users").select("*").eq("id", payload.uid as string).maybeSingle());
    return (row as AppUser) ?? null;
  } catch {
    return null;
  }
}

function bearer(req: Request) {
  const h = req.headers.get("authorization");
  if (h?.startsWith("Bearer ")) return h.slice(7);
  const cookie = req.headers.get("cookie") ?? "";
  const m = cookie.match(/(?:^|;\s*)bms_session=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

export async function optionalUser(req: Request): Promise<AppUser | null> {
  const tok = bearer(req);
  if (!tok) return null;
  const sess = await userFromSession(tok);
  if (sess) return sess;
  try {
    return await userFromPrivy(tok);
  } catch {
    return null;
  }
}

export async function requireUser(req: Request): Promise<AppUser> {
  const tok = bearer(req);
  if (!tok) throw new HttpError(401, "Sign in required");
  const sess = await userFromSession(tok);
  if (sess) return sess;
  return userFromPrivy(tok);
}

export async function requireAdmin(req: Request): Promise<AppUser> {
  const u = await requireUser(req);
  if (!u.is_admin) throw new HttpError(403, "Admins only");
  return u;
}
