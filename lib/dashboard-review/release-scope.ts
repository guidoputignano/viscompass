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

/**
 * How many distinct CALENDAR months a year was observed in.
 *
 * The 1–12 range check is not decoration. Nothing between the source cell and
 * here constrains the value: the loader writes `Number(r.mese)` and
 * `canonical_fact.month` carries no CHECK constraint. A release holding
 * January–November plus rows whose month is `0` (a common "periodo non
 * attribuito" sentinel) or `13` (a year-end adjustment batch) would otherwise
 * reach a count of twelve, and an eleven-month year would be selected as the
 * reporting period and compared like-for-like against a real twelve-month one.
 *
 * The trend charts already filter to 1–12 (they index a month-label array), so
 * without this the same screen would draw eleven bars beside a caption saying
 * twelve.
 */
export function monthsObserved(facts: ReadonlyArray<CanonicalFact>, year: number): number {
  const months = new Set<number>();
  for (const fact of facts) {
    if (fact.year !== year) continue;
    const month = fact.month;
    if (!Number.isInteger(month) || (month as number) < 1 || (month as number) > 12) continue;
    months.add(month as number);
  }
  return months.size;
}

/**
 * What twelve observed months do and do not establish.
 *
 * Raised in review: the selector below calls a year eligible when at least one
 * record exists in each of twelve months. That establishes the year was OBSERVED
 * across twelve months. It does NOT establish that every expected ASL/channel
 * submission arrived — a month in which three of eleven ASLs reported counts as
 * observed. Calling such a year "complete" asserts a certification nobody has
 * performed, so no label in this codebase does.
 *
 * Surfaces rendering a year selected this way show this caveat.
 */
export const MONTHS_OBSERVED_CAVEAT =
  "12 mesi osservati; la completezza dei conferimenti per ASL e canale non è certificata";

export interface ReportingPeriod {
  /**
   * The latest year with twelve months OBSERVED, or null when no year has twelve.
   *
   * "Observed", deliberately, not "complete" — see {@link MONTHS_OBSERVED_CAVEAT}.
   */
  year: number | null;
  /** The year before it that also has twelve months observed, for a like-for-like span. */
  previousYear: number | null;
  /**
   * Years present in the data with FEWER than twelve months observed, and how
   * many each has. The UI must surface these rather than silently dropping
   * them, and must never compare one to a twelve-month year.
   */
  partialYears: Array<{ year: number; months: number }>;
  /**
   * Months observed in `year`. Twelve whenever `year` is non-null — carried so a
   * caller can label the figure from the period itself rather than hardcoding it.
   */
  observedMonths: number | null;
}

/**
 * Choose the reporting year from what the data actually contains.
 *
 * Returns the latest year with TWELVE MONTHS OBSERVED, never simply the latest.
 * `Math.max(...years)` picks 2026 on this release, which holds five months, and
 * comparing it to twelve-month 2025 publishes a −57.8% collapse that is purely
 * the calendar.
 *
 * Years with fewer months are returned separately so a caller can surface them
 * as year-to-date instead of treating five months as twelve. This function
 * decides a SPAN, not completeness: see {@link MONTHS_OBSERVED_CAVEAT}.
 */
export function selectReportingPeriod(facts: ReadonlyArray<CanonicalFact>): ReportingPeriod {
  const years = [...new Set(facts.map((f) => f.year).filter(Number.isFinite))].sort((a, b) => b - a);
  const fullyObserved = years.filter((y) => monthsObserved(facts, y) === 12);
  const partial = years
    .filter((y) => !fullyObserved.includes(y))
    .map((y) => ({ year: y, months: monthsObserved(facts, y) }));
  const year = fullyObserved[0] ?? null;
  return {
    year,
    previousYear: fullyObserved[1] ?? null,
    partialYears: partial,
    observedMonths: year === null ? null : 12,
  };
}

export interface PackCoverage {
  /**
   * The publishable total: the sum, but ONLY when every row states a count.
   * null the moment one row does not — a sum over part of the population is not
   * the population's total, and the label on screen reads "Confezioni".
   */
  packs: number | null;
  /**
   * The sum across the rows that DO state a count. Never publish this as a
   * total; publish it only beside `coverage`, which says what it is a total of.
   */
  statedPacks: number;
  /** Rows stating a package count. */
  stated: number;
  /** Rows considered. */
  rows: number;
  /** `stated / rows`, or null when there are no rows at all. */
  coverage: number | null;
}

/**
 * Package counts with their coverage, so a caller can never publish a partial
 * sum as a total.
 *
 * Two distinct failures are being prevented here, and only the first was obvious.
 *
 * `reduce((s, f) => s + (f.quantity_packs ?? 0), 0)` turns "no row states a
 * package count" into "zero packages" — a different and false claim. The Pillar B
 * loader leaves `quantity_packs` null on all 261,153 rows precisely because the
 * source quantity's package/unit convention is unconfirmed (open question 5), so
 * every pack total on this data must be null rather than 0.
 *
 * The second is subtler and was raised in review: summing only the rows that
 * state a count is equally wrong when OTHERS are null. On a future mixed-coverage
 * release — say packages recorded for the CO channel but not DPC — that returns a
 * real-looking number which is the total of an unnamed subset, and the KPI card
 * labels it "Confezioni". So `packs` requires COMPLETE coverage, and a caller
 * wanting to show the partial figure must take `statedPacks` and display
 * `coverage` with it.
 */
/**
 * Coerce a value that SHOULD be a number and may not be.
 *
 * `quantity_packs` and every money column are Postgres `numeric`. Through
 * PostgREST they arrive as JSON numbers, which is why `CanonicalFact` types them
 * `number | null`. Over the raw pg wire protocol — which the loader and the
 * verification harness both use — the same columns arrive as STRINGS, because
 * node-postgres and PGlite preserve arbitrary precision rather than round to a
 * double.
 *
 * The failure that results is silent and spectacular: `total += "7"` on a running
 * sum yields `"07777…"`, a 20,000-digit string that passes a truthiness check,
 * renders as a plausible-looking enormous number, and is reported as a package
 * total. That is precisely what happened the first time the mixed-coverage case
 * was run against real rows.
 *
 * So the aggregation parses rather than trusting the declared type, and anything
 * that will not parse is treated as absent rather than silently poisoning a sum.
 */
function finiteNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function packCoverage(facts: ReadonlyArray<CanonicalFact>): PackCoverage {
  let statedPacks = 0;
  let stated = 0;
  let rows = 0;
  for (const fact of facts) {
    rows += 1;
    const packs = finiteNumber(fact.quantity_packs);
    if (packs === null) continue;
    statedPacks += packs;
    stated += 1;
  }
  const complete = rows > 0 && stated === rows;
  return {
    packs: complete ? statedPacks : null,
    statedPacks,
    stated,
    rows,
    coverage: rows === 0 ? null : stated / rows,
  };
}

/**
 * The publishable package total, or null when coverage is incomplete.
 *
 * Thin wrapper over {@link packCoverage} for the call sites that only render the
 * total. Anything that wants to say something about the gap takes the record.
 */
export function sumPacks(facts: ReadonlyArray<CanonicalFact>): number | null {
  return packCoverage(facts).packs;
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
