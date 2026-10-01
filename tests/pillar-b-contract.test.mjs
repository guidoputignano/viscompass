import test from "node:test";
import assert from "node:assert/strict";

import {
  compareFullYears, compareMatchedYtd, comparisonLabel, defaultComparisonFor,
  fullYear, isPartial, monthRange, periodLabel, ytd,
} from "../lib/dashboard-review/pillar-b/period.ts";
import {
  EMPTY_COVERAGE, change, changeInPoints, coverageShare, formatMeasure,
  measure, notObserved, rankBy, ratio, sumObserved,
} from "../lib/dashboard-review/pillar-b/measure.ts";

const Y2025 = fullYear(2025);
const cov = (eligible, total) => ({
  observedRows: 1, totalRows: 1, eligibleSpendEur: eligible, totalSpendEur: total, exclusions: [],
});

// --- periods -----------------------------------------------------------------

test("2026 cannot be built as a full year", () => {
  // The release has five months of 2026. A full-year period would make every
  // 2026 comparison show a ~60% collapse that is purely the calendar.
  assert.throws(() => fullYear(2026), /not a complete year/);
  assert.doesNotThrow(() => fullYear(2025));
  assert.doesNotThrow(() => fullYear(2024));
});

test("a YTD window cannot exceed the months the release actually holds", () => {
  assert.throws(() => ytd(2026, 6), /has 5 months/);
  assert.doesNotThrow(() => ytd(2026, 5));
  assert.throws(() => ytd(2026, 0), /1\.\.12/);
});

test("the default comparison for 2026 is a MATCHED window, never a full year", () => {
  const c = defaultComparisonFor(2026);
  assert.equal(c.kind, "matched_ytd");
  assert.equal(c.throughMonth, 5);
  assert.equal(c.current.months, 5);
  assert.equal(c.previous.months, 5);
  assert.equal(c.previous.year, 2025);
});

test("the default comparison for a complete year is full-year against full-year", () => {
  const c = defaultComparisonFor(2025);
  assert.equal(c.kind, "full_year");
  assert.equal(c.current.months, 12);
  assert.equal(c.previous.months, 12);
});

test("matched windows cover identical months on both sides", () => {
  const c = compareMatchedYtd(2026, 2024, 5);
  assert.deepEqual(monthRange(c.current), { year: 2026, from: 1, to: 5 });
  assert.deepEqual(monthRange(c.previous), { year: 2024, from: 1, to: 5 });
});

test("a year cannot be compared with itself", () => {
  assert.throws(() => compareFullYears(2025, 2025), /itself/);
  assert.throws(() => compareMatchedYtd(2026, 2026, 5), /itself/);
});

test("a partial period says so in its Italian label", () => {
  assert.match(periodLabel(ytd(2026, 5)), /parziale/);
  assert.match(periodLabel(ytd(2026, 5)), /gennaio–maggio/);
  assert.match(periodLabel(Y2025), /anno completo/);
  assert.equal(isPartial(ytd(2026, 5)), true);
  assert.equal(isPartial(Y2025), false);
  assert.match(comparisonLabel(defaultComparisonFor(2026)), /allineati/);
});

// --- null versus zero --------------------------------------------------------

test("nothing observed is null, not zero", () => {
  assert.equal(sumObserved([]), null);
  assert.equal(sumObserved([null, null]), null);
  assert.equal(sumObserved([undefined, NaN]), null);
});

test("an observed zero is zero, and is not confused with nothing", () => {
  assert.equal(sumObserved([0]), 0);
  assert.equal(sumObserved([0, null]), 0);
  assert.notEqual(sumObserved([0]), sumObserved([]));
});

test("a ratio never invents a denominator", () => {
  assert.equal(ratio(10, 0), null);
  assert.equal(ratio(null, 5), null);
  assert.equal(ratio(10, null), null);
  assert.equal(ratio(0, 5), 0);
});

test("coverage share is null when there is no population", () => {
  assert.equal(coverageShare(EMPTY_COVERAGE), null);
  assert.equal(coverageShare(cov(50, 200)), 0.25);
});

test("a change from an unobserved value is unknown, not zero", () => {
  const observed = measure(100, "eur", Y2025, cov(1, 1));
  const missing = notObserved("eur", Y2025);
  assert.equal(change(observed, missing), null);
  assert.equal(change(missing, observed), null);
  assert.equal(change(observed, measure(80, "eur", Y2025, cov(1, 1))), 20);
});

test("share changes are reported in percentage points", () => {
  const a = measure(0.62, "packs", Y2025, cov(1, 1));
  const b = measure(0.55, "packs", Y2025, cov(1, 1));
  const pts = changeInPoints(a, b);
  assert.ok(Math.abs(pts - 7) < 1e-9, `expected ~7 points, got ${pts}`);
});

// --- unit discipline ---------------------------------------------------------

test("units cannot be mixed in a difference", () => {
  const mg = measure(100, "mg", Y2025, cov(1, 1));
  const eur = measure(100, "eur", Y2025, cov(1, 1));
  assert.throws(() => change(mg, eur), /different units/);
});

test("observed and derived values cannot be differenced", () => {
  const obs = measure(100, "eur", Y2025, cov(1, 1), "observed");
  const der = measure(90, "eur", Y2025, cov(1, 1), "derived");
  assert.throws(() => change(obs, der), /observed|derived/);
});

test("a ranked list refuses mixed units instead of sorting them", () => {
  // Ranking mg against euros produces an ordering with no meaning, and the
  // output still looks like a league table, which is why it survives review.
  const rows = [
    { subject: "A", measure: measure(5000, "mg", Y2025, cov(1, 1)) },
    { subject: "B", measure: measure(900, "eur", Y2025, cov(1, 1)) },
  ];
  assert.throws(() => rankBy(rows, "test"), /one physical unit/);
});

test("unobserved rows are set aside, not ranked as zero", () => {
  // Ranking a null as 0 puts "we do not know" at the bottom of the table, where
  // it reads as "this ASL spends least".
  const rows = [
    { subject: "A", measure: measure(10, "eur", Y2025, cov(1, 1)) },
    { subject: "B", measure: notObserved("eur", Y2025) },
    { subject: "C", measure: measure(30, "eur", Y2025, cov(1, 1)) },
    { subject: "D", measure: measure(0, "eur", Y2025, cov(1, 1)) },
  ];
  const { ranked, notObserved: missing, unit } = rankBy(rows);
  assert.equal(unit, "eur");
  assert.deepEqual(ranked.map((r) => r.subject), ["C", "A", "D"]);
  assert.deepEqual(missing.map((r) => r.subject), ["B"]);
  // the observed zero IS ranked; only the unknown is set aside
  assert.equal(ranked.at(-1).subject, "D");
});

test("a withheld measure cannot be ranked", () => {
  const rows = [
    { subject: "A", measure: measure(10, "eur", Y2025, cov(1, 1)) },
    { subject: "B", measure: measure(99, "eur", Y2025, cov(1, 1), "observed", "B10 refused a forecast") },
  ];
  assert.throws(() => rankBy(rows), /withheld/);
});

test("an empty ranking is empty, not an error", () => {
  const { ranked, unit } = rankBy([]);
  assert.deepEqual(ranked, []);
  assert.equal(unit, null);
});

// --- rendering ---------------------------------------------------------------

test("a null renders as n/d and an observed zero renders as zero", () => {
  // it-IT places the currency symbol AFTER the number. These assertions go
  // through the project's own formatters, so they also pin the grouping that
  // `itNumberFormat` exists to make deterministic.
  assert.equal(formatMeasure(notObserved("eur", Y2025)), "n/d");
  assert.match(formatMeasure(measure(0, "eur", Y2025, cov(1, 1))), /^0,00\s€$/);
  assert.match(formatMeasure(measure(1234.5, "eur", Y2025, cov(1, 1))), /^1\.234,50\s€$/);
  assert.equal(formatMeasure(measure(12, "mg", Y2025, cov(1, 1), "observed"), 0), "12 mg");
  assert.equal(formatMeasure(measure(5, "eur", Y2025, cov(1, 1), "observed", "withheld")), "—");
});

test("four-digit grouping is pinned, not left to the runtime's ICU", () => {
  // Italian minimumGroupingDigits = 2 leaves 1234 ambiguous between "1234" and
  // "1.234" depending on ICU build. Unpinned, the server and the browser
  // disagree and React reports a hydration mismatch. A first draft of
  // formatMeasure called toLocaleString directly and produced "1234,50".
  assert.match(formatMeasure(measure(1000, "eur", Y2025, cov(1, 1))), /1\.000,00/);
  assert.match(formatMeasure(measure(9999.99, "packs", Y2025, cov(1, 1))), /^9\.999,99 conf\.$/);
});
