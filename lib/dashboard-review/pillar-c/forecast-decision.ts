import {
  C_FORECAST_SELECTABLE,
  selectCForecast,
  type CForecast,
  type CForecastAnnual,
  type CForecastSelectable,
  type Money,
} from "@/lib/dashboard-review/pillar-c/review";

export type CForecastDecision = {
  /** Original admitted annual values, including their original intervals. */
  annual: CForecastAnnual;
  observed2025Annual: Money | null;
  /** The observed subtotal excludes unvalued source rows; it never imputes them. */
  observedHasMissingRows: boolean;
  observedMissingRows: number;
  delta: Money | null;
  /** Percentage change versus complete observed 2025, rounded to two decimals. */
  changePct: string | null;
  largestMonth: { month: number; point: Money };
};

// The validated forecast packet admits cent-precision amounts only. Reject a
// wider decimal here rather than silently rounding a new financial quantity.
function cents(value: Money): bigint {
  if (!/^-?(?:0|[1-9]\d{0,12})(?:\.\d{1,2})?$/.test(value)) {
    throw new Error("PILLAR_C_FORECAST_DECISION_MONEY");
  }
  const negative = value.startsWith("-");
  const [whole, fraction = ""] = (negative ? value.slice(1) : value).split(".");
  return BigInt(`${whole}${fraction.padEnd(2, "0")}`) * BigInt(negative ? -1 : 1);
}

function decimal(value: bigint): string {
  const absolute = value < BigInt(0) ? -value : value;
  return `${value < BigInt(0) ? "-" : ""}${absolute / BigInt(100)}.${(absolute % BigInt(100)).toString().padStart(2, "0")}`;
}

function fullCalendar(months: readonly string[], year: number): boolean {
  return months.length === 12 && new Set(months).size === 12 &&
    months.every((month) => new RegExp(`^${year}-(0[1-9]|1[0-2])$`).test(month));
}

function percent(delta: bigint, base: bigint): string {
  // 100 converts the ratio to percent; another 100 retains two decimals.
  const absolute = delta < BigInt(0) ? -delta : delta;
  const numerator = absolute * BigInt(10000);
  const rounded = numerator / base + (numerator % base * BigInt(2) >= base ? BigInt(1) : BigInt(0));
  return decimal(delta < BigInt(0) ? -rounded : rounded);
}

/** Decision quantities only: never a patient, savings or budget estimate. */
export function cForecastDecision(forecast: CForecast, series: CForecastSelectable): CForecastDecision | null {
  // Runtime defence as well as the TypeScript boundary: a rejected class must
  // not appear even if a caller supplies unvalidated stray forecast rows.
  if (!C_FORECAST_SELECTABLE.includes(series)) return null;
  const selected = selectCForecast(forecast, series);
  if (selected.admission?.decision !== "AMMESSA" || !selected.annual ||
      !fullCalendar(selected.rows.map((row) => row.forecast.month), 2026)) return null;

  const annualCents = cents(selected.annual.total);
  const monthly = selected.rows.map(({ month, forecast: row }) => ({ month, point: row.point, value: cents(row.point) }));
  const largest = monthly.reduce((best, row) => row.value > best.value ||
    (row.value === best.value && row.month < best.month) ? row : best);

  const complete = fullCalendar(selected.observed.map((row) => row.month), 2025) &&
    selected.observed.every((row) => row.value !== null && row.rowsSource > 0 && row.rowsValued > 0);
  const observedCents = complete
    ? selected.observed.reduce((sum, row) => sum + cents(row.value!), BigInt(0))
    : null;
  const observedHasMissingRows = selected.observed.some((row) => row.rowsMissing > 0 || row.blankShareFlagged);
  // A valued subtotal remains useful with the explicit coverage flag, but is
  // not a complete denominator for a year-over-year comparison.
  const delta = observedCents === null || observedHasMissingRows ? null : annualCents - observedCents;
  return {
    annual: selected.annual,
    observed2025Annual: observedCents === null ? null : decimal(observedCents),
    observedHasMissingRows,
    observedMissingRows: selected.observed.reduce((sum, row) => sum + row.rowsMissing, 0),
    delta: delta === null ? null : decimal(delta),
    changePct: delta === null || observedCents === null || observedCents <= BigInt(0) ? null : percent(delta, observedCents),
    largestMonth: { month: largest.month, point: largest.point },
  };
}
