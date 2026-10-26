# Upload validation and manual release boundary

The upload processor validates a supported hospital XLSX against the uploading
organization's configured region and source organization code, the source schema,
numeric/arithmetic rules and monthly coverage. Declared dates must contain the
whole months represented by the source. Other formats and unrecognized organization
configurations require manual review.

A validated file is **not** automatically reconciled with published analysis.
There is no admitted comparison contract that matches this extraction to an active
analytical release, period, organizational perimeter and cost basis. The processor
therefore makes no `canonical_fact` read and records that comparison as unavailable.
It updates only the particular upload's status and audit summary; it imports no
facts, publishes no release and changes no analytical gate.

The summary records the validator/processor version, source SHA-256, source and
declared coverage, validation result, available/quarantined amounts and reason for
manual comparison. An unavailable comparison has no reconciliation timestamp.
`ok: true` means the file was processed, not that it was reconciled. The existing
table cannot represent every processing outcome, so its column remains `uploaded`
while the detailed outcome is in `reconciliation_summary`.

## Interrupted attempts and recovery

Before reading bytes, processing clears any earlier reconciliation timestamp and
writes an explicitly unfinished marker. A detected failure records a review
requirement and clears the timestamp. Repeating processing of an immutable source
does not duplicate analytical data: this path writes no analytical records.

This is a synchronous processor, not a durable background queue. A process killed
between the initial marker and final write can remain `processing`; a database
write outage can prevent a final result being saved. The administrator must review
and rerun such records through an authorized server operation. Automatic retry,
job leasing and a new user-facing retry control are not implemented by this change.
If the initial marker cannot be saved, the processor does not download the file.

## Before admitting an automatic comparison

Register the exact source and canonical definitions, active release identifier,
tenant scope, covered months, channels, cost basis and treatment of adjustments,
duplicates and unresolved rows. Use a complete server aggregate or explicitly
verified pagination; missing values must remain missing. Independently reconcile
discriminating cases before permitting any `reconciled` result. A coincidentally
equal grand total is insufficient.

Existing uploads are not reprocessed by deployment. A separate, audited review of
historical records is required; this patch does not silently clear old records.
