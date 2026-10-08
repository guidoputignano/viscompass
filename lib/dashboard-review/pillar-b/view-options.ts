// Local view options: the per-panel controls that change HOW a panel reads
// data the reader already holds, not WHICH data is fetched.
//
// PURE. Parsed from the URL on the server (so a shared link renders the right
// state) and updated in the browser with history.replaceState (so a toggle
// does not cost a server round trip). Each option has a closed list of values
// and a default; anything else in the URL is dropped, never honoured.
//
// WHAT THESE MAY AND MAY NOT DO. They re-sort, re-slice, re-colour or narrow
// the SAME rows the server shaped and the harness reconciled. None of them
// forms a new ratio. In particular the calendar's "perimetro" metric shows the
// perimeter SPEND of a month (biosimilar + reference by status), never a
// biosimilar share of it: that share would be an adoption ratio without the
// monthly validity rule — a third denominator.

import type { Concentration, TrendRow } from "./review-data";
import type { AziendaPanelRow, CalendarCell, CalendarRow } from "./facets";
import type { VolumePanelRow } from "./adoption";

export const CALENDAR_METRICS = ["spesa", "comparabile", "perimetro"] as const;
export type CalendarMetric = (typeof CALENDAR_METRICS)[number];
export const MONTH_VIEWS = ["confronto", "2024", "2025", "2026"] as const;
export type MonthView = (typeof MONTH_VIEWS)[number];

export const AZIENDA_METRICS = ["spesa", "comparabile", "record"] as const;
export type AziendaMetric = (typeof AZIENDA_METRICS)[number];

export const TREND_ORDERS = ["delta", "pct", "spesa"] as const;
export type TrendOrder = (typeof TREND_ORDERS)[number];

export const TREND_LIMITS = [10, 25, 50] as const;
export type TrendLimit = (typeof TREND_LIMITS)[number];

export const PERIMETER_MODES = ["tutto", "biosimilare"] as const;
export type PerimeterMode = (typeof PERIMETER_MODES)[number];

export const CONCENTRATION_YEARS = [2024, 2025] as const;
export type ConcentrationYear = (typeof CONCENTRATION_YEARS)[number];

export interface ViewOptions {
  calendar: CalendarMetric;
  monthView: MonthView;
  azienda: AziendaMetric;
  trendOrder: TrendOrder;
  trendLimit: TrendLimit;
  perimeter: PerimeterMode;
  concentrationYear: ConcentrationYear;
  /**
   * The concentration panel's own perimeter switch. A separate key from the
   * trend panel's: two panels holding separate state behind one URL key would
   * read differently after a click until a reload.
   */
  concentrationPerimeter: PerimeterMode;
  /** A route of administration for the volume table, or null for all. */
  route: string | null;
}

/** URL keys. Short, Italian, and distinct from the global filter keys. */
export const VIEW_OPTION_KEYS = {
  calendar: "cal",
  monthView: "serie",
  azienda: "az",
  trendOrder: "ord",
  trendLimit: "n",
  perimeter: "perimetro",
  concentrationYear: "conc",
  concentrationPerimeter: "concperimetro",
  route: "via",
} as const;

export const VIEW_OPTION_DEFAULTS: Omit<ViewOptions, "concentrationYear" | "route"> = {
  calendar: "spesa",
  monthView: "confronto",
  azienda: "spesa",
  trendOrder: "delta",
  trendLimit: 10,
  perimeter: "tutto",
  concentrationPerimeter: "tutto",
};

type Params = Record<string, string | string[] | undefined>;
const one = (params: Params, key: string): string | null => {
  const v = params[key];
  const s = Array.isArray(v) ? v[0] : v;
  return s === undefined || s === "" ? null : s;
};
function pick<T extends string | number>(raw: string | null, allowed: ReadonlyArray<T>, fallback: T): T {
  if (raw === null) return fallback;
  const hit = allowed.find((a) => String(a) === raw);
  return hit === undefined ? fallback : hit;
}

/**
 * Parse the local options.
 *
 * @param routes the routes present in the volume rows under the active
 *   filters; a `via` naming anything else is dropped, so the table can never
 *   be narrowed to a route it does not contain and read as empty by accident.
 *   With fewer than two routes there is nothing to choose, and `via` is
 *   dropped too: a filter with one option is no filter.
 * @param defaultYear the concentration year when the URL names none: the
 *   latest year in the global selection.
 */
export function parseViewOptions(
  params: Params, routes: ReadonlyArray<string>, defaultYear: ConcentrationYear,
): ViewOptions {
  const rawRoute = one(params, VIEW_OPTION_KEYS.route);
  const monthView = pick(one(params, VIEW_OPTION_KEYS.monthView), MONTH_VIEWS, VIEW_OPTION_DEFAULTS.monthView);
  const requestedCalendar = pick(one(params, VIEW_OPTION_KEYS.calendar), CALENDAR_METRICS, VIEW_OPTION_DEFAULTS.calendar);
  return {
    calendar: monthView === "2026" && requestedCalendar === "comparabile" ? "spesa" : requestedCalendar,
    monthView,
    azienda: pick(one(params, VIEW_OPTION_KEYS.azienda), AZIENDA_METRICS, VIEW_OPTION_DEFAULTS.azienda),
    trendOrder: pick(one(params, VIEW_OPTION_KEYS.trendOrder), TREND_ORDERS, VIEW_OPTION_DEFAULTS.trendOrder),
    trendLimit: pick(one(params, VIEW_OPTION_KEYS.trendLimit), TREND_LIMITS, VIEW_OPTION_DEFAULTS.trendLimit),
    perimeter: pick(one(params, VIEW_OPTION_KEYS.perimeter), PERIMETER_MODES, VIEW_OPTION_DEFAULTS.perimeter),
    concentrationYear: pick(one(params, VIEW_OPTION_KEYS.concentrationYear), CONCENTRATION_YEARS, defaultYear),
    concentrationPerimeter: pick(one(params, VIEW_OPTION_KEYS.concentrationPerimeter), PERIMETER_MODES, VIEW_OPTION_DEFAULTS.concentrationPerimeter),
    route: rawRoute !== null && routes.length > 1 && routes.includes(rawRoute) ? rawRoute : null,
  };
}

/**
 * The local option entries present in a query string, and nothing else. The
 * filter bar appends these to every global-filter navigation so a panel's
 * choice survives a change of Azienda, period, channel or molecule; the
 * server re-parses them against the new rows (a route that no longer exists
 * is dropped there).
 */
export function localOptionParams(search: string): URLSearchParams {
  const q = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const out = new URLSearchParams();
  for (const key of Object.values(VIEW_OPTION_KEYS)) {
    const v = q.get(key);
    if (v !== null && v !== "") out.set(key, v);
  }
  return out;
}

/**
 * The query string with one option set, keeping every other parameter. A
 * default value removes its key, so a link never carries noise.
 */
export function withViewOption(
  search: string, key: string, value: string | number | null, defaultValue: string | number | null,
): string {
  const q = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  if (value === null || String(value) === String(defaultValue)) q.delete(key);
  else q.set(key, String(value));
  const s = q.toString();
  return s === "" ? "" : `?${s}`;
}

// ------------------------------------------------------------------ trends

/**
 * Sort a trend. Null rates (change from a zero base) go last, never first.
 * Ties break by 2025 spend, then by key, so the top-N cut is the same on
 * every run — the comparator is consistent (returns 0 for equal rows), as
 * Array.prototype.sort requires.
 */
export function sortTrend(rows: ReadonlyArray<TrendRow>, order: TrendOrder): TrendRow[] {
  const rate = (r: TrendRow) => (r.change === null ? -1 : Math.abs(r.change));
  const primary: (a: TrendRow, b: TrendRow) => number = order === "delta"
    ? (a, b) => Math.abs(b.changeEur) - Math.abs(a.changeEur)
    : order === "pct"
      ? (a, b) => rate(b) - rate(a)
      : (a, b) => b.spend2025 - a.spend2025;
  return [...rows].sort((a, b) =>
    primary(a, b) || (b.spend2025 - a.spend2025) || a.key.localeCompare(b.key));
}

export const TREND_ORDER_LABELS: Record<TrendOrder, string> = {
  delta: "variazione in euro",
  pct: "variazione in percentuale",
  spesa: "spesa 2025",
};

/** A figure the chart prints beside a row: euros, a rate, or "not calculable". */
export type TrendFigure = { kind: "eur"; value: number } | { kind: "pct"; value: number } | { kind: "na" };

/**
 * What the molecule-change chart prints beside each row, following the
 * measure the reader sorted by — never a euro label under a percentage sort.
 * `primary` is the sort measure; `secondary` is the other reading, kept so
 * the euro change is never hidden. A rate over an absent or zero 2024 base
 * is "na": not calculable, not an invented percentage.
 */
export function trendFigures(row: Pick<TrendRow, "changeEur" | "change" | "spend2025">, order: TrendOrder): { primary: TrendFigure; secondary: TrendFigure | null } {
  const eur: TrendFigure = { kind: "eur", value: row.changeEur };
  const pct: TrendFigure = row.change === null ? { kind: "na" } : { kind: "pct", value: row.change };
  switch (order) {
    case "delta": return { primary: eur, secondary: pct };
    case "pct": return { primary: pct, secondary: eur };
    case "spesa": return { primary: { kind: "eur", value: row.spend2025 }, secondary: eur };
  }
}

/** The column heading for the primary figure under each sort. */
export const TREND_FIGURE_HEADINGS: Record<TrendOrder, string> = {
  delta: "variazione € · 2025 meno 2024",
  pct: "variazione % · su |spesa 2024|",
  spesa: "spesa 2025 della molecola",
};

/**
 * Keep only the substances of the biosimilar perimeter.
 *
 * SUBSTANCE-LEVEL, and said so wherever it is shown: the molecule rows carry
 * no perimeter status (that is a property of the product), so this keeps
 * every presentation of a perimeter substance, including the few that are
 * not themselves biosimilar or reference (sheet 07's 4 "same substance,
 * non-biosimilar" AICs). An AIC-exact perimeter needs a predicate
 * in the database and is not claimed here.
 */
export function perimeterOnly<T extends { key: string }>(
  rows: ReadonlyArray<T>, perimeterSubstances: ReadonlySet<string>,
): T[] {
  return rows.filter((r) => perimeterSubstances.has(r.key));
}

export const PERIMETER_MODE_LABELS: Record<PerimeterMode, string> = {
  tutto: "tutta la spesa",
  biosimilare: "molecole del perimetro biosimilare",
};

// ---------------------------------------------------------- concentration

/** A sampled point of the concentration curve. */
export interface ConcentrationSample { rank: number; cumulativeShare: number }

/**
 * The concentration view model slimmed for the browser: the top rows for
 * the table, the curve sampled at the ranks the chart draws, and the totals.
 * Everything else about it is unchanged; the chart draws the same points it
 * drew from the full ranking.
 */
export interface ConcentrationSlim {
  rows: Concentration["rows"];
  samples: ConcentrationSample[];
  totalEur: number;
  negativeMolecules: number;
  topFiveShare: number | null;
  moleculeCount: number;
}

export const CONCENTRATION_SAMPLE_RANKS = [1, 5, 10, 25, 50, 100, 250] as const;

export function slimConcentration(c: Concentration, tableRows = 25): ConcentrationSlim {
  const ranks = [...new Set([...CONCENTRATION_SAMPLE_RANKS, c.moleculeCount])]
    .filter((r) => r > 0 && r <= c.moleculeCount).sort((a, b) => a - b);
  return {
    rows: c.rows.slice(0, tableRows),
    samples: ranks.map((rank) => ({ rank, cumulativeShare: c.rows[rank - 1]?.cumulativeShare ?? 0 })),
    totalEur: c.totalEur,
    negativeMolecules: c.negativeMolecules,
    topFiveShare: c.topFiveShare,
    moleculeCount: c.moleculeCount,
  };
}

// ---------------------------------------------------------------- calendar

export const CALENDAR_METRIC_LABELS: Record<CalendarMetric, string> = {
  spesa: "spesa rendicontata",
  comparabile: "quota con quantità confrontabile",
  perimetro: "spesa nel perimetro biosimilare",
};

/**
 * The value a calendar cell shows under a metric. null = not observed. For
 * "comparabile" the value is a share in [0, 1]; for the others, euros.
 */
export function calendarCellValue(cell: CalendarCell, metric: CalendarMetric): number | null {
  if (cell.spend_eur === null) return null;
  switch (metric) {
    case "spesa": return cell.spend_eur;
    case "comparabile": return cell.comparable_share;
    case "perimetro": return cell.perimeter_eur;
  }
}

/**
 * What the monthly panel actually shows for a requested (period, metric):
 * the periods that hold records, the period drawn (the requested one, or the
 * first available when it has none), and the metric drawn. The 2026 rule is
 * applied to the EFFECTIVE period, not only to the URL: 2026 has no
 * comparable-quantity basis, so a fallback to 2026 draws spend.
 */
export function effectiveCalendarState(
  rows: ReadonlyArray<Pick<CalendarRow, "year" | "monthsObserved">>, view: MonthView, metric: CalendarMetric,
): { available: MonthView[]; view: MonthView; metric: CalendarMetric } {
  const years = rows.filter((r) => r.monthsObserved > 0).map((r) => String(r.year));
  const available = MONTH_VIEWS.filter((v) => (v === "confronto" ? years.includes("2024") && years.includes("2025") : years.includes(v)));
  const shown = available.includes(view) ? view : (available[0] ?? "confronto");
  return { available, view: shown, metric: shown === "2026" && metric === "comparabile" ? "spesa" : metric };
}

/** The month slots of a period: twelve for a complete year, the observed span for 2026. */
export function monthSlots(rows: ReadonlyArray<CalendarRow>, view: MonthView): number[] {
  if (view !== "2026") return Array.from({ length: 12 }, (_, i) => i + 1);
  const row = rows.find((r) => r.year === 2026);
  const last = row ? Math.max(0, ...row.cells.filter((c) => c.spend_eur !== null).map((c) => c.month)) : 0;
  return Array.from({ length: last }, (_, i) => i + 1);
}

/** Chart marks only: an absent month is omitted, never drawn as a zero bar. */
export function monthlyChartSeries(rows: ReadonlyArray<CalendarRow>, view: MonthView, metric: CalendarMetric) {
  const years = view === "confronto" ? [2024, 2025] : [Number(view)];
  return rows.filter((row) => years.includes(row.year)).flatMap((row) =>
    row.cells.flatMap((cell) => {
      const value = calendarCellValue(cell, metric);
      return value === null ? [] : [{ year: row.year, month: cell.month, value }];
    }));
}

const MONTH_ABBR = ["gen", "feb", "mar", "apr", "mag", "giu", "lug", "ago", "set", "ott", "nov", "dic"];

/**
 * The partial year named by the months it actually holds under the active
 * filters — "gen–mag 2026 · dati osservati" — never "parziale" alone, never
 * "primo semestre" (six months), never a year to compare against 2024/2025.
 * The span runs from the first to the last observed month; a gap inside it
 * is a month without record, which the chart shows as a missing bar.
 */
export function partialPeriodLabel(
  rows: ReadonlyArray<Pick<CalendarRow, "year" | "cells">>, year = 2026,
): string {
  const row = rows.find((r) => r.year === year);
  const months = row ? row.cells.filter((c) => c.spend_eur !== null).map((c) => c.month) : [];
  if (months.length === 0) return `${year} · nessun mese osservato`;
  const first = Math.min(...months), last = Math.max(...months);
  const span = first === last ? MONTH_ABBR[first - 1] : `${MONTH_ABBR[first - 1]}–${MONTH_ABBR[last - 1]}`;
  return `${span} ${year} · dati osservati`;
}

/**
 * The three sentences that speak about the partial year, for the state the
 * calendar actually shows. Under a filter with no 2026 record the span label
 * would read "2026 · nessun mese osservato", and sentences built around it
 * ("compaiono solo nel calendario") would be false: that state gets its own
 * wording. Without the calendar facet the release-wide five months stand.
 */
export function partialYearCopy(
  rows: ReadonlyArray<Pick<CalendarRow, "year" | "cells">> | null, year = 2026,
): { observed: boolean; label: string; header: string; distributionLead: string; limitsNote: string } {
  if (rows === null) {
    // The facet is unavailable, so there is no calendar on the page: the
    // release-wide five months, and no sentence that points to a calendar.
    const label = `gen–mag ${year} · dati osservati`;
    return {
      observed: true, label,
      header: `${label} fuori dai confronti annuali`,
      distributionLead: `Il calendario mensile non è disponibile in questa versione; il ${year} (${label}) non entra nel confronto annuale.`,
      limitsNote: `${label}: zero record con quantità confrontabile. Il calendario mensile non è disponibile in questa versione; il ${year} non entra nei confronti annuali e non è un «primo semestre».`,
    };
  }
  const label = partialPeriodLabel(rows, year);
  const observed = rows.find((r) => r.year === year)?.cells.some((c) => c.spend_eur !== null) ?? false;
  if (observed) {
    return {
      observed, label,
      header: `${label} fuori dai confronti annuali`,
      distributionLead: `I mesi osservati del ${year} (${label}) compaiono solo nel calendario, mai nel confronto annuale.`,
      limitsNote: `${label}: zero record con quantità confrontabile. Compare nel calendario, segnalato; non entra nei confronti annuali e non è un «primo semestre».`,
    };
  }
  return {
    observed, label,
    header: `${year}: nessun record in questa selezione`,
    distributionLead: `Nel ${year} nessun mese ha record in questa selezione: il calendario mostra solo gli anni completi, e il ${year} non entra comunque nel confronto annuale.`,
    limitsNote: `Il rilascio osserva gennaio–maggio ${year}, ma in questa selezione nessun mese del ${year} ha record. Quando ne ha, compare solo nel calendario: zero record con quantità confrontabile, mai nei confronti annuali, mai un «primo semestre».`,
  };
}

// ----------------------------------------------------------------- Azienda

export const AZIENDA_METRIC_LABELS: Record<AziendaMetric, string> = {
  spesa: "spesa per anno",
  comparabile: "quota con quantità confrontabile",
  record: "record",
};

/** A single-bar value per Azienda for the non-spend metrics; null = n/d. */
export function aziendaMetricValue(row: AziendaPanelRow, metric: Exclude<AziendaMetric, "spesa">): number | null {
  return metric === "comparabile" ? row.comparable_share : row.rows_n;
}

// ------------------------------------------------------------------- route

/** The routes present in the volume rows, in display order. */
export function routeOptions(rows: ReadonlyArray<Pick<VolumePanelRow, "route">>): string[] {
  return [...new Set(rows.map((r) => r.route))].sort((a, b) => a.localeCompare(b, "it"));
}

export function volumeByRoute<T extends Pick<VolumePanelRow, "route">>(rows: ReadonlyArray<T>, route: string | null): T[] {
  return route === null ? [...rows] : rows.filter((r) => r.route === route);
}
