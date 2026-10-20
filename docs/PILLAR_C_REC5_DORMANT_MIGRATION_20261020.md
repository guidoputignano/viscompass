# Pillar C scoped delivery: dormant production migration receipt

20 October 2026, Europe/Rome. **Migration applied; rollout remains off.**

The owner expressly approved applying only migration `20261020120000` to the production Supabase project. The approval did not include uploading private data, enabling users or changing reviewer privileges. The application remains on its previous production deployment; the integrated scoped application is on `pillar-c/rec5-scoped`.

## Execution and verification

- A fresh read-only precheck passed before execution. It confirmed the target objects were absent and pinned the existing Storage policies and function definitions.
- The complete migration was compared with the local source in the visible SQL editor before execution. Its SHA-256 was `bdb497540e7363041f84f6fc8dd6025cc4404e9406881517803909dda5e94852`.
- The SQL editor returned **Success. No rows returned**. The migration was not rerun.
- All post-apply verification parts passed: private JSON-only bucket, exact authenticated SELECT policy, hardened helper, restricted table grants, forced rollout-table RLS and refusal of signing, copy and move operations.
- Existing Storage table properties and function fingerprints were unchanged from the fresh precheck. No unrelated policy was added or altered.
- The scoped bucket and both rollout tables are empty. The editor has no entitled unit.
- The reviewed rollback-only approved-member sweep passed with no failure and no member entitled to a scoped unit. It also found no signable or copyable object under the tested operation settings. Its final intentional exception forces rollback.

The private evidence directory `outputs/pillar-c/rec5/receipts/` holds the fresh `PRECHECK_CODEX_20261020.json`, `MIGRATION_CODEX_20261020.json` and `DEFAULT_OFF_SWEEP_CODEX_20261020.json`. Screenshots are stored privately alongside the Pillar C review evidence. No private ledger, member identifiers or privileged credential is included in this public receipt.

## What this does not prove

The bucket is empty and nobody is enabled. Database role impersonation is not a real user's Storage HTTP session. This checkpoint therefore does **not** establish enabled-account isolation, direct download/list/search/sign/copy/move behavior, live scoped exports, revocation or the organization kill switch. Those remain mandatory controlled-account checks before any real member is enabled.

The next gate is the owner-controlled, pinned private-data upload, with readback verification and default-off proof. Deployment, controlled-account rollout, governance acceptance and cleanup remain separate gates under the operator plan. Do not activate broad access or change reviewer privileges based on this receipt.
