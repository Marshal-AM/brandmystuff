/** Shared helpers for the full-stack e2e scripts: actors, the HTTP API, signing, funding and photo fixtures. */
import { resolve } from "node:path";
import { readFileSync } from "node:fs";
import sharp from "sharp";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { Transaction } from "@mysten/sui/transactions";
import { SUI } from "../src/lib/deployment";
import * as T from "../src/lib/sui/tx";
import { balances, execute } from "../src/server/sui";

export const BASE = process.env.E2E_BASE ?? "http://localhost:3010";
export const fx = (f: string) => readFileSync(resolve(__dirname, "fixtures", f));
export const step = (s: string) => console.log(`\n▶ ${s}`);
export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
export const rand = Math.random().toString(36).slice(2, 7);

export type Actor = { name: string; kp: Ed25519Keypair; address: string; token?: string; userId?: string };
export const actor = (name: string): Actor => {
  const kp = new Ed25519Keypair();
  return { name, kp, address: kp.toSuiAddress() };
};

export async function http(a: Actor | null, path: string, init: RequestInit & { json?: unknown } = {}) {
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
export async function api(a: Actor | null, path: string, init: RequestInit & { json?: unknown } = {}) {
  const r = await http(a, path, init);
  if (r.status >= 400) throw new Error(`${init.method ?? "GET"} ${path} → ${r.status}: ${JSON.stringify(r.data).slice(0, 400)}`);
  return r.data;
}
export const form = (fields: Record<string, string | Blob>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return f;
};
export const file = (buf: Buffer, name: string, type = "image/jpeg") => new File([new Uint8Array(buf)], name, { type });

export async function signIn(a: Actor) {
  const n = await api(null, `/api/auth/sui/nonce?address=${a.address}`);
  const { signature } = await a.kp.signPersonalMessage(new TextEncoder().encode(n.message));
  const r = await api(null, "/api/auth/sui/verify", { method: "POST", json: { address: a.address, message: n.message, signature } });
  a.token = r.token;
  a.userId = r.user.id;
}

export async function runTx(a: Actor, tx: Transaction) {
  const r = await execute(tx, a.kp);
  const synced = await api(a, "/api/sync", { method: "POST", json: { digest: r.digest } });
  return { digest: r.digest, events: synced.events as { type: string; json: any }[] };
}
export const ev = (r: { events: any[] }, name: string) => r.events.find((e) => e.type.endsWith(name))?.json;

export async function fund(to: string, suiMist: bigint, usdc: bigint) {
  const tx = new Transaction();
  tx.transferObjects([tx.coin({ balance: suiMist })], tx.pure.address(to));
  if (usdc > 0n) tx.transferObjects([tx.coin({ type: SUI.usdcType, balance: usdc })], tx.pure.address(to));
  await execute(tx);
}

export async function sweep(a: Actor) {
  try {
    const b = await balances(a.address);
    if (b.usdc > 0n) await execute(T.sendCoin({ coinType: SUI.usdcType, amount: b.usdc, to: SUI.platformAddress }), a.kp);
    const s = (await balances(a.address)).sui;
    if (s > 10_000_000n) await execute(T.sendCoin({ coinType: "0x2::sui::SUI", amount: s - 10_000_000n, to: SUI.platformAddress }), a.kp);
  } catch (e: any) {
    console.warn("sweep", a.name, e.message);
  }
}

export async function logoPng(text: string) {
  return sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="600"><rect width="1200" height="600" rx="60" fill="#ff5a1f"/><text x="600" y="380" font-size="260" font-family="Helvetica" font-weight="bold" text-anchor="middle" fill="#fff">${text}</text></svg>`))
    .png()
    .toBuffer();
}

/** Simulates a fresh proof photo: a different framing of the lid each time, with the creative stuck on it. */
export const FRAMES = [
  { x0: 0.5, y0: 0.1, x1: 0.97, y1: 0.8, rot: 0 },
  { x0: 0.38, y0: 0.05, x1: 0.9, y1: 0.7, rot: 7 },
  { x0: 0.55, y0: 0.2, x1: 0.99, y1: 0.95, rot: -6 },
  { x0: 0.3, y0: 0.12, x1: 0.85, y1: 0.9, rot: 4 },
  { x0: 0.45, y0: 0.0, x1: 0.95, y1: 0.6, rot: -9 },
  { x0: 0.35, y0: 0.25, x1: 0.95, y1: 0.98, rot: 10 },
];
export async function proofPhoto(creative: Buffer, variant: number) {
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
  const composed = await sharp(region)
    .composite([{ input: sticker, left: Math.round((W - sm.width!) / 2), top: Math.round(H * 0.25) }])
    .toBuffer();
  return sharp(composed).rotate(f.rot, { background: "#e9e6e1" }).jpeg({ quality: 90 }).toBuffer();
}
