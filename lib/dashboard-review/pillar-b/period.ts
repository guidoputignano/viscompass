// Period construction and comparison.
//
// The release covers complete 2024 and 2025 and January–May 2026. Comparing a
// five-month window to a twelve-month year would show 2026 collapsing by about
// sixty per cent, which is an artefact of the calendar and not a finding. The
// functions here make that comparison unconstructible rather than discouraged.

import type { Period, PeriodComparison } from "./contract";

/** Months actually present in the release. 2026 stops in May. */
export const RELEASE_COVERAGE = {
  2024: 12,
  2025: 12,
  2026: 5,
} as const;

export const COMPLETE_YEARS = [2024, 2025] as const;
export const YTD_YEAR = 2026;
export const YTD_THROUGH_MONTH = 5;

export function fullYear(year: number): Period {
  const months = RELEASE_COVERAGE[year as keyof typeof RELEASE_COVERAGE];
  if (months !== 12) {
    throw new Error(
      `${year} is not a complete year in this release (${months ?? 0} months). ` +
      `Use ytd(${year}, ${months ?? 0}) and compare it only with the same months.`,
    );
  }
  return { kind: "full_year", year, months: 12 };
}

export function ytd(year: number, throughMonth: number): Period {
  if (!Number.isInteger(throughMonth) || throughMonth < 1 || throughMonth > 12) {
    throw new Error(`throughMonth must be 1..12, got ${throughMonth}`);
  }
  const available = RELEASE_COVERAGE[year as keyof typeof RELEASE_COVERAGE] ?? 0;
  if (throughMonth > available) {
    throw new Error(
      `${year} has ${available} months in this release; cannot build a YTD window through month ${throughMonth}`,
    );
  }
  return { kind: "ytd", year, throughMonth, months: throughMonth };
}

/**
 * Two complete years. Refuses anything else, including a year the release only
 * partly covers.
 */
export function compareFullYears(current: number, previous: number): PeriodComparison {
  if (current === previous) throw new Error("a year cannot be compared with itself");
  return { kind: "full_year", current: fullYear(current), previous: fullYear(previous) };
}

/**
 * The same months in two different years — the only honest way to put 2026
 * beside an earlier year.
 */
export function compareMatchedYtd(
  current: number,
  previous: number,
  throughMonth: number,
): PeriodComparison {
  if (current === previous) throw new Error("a year cannot be compared with itself");
  return {
    kind: "matched_ytd",
    throughMonth,
    current: ytd(current, throughMonth),
    previous: ytd(previous, throughMonth),
  };
}

/**
 * The comparison to offer for a given year, chosen by what the data supports
 * rather than by what the caller asks for.
 *
 * For 2026 this is always a matched January–May window. There is deliberately no
 * argument that would let a caller request 2026 against a full year.
 */
export function defaultComparisonFor(year: number): PeriodComparison {
  const months = RELEASE_COVERAGE[year as keyof typeof RELEASE_COVERAGE];
  if (months === undefined) throw new Error(`${year} is not in this release`);

  // The earliest year in the release has nothing to be compared WITH. 2024's
  // predecessor is 2023, which this release does not hold, so there is no
  // year-on-year comparison for it — and saying so is the answer, not an
  // oversight to be papered over with a partial or implied baseline.
  const previous = RELEASE_COVERAGE[(year - 1) as keyof typeof RELEASE_COVERAGE];
  if (previous === undefined) {
    throw new Error(
      `${year} is the earliest year in this release; ${year - 1} is not held, ` +
      `so no year-on-year comparison exists. Show ${year} on its own.`,
    );
  }

  if (months === 12) return compareFullYears(year, year - 1);
  return compareMatchedYtd(year, year - 1, months);
}

/**
 * Whether a year has a predecessor in this release. Call this before offering a
 * comparison control in the UI, so the earliest year renders as a single period
 * rather than as a failed comparison.
 */
export function hasComparisonBaseline(year: number): boolean {
  return RELEASE_COVERAGE[(year - 1) as keyof typeof RELEASE_COVERAGE] !== undefined;
}

/** Inclusive month bounds for a period, for the SQL layer. */
export function monthRange(period: Period): { year: number; from: number; to: number } {
  return period.kind === "full_year"
    ? { year: period.year, from: 1, to: 12 }
    : { year: period.year, from: 1, to: period.throughMonth };
}

/** Italian label. 2026 is always marked partial so a screenshot cannot mislead. */
export function periodLabel(period: Period): string {
  if (period.kind === "full_year") return `${period.year} (anno completo)`;
  const MONTHS = ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno",
                  "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre"];
  return `${period.year} · gennaio–${MONTHS[period.throughMonth - 1]} (parziale)`;
}

export function comparisonLabel(comparison: PeriodComparison): string {
  return comparison.kind === "full_year"
    ? `${periodLabel(comparison.current)} vs ${periodLabel(comparison.previous)}`
    : `gennaio–${comparison.throughMonth} ${comparison.current.year} vs ` +
      `gennaio–${comparison.throughMonth} ${comparison.previous.year} (periodi allineati)`;
}

/** True when a period does not cover its whole year — the UI must say so. */
export function isPartial(period: Period): boolean {
  return period.kind === "ytd";
}
