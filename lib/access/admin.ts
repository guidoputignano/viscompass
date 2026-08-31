import type { User } from "@supabase/supabase-js";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import type {
  AdminControlCenterData,
  AdminInvitation,
  AdminMembership,
  AccessMembership,
  OrganizationInvitation,
} from "@/lib/access/types";
import type { Organization } from "@/lib/dashboard-review/types";

async function listAuthUsers(): Promise<User[]> {
  const admin = createServiceRoleClient();
  const users: User[] = [];
  const perPage = 1000;

  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) throw new Error(`auth user listing failed: ${error.message}`);
    users.push(...data.users);
    if (data.users.length < perPage) break;
  }

  return users;
}

function userDisplayName(user: User | undefined): string | null {
  const value = user?.user_metadata?.full_name;
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export async function findAuthUserByEmail(email: string): Promise<User | null> {
  const normalized = email.trim().toLowerCase();
  const users = await listAuthUsers();
  return users.find((user) => user.email?.toLowerCase() === normalized) ?? null;
}

export async function getAdminControlCenterData(): Promise<AdminControlCenterData> {
  const admin = createServiceRoleClient();
  const [organizationsResult, membershipsResult, invitationsResult, users] = await Promise.all([
    admin
      .from("organizations")
      .select("org_code, org_name, org_type, region_code")
      .order("org_type", { ascending: false })
      .order("org_name", { ascending: true }),
    admin
      .from("user_organizations")
      .select(
        "id, user_id, org_code, status, requested_at, approved_at, approved_by, requested_role, request_message, decision_note, decided_at, revoked_at, organizations(org_code, org_name, org_type, region_code)",
      )
      .order("requested_at", { ascending: false }),
    admin
      .from("organization_invitations")
      .select(
        "id, email, org_code, invited_role, invitation_note, status, delivery_status, delivery_error, invited_by, created_at, expires_at, responded_at, organizations(org_code, org_name, org_type, region_code)",
      )
      .order("created_at", { ascending: false })
      .limit(250),
    listAuthUsers(),
  ]);

  if (organizationsResult.error) {
    throw new Error(`organizations admin query failed: ${organizationsResult.error.message}`);
  }
  if (membershipsResult.error) {
    throw new Error(`memberships admin query failed: ${membershipsResult.error.message}`);
  }
  if (invitationsResult.error) {
    throw new Error(`invitations admin query failed: ${invitationsResult.error.message}`);
  }

  const usersById = new Map(users.map((user) => [user.id, user]));
  const memberships = ((membershipsResult.data ?? []) as unknown as AccessMembership[]).map(
    (membership): AdminMembership => {
      const user = usersById.get(membership.user_id);
      return {
        ...membership,
        user_email: user?.email ?? "Utente senza email",
        user_name: userDisplayName(user),
      };
    },
  );

  const now = Date.now();
  const invitations = ((invitationsResult.data ?? []) as unknown as Array<
    OrganizationInvitation & { delivery_error: string | null }
  >).map((invitation): AdminInvitation => ({
    ...invitation,
    status:
      invitation.status === "pending" && new Date(invitation.expires_at).getTime() <= now
        ? "expired"
        : invitation.status,
    inviter_email: usersById.get(invitation.invited_by)?.email ?? null,
  }));

  return {
    organizations: (organizationsResult.data ?? []) as Organization[],
    pendingMemberships: memberships.filter((membership) => membership.status === "pending"),
    activeMemberships: memberships.filter((membership) => membership.status === "approved"),
    recentDecisions: memberships
      .filter((membership) => membership.status === "rejected" || membership.status === "revoked")
      .slice(0, 20),
    invitations,
  };
}
