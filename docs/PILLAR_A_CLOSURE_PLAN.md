# Pillar A feedback implementation — 23 September 2026

This checkpoint follows the user's delegated analytical decisions. It does not
reactivate the private-dashboard release reverted in be93729. No database rows,
permissions, emails or production deployment were changed in this pass.

## Verified implementation

| Item | Current result | Publication boundary |
|---|---|---|
| New five-file Drive package | Downloaded, hashed; 1,316 product/year/organization rows audited | Raw workbooks and hospital derivatives remain ignored/private |
| Local perimeter | 78 J01 codes versioned in `lib/analytics/pillar-a-local-perimeter.json`; 64 observed | Does not truncate the separate broad public AIFA ATC4 scope; two WR mappings retained |
| CF / CN / CMR | Independently aggregated; 240 cost/DDD comparisons pass | CF means reported flow cost, not proven invoice payment; no production relabelling yet |
| Activity denominator | New workbook selects A3 and T1; all 12 organization/year controls match | A3 is not silently renamed A2; discipline exclusion is not assumed equivalent to DRG exclusion |
| Population | 2016–2018 official reconstruction added; 2019–2025 POSAS including autonomous provinces | Historical reconstruction uses 2019 boundaries; source basis travels with each annual row |
| Monthly comparison | All territories available, 2025 territory/Italy share-of-annual-spend chart | Describes seasonality, not incidence; retains separate flows |
| PNCAR | OSMED 2024 table 5.2, all 22 territories, 2016–2024 | Same-edition 2022 baseline; 2024 interim position, not 2025 attainment |
| ATC exploration | ATC4 category selector, molecule search and AWaRe reference counts | Counts are reference entries, not consumption shares |
| ABC / composition | Private per-AIC CF ABC bands and reconciled category links computed | Not efficacy ranking, clinical VEN or patient transitions; charts/workbook still pending |
| Website explanation | Metric glossary, ATC/AWaRe/ABC distinctions, SDO purpose; internal diagnostic panel removed | No claim that paused private calculations are already available |

## Remaining work — do not mark the whole feedback closed

1. Produce the revised private workbook and its organization/regional comparison,
   decomposition and composition visuals from the audited new source; use ASL 1–4
   in external artifacts, with no named region. Keep CF and CMR visibly distinct.
2. Complete visual regression and release review of the public changes, then
   publish the validated public-only release. No public hospital product rows.
3. Private-view reactivation, production CMR relabelling and authenticated tests
   remain parked under the user's explicit earlier instruction.
4. ABC-VEN is a separate enhancement requiring a validated clinical VEN mapping.
   Neither ABC nor AWaRe supplies this mapping.

## Corrections to the proposed handover

- Historical population was found in **intercensal reconstruction**, not identical
  POSAS 2016 files. The extraction reconciles sex totals, regions, provinces and
  national population, including the two autonomous provinces.
- OSMED 2024 revises 2023: national DDD/100 activity days is 85.4 in this edition,
  not 84.0 from the 2023 edition. Never stitch the two for a yearly change.
- A report's chosen denominator can be reproduced without certifying its
  equivalence to other denominator variants.
- A composition Sankey is valid because links sum to source totals; arrows do
  not imply medicines or patients moved between categories over time.
- Observed higher spending or consumption does not by itself prove inferior
  clinical outcomes, inappropriate prescribing or causality.

## Reproduction

From this checkout, using a Python runtime with openpyxl and pypdf:

```text
python scripts/verify_pillar_a_closure.py
python scripts/build_pillar_a_population_history.py
python scripts/build_pillar_a_osmed.py
python scripts/build_pillar_a_public_series.py --source-root ../viscompass
```

Copy the regenerated public series JSON/CSV from `outputs/pillar-a-update/` to
their existing files in `public/data/`. The sibling source-root is read-only;
the dirty sibling checkout must not be reset or otherwise changed.

```text
node --test
node node_modules/typescript/bin/tsc --noEmit
node node_modules/next/dist/bin/next build --webpack
```

The local node_modules junction is outside this worktree and Turbopack rejects
it; webpack builds without changing project configuration. Two existing proxy
tests skip because their optional generated fixtures are absent; these are not
counted as passed. The new source audit runs independently and does not skip.

## Checkpoint verification

Webpack production build and TypeScript check passed. Pillar A tests: 14 passed,
2 optional-fixture tests skipped, 0 failed. Browser verified national PNCAR
change (+0.72%), Bolzano selection (+18.24%), monthly comparison visibility and
ATC4 filtering (J01DH: 9 codes). The browser check caught and fixed an auth
redirect on the new public OSMED JSON. Only that exact public aggregate path
was allowlisted; no private route or wildcard path was opened. Full responsive
visual coverage and deployment verification are not claimed.
