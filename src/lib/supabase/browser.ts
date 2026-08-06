import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Browser-side Supabase client (anon key only). Used for Auth (GitHub OAuth)
 * and reading the logged-in user's own config. RLS scopes it to the user.
 *
 * Returns null if env vars are missing (e.g. during static prerender or local
 * dev without .env) instead of throwing at module scope — the UI then shows a
 * "config required" state rather than crashing the build.
 */

let browserClient: SupabaseClient | null = null;

export function getBrowserClient(): SupabaseClient | null {
  if (browserClient) return browserClient;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  browserClient = createClient(url, key);
  return browserClient;
}