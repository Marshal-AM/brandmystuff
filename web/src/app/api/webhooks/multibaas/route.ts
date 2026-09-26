import { db, q } from "@/server/db";
import { verifyWebhook, type MbEvent } from "@/server/payouts/multibaas";
import { applyDeliveredEvent } from "@/server/payouts/engine";

/**
 * MultiBaas webhooks (one per chain deployment, URL carries ?chain=<key>).
 * Verified with HMAC-SHA256(secret, rawBody || timestamp); deliveries are batched and deduped by id.
 */
export const POST = async (req: Request) => {
  const chain = new URL(req.url).searchParams.get("chain") ?? "";
  const hook = await q(db().from("multibaas_webhooks").select("secret").eq("chain", chain).maybeSingle());
  if (!hook) return new Response("unknown chain", { status: 404 });
  const raw = await req.text();
  if (!verifyWebhook(raw, req.headers.get("x-multibaas-timestamp"), req.headers.get("x-multibaas-signature"), hook.secret)) return new Response("bad signature", { status: 401 });
  let items: { id: string; event: string; data: any }[] = [];
  try {
    items = JSON.parse(raw);
  } catch {
    return new Response("bad json", { status: 400 });
  }
  let applied = 0;
  for (const it of Array.isArray(items) ? items : [items]) {
    const { error } = await db().from("multibaas_events").insert({ id: it.id, chain, kind: it.event, payload: it.data });
    if (error) continue; // already processed
    if (it.event === "event.emitted" && (await applyDeliveredEvent(chain, it.data as MbEvent))) applied++;
  }
  return Response.json({ ok: true, applied });
};
