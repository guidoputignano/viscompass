import { createClient } from "@/lib/supabase/server";
import type { Organization } from "@/lib/dashboard-review/types";
import type {
  AccessMembership,
  AccessOverview,
  OrganizationInvitation,
} from "@/lib/access/types";

const ORGANIZATION_FIELDS = "org_code, org_name, org_type, region_code";

function accessSchemaIsMissing(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  const message = error.message?.toLowerCase() ?? "";
  return (
    error.code === "PGRST204" ||
    error.code === "PGRST205" ||
    message.includes("schema cache") ||
    message.includes("does not exist")
  );
}

export async function getAccessOverview(): Promise<AccessOverview | null> {
  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.getClaims();
  const claims = authData?.claims;

  if (authError || !claims?.sub || !claims.email) return null;

  const [organizationsResult, membershipsResult, invitationsResult] = await Promise.all([
    supabase
      .from("organizations")
      .select(ORGANIZATION_FIELDS)
      .order("org_type", { ascending: false })
      .order("org_name", { ascending: true }),
    supabase
      .from("user_organizations")
      .select(
        "id, user_id, org_code, status, requested_at, approved_at, approved_by, requested_role, request_message, decision_note, decided_at, revoked_at, organizations(org_code, org_name, org_type, region_code)",
      )
      .order("requested_at", { ascending: false }),
    supabase
      .from("organization_invitations")
      .select(
        "id, email, org_code, invited_role, invitation_note, status, delivery_status, invited_by, created_at, expires_at, responded_at, organizations(org_code, org_name, org_type, region_code)",
      )
      .order("created_at", { ascending: false }),
  ]);

  if (organizationsResult.error) {
    throw new Error(`organizations query failed: ${organizationsResult.error.message}`);
  }

  let memberships = membershipsResult.data;
  let membershipSetupRequired = false;

  if (accessSchemaIsMissing(membershipsResult.error)) {
    membershipSetupRequired = true;
    const fallback = await supabase
      .from("user_organizations")
      .select(
        "id, user_id, org_code, status, requested_at, approved_at, approved_by, organizations(org_code, org_name, org_type, region_code)",
      )
      .order("requested_at", { ascending: false });
    if (fallback.error) {
      throw new Error(`memberships fallback query failed: ${fallback.error.message}`);
    }
    memberships = (fallback.data ?? []).map((row) => ({
      ...row,
      requested_role: null,
      request_message: null,
      decision_note: null,
      decided_at: null,
      revoked_at: null,
    }));
  }

  const setupRequired = membershipSetupRequired || accessSchemaIsMissing(invitationsResult.error);

  if (membershipsResult.error && !accessSchemaIsMissing(membershipsResult.error)) {
    throw new Error(`memberships query failed: ${membershipsResult.error.message}`);
  }
  if (invitationsResult.error && !accessSchemaIsMissing(invitationsResult.error)) {
    throw new Error(`invitations query failed: ${invitationsResult.error.message}`);
  }

  return {
    userId: claims.sub,
    email: String(claims.email),
    organizations: (organizationsResult.data ?? []) as Organization[],
    memberships: (memberships ?? []) as unknown as AccessMembership[],
    invitations: (invitationsResult.data ?? []) as unknown as OrganizationInvitation[],
    setupRequired,
  };
}
