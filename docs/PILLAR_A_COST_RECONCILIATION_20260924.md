# Private Pillar A cost-basis reconciliation

The legacy loader explicitly imports Dati_CO CO1 (normalized costs), not CF.
Its source_note records that basis. The overview now labels CO1 only when all
scoped summary source notes identify it; otherwise it retains a generic source label.
The verified workbook continues to calculate expenditure indicators on CF and
to preserve CMR separately. No source values have been overwritten to force agreement.

A server-rendered comparison now joins the two authorized summaries by year:
summary cost minus workbook CMR, and summary DDD minus workbook DDD. A match
requires both differences within 0.01; absent/invalid inputs are not comparable.
Numerical equality does not establish semantic equivalence. CF minus CMR is
not savings. The region selection now also respects the primary membership's
region, rather than pooling all regions accessible through multiple memberships.

Other corrections: Gregorian leap-year divisor for DDD/1,000 residents/day;
no year-on-year claim across a missing year; absent population is not described
as available; removed the blanket claim that all units/denominators are complete.

Verification: 94 tests passed, 2 skipped; Next production build and TypeScript
passed. The skipped tests remain skipped, not verified by this run.

Scope remains source-based public/private Pillar A analytics. This does not
activate VEN, equate local A3/T1 with OSMED, supply a missing 2022 workbook, or
implement the separate canonical gold-upload pipeline. No migration required.
