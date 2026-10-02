// Shaping for pillar_b_facets: one jsonb row in, view models out.
//
// PURE. The harness drives these on the same jsonb the page receives and
// compares the result to the frozen workbook (sheets 03–07 and 10), so a
// change here that moved a plotted value would fail a reconciliation before
// it reached a reader.
//
// THE DISTINCTION THIS MODULE KEEPS. A month with no record is `null`, not 0:
// the calendar renders it as "not observed", never as a zero-spend month. A
// facet carries reported spend (gross, VAT-inclusive, pre-payback) and the
// comparable-eligible share of it. It never carries a quantity.

export interface FacetMonth {
  year: number;
  month: number;
  /** year*12+month, the same key the RPCs use. */
  key: number;
  spend_eur: number | null;
  rows_n: number;
  comparable_spend_eur: number | null;
  biosimilar_eur: number | null;
  reference_eur: number | null;
}

export interface FacetAsl {
  asl_code: string;
  year: number;
  spend_eur: number | null;
  rows_n: number;
  comparable_spend_eur: number | null;
  biosimilar_eur: number | null;
  reference_eur: number | null;
}

export interface FacetChannel {
  channel: string;
  year: number;
  spend_eur: number | null;
  rows_n: number;
  comparable_spend_eur: number | null;
  biosimilar_eur: number | null;
  reference_eur: number | null;
}

export interface FacetPerimeter {
  perimeter_status: string;
  aic_count: number;
  rows_n: number;
  spend_eur: number | null;
}

export interface FacetMolecule {
  /** null = rows whose substance is not recorded (EUR 2.9M on R2). Never relabelled. */
  active_substance: string | null;
  spend_eur: number | null;
  rows_n: number;
  comparable_spend_eur: number | null;
  in_perimeter: boolean;
}

export interface FacetTotals {
  spend_eur: number | null;
  rows_n: number;
  comparable_spend_eur: number | null;
  asl_count: number;
  substance_count: number;
}

export interface Facets {
  release: string;
  years: number[];
  totals: FacetTotals;
  months: FacetMonth[] | null;
  asl: FacetAsl[] | null;
  channelsByYear: FacetChannel[] | null;
  perimeter: FacetPerimeter[] | null;
  molecules: FacetMolecule[] | null;
}

const num = (v: unknown): number | null => {
  if (v === null || v === undefined) return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
};
const count = (v: unknown): number => num(v) ?? 0;
const str = (v: unknown): string => String(v ?? "");

type J = Record<string, unknown>;
const arr = (v: unknown): J[] | null => (Array.isArray(v) ? (v as J[]) : null);

/** Coerce the jsonb payload. Numerics may arrive as strings; see rpc.ts. */
export function parseFacets(raw: unknown): Facets {
  if (raw === null || typeof raw !== "object") {
    throw new Error("pillar_b_facets returned a non-object payload");
  }
  const j = raw as J;
  const t = (j.totals ?? {}) as J;
  return {
    release: str(j.release),
    years: (arr(j.years) ?? []).map((y) => count(y)),
    totals: {
      spend_eur: num(t.spend_eur),
      rows_n: count(t.rows_n),
      comparable_spend_eur: num(t.comparable_spend_eur),
      asl_count: count(t.asl_count),
      substance_count: count(t.substance_count),
    },
    months: arr(j.months)?.map((m) => ({
      year: count(m.year), month: count(m.month), key: count(m.key),
      spend_eur: num(m.spend_eur), rows_n: count(m.rows_n),
      comparable_spend_eur: num(m.comparable_spend_eur),
      biosimilar_eur: num(m.biosimilar_eur), reference_eur: num(m.reference_eur),
    })) ?? null,
    asl: arr(j.asl)?.map((a) => ({
      asl_code: str(a.asl_code), year: count(a.year),
      spend_eur: num(a.spend_eur), rows_n: count(a.rows_n),
      comparable_spend_eur: num(a.comparable_spend_eur),
      biosimilar_eur: num(a.biosimilar_eur), reference_eur: num(a.reference_eur),
    })) ?? null,
    channelsByYear: arr(j.channels_by_year)?.map((c) => ({
      channel: str(c.channel), year: count(c.year),
      spend_eur: num(c.spend_eur), rows_n: count(c.rows_n),
      comparable_spend_eur: num(c.comparable_spend_eur),
      biosimilar_eur: num(c.biosimilar_eur), reference_eur: num(c.reference_eur),
    })) ?? null,
    perimeter: arr(j.perimeter)?.map((p) => ({
      perimeter_status: str(p.perimeter_status), aic_count: count(p.aic_count),
      rows_n: count(p.rows_n), spend_eur: num(p.spend_eur),
    })) ?? null,
    molecules: arr(j.molecules)?.map((m) => ({
      active_substance: m.active_substance === null || m.active_substance === undefined
        ? null : str(m.active_substance),
      spend_eur: num(m.spend_eur),
      rows_n: count(m.rows_n), comparable_spend_eur: num(m.comparable_spend_eur),
      in_perimeter: Boolean(m.in_perimeter),
    })) ?? null,
  };
}

// ------------------------------------------------------------- calendar grid

export interface CalendarCell {
  year: number;
  month: number;
  /** null = no record in that month. Distinct from a zero. */
  spend_eur: number | null;
  rows_n: number;
  comparable_share: number | null;
  /** True for a year the release does not hold in full. */
  partial: boolean;
}

export interface CalendarRow {
  year: number;
  partial: boolean;
  monthsObserved: number;
  cells: CalendarCell[];
  /** Sum over observed months; null when none observed. */
  total_eur: number | null;
}

/** The release's complete years. 2026 is observed, but only through May. */
export const COMPLETE_YEARS: ReadonlyArray<number> = [2024, 2025];

/**
 * One row per year, twelve cells each. A year row is marked partial when it is
 * not a complete year of the release, and its total is labelled by the caller
 * as a partial-period figure — never set beside a full year as if comparable.
 */
export function calendarRows(months: ReadonlyArray<FacetMonth>): CalendarRow[] {
  const byYear = new Map<number, FacetMonth[]>();
  for (const m of months) {
    const list = byYear.get(m.year) ?? [];
    list.push(m);
    byYear.set(m.year, list);
  }
  return [...byYear.keys()].sort((a, b) => a - b).map((year) => {
    const observed = byYear.get(year) ?? [];
    const partial = !COMPLETE_YEARS.includes(year);
    const cells: CalendarCell[] = Array.from({ length: 12 }, (_, i) => {
      const m = observed.find((o) => o.month === i + 1);
      const spend = m?.spend_eur ?? null;
      return {
        year, month: i + 1,
        spend_eur: m ? spend : null,
        rows_n: m?.rows_n ?? 0,
        comparable_share: m && spend !== null && spend !== 0 && m.comparable_spend_eur !== null
          ? m.comparable_spend_eur / spend : null,
        partial,
      };
    });
    const observedSpend = cells.filter((c) => c.spend_eur !== null);
    return {
      year, partial,
      monthsObserved: observedSpend.length,
      cells,
      total_eur: observedSpend.length === 0
        ? null : observedSpend.reduce((s, c) => s + (c.spend_eur ?? 0), 0),
    };
  });
}

// --------------------------------------------------------------- by Azienda

export interface AslBreakdownRow {
  asl_code: string;
  label: string;
  /** Sum across the selected years. */
  spend_eur: number;
  rows_n: number;
  comparable_share: number | null;
  // Perimeter spend by STATUS, carried for totals only. Deliberately no ratio
  // of the two: biosimilar / (biosimilar + reference) without the monthly
  // validity rule would be a third adoption denominator, matching neither
  // published measure. Adoption per Azienda comes from the value-uptake RPC.
  biosimilar_eur: number;
  reference_eur: number;
  byYear: Record<number, number>;
}

/**
 * Spend per Azienda across the selected years.
 *
 * @param label resolves an asl_code to the name the reader may see. The page
 *   passes the pseudonymised map, so this module never decides who may be named.
 */
export function aslBreakdown(
  rows: ReadonlyArray<FacetAsl>, label: (aslCode: string) => string,
): AslBreakdownRow[] {
  const by = new Map<string, AslBreakdownRow>();
  for (const r of rows) {
    const cur = by.get(r.asl_code) ?? {
      asl_code: r.asl_code, label: label(r.asl_code),
      spend_eur: 0, rows_n: 0, comparable_share: null,
      biosimilar_eur: 0, reference_eur: 0, byYear: {},
    };
    cur.spend_eur += r.spend_eur ?? 0;
    cur.rows_n += r.rows_n;
    cur.biosimilar_eur += r.biosimilar_eur ?? 0;
    cur.reference_eur += r.reference_eur ?? 0;
    cur.byYear[r.year] = (cur.byYear[r.year] ?? 0) + (r.spend_eur ?? 0);
    by.set(r.asl_code, cur);
  }
  // comparable share needs the comparable sum, which the merge above did not
  // keep; recompute from the rows so the share is over the same total.
  for (const row of by.values()) {
    const cmp = rows.filter((r) => r.asl_code === row.asl_code)
      .reduce((s, r) => s + (r.comparable_spend_eur ?? 0), 0);
    row.comparable_share = row.spend_eur === 0 ? null : cmp / row.spend_eur;
  }
  return [...by.values()].sort((a, b) => b.spend_eur - a.spend_eur);
}

// --------------------------------------------------------------- by channel

export interface ChannelMixRow {
  channel: string;
  spend_eur: number;
  share: number | null;
  byYear: Record<number, number>;
  comparable_share: number | null;
}

export function channelMix(rows: ReadonlyArray<FacetChannel>): ChannelMixRow[] {
  const by = new Map<string, ChannelMixRow>();
  const cmp = new Map<string, number>();
  for (const r of rows) {
    const cur = by.get(r.channel) ?? {
      channel: r.channel, spend_eur: 0, share: null, byYear: {}, comparable_share: null,
    };
    cur.spend_eur += r.spend_eur ?? 0;
    cur.byYear[r.year] = (cur.byYear[r.year] ?? 0) + (r.spend_eur ?? 0);
    cmp.set(r.channel, (cmp.get(r.channel) ?? 0) + (r.comparable_spend_eur ?? 0));
    by.set(r.channel, cur);
  }
  const total = [...by.values()].reduce((s, r) => s + r.spend_eur, 0);
  for (const row of by.values()) {
    row.share = total === 0 ? null : row.spend_eur / total;
    row.comparable_share = row.spend_eur === 0 ? null : (cmp.get(row.channel) ?? 0) / row.spend_eur;
  }
  const order = ["CO", "DD", "DPC"];
  return [...by.values()].sort((a, b) => order.indexOf(a.channel) - order.indexOf(b.channel));
}

// ----------------------------------------------------------------- perimeter

export const PERIMETER_LABELS: Record<string, string> = {
  biosimilar: "Biosimilare",
  reference_medicine: "Medicinale di riferimento",
  non_biosimilar_same_substance: "Stessa sostanza, non biosimilare",
  unresolved: "Stato non stabilito",
  outside_biosimilar_perimeter: "Fuori dal perimetro biosimilare",
  unclassified: "Non classificato",
};

export interface PerimeterRow extends FacetPerimeter {
  label: string;
  share: number | null;
}

export function perimeterRows(rows: ReadonlyArray<FacetPerimeter>): PerimeterRow[] {
  const total = rows.reduce((s, r) => s + (r.spend_eur ?? 0), 0);
  return rows.map((r) => ({
    ...r,
    label: PERIMETER_LABELS[r.perimeter_status] ?? r.perimeter_status,
    share: total === 0 || r.spend_eur === null ? null : r.spend_eur / total,
  }));
}
