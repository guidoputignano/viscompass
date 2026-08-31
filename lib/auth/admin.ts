import { createClient } from "@/lib/supabase/server";

function parseAdminEmails(): Set<string> {
  return new Set(
    (process.env.ADMIN_EMAILS ?? "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  );
}

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return parseAdminEmails().has(email.toLowerCase());
}

// Resolves the live session's email and checks it against ADMIN_EMAILS
// server-side. Never trust a client-supplied email or role for this —
// always re-derive from the session. Returns the email (so callers have
// it for responded_by-style bookkeeping) or null if the caller isn't an
// admin, including "not logged in at all".
export async function getAdminEmail(): Promise<string | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims?.email) return null;
  const email = data.claims.email as string;
  return isAdminEmail(email) ? email : null;
}
