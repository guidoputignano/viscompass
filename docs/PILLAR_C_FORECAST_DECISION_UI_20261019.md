# Pillar C forecast: decision-facing presentation

## Owner request

Remove model scoring, admission tables, candidate names and modelling detail
from the end-user dashboard. Show usable spending results instead.

## Implemented

- Keep the existing monthly observed/forecast chart, uncertainty bands, series
  control and exact financial-value table.
- Replace technical admission and methodology blocks with indicative annual
  spending, annual ranges and the month with the largest forecast point.
- Compare the indicative annual forecast with provisional observed 2025 only
  when every observed month and source row is valued. Otherwise show a clear
  incomplete-base message, never a zero or misleading growth percentage.
- Keep source and licence links in collapsed data-and-scope details. Explain
  regional scope, provisional observations, missing data, class non-additivity
  and the indicative annual ranges without exposing model diagnostics.
- Exclude model-scoring outputs from the adjacent forecast selector. The raw
  duplicate forecast is omitted there because its financial results already
  have a typed, coverage-checked presentation above. Keep the spending scenarios.
- Remove rounding checks and model-sensitivity columns from those views, not
  meaningful euro amounts. Replace formula-style scenario headings with names.

## Unchanged

Forecast inputs, frozen workbook, validation/admission rules, original amounts,
intervals, access rules and audit records. No migration or data import is needed.
New sums, differences and percentages use exact integer cents; input objects
are never mutated. The annual summary remains indicative and explicitly lacks
a dedicated historical check.

## Verification

The complete automated suite passed with 805 passed, 8 skipped and no failures
before the final copy-only refinements. Focused helper/render/insight tests cover
all selectable series, rejected and missing results, coverage guards, exact
cents, ties, unchanged inputs and removal of diagnostics. Actual pinned forecast
values were independently reconciled outside this public repository; no private
amounts or evidence packets are committed here.

After the final copy changes, the real project type-check, scoped lint and all
71 focused helper, rendered-panel, review-schema, insights, chart and workbook
tests passed with no skips or failures.

Deployment and signed-in visual verification are separate checks; record their
results only after they have run.
