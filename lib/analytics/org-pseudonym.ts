// Display names for organizations inside the Pillar A private visuals.
//
// The rule (CLAUDE.md, Anonymization): the four Abruzzo ASLs are labelled
// ASL 1-4, with no Region named. The rule exists so that a comparison view
// never discloses which Azienda a line belongs to.
//
// A viewer always sees their OWN organization by its real name — they already
// know who they are, and `nav.tsx`, the access portal and the admin centre show
// it to them anyway. Every OTHER organization is pseudonymous. That satisfies
// the disclosure rule exactly while leaving the chart readable: you can find
// yourself, and you cannot identify anyone else.
//
// Resolve this SERVER-SIDE and send only the resulting strings. If the real
// names of other organizations never enter the client payload, there is nothing
// to recover from the page source — pseudonymising in the browser would ship
// the very names it is meant to withhold.
//
// The 201-204 mapping is the reviewed one. A code outside it falls back to the
// code itself rather than to an invented label: a new cohort needs a reviewed
// mapping, and an unmapped organization should be visibly unmapped rather than
// silently assigned someone else's pseudonym. Failing loudly beats a chart that
// looks complete and labels the wrong Azienda.
const REVIEWED_PSEUDONYMS: Readonly<Record<string, string>> = {
  "201": "ASL 1",
  "202": "ASL 2",
  "203": "ASL 3",
  "204": "ASL 4",
};

/**
 * @param orgCode    the organization being labelled
 * @param viewerCode the org_code of the signed-in viewer's own organization
 * @param realName   that organization's real name, used only when it is the viewer's
 */
export function orgDisplayName(
  orgCode: string,
  viewerCode: string | null | undefined,
  realName?: string | null,
): string {
  if (viewerCode && orgCode === viewerCode) return realName?.trim() || orgCode;
  return REVIEWED_PSEUDONYMS[orgCode] ?? orgCode;
}

/** Build the full label map a client component receives. */
export function orgDisplayMap(
  orgs: ReadonlyArray<{ org_code: string; org_name?: string | null }>,
  viewerCode: string | null | undefined,
): Record<string, string> {
  return Object.fromEntries(
    orgs.map((o) => [o.org_code, orgDisplayName(o.org_code, viewerCode, o.org_name)]),
  );
}

/** Exposed for tests: the reviewed mapping is a decision, not an implementation detail. */
export const REVIEWED_PSEUDONYM_CODES = Object.keys(REVIEWED_PSEUDONYMS);
