/** Supabase (service role). Server-only: the browser never talks to Supabase directly. */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | undefined;

export function db(): SupabaseClient {
  if (!client) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error("Supabase env missing");
    client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  }
  return client;
}

/** Unwraps a Supabase response, throwing on error. */
export async function q<T = any>(p: PromiseLike<{ data: T; error: any }>): Promise<any> {
  const { data, error } = await p;
  if (error) throw new Error(`db: ${error.message ?? JSON.stringify(error)}`);
  return data;
}

/** Awaits a Supabase write and throws on error. */
export async function ok<T = any>(p: PromiseLike<{ data: T; error: any }>): Promise<any> {
  const { data, error } = await p;
  if (error) throw new Error(`db: ${error.message ?? JSON.stringify(error)}`);
  return data;
}
