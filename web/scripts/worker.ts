/** Background worker: Sui event poller, job runner (ENS relayer, operator tasks) and deadline scheduler. */
import { config } from "dotenv";
import { resolve } from "node:path";
config({ path: resolve(__dirname, "../../.env.local") });

import { pollOnce } from "../src/server/indexer";
import { runJobs, runScheduler } from "../src/server/jobs";

const loop = (name: string, ms: number, fn: () => Promise<unknown>) => {
  const tick = async () => {
    try {
      await fn();
    } catch (e: any) {
      console.error(`[worker:${name}]`, String(e?.message ?? e).slice(0, 300));
    }
    setTimeout(tick, ms);
  };
  tick();
};

console.log("brandmystuff worker started");
loop("poller", 4_000, pollOnce);
loop("jobs", 3_000, () => runJobs());
loop("scheduler", 20_000, runScheduler);
