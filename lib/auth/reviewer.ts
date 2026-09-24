import { getViewerIdentity } from "@/lib/auth/viewer";

export { isReviewerEmail, reviewerEmails, hasConfiguredReviewers } from "@/lib/auth/reviewer-list";

/**
 * The live session's email if the caller is an allow-listed reviewer, else null.
 *
 * Mirrors lib/auth/admin.ts deliberately: the email is re-derived from the
 * session on every call and never taken from client input, a cookie the client
 * can set, or a prop. Returns the email (so callers can record who looked).
 *
 * Never cache the result across requests. It is a per-request authorization
 * decision, not configuration.
 */
export async function getReviewerEmail(): Promise<string | null> {
  const viewer = await getViewerIdentity();
  return viewer?.isReviewer ? viewer.email : null;
}
