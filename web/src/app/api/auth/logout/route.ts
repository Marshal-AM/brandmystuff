import { json } from "@/server/http";
export async function POST() {
  return json({ ok: true }, { headers: { "set-cookie": "bms_session=; Path=/; HttpOnly; Max-Age=0" } });
}
