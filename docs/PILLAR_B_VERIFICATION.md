# Reproducing the Pillar B Gate 2 / Gate 3 verification

The Gate 2 and Gate 3 harnesses are **not** in this repository, and their
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

Full instructions, prerequisites and limits: `outputs/pillar-b/VERIFY_README.md`.

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
`scripts/load_pillar_b_facts.mjs` — so they exercise the code that ships rather
than a reproduction of it.

## What they do and do not establish

They apply the real schema and migrations to a real Postgres engine, drive the
real loader, and exercise RLS with real role switching and real JWT claims. They
prove the **policy text**, the loader and the read contract.

They prove **nothing** about the production Supabase project, its configuration
or its deployed policies. That is a separate step, and the production import is
blocked in any case — see `outputs/pillar-b/IMPORT_BLOCKER_20261001.md`, which
records that the legacy query layer in `lib/dashboard-review/queries.ts` reads
`canonical_fact` with no release filter and would select partial 2026 as the
latest year.
