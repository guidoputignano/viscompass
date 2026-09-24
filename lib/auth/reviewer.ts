import { createClient } from "@/lib/supabase/server";
import { isReviewerEmail } from "@/lib/auth/reviewer-list";

export { isReviewerEmail, reviewerEmails, hasConfiguredReviewers } from "@/lib/auth/reviewer-list";

/**
 * Resolves the live session's email and checks it against the reviewer
 * allow-list server-side.
 *
 * Mirrors lib/auth/admin.ts deliberately: the email is re-derived from the
 * session on every call and never taken from client input, a cookie the client
 * can set, or a prop. Returns the email (so callers can record who looked) or
 * null, which includes "not signed in at all".
 *
 * Never cache the result across requests. It is a per-request authorization
 * decision, not configuration.
 */
export async function getReviewerEmail(): Promise<string | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims?.email) return null;
  const email = data.claims.email as string;
  return isReviewerEmail(email) ? email : null;
}
