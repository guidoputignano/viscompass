# Pillar C portfolio management delivery

## Purpose and product boundary

Pillar B concerns biosimilar adoption, regulatory/local-use timing and comparable reference/biosimilar products. Pillar C concerns the entire pharmaceutical portfolio, contributions to expenditure change, attribution uncertainty and planning. A shared ledger is appropriate; the decision and evidence grain differ. This delivery adds a portfolio-centered management entry point while retaining existing analytical sections and bookmarks.

The dossier does not complete the original clinical-area budget objective. Single-portfolio membership is a draft ATC proxy, shared exposure is not local allocation, and neither establishes observed treated-person counts or approved budget ownership.

## Implemented contract

- Scope controls: portfolio, organization, complete year/matched January–May period, and channel. They affect only the dossier and its review-plan context.
- Exact single-portfolio spending and negative adjustments, separately from nonadditive shared candidate exposure.
- Monthly comparison with gaps for absent rows and genuine zeros for observed zero amounts.
- Product-level contributions, chronologically earlier to later regardless of which year is selected. Continuing/entered/exited refer to the selected portfolio grain, not patient movement or market entry. Contributions reconcile exactly to portfolio change.
- Shared-product evidence targets and conditional attribution ranges. No shared amounts are silently duplicated into fixed spending.
- User-controlled planning assumption on the single-portfolio component. This is neither a forecast nor an approved budget. Finite basis-point arithmetic is retained exactly, including display ties; shared candidate bounds stay conditional rather than becoming an allocation.
- Exportable review plan with named referent, proposed office/role, deadline, evidence reference, state and outcome. Resolution requires evidence plus an outcome; changing a resolved item requires reopening it.

## Review workflow boundary

No existing shared task table exists. This release therefore provides an **in-page draft with explicit JSON and spreadsheet-safe CSV download**, not cross-device storage, team assignment delivery or notifications. Drafts are isolated by portfolio, period, organization, channel and immutable source identity. There is no browser persistence or network submission. Closing a draft item cannot approve mapping or alter spending data.

A durable team workflow remains a separate implementation: organization-scoped cases, validated assignees, evidence references, audit history, server-enforced transitions and role/operational tests. Existing request/upload/objective tables are not repurposed to simulate these contracts.

## Data and access

New immutable aggregates are generated from the existing frozen ledger/classification and product dictionary outside this public checkout, at `outputs/pillar-c/portfolio-dashboard-20261018/`. An independent exact-Decimal implementation checks original workbook cost literals, every scope/portfolio, monthly and product groups, conditional bounds and chronological bridges. Private values and receipts must never be committed here.

The existing private bucket is reused with new immutable hash-addressed objects. The endpoint rechecks approved membership plus reviewer/admin access before cache or artifact access. Ordinary member access remains forecast-only. No fact import, mapping activation, production migration, membership, storage policy or release gate change is part of this delivery.

## Verification checklist

- [x] Independent source-cell and exact aggregate verification for all dossier scopes.
- [x] Fictional fixtures cover overlap, missing/zero, credits, altered classification, chronological changes, authorization and planning precision.
- [x] Review-plan validation and formula-safe exports.
- [x] Application views and real artifact loader independently reconciled across all portfolio scopes.
- [x] Full suite: 697 passing, eight explicitly skipped; no failures.
- [x] Final TypeScript compilation, changed-source lint and production build.
- [x] Private storage read-back hashes and anonymous denial for every staged object.
- [ ] Live reviewer scope/value/interaction reconciliation, snapshots and ordinary-role check limits recorded.

The final adversarial pass found empty fixed-part dossiers displaying zero change and zero contribution cards. The implementation now requires observed rows in at least one matched period before publishing that change, and preserves absent shared observations separately from observed zero values. Regression fixtures cover candidate-only portfolios.

Local browser use was disabled in Work settings at the final test checkpoint. No authenticated interaction, responsive screenshot or ordinary-member live test is claimed until browser access is restored. The existing role gates are covered by loader/route fixtures; those fixtures are not a substitute for a real account session.

Publication is limited to the evidenced scope. Observed local clinical-area expenditure, matched treated counts and compatible approved budget variance still need the corresponding local evidence; synthetic assumptions never satisfy those facts.
