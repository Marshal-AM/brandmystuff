import { z } from "zod";
import { handler, body } from "@/server/http";
import { HttpError, requireUser } from "@/server/auth";
import { db, q } from "@/server/db";
import { buildLegalPack, acceptanceMessage } from "@/server/legal";
import { configSeq } from "@/server/chainread";

const GR = ["—", "C", "B", "A", "A+"];
const schema = z.object({
  spaceId: z.string(),
  revenueShareBps: z.number().int().min(1000).max(8800),
  retainedUnits: z.number().int().min(1000).max(9999),
  pricePerUnit: z.string().regex(/^\d+$/),
  minRaiseUnits: z.number().int().min(0),
  saleDurationMs: z.number().int().min(300_000).max(30 * 86400_000),
  perInvestorMax: z.number().int().min(1),
  termMonths: z.number().int().min(6).max(36),
});

type Emit = (e: Record<string, unknown>) => void | Promise<void>;

async function prepare(req: Request, emit: Emit) {
  const u = await requireUser(req);
  const b = await body(req, schema);
  const s = await q(db().from("spaces").select("*").eq("id", b.spaceId).single());
  if (s.owner_address !== u.sui_address) throw new HttpError(403, "Not your space");
  if (s.offering_id) throw new HttpError(400, "Space already tokenised");
  if (s.grade < 2) throw new HttpError(400, "Only spaces graded B or better can be tokenised");
  const offered = 10_000 - b.retainedUnits;
  if (b.minRaiseUnits > offered || b.perInvestorMax > offered) throw new HttpError(400, "Min raise and per-investor max cannot exceed offered units");
  const cfg = await configSeq();
  if (!cfg.demoMode && s.completed_leases < 1 && s.accepted_proofs < 1) throw new HttpError(400, "Needs at least one completed lease or accepted proof");
  await emit({ t: "check", grade: GR[s.grade], aqs: s.aqs, ensName: s.ens_name, demoMode: cfg.demoMode, offered });
  const seriesNo = String(cfg.offeringSeq + 1).padStart(6, "0");
  await emit({ t: "series", seriesNo });
  const pack = await buildLegalPack(
    {
      seriesNo,
      spaceEns: s.ens_name,
      spaceId: s.id,
      ownerAddress: u.sui_address!,
      ownerName: u.display_name ?? u.ens_name ?? u.sui_address!,
      revenueShareBps: b.revenueShareBps,
      retainedUnits: b.retainedUnits,
      pricePerUnit: BigInt(b.pricePerUnit),
      minRaiseUnits: b.minRaiseUnits,
      saleDurationMs: b.saleDurationMs,
      perInvestorMax: b.perInvestorMax,
      termMonths: b.termMonths,
      aqs: s.aqs,
      grade: GR[s.grade],
      completedLeases: s.completed_leases,
      pricePerWeek: BigInt(s.price_per_week),
    },
    emit,
  );
  return { pack, demoMode: cfg.demoMode, message: acceptanceMessage(`new:${s.id}`, pack.packHash, b.retainedUnits) };
}

/**
 * Builds the legal pack. With ?stream=1 the response is NDJSON: one progress event per
 * line as each step really happens, then {t:"done", result} (or {t:"error", error}).
 */
export const POST = async (req: Request, ctx: unknown) => {
  if (new URL(req.url).searchParams.get("stream") !== "1") return handler(async (r: Request) => prepare(r, () => {}))(req, ctx);
  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (e: Record<string, unknown>) => controller.enqueue(enc.encode(JSON.stringify({ ...e, at: Date.now() }) + "\n"));
      try {
        const result = await prepare(req, send);
        send({ t: "done", result });
      } catch (e: any) {
        send({ t: "error", error: e?.message ?? "Could not build the legal pack", status: e instanceof HttpError ? e.status : 500 });
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, { headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store", "x-accel-buffering": "no" } });
};
