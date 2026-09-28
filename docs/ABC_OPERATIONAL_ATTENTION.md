# ABC × operational attention

Implemented 2026-09-28, not a clinical VEN classification.

## Scope

Embedded in the private product charts, after existing aggregate/product reconciliation.
Existing organization and year selectors determine the ABC perimeter. Product CF remains
the spending basis. No database or RLS changes; no new public route or export.
Reference matching runs in the server component on already-authorized products. Only
their evidence and source metadata pass to the client, not the whole reference catalog.

Columns are independent: class H, exact-name/ATC active registry or therapeutic-plan
match, exact-AIC shortage-list membership, and source-reported local PHT flag.
Counts/spending overlap and must not be summed across columns. Each column reconciles
listed + not listed + unknown against the selected ABC perimeter.

## Evidence and limitations

- AIFA A/H snapshots: 2026-04-30 (2,464 H rows, 10,711 A rows).
- Active registries/PT snapshot: 2026-09-23 (381 source rows).
- Complete shortage snapshot: 2026-09-25 (2,531 source rows).
- PHT: January–May 2026 local DB TOT flags, J01 only. Not independently certified
  against current AIFA determinations. Clearly labelled local, not claimed verified AIFA PHT.
- SHA-256, source URLs, dates and row counts retained in generated reference metadata.
- Present snapshots are cross-referenced to historical spending; NOT historical classifications.
- Both H and A listed is unknown; neither listed is unknown. A matching A-list entry
  supplies the negative H result, rather than assuming missing means false.
- Missing registry match remains unknown. Exact commercial name + ATC is deliberately
  conservative. A positive match refers to one or more monitored indications; it does not
  establish an obligation for every local use. No fuzzy/ATC-only matching.
- Not on the shortage list is not evidence of local availability. Presumed shortage end
  dates do not automatically close a reported shortage.
- PHT conflicts/blanks remain unknown. No clinical score, V/E/N assignment or automatic
  'no alternative' inference is made.

## Rebuild

Download the four URLs recorded in `scripts/build_operational_attention.py` to its RAW
directory using the named files. Update snapshot metadata when refreshing. Run:

`python scripts/build_operational_attention.py --local-workbook <DB_Cruscotto_Farmaceutica.xlsx>`

The generator reads original files and writes only reference data to
`data/derived/operational-attention.json` (outside public/). Raw files remain ignored.
No organizational identifiers or financial amounts are retained in the reference output.

## Verification

Five new tests cover strict AICs, missing/conflicting classifications, exact registry
matching, overlapping indicators, group isolation and real staged row reconciliation.
Real staged data: 1,316 records, 238 distinct AICs; positives across all years/products:
79 H, 8 registry/PT, 36 shortage, 3 local PHT. These are overlapping counts, not a
single-year or single-ASL KPI.

TypeScript check passed. Full suite: 176 passed, 2 skipped, 0 failed (178 total).
Local SSR visual review performed using the actual component and one pseudonymized
ASL/year. This checks rendering, not hydrated interaction or authenticated end-to-end behavior.
Production build (`next build --webpack`) passed.

Authenticated browser acceptance: DONE 2026-09-28, against a real signed-in session on
the production build. Cell drill-down returns the 12 band-A class-H products the cell
reports, headed "Banda A · Classe H", each row carrying its own evidence string. Changing
organisation produces three distinct count vectors and three distinct spend figures
(Avezzano 12,4,2,0,…; Pescara 12,5,0,0,…; Teramo 14,3,1,0,…), and the open drill-down
resets when the perimeter changes.

ESLint could not be run, and that is not specific to this work: the repository's ESLint
config fails to load at all — verified by running it against a file this change never
touched, which fails identically. No lint-pass claim is made for anything here.

## Publication gate

Cleared 2026-09-28: drill-down and organisation/year changes exercised in an authenticated
session (above), access boundaries unchanged — no database, RLS, route or export changes,
and the reference catalogue is imported by a Server Component, so a tracer AIC from the
10,711-row A list appears in no client chunk.

PHT remains locally sourced until its official source and effective-date mapping are
verified, and stays labelled as local-workbook evidence until then.

### Amendment on review

`resolveAttention` scanned the A and H lists with `Array.includes` for every product —
238 x 13,175 comparisons per render, measured at 88ms per ten resolves. Both are now
hashed once per call: 18.6ms, same results, same tests.

### Known limitation, not a defect

The drill-down opens only on products with positive evidence. A cell with zero listed and
several "non determinati" cannot be expanded, although that unknown set is arguably the
actionable one — those are the products whose classification nobody has resolved. Worth
revisiting; deliberately not changed here.
