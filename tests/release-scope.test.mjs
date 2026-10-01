import test from "node:test";
import assert from "node:assert/strict";

import {
  MONTHS_OBSERVED_CAVEAT, chooseActiveRelease, costPerPack, maxOf, minOf, monthsObserved,
  packCoverage, selectReportingPeriod, sumPacks,
} from "../lib/dashboard-review/release-scope.ts";

let id = 0;
const fact = (year, month, packs = null) => ({
  id: ++id, source_record_id: `r${id}`, source_version_id: "REL", year, month,
  quantity_packs: packs, total_cost_eur: 100,
});

/** 2024 and 2025 complete, 2026 January–May — the shape of this release. */
const RELEASE = [
  ...Array.from({ length: 12 }, (_, i) => fact(2024, i + 1, null)),
  ...Array.from({ length: 12 }, (_, i) => fact(2025, i + 1, null)),
  ...Array.from({ length: 5 }, (_, i) => fact(2026, i + 1, null)),
];

test("the reporting year is the latest year with TWELVE MONTHS OBSERVED, not the latest", () => {
  // Math.max picks 2026, which holds five months. Comparing it to twelve-month
  // 2025 publishes a ~60% collapse that is purely the calendar.
  const p = selectReportingPeriod(RELEASE);
  assert.equal(p.year, 2025);
  assert.equal(p.previousYear, 2024);
  assert.equal(p.observedMonths, 12);
  assert.notEqual(p.year, Math.max(...RELEASE.map((f) => f.year)));
});

test("twelve months observed is not a claim that the year is complete", () => {
  // Raised in review. One record in each of twelve months makes a year eligible.
  // A month in which three of eleven ASLs reported still counts as observed, so
  // the selector establishes a SPAN, not that every submission arrived. Nothing
  // in this module may label such a year "complete".
  const sparse = Array.from({ length: 12 }, (_, i) => fact(2029, i + 1));
  const p = selectReportingPeriod(sparse);
  assert.equal(p.year, 2029, "one record per month is enough to be selected...");
  assert.equal(p.observedMonths, 12);
  assert.match(MONTHS_OBSERVED_CAVEAT, /non è certificata/,
               "...so the caveat the UI must show says exactly that");
  assert.doesNotMatch(MONTHS_OBSERVED_CAVEAT, /completo|completa\b/,
                      "and the caveat itself must not claim completeness");
});

test("partial years are reported, not silently dropped", () => {
  const p = selectReportingPeriod(RELEASE);
  assert.deepEqual(p.partialYears, [{ year: 2026, months: 5 }]);
});

test("a year missing even one month is not selected", () => {
  const eleven = Array.from({ length: 11 }, (_, i) => fact(2027, i + 1));
  const p = selectReportingPeriod([...RELEASE, ...eleven]);
  assert.equal(p.year, 2025, "2027 has 11 months and must not be selected");
  assert.ok(p.partialYears.some((x) => x.year === 2027 && x.months === 11));
});

test("duplicate months do not fake twelve observed months", () => {
  // Twelve rows that are all January is one month observed, not twelve.
  const twelveJanuaries = Array.from({ length: 12 }, () => fact(2030, 1));
  const p = selectReportingPeriod(twelveJanuaries);
  assert.equal(monthsObserved(twelveJanuaries, 2030), 1);
  assert.equal(p.year, null);
});

test("out-of-range months cannot carry an eleven-month year to twelve", () => {
  // Nothing upstream constrains this: the loader writes Number(r.mese) and the
  // column has no CHECK. Month 0 is a common "periodo non attribuito" sentinel
  // and 13 a year-end adjustment batch. Without the range check both count, an
  // eleven-month year is selected as the reporting period, and it is compared
  // like-for-like against a real twelve-month year.
  const eleven = Array.from({ length: 11 }, (_, i) => fact(2028, i + 1));
  const withSentinels = [...eleven, fact(2028, 0), fact(2028, 13)];
  assert.equal(monthsObserved(withSentinels, 2028), 11, "0 and 13 are not months");

  const p = selectReportingPeriod([...RELEASE, ...withSentinels]);
  assert.equal(p.year, 2025, "2028 must not be selected on eleven real months");
  assert.ok(p.partialYears.some((x) => x.year === 2028 && x.months === 11));
});

test("a non-numeric month is not a month, and NaN cannot dedupe its way to twelve", () => {
  // Number("GEN") is NaN, and Set.add collapses every NaN to one entry — so an
  // unbounded Set could never reach twelve this way, but a single NaN alongside
  // eleven real months could. Neither may count.
  const eleven = Array.from({ length: 11 }, (_, i) => fact(2032, i + 1));
  assert.equal(monthsObserved([...eleven, { ...fact(2032, null), month: NaN }], 2032), 11);
  assert.equal(monthsObserved([{ ...fact(2033, null), month: 1.5 }], 2033), 0,
               "a fractional month is not a calendar month");
});

test("rows with no month contribute nothing to months observed", () => {
  const monthless = Array.from({ length: 12 }, () => fact(2031, null));
  assert.equal(monthsObserved(monthless, 2031), 0);
  assert.equal(selectReportingPeriod(monthless).year, null);
});

test("no year with twelve months observed yields null, not a partial year", () => {
  const p = selectReportingPeriod(Array.from({ length: 5 }, (_, i) => fact(2026, i + 1)));
  assert.equal(p.year, null);
  assert.equal(p.previousYear, null);
});

test("an empty fact set is empty, not an error", () => {
  const p = selectReportingPeriod([]);
  assert.deepEqual(p, { year: null, previousYear: null, partialYears: [], observedMonths: null });
});

// --- packages ----------------------------------------------------------------

test("no stated package count is null, NOT zero", () => {
  // `reduce((s, f) => s + (f.quantity_packs ?? 0), 0)` turns "no row states a
  // count" into "zero packages", which is a different and false claim. The
  // Pillar B loader leaves quantity_packs null on all 261,153 rows.
  assert.equal(sumPacks(RELEASE), null);
  assert.equal(sumPacks([]), null);
  assert.notEqual(sumPacks(RELEASE), 0);
});

test("an observed zero is still zero", () => {
  assert.equal(sumPacks([fact(2025, 1, 0)]), 0);
  assert.notEqual(sumPacks([fact(2025, 1, 0)]), sumPacks([fact(2025, 1, null)]));
});

test("a PARTIALLY stated count is not a total, and is not published as one", () => {
  // This test previously asserted the opposite — that the sum of the rows which
  // do state a count (15) is the answer. That encoded the bug as the contract.
  // On a mixed-coverage release (packages recorded for CO but not DPC, say) a
  // real-looking 15 would appear under a KPI card labelled "Confezioni", and it
  // would be the total of an unnamed subset.
  const mixed = [fact(2025, 1, 10), fact(2025, 2, null), fact(2025, 3, 5)];
  assert.equal(sumPacks(mixed), null, "no publishable total when coverage is partial");

  // The partial figure is still reachable — but only together with what it covers.
  const c = packCoverage(mixed);
  assert.equal(c.packs, null);
  assert.equal(c.statedPacks, 15);
  assert.equal(c.stated, 2);
  assert.equal(c.rows, 3);
  assert.equal(c.coverage, 2 / 3);
});

test("a total is published only when EVERY row states a count", () => {
  const full = [fact(2025, 1, 10), fact(2025, 2, 5)];
  assert.equal(sumPacks(full), 15);
  assert.equal(packCoverage(full).coverage, 1);

  // One null row is enough to withdraw the total.
  assert.equal(sumPacks([...full, fact(2025, 3, null)]), null);
});

test("a numeric column arriving as a STRING is summed, not concatenated", () => {
  // quantity_packs is Postgres `numeric`. PostgREST sends JSON numbers, but the
  // raw pg wire protocol — used by the loader and the verification harness —
  // sends strings, to preserve arbitrary precision. `total += "7"` then yields
  // "077777…", a 20,000-digit string that renders as a plausible package total.
  // This is not hypothetical: it is what the harness produced on first run.
  const asStrings = [
    { ...fact(2025, 1), quantity_packs: "7" },
    { ...fact(2025, 2), quantity_packs: "3" },
  ];
  const c = packCoverage(asStrings);
  assert.equal(c.statedPacks, 10);
  assert.equal(typeof c.statedPacks, "number", "a string total is the whole bug");
  assert.equal(c.packs, 10);
  assert.equal(c.coverage, 1);
});

test("a value that will not parse is absent, not a poisoned sum", () => {
  const junk = [
    { ...fact(2025, 1), quantity_packs: "n/d" },
    { ...fact(2025, 2), quantity_packs: 4 },
  ];
  const c = packCoverage(junk);
  assert.equal(c.stated, 1, "the unparseable row does not count as stated");
  assert.equal(c.statedPacks, 4);
  assert.ok(!Number.isNaN(c.statedPacks), "and never produces NaN");
  assert.equal(c.packs, null, "coverage is partial, so no total is published");
});

test("coverage is null for an empty set, not a misleading 0 or 1", () => {
  const c = packCoverage([]);
  assert.equal(c.packs, null);
  assert.equal(c.coverage, null, "0/0 is not 0% coverage and not 100%");
  assert.equal(c.rows, 0);
  assert.equal(c.statedPacks, 0);
});

test("cost per pack refuses an unknown or zero denominator", () => {
  assert.equal(costPerPack(1000, null), null);
  assert.equal(costPerPack(1000, 0), null);
  assert.equal(costPerPack(1000, 4), 250);
});

// --- fail-closed release selection ------------------------------------------

test("NO declared release means the dashboard publishes NOTHING", () => {
  // Fail closed. An import can therefore land without the legacy pages
  // immediately showing figures that have not been through the gates: the rows
  // are inert until a release is activated.
  assert.equal(chooseActiveRelease([]), null);
  assert.equal(chooseActiveRelease(null), null);
  assert.equal(chooseActiveRelease(undefined), null);
});

test("TWO declared releases throw rather than aggregate across them", () => {
  assert.throws(
    () => chooseActiveRelease([{ release_id: "A" }, { release_id: "B" }]),
    /2 active releases.*refusing to aggregate/,
  );
});

test("one declared release is the one that is read", () => {
  assert.equal(chooseActiveRelease([{ release_id: "PILLAR-B-R2-20261001" }]),
               "PILLAR-B-R2-20261001");
});

// --- extremes over row-scaled arrays ----------------------------------------

test("extremes survive more rows than a spread can carry", () => {
  // `Math.max(...rows.map(f => f.year))` passes one ARGUMENT per row. V8 accepts
  // 124,741 and throws RangeError past that. This release holds 261,153 rows, so
  // getLineageData() threw on its first page load and getSpendOverview() was at
  // 106,639 — 85.5% of the limit — and would have started throwing as coverage
  // grew. The bug is invisible on small fixtures, so the fixture here is large.
  const n = 261_153;
  const values = new Array(n);
  for (let i = 0; i < n; i += 1) values[i] = i;

  assert.throws(() => Math.max(...values), RangeError,
                "the spread this replaces must genuinely fail at this size");
  assert.equal(maxOf(values), n - 1);
  assert.equal(minOf(values), 0);
});

test("extremes ignore non-finite values and return null for none", () => {
  assert.equal(maxOf([1, NaN, 5, Infinity, 3]), 5);
  assert.equal(minOf([1, NaN, 5, -Infinity, 3]), 1);
  assert.equal(maxOf([]), null);
  assert.equal(minOf([NaN, NaN]), null);
});

test("a single negative value is its own extreme, not shadowed by a zero seed", () => {
  // `let best = 0` would report 0 here, which is the classic form of this bug.
  assert.equal(maxOf([-7]), -7);
  assert.equal(minOf([-7]), -7);
});
