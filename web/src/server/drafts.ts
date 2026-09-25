import { jwtVerify, SignJWT } from "jose";
const key = () => new TextEncoder().encode(process.env.SESSION_SECRET! + ":draft");
export const signDraft = (payload: Record<string, unknown>) =>
  new SignJWT(payload).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("2h").sign(key());
export async function readDraft<T>(token: string): Promise<T> {
  const { payload } = await jwtVerify(token, key());
  return payload as T;
}
