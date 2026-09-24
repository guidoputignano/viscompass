// The private Pillar A scope decision, as a pure function.
//
// Split from private-scope.ts for the same reason reconcile.ts is split from
// process-upload.ts: the I/O shell cannot be loaded by `node --test`, and this
// is the part where being wrong discloses one Azienda's figures to another.
// Every branch here is covered by tests/private-scope-rules.test.mjs.
//
// Two independent questions, deliberately kept apart:
//   showRealNames    — may this viewer see other Aziende by name? Reviewer only.
//   allOrganizations — did the row scope actually widen past their RLS grant?
// A reviewer whose widening failed gets showRealNames WITHOUT allOrganizations,
// which is correct: they still see only their own Azienda, named.

export type ScopeOrg = { org_code: string; org_name?: string | null };

export type ScopeInput = {
  /** Already verified against the live session by lib/auth/reviewer.ts. */
  isReviewer: boolean;
  /**
   * Every organization in the release. Non-null only when the reviewer path ran
   * AND the listing succeeded; null means "could not widen", for any reason.
   */
  releaseOrgs: ScopeOrg[] | null;
  /** The viewer's own primary approved membership, if any. */
  org: { org_code: string; org_name?: string | null; org_type: string } | null;
  /** Peer ASLs, for a regione membership. Null when not applicable. */
  regionMembers: ScopeOrg[] | null;
};

export type ScopeDecision = {
  orgCodes: string[];
  orgs: ScopeOrg[];
  viewerCode: string | null;
  showRealNames: boolean;
  allOrganizations: boolean;
  regional: boolean;
  reviewerScopeUnavailable: boolean;
};

export function decidePrivateScope(input: ScopeInput): ScopeDecision | null {
  const { isReviewer, releaseOrgs, org, regionMembers } = input;
  const viewerCode = org?.org_code ?? null;

  // A reviewer with a usable release listing sees everything, by name. This is
  // the only branch that reports allOrganizations, and it requires releaseOrgs
  // to be genuinely non-empty: an empty list is a failed widening, not a cohort
  // of zero, and must never render as "you are seeing everything".
  if (isReviewer && releaseOrgs && releaseOrgs.length > 0) {
    return {
      orgCodes: releaseOrgs.map((o) => o.org_code),
      orgs: releaseOrgs,
      viewerCode,
      showRealNames: true,
      allOrganizations: true,
      regional: releaseOrgs.length > 1,
      reviewerScopeUnavailable: false,
    };
  }

  // Everyone else is scoped by their own membership. Without one there is
  // nothing to show — including for a reviewer we could not widen, who would
  // otherwise get an empty section with no explanation.
  if (!org) return null;

  if (org.org_type === "asl") {
    return {
      orgCodes: [org.org_code],
      orgs: [{ org_code: org.org_code, org_name: org.org_name }],
      viewerCode,
      showRealNames: isReviewer,
      allOrganizations: false,
      regional: false,
      reviewerScopeUnavailable: isReviewer,
    };
  }

  // A regione membership already reads every ASL in its own region under RLS.
  if (!regionMembers || regionMembers.length === 0) return null;
  return {
    orgCodes: regionMembers.map((o) => o.org_code),
    orgs: regionMembers,
    viewerCode,
    showRealNames: isReviewer,
    allOrganizations: false,
    regional: true,
    reviewerScopeUnavailable: isReviewer,
  };
}
