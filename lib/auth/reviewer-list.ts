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
// Extended on 2 October 2026 to three platform reviewers, on the technical
// lead's handover instruction ("the three already-approved platform
// reviewers"). The addresses stay in the environment, never here.
//
// THE LIST LIVES IN THE ENVIRONMENT, NOT IN THIS FILE, and must stay there:
// this repository is public, so a compiled-in address would publish the
// personal email of everyone granted the exception. Set REVIEWER_EMAILS in the
// deployment environment (Vercel) and locally in .env.local. Onboarding or
// removing a reviewer is an environment change, with no deploy and no commit.
// The reviewer also needs an approved organization membership: the dashboard
// layout shows the access portal to any account without one, reviewer or not,
// and the portal says so to a recognised reviewer.
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
  return new Set(parseReviewerList(process.env.REVIEWER_EMAILS).valid);
}

// A deliberately plain shape check: one "@", a dot in the domain, nothing that
// belongs to a display name or a quoted form. It decides only whether a token
// is admitted to the list; matching stays exact.
const EMAIL = /^[^\s@<>"',;]+@[^\s@<>"',;]+\.[^\s@<>"',;]+$/;

/**
 * Parse the raw variable into valid addresses and a count of tokens that are
 * not addresses. Tolerates what a value pasted into a hosting dashboard tends
 * to carry: surrounding quotes, "Name <addr>" forms, zero-width characters,
 * and ";" or newlines as separators. A malformed token is never admitted,
 * so this can only withhold the exception, never widen it.
 */
export function parseReviewerList(raw: string | undefined): { valid: string[]; malformed: number } {
  const cleaned = (raw ?? "").replace(/[\u200B-\u200D\uFEFF]/g, "");
  const valid: string[] = [];
  let malformed = 0;
  for (const piece of cleaned.split(/[,;\n]+/)) {
    let token = piece.trim().replace(/^["']+|["']+$/g, "").trim();
    if (!token) continue;
    const angle = token.match(/<([^<>]+)>/);
    if (angle) token = angle[1].trim();
    token = token.toLowerCase();
    if (EMAIL.test(token)) valid.push(token); else malformed += 1;
  }
  return { valid: [...new Set(valid)], malformed };
}

/** Counts only, for an operator: how many reviewers are configured and how many tokens were refused. */
export function reviewerConfigReport(): { valid: number; malformed: number } {
  const { valid, malformed } = parseReviewerList(process.env.REVIEWER_EMAILS);
  return { valid: valid.length, malformed };
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
