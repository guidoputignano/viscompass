// Adoption view models: the dumbbell, the first-use timeline, and the
// per-molecule volume breakdown.
//
// PURE. Everything here is a re-arrangement of figures the RPC layer already
// returned and the harness already reconciled; no new quantity is computed.
//
// THE RULE THAT SHAPES THE VOLUME BREAKDOWN. Quantities are only ever added
// within one (substance, route, comparable_unit). The release carries mg, IU
// and units side by side; a sum across them is a number with no unit, and
// this module refuses to produce one by grouping on the unit itself.

import type { UptakeRow } from "./rpc";
import type { SubstanceRow, ValueUptakeView } from "./value-uptake";
import { formatNumber } from "@/lib/dashboard-review/format";

// ---------------------------------------------------------------- dumbbell

export interface DumbbellRow {
  substance: string;
  /** Biosimilar share of date-valid spend. null when the denominator is 0. */
  dateValid: number | null;
  /** Biosimilar share of locally-observed spend. null when never observed here. */
  locallyObserved: number | null;
  /** Reference spend still on the originator in date-valid months — the money the question is about. */
  referenceEur: number;
  denominatorEur: number;
  firstLocalLabel: string | null;
}

/**
 * One row per substance with both shares, ordered by the reference spend at
 * stake so the top of the chart is where the largest unused alternative is.
 */
export function dumbbellRows(view: ValueUptakeView): DumbbellRow[] {
  return view.rows
    .map((r: SubstanceRow) => ({
      substance: r.substance,
      dateValid: r.dateValid.share,
      locallyObserved: r.locallyObserved.share,
      referenceEur: r.dateValid.reference,
      denominatorEur: r.dateValid.denominator,
      firstLocalLabel: r.firstLocalLabel,
    }))
    .sort((a, b) => b.referenceEur - a.referenceEur);
}

/**
 * The opening phrase of the dumbbell's lead, counting by the SAME rule as the
 * numeric table below it (a molecule "has a measure" when either share is
 * defined), so the chart never calls all its rows measured while the table
 * lists fewer. Rows without a valid month are drawn too, and named as such.
 */
export function dumbbellCountPhrase(rows: ReadonlyArray<Pick<DumbbellRow, "dateValid" | "locallyObserved">>): string {
  const measured = rows.filter((r) => r.dateValid !== null || r.locallyObserved !== null).length;
  const without = rows.length - measured;
  const f = (k: number) => formatNumber(k, 0);
  const n = (k: number, one: string, many: string) => `${f(k)} ${k === 1 ? one : many}`;
  if (rows.length === 0) return "Nessuna molecola";
  if (measured === 0) return `${n(without, "molecola", "molecole")} senza mesi validi nel periodo`;
  if (without === 0) return measured === 1 ? "La molecola con almeno una misura" : `Tutte le ${f(measured)} molecole con almeno una misura`;
  return `${n(rows.length, "molecola", "molecole")}: ${f(measured)} con almeno una misura e ${f(without)} senza mesi validi nel periodo (indicat${without === 1 ? "a" : "e"} a destra, fuori dalla tabella delle quote)`;
}

/**
 * The dumbbell's whole lead for the rows it draws, or undefined when it draws
 * none (the chart then says so in its own empty state). It never points to a
 * table or to dots that the state does not render.
 */
export function dumbbellLead(rows: ReadonlyArray<Pick<DumbbellRow, "dateValid" | "locallyObserved">>): string | undefined {
  if (rows.length === 0) return undefined;
  const measured = rows.some((r) => r.dateValid !== null || r.locallyObserved !== null);
  if (!measured) {
    return `${dumbbellCountPhrase(rows)}: nessuna quota da disegnare. La spesa di riferimento a destra è quella dei mesi validi, qui nulla.`;
  }
  // The ordering clause agrees in number with what precedes it, and a single
  // row has no order to state.
  const order = rows.length > 1 ? ", ordinate per spesa di riferimento ancora sull'originatore" : "";
  return `${dumbbellCountPhrase(rows)}${order}. Grigio: quota 1, su mesi a validità riconosciuta. Verde: quota 2, su mesi con biosimilare già osservato qui. I valori esatti sono nella tabella numerica; i punti hanno un'etichetta per lettori di schermo.`;
}

/**
 * The first-use timeline's lead, or undefined when it draws no dot: the
 * lead describes dots and the window that starts at them, and the panel's
 * own sentences explain an empty timeline.
 */
export function timelineLead(model: Pick<TimelineModel, "rows">, followsAzienda: boolean): string | undefined {
  if (model.rows.length === 0) return undefined;
  return "Un punto per molecola, nel mese della prima dispensazione di un biosimilare osservata nel rilascio, nell'ambito visibile. La finestra della quota 2 parte da lì" + (followsAzienda
    ? ": segue l'Azienda selezionata, non i filtri di anno e canale."
    : ", calcolata sull'intero perimetro visibile: il filtro per Azienda non è applicato in questa vista.") + " Il rilascio inizia a gennaio 2024: un primo uso in quel mese può essere precedente (storia troncata a sinistra).";
}

// ---------------------------------------------------------------- timeline

export interface TimelineRow {
  substance: string;
  /** year*12+month of the first local biosimilar dispensing; null = never here. */
  firstKey: number | null;
  firstLabel: string | null;
  /** Reference spend in date-valid months: what was spendable on an alternative. */
  referenceEur: number;
  /** Biosimilar + reference spend in date-valid months of the selected period. */
  validEur: number;
  share: number | null;
}

export interface TimelineModel {
  /** Inclusive window the axis spans, as month keys. */
  fromKey: number;
  toKey: number;
  rows: TimelineRow[];
  /**
   * Never dispensed here although at least one month of the selected period
   * was date-valid — i.e. an authorised alternative existed and was not used.
   */
  neverObserved: TimelineRow[];
  /**
   * Never dispensed here AND no date-valid spend in the selected period.
   * Kept apart because neither authorisation nor an unused alternative can be
   * inferred from a zero spend denominator alone.
   */
  notYetValid: TimelineRow[];
}

/**
 * The first-local-use timeline over the release window.
 *
 * The window is the release's observed months — 2024-01 through 2026-05 — not
 * the filtered years, because the opening clock is independent of the year
 * filter (a 2024 switch is still a 2024 switch when the reader selects 2025).
 */
export function timelineModel(
  view: ValueUptakeView, window: { fromKey: number; toKey: number },
): TimelineModel {
  const rows: TimelineRow[] = view.rows.map((r) => ({
    substance: r.substance,
    firstKey: r.firstLocalMonthKey,
    firstLabel: r.firstLocalLabel,
    referenceEur: r.dateValid.reference,
    validEur: r.dateValid.denominator,
    share: r.dateValid.share,
  }));
  const never = rows.filter((r) => r.firstKey === null);
  return {
    fromKey: window.fromKey,
    toKey: window.toKey,
    rows: rows.filter((r) => r.firstKey !== null).sort((a, b) => a.firstKey! - b.firstKey!),
    // EXHAUSTIVE: a never-switched molecule whose valid-month spend nets below
    // zero (credit notes) still had valid months and no local biosimilar, so
    // it is listed here with its signed amount, not dropped from every list.
    neverObserved: never.filter((r) => r.validEur !== 0).sort((a, b) => b.referenceEur - a.referenceEur),
    notYetValid: never.filter((r) => r.validEur === 0).sort((a, b) => a.substance.localeCompare(b.substance)),
  };
}

/** "2024-03" from a month key. Kept here so the timeline needs no second helper. */
export function monthKeyLabel(key: number): string {
  const year = Math.floor((key - 1) / 12);
  const month = key - year * 12;
  return `${year}-${String(month).padStart(2, "0")}`;
}

// ------------------------------------------------------------- group counts

/**
 * How many (Azienda, substance, route, unit) groups the rows cover.
 *
 * The RPC returns one row per group PER YEAR, and the page concatenates the
 * selected years, so `rows.length` double-counts every group present in both
 * years. A count shown to a reader must be of groups, not of rows.
 */
export function distinctUptakeGroups(rows: ReadonlyArray<UptakeRow>): number {
  return new Set(rows.map((r) =>
    `${r.asl_code}\u0000${r.active_substance}\u0000${r.route}\u0000${r.comparable_unit}`)).size;
}

/** How many (Azienda, substance, reason) withheld groups the rows cover. */
export function distinctWithheldGroups(
  rows: ReadonlyArray<{ asl_code: string; active_substance: string; withheld_reason: string }>,
): number {
  return new Set(rows.map((r) =>
    `${r.asl_code}\u0000${r.active_substance}\u0000${r.withheld_reason}`)).size;
}

// ------------------------------------------------- volume uptake by molecule

export interface VolumeBreakdownRow {
  substance: string;
  route: string;
  unit: string;
  /** Number of Aziende contributing to this cell. */
  aslCount: number;
  wholePeriod: { biosimilar: number; total: number; share: number | null };
  window: { biosimilar: number; total: number; share: number | null };
  /** Earliest first-local key across the contributing Aziende; null if none opened. */
  firstKey: number | null;
}

/**
 * What the volume panel (a client component) may hold: the labels, the two
 * shares, the Azienda count and the first-use key. Not the summed quantities
 * behind the shares: the page shows no quantity total of any kind, and a
 * client prop is readable by anyone holding the page.
 */
export interface VolumePanelRow {
  substance: string;
  route: string;
  unit: string;
  aslCount: number;
  wholePeriodShare: number | null;
  windowShare: number | null;
  firstKey: number | null;
}

export function volumePanelRows(rows: ReadonlyArray<VolumeBreakdownRow>): VolumePanelRow[] {
  return rows.map((r) => ({
    substance: r.substance, route: r.route, unit: r.unit, aslCount: r.aslCount,
    wholePeriodShare: r.wholePeriod.share, windowShare: r.window.share, firstKey: r.firstKey,
  }));
}

function share(bio: number, total: number): number | null {
  return total === 0 ? null : bio / total;
}

/**
 * Per (substance, route, unit) over the visible Aziende, on both denominators.
 *
 * Summed across Aziende only where the unit is the same — the group key
 * includes it. A row whose quantity is null is "not observed" and contributes
 * nothing, which is different from contributing zero: the aslCount says how
 * many Aziende the cell rests on.
 */
export function volumeBreakdown(rows: ReadonlyArray<UptakeRow>): VolumeBreakdownRow[] {
  const by = new Map<string, VolumeBreakdownRow & { asls: Set<string> }>();
  for (const r of rows) {
    const key = `${r.active_substance}\u0000${r.route}\u0000${r.comparable_unit}`;
    const cur = by.get(key) ?? {
      substance: r.active_substance, route: r.route, unit: r.comparable_unit,
      aslCount: 0, asls: new Set<string>(),
      wholePeriod: { biosimilar: 0, total: 0, share: null },
      window: { biosimilar: 0, total: 0, share: null },
      firstKey: null,
    };
    if (r.whole_period_total_qty !== null) {
      cur.wholePeriod.biosimilar += r.whole_period_biosimilar_qty ?? 0;
      cur.wholePeriod.total += r.whole_period_total_qty;
      cur.asls.add(r.asl_code);
    }
    if (r.window_total_qty !== null) {
      cur.window.biosimilar += r.window_biosimilar_qty ?? 0;
      cur.window.total += r.window_total_qty;
    }
    if (r.first_local_biosimilar_key !== null) {
      cur.firstKey = cur.firstKey === null
        ? r.first_local_biosimilar_key
        : Math.min(cur.firstKey, r.first_local_biosimilar_key);
    }
    by.set(key, cur);
  }
  return [...by.values()].map((c) => ({
    substance: c.substance, route: c.route, unit: c.unit,
    aslCount: c.asls.size,
    wholePeriod: { ...c.wholePeriod, share: share(c.wholePeriod.biosimilar, c.wholePeriod.total) },
    window: { ...c.window, share: share(c.window.biosimilar, c.window.total) },
    firstKey: c.firstKey,
  })).sort((a, b) => b.wholePeriod.total - a.wholePeriod.total);
}
