# Pillar C analytical dashboard — integration checkpoint

15 October 2026. Implementation and local reviewer inspection, **not** an activated analytical release. No production migration, import, gate change or deployment is part of this checkpoint. The workbook-first acceptance gate remains closed.

## Implemented

The existing private `/dashboard-review/pillar-c` route now supports a narrowly typed analytical workspace, using the Pillar A section hierarchy and Italian interface:

| Section | Visualization | Controls and interpretation |
|---|---|---|
| Spending | Monthly bars / cumulative line, signed KPI cards, exact table | Organization, channel and local period. Partial years are explicit; absent months interrupt cumulative lines. |
| Accounting change | Signed, zero-centered contributions with opening/closing totals | Independent matched-period comparison. Accounting attribution only, not price, volume or clinical effects. |
| Budget planning | Two-key allocation dumbbells and budget reference marks; exact neutral differences | Independent budget period, published/modelled basis, organizational level, selected area and sort order. Presets choose supported scopes. No aggregation across hierarchy levels or organizations. |
| Count scenario | Denominator-sensitivity range and base point; exact table | Independent annual CO year and portfolio. Transported discharge-rate scenario, not observed distinct patients. No portfolio population summation. |
| Evidence | Per-section workbook outputs/ranges, source/method hashes and receipt identity | Scoped numerical checks remain distinct from pending independent/domain acceptance. Forecasts and unchecked analyses are excluded. |

Global organization/channel controls preserve local options. Copy, reset, browser Back and reload preserve the URL contract. The count scenario is expressly CO-only and does not pretend to follow another channel selection. Budget periods do not silently follow spending periods. Real zero, negative adjustment, missing month, unpaired allocation and unavailable ratio are separate states.

Budget allocations and count scenarios retain the recorded synthesized-component notes. Budget-perimeter equivalence is not asserted; differences do not establish over/underspending. Incomplete submissions are not described as certified complete years.

## Application boundaries

- `lib/dashboard-review/pillar-c/review.ts`: explicit review-only schema, allow-listed serialization, exact decimal arithmetic, cent rounding, filter parsing and selection. Conversion to `number` is used for chart coordinates, not financial reconciliation.
- `lib/dashboard-review/pillar-c/review-loader.ts`: server-only, approved project reviewer/admin inspection adapter. Membership and reviewer checks precede filesystem access. A byte-hash mismatch, invalid shape, absent configuration or private file located inside the public checkout cannot load data. Errors do not expose paths or bodies.
- `components/dashboard-review/pillar-c/analytical-workspace.tsx`: analytical presentation, accessible tables, local controls and provenance.
- `app/dashboard-review/pillar-c/page.tsx`: existing signed-in membership and reviewer checks retained. Ordinary Azienda users see preparation status, not this packet. `?vista=interfaccia` opens the separately isolated interface preview; it cannot raise privileges or activate analytical outputs.
- `tests/pillar-c-review.test.mjs` and `tests/fixtures/pillar-c-review.mjs`: invented fixtures only. No confidential ledger values or actual packet is committed.

The schema admits only `state: "review_only"`. Each section must carry its own named outputs, workbook ranges, source/method fingerprints, numerical receipt and `acceptance: "pending"`. There is no accepted boolean that silently promotes the whole workbook. Unrecognized fields, including forecast results, cannot hitchhike into the client payload.

## Local reviewer inspection configuration

Optional server environment variables:

```ini
PILLAR_C_REVIEW_PACKET_PATH=<absolute private packet path outside this checkout>
PILLAR_C_REVIEW_PACKET_SHA256=<sha256 of those exact bytes>
```

Set these privately in the server process or an ignored local environment file. Do not commit a packet, credential, workbook, extract or private screenshot. No configuration means a readiness view, never a generated-data fallback. The application builds without a private packet.

This local-file adapter is **not** a Vercel production-storage solution and does **not** replace database RLS. Private reviewer payloads are intentionally sent only to authorized reviewer sessions; private figures are not baked into static browser bundles or public routes. The isolated browser harness used for visual QA serves private data only on loopback and is not an authentication test.

## Verification checkpoint

Run the actual TypeScript compiler, targeted ESLint, the complete test suite, and `next build --webpack`. The production build checks compilation, not deployment. Node execution of TypeScript tests supplements rather than replaces the compiler.

The private evidence repository contains a read-only packet compiler and a separate adapter-parity check. They pin the immutable workbook and source-first expectations, compare supported filter results to the application selectors, and compare monetary display to a Python Decimal oracle. This is presentation/adapter parity, not a newly independent analytical or domain review.

Checkpoint results: actual TypeScript compiler and targeted ESLint pass; the complete suite passes 536 tests with 8 existing skips and no failures. Fourteen new tests cover the review contract, authorization boundary, malformed/tampered packets, decimal rounding, selector state, independent panel periods and missing/zero distinctions. The private adapter/display check passes 14,970 assertions; the component-browser check passes 25 checks with zero runtime errors.

Local browser checks exercise the actual React analytical components with a browser-history substitute: selectors, independent periods, presets, shareable state, Back/reload/reset, exact tables, evidence metadata, keyboard use, responsive layout and dark mode. These checks do not establish Next hydration, real account isolation, live latency or production acceptance. Keep the detailed receipts and screenshots in the private evidence directory.

## Claude Code parallel work — do not overwrite

Claude owns completing unchecked workbook outputs and resolving forecast fitting in the private evidence repository. The complete private mandate is `CLAUDE_CODE_PILLAR_C_WORKBOOK_COMPLETION_20261015.md`; coordination is in `PILLAR_C_PARALLEL_DELIVERY_PLAN_20261015.md` there. Preserve all original workbook versions and failed verification receipts. Do not change numerical definitions, taxonomy approvals, tolerances or model admission in this UI workstream.

The interface is intentionally limited to monthly spending, matched-period accounting changes, compared budget allocations and annual CO count scenarios. Composition/concentration, classifications, compatible benchmarks, unit/mix, anomalies, supported review priorities and forecasts require their own checked outputs before addition. A chart existing is not evidence of acceptance.

## Required before an analytical release

1. Receive Claude's per-output manifest: immutable workbook/source/method hashes, ranges, filter grain, periods, units, missing states, synthesis, numerical and qualifying independent-review receipts, domain status and audience.
2. Verify every newly supported output at its advertised interactive grain, including narrow filters and rendering. Never copy an acceptance claim from a previous workbook hash.
3. Implement an accepted private storage/RPC contract with RLS, per-output release admission and appropriate organization/reviewer scope. Preserve the separate public-source-only boundary. A local file path is not this backend.
4. Exercise actual Azienda, region, reviewer and anonymous sessions; comparator isolation, refresh/cache, failure, latency and rollback. Do not infer production RLS from the reviewer file gate.
5. Reconcile live plotted values and exact tables against accepted workbook cells; capture all final states. Record review dispositions, then authorize activation. Missing or failed outputs stay unavailable; they are not substituted with synthesized organization facts.

## Safe continuation

Inspect Git and private evidence state before resuming; workbooks and acquisition files may be owned by another session. Stage explicit implementation paths only. Keep application and private-evidence commits separate, and do not push a stale branch or private outputs to the public repository. A successful local build is not a deployment receipt.
