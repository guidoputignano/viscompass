/** Reviewer-only vocabulary of Pillar C: the province keys of the reviewer packet and their reviewed pseudonyms.
 *
 * Only the reviewer path may import this module: the reviewer workspace, its workbook insights and the server's
 * reviewer audience (audience-rules.ts). The page /dashboard-review/pillar-c also serves organisation-scoped
 * audiences, and every module their client bundle reaches must carry no province key (review finding UI-4):
 * scoped audiences receive their labels from the server (audience-rules.ts toClientAudience). The reviewer
 * workspace is loaded in its own chunk (components/dashboard-review/pillar-c/reviewer-workspace.tsx), and
 * tests/pillar-c-scoped-client-graph.test.mjs checks that no module of the route's entry imports this one. */
import type { COrg } from "@/lib/dashboard-review/pillar-c/review";

export const C_ORG_LABELS: Record<COrg, string> = { Regione: "Aggregato delle quattro Aziende", AQ: "ASL 1", CH: "ASL 2", PE: "ASL 3", TE: "ASL 4" };
