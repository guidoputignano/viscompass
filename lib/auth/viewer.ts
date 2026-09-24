import { createClient } from "@/lib/supabase/server";
import { isReviewerEmail } from "@/lib/auth/reviewer-list";

// Who is signed in, for display in the shell.
//
// Resolved from the live session on every request. Nothing here is taken from
// client input: the email decides the reviewer flag, so a client-supplied value
// would be an authorization bypass rather than a cosmetic one.

export type ViewerIdentity = {
  email: string;
  /** full_name from sign-up, or the email when the account has never set one. */
  name: string;
  /** True when `name` is really the address, so the UI can size it accordingly. */
  nameIsEmail: boolean;
  /** Allow-listed platform reviewer. See lib/auth/reviewer-list.ts. */
  isReviewer: boolean;
};

export async function getViewerIdentity(): Promise<ViewerIdentity | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims?.email) return null;
  const email = data.claims.email as string;

  // full_name comes from the JWT when the token carries it, and otherwise from
  // the user record. Supabase does not always project user_metadata into the
  // access token, and relying on claims alone silently degraded every account
  // to its email address. getUser() is a network call, so it runs only when the
  // cheap path found nothing.
  const fromClaims = (data.claims.user_metadata as Record<string, unknown> | undefined)?.full_name;
  let name = typeof fromClaims === "string" ? fromClaims.trim() : "";
  if (!name) {
    const { data: userData } = await supabase.auth.getUser();
    const fromUser = userData?.user?.user_metadata?.full_name;
    if (typeof fromUser === "string") name = fromUser.trim();
  }

  // Never derived from the address. A guessed human name is worse than the
  // address it was guessed from, and worse still next to a privileged role.
  return { email, name: name || email, nameIsEmail: !name, isReviewer: isReviewerEmail(email) };
}
