# Pillar B live release verification — 2 October 2026

## Outcome

`PILLAR-B-R2-20261001` is active in production. The signed-in approved
Azienda 201 page `/dashboard-review/revisione-pillar-b` rendered all three
sections without a `57014` timeout after application commit `11dd3a0` and
the single-call molecule RPC migration. The frozen 261,153-row ledger was
**not re-imported** during this continuation.

## Evidence

- Production release gate: one row, `PILLAR-B-R2-20261001`, confirmed in the
  Supabase SQL editor after the live checks.
- Production-style authenticated query for Azienda 201: 23,545 rows in 2025,
  one distinct Azienda, and `round(sum(total_cost_eur), 2) =
  €100,675,853.35`. The raw numeric sum has a sub-cent floating-source tail;
  the published euro figures and frozen workbook reconcile at cent precision.
- Live page stage 1: 23,545 and €100,675,853 (whole-euro display). Stage 2:
  23,399 and €100,534,922. Stage 3: 1,666 and €9,714,149. Stage 4: 1,317
  and €7,491,866. The 2024/2025 totals displayed are €100,330,941 and
  €100,675,853; the page reports +0.3% and +€344,912.
- Uptake section: seven published groups, €7,406,762 / 1,288 rows withheld,
  43.8% of the measure's perimeter; 56.2% measure coverage. Quantity basis,
  partial uptake, negative adjustments and the 2026 exclusion are visible.
- Concentration section: 1,051 2025 molecule groups, top-five share 11.2%,
  total €100,675,853. The full molecule RPC returned 7,131 groups for 2025
  and 7,297 for 2024 under a simulated Region JWT within an 8-second local
  statement timeout; this is a backend check, **not** a Region browser login.
- Independent Gate 4 harness rerun: 37 passed, 0 failed against frozen JSONL,
  including all channel values, year totals, molecule partition, ASL/Region
  scope and pending/anonymous denial.
- TypeScript and 300-test suite: 292 passed, 8 skipped, 0 failed. Production
  `next build --webpack` completed successfully after deployment.
- Live `/dashboard-review/spend` and `/dashboard-review/dati` rendered without
  a 2026 headline, zero-package claim, or RangeError. The old
  `/dashboard-review/biosimilar-to-euros` page explicitly refuses to publish
  pre-comparability calculations and links to the new review. Public `/pillar-a`
  rendered independently. The Azienda benchmark displayed one authorized
  territory and explicitly declined to present it as a real comparison.

## Scope and residual quality notes

- The live authenticated browser check used the approved Azienda 201 account.
  Region-level browser appearance and other Azienda accounts remain untested;
  the Region RPC and isolation were tested at database/harness level.
- The older executive, benchmark and lineage surfaces show 0% `€/mg`/`€/DDD`
  normalization and no ATC categorization for the imported Pillar B ledger.
  Those are disclosed as unavailable, not calculated as zero clinical effect.
  They remain product-completeness work, not a reason to claim a package,
  unit-cost, saving, or full-coverage uptake result.
- Screenshots of the signed-in live review are retained under
  `outputs/pillar-b/screenshots/` outside the application repository. They
  contain non-public Azienda data and must not be published publicly.
