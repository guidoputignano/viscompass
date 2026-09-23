# Pillar A closeout handover

Work in `C:/Users/HP/Documents/ChatGPT/Vis Gamma/viscompass-pillar-a-release`,
branch `release/pillar-a-public-20260920`, remote
`https://github.com/guidoputignano/viscompass.git`. Read AGENTS.md first.
Do not reset the dirty sibling `../viscompass` or merge the separate `../vis` app.
This is a local handover: no new Claude task or external message was sent.

## Division of work for this pass

Codex owns private analytical functions, private comparison/composition charts,
their server-route wiring, synthetic unit tests and local derivative regression.
Claude owns the remaining source/data access hardening, workbook deliverable,
clinical-mapping workflow, upload-to-analysis pipeline and final integration QA.
Do not edit Codex-owned files concurrently before its final checkpoint below.
The public changes through `5b8df71` are being consolidated with private commit
`aee234d`; inspect git log/status rather than cherry-picking them twice.

## Scope and permission gates

User authorized implementation of the outstanding Feedback v1 requests.
Private activation is NOT approved yet: the user said they would seek Guido's
approval for membership and data-admin roles. Preserve current memberships and
live access. No automatic private access from self-selected signup affiliation.
Do not apply migrations/imports, grant all-data admin access or deploy private
features until access is confirmed and isolation tests pass. No clinical VEN
classification, national-equivalent A3 denominator or blame/causality may be invented.

## Primary sources and local artifacts

- Feedback: `C:/Users/HP/Downloads/Feedback v1.docx`. May be open in Word; use
  read-sharing to read, do not overwrite. Paragraphs and embedded images matter.
- Extracted screenshots: `../.codex-temp/feedback-reconcile-20260923/`.
  image6 = deviations trajectory; image11 = reference-to-actual waterfall and
  four-ASL Price/Mix/Interaction comparison; image8 = per-ASL annual small multiples.
  These are NOT the public SDO or package-volume charts.
- New source package: `data/raw/pillar-a-drive-20260922/` (ignored). Contains
  Allegato 1 Dati_Anagrafiche.xlsx, Allegato 2 Dati_Analisi.xlsm, OSMED 2023/2024
  extracts, and antibiotic report. Full names/hashes in
  `private-staging/closure/source-manifest.json`.
- Derivatives: `private-staging/closure/{indicators,product-analysis,
  composition-links,audit}.json`. Source: 1,316 product/org/year records, four
  org codes 201–204, 2023–25. 238 AICs, 64 observed ATC5; local reference 78 J01.
- Workbook: `private-staging/closure/deliverables/VIS_Pillar_A_Verified_20260923.xlsx`;
  companion `Manual_Calculation_Guide.md`; builder
  `private-staging/closure/authoring/build.mjs`. All private and ignored.
- Older workbook: `../viscompass/outputs/pillar-a-update/Pillar_A_Workbook_Updated.xlsx`.
- Public raw inputs: `../viscompass/data/` and `../viscompass/outputs/pillar-a-scope/`;
  AIFA series manifest locates CSVs; ISTAT and SDO inputs documented in builders.
- Public compiled assets currently in `public/data/` of this checkout.
- Source audit: `scripts/verify_pillar_a_closure.py`; private import staging:
  `scripts/stage_private_pillar_a.mjs`; v2 SQL migration:
  `supabase/migrations/20260923_private_pillar_a.sql` (also appended to schema).
- Generated ignored v2 SQL/facts: `private-staging/closure/private-v2-import.sql`
  and `private-v2-facts.json`. 48 records, excludes regional totals to prevent
  double-counting. Source manifest hash ecd1f82bbe2c15f3fed91ed50edec169e98622bf3f9df17587ace7d378e7bedd.
- Supabase project yxumhjfsoqfckaeydgxt. Existing older table
  `antibiotic_consumption_fact` had 48 v1 rows; current state must be checked.
  V2 table activation was not performed by Codex. Browser Supabase login does
  not authenticate the VIS website. Never place credentials in handovers/logs.
- Production: https://www.eurekene.com, Vercel viscompass-217a; GitHub main
  auto-deploys. Do not push work-in-progress to main.

## Exact remaining acceptance criteria for Claude

1. Protect compiled data: removing the CSV allowlist alone is insufficient.
   Public `pillar-a.json` retains 880 annual records and public `pillar-a-atc4.json`
   has 10,570 rows. OSMED still publishes sourceFile/hash. Use server-side,
   authorized data delivery outside `public/`, and a deliberate limited public
   demo if approved. Do not claim browser-delivered values cannot be extracted.
   Test logged-out, pending, own-ASL, regional and admin access. The current proxy
   checks login, not approved membership, for CSV; also fails open without env.
   Make sanitization part of the canonical build, not an optional final script.
2. Workbook: complete terminology including DDD/1,000 residents/day, calendar-day
   and population basis; composition Sankey (descriptive, not patient movement);
   deviations plots; Price/Mix/Interaction waterfall and peer chart side by side;
   regional temporal analysis plus ASL selector/small multiples. Preserve source
   formulas and ASL1–4 pseudonyms. Do not replace requested three-term benchmark
   maths with the existing two-factor year-on-year bridge. Follow spreadsheet skill.
3. Private per-product ABC and ATC5/molecule time series: data is present locally;
   needs versioned RLS storage and authorized views, not public JSON. Align ABC
   crossing-item convention with private workbook (preceding cumulative share).
4. ABC–VEN: implement versioned clinician-supplied mapping validation and explicit
   unmapped state; no real VEN conclusions without approved mapping. Review the
   two papers in Feedback (PMC8477259, PMID36829254) for a documented proposal,
   not automatic clinical classification. ABC and AWaRe do not supply VEN.
5. Hospital objectives: regional PNCAR is not hospital ranking. Use only comparable
   provider/year/denominator cohorts. Existing files here support Azienda, not a
   proven national hospital-quality comparison. Missing granular inputs must be
   stated precisely; do not fabricate hospital-level claims.
6. Automated hospital workflow: dirty sibling contains upload validation/staging,
   but `lib/uploads/reconcile.ts` explicitly stops at canonical_mapping_blocked.
   Carefully port useful work only after reviewing its changes. No blind merge.
   Complete supported mappings/rules, provenance and report generation; quarantine
   unresolved records rather than guessing. Preserve negative/partial-month rules.
7. Final access activation: pending Guido approval. Apply guarded migration/import
   only after inspecting existing schema; verify imported rows; execute real
   transactional RLS tests (rollback fixtures) and authenticated browser tests.
   New signup selection requests access; it must not self-approve it. Admin-account
   management permission is separate from all-data readership. Explicit approval
   is still required for the new all-data role.

## Analytical contracts

CF is reported flow cost, not invoice-certified expenditure. CMR is regional-price
valuation. Source DDD = QMR × DDD_AIC. New workbook selects A3/T1, excluding onere
degenza 4 and disciplina 31; never rename it A2 or silently equate it to SDO.
Private scope is J01 only. Public ATC4 is broader, not individual-molecule usage.
National OSMED 2024 edition revises 2023 to 85.4; do not splice the old 84.0.
2024 PNCAR position is interim, not 2025 target achievement. No causal blame.

## Runtime and verification

Node works directly; npx may not be on PATH. `node_modules` is a junction, so use
`node node_modules/next/dist/bin/next build --webpack` (Turbopack rejects its path).
Run real `node node_modules/typescript/bin/tsc --noEmit` as well as runtime tests.
Bundled Python: `C:/Users/HP/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe`.
Use `-X utf8`. Artifact Node/modules under the same dependencies/node directory.
Read applicable skills before document/workbook work. Keep private data outside Git.

## Final Codex checkpoint

Public fixes through 5b8df71 merged in 5d36ed9; no sibling changes overwritten.
Added `lib/analytics/private-pillar-comparison.ts` and
`components/private-pillar-charts.tsx`, wired into the private server route.
Private Sankey supports CF, DDD and DDD-share; own/perimeter historical CF/CMR
chart; regional-only fixed-DDD benchmark waterfall and signed three-component
peer chart side by side; authorized-ASL selector and regional intensity-deviation
time series. RLS-filtered, primary-membership-scoped data only reaches the client.
ASL accounts receive no peer facts. No source amounts hardcoded in new source files.

Benchmark: sum category reference q_r*p_r, with q_r equal to selected-org total
DDD times authorized-perimeter category share. Components q_r*(p-p_r),
(q-q_r)*p_r, (q-q_r)*(p-p_r). Reference includes the org. All three components
reconcile and org differences sum to zero. These are within-AWaRe average costs,
NOT pure product prices, causal blame or achievable savings. A3 is local and is
not compared to the national denominator. Zero category DDD suppresses comparison.

Three new runtime tests passed, including all staged private comparisons.
Browser layout QA remains undone: especially small mobile width, negative
waterfall intermediate values, themes, selector synchronization and labels.
Current Sankey rounded labels need tooltip/exact accessible table improvement;
trajectory is a line of intensity deviation, not Guido's bivariate movement plot.
Per-ASL decomposition small multiples and regional year-on-year chart are still
to be completed. Current existing private tables remain aggregate when chart
selector changes; label or synchronize before final release. Pseudonyms 201–204
are fixed as ASL 1–4; extend via a reviewed server-issued mapping for new cohorts.
Do not claim these remaining items are closed.

No database changes, push, deployment, new memberships or external data sharing
were performed in this pass. Do not accidentally publish the merged private
route before its table/access gate is satisfied. This handover is local; the user
must pass it to their actual Claude Code session. Final command results are
recorded in the accompanying assistant response and git checkpoint. Full runtime
suite: 26 passed, 2 pre-existing fixture skips, 0 failed. TypeScript passed.
Webpack production build completed successfully. Implementation commit: 58ffab3.
No preview server was started for these new private charts. Browser QA is pending.
