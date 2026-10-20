"use client";

import dynamic from "next/dynamic";

/**
 * The reviewer workspace, loaded in its own chunk (review finding UI-4).
 *
 * /dashboard-review/pillar-c also serves organisation-scoped audiences. A client component the page imports directly
 * is part of the route's entry chunk, which every audience of the route downloads, and the reviewer workspace reaches
 * the reviewer-only vocabulary (province keys and their pseudonyms: reviewer-labels.ts, insights.ts). Imported
 * dynamically, it is fetched only where it renders, which is the reviewer branch of the page alone. It still renders
 * on the server, so the reviewer's markup is unchanged. tests/pillar-c-scoped-client-graph.test.mjs checks that no
 * module of the route's entry reaches the reviewer workspace other than through this dynamic import.
 */
export const PillarCAnalyticalWorkspace = dynamic(() => import("@/components/dashboard-review/pillar-c/analytical-workspace").then((m) => m.PillarCAnalyticalWorkspace));
