# Pillar C — analysis-specific visual exploration

## Scope

Owner request: replace the repetitive bar-chart presentation with more varied,
useful visualization choices. No new data, model fitting, formulas, classifications,
public disclosure, access grants, migration, import or release-gate changes.
Frozen analytical inputs remain unchanged. Withheld outputs remain withheld.

## Implemented

- Native spend profile: area, line and columns; monthly/cumulative calculation
  remains a separate, existing selector. Missing months remain gaps.
- Native accounting change: reconciled waterfall, opening/closing totals,
  signed contributions and an alternative point profile. Decimal endpoints
  use exact arithmetic; chart coordinates alone use floating point.
- Analytical panels: point profiles, linked paired comparisons, heatmaps,
  explicit point/range charts, two-axis scatter, temporal line/area and bars.
- Defaults are selected by data compatibility and purpose, not one universal bar.
  Shared-area and composition views prefer same-measure heatmaps; admitted
  intervals prefer points/ranges; chronological series prefer lines.
- Local indicator, comparator, scatter-axis, interval, ordering, page-size and
  chart-pagination controls. Every source row remains reachable; no permanent
  first-20 truncation. Exact tables are retained.
- Keyboard/focus and pointer interaction for SVG points and heatmap cells;
  source-value labels, common-scale legends and explicit absent-value handling.
- Category labels no longer append raw amounts merely because a measure's
  heading begins with a year. Context identifiers still distinguish rows.

## Binding safeguards

- No aggregation, inferred clinical denominator, imputation or new percentage.
- Paired comparisons require identical units and raw scales. Heatmaps group
  the same measure across periods, or explicit decomposition components.
- Full-year and five-month figures are not automatically paired.
- Scatter axes can differ in unit, but each axis is separately identified.
- Lines require distinct, consecutive and ordered calendar periods, with one
  organizational/context series. Missing source values remain null gaps.
- Interval bounds require an explicitly recognized source schema; invalid or
  absent bounds are not reconstructed. Sensitivity is not relabelled confidence.
- Neither pending domain acceptance nor synthetic scenarios gain an observed
  or verified badge from these presentation changes.
- Formulas, internal output codes and the removed workbook explorer are not
  reintroduced.

## Verification record

- Real frozen catalogue: 84 available outputs, 99 source tables. Chart adapters
  checked against source numeric cells, including null, zero and negative values.
  All 40 native accounting bridges close exactly with decimal arithmetic.
- Synthetic regression fixtures cover raw precision, unit incompatibility,
  period-family matching, missing calendar periods, source-bound eligibility,
  interval pairing and cent-exact waterfall closure (including mutations).
- Static/live rendering, type-check, lint, full suite and deployment status must
  be recorded separately; value parity is not evidence of a completed browser
  interaction or a new analytical independent V2.

Verification artifacts containing source-derived data stay outside the public
checkout, in `outputs/dashboard-remediation-20261016/`.

### 17 October implementation checks

- Catalogue adapter: 79,110 source-cell comparisons, 75,382 populated numeric
  values, all 84 available outputs / 99 tables; all 40 bridges close exactly.
- Four static-render regressions exercise SVG geometry and exact accessible
  labels; seven contract fixtures exercise the real TypeScript helpers.
- Full local suite: 632 tests, 624 passing, eight pre-existing skips, zero
  failures. Targeted presentation suite: 16/16 passing.
- Production build, actual TypeScript checking and targeted lint passed locally.
  A sandbox filesystem error was resolved by the permitted build retry, not by
  suppressing errors or changing the source contract.
- Live deployment and interaction receipt: pending below. Static rendering does
  not establish responsive browser behavior, filter interaction or production
  deployment.
