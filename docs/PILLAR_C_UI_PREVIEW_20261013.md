# Pillar C UI preview — progress and integration handover

Date: 13 October 2026. Owner: Codex UI workstream; Claude Code continues the workbook workstream.

## Scope and release boundary

The user requested parallel progress on the interface/framework while the workbook is prepared. This change implements a **synthetic, reviewer/admin-only preview**, not a Pillar C analytical release. Every numerical fixture is invented and visibly labelled. No source workbook, organizational fact, patient record, budget allocation, migration, import or production release gate is read or modified by this preview.

Route: `/dashboard-review/pillar-c`. Server-side eligibility requires both an approved organizational membership and a server-derived reviewer or administrator identity. The sidebar places C directly after B for these users. Other approved users receive an in-preparation page; unauthenticated access remains under the existing dashboard authentication layout/middleware. URL parameters cannot enable a real-data mode or privilege.

## Completed interface work

- [x] Pillar A-style editorial layout, scoped filter card, numbered section links, white/teal panels and dark theme.
- [x] Portfolio and channel selectors, chart-local year/measure/view controls, copyable URL, reset, browser history and refresh persistence.
- [x] Spending composition: keyboard-operable horizontal bars, euro/share switch, click-through portfolio selection, exact euro labels and accessible numerical names.
- [x] Monthly/cumulative two-year comparison with adaptive axis units, hover values and a keyboard-accessible exact-value table.
- [x] Attribution coverage: exhaustive S2/S3/S4/S5 illustrative partition; no invented S1 clinical allocation.
- [x] Signed changes by portfolio and an exact accounting bridge from 2024 to 2025. This is not a price/quantity/mix decomposition.
- [x] Budget bullet charts and signed-deviation view, with exact-value table and an explicitly invented 2025 budget scenario.
- [x] Comparisons/activity context readiness panel specifying scope compatibility, appropriate denominators and approved pooled comparator access. No benchmark is fabricated.
- [x] Illustrative review queue and selectable detail cards: investigation question, responsible roles to confirm, evidence of closure. No task is created, persisted or assigned.
- [x] Source/method section and mapping to all 24 planned workbook sheets; the map is a design contract, not an assertion that all sheets are accepted.
- [x] No repeated NA tiles. Evidence-gated analyses have a useful readiness explanation. No missing actual observations are imputed or hidden, because none are loaded.

## Filter contracts

Global portfolio and channel controls apply to all numerical panels in the synthetic fixture. The year control is intentionally next to the annual snapshot: it changes annual KPIs, composition and attribution. The monthly comparison and change bridge always compare 2024–2025. The budget is always an illustrative 2025 scenario. These periods are explicit in the titles and supporting copy; the year selector does not silently restart a comparison.

Local controls preserve other controls and unrelated query parameters. Reset clears only the `pc_*` preview choices. Browser-history updates use `pushState(null, ...)` so Next can synchronize its state without a server data request. A selected single portfolio has 100% of the currently selected composition denominator; this is stated beneath the chart.

## Verification receipt

- Source TypeScript check: passed.
- Targeted ESLint on preview route, components, model, navigation and new tests: passed in the initial implementation; final verification recorded below when complete.
- Full existing suite: **520 passed, 0 failed, 8 skipped** (528 total). The skipped checks remain skipped; they are not counted as passes.
- New preview suite: **12 passed**. Covers all 8 approval/reviewer/admin combinations, URL whitelist/reset behavior, 56 filter scopes, exact annual/monthly/channel/attribution arithmetic, cumulative values, presentation invariants, synthetic-only mode and the 24-sheet map.
- Production build: passed, with the new route dynamic and authentication retained. Initial sandbox build was blocked by generated-output filesystem permissions; the permitted retry passed.
- Isolated browser test: **19 checks passed, zero browser runtime errors**. Includes desktop/mobile overflow, sidebar order, synthetic badge, accessible exact amount, global/local filtering, small-range axes, fixed-period titles, reload/back/reset and review-detail selection.
- Human-style visual inspection: desktop, mobile, light/dark portfolios, attribution, changes, budget and review priorities inspected. Small-axis rounding and hidden screen-reader bar values were found during independent review and corrected.

The browser harness renders the actual client components with an isolated browser-history substitute for Next. It contains only synthetic data, runs on loopback, and does **not** prove production authentication, real Next hydration, RLS or workbook reconciliation. Its files are under the ignored `work/pillar-c-ui-qa/`; no authentication bypass or test-only route was added to the application.

Screenshots and the browser receipt are local, outside the public application repository: `../outputs/pillar-c/ui-preview-20261013/`. Files include `01-desktop-overview.png`, `section-portafogli.png`, `section-attribuzione.png`, `section-variazioni.png`, `section-budget.png`, `section-priorita.png`, `section-fonti.png`, `02-budget-deviation.png`, `03-dark-portfolios.png`, `04-mobile-portfolios.png`, `05-mobile-budget.png`, and `visual-check.json`.

## Claude Code handover — connect only accepted workbook outputs

Continue the workbook independently. Do not replace source values, recalculate clinical allocation or change analysis contracts to fit these mockups. Do not import these fixtures into any database or claim the design review closes analytical gates.

Implementation anchors:

- `lib/dashboard-review/pillar-c/preview.ts`: isolated synthetic model, URL contracts, planned workbook map and UI eligibility predicate.
- `components/dashboard-review/pillar-c/workspace.tsx`: section composition and interactions.
- `components/dashboard-review/pillar-c/charts.tsx`: reusable visual treatments; current input type remains explicitly preview-only.
- `app/dashboard-review/pillar-c/page.tsx`: server-authorized preview entry point.
- `tests/pillar-c-preview.test.mjs`: numerical/UI-fixture invariants, not workbook acceptance tests.

For the real adapter, introduce a **separate server-side, release-bound contract**. Required fields include release/workbook digest; formula/contract version; source provenance; authorized scope; year/month coverage; channel and cost basis; attribution state; numerator/denominator and excluded amounts; units; missingness; and verification status. Preserve signed amounts, true zero versus absence, unavailable versus suppressed, and native scope. Never use demo values as a fallback when a real query fails.

Bind panels only when the corresponding workbook calculation and independent V2 verification pass:

| UI surface | Planned workbook sheets | What must be established first |
|---|---|---|
| Portfolio spending/composition/trends | 08, 09, 17 | Reconciled totals, accepted taxonomy, observed months, signed adjustments |
| Attribution/ambiguity/sensitivity | 05, 06, 07, 19 | Versioned mapping, local evidence versus proxy, exhaustive mutually exclusive coverage |
| Change contributions/strata/decomposition | 10, 11, 12 | Matched periods and scope; exact bridge; validated quantity units for any unit-cost/mix calculation |
| Comparisons and activity context | 13, 14 | Comparable numerator/denominator, aggregation definition, privacy-safe comparator policies |
| Budget/variance/forecast | 15, 16, 18 | Approved matching budget, revisions, actuals basis; adequate time series and out-of-sample forecast validation |
| Review priorities | 20 | Traceable signals, explicit materiality and confidence; no clinical prescriptions or automatic savings claims |
| Sources/validation/release lineage | 00–04, 21–23 | Source register, contracts, reconciliation, independent checks, frozen manifest and display map |

Before publishing actual results, run V1/V2 per-cell and per-filter reconciliations, real approved reviewer and ordinary Azienda sessions, negative access tests and pooled comparator disclosure/differencing tests. Build no comparator by delivering another organization's rows to the browser. Keep public-source-only pages separate from private workbook-derived results.

Forecast fans, standardized comparisons, cost/quantity/mix decomposition, product drill-down, real approved budgets and persistent action tracking are **not implemented by this preview**. Their readiness follows the evidence and workflow contracts, not the existence of a chart component. The planned dedicated comparisons section can expand from the present readiness panel once accepted evidence exists.

## Production status

Prepared for deployment of the synthetic preview only. Authenticated live acceptance and the final deployment revision must be recorded separately; local screenshots are not live-site screenshots. No production data change is needed.
