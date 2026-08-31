"use server";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { getAdminEmail } from "@/lib/auth/admin";
import { findAuthUserByEmail } from "@/lib/access/admin";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export interface ControlCenterActionResult {
  ok: boolean;
  message: string;
}

function clean(value: string, maxLength: number): string {
  return value.trim().replace(/\s+/g, " ").slice(0, maxLength);
}

function validEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function applicationOrigin(): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  if (configured?.startsWith("https://") || configured?.startsWith("http://")) return configured;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

async function requireAdmin() {
  const email = await getAdminEmail();
  if (!email) throw new Error("Non autorizzato.");

  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (error || !userId) throw new Error("Sessione amministratore non valida.");

  return { email, userId, admin: createServiceRoleClient() };
}

async function deliverInvitation(invitation: {
  id: string;
  email: string;
  orgCode: string;
  orgName: string;
  invitedRole: string | null;
}): Promise<ControlCenterActionResult> {
  const admin = createServiceRoleClient();
  const existingUser = await findAuthUserByEmail(invitation.email);
  const redirectTo = `${applicationOrigin()}/auth/callback?next=/access`;
  let deliveryError: string | null = null;
  let deliveryStatus: "email_sent" | "failed" = "email_sent";

  if (existingUser) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    if (!url || !publishableKey) {
      deliveryError = "Supabase public credentials are not configured.";
    } else {
      const notifications = createSupabaseClient(url, publishableKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
      const { error } = await notifications.auth.signInWithOtp({
        email: invitation.email,
        options: { shouldCreateUser: false, emailRedirectTo: redirectTo },
      });
      deliveryError = error?.message ?? null;
    }
  } else {
    const { error } = await admin.auth.admin.inviteUserByEmail(invitation.email, {
      redirectTo,
      data: {
        invited_org_code: invitation.orgCode,
        invited_org_name: invitation.orgName,
        invited_role: invitation.invitedRole,
      },
    });
    deliveryError = error?.message ?? null;
  }

  if (deliveryError) deliveryStatus = "failed";
  const { error: updateError } = await admin
    .from("organization_invitations")
    .update({
      delivery_status: deliveryStatus,
      delivery_error: deliveryError?.slice(0, 600) ?? null,
    })
    .eq("id", invitation.id)
    .eq("status", "pending");

  if (updateError) throw new Error(`invitation delivery audit failed: ${updateError.message}`);

  return deliveryError
    ? {
        ok: false,
        message: `Invito registrato, ma l'email non è stata consegnata: ${deliveryError}`,
      }
    : {
        ok: true,
        message: existingUser
          ? "Invito inviato. L'utente lo vedrà anche nella propria casella inviti."
          : "Invito inviato. Il destinatario può creare l'account dal collegamento ricevuto.",
      };
}

export async function decideMembership(input: {
  membershipId: number;
  outcome: "approved" | "rejected";
  note: string;
}): Promise<ControlCenterActionResult> {
  try {
    const { userId, admin } = await requireAdmin();
    const note = input.note.trim().slice(0, 800);
    if (!Number.isSafeInteger(input.membershipId) || input.membershipId <= 0) {
      return { ok: false, message: "Richiesta non valida." };
    }

    const { error } = await admin.rpc("admin_decide_organization_membership", {
      p_membership_id: input.membershipId,
      p_outcome: input.outcome,
      p_admin_id: userId,
      p_decision_note: note || null,
    });
    if (error) throw error;

    revalidatePath("/admin/control-center");
    revalidatePath("/dashboard-review", "layout");
    return {
      ok: true,
      message: input.outcome === "approved" ? "Accesso approvato." : "Candidatura rifiutata.",
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Aggiornamento non riuscito.",
    };
  }
}

export async function revokeMembership(input: {
  membershipId: number;
  note: string;
}): Promise<ControlCenterActionResult> {
  try {
    const { userId, admin } = await requireAdmin();
    const { error } = await admin.rpc("admin_revoke_organization_membership", {
      p_membership_id: input.membershipId,
      p_admin_id: userId,
      p_decision_note: input.note.trim().slice(0, 800) || null,
    });
    if (error) throw error;

    revalidatePath("/admin/control-center");
    revalidatePath("/dashboard-review", "layout");
    return { ok: true, message: "Accesso revocato." };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Revoca non riuscita.",
    };
  }
}

export async function createOrganizationInvitation(input: {
  email: string;
  orgCode: string;
  invitedRole: string;
  note: string;
  expiresInDays: number;
}): Promise<ControlCenterActionResult> {
  try {
    const { userId, admin } = await requireAdmin();
    const email = clean(input.email, 320).toLowerCase();
    const orgCode = clean(input.orgCode, 80);
    const role = clean(input.invitedRole, 120);
    const note = input.note.trim().slice(0, 1200);
    const days = Math.min(30, Math.max(1, Math.floor(input.expiresInDays || 7)));

    if (!validEmail(email) || !orgCode) {
      return { ok: false, message: "Inserisci un indirizzo email e un'organizzazione validi." };
    }

    const { error: expiryError } = await admin
      .from("organization_invitations")
      .update({ status: "expired", responded_at: new Date().toISOString() })
      .eq("email", email)
      .eq("org_code", orgCode)
      .eq("status", "pending")
      .lt("expires_at", new Date().toISOString());
    if (expiryError) throw expiryError;

    const { data: organization, error: organizationError } = await admin
      .from("organizations")
      .select("org_code, org_name")
      .eq("org_code", orgCode)
      .single();
    if (organizationError || !organization) {
      return { ok: false, message: "Organizzazione non trovata." };
    }

    const expiresAt = new Date(Date.now() + days * 86_400_000).toISOString();
    const { data: invitation, error } = await admin
      .from("organization_invitations")
      .insert({
        email,
        org_code: orgCode,
        invited_role: role || null,
        invitation_note: note || null,
        invited_by: userId,
        expires_at: expiresAt,
      })
      .select("id, email, org_code, invited_role")
      .single();

    if (error) {
      if (error.code === "23505") {
        return { ok: false, message: "Esiste già un invito attivo per questa email e organizzazione." };
      }
      throw error;
    }

    const result = await deliverInvitation({
      id: invitation.id,
      email: invitation.email,
      orgCode: invitation.org_code,
      orgName: organization.org_name,
      invitedRole: invitation.invited_role,
    });
    revalidatePath("/admin/control-center");
    return result;
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Invio non riuscito.",
    };
  }
}

export async function resendOrganizationInvitation(
  invitationId: string,
): Promise<ControlCenterActionResult> {
  try {
    const { admin } = await requireAdmin();
    const { data, error } = await admin
      .from("organization_invitations")
      .select("id, email, org_code, invited_role, organizations(org_name)")
      .eq("id", invitationId)
      .eq("status", "pending")
      .single();
    if (error || !data) return { ok: false, message: "Invito attivo non trovato." };

    const organization = data.organizations as unknown as { org_name: string } | null;
    const result = await deliverInvitation({
      id: data.id,
      email: data.email,
      orgCode: data.org_code,
      orgName: organization?.org_name ?? data.org_code,
      invitedRole: data.invited_role,
    });
    revalidatePath("/admin/control-center");
    return result;
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Nuovo invio non riuscito.",
    };
  }
}

export async function revokeOrganizationInvitation(
  invitationId: string,
): Promise<ControlCenterActionResult> {
  try {
    const { admin } = await requireAdmin();
    const { error } = await admin
      .from("organization_invitations")
      .update({ status: "revoked", responded_at: new Date().toISOString() })
      .eq("id", invitationId)
      .eq("status", "pending");
    if (error) throw error;
    revalidatePath("/admin/control-center");
    return { ok: true, message: "Invito revocato." };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Revoca non riuscita.",
    };
  }
}
