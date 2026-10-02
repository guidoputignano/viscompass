# Pillar B value-uptake RPC: production receipt, 2 October 2026

This records a **dormant database migration**, not a published analysis or a
dashboard release. The application does not call `pillar_b_value_uptake` yet.

## Scope applied

Production Supabase project `yxumhjfsoqfckaeydgxt`; source commit `e310f70`,
migration `20261002170000_pillar_b_value_uptake.sql`. The function, comment,
`authenticated` grant, `public`/`anon` revokes, index
`idx_canonical_fact_perimeter_filter`, and `ANALYZE` were executed in one
transaction through the SQL editor. Supabase returned **Success**. No fact
rows were imported, and no application or release-gate change was made.

The SQL was applied manually, not through a migration runner. Check the
production object before any automated migration replay; the file remains in
the repository so a new environment can reproduce the schema.

## Live checks

Before execution, both the function and index were absent. Afterward,
`to_regprocedure` and `to_regclass` resolved; `prosecdef = false` confirms
security-invoker behavior. `authenticated` has `EXECUTE`, `anon` does not. An
actual SQL-editor attempt under `set local role anon` failed with PostgreSQL
`42501 permission denied for function pillar_b_value_uptake`.

The following used authenticated role plus simulated JWT claims in rolled-back
SQL-editor transactions. They exercise the **production RLS policies**, but
are not a real browser-session or PostgREST latency test.

| Scope | Verified result |
| --- | --- |
| Region | 28 substances; date-valid biosimilar €29,228,420.73, reference €44,796,546.96; T2 biosimilar €29,228,420.73, reference €20,322,838.90; boundary €1,109,464.65; unknown €0.00. All match the frozen B05 evidence. |
| Azienda 201 (ASL 1) | Date-valid €20,748,566.16; inside €20,578,454.60; predates €170,111.56; boundary €332,922.81; outside €3,419,445.83; unknown €0.00. Strictly scoped below the Region. |
| Anonymous | Function execution denied (`42501`). |

`EXPLAIN ANALYZE` database-side execution times under the simulated Region
identity: unfiltered **80.313 ms**, 2025 **87.202 ms**, DD **55.609 ms**,
2025+DD **49.369 ms**, adalimumab **42.525 ms**. Azienda 201 unfiltered:
**48.863 ms**. These are not end-to-end PostgREST response times.

The active release gate remained exactly one row,
`PILLAR-B-R2-20261001`, after the migration and checks.

## Remaining acceptance before the view is published

Build the interactive view against this RPC; render the boundary and unknown
classes explicitly, keep 2026 partial-year handling, and reconcile each
plotted value and filter to the frozen workbook and the live account scope.
Exercise the real authenticated browser/PostgREST path, including latency and
RLS isolation, before calling the analysis deployed. Do not re-import the
261,153 frozen rows or change the release gate merely to wire this view.
