# Pillar B production release handover — 2 October 2026

> Historical handover snapshot. The release-gate and migration states below
> have since changed. See `docs/PILLAR_B_VALUE_UPTAKE_LIVE_20261002.md` before
> taking further production action.

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

---

# Addendum — 2 October 2026, diagnosis of PBR-SPEND24-57014

**Production unchanged. `active_releases = 0`, `canonical_fact` = 261,153 rows.
Nothing was activated, migrated or imported.** Every statement run against
production in this pass was read-only or inside `begin … rollback`.

## Two explanations were wrong. Recorded so they are not retried.

**It is not the RLS policy.** The repository's `20261002120000` is a correlated
`EXISTS`; profiled on the real ledger it costs **110,509 subplan executions** for
2024 and about 1.2 s. But production does not run it. Read back from
`pg_policy`, production carries the `20261002140000_canonical_fact_cached_scope`
form — uncorrelated authorized sets with `auth.uid()` already wrapped as
`(select auth.uid())`. Against that shape the subplan runs **once** and
`pillar_b_spend(2024)` costs about **0.1–0.3 s**. An RLS rewrite was drafted,
measured, and then **withdrawn** as solving a problem production does not have.

**It is not concurrency.** Bounding the page to three-then-two-then-one request
serialises the same work without reducing it, which is why `fd4f8cb` changed
nothing.

## What it is

`getMoleculeSpend` paged with `.order().range()`. PostgREST wraps the function in
an ordered `LIMIT/OFFSET` query, so **the entire aggregate re-executes for every
page**. Per execution on the real 261,153 rows:

| account | one execution | pages/yr | two-year total |
|---|---|---|---|
| Azienda 201 | 0.44 s | 2 | ~3.3 s — fits |
| Regione 130 | **5.08 s** | **8** | **~70.5 s** — does not, by 9× |

## The budget, confirmed on production

`select rolname, rolconfig from pg_roles` gives
`anon = 3s`, **`authenticated = 8s`**, `postgres` = none. PostgREST runs as
`authenticated`; the SQL editor runs as `postgres`. That is the whole asymmetry:
the earlier "~1 s standalone" measurement had **no deadline at all**.

## The fix in this branch

`20261002160000_pillar_b_molecule_spend_single_call.sql` adds
`pillar_b_molecule_spend_json`, returning the grouped result as one `jsonb` row —
one row cannot hit the 1,000-row cap, so there is nothing to page and the
aggregate runs once. It also adds
`idx_canonical_fact_release_year_substance`. `getMoleculeSpend` now makes a
single call. Equivalence is asserted, not argued:

| | rows, both forms | euros, both forms |
|---|---|---|
| 201 / 2025 | 1,534 | **€100,675,853.35** |
| 201 / 2024 | 1,672 | €100,330,941.30 |
| Regione / 2025 | 7,131 | €452,687,361.73 |

## Applied to production — database only

`20261002160000` **is applied** (SQL editor, signed in, role `postgres`):
`pillar_b_molecule_spend_json` created, `execute` revoked from `public`/`anon`
and granted to `authenticated`, `idx_canonical_fact_release_year_substance`
created, table analyzed. Each statement returned "Success. No rows returned".

Measured on production as the real Azienda 201 account, with the gate turned on
**inside a transaction that was then rolled back**, so the release stayed
de-published throughout:

| | |
|---|---|
| groups returned | **1,534** — the full set, not truncated at 1,000 |
| spend | **€100,675,853.3…** |
| elapsed | **0.63 s** for *two* executions of the function |

Against an 8 s budget. Afterwards: `active_releases = 0`, `canonical_fact` =
261,153, and every RPC correctly refuses with
`P0001: no active Pillar B release is declared`.

## NOT activated, and why — this is a technical blocker, not caution

**Production still serves `fd4f8cb`**, whose `getMoleculeSpend` pages with
`.order().range()`. The database fix cannot help code that does not call it.
Activating now would re-run the exact path that produced `57014`.

The remaining order is therefore:

1. Deploy this branch (`a7bb331` or later) so the app calls
   `pillar_b_molecule_spend_json`. **Nothing else may precede this.**
2. Confirm the live page still renders "Nessuna release attiva" with the gate off.
3. `insert into pillar_b_active_release (release_id) values ('PILLAR-B-R2-20261001');`
4. Load `/dashboard-review/revisione-pillar-b` as `201`; expect funnel stage 1 =
   **23,545 rows / €100,675,853.35**, molecule groups **1,534**, and **not**
   106,639 or €452,687,361.73, which are the Regione's figures.
5. On any error or timeout, `delete from pillar_b_active_release` — the gate row
   only, never the facts.

The Regione account (`438c0d40…`, org `130`, approved) is the heavier case:
7,131 groups and roughly 4.5 s of total database work per page load even after
this fix. Check it too before calling the release live.

Do not apply the withdrawn RLS rewrite; it is deleted from this branch.

## Audit gap found

`20261002140000_canonical_fact_cached_scope.sql` — the policy **actually running
in production** — was untracked in the working tree, and `supabase_schema.sql`
carried the same change uncommitted. The handover's commit `726b9de` therefore
does not contain the live policy. Both are committed here.
