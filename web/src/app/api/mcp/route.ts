/**
 * Minimal MCP server (JSON-RPC 2.0 over HTTP POST, Streamable-HTTP compatible JSON responses).
 * Advertised via ENSIP-26 on agent.brandmystuff.eth. Paid actions use the x402 endpoints.
 */
import { db, q } from "@/server/db";
import { quoteLease, resolveSpace, sponsorPrice } from "@/server/x402flows";
import { requirements } from "@/server/x402";
import { SUI, blobUrl } from "@/lib/deployment";

const APP = process.env.APP_URL ?? "http://localhost:3000";
const GR = ["—", "C", "B", "A", "A+"];

const TOOLS = [
  {
    name: "search_spaces",
    description: "Search listed ad spaces on physical objects, ranked by Ad-Space Quality Score. Returns id, ENS name, grade, size, weekly price (USDC) and availability.",
    inputSchema: { type: "object", properties: { query: { type: "string" }, tag: { type: "string", description: "AI-derived object tag, e.g. laptop, car, helmet" }, city: { type: "string" }, maxPricePerWeekUsdc: { type: "number" }, minGrade: { type: "string", enum: ["C", "B", "A", "A+"] }, limit: { type: "integer", minimum: 1, maximum: 50 } } },
  },
  { name: "get_space", description: "Get full details of one ad space (by id or ENS name), including AQS breakdown, booked weeks and lease history.", inputSchema: { type: "object", properties: { spaceId: { type: "string" }, ensName: { type: "string" } } } },
  { name: "get_object", description: "Get an object and all its ad spaces (by id or ENS name).", inputSchema: { type: "object", properties: { objectId: { type: "string" }, ensName: { type: "string" } } } },
  {
    name: "quote_lease",
    description: "Quote a lease and get the exact x402 PaymentRequired object. Then POST the same JSON body to the returned endpoint; pay per x402 v2 exact scheme on sui:testnet (USDC).",
    inputSchema: { type: "object", required: ["weeks"], properties: { spaceId: { type: "string" }, ensName: { type: "string" }, weeks: { type: "integer", minimum: 1, maximum: 52 }, startWeek: { type: "integer" } } },
  },
  { name: "quote_sponsorship", description: "Quote a Sponsored tag for an object (tier 1 search/listing slots, tier 2 homepage rail).", inputSchema: { type: "object", required: ["tier", "days"], properties: { objectId: { type: "string" }, ensName: { type: "string" }, tier: { type: "integer", enum: [1, 2] }, days: { type: "integer", minimum: 1, maximum: 90 } } } },
];

const card = (s: any) => ({
  spaceId: s.id,
  ensName: s.ens_name,
  label: s.label,
  object: s.objects?.title,
  objectType: s.objects?.object_type ?? s.objects?.category,
  tags: s.objects?.tags,
  city: s.objects?.city,
  aqs: s.aqs,
  grade: GR[s.grade],
  sizeCm: `${s.width_mm / 10}x${s.height_mm / 10}`,
  placement: s.placement,
  pricePerWeekUsdc: Number(s.price_per_week) / 1e6,
  closeupImage: blobUrl(s.closeup_blob_id),
  url: `${APP}/${s.ens_name}`,
});

async function call(name: string, a: any) {
  switch (name) {
    case "search_spaces": {
      let qy = db().from("spaces").select("*, objects!inner(title, category, object_type, tags, city)").eq("status", "available").gte("aqs", 40).order("rank_score", { ascending: false }).limit(a.limit ?? 10);
      if (a.tag) qy = qy.contains("objects.tags", [String(a.tag).toLowerCase()]);
      if (a.city) qy = qy.ilike("objects.city", `%${a.city}%`);
      if (a.maxPricePerWeekUsdc) qy = qy.lte("price_per_week", Math.round(a.maxPricePerWeekUsdc * 1e6));
      if (a.minGrade) qy = qy.gte("grade", GR.indexOf(a.minGrade));
      if (a.query) qy = qy.or(`label.ilike.%${a.query}%,ens_name.ilike.%${a.query}%,objects.title.ilike.%${a.query}%`, { referencedTable: undefined } as any);
      const rows = await q(qy).catch(async () => q(db().from("spaces").select("*, objects!inner(title, category, object_type, tags, city)").eq("status", "available").order("rank_score", { ascending: false }).limit(a.limit ?? 10)));
      return { spaces: rows.map(card) };
    }
    case "get_space": {
      const s = await resolveSpace(a);
      const o = await q(db().from("objects").select("title, category, object_type, tags, city, ens_name").eq("id", s.object_id).single());
      const booked = await q(db().from("leases").select("start_ms, week_ms, weeks, status").eq("space_id", s.id).neq("status", "cancelled"));
      return { ...card({ ...s, objects: o }), subscores: s.subscores, strengths: s.strengths, weaknesses: s.weaknesses, weekMs: Number(s.week_ms), currentWeek: Math.floor(Date.now() / Number(s.week_ms)), bookedWeeks: booked.flatMap((l: any) => Array.from({ length: l.weeks }, (_, i) => Math.floor(Number(l.start_ms) / Number(l.week_ms)) + i)) };
    }
    case "get_object": {
      const o = a.objectId ? await q(db().from("objects").select("*").eq("id", a.objectId).maybeSingle()) : await q(db().from("objects").select("*").eq("ens_name", String(a.ensName ?? "").toLowerCase()).maybeSingle());
      if (!o) throw new Error("object not found");
      const spaces = await q(db().from("spaces").select("*").eq("object_id", o.id).eq("status", "available"));
      return { objectId: o.id, ensName: o.ens_name, title: o.title, objectType: o.object_type, tags: o.tags, description: o.description, city: o.city, aqs: o.object_aqs, heroImage: blobUrl(o.hero_blob_id), spaces: spaces.map((s: any) => card({ ...s, objects: o })) };
    }
    case "quote_lease": {
      const s = await resolveSpace(a);
      const qt = await quoteLease(s, a.weeks, a.startWeek);
      return {
        endpoint: `${APP}/api/x402/leases`,
        method: "POST",
        body: { spaceId: s.id, weeks: a.weeks, startWeek: qt.startWeek, creativeUrl: "<https URL of your creative image>", landingUrl: "<your landing page>", brand: "<brand name>" },
        amountUsdc: Number(qt.amount) / 1e6,
        startMs: qt.startMs,
        endMs: qt.endMs,
        paymentRequirements: requirements(qt.amount, { kind: "lease", space: s.ens_name, startWeek: qt.startWeek, weeks: a.weeks }),
        note: "POST the body without a payment header to receive the binding PAYMENT-REQUIRED (with intentId), then retry with PAYMENT-SIGNATURE. Network sui:testnet, asset USDC " + SUI.usdcType,
      };
    }
    case "quote_sponsorship": {
      const price = await sponsorPrice(a.tier);
      return { endpoint: `${APP}/api/x402/sponsorships`, method: "POST", body: { objectId: a.objectId, ensName: a.ensName, tier: a.tier, days: a.days }, amountUsdc: (Number(price) * a.days) / 1e6 };
    }
  }
  throw new Error(`unknown tool ${name}`);
}

export async function POST(req: Request) {
  const msg = await req.json().catch(() => null);
  const reply = (id: any, result: any) => Response.json({ jsonrpc: "2.0", id, result });
  const fail = (id: any, code: number, message: string) => Response.json({ jsonrpc: "2.0", id, error: { code, message } });
  if (!msg || msg.jsonrpc !== "2.0") return fail(null, -32600, "Invalid Request");
  const { id, method, params } = msg;
  if (id === undefined) return new Response(null, { status: 202 }); // notification
  switch (method) {
    case "initialize":
      return reply(id, { protocolVersion: params?.protocolVersion ?? "2025-06-18", capabilities: { tools: {} }, serverInfo: { name: "brandmystuff", version: "1.0.0" }, instructions: "Discover physical ad spaces and lease them with x402 (USDC on Sui testnet)." });
    case "ping":
      return reply(id, {});
    case "tools/list":
      return reply(id, { tools: TOOLS });
    case "tools/call":
      try {
        const out = await call(params?.name, params?.arguments ?? {});
        return reply(id, { content: [{ type: "text", text: JSON.stringify(out, null, 2) }], structuredContent: out });
      } catch (e: any) {
        return reply(id, { content: [{ type: "text", text: String(e?.message ?? e) }], isError: true });
      }
    default:
      return fail(id, -32601, `Method not found: ${method}`);
  }
}

export async function GET() {
  return Response.json({ name: "brandmystuff MCP", transport: "POST JSON-RPC 2.0 to this URL", tools: TOOLS.map((t) => t.name) });
}
