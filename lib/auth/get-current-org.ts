import { createClient } from "@/lib/supabase/server";
import type { Organization } from "@/lib/dashboard-review/types";

// The only source of truth for "which organization is this user allowed
// to act as." Always derived from the live session against
// user_organizations + organizations (status = 'approved') — never from a
// client-supplied org code, org_type, or region_code. RLS enforces the
// same "own approved membership" rule at the database level; this helper
// exists so the UI can know which profile (asl vs regione) to render
// without re-deriving that logic in every page.
async function getApprovedOrgs(): Promise<Organization[]> {
  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.getClaims();
  if (authError || !authData?.claims) return [];

  const { data, error } = await supabase
    .from("user_organizations")
    .select("approved_at, organizations(org_code, org_name, org_type, region_code)")
    .eq("status", "approved")
    .order("approved_at", { ascending: true });

  if (error || !data) return [];

  return data
    .map((row) => row.organizations as unknown as Organization | null)
    .filter((org): org is Organization => org != null);
}

// A user is expected to hold exactly one approved membership. If more than
// one exists, the earliest-approved one is treated as primary — this app
// does not yet support rendering more than one profile at a time, and
// building that out isn't needed by anything requesting this helper today.
export async function getCurrentOrg(): Promise<Organization | null> {
  const [org] = await getApprovedOrgs();
  return org ?? null;
}
