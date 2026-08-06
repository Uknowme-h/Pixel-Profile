import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Server-side Supabase clients.
 *
 * Service-role client bypasses RLS — used ONLY in server code / Actions
 * workflow. Never import this into client components.
 */

let serviceClient: SupabaseClient | null = null;

export function getServiceClient(): SupabaseClient {
  if (serviceClient) return serviceClient;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Supabase env vars missing (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)");
  }
  serviceClient = createClient(url, key, {
    auth: { persistSession: false },
  });
  return serviceClient;
}

export type { SupabaseClient };
