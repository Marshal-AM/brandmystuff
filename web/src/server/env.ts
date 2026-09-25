
import { z } from "zod";

const schema = z.object({
  PRIVY_APP_ID: z.string().min(1),
  PRIVY_APP_SECRET: z.string().min(1),
  GEMINI_API_KEY: z.string().min(1),
  GEMINI_MODEL: z.string().default("gemini-3.1-flash-lite"),
  SEPOLIA_RPC_URL: z.string().url(),
  SEPOLIA_PLATFORM_PRIVATE_KEY: z.string().regex(/^0x[0-9a-fA-F]{64}$/),
  SUI_NETWORK: z.enum(["testnet"]).default("testnet"),
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  APP_URL: z.string().url().default("http://localhost:3000"),
});

export type Env = z.infer<typeof schema>;

let cached: Env | undefined;

export function env(): Env {
  if (!cached) cached = schema.parse(process.env);
  return cached;
}
