import type { Organization } from "@/lib/dashboard-review/types";

export type MembershipStatus = "pending" | "approved" | "rejected" | "revoked";
export type InvitationStatus = "pending" | "accepted" | "declined" | "revoked" | "expired";
export type InvitationDeliveryStatus = "pending" | "email_sent" | "in_app" | "failed";

export interface AccessMembership {
  id: number;
  user_id: string;
  org_code: string;
  status: MembershipStatus;
  requested_at: string;
  approved_at: string | null;
  approved_by: string | null;
  requested_role: string | null;
  request_message: string | null;
  decision_note: string | null;
  decided_at: string | null;
  revoked_at: string | null;
  organizations: Organization | null;
}

export interface OrganizationInvitation {
  id: string;
  email: string;
  org_code: string;
  invited_role: string | null;
  invitation_note: string | null;
  status: InvitationStatus;
  delivery_status: InvitationDeliveryStatus;
  invited_by: string;
  created_at: string;
  expires_at: string;
  responded_at: string | null;
  organizations: Organization | null;
}

export interface AccessOverview {
  userId: string;
  email: string;
  organizations: Organization[];
  memberships: AccessMembership[];
  invitations: OrganizationInvitation[];
  setupRequired: boolean;
}

export interface AdminMembership extends AccessMembership {
  user_email: string;
  user_name: string | null;
}

export interface AdminInvitation extends OrganizationInvitation {
  delivery_error: string | null;
  inviter_email: string | null;
}

export interface AdminControlCenterData {
  organizations: Organization[];
  pendingMemberships: AdminMembership[];
  activeMemberships: AdminMembership[];
  recentDecisions: AdminMembership[];
  invitations: AdminInvitation[];
}
