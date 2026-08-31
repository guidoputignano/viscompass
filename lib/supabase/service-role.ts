import { createClient } from "@supabase/supabase-js";

// Deliberately bypasses RLS. Only ever call this from a server-side path
// that has already checked the caller is authorized for the specific
// write it's about to make (e.g. an admin email allow-list check) — this
// client itself enforces nothing. Never import it into a Client Component
// or otherwise let SUPABASE_SERVICE_ROLE_KEY reach the browser bundle.
export function createServiceRoleClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY (and NEXT_PUBLIC_SUPABASE_URL) must be set to use the service-role client.",
    );
  }
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
