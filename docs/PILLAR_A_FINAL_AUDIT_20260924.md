# Pillar A final-audit checkpoint — 24 September 2026

**Status: NOT fully closed.** This supersedes completion claims in earlier
handover notes. Preserve the existing approved access model; no memberships,
admin roles, clinical assignments or source values were changed in this audit.

## Independently verified

| Item | Evidence and result |
|---|---|
| Live private import | Supabase SQL result grid: 48 aggregate and 1,316 product rows for `closure-20260923` |
| Product identity | Live SQL: 238 distinct AICs, 64 ATC5 codes; zero malformed AIC/DDD-product mismatches |
| Cross-grain arithmetic | Live full outer join of org/year/AWaRe cells: zero CF, CMR or DDD discrepancies (money to cents; DDD to four decimals) |
| Security configuration | All three private tables have RLS enabled and forced; zero INSERT/UPDATE/DELETE/TRUNCATE grants to anon/authenticated |
| Actual isolation sessions | Prior agent reports 15 passes. Not independently rerun in this checkpoint; configuration checks alone do not prove isolation |
| Missing inputs | Live SQL: VEN mapping 0 rows; canonical facts 0 rows |
| Local source agreement | Staging verifies source SHA-256 hashes and all product/aggregate totals; generated 48 and 1,316 rows successfully |
| Regression tests | 85 tests: 83 pass, 2 optional-fixture skips, 0 fail |
| Production public page | Browser loaded public series, ranking controls, province labels, activity explanation and ATC4 views; no bulk-download card |
| Remote code | `git ls-remote` confirms main and release branch both at `8fddb2a`; activation `1bb357d` and hardcoding `dbf2a2b` are local, not pushed |

## Fixes made in this checkpoint

1. Added a server-rendered product section to the existing private antibiotic
   dashboard: product ABC chart/table and ATC5 spending series plus CF/DDD table.
   Reads use the user's session and database RLS, additionally constrained to
   the primary membership's scope. Stable 500-row pagination avoids truncating
   the 1,316-row regional release. Reconciliation and source-version checks
   precede rendering; CN is not presented as a defined cost basis.
2. Connected the existing tested analytical functions rather than duplicating
   formula implementations. Previously no application component called them.
3. Hardened reconciliation: non-finite inputs/tolerances rejected; missing costs
   cannot certify a zero total; matching canonical totals cannot conceal a
   conflicting declared total; whitespace cannot evade duplicate detection.
4. Hardened product reconciliation for orphan products, missing years and
   non-finite aggregate totals. Added regression cases.
5. Added product import generation to `scripts/stage_private_pillar_a.mjs`.
   It produces ignored `private-product-facts.json` and
   `private-product-import.sql`, with source checks and no-overwrite guard.
   Generated SQL was NOT executed: the live release already exists.
6. Ignored Python caches and corrected stale AGENTS/VEN documentation.
   Upload success text now states storage succeeded but automatic reconciliation
   is not active.

## Remaining acceptance gates — do not erase these to claim closure

| Area | Exact remaining work |
|---|---|
| Upload processing | `reconcileUpload` is still a no-op. Implement authenticated storage-object retrieval, gold-file parsing/preflight, org/period validation, durable quarantine/report, authorized server-side status writes, retry/idempotency and integration tests. An empty canonical table is NOT the only gap. File-internal checks can operate without it. Do not mark stored uploads reconciled |
| Canonical comparison | Load only a separately validated canonical dataset with documented units/scope. Do not substitute antibiotic product facts for the broader gold-file canonical contract |
| VEN workflow | Pure functions/table exist, but no scoped submission/independent-approval UI or dashboard read path. Current table lacks an organization/perimeter field: add scoped/versioned design before admitting local lists. Never infer V/E/N from AWaRe or ABC. Approved clinical assignments remain external input |
| Private visual/access QA | Sign in to VIS as approved ASL/regional users, verify own-org versus regional results and the new product controls, missing-year rendering and mobile layout. Supabase login is not a VIS session |
| Deployment | Complete private QA/build, commit reviewed changes, push the intended deployment ref, verify actual production revision and logged-in results. Local activation alone is not deployment |
| Workbook acceptance | Existing workbook/guide are retained in ignored `private-staging/closure/deliverables/`. This checkpoint did not re-render every sheet or re-audit all document feedback; retain that acceptance item rather than claiming this code audit certifies the workbook |

## Reproduction and continuity

Repository: `C:/Users/HP/Documents/ChatGPT/Vis Gamma/viscompass-pillar-a-release`.
Branch: `release/pillar-a-public-20260920`. Do not reset sibling worktrees.

Run `node --test`, `node node_modules/typescript/bin/tsc --noEmit`, and
`node node_modules/next/dist/bin/next build --webpack`.
Run `node scripts/stage_private_pillar_a.mjs` only with the verified local
source package and derivatives available. This regenerates ignored staging
files, not database rows. No private data belongs in git or public assets.

The source manifest digest is
`ecd1f82bbe2c15f3fed91ed50edec169e98622bf3f9df17587ace7d378e7bedd`.
Private inputs remain in `data/raw/pillar-a-drive-20260922/`; derivatives and
the manual guide remain in `private-staging/closure/`. Those inputs must be
supplied securely to a different machine; cloning git alone is insufficient.
