// Release scoping and period selection for the legacy dashboard query layer.
//
// WHY THIS EXISTS. `selectCanonicalFacts()` read `canonical_fact` with no release
// filter, and six call sites then chose their reporting year with
// `Math.max(...years)`. With the Pillar B release loaded that picks 2026 — which
// holds five months (January–May), 44,005 rows and ZERO comparable-eligible rows
// — and compares it against twelve-month 2025. The first page load after an
// import would have published a ~60% year-on-year collapse that is purely the
// calendar, alongside a package total of zero.
//
// The three rules here are deliberately data-driven rather than hardcoded to this
// release: a future release with different coverage must not silently inherit
// 2024/2025/2026 assumptions.

import type { CanonicalFact } from "./types";

/** Months actually observed for a year. A year is complete at twelve. */
export function monthsObserved(facts: ReadonlyArray<CanonicalFact>, year: number): number {
  const months = new Set<number>();
  for (const fact of facts) {
    if (fact.year !== year) continue;
    if (fact.month === null || fact.month === undefined) continue;
    months.add(fact.month);
  }
  return months.size;
}

export interface ReportingPeriod {
  /** The latest year with twelve observed months, or null when none is complete. */
  year: number | null;
  /** The year before it that is also complete, for a like-for-like comparison. */
  previousYear: number | null;
  /**
   * Years present in the data that are NOT complete. The UI must say so rather
   * than showing them as a year, and must never compare them to a full year.
   */
  partialYears: Array<{ year: number; months: number }>;
}

/**
 * Choose the reporting year from what the data actually contains.
 *
 * Returns the latest COMPLETE year, never simply the latest. A partial year is
 * reported separately so a caller can surface it as year-to-date instead of
 * silently treating five months as twelve.
 */
export function selectReportingPeriod(facts: ReadonlyArray<CanonicalFact>): ReportingPeriod {
  const years = [...new Set(facts.map((f) => f.year).filter(Number.isFinite))].sort((a, b) => b - a);
  const complete = years.filter((y) => monthsObserved(facts, y) === 12);
  const partial = years
    .filter((y) => !complete.includes(y))
    .map((y) => ({ year: y, months: monthsObserved(facts, y) }));
  return {
    year: complete[0] ?? null,
    previousYear: complete[1] ?? null,
    partialYears: partial,
  };
}

/**
 * Sum a package count, returning null when NO row carries one.
 *
 * `reduce((s, f) => s + (f.quantity_packs ?? 0), 0)` turns "no row states a
 * package count" into "zero packages", which is a different and false claim. The
 * Pillar B loader leaves `quantity_packs` null on every row precisely because the
 * source quantity's package/unit convention is unconfirmed, so every pack total
 * on this data must be null rather than 0.
 */
export function sumPacks(facts: ReadonlyArray<CanonicalFact>): number | null {
  let total = 0;
  let seen = 0;
  for (const fact of facts) {
    if (fact.quantity_packs === null || fact.quantity_packs === undefined) continue;
    total += fact.quantity_packs;
    seen += 1;
  }
  return seen === 0 ? null : total;
}

/**
 * Largest / smallest finite value, computed by iteration rather than by spread.
 *
 * `Math.max(...rows.map(...))` passes one ARGUMENT per row. V8 accepts 124,741
 * of them on this runtime and throws `RangeError: Maximum call stack size
 * exceeded` beyond that — it is a limit on the call, not on the array. This
 * release holds 261,153 rows, so `getLineageData()` would have thrown on its
 * first page load, and `getSpendOverview()` was at 106,639 of the 124,741
 * (85.5%) and would have started throwing as coverage grew.
 *
 * The failure is invisible in testing on small data and total in production, so
 * no row-scaled array is spread anywhere in this layer.
 */
export function maxOf(values: ReadonlyArray<number>): number | null {
  let best: number | null = null;
  for (const value of values) {
    if (!Number.isFinite(value)) continue;
    if (best === null || value > best) best = value;
  }
  return best;
}

export function minOf(values: ReadonlyArray<number>): number | null {
  let best: number | null = null;
  for (const value of values) {
    if (!Number.isFinite(value)) continue;
    if (best === null || value < best) best = value;
  }
  return best;
}

/** Cost per pack, or null when the package count is unknown or zero. */
export function costPerPack(spendEur: number, packs: number | null): number | null {
  if (packs === null || packs === 0) return null;
  return spendEur / packs;
}

/**
 * Decide which release the dashboard may read from the declared rows.
 *
 * Extracted so the fail-closed behaviour is testable rather than asserted by
 * inspection. Three outcomes, and the first two are the ones that matter:
 *   none declared  -> null, and the caller publishes NOTHING
 *   two declared   -> throw, rather than silently aggregating across releases
 *   one declared   -> that release
 */
export function chooseActiveRelease(
  rows: ReadonlyArray<{ release_id: string }> | null | undefined,
): string | null {
  if (!rows || rows.length === 0) return null;
  if (rows.length > 1) {
    throw new Error(
      `${rows.length} active releases are declared; refusing to aggregate across them`,
    );
  }
  return rows[0].release_id;
}
