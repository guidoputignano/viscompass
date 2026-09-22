# Private workbook integration — 21 September 2026

Route: `/dashboard-review/pillar-a`; the old antibiotic route redirects here.
Session-scoped Supabase reads use the existing `antibiotic_consumption_fact`
RLS policy. No service-role client, shared cache, public JSON or client-side
security filter is used. Missing data is an empty state, never a synthetic fallback.

Source: the updated Pillar A workbook, SHA256
`ab8e41220cb063695fab87598baf56c5fc7487de2c19d26329204de8b385ed2c`.
48 source rows: four Aziende × three years × four AWaRe categories. Regional
source rows are not imported, to prevent double-counting. Rounded source
values and small category/total discrepancies are preserved and disclosed.
Spending and DDD are supplied workbook values, not certified product-level
conversions. A2 and weighted-population rates remain unavailable.

The fixed-total-DDD illustrative national-reference decomposition reproduces
the workbook's eight Azienda/year comparisons to <0.00001 EUR. It is not
the A2-normalized operational-plan decomposition or a savings estimate.
No national reference exists for 2025. No private peer benchmark is exposed.

Live PostgreSQL RLS test passed using existing approved ASL/regional user
claims under `SET LOCAL ROLE authenticated`, plus anonymous/nonmember claims.
Five temporary fact rows included an out-of-region control. The ASL saw one
row, the regional user four, and outsiders none; authenticated insertion was
denied. The complete fixture transaction rolled back. Memberships and access
policies were not changed. These are database-session tests, not browser
sign-ins as each user.

`scripts/stage_private_workbook.py` audits the original workbook and writes
an empty-table-only transactional import and private regression fixture to
gitignored `private-staging/`. It does not overwrite existing data. Keep these
files local; never publish them. The ordinary TypeScript typecheck is required
in addition to runtime tests against the TypeScript calculation module.
