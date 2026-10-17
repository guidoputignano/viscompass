# Ordered dashboard remediation — 16 October 2026

Owner mandate: presentation first, populated Budget default, performance,
consistent reviewer scope, then housekeeping. The additional explicit requirement
is to remove **Explore the workbook** and never display spreadsheet formulas.
The frozen analytical workbook, source values, withheld outputs and acceptance
status are not changed by this presentation work.

## Tracked actions

| ID | Action | Implementation / remaining verification |
|---|---|---|
| C-UX-01 | Remove the workbook-browser presentation | Replaced its mounted components with question-led analytical panels. Internal output IDs, worksheet coordinates and calculation expressions are not presentation labels. |
| C-UX-02 | Answer the management question first | Added an exact, scoped expenditure-change summary. Explicitly distinguishes product/quantity analysis from unavailable observed treated-person counts. |
| C-UX-03 | Promote expenditure shared across areas | Featured analytical card before the detailed sections; retained the non-additivity and proxy-attribution meaning. |
| C-UX-04 | Plain-language results and selectors | All available catalogue outputs have explicit presentation names. Renamed formula-bearing business totals instead of suppressing their numerical results. Audit-only columns remain internal. |
| C-BUD-01 | Open Budget on a populated view | Selects a published department-level record with an allocated actual, including an actual zero. No invented default data when none exists. |
| C-BUD-02 | Preserve local budget scope | Independent Azienda/channel selectors are encoded in the URL; copy, back/forward and reset retain their intended semantics. Aggregate expenditure controls do not pretend to filter the budget. |
| PERF-01 | Avoid repeated C artifact downloads | Immutable, digest-pinned server artifacts have a bounded cache **after** fresh role checks. Shared panels coalesce identical reads only inside the current client workspace. Sections load near the viewport and requests are bounded. |
| PERF-02 | Reduce repeated core ledger reads | Request memoization plus a single-entry reviewer cache; active release and reviewer scope checked before use. No cross-request caching of ordinary RLS fact rows. Failed/short/duplicate pages refuse totals. 17 Oct: the reviewer cache lives 10 min (was 120 s, so every page opened after a two-minute pause paid the full 12-20 s read again); an in-place correction to the active release without re-activation can now be stale for up to 10 min, the bound the Pillar B cache already documents. The release is read in 8 concurrent id ranges (`DASHBOARD_FACT_LANES` overrides it, clamped to 4-16, with one warning when a value is changed or unreadable); 16 was tried and reverted, see below. Each read attempt, successful or failed, logs one `dashboard_fact_load` line: outcome, a fixed error class, transport (compact or json), lanes, ms and slowest page (client wall time, not database time), plus rows and pages for the reviewer read only; no user or org values. A release switch during a load drops only that load's own entry. A cold read moved 271 MB of JSON for 261,153 rows; each field is now requested under a one- or two-letter alias with nulls stripped and the constant release id filled in locally (102 MB), and every row is rebuilt with all fields, absent values as null. Proven on production before shipping: every release row rebuilt from its compact form equals its full-name form. Each compact load is checked against a 200-row full-name canary. A fault of the compact transport itself (a request refused with 406 or a PGRST1xx parse error, an undecodable page, a canary mismatch) logs one `dashboard_fact_compact_fallback` event (reason, and whether it was retried), keeps that instance on JSON for 15 min, and re-reads in full-name JSON within the same 45 s budget when at least 25 s remain (that read's line is marked `fallback`). Timeouts, server errors, rows changing during the read and an unreadable canary fail the load as before, without a second read. `DASHBOARD_FACT_TRANSPORT=json` switches the compact transport off. Measured live after both changes (17 Oct, Supabase gateway logs and pg_stat_statements): a cold read is still about 19 s. It is ~264 page requests on a shared-compute instance that runs Postgres and PostgREST on the same CPUs; throughput stays near 14 pages/s whatever the lanes or bytes (16 lanes doubled each page's origin time, 370 to 690 ms; database time per compact page 72 ms under that load). Removing it needs fewer database requests per load (server-side aggregation, a migration), more database compute, or a cache that survives instance recycling; each is an owner decision. Later the same day the database moved from Micro to Small: no measurable change (264 pages in 18.3 s against 19.7 s). The gateway logs show why: every request costs ~250-330 ms even for one row, so the read is bound by its ~264 requests. Pages now ask for 5000 rows; that takes effect only when the Data API «Max rows» setting (1000) is raised, and would cut the read to ~53 requests. The owner raised it to 5000 the same evening: 56 requests, cold «Fonti e qualità» 17.4 s (25.4 s before), of which ~5 s came before the read started. A widened reviewer's read now starts as soon as the live reviewer check, an approved membership and the active release are known, instead of after the reviewer directory (pillar_b_facets, 1.5 s cold); the scoped read awaits that same load under the reviewer key, and only a request whose resolved scope is the widened reviewer scope reads it. The early load is kept alive with after(); after a failure only the early start pauses for 60 s on that instance, and the scoped read still runs. Accepted cost: a release activated between the early lookup and the scope's can leave one stale-stamp read running, at most the 45 s budget. A 1000-row page costs the database about 27 ms (EXPLAIN ANALYZE), so the cold read is latency-bound. Cold-load performance after a deploy is still open. |
| SCOPE-01 | Use the established reviewer policy in core pages | Reuses the Pillar B server-side scope resolver, including the live reviewer decision. Ordinary accounts keep their own session/RLS. No policy/grant changes. |
| SCOPE-02 | Correct names and drill-down | Both approved code forms resolve to the same authorized label. Reviewers can drill down from Azienda; the selected Azienda is correctly recognized on Benchmark. |
| SCOPE-03 | Align antibiotic summary and workbook scope | Uses the existing private Pillar A scope and verifies complete reads. Separate cost bases are retained; no artificial equality or savings claim. |
| HK-01 | Remove the two September test uploads from the operational queue | Exact records identified. Reversible maintenance metadata is supported; the row, file and uploaded status remain intact. Production archival must be recorded separately when applied. The genuine original workbook upload is not a test and is retained. |
| HK-02 | Distinguish antibiotic totals | Cost-basis disclosure and scope-matched reconciliation already existed. Scope alignment and explicit signed changes address additional ambiguity; CF and normalized summary costs are not interchangeable. |
| HK-03 | Show signs for changes | Added a dedicated signed percentage formatter and applied it only to changes, not composition shares or coverage. |

## Verification and release rules

- Type-check the actual source and run the full suite, lint and production build.
- Check real frozen artefacts through the presentation adapter; keep all private
  figures and receipts outside this public checkout.
- Verify the signed-in reviewer view, budget default, a budget selection and
  reset, the absence of the former workbook view, core page scopes and signs.
- Measure cold and warm pages independently. An API/service-role timing is not
  an authenticated end-to-end browser timing. Do not label all speed findings
  closed merely because caching helps repeated reads.
- Recheck signed-out/private boundaries. No change to the release gate,
  production ledger, data imports, RLS policies, or ordinary-member disclosure.
- Claude owns simultaneous ATC/normalization changes. Preserve them, commit
  independently where possible, and report any mixed integration explicitly.

## Reversible upload housekeeping

The maintenance marker is `reconciliation_summary.maintenance_archive`, version
1, reason `test_upload`, with an ISO timestamp. It does **not** mark an upload
reconciled. Only this explicit marker excludes a row from the operational list.
The targeted records had a null original summary and uploaded status. Restore
by removing the marker (or restoring the original null summary), without touching
the file or status. No hard deletion is required.

## Remaining substantive limits

This work does not establish observed patients, complete clinical allocation,
causal attribution, validated savings, or permission to combine incompatible
cost bases. Withheld workbook outputs remain withheld. The core cold path still
pages a row ledger: server-side aggregated read contracts should replace that
path if measured cold loads remain above the target after this change.

## Integration checkpoint

- `d459e5b` replaces the mounted workbook explorer; `50ad85c` includes it on
  main alongside Claude's latest same-stratum unit-cost correction.
- Signed-in browser check confirmed the new question-led layout, absence of the
  former explorer heading, and a populated published department Budget default
  (its scope remains independent of the spending controls).
- Core reads now use bounded, disjoint primary-key ranges instead of OFFSET
  over wide ledger rows. The full production read matched the independent
  aggregate RPC by organization and reporting-year total. The desktop diagnostic
  took 28.6 seconds; this is explicitly not an end-user page timing.
- A scope-related financial safeguard was added: compare each Azienda using its
  own complete history and prices, then add organizational upper bounds. Never
  let an early dispensing or cheaper price in one Azienda create an opportunity
  in another. Discriminating cross-organization fixtures cover this.
- Missing molecule-level margins remain null; measured zero remains zero.
  The summary displays the coverage of organization–molecule evaluations.
- Production deployment and live verification of the core changes, and production
  archival of the identified test uploads, are still pending at this checkpoint.
