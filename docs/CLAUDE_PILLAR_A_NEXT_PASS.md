# Pillar A: next-pass instructions and verified checkpoint

## Superseding local implementation checkpoint

Codex subsequently implemented the button styling, a private bivariate deviations plot with a values table, per-ASL three-component annual comparison panels on a shared euro scale, six-decimal composition values, explicit scope labels for the unfiltered summary tables, and a range-based waterfall that supports negative intermediate totals. These are local uncommitted changes; inspect the diff before continuing. The new chart labels preserve average-cost rather than pure-price semantics.

Public series delivery now requires region/family/channel and releases only the selected territory's history/composition, current-year ranking and relevant national/territorial monthly rows. Added server-only enforcement. Regression tests cover every selector combination and negative waterfall totals. Current results: 46 tests, 44 passed, 2 pre-existing skips; TypeScript passed; webpack build passed. Production-server HTTP checks on localhost:3124 returned 400 for an unscoped series request, 200 for valid scopes (100,223 bytes for region 130 antibiotics/direct, 46,559 bytes for national antifungals/convenzionata), and 200 for the homepage. This is still public data, not protection against iterative collection.

Not yet performed: visual browser QA of the new components, workbook regeneration, product-level private storage/views, VEN workflow, upload reconciliation, real session/RLS tests, migrations, commits, push or deployment. The previous task list below remains applicable except for the specific local implementations listed here. Do not report all tasks complete. Preview server was started on port 3124 for local HTTP checks.

## Request

Finish the outstanding Pillar A feedback implementation in the order below, and polish the homepage Pillar A navigation button. Do not repeat finished work or claim that local implementation equals deployed, authorized functionality.

Work in `C:/Users/HP/Documents/ChatGPT/Vis Gamma/viscompass-pillar-a-release`, branch `release/pillar-a-public-20260920`. Read `AGENTS.md`, `docs/CLAUDE_PILLAR_A_CLOSEOUT_HANDOVER.md`, `docs/VEN_MAPPING_PROPOSAL.md`, and the original `C:/Users/HP/Downloads/Feedback v1.docx`, including embedded screenshots. Preserve other agents' changes. Do not reset the dirty sibling `../viscompass` or merge the separate `../vis` application.

## Independently checked checkpoint, 24 September 2026

HEAD was `a27a586`; worktree clean before this handover was added. The four new commits are cc404a2 (server data routes), c5c84af (ABC crossing rule), 4c605f9 (territorial ranking framing/tests), and a27a586 (VEN proposal). Re-ran `node --test tests/*.test.mjs`: 42 tests, 40 pass, 2 skipped, no failures. Re-ran `node node_modules/typescript/bin/tsc --noEmit`: passed. Production build/runtime verification is reported by the preceding Claude pass, not re-run in this audit. No live database or deployment verification was performed in this audit.

Confirmed in source: compiled assets moved out of public; export requires approved organization membership; missing auth configuration fails closed; ATC4 delivery is sliced; load-time sanitization exists; shared ABC uses preceding cumulative share; PNCAR is labelled territorial. These are real improvements, NOT complete closeout.

## 1. Small, separately committed button improvement

The current homepage button is in `app/page.tsx`, around line 281: a ghost Button containing a Link to `/pillar-a`. Make this a polished compact teal/navy pill matching existing design tokens: subtle gradient or tinted background, fine border, restrained shadow, a small existing lucide chart icon and optional arrow. Preserve the text “Pillar A”, destination, Link semantics, keyboard focus and adequate contrast in both themes. Decorative icons must be aria-hidden. Use motion-reduce-safe hover/focus transitions; no continuous shimmer, new dependency, fabricated badge or broad homepage redesign. Test a 360px viewport with the logo, theme control and registration button; do not introduce header overflow. This specific styling change is user-authorized despite the general decorative-work freeze.

## 2. Workbook and guide: highest-value substantive gap

Local artifact remains `private-staging/closure/deliverables/VIS_Pillar_A_Verified_20260923.xlsx`; builder `private-staging/closure/authoring/build.mjs`. Source derivatives are `private-staging/closure/{indicators,product-analysis,composition-links,audit}.json`; original inputs and hashes are in `data/raw/pillar-a-drive-20260922/` and `private-staging/closure/source-manifest.json`. Read the spreadsheet skill before working on the workbook.

Rebuild from current validated inputs, preserving formulas and ASL 1–4 pseudonyms with no private Region identity in externally shared artifacts. Complete the terminology requested by Feedback, including DDD/1,000 residents/day and its exact population, period and calendar-day bases. Do not calculate unavailable rates merely because a definition is requested.

Add the descriptive AWaRe composition Sankey, the requested bivariate deviations trajectory, three-component reference-to-actual waterfall and cross-ASL comparison side by side, regional temporal analysis, and ASL drilldown/small multiples. Inspect the screenshot evidence: image6 is deviations, image11 is the paired decomposition plots, image8 is ASL small multiples. They are not SDO charts.

Use and independently reconcile the mathematics in `lib/analytics/private-pillar-comparison.ts`. The existing two-factor year-on-year bridge may remain separately labelled, but cannot substitute for the requested three-term benchmark. At AWaRe aggregate grain the price term is a within-category average-cost effect, not isolated product price. For product-price claims use the matching product data and document entry/exit/zero-volume handling. Do not label hypothetical benchmark gaps as achievable savings. Regenerate the manual guide and visually inspect every sheet/chart. Record input hashes, independent controls, output timestamp and formula checks; timestamp ordering alone does not prove a stale result.

## 3. Finish existing private charts and product views locally

`components/private-pillar-charts.tsx` has the basic composition, history and three-term charts, but the intensity-deviation line is not the requested bivariate plot. Add exact accessible Sankey values, the bivariate trajectory and missing small multiples; synchronize selectors with the existing tables or explicitly label separate scopes. Verify negative waterfall intermediate values, empty states, mobile and dark mode.

The migration `supabase/migrations/20260923_private_pillar_a.sql` stores org/year/AWaRe aggregates only. It has no product/AIC/ATC5 grain. Prepare versioned product storage and RLS-scoped views for private ABC and ATC5 trends using the 1,316 local product records, not public JSON. Reconcile product sums to aggregate figures; preserve 9-digit AIC strings. Use the shared ABC threshold/crossing convention, including deterministic ties and an explicit adjustment/nonpositive-value policy. No all-peer facts may reach an ASL user's browser.

Build and test this locally without treating the private activation gate as a reason to defer all implementation. Activation itself remains gated below.

## 4. Finish data-delivery hardening

`app/api/pillar-a/series/route.ts` still returns all of `getPublicSeries()` without authentication. Moving the file out of public did not remove bulk access to that aggregate. Split delivery into validated, minimal panel/territory/year/family responses and update consumers. Do not imply query slicing prevents reassembly: any deliberately public displayed values can be collected. If full compilation confidentiality is required, enforce authorization rather than merely changing URLs or payload size.

Add `import "server-only"` to the server data boundary where supported, check the client bundle for accidental compiled imports, and test canonical regeneration cannot recreate public raw assets or withdrawn J04A rows. Keep useful public source citations while excluding internal paths/digests. Test logged-out, pending and approved export behavior through the complete middleware-plus-route path; do not promise all unauthenticated requests return 403 if middleware redirects first. Real organization-isolation assertions require actual Postgres sessions, not source inspection.

## 5. VEN mechanism and provider objectives

`docs/VEN_MAPPING_PROPOSAL.md` is a proposal, explicitly not an implemented mechanism. Build versioned mapping validation, approval metadata, validity period, conflict/duplicate handling, coverage reporting and explicit unmapped states. No real VEN class or clinical conclusion without an approved mapping. Software can be finished before the clinical mapping arrives; truthful empty states are acceptable. ABC and AWaRe do not supply VEN.

Keep PNCAR territorial rankings separate from local objectives. Test comparable provider/year/denominator cohorts and `my_objective_rank()` on real rollback fixtures when authorized. Never invent department identities or hospital rankings from regional data. Resolve or suppress the unsupported unità-operativa presentation rather than widening a known aggregation contradiction.

## 6. Upload-to-analysis workflow

`lib/uploads/reconcile.ts` is still a no-op (`void uploadId`), so end-to-end automation is unfinished. Review the dirty sibling's validation/staging work selectively. Implement row-level staging, supported canonical mappings, provenance, unresolved-row quarantine, reconciliation and explainable report generation. Make ingestion idempotent and test permissions, invalid headers/units, duplicates, negative adjustments, partial months and missing data. Never report an empty-table comparison as a successful reconciliation.

Separate the 2025-only DIR gold-file scope from the separate 2023–2025 antibiotic source package. A missing genuine 2024 DIR file does not erase the available antibiotic years. Unresolved ND/130106 records must be quarantined explicitly; they need not block supported records, but their amounts and effects on totals must be visible. Follow existing erogato comparison rules and do not invent answers to the Region's outstanding questions.

## 7. Activation, verification and honest closeout

Private data activation and new all-data administrator rights still require the recorded approval. Do not apply migrations/imports, alter memberships or deploy private features on assumed approval. Signup organization selection requests access; it never grants it automatically. Once authorized, inspect existing schema, apply guarded migrations/import, reconcile actual rows, and exercise logged-out, pending, own-ASL, other-ASL, regional and admin sessions, including adversarial reads/writes and cache isolation. Use rollback test fixtures. No credentials in chat or documentation.

Before handing back, run the complete test suite, real TypeScript checking and `node node_modules/next/dist/bin/next build --webpack` (node_modules is a junction; avoid Turbopack here). Render and inspect the workbook and browser views. Preserve skipped-test explanations. Keep private data out of Git and client bundles. Update the older handover's stale public/data location and test counts rather than leaving contradictory instructions.

Deliver an acceptance matrix against every Feedback item with separate columns for implemented, independently verified, awaiting input/authorization, and deployed. Include evidence paths, command results, local commit IDs, workbook/guide paths and precise remaining limitations. Do not mark the entire feedback closed while any requested deliverable or activation test remains open. Use small commits; do not push main or claim deployment without explicit scope and successful post-deployment checks.
