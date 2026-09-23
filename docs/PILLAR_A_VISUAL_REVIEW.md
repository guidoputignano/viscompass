# Second review and public flow visuals — 23 September 2026

Private integration remains paused by the owner's instruction. No private
workbook records are bundled in these charts and no database migration is made.

## Analytical scope

- Sankey: four reported public spending aggregates, two AIFA flows (direct
  purchases and convenzionata) into two families (J01 and J02A), for the chosen
  territory/year. This intentionally overrides family/flow selectors, stated
  beside the chart. Link thickness conserves source and destination totals.
- Waterfall: selected family/flow/territory, consecutive years. Q is reported
  packages, P is aggregate spending/Q. Symmetric effects are delta-Q times mean-P
  and delta-P times mean-Q. Their sum equals the spending change. P includes
  product/package mix and is not a pure purchase-price effect.
- Source blanks remain disclosed as missing. The charts describe reported
  numeric aggregates, not certified complete consumption. No blank is converted
  into an observed zero. Null, negative spending and nonpositive package totals
  suppress the corresponding bridge; nonfinite values are rejected.
- These public diagrams do not represent private AWaRe expenditure, DDD or
  patient transitions. The private workbook remains a separate review artifact.

## Verification

The five-file source audit was rerun: 1,316 rows and 240 independent CF/CMR/DDD
controls passed. Public annual/monthly, population, OSMED-edition and perimeter
tests passed. New visual tests cover conservation, same-period/scope checks,
missing inputs, duplicate composition keys and positive/negative effects.

All 792 available displayed waterfall combinations reconcile within EUR 0.01;
198 territory/year Sankey combinations are available. Native TypeScript checks
and webpack production build are required in addition to Node logic tests.
Two legacy activity-proxy fixture tests remain skipped; not reported as passes.

This review does not certify source truth against invoices, equivalence of
A2/A3, causal interpretation, clinical VEN, or previously paused RLS integration.
Production deployment is not part of this checkpoint.

Browser review confirmed the rendered Sankey and waterfall and switching between
2025 and 2017. Display labels round to whole euros; the UI discloses resulting
rounding differences. The reconciliation tests use unrounded values. The full
test run passed 16 tests with the two fixture skips noted above; TypeScript and
the webpack production build passed. Private integration remains unchanged.
