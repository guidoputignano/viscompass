import test from "node:test";
import assert from "node:assert/strict";

import {
  chooseActiveRelease, costPerPack, maxOf, minOf, monthsObserved, selectReportingPeriod, sumPacks,
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

test("the reporting year is the latest COMPLETE year, never simply the latest", () => {
  // Math.max picks 2026, which holds five months. Comparing it to twelve-month
  // 2025 publishes a ~60% collapse that is purely the calendar.
  const p = selectReportingPeriod(RELEASE);
  assert.equal(p.year, 2025);
  assert.equal(p.previousYear, 2024);
  assert.notEqual(p.year, Math.max(...RELEASE.map((f) => f.year)));
});

test("partial years are reported, not silently dropped", () => {
  const p = selectReportingPeriod(RELEASE);
  assert.deepEqual(p.partialYears, [{ year: 2026, months: 5 }]);
});

test("a year missing even one month is not complete", () => {
  const eleven = Array.from({ length: 11 }, (_, i) => fact(2027, i + 1));
  const p = selectReportingPeriod([...RELEASE, ...eleven]);
  assert.equal(p.year, 2025, "2027 has 11 months and must not be selected");
  assert.ok(p.partialYears.some((x) => x.year === 2027 && x.months === 11));
});

test("duplicate months do not fake completeness", () => {
  // Twelve rows that are all January is not a complete year.
  const twelveJanuaries = Array.from({ length: 12 }, () => fact(2030, 1));
  const p = selectReportingPeriod(twelveJanuaries);
  assert.equal(monthsObserved(twelveJanuaries, 2030), 1);
  assert.equal(p.year, null);
});

test("rows with no month cannot complete a year", () => {
  const monthless = Array.from({ length: 12 }, () => fact(2031, null));
  assert.equal(monthsObserved(monthless, 2031), 0);
  assert.equal(selectReportingPeriod(monthless).year, null);
});

test("no complete year yields null rather than a partial one", () => {
  const p = selectReportingPeriod(Array.from({ length: 5 }, (_, i) => fact(2026, i + 1)));
  assert.equal(p.year, null);
  assert.equal(p.previousYear, null);
});

test("an empty fact set is empty, not an error", () => {
  const p = selectReportingPeriod([]);
  assert.deepEqual(p, { year: null, previousYear: null, partialYears: [] });
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

test("a partially stated count sums only the rows that state one", () => {
  assert.equal(sumPacks([fact(2025, 1, 10), fact(2025, 2, null), fact(2025, 3, 5)]), 15);
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
