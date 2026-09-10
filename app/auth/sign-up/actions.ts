"use server";

import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient, hasServiceRoleConfig } from "@/lib/supabase/service-role";

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
      // Matches the route the Supabase confirmation template links to.
      // /auth/confirm accepts both dialects — token_hash + type via verifyOtp,
      // and ?code= via exchangeCodeForSession — so this value and the template
      // are no longer a pair that has to be changed together: editing one
      // cannot break the other.
      emailRedirectTo: `${siteOrigin()}/auth/confirm?next=/access`,
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

  // No confirmation email is sent from here. Supabase already sends one
  // carrying the actual confirmation link; a second message arriving at the
  // same time, telling the user to confirm but linking to /auth/login, sent
  // them to a page that cannot work until they have used the Supabase link.
  // sendRegistrationReceivedEmail stays defined in lib/email/vis-email.ts for
  // a future genuine use.
  return { ok: true, message: "Account creato. Controlla la tua email per confermare." };
}
