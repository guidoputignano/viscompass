# Reproducing the Pillar B Gate 2 / Gate 3 / Gate 4 verification

> Historical verification snapshot. Its production-status statements below
> predate the R2 import, activation, and value-uptake migration. See
> `docs/PILLAR_B_VALUE_UPTAKE_LIVE_20261002.md` for the latest RPC status.

The Gate 2, Gate 3 and Gate 4 harnesses are **not** in this repository, and their
dependency is **not** in this `package.json`. This file exists so a reviewer
working from the checkout finds them without being told.

## Run

```bash
cd "<workspace>/outputs/pillar-b"
npm ci
npm run verify
```

Expected on release `PILLAR-B-R2-20261001`:

| Harness | Result |
|---|---|
| `logs/b22_gate2_pglite_harness.mjs` | **48 passed, 0 failed** |
| `logs/b24_gate3_pglite_harness.mjs` | **76 passed, 0 failed** |
| `logs/b30_gate4_legacy_scope.mjs` | **34 passed, 0 failed** |
| `logs/b31_review_page_reconciliation.mjs` | **37 passed, 0 failed** |

Full instructions, prerequisites and limits: `outputs/pillar-b/VERIFY_README.md`.

That directory is its own **local** git repository, so the evidence documents and
harnesses have a real history — a runbook executed step by step against
production should not carry a revision number asserted only in its own prose. It
has no remote on purpose: the documents carry per-ASL euro figures derived from
non-public records. Its `.gitignore` is an allow-list, excluding everything by
default, so the frozen inputs and workbooks cannot be versioned by a near-miss
pattern.

## Why the dependency is not here

The harnesses run a throwaway PostgreSQL 18.3 via `@electric-sql/pglite`. Adding
that package to this repository's `package.json` rewrote **2,933 lockfile lines**
and silently bumped **52 unrelated package versions**, including `sharp` and the
whole `@babel/*` tree. A verification fix must not change the production
dependency graph, so it is pinned alongside the evidence instead.

## Why the harnesses are not here either

They verify real figures against frozen inputs holding **non-public hospital
data**, which are deliberately outside this public repository. The harnesses have
no fixture mode: one that passed without the data would prove nothing. They do
read **this checkout** — `supabase_schema.sql`, `supabase/migrations/**` and
`scripts/load_pillar_b_facts.mjs` and `lib/dashboard-review/release-scope.ts` — so
they exercise the code that ships rather than a reproduction of it.

That matters more than it sounds. The Gate 4 harness drives the real selectors
over the real 261,153 rows, and that is how it found a `RangeError` in
`getLineageData()`: `Math.max(...group.map(...))` passes one argument per row,
and V8 throws past 124,741 of them. A fixture of a few dozen synthetic years
passes and ships the crash.

## What they do and do not establish

They apply the real schema and migrations to a real Postgres engine, drive the
real loader, and exercise RLS with real role switching and real JWT claims. They
prove the **policy text**, the loader and the read contract.

They prove **nothing** about the production Supabase project, its configuration
or its deployed policies. That is a separate step, and the production import is
blocked in any case — see `outputs/pillar-b/IMPORT_BLOCKER_20261001.md`, which
tracks six conditions. **All six are now closed**, and the two checks the owner
set as the precondition for the import both pass in `b31`: every value the review
page plots reconciles to the frozen workbook to the cent, and ASL isolation holds
at the grain the page reads.

The import itself has **not** run, and neither has the migration, the deployment
nor any live verification. None of them may be marked complete. The schema step
is DDL, which the only available production credential (a PostgREST service-role
key) cannot perform, and no Supabase CLI or connection string is present.

The order is not the obvious one: the **gated code must be deployed before any
row is loaded**. Production runs `main` at 94565b9, which has no release gate, so
rows loaded ahead of the deploy are read on the next page load regardless of
whether a release is ever activated. The ordered steps, the per-account figures
and the rollback are in `outputs/pillar-b/IMPORT_RUNBOOK_R2_20261002.md`.
