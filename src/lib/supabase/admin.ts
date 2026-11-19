import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Admin Supabase client (SECRET / service_role key — BYPASSES RLS).
 *
 * SERVER-ONLY. Never import this into a Client Component. Used by seeding and by
 * server actions that enforce maker-checker in code (the real write boundary).
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Supabase admin not configured — set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local.",
    );
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
