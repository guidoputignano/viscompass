# Pillar B production release handover — 2 October 2026

Claude Code: take over the production release from this exact state. Do not
re-import, regenerate, or activate blindly. The owner authorized the frozen
Abruzzo ledger import and activation for approved VIS accounts, but the live
review page must render and reconcile before the gate is left on.

## Current state

- Repository: `viscompass-pillar-b-gate`, branch `pillar-b/gates-20261001`.
  Latest code pushed to `origin/main`: `fd4f8cb` (plus handover-only commit
  `2b62bee`). Build (`next build --webpack`) and TypeScript passed before the
  code push. Inspect `git status` and deployed commit.
- Production Supabase project: `yxumhjfsoqfckaeydgxt`. Release ID:
  `PILLAR-B-R2-20261001`.
- `canonical_fact` has **261,153 frozen R2 rows** (2024 110,509; 2025 106,639;
  2026 44,005). Total €1,078,943,265.79, comparable-eligible
  €699,820,567.13. Import was independently checked against 21 frozen input
  hashes, row identities, year totals and channel/ASL counts. Do not import
  again. Restricted `pillar_b_import_stage_r2` contains the staging copy; anon
  and authenticated have no table privileges, RLS enabled.
- `pillar_b_active_release` is **empty** after a controlled de-publication.
  Confirm this before anything else. The old synthetic biosimilar page is
  separately labelled and still renders; `/dashboard-review/dati` renders the
  gated empty state.
- User approved the exact RLS mapping `201→130201`, `202→130202`,
  `203→130203`, `204→130204`, confined to region `130`. Applied in production
  and versioned by `20261002120000_canonical_fact_asl_scope.sql`. The only
  currently approved Azienda account is `201`; it sees exactly 23,545 of its
  own 2025 rows under a full simulated JWT and sees no other Azienda.
- `idx_canonical_fact_release_year_asl` was created and the table analyzed;
  versioned in `20261002130000_pillar_b_release_scope_index.sql`.
- Gate 4 reconciliation was rerun with the actual production-style org codes:
  **37/37 pass**, including exact workbook euros, every chart value, ASL and
  Regione partition, pending/anonymous denial. The local harness is
  `outputs/pillar-b/logs/b31_review_page_reconciliation.mjs` (in the separate
  outputs tree). Its org fixtures were corrected from `130201` to `201`.

## Last live failure and just-deployed candidate fix

With the release activated, the approved `201` browser at
`https://www.eurekene.com/dashboard-review/revisione-pillar-b` rendered a
fail-closed diagnostic, last observed **`PBR-SPEND25-57014`**. PostgreSQL
`57014` is a statement timeout. Service-role REST RPCs worked; all eight
functions returned scoped rows in an authenticated SQL transaction. The page
was issuing six top-level RPCs concurrently, plus uptake subcalls and molecule
pagination, which likely overloaded the database under RLS. The release was
immediately deactivated, not left broken for users.

Commit `fd4f8cb` phases the page requests (three, then two, then uptake) and
uses stable-key, 1,000-row paging for molecule RPCs. Earlier code silently
truncated >1,000 molecule groups; the paging fix is necessary even if it does
not fix the timeout. The database index did not materially reduce a standalone
`pillar_b_spend(2025)` simulated-JWT call (about 0.8–1.0 s), so do not assume
the index alone solved it. **A subsequent live attempt with this code still
failed `PBR-SPEND24-57014`.** I immediately removed the gate row and confirmed
`active_releases = 0` in production. Do not reactivate until the timeout is
actually corrected. A standalone authenticated SQL call succeeds in ~1 s,
whereas the live PostgREST path times out, so investigate the actual REST/RLS
query plans, Supabase role statement timeout, and the cost of concurrent RPCs.
Bounded concurrency alone is not the fix.

## Next actions, in order

1. Confirm active-release count is 0 and production code is `fd4f8cb` or
   newer. Inspect the branch and diff; do not reset unrelated work. Diagnose
   and fix the `57014` timeout before another activation attempt; avoid simply
   raising the timeout without a measured query plan and load check.
2. Activate exactly `PILLAR-B-R2-20261001` once, then load the live review page
   as the existing approved `201` account. If any error or timeout remains,
   immediately remove **only the gate row** (not the facts). The safe page
   diagnostic includes the failed RPC name and sanitized SQLSTATE. A second
   `57014` means the concurrency cap was insufficient; profile and optimize
   the SQL/RLS path or change the query schedule without increasing statement
   timeout as a substitute for proof.
3. On successful render, verify scoped 2025 stage 1 = **23,545 rows** and spend
   = **€100,675,853.35** for `201`. The four-ASL total 106,639 and
   €452,687,361.73 must **not** appear as the ASL headline. Check all three
   page sections, both 2024/2025 trends, concentration, uptake with withheld,
   exclusions, and absence of 2026 as a comparable year. The molecule RPC
   should return all 1,534 grouped rows for `201`/2025, not 1,000.
4. Check `/dashboard-review/spend`, `/dashboard-review/biosimilar-to-euros`,
   `/dashboard-review/dati` and Pillar A after activation. No 2026 headline,
   zero-package claim, acquistato inversion, RangeError, or unlabelled
   synthetic/live mixing. Stop and de-publish on any such failure.
5. Capture screenshots of every final review output/section and meaningful
   legacy page state for the owner, with short explanations and numeric
   reconciliation. Do not present a screenshot of a fail-closed diagnostic as
   a finished analysis.
6. Run TypeScript, full tests and production build, record the actual deployed
   commit and a concise final pass/fail checklist. Only call the release live
   when the gate is on **and** real-account browser checks pass.

## Safe operations and evidence

- SQL editor is signed in at the project; no database password is needed.
  Service-role credentials exist in `viscompass-pillar-a-release/.env.local`;
  do not print or paste them. Local probe script is
  `outputs/pillar-b/logs/probe_service_connection.mjs`.
- Import scripts and frozen evidence are under `outputs/pillar-b`; the output
  directory is a separate Git repository with a strict allow-list. Never
  commit its workbooks, JSONL, row dumps, or secrets to the application repo.
- Database activation: insert one row in `pillar_b_active_release`; rollback:
  delete that release row only. Never delete the 261,153 fact rows as a casual
  rollback, and never roll back the gated application code while facts remain.
- The approved RLS mapping is region-bound; do not broaden reviewer access or
  make any analysis public.
