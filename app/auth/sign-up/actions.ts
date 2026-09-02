"use server";

import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient, hasServiceRoleConfig } from "@/lib/supabase/service-role";
import { sendRegistrationReceivedEmail } from "@/lib/email/vis-email";

const CONSENT_VERSION = "2026-09-02.v1";

export interface RegistrationResult {
  ok: boolean;
  message: string;
}

function siteOrigin(): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  if (configured?.startsWith("https://") || configured?.startsWith("http://")) return configured;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

function validEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function registerUser(input: {
  fullName: string;
  email: string;
  password: string;
  visNewsletter: boolean;
  partnerNewsletter: boolean;
}): Promise<RegistrationResult> {
  const fullName = input.fullName.trim().replace(/\s+/g, " ").slice(0, 160);
  const email = input.email.trim().toLowerCase().slice(0, 320);
  const recordedAt = new Date().toISOString();

  if (!fullName || !validEmail(email) || input.password.length < 6 || input.password.length > 128) {
    return { ok: false, message: "Controlla nome, email e password." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password: input.password,
    options: {
      emailRedirectTo: `${siteOrigin()}/auth/callback?next=/access`,
      data: {
        full_name: fullName,
        vis_newsletter_opt_in: Boolean(input.visNewsletter),
        partner_newsletter_opt_in: Boolean(input.partnerNewsletter),
        consent_version: CONSENT_VERSION,
        consent_recorded_at: recordedAt,
      },
    },
  });

  if (error || !data.user) {
    return { ok: false, message: error?.message ?? "Non è stato possibile creare l’account." };
  }

  if (hasServiceRoleConfig()) {
    try {
      const admin = createServiceRoleClient();
      const { error: consentError } = await admin.from("communication_consents").upsert({
        user_id: data.user.id,
        email,
        vis_newsletter_opt_in: Boolean(input.visNewsletter),
        vis_newsletter_consented_at: input.visNewsletter ? recordedAt : null,
        partner_newsletter_opt_in: Boolean(input.partnerNewsletter),
        partner_newsletter_consented_at: input.partnerNewsletter ? recordedAt : null,
        consent_version: CONSENT_VERSION,
        updated_at: recordedAt,
      });
      if (consentError) console.error("communication consent audit failed", consentError.message);
    } catch (consentError) {
      console.error("communication consent audit failed", consentError);
    }
  }

  try {
    const delivery = await sendRegistrationReceivedEmail(email, fullName);
    if (!delivery.sent && delivery.reason !== "VIS email is not configured") {
      console.error("registration email failed", delivery.reason);
    }
  } catch (deliveryError) {
    console.error("registration email failed", deliveryError);
  }

  return { ok: true, message: "Account creato. Controlla la tua email per confermare." };
}
