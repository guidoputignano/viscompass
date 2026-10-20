# Pillar C recommendation 5: combined-code verification

20 October 2026. Code integration only; no production access is activated by this receipt.

## Combined sources

- Scoped delivery: `f3d439c041693e03305bc6f14c1cda1ba0d7c903`.
- Production main: `99a53fb185650de71eefe4248ac72d571bf47202`.
- Integrated on `pillar-c/rec5-scoped` with a conflict-free merge. Both histories are preserved.

The main registration, access-request validation and upload-hardening paths are unchanged. Users explicitly request a regional or organizational account; the choice grants no access. Scoped delivery still derives from live approved membership, database rollout and session-bound Storage RLS.

The only integration cleanup in the onboarding test removes unused destructured variables while preserving its legacy-client assertion. The operator steps in the private evidence folder were corrected to match the account-type controls and absence of an automatically selected organization.

## Checks actually performed on the combined tree

- Full suite with bounded concurrency outside the Windows sandbox: **948 tests, 940 passed, 8 existing skips, zero failures**.
- Focused onboarding suite: **16 passed**, zero failures/skips.
- Scoped lint over the changed application and test sources: zero errors or warnings after test cleanup.
- `next build --webpack`: compilation, TypeScript, all 40 static pages and route generation succeeded, exit 0.
- Independent combined-source review: no release-blocking regression found in onboarding, upload confinement, scoped authorization or private-artifact handling.
- Diff whitespace checks passed; no unresolved merge conflict.

These are local checks, not authenticated production acceptance. Earlier scoped and database checks are recorded in the scoped-delivery document and private evidence; their counts overlap this suite and are not additional unique test coverage.

## Local verification environment

The worktree's dependencies are a junction into a sibling checkout. Default Turbopack refuses that path outside its inferred filesystem root, so the local production build uses the supported Webpack option without changing project build configuration. The sandbox also blocked generated build folders and caused a native runtime crash during a local database harness. Outside the sandbox, the isolated database test and the bounded complete suite passed.

The build emitted `dashboard_fact_prefetch_error` notices but completed successfully. No runtime fact-retrieval success or authenticated page performance is inferred from build success.

## Production state and remaining gates

The previous production deployment remains unchanged by this integration. No scoped migration, data upload, rollout row, membership or reviewer configuration was modified. The latest available scoped production receipt is the read-only precheck, not a post-apply or account-isolation receipt.

The browser connection currently refuses access before reaching the website. The configured direct database connection also rejects authentication (`28P01`). No secret is printed or copied into this repository, and no alternative credential/session bypass is attempted.

Next, in the order of the reviewed operator plan:

1. Restore an authorized production operator connection and rerun the read-only precheck.
2. Apply and verify the dormant scoped-storage migration; preserve default-off rollout.
3. Run the owner-controlled pinned upload and verify every object and default-off behavior.
4. Deploy the integrated application and verify reviewer and forecast-only regression.
5. Complete the approved controlled-account tests, including scope isolation, direct Storage operation refusals, exports, revocation and kill switch.
6. Enable a real production audience only after the documented acceptance and governance prerequisites. No broad `all`-mode activation is implied by this code integration.

National/interregional Pillar C views and extension of reviewer-only capabilities remain separate deliveries. The initial scoped release covers only the documented organizations and region; this receipt does not claim broader data coverage or clinical-area budget completion.
