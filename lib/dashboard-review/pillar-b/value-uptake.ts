// Shaping for the biosimilar/reference value-uptake view.
//
// PURE. RPC rows in, view model out. That is what lets the harness reconcile
// every plotted value against the frozen workbook without a browser: it calls
// these same functions on the same rows the page does.
//
// THE ONE THING THIS MODULE EXISTS TO PREVENT. There are two denominators and
// they answer different questions. On this release they differ by 19.5 points
// — date-valid 39.48%, locally observed 58.99% — so publishing either alone
// would misstate adoption by a fifth of the measure. `uptakePair` therefore
// returns both or neither; there is no function here that yields one.

import type { ValueUptakeRow } from "./rpc";

/** Named for the reader, not for the column. */
export const VALIDITY_LABELS = {
  inside: "Periodo valido",
  predates_window: "Autorizzazione anteriore alla finestra",
  boundary: "Validità a metà mese",
  outside: "Non ancora di riferimento",
  unknown: "Data non disponibile",
} as const;

const n = (v: number | null | undefined): number => (v === null || v === undefined ? 0 : v);

export interface UptakeMeasure {
  biosimilar: number;
  reference: number;
  denominator: number;
  /** null when the denominator is zero — a share of nothing is not 0%. */
  share: number | null;
}

function measure(biosimilar: number, reference: number): UptakeMeasure {
  const denominator = biosimilar + reference;
  return {
    biosimilar, reference, denominator,
    share: denominator === 0 ? null : biosimilar / denominator,
  };
}

export interface ValueUptakeView {
  /** Months at or after the product's recorded validity. */
  dateValid: UptakeMeasure;
  /**
   * Months at or after the first biosimilar dispensing observed IN THE CALLER'S
   * OWN SCOPE. For an Azienda that is its own first switch, not the Region's.
   */
  locallyObserved: UptakeMeasure;
  /** Isolated: validity lands mid-month and a monthly total cannot be split. */
  boundary: { biosimilar: number; reference: number; total: number };
  /** Undated and not on the evidence list. Counted as valid by nobody. */
  unknown: { biosimilar: number; reference: number; total: number };
  /** Not yet a reference: no biosimilar of the substance existed anywhere. */
  outside: { biosimilar: number; reference: number; total: number };
  /** Authorised before the observation window — the ten enoxaparin AICs. */
  predates: { biosimilar: number; reference: number; total: number };
  rows: SubstanceRow[];
  substances: number;
  perimeterRows: number;
}

export interface SubstanceRow {
  substance: string;
  dateValid: UptakeMeasure;
  locallyObserved: UptakeMeasure;
  boundary: number;
  unknown: number;
  outside: number;
  /** `year*12+month` of the first local dispensing, or null if never observed. */
  firstLocalMonthKey: number | null;
  /** "2024-03", or null. */
  firstLocalLabel: string | null;
}

function monthLabel(key: number | null): string | null {
  if (key === null) return null;
  const year = Math.floor((key - 1) / 12);
  const month = key - year * 12;
  return `${year}-${String(month).padStart(2, "0")}`;
}

export function buildValueUptake(rows: ReadonlyArray<ValueUptakeRow>): ValueUptakeView {
  const out: SubstanceRow[] = rows.map((r) => {
    const dvBio = n(r.inside_biosimilar_eur) + n(r.predates_biosimilar_eur);
    const dvRef = n(r.inside_reference_eur) + n(r.predates_reference_eur);
    return {
      substance: r.active_substance,
      dateValid: measure(dvBio, dvRef),
      locallyObserved: measure(n(r.window_biosimilar_eur), n(r.window_reference_eur)),
      boundary: n(r.boundary_biosimilar_eur) + n(r.boundary_reference_eur),
      unknown: n(r.unknown_biosimilar_eur) + n(r.unknown_reference_eur),
      outside: n(r.outside_biosimilar_eur) + n(r.outside_reference_eur),
      firstLocalMonthKey: r.first_local_month_key,
      firstLocalLabel: monthLabel(r.first_local_month_key),
    };
  });

  const sum = (f: (r: ValueUptakeRow) => number) => rows.reduce((a, r) => a + f(r), 0);
  return {
    dateValid: measure(
      sum((r) => n(r.inside_biosimilar_eur) + n(r.predates_biosimilar_eur)),
      sum((r) => n(r.inside_reference_eur) + n(r.predates_reference_eur))),
    locallyObserved: measure(
      sum((r) => n(r.window_biosimilar_eur)),
      sum((r) => n(r.window_reference_eur))),
    boundary: {
      biosimilar: sum((r) => n(r.boundary_biosimilar_eur)),
      reference: sum((r) => n(r.boundary_reference_eur)),
      total: sum((r) => n(r.boundary_biosimilar_eur) + n(r.boundary_reference_eur)),
    },
    unknown: {
      biosimilar: sum((r) => n(r.unknown_biosimilar_eur)),
      reference: sum((r) => n(r.unknown_reference_eur)),
      total: sum((r) => n(r.unknown_biosimilar_eur) + n(r.unknown_reference_eur)),
    },
    outside: {
      biosimilar: sum((r) => n(r.outside_biosimilar_eur)),
      reference: sum((r) => n(r.outside_reference_eur)),
      total: sum((r) => n(r.outside_biosimilar_eur) + n(r.outside_reference_eur)),
    },
    predates: {
      biosimilar: sum((r) => n(r.predates_biosimilar_eur)),
      reference: sum((r) => n(r.predates_reference_eur)),
      total: sum((r) => n(r.predates_biosimilar_eur) + n(r.predates_reference_eur)),
    },
    rows: out.sort((a, b) => b.dateValid.denominator - a.dateValid.denominator),
    substances: rows.length,
    perimeterRows: sum((r) => r.perimeter_rows),
  };
}

// ------------------------------------------------------------------- filters

export const CHANNELS = ["CO", "DD", "DPC"] as const;

export interface UptakeFilterState {
  year: 2024 | 2025 | null;
  channel: string | null;
  substance: string | null;
}

/**
 * Read filter state from the URL.
 *
 * 2026 IS NOT ACCEPTED. It holds five months and zero comparable-eligible rows,
 * so it cannot be a year in a comparison. A hand-edited `?anno=2026` is dropped
 * rather than honoured — a filter the UI will not offer must not be reachable
 * by typing it, or the one guard that keeps a part-year out of a full-year
 * comparison would be a convention rather than a rule.
 */
export function parseFilters(
  params: Record<string, string | string[] | undefined>,
): UptakeFilterState {
  const one = (k: string): string | null => {
    const v = params[k];
    const s = Array.isArray(v) ? v[0] : v;
    return s === undefined || s === "" ? null : s;
  };
  const rawYear = one("anno");
  const year = rawYear === "2024" ? 2024 : rawYear === "2025" ? 2025 : null;
  const rawChannel = one("canale");
  const channel = rawChannel !== null && (CHANNELS as readonly string[]).includes(rawChannel)
    ? rawChannel
    : null;
  return { year, channel, substance: one("molecola") };
}

/** Build a shareable query string. Absent keys mean "all". */
export function filterHref(
  base: string, state: UptakeFilterState, patch: Partial<UptakeFilterState>,
): string {
  const next = { ...state, ...patch };
  const q = new URLSearchParams();
  if (next.year !== null) q.set("anno", String(next.year));
  if (next.channel !== null) q.set("canale", next.channel);
  if (next.substance !== null) q.set("molecola", next.substance);
  const s = q.toString();
  return s === "" ? base : `${base}?${s}`;
}

export function activeFilterCount(state: UptakeFilterState): number {
  return [state.year, state.channel, state.substance].filter((v) => v !== null).length;
}

/** What the current selection covers, in words, for the scope line. */
export function describeFilters(state: UptakeFilterState): string {
  const parts: string[] = [];
  parts.push(state.year === null ? "2024 e 2025" : String(state.year));
  parts.push(state.channel === null ? "tutti i canali" : state.channel);
  if (state.substance !== null) parts.push(state.substance);
  return parts.join(" · ");
}

// ------------------------------------------------- the "both years" default

/**
 * Merge two per-year results into one.
 *
 * WHY THIS EXISTS, and it is not a convenience. The RPC's year predicate is
 * `(p_year is null or cf.year = p_year)` with NO upper bound, so passing null
 * aggregates every year the release holds — which is 2024, 2025 **and
 * January–May 2026**. The default chip reads "2024 e 2025" and the scope pill
 * repeats it, so a null year published a 29-month figure under a 24-month
 * label: 39,48% where the labelled scope is 37,70%, a 1,79-point overstatement,
 * with 2026 contributing €6.112.176,41 biosimilar and €6.594.771,54 reference.
 *
 * `parseFilters` already refuses a hand-edited `?anno=2026`; that guard was
 * bypassed by the state the page loads in by default, which is worse, because
 * nobody has to do anything unusual to see it.
 *
 * So "both years" is two explicit calls, merged here. It is NOT `p_year = null`.
 *
 * The opening month is identical in both calls by construction: the RPC's
 * `opened` CTE reads `canonical_fact` without the year filter, so a 2024 switch
 * is still 2024 in the 2025 call. The merge takes the earliest non-null anyway,
 * so it stays correct even if that ever changes.
 */
export function mergeValueUptakeRows(
  ...sets: ReadonlyArray<ReadonlyArray<ValueUptakeRow>>
): ValueUptakeRow[] {
  const bySubstance = new Map<string, ValueUptakeRow>();
  const addNullable = (a: number | null, b: number | null): number | null =>
    a === null && b === null ? null : (a ?? 0) + (b ?? 0);

  for (const set of sets) {
    for (const row of set) {
      const prior = bySubstance.get(row.active_substance);
      if (prior === undefined) {
        bySubstance.set(row.active_substance, { ...row });
        continue;
      }
      bySubstance.set(row.active_substance, {
        active_substance: row.active_substance,
        inside_biosimilar_eur: addNullable(prior.inside_biosimilar_eur, row.inside_biosimilar_eur),
        inside_reference_eur: addNullable(prior.inside_reference_eur, row.inside_reference_eur),
        predates_biosimilar_eur: addNullable(prior.predates_biosimilar_eur, row.predates_biosimilar_eur),
        predates_reference_eur: addNullable(prior.predates_reference_eur, row.predates_reference_eur),
        boundary_biosimilar_eur: addNullable(prior.boundary_biosimilar_eur, row.boundary_biosimilar_eur),
        boundary_reference_eur: addNullable(prior.boundary_reference_eur, row.boundary_reference_eur),
        outside_biosimilar_eur: addNullable(prior.outside_biosimilar_eur, row.outside_biosimilar_eur),
        outside_reference_eur: addNullable(prior.outside_reference_eur, row.outside_reference_eur),
        unknown_biosimilar_eur: addNullable(prior.unknown_biosimilar_eur, row.unknown_biosimilar_eur),
        unknown_reference_eur: addNullable(prior.unknown_reference_eur, row.unknown_reference_eur),
        window_biosimilar_eur: addNullable(prior.window_biosimilar_eur, row.window_biosimilar_eur),
        window_reference_eur: addNullable(prior.window_reference_eur, row.window_reference_eur),
        first_local_month_key:
          prior.first_local_month_key === null ? row.first_local_month_key
          : row.first_local_month_key === null ? prior.first_local_month_key
          : Math.min(prior.first_local_month_key, row.first_local_month_key),
        perimeter_rows: prior.perimeter_rows + row.perimeter_rows,
        undated_rows: prior.undated_rows + row.undated_rows,
      });
    }
  }
  return [...bySubstance.values()];
}

/** The years a null (default) selection covers. Never includes 2026. */
export const DEFAULT_YEARS: ReadonlyArray<2024 | 2025> = [2024, 2025];
