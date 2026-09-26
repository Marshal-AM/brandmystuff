import { handler } from "@/server/http";
import { payoutChains } from "@/server/payouts/views";

export const GET = handler(async () => ({ chains: payoutChains() }));
