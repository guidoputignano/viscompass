// Measure construction, unit discipline and ranking.
//
// Two rules are enforced here rather than remembered:
//
//   1. null is not zero. A measure with no observation is `null`, and every
//      helper propagates that instead of coercing it. "No data" rendering as
//      "zero spending" has been a real defect in this project.
//   2. A ranked list has ONE unit. Ranking mg against packs against euros
//      produces an ordering with no meaning, and it is the kind of mistake that
//      survives review because the output looks like a league table. `rankBy`
//      refuses a heterogeneous list instead of sorting it.

import { formatEurPrecise, formatNumber } from "@/lib/dashboard-review/format";
import type { Coverage, Measure, MeasuredRow, PhysicalUnit, Period, Provenance } from "./contract";

export const EMPTY_COVERAGE: Coverage = {
  observedRows: 0,
  totalRows: 0,
  eligibleSpendEur: 0,
  totalSpendEur: 0,
  exclusions: [],
};

export function measure(
  value: number | null,
  unit: PhysicalUnit,
  period: Period,
  coverage: Coverage,
  provenance: Provenance = "observed",
  withheld?: string,
): Measure {
  return { value, unit, provenance, period, coverage, ...(withheld ? { withheld } : {}) };
}

/**
 * Not observed. Distinct from a measure of 0, and the only correct answer when
 * no row carried the quantity.
 */
export function notObserved(
  unit: PhysicalUnit,
  period: Period,
  coverage: Coverage = EMPTY_COVERAGE,
  why?: string,
): Measure {
  return measure(null, unit, period, coverage, "observed", why);
}

/** Share of a figure's population it was actually computed over, or null. */
export function coverageShare(coverage: Coverage): number | null {
  if (coverage.totalSpendEur === 0) return null;
  return coverage.eligibleSpendEur / coverage.totalSpendEur;
}

/**
 * Sum over rows, returning null when nothing was observed.
 *
 * `sum([]) === null`, not 0. An empty result set means the question had no
 * answer here, which is a different statement from an answer of zero.
 */
export function sumObserved(values: ReadonlyArray<number | null>): number | null {
  let total = 0;
  let seen = 0;
  for (const v of values) {
    if (v === null || v === undefined || Number.isNaN(v)) continue;
    total += v;
    seen += 1;
  }
  return seen === 0 ? null : total;
}

/** A ratio that refuses to invent a denominator. */
export function ratio(numerator: number | null, denominator: number | null): number | null {
  if (numerator === null || denominator === null) return null;
  if (denominator === 0) return null;
  return numerator / denominator;
}

/**
 * Change between two measures, in the unit they share.
 *
 * Refuses to subtract across units or across provenance, and returns null if
 * either side was not observed — a change from "unknown" is not a change of zero.
 */
export function change(current: Measure, previous: Measure): number | null {
  assertSameUnit([current, previous], "change");
  if (current.provenance !== previous.provenance) {
    throw new Error(
      `cannot difference an ${current.provenance} measure against a ${previous.provenance} one`,
    );
  }
  // Periods must be commensurable. Differencing a 5-month YTD figure against a
  // 12-month year reports the calendar as a change, which is the single easiest
  // false finding this data affords. The period model refuses to CONSTRUCT that
  // comparison; this refuses to compute one if a caller assembles the Measures
  // by hand.
  if (current.period.months !== previous.period.months) {
    throw new Error(
      `cannot difference a ${current.period.months}-month period against a ` +
      `${previous.period.months}-month one: the difference would be mostly calendar`,
    );
  }
  if (current.period.kind !== previous.period.kind) {
    throw new Error(
      `cannot difference a ${current.period.kind} period against a ${previous.period.kind} one`,
    );
  }
  if (current.value === null || previous.value === null) return null;
  return current.value - previous.value;
}

/** Percentage-point change, for shares. Uptake moves in points, never in percent. */
export function changeInPoints(current: Measure, previous: Measure): number | null {
  const delta = change(current, previous);
  return delta === null ? null : delta * 100;
}

export function assertSameUnit(measures: ReadonlyArray<Measure>, context: string): PhysicalUnit {
  const units = new Set(measures.map((m) => m.unit));
  if (units.size > 1) {
    throw new Error(
      `${context}: refusing to combine different units (${[...units].join(", ")}). ` +
      "A single ranked or summed measure must be in one physical unit.",
    );
  }
  const [unit] = units;
  if (!unit) throw new Error(`${context}: nothing to measure`);
  return unit;
}

/**
 * Rank rows by their measure, largest first.
 *
 * Refuses a mixed-unit list. Rows whose measure was not observed are NOT ranked
 * as zero — they are returned separately so the UI can show them as unknown
 * rather than bottom of the table, which would read as "this ASL spends least".
 */
export function rankBy<T>(
  rows: ReadonlyArray<MeasuredRow<T>>,
  context = "ranking",
): { ranked: MeasuredRow<T>[]; notObserved: MeasuredRow<T>[]; unit: PhysicalUnit | null } {
  if (rows.length === 0) return { ranked: [], notObserved: [], unit: null };
  const unit = assertSameUnit(rows.map((r) => r.measure), context);

  const withheld = rows.filter((r) => r.measure.withheld !== undefined);
  if (withheld.length > 0) {
    throw new Error(
      `${context}: ${withheld.length} measure(s) are withheld and must not be ranked ` +
      `(${withheld[0].measure.withheld})`,
    );
  }

  const observed = rows.filter((r) => r.measure.value !== null);
  const missing = rows.filter((r) => r.measure.value === null);
  observed.sort((a, b) => (b.measure.value as number) - (a.measure.value as number));
  return { ranked: observed, notObserved: missing, unit };
}

/**
 * Format for an Italian UI. Returns a dash for a withheld figure and `n/d` for a
 * non-observation, so a null can never render as "0".
 *
 * Delegates to the project's formatters rather than calling `toLocaleString`
 * directly. They go through `itNumberFormat`, which PINS `useGrouping` because
 * Italian `minimumGroupingDigits = 2` leaves four-digit grouping ICU-dependent:
 * an unpinned formatter renders 1234,50 on one side and 1.234,50 on the other
 * and React reports a hydration mismatch. A first draft of this function did
 * exactly that.
 */
export function formatMeasure(m: Measure, fractionDigits = 2): string {
  if (m.withheld) return "—";
  if (m.value === null) return "n/d";
  if (m.unit === "eur") return formatEurPrecise(m.value, fractionDigits);
  const n = formatNumber(m.value, fractionDigits);
  switch (m.unit) {
    case "mg": return `${n} mg`;
    case "packs": return `${n} conf.`;
    case "ddd": return `${n} DDD`;
  }
}
