// The routes served without a session. Import-free, so the list itself is
// tested (tests/pillar-b-public-surface.test.mjs pins it exactly).
//
// The approved public observatories and the read routes that serve their
// aggregates: /pillar-a with its three data routes, and /pillar-b, which
// renders one independently published AIFA table and has no data route (the
// page is the whole payload). Matching is EXACT: a nested path under a public
// page is not public. There is no bulk-export route and nothing derived from
// the confidential Pillar B workbook is reachable without a session.
export const PUBLIC_PATHS: ReadonlyArray<string> = [
  "/pillar-a",
  "/api/pillar-a/series",
  "/api/pillar-a/osmed",
  "/api/pillar-a/atc4",
  "/pillar-b",
];

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.includes(pathname);
}
