// The routes served without a session. Import-free, so the list itself is
// tested (tests/pillar-b-public-surface.test.mjs pins it exactly).
//
// The approved public observatories and the read routes that serve their
// aggregates: /pillar-a with its three data routes, and /pillar-b, which
// renders one independently published AIFA table and has no data route (the
// page is the whole payload). Matching is EXACT: a nested path under a public
// page is not public. /pillar-c embeds a separate public-source projection,
// including the regional forecast approved for public access on 28 Oct 2026.
// There is no bulk-export route and nothing derived from
// the confidential Pillar B workbook is reachable without a session.
// /api/csp-report receives the browser's Content-Security-Policy violation
// reports (XC-X3.2), which are sent without the session; it serves nothing.
// /api/findings/reminders is called by Vercel Cron, without a session, and
// refuses anything but the project's CRON_SECRET; it sends reminders and
// serves no data.
export const PUBLIC_PATHS: ReadonlyArray<string> = [
  "/pillar-a",
  "/api/pillar-a/series",
  "/api/pillar-a/osmed",
  "/api/pillar-a/atc4",
  "/pillar-b",
  "/pillar-c",
  "/api/csp-report",
  "/api/findings/reminders",
];

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.includes(pathname);
}
