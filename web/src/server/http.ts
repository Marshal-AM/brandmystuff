import { ZodError, type ZodType } from "zod";
import { HttpError } from "./auth";

const json = (v: unknown, init?: ResponseInit) =>
  new Response(JSON.stringify(v, (_k, x) => (typeof x === "bigint" ? x.toString() : x)), {
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
  });

export { json };

/** Wraps a route handler with uniform error handling. */
export function handler<C = any>(fn: (req: Request, ctx: C) => Promise<Response | unknown>) {
  return async (req: Request, ctx: C) => {
    try {
      const out = await fn(req, ctx);
      return out instanceof Response ? out : json(out ?? { ok: true });
    } catch (e: any) {
      if (e instanceof HttpError) return json({ error: e.message, ...(e.extra ?? {}) }, { status: e.status });
      if (e instanceof ZodError) return json({ error: "Invalid input", issues: e.issues }, { status: 400 });
      console.error("[api]", e);
      return json({ error: e?.message ?? "Internal error" }, { status: 500 });
    }
  };
}

export async function body<T>(req: Request, schema: ZodType<T>): Promise<T> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw new HttpError(400, "Expected a JSON body");
  }
  return schema.parse(raw);
}

/** Streams NDJSON: `fn` gets an emit(line) callback; errors become {t:"error"} lines. */
export function ndjson(fn: (emit: (e: Record<string, unknown>) => void) => Promise<unknown>) {
  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (e: Record<string, unknown>) => {
        try {
          controller.enqueue(enc.encode(JSON.stringify({ ...e, at: Date.now() }) + "\n"));
        } catch {
          /* client went away */
        }
      };
      try {
        await fn(send);
        send({ t: "done" });
      } catch (e: any) {
        send({ t: "error", error: e?.message ?? "Something went wrong", status: e instanceof HttpError ? e.status : 500 });
      } finally {
        try {
          controller.close();
        } catch {}
      }
    },
  });
  return new Response(stream, { headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store", "x-accel-buffering": "no" } });
}
