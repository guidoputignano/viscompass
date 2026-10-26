/** Reviewer-only vocabulary of Pillar C: the province keys of the reviewer packet and their reviewed pseudonyms.
 *
 * Only the reviewer path may import this module: the reviewer workspace, its workbook insights and the server's
 * reviewer audience (audience-rules.ts). The page /dashboard-review/pillar-c also serves organisation-scoped
 * audiences, and every module their client bundle reaches must carry no province key (review finding UI-4):
 * scoped audiences receive their labels from the server (audience-rules.ts toClientAudience). The reviewer
 * workspace is loaded in its own chunk (components/dashboard-review/pillar-c/reviewer-workspace.tsx), and
 * tests/pillar-c-scoped-client-graph.test.mjs checks that no module of the route's entry imports this one. */
import type { COrg } from "@/lib/dashboard-review/pillar-c/review";
import type { CScopedUnit } from "@/lib/dashboard-review/pillar-c/scoped-units";

export const C_ORG_LABELS: Record<COrg, string> = { Regione: "Aggregato delle quattro Aziende", AQ: "ASL 1", CH: "ASL 2", PE: "ASL 3", TE: "ASL 4" };
/** The reviewer's «Ambito» keys and the extension unit each one names, by the same pseudonyms (C_EXT_UNIT_LABELS). */
export const C_EXT_UNIT_OF_REVIEWER_ORG: Readonly<Record<COrg, CScopedUnit>> = { Regione: "aggregato", AQ: "asl-1", CH: "asl-2", PE: "asl-3", TE: "asl-4" };
