// Release membership is not the same as the set of Aziende with rows in the
// two complete comparison years. The partial year may contain a new Azienda;
// the reviewer directory must include it even though annual comparisons do not.

import type { FacetAsl } from "./facets";

export function releaseAslCodes(rows: ReadonlyArray<Pick<FacetAsl, "asl_code">>): string[] {
  return [...new Set(rows.map((row) => row.asl_code).filter(Boolean))].sort();
}
