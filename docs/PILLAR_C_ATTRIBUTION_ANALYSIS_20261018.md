# Shared and uncertain therapeutic attribution

## Delivery boundary

The private Pillar C attribution section measures where attribution is shared or unresolved. It does not establish which local clinical area actually incurred expenditure. It uses the existing frozen draft portfolio mapping; no clinical acceptance, new indication mapping or equal/proportional allocation is implied.

The section replaces the previous generic attribution panel, without changing other analyses or the frozen R5 workbook. Its independent controls cover the available organizations, channels, complete years and matched January–May periods. The aggregate is explicitly the four organizations represented in the source, not a claim of complete regional delivery.

## Published analyses

- Attribution coverage: signed spending remains distinct from absolute exposure, so negative adjustments cannot conceal uncertainty.
- Product prioritization: ranked absolute exposure, cumulative concentration and the minimum number of product evidence entries covering at least 80% of the selected pool. The therapeutic pool and identifier-resolution pool are selectable separately. Search preserves the complete pool denominator and original rank. Distinct classifications for one product are retained rather than overwritten.
- Candidate-area ranges: fixed single-portfolio proxy plus conditional shared exposure, with a second selectable layer for unclassified cases. Negative adjustments are retained. These are non-additive bounds under the stated assumptions, not confidence intervals, probabilities, observed allocations or simultaneously attainable area totals.
- Matched-period comparison at constant mapping. No complete-year versus partial-year comparison.
- Searchable product evidence and clarification register, including full candidate labels and the local evidence required to resolve attribution.

Absent source records are not fabricated as zeros. Present zero-valued records remain in coverage. Missing local allocation remains unavailable, not zero.

## Verification and confidentiality

Money is summed from source decimal literals with integer precision of 10^-21 euro; rounding is for display only. An independent Decimal implementation checks the original workbook cost-cell literals, scope totals, status groups, candidate bounds and product amounts. A separate application check exercises every available scope and all priority pools. This qualifies the arithmetic, not independent clinical acceptance.

The private operator receipts and aggregates are outside this public checkout at `outputs/pillar-c/attribution-dashboard-20261018/`. They must not be committed here. The public source contains generic logic and explicitly fictional fixtures only.

Artifacts are immutable and hash-addressed in the existing private `pillar-c-review` bucket. The endpoint repeats current approval and reviewer/administrator authorization before every cached or uncached read, validates scope inputs, and sends private/no-store responses. Ordinary approved organization members retain their existing forecast-only access. No role, policy, release gate, source ledger or production fact import changes are part of this delivery.

## Release checklist

- [x] Original-source and independently implemented exact arithmetic verification.
- [x] All available application scopes and matched-period comparisons.
- [x] Generic fixtures for negative adjustments, missing versus zero, altered candidate sets, protected reads and precise concentration thresholds.
- [x] Static rendering with accessible finite range geometry.
- [x] All private storage objects uploaded and read back with exact hash checks; anonymous access denied on both object endpoints.
- [x] Final type and lint checks; full suite with no failures; production build passed. Existing unrelated skipped tests remain skipped.
- [ ] Deployed reviewer UI and endpoint reconciled to the frozen private artifacts.
- [ ] Screenshots and final release receipt.

The remaining clinical dependency is a compatible local allocation by indication, using structure or cost center, with amounts and definitions that reconcile. The analysis is useful before that dependency is supplied because it quantifies and prioritizes uncertainty, rather than claiming to have resolved it.
