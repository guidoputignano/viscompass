# Private Pillar A release `ddd-20261029`

**What it is:** release `closure-20260923` with three packs' DDD per pack corrected. Spending (CF, CMR, CN), quantities (QMR), the AWaRe classes, the activity denominators and the access rules are unchanged.

**Why:** on 29 October 2026 the DDD per pack of every product in the release was derived independently: the active-substance quantity in the pack, from AIFA's pack data, divided by the WHO DDD for the pack's ATC5 and route.

- **Agreement:** 98.4 % of spend matches the source's DDD per pack exactly, or up to the source's two-decimal rounding.
- **Corrected:** three packs did not match, and the owner decided to correct them in this release:
  - one pack counts its whole content as a single dose unit;
  - one pack uses a DDD different from every other pack of the same substance;
  - one product uses an earlier DDD where the WHO ATC/DDD Index gives a different one.
- **Not corrected:** a fourth difference, a tetracycline expressed as its tetracycline equivalent, is consistent with the WHO DDD and stays as supplied.

The pack identities, the values and the evidence are in the private evidence repository (`outputs/pillar-c/pillar-a-ddd-crosscheck-20261029`), not here.

## How it is built

`scripts/stage_private_pillar_a.mjs --ddd-corrections <private file>`, run from the Pillar A release worktree.

1. **The source is checked as supplied.** Every source file must match its hash, and the products must sum to every aggregate cell.
2. **The corrections are applied** (`lib/analytics/private-pillar-ddd-corrections.ts`). A correction applies only where the source still holds the exact value it was checked against, and it must find its pack. Each aggregate's DDD then moves by exactly its products' change.
3. **The corrected release is checked the same way:** A + W + R = T, and the products sum to every cell.
4. **The source hash covers the corrections as well as the raw files,** so the release states what it holds.

Without a corrections file the script regenerates `closure-20260923` byte for byte. This was checked on all four generated files.

The changes to DDD totals are below half a percent in every Azienda × year × AWaRe cell. The release's own reconciliation is re-run in the production database after loading, with the 27 checks of the 24 September activation (`lib/analytics/private-pillar-activation.ts`).

## Switching over

- **Load:** the rows of `ddd-20261029` are inserted beside those of `closure-20260923`. Inserts only; nothing is overwritten.
- **Switch:** the application reads one release, `PRIVATE_RELEASE` in `lib/analytics/private-pillar-a.ts`, so the deployment of this commit is the switch.
- **Rollback:** reverting the constant. The rows of `closure-20260923` stay in the database until the owner retires them.
