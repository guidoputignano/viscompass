# Pillar C analytical dashboard — integration checkpoint

15 October 2026. Implementation and local reviewer inspection, **not** an activated analytical release. No production migration, import, gate change or deployment is part of this checkpoint. The workbook-first acceptance gate remains closed.

## Subsequent owner-authorized deployment

The owner subsequently requested deployment of the available sections without a work-in-progress banner, while Claude continues the other workbook outputs and fitting. This authorizes live reviewer inspection of the existing numerically checked subset; it does not silently promote its formal acceptance state or publish private figures anonymously. The general progress banner and incomplete-roadmap cards were removed. Per-measure source, synthesis and scope labels remain, with detailed lineage in the source accordion.

`review-storage.ts` adds a pinned private Supabase Storage artifact as the deployed server source. The bucket is private; direct anonymous and authenticated-reviewer downloads were exercised and refused. The approved reviewer/admin check runs before the server-only service download. Raw-byte SHA and strict section schema checks are unchanged. No data was added to canonical fact tables, no analytical gate was switched and no DDL was applied. The application reuses its existing server-side Supabase configuration; no private packet is committed or included in static assets.

An explicitly configured local file still takes precedence for local inspection and fails closed if invalid. Otherwise the loader reads the fixed immutable storage object. The previous local-file-only limitation below describes the initial checkpoint, not this later storage connection. Future accepted Azienda/region analytical consumption still requires its own RLS-scoped output contract, not broadening this reviewer service read.

The owner's subsequent section-selector polish adds distinct icons, concise descriptions, a teal active card, restrained hover treatment and scroll-aware `aria-current`. Native fragment links preserve filters, browser history and keyboard navigation without fetching analytical data. The navigator is sticky only on wide desktop; section offsets protect headings, and mobile remains in normal flow. A Pillar C-only shell overflow correction uses `clip` instead of `hidden` so desktop sticking follows the document; other pages retain their original shell classes. Data, roles and the stored artifact are unchanged.

Deployment preparation checks: 16 Pillar C review tests pass; the full suite has 538 passes, 8 existing skips and no failures; targeted ESLint and the optimized production build pass. The actual server loader successfully verifies the private remote artifact. Live Next.js checks and deployment identity must be recorded separately after the push; preparation is not a deployment-success claim. Existing approved identities are reviewers, so an approved non-reviewer session is not currently available for a distinct live negative test; no account or membership is created to imply otherwise.

## R5 update: review contract v2 and the regional forecast section

The R5 review packet (workbook R5) uses schema `pillar-c-review-v2`. It carries the four R4 sections unchanged and adds a regional forecast section. The production pin in `review-storage.ts` moves to the immutable object `r5/fd09373fafeb5ef2c9acd1788504bac2c911c7d33a828b956e584f4b820d93df.json` with that SHA-256. The bucket, the approved reviewer/admin gate before any read, the raw-byte hash check and the 5 MB cap are unchanged. The R4 object stays in the bucket untouched. The parser and the pin must ship in the same deploy: the previous parser rejects a v2 packet, so a pin change on its own would make the reviewer page show the integrity-failure state.

**What the forecast is.** It is an AIFA tracciabilità forecast built from public regional data. It is not an Azienda forecast, a budget, a ceiling or a clinical estimate. Series TOT, A and H are admitted with ARIMA(0,1,1)(0,1,1)12. Class C is rejected, and the page shows the decision and its registered reason, never a forecast. Each admitted series shows a monthly 2026 point with 80 % and 95 % intervals, plus the 2025 observed months for context. The annual total is labelled «supplementare, non sottoposto a backtest». The fixed label «Fonte pubblica · AIFA (CC BY 4.0) · previsione regionale, non aziendale» is required verbatim, and a one-line note says the forecast is not an Azienda forecast, budget or ceiling. The state shown is «in revisione · accettazione in attesa». No part of the page displays «Verificato». The packet's AIFA attribution (source, licence and «Elaborazione VIS» as the modification notice) is shown with a link to the CC BY 4.0 licence deed and a link to the AIFA source page, as CC BY 4.0 §3(a)(1) asks; the licence is named once.

### Contract (`lib/dashboard-review/pillar-c/review.ts`)

- **Schemas.** `pillar-c-review-v1` is still accepted, so the R4 packet parses on the local-file path. In v1 the forecast section is optional, and validated in full when present. In v2 it is required. A forecast section requires its own lineage row and `evidence.forecast`; without one, the v1 four-section contract is unchanged.
- **Closed v2.** In v2, an unknown key anywhere (top level, evidence, lineage, carried rows, any level of the forecast section) fails with `PILLAR_C_PACKET_UNKNOWN_FIELD`. In v1, unknown keys are still dropped. Both versions serialize only explicitly picked keys, so forecast fields reach the client only through the validated forecast section.
- **New evidence pins (required in v2, optional in v1; 64-hex when present).** `financialR5Review`, `budgetCountR5Review`, `forecast`, `forecastInputs`, `forecastWorkbookIntegration`. A missing pin in v2 fails with `PILLAR_C_PACKET_MISSING_FIELD`.
- **New lineage keys (required on every row in v2, optional in v1).** `crossSystemReceiptSha256` must equal the section's cross-system pin: `financialR5Review` for spend/change, `budgetCountR5Review` for budget/counts, `forecastWorkbookIntegration` for the forecast. `workbookSha256` must equal the packet's workbook hash. In any schema, a row whose state is `cross_system_pass` must carry `crossSystemReceiptSha256`, so «controllo incrociato fra sistemi superato» is never shown without the receipt behind it.
- **Forecast lineage row.** `numericState: "cross_system_pass"`, `verification: "cross_system_codex_v2"`, `claim: "regional_public_forecast"`, `acceptance: "pending"`, outputs `ML-5-ADM` and `ML-5-FC`, and `receiptSha256` equal to `evidence.forecast`. The R4 sections keep their states.
- **Forecast section.**
  - `region` must be `Abruzzo` and `scope` must be `regional_public_forecast`.
  - Labels have an exact key set. The fixed forecast label, `tier: "Fonte pubblica"`, `tierState: "V2_IN_ATTESA"`, licence `CC BY 4.0` and amendments that include ML-A15 and ML-A17 are all required. Packet copy may not contain «verificat…», «demo» or «dimostra…».
  - Admission has exactly four series, TOT, A, H and C. Each has the two variants and the two candidates.
  - `admitted` must equal "no failed conditions". The conditions that can be decided from carried values must agree with the carried outcome: MASE against its threshold, 80 % coverage in [0.70, 0.90], and Winkler against the baseline.
  - An admitted series uses the registered ARIMA model, admitted in every variant. C can never be admitted.
  - Monthly and annual rows exist only for admitted series. Each admitted series has exactly the months 2026-01 to 2026-12, in order.
  - Amounts are cent decimal strings. Bounds satisfy `low95 <= low80 <= point|total <= high80 <= high95`, checked by exact scaled BigInt comparison. Sigma is greater than 0.
  - Observed 2025 rows have 12 months per carried series, and every admitted series must have them. `rowsValued + rowsMissing = rowsSource`. A month with no valued row is `null`, never zero.
- **Annual total (deliberate, see the private verifier finding R5V-02).** `monthlyPointsSum` must equal the exact sum of the twelve carried cent points. `total` is the single cent rounding of the sum of the *unrounded* points (producer output and workbook 18A), so the contract requires `|total − monthlyPointsSum| <= 0.06`, the bound for 12 half-cent roundings. It does not require `total == Σ cents`. On the R5 packet the TOT and A totals differ from the cent sum by a few cents and H matches. The page shows both figures and says the difference is rounding only.

### Interface (`components/dashboard-review/pillar-c/forecast-section.tsx`)

- **Navigation.** The new section is `previsione`, number 05. Evidenza moves to 06 and stays last. The navigator grid is six columns on wide desktop and two or three columns elsewhere.
- **Selector.** The series selector (Totale, Classe A, Classe H) is shareable URL state `c_forecast_series`, with TOT as the default. C and unknown values fall back to TOT. The selector keeps all other panel parameters, Back and reset. The forecast ignores the Azienda and channel filters, and they ignore it.
- **Chart.** A recharts chart shows the 2025 observed line, the dashed 2026 point line, and the 80 % and 95 % bands in a single hue, plus a forecast-start marker. A tooltip gives exact cents. The chart has an accessible figure caption and pointers to the exact table. The bands' opacities rise on the dark card and the legend swatches read the same values; a 1px card-coloured halo under the dashed point line separates it from the band of the same hue.
- **Exact table.** It lists month, point, 80 % and 95 % intervals, observed 2025, and valued-row coverage. It ends with the sum of the 12 cents and the supplementary annual total with its intervals.
- **Admission table.** All four series, each with its reason. C is shown as «Non ammessa» with its registered reason. The packet's C fallback text is not rendered, because it promises an observed C table the packet does not carry (R5V-04). Its reason is introduced as «Motivo del rifiuto (registrato):» and kept verbatim. A non-admitted candidate reads «non ammesso (condizione non soddisfatta: …)», through the packet's condition labels; the packet's raw `registeredReasons` codes are not rendered.
- **Translation safety.** Everything the selector changes renders inside `SeriesView`, a keyed element that is the only child of its wrapper, as with `Fresh` in Pillar B. The tooltip root is keyed as well. In the rest of the workspace, every text that follows a filter, a count year or a state (the scope line and its status, the modelled-plan preset, the area and portfolio counts, the per-person values and the copy button) is a single text child or a keyed element; a source pin rejects literal text next to such an expression.
- **Reading the figures (review round 1).** The annual cards follow the monthly chart, in the secondary style, and every card names itself: «Previsione regionale · totale annuo 2026 · <serie>» and «Intervallo annuo 80 % (95 %) · supplementare, non sottoposto a backtest». A fixed note under the chart says that «Osservato 2025» sums only the rows with a valued spend cell (blank rows are missing, never zero, and are not estimated), that the forecast uses the same base, and repeats the packet's observed-series note with the provisional snapshot date; the legend and table say «Osservato 2025 (provvisorio)» and the 2025 tooltip gives the valued rows. The panel says the forecast was made with data to December 2025 and contains no observed 2026 data. A fixed line by the selector says class C has no forecast and that the total minus classes A and H is not a class C forecast. A no-break space joins every number to its «%», in fixed copy and, for display only, in packet copy.
- **Wording.** The empty states of the R4 sections no longer describe the packet as «verificato»; they now say «pacchetto di revisione».

### Verification (15 October 2026, working tree on top of `3d58b9a`)

- **Compiler and lint.** `npx tsc --noEmit` passes. ESLint passes on every changed file. A full `eslint .` reports only pre-existing errors in untouched files and the ignored `work/` harness directory.
- **Tests.** The full suite reports 557 tests: 549 pass, 8 existing skips, 0 failures. The Pillar C files have 39 tests, using invented fixtures only. They cover:
  - the v2 fixture passing;
  - mutations: bound order, the annual-sum rule, rows for rejected C, an 11-month series, labels, claims, receipts, admission consistency, unknown fields, schema and state;
  - the v1 R4 shape;
  - the r5 storage pin;
  - selector and URL behaviour;
  - translation-safety pins;
  - a no-«verificato» pin across the page sources.
- **Build.** `npm run build` passes.
- **Private render check.** A private check renders the shipped components with the real R5 packet: server markup, a jsdom client mount, and headless screenshots of static files. Every month of every admitted series matches an independent formatter. The receipt is in the private evidence repository. It is not a Next hydration, live-session or RLS test.

### Review round 1 (16 October 2026, same working tree)

Findings R5CR-01 to R5CR-05 (contract and tests) and MC-01 to MC-10 (copy and interface) are fixed in the app; the packet bytes and the storage pin are unchanged. PRIV-01 (ledger amounts already in public files from September and early October) is left to the owner, outside the R5 change.

- **Tests.** The full suite reports 566 tests: 558 pass, 8 existing skips, 0 failures. The Pillar C files have 48 tests. Expected forecast errors are matched exactly, never as a prefix. New cases cover: class C admitted with every candidate passing and the row caps free; each admission check on its own (model admitted in every variant, each flagged-but-passing and failing-but-unflagged condition, negative metrics, coverage above 1); the inclusive bounds 0.70 and 0.90; every v2 evidence pin and lineage key; the copy rules above; and the translation pins.
- **Mutation check.** In a scratch copy, each of twelve parser mutations (the C guard, the non-negative metric guard, the coverage cap, each of the three condition checks, «admitted in every variant», exclusive coverage bounds, the three v2 requirements, the annual tolerance) makes the suite fail; the unmutated copy passes.
- **Compiler, lint, build.** `npx tsc --noEmit` passes. ESLint reports no problem in any changed file; a full `eslint .` reports only errors in five untouched files and in the ignored `work/` directory. `npm run build` passes.
- **Private render check, round 1.** The private harness renders the shipped components with the real R5 packet and checks the new copy, links, chart marks and a whole-workspace translation scenario (Azienda, count year, budget order and series changes): nothing stale. The same scenario run on the pre-fix workspace shows stale text at every step. Receipt in the private evidence repository; not a Next hydration, live-session or RLS test.

### Review round 2 (16 October 2026, same working tree)

The only finding is PRIV-01, and it does not change R5. The amounts it names were already in public files at `3d58b9a`, among them `AGENTS.md`, `CLAUDE.md`, `docs/CODEX_HANDOVER_20260924.md`, the two Pillar B release documents of 2 October and a code comment in `lib/uploads/gold-file.ts`. None of them is in the R5 diff. On 3 October 2026 the owner decided to leave the already-published figures as they are, the `AGENTS.md` gold-file figures included: the repository stays public and its history unchanged (`docs/PILLAR_B_HANDOVER_RECEIPT_20261002.md`, item 1). Any later redaction at HEAD, or any action on history, is the owner's to decide, in a separate commit.

- **No new exposure.** A scan covered every line added since `3d58b9a`, plus the untracked forecast component. It reduced each numeric token to its digits, whatever the separators, and compared the result with every value in the R4 and R5 packets, in integer, rounded and cent forms. Nothing matched. As a positive control, packet values written in Italian, English and narrow-no-break-space formats were added to the scan, and every one was found. Every four-digit or longer number added by R5 is a year, a fragment of a hash, a test bound or an invented fixture value. A scan of the production build output (`.next/static` and `.next/server`) for every packet amount with six or more integer digits, in cent form, found none.
- **Unchanged.** The packet bytes and the storage pin are the same as in round 1. The private verifier was not re-run, because its input did not change.
- **Checks.** `npx tsc --noEmit` passes. The full suite reports 566 tests: 558 pass, 8 existing skips, 0 failures. `npm run build` passes. ESLint reports no problem in any changed code file. A full `eslint .` exits with errors, all of them in five untouched files and in the ignored `work/` directory.

## Implemented

The existing private `/dashboard-review/pillar-c` route now supports a narrowly typed analytical workspace, using the Pillar A section hierarchy and Italian interface:

| Section | Visualization | Controls and interpretation |
|---|---|---|
| Spending | Monthly bars / cumulative line, signed KPI cards, exact table | Organization, channel and local period. Partial years are explicit; absent months interrupt cumulative lines. |
| Accounting change | Signed, zero-centered contributions with opening/closing totals | Independent matched-period comparison. Accounting attribution only, not price, volume or clinical effects. |
| Budget planning | Two-key allocation dumbbells and budget reference marks; exact neutral differences | Independent budget period, published/modelled basis, organizational level, selected area and sort order. Presets choose supported scopes. No aggregation across hierarchy levels or organizations. |
| Count scenario | Denominator-sensitivity range and base point; exact table | Independent annual CO year and portfolio. Transported discharge-rate scenario, not observed distinct patients. No portfolio population summation. |
| Regional forecast (R5) | 2025 observed line, 2026 monthly point with 80 %/95 % bands; exact table; four-series admission table | Public AIFA regional data, not an Azienda forecast, budget or ceiling. Series selector only; C rejected with its reason; annual total supplementary, not backtested. See the R5 section above. |
| Evidence | Per-section workbook outputs/ranges, source/method hashes and receipt identity | Scoped numerical checks remain distinct from pending independent/domain acceptance. Until R5, forecasts were excluded; unchecked analyses still are. |

Global organization/channel controls preserve local options. Copy, reset, browser Back and reload preserve the URL contract. The count scenario is expressly CO-only and does not pretend to follow another channel selection. Budget periods do not silently follow spending periods. Real zero, negative adjustment, missing month, unpaired allocation and unavailable ratio are separate states.

Budget allocations and count scenarios retain the recorded synthesized-component notes. Budget-perimeter equivalence is not asserted; differences do not establish over/underspending. Incomplete submissions are not described as certified complete years.

## Application boundaries

- `lib/dashboard-review/pillar-c/review.ts`: explicit review-only schema, allow-listed serialization, exact decimal arithmetic, cent rounding, filter parsing and selection. Conversion to `number` is used for chart coordinates, not financial reconciliation.
- `lib/dashboard-review/pillar-c/review-loader.ts`: server-only, approved project reviewer/admin inspection adapter. Membership and reviewer checks precede filesystem access. A byte-hash mismatch, invalid shape, absent configuration or private file located inside the public checkout cannot load data. Errors do not expose paths or bodies.
- `components/dashboard-review/pillar-c/analytical-workspace.tsx`: analytical presentation, accessible tables, local controls and provenance.
- `app/dashboard-review/pillar-c/page.tsx`: existing signed-in membership and reviewer checks retained. Ordinary Azienda users see preparation status, not this packet. `?vista=interfaccia` opens the separately isolated interface preview; it cannot raise privileges or activate analytical outputs.
- `tests/pillar-c-review.test.mjs` and `tests/fixtures/pillar-c-review.mjs`: invented fixtures only. No confidential ledger values or actual packet is committed.

The schema admits only `state: "review_only"`. Each section must carry its own named outputs, workbook ranges, source/method fingerprints, numerical receipt and `acceptance: "pending"`. There is no accepted boolean that silently promotes the whole workbook. Unrecognized fields cannot hitchhike into the client payload; since v2, forecast fields enter only through the validated forecast section (see the R5 section above).

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

The interface is intentionally limited to monthly spending, matched-period accounting changes, compared budget allocations and annual CO count scenarios. Composition/concentration, classifications, compatible benchmarks, unit/mix, anomalies, supported review priorities and forecasts require their own checked outputs before addition. A chart existing is not evidence of acceptance. (R5 added the regional public-data forecast on that basis: its own cross-system receipt, a pending acceptance state and the v2 contract above.)

## Required before an analytical release

1. Receive Claude's per-output manifest: immutable workbook/source/method hashes, ranges, filter grain, periods, units, missing states, synthesis, numerical and qualifying independent-review receipts, domain status and audience.
2. Verify every newly supported output at its advertised interactive grain, including narrow filters and rendering. Never copy an acceptance claim from a previous workbook hash.
3. Implement an accepted private storage/RPC contract with RLS, per-output release admission and appropriate organization/reviewer scope. Preserve the separate public-source-only boundary. A local file path is not this backend.
4. Exercise actual Azienda, region, reviewer and anonymous sessions; comparator isolation, refresh/cache, failure, latency and rollback. Do not infer production RLS from the reviewer file gate.
5. Reconcile live plotted values and exact tables against accepted workbook cells; capture all final states. Record review dispositions, then authorize activation. Missing or failed outputs stay unavailable; they are not substituted with synthesized organization facts.

## Safe continuation

Inspect Git and private evidence state before resuming; workbooks and acquisition files may be owned by another session. Stage explicit implementation paths only. Keep application and private-evidence commits separate, and do not push a stale branch or private outputs to the public repository. A successful local build is not a deployment receipt.
