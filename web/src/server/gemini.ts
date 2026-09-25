/** Gemini REST client (generateContent) with structured JSON output and inline images. */

export type Part = { text: string } | { image: Buffer; mime: string };

/** Rolling-window limiter: the key's free tier allows 15 requests/min/model. */
const RPM = Number(process.env.GEMINI_RPM ?? 14);
const g = globalThis as any;
const stamps: number[] = (g.__geminiStamps ??= []);
let chain: Promise<void> = (g.__geminiChain ??= Promise.resolve());

async function acquire() {
  const run = async () => {
    for (;;) {
      const now = Date.now();
      while (stamps.length && now - stamps[0] > 60_000) stamps.shift();
      if (stamps.length < RPM) {
        stamps.push(now);
        return;
      }
      await new Promise((r) => setTimeout(r, 60_000 - (now - stamps[0]) + 50));
    }
  };
  const p = chain.then(run);
  chain = g.__geminiChain = p.catch(() => undefined);
  return p;
}

function retryDelayMs(text: string) {
  const m = text.match(/retry in ([0-9.]+)s/i) ?? text.match(/"retryDelay":\s*"(\d+)s"/);
  return m ? Math.ceil(parseFloat(m[1]) * 1000) + 500 : 15_000;
}

export async function generateJson<T>(opts: {
  system: string;
  parts: Part[];
  schema: object;
  thinking?: boolean;
}): Promise<T> {
  const model = process.env.GEMINI_MODEL || "gemini-3.1-flash-lite";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  const body = {
    systemInstruction: { parts: [{ text: opts.system }] },
    contents: [
      {
        role: "user",
        parts: opts.parts.map((p) =>
          "text" in p ? { text: p.text } : { inline_data: { mime_type: p.mime, data: p.image.toString("base64") } },
        ),
      },
    ],
    generationConfig: {
      responseMimeType: "application/json",
      responseJsonSchema: opts.schema,
      ...(opts.thinking ? {} : { thinkingConfig: { thinkingBudget: 0 } }),
    },
  };
  let last: unknown;
  for (let attempt = 0; attempt < 6; attempt++) {
    await acquire();
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY! },
      body: JSON.stringify(body),
    });
    if (res.status === 429 || res.status >= 500) {
      const text = await res.text();
      last = new Error(`gemini ${res.status}: ${text.slice(0, 300)}`);
      if (res.status === 429 && /per ?day|PerDay/i.test(text)) throw new Error("Gemini daily quota exhausted — try again tomorrow or raise the key's quota.");
      await new Promise((r) => setTimeout(r, res.status === 429 ? retryDelayMs(text) : 1500 * (attempt + 1)));
      continue;
    }
    if (!res.ok) throw new Error(`gemini ${res.status}: ${(await res.text()).slice(0, 500)}`);
    const j: any = await res.json();
    const text = j.candidates?.[0]?.content?.parts?.map((p: any) => p.text ?? "").join("") ?? "";
    try {
      return JSON.parse(text) as T;
    } catch {
      last = new Error(`gemini returned non-JSON: ${text.slice(0, 200)}`);
    }
  }
  throw last;
}
