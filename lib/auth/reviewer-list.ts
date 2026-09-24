// Who counts as a platform reviewer.
//
// A reviewer sees EVERY Azienda in the private Pillar A release, by real name,
// regardless of which organization they are a member of. Everyone else stays
// scoped to their own Azienda and sees the others pseudonymously.
//
// THIS IS A DELIBERATE, AUTHORIZED EXCEPTION to the anonymization rule in
// CLAUDE.md / AGENTS.md ("in every external-facing artifact the four Abruzzo
// ASLs are labelled ASL 1-4, with no Region named"). It was requested by the
// technical lead on 24 September 2026 for named platform reviewers only. The
// rule is unchanged for every other account and is still enforced by
// lib/analytics/org-pseudonym.ts.
//
// THE LIST LIVES IN THE ENVIRONMENT, NOT IN THIS FILE, and must stay there:
// this repository is public, so a compiled-in address would publish the
// personal email of everyone granted the exception. Set REVIEWER_EMAILS in the
// deployment environment (Vercel) and locally in .env.local. Onboarding or
// removing a reviewer is an environment change, with no deploy and no commit.
//
// FAILS CLOSED. With REVIEWER_EMAILS unset there are no reviewers at all and
// every account is scoped to its own Azienda — the pre-existing behaviour. An
// absent or malformed variable can only withhold the exception, never widen it.
//
// Kept separate from ADMIN_EMAILS on purpose. ADMIN_EMAILS grants the access
// Control Center: approving applications and sending invitations. This grants
// cross-Azienda visibility of clinical consumption data. They are different
// capabilities and someone granted one must not silently acquire the other.
//
// This module is deliberately import-free so it can be tested directly by
// `node --test`; the session-reading half lives in lib/auth/reviewer.ts.

/**
 * The effective allow-list, normalised.
 *
 * Read from the environment on every call rather than captured at module load,
 * so a change takes effect without a restart and so tests can vary it.
 */
export function reviewerEmails(): Set<string> {
  return new Set(
    (process.env.REVIEWER_EMAILS ?? "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  );
}

/**
 * Fails closed: an absent, empty or non-string email is never a reviewer.
 *
 * The caller must pass an email derived from the live session. Never pass one
 * that came from a request body, a query string or a client component — this
 * function cannot tell the difference, and that is exactly how an allow-list
 * becomes a bypass.
 */
export function isReviewerEmail(email: string | null | undefined): boolean {
  if (typeof email !== "string") return false;
  const normalised = email.trim().toLowerCase();
  if (!normalised) return false;
  return reviewerEmails().has(normalised);
}

/** True when nobody is configured, so callers can explain an inert exception. */
export function hasConfiguredReviewers(): boolean {
  return reviewerEmails().size > 0;
}
