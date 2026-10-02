// Typed read layer over the Gate 3 Pillar B RPCs.
//
// WHY THIS EXISTS. The legacy query layer reads `canonical_fact` directly and
// aggregates in JavaScript. That is how the package total, the partial-year
// comparison and the acquistato inversion all reached the page: each one was a
// reduce over rows that had not been through a comparability gate. These RPCs
// apply the gate in SQL, name what they excluded, and refuse to return a
// quantity whose unit is not established.
//
// Every function here is release-scoped by the RPC itself: each one filters on
// `pillar_b_release()`, which raises if no release is active. Nothing in this
// file can read across two releases, and nothing can read a release that has not
// been activated.
//
// WHAT THESE DELIBERATELY DO NOT RETURN:
//   - a package total, or any quantity summed across bases (see pillar_b_spend)
//   - an uptake figure without its withheld counterpart (see getUptake)
//   - a saving, an opportunity, or any recoverable-money figure
//   - 2026 as a year: it holds five months and zero comparable-eligible rows

import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

// Re-exported from the pure module, which owns the list so that it can be
// asserted without a database client. 2026 is not offered.
import type { PillarBYear } from "./review-data";
export { PILLAR_B_YEARS } from "./review-data";
export type { PillarBYear };

export interface SpendRow {
  asl_code: string;
  channel: string;
  rows_observed: number;
  spend_eur: number | null;
  rows_basis_packages: number;
  rows_basis_units: number;
  rows_basis_mixed: number;
  rows_basis_unknown: number;
  comparable_rows: number;
  comparable_spend_eur: number | null;
  negative_rows: number;
}

export interface FunnelStage {
  stage: string;
  step: number;
  rows_n: number;
  spend_eur: number | null;
  note: string;
}

export interface UptakeRow {
  asl_code: string;
  active_substance: string;
  route: string;
  comparable_unit: string;
  whole_period_biosimilar_qty: number | null;
  whole_period_total_qty: number | null;
  window_biosimilar_qty: number | null;
  window_total_qty: number | null;
  first_local_biosimilar_key: number | null;
  opening_evidence: string;
}

export interface WithheldRow {
  asl_code: string;
  active_substance: string;
  withheld_reason: string;
  rows_n: number;
  spend_eur: number | null;
}

export interface UptakeScope {
  rows_n: number;
  spend_eur: number | null;
  rows_basis_packages: number;
  rows_basis_units: number;
  rows_basis_mixed: number;
  rows_basis_unknown: number;
}

export interface PerimeterRow {
  perimeter_status: string;
  aic_count: number;
  rows_n: number;
  spend_eur: number | null;
}

/**
 * Postgres `numeric` reaches PostgREST as a JSON number, but the raw pg protocol
 * sends it as a string. Parse rather than trusting the declared type: `a + b` on
 * two strings concatenates silently and renders as a plausible figure. See the
 * same note on `release-scope.ts`.
 */
function num(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/** A count is never null and never absent: 0 rows is a fact, not an unknown. */
function count(value: unknown): number {
  return num(value) ?? 0;
}

async function callRpc<T>(name: string, args: Record<string, unknown>): Promise<T[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(name, args);
  if (error) {
    // FAIL LOUD. `pillar_b_release()` raises when no release is active, and a
    // swallowed error here would render an empty dashboard that looks like
    // "no activity" rather than "not available".
    const failure = new Error(`${name} failed: ${error.message}`);
    Object.assign(failure, { dbCode: error.code ?? "UNKNOWN" });
    throw failure;
  }
  return (data ?? []) as T[];
}

/** Is a Pillar B release active? Null means nothing is published, not zero spend. */
export const pillarBReleaseId = cache(async (): Promise<string | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("pillar_b_active_release")
    .select("release_id")
    .limit(2);
  if (error) throw new Error(`active release lookup failed: ${error.message}`);
  const rows = (data ?? []) as Array<{ release_id: string }>;
  if (rows.length === 0) return null;
  if (rows.length > 1) {
    throw new Error(`${rows.length} active releases are declared; refusing to aggregate`);
  }
  return rows[0].release_id;
});

export const getSpend = cache(async (year: PillarBYear): Promise<SpendRow[]> => {
  const rows = await callRpc<Record<string, unknown>>("pillar_b_spend", { p_year: year });
  return rows.map((r) => ({
    asl_code: String(r.asl_code),
    channel: String(r.channel),
    rows_observed: count(r.rows_observed),
    spend_eur: num(r.spend_eur),
    rows_basis_packages: count(r.rows_basis_packages),
    rows_basis_units: count(r.rows_basis_units),
    rows_basis_mixed: count(r.rows_basis_mixed),
    rows_basis_unknown: count(r.rows_basis_unknown),
    comparable_rows: count(r.comparable_rows),
    comparable_spend_eur: num(r.comparable_spend_eur),
    negative_rows: count(r.negative_rows),
  }));
});

export const getEvidenceFunnel = cache(async (year: PillarBYear): Promise<FunnelStage[]> => {
  const rows = await callRpc<Record<string, unknown>>("pillar_b_evidence_funnel", {
    p_year: year,
  });
  return rows
    .map((r) => ({
      stage: String(r.stage),
      step: count(r.step),
      rows_n: count(r.rows_n),
      spend_eur: num(r.spend_eur),
      note: String(r.note ?? ""),
    }))
    .sort((a, b) => a.step - b.step);
});

export const getPerimeterCoverage = cache(async (year: PillarBYear): Promise<PerimeterRow[]> => {
  const rows = await callRpc<Record<string, unknown>>("pillar_b_perimeter_coverage", {
    p_year: year,
  });
  return rows.map((r) => ({
    perimeter_status: String(r.perimeter_status),
    aic_count: count(r.aic_count),
    rows_n: count(r.rows_n),
    spend_eur: num(r.spend_eur),
  }));
});

export interface UptakeWithWithheld {
  rows: UptakeRow[];
  withheld: WithheldRow[];
  scope: UptakeScope | null;
  /** Withheld spend as a share of (used + withheld) spend; null when nothing observed. */
  withheldShare: number | null;
  withheldSpendEur: number;
  withheldRows: number;
}

/**
 * Uptake, and what was NOT counted, in one call.
 *
 * They are returned together deliberately. An uptake percentage without its
 * withheld counterpart reads as a measurement of the whole population, and on
 * this release 7.88% of eligible spend is withheld for unresolved quantity
 * basis. A caller cannot obtain one without the other from this module.
 */
export const getUptake = cache(async (year: PillarBYear): Promise<UptakeWithWithheld> => {
  const [rawRows, rawWithheld, rawScope] = await Promise.all([
    callRpc<Record<string, unknown>>("pillar_b_uptake", { p_year: year }),
    callRpc<Record<string, unknown>>("pillar_b_uptake_withheld", { p_year: year }),
    callRpc<Record<string, unknown>>("pillar_b_uptake_scope", { p_year: year }),
  ]);

  const rows: UptakeRow[] = rawRows.map((r) => ({
    asl_code: String(r.asl_code),
    active_substance: String(r.active_substance),
    route: String(r.route),
    comparable_unit: String(r.comparable_unit),
    whole_period_biosimilar_qty: num(r.whole_period_biosimilar_qty),
    whole_period_total_qty: num(r.whole_period_total_qty),
    window_biosimilar_qty: num(r.window_biosimilar_qty),
    window_total_qty: num(r.window_total_qty),
    first_local_biosimilar_key: num(r.first_local_biosimilar_key),
    opening_evidence: String(r.opening_evidence ?? ""),
  }));

  const withheld: WithheldRow[] = rawWithheld.map((r) => ({
    asl_code: String(r.asl_code),
    active_substance: String(r.active_substance),
    withheld_reason: String(r.withheld_reason),
    rows_n: count(r.rows_n),
    spend_eur: num(r.spend_eur),
  }));

  const s = rawScope[0];
  const scope: UptakeScope | null = s
    ? {
        rows_n: count(s.rows_n),
        spend_eur: num(s.spend_eur),
        rows_basis_packages: count(s.rows_basis_packages),
        rows_basis_units: count(s.rows_basis_units),
        rows_basis_mixed: count(s.rows_basis_mixed),
        rows_basis_unknown: count(s.rows_basis_unknown),
      }
    : null;

  const withheldSpendEur = withheld.reduce((sum, w) => sum + (w.spend_eur ?? 0), 0);
  const withheldRows = withheld.reduce((sum, w) => sum + w.rows_n, 0);
  const usedSpend = scope?.spend_eur ?? null;
  const denominator = usedSpend === null ? null : usedSpend + withheldSpendEur;

  return {
    rows,
    withheld,
    scope,
    withheldSpendEur,
    withheldRows,
    withheldShare: denominator === null || denominator === 0
      ? null
      : withheldSpendEur / denominator,
  };
});

/** A molecule x ASL x channel spend row. Spend only — never a quantity. */
export interface MoleculeSpendRow {
  active_substance: string;
  asl_code: string;
  channel: string;
  rows_n: number;
  spend_eur: number | null;
  comparable_rows: number;
  comparable_spend_eur: number | null;
  negative_rows: number;
  rows_basis_packages: number;
  rows_basis_units: number;
  rows_basis_mixed: number;
  rows_basis_unknown: number;
}

/** Spend by active substance for one year, at ASL x channel grain. */
export const getMoleculeSpend = cache(
  async (year: PillarBYear): Promise<MoleculeSpendRow[]> => {
    // PostgREST caps each response (1,000 rows on this project). A single RPC
    // call silently returned only the first 1,000 of 1,534 rows for Azienda
    // 201 in 2025, making concentration and trends irreconcilable. Order the
    // grouped result by its complete key before paging so no group is skipped.
    // ONE call, not one per page.
    //
    // The previous version paged with .order().range(). PostgREST wraps the
    // function in an ordered LIMIT/OFFSET query, so the ENTIRE aggregate
    // re-executed for every page: measured on the real ledger, 0.44 s x 2 pages
    // for Azienda 201 but 5.08 s x 8 pages for the Regione — about 70 s across
    // both years, against the `authenticated` role's 8 s statement_timeout.
    // That is the 57014 the review page was failing with, and it is why
    // bounding request concurrency changed nothing: serialising the same work
    // does not make it smaller.
    //
    // The _json variant returns the whole grouped result as a single jsonb row.
    // One row cannot hit the 1,000-row response cap, so there is nothing to
    // page and the aggregate runs once.
    const supabase = await createClient();
    const { data, error } = await supabase
      .rpc("pillar_b_molecule_spend_json", { p_year: year });
    if (error) throw new Error(`pillar_b_molecule_spend_json failed: ${error.message}`);

    const rows = (data ?? []) as Record<string, unknown>[];
    if (!Array.isArray(rows)) {
      throw new Error(
        `pillar_b_molecule_spend_json returned ${typeof data}, expected an array`,
      );
    }

    // The function's GROUP BY is (active_substance, asl_code, channel), so that
    // triple is unique over the result. A duplicate would mean the aggregate
    // changed shape, and would double-count that group's euros in both the
    // concentration table and the trend.
    const seen = new Set<string>();
    for (const row of rows) {
      const key = `${row.active_substance}\u0000${row.asl_code}\u0000${row.channel}`;
      if (seen.has(key)) {
        throw new Error(
          `pillar_b_molecule_spend_json returned a duplicate group ` +
          `(${key.replace(/\u0000/g, " / ")})`,
        );
      }
      seen.add(key);
    }
    return rows.map((r) => ({
      active_substance: String(r.active_substance),
      asl_code: String(r.asl_code),
      channel: String(r.channel),
      rows_n: count(r.rows_n),
      spend_eur: num(r.spend_eur),
      comparable_rows: count(r.comparable_rows),
      comparable_spend_eur: num(r.comparable_spend_eur),
      negative_rows: count(r.negative_rows),
      rows_basis_packages: count(r.rows_basis_packages),
      rows_basis_units: count(r.rows_basis_units),
      rows_basis_mixed: count(r.rows_basis_mixed),
      rows_basis_unknown: count(r.rows_basis_unknown),
    }));
  },
);

// ---------------------------------------------------- biosimilar value uptake

/** One substance's spend, split by the B05 monthly validity rule. */
export interface ValueUptakeRow {
  active_substance: string;
  inside_biosimilar_eur: number | null;
  inside_reference_eur: number | null;
  predates_biosimilar_eur: number | null;
  predates_reference_eur: number | null;
  boundary_biosimilar_eur: number | null;
  boundary_reference_eur: number | null;
  outside_biosimilar_eur: number | null;
  outside_reference_eur: number | null;
  unknown_biosimilar_eur: number | null;
  unknown_reference_eur: number | null;
  window_biosimilar_eur: number | null;
  window_reference_eur: number | null;
  first_local_month_key: number | null;
  perimeter_rows: number;
  undated_rows: number;
}

export interface ValueUptakeFilters {
  year: PillarBYear | null;
  channel: string | null;
  substance: string | null;
}

/**
 * Biosimilar vs reference spend, filtered SERVER-SIDE.
 *
 * The filters go to the database, not to a client that received the regional
 * ledger and narrowed it locally. An Azienda's browser never receives another
 * Azienda's rows, because RLS decides what the function can read before it
 * aggregates.
 *
 * Bounded by construction: one row per active substance in the biosimilar
 * perimeter — tens, not thousands — so there is nothing to page and no repeat
 * of the 57014 that molecule paging caused.
 */
export const getValueUptake = cache(
  async (year: number | null, channel: string | null,
         substance: string | null): Promise<ValueUptakeRow[]> => {
    const rows = await callRpc<Record<string, unknown>>("pillar_b_value_uptake", {
      p_year: year, p_channel: channel, p_substance: substance,
    });
    return rows.map((r) => ({
      active_substance: String(r.active_substance),
      inside_biosimilar_eur: num(r.inside_biosimilar_eur),
      inside_reference_eur: num(r.inside_reference_eur),
      predates_biosimilar_eur: num(r.predates_biosimilar_eur),
      predates_reference_eur: num(r.predates_reference_eur),
      boundary_biosimilar_eur: num(r.boundary_biosimilar_eur),
      boundary_reference_eur: num(r.boundary_reference_eur),
      outside_biosimilar_eur: num(r.outside_biosimilar_eur),
      outside_reference_eur: num(r.outside_reference_eur),
      unknown_biosimilar_eur: num(r.unknown_biosimilar_eur),
      unknown_reference_eur: num(r.unknown_reference_eur),
      window_biosimilar_eur: num(r.window_biosimilar_eur),
      window_reference_eur: num(r.window_reference_eur),
      first_local_month_key: num(r.first_local_month_key),
      perimeter_rows: count(r.perimeter_rows),
      undated_rows: count(r.undated_rows),
    }));
  },
);
