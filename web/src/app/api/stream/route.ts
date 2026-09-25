/** Server-Sent Events: new notifications and chat messages for the signed-in user (Supabase Realtime → SSE). */
import { requireUser } from "@/server/auth";
import { db, q } from "@/server/db";
import { signAttachments } from "@/server/chat";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  let user;
  try {
    const url = new URL(req.url);
    const tok = url.searchParams.get("token");
    user = await requireUser(tok ? new Request(req.url, { headers: { authorization: `Bearer ${tok}` } }) : req);
  } catch {
    return new Response("unauthorized", { status: 401 });
  }
  const enc = new TextEncoder();
  const convIds = new Set<string>(
    (await q(db().from("conversations").select("id").or(`advertiser_user_id.eq.${user.id},owner_user_id.eq.${user.id}`))).map((c: any) => c.id),
  );
  let channel: ReturnType<ReturnType<typeof db>["channel"]> | null = null;
  let ping: ReturnType<typeof setInterval> | null = null;
  const stream = new ReadableStream({
    start(controller) {
      const send = (event: string, data: unknown) => controller.enqueue(enc.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      send("ready", { ok: true });
      channel = db()
        .channel(`user-${user!.id}-${Date.now()}`)
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user!.id}` }, (p) => send("notification", p.new))
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, async (p: any) => {
          if (!convIds.has(p.new.conversation_id)) {
            const c = await q(db().from("conversations").select("id, advertiser_user_id, owner_user_id").eq("id", p.new.conversation_id).maybeSingle());
            if (!c || (c.advertiser_user_id !== user!.id && c.owner_user_id !== user!.id)) return;
            convIds.add(c.id);
          }
          send("message", (await signAttachments([p.new]))[0]);
        })
        .subscribe();
      ping = setInterval(() => controller.enqueue(enc.encode(`: ping\n\n`)), 20_000);
    },
    cancel() {
      if (ping) clearInterval(ping);
      if (channel) db().removeChannel(channel);
    },
  });
  req.signal.addEventListener("abort", () => {
    if (ping) clearInterval(ping);
    if (channel) db().removeChannel(channel);
  });
  return new Response(stream, { headers: { "content-type": "text/event-stream", "cache-control": "no-cache, no-transform", connection: "keep-alive" } });
}
