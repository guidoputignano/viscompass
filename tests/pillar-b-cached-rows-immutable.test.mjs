import test from "node:test";
import assert from "node:assert/strict";

import {
  channelTrend, concentration, coverageNotices, funnelRows, moleculeTrend, narrowRows, spendLike, sumSpend,
} from "../lib/dashboard-review/pillar-b/review-data.ts";
import { buildValueUptake } from "../lib/dashboard-review/pillar-b/value-uptake.ts";
import { distinctUptakeGroups, volumeBreakdown } from "../lib/dashboard-review/pillar-b/adoption.ts";
import { perimeterOnly, sortTrend } from "../lib/dashboard-review/pillar-b/view-options.ts";

// The page's filter-independent reads are now SHARED between requests
// (lib/dashboard-review/pillar-b/server-cache.ts). A helper that sorted or
// edited those arrays in place would silently change what the next request —
// possibly another reviewer's — reads. Every helper the page runs over cached
// rows is run here over deep-frozen inputs: an in-place write throws in ESM's
// strict mode, so this test fails the moment one is introduced.

function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const v of Object.values(value)) deepFreeze(v);
  }
  return value;
}

const basis = { rows_basis_packages: 1, rows_basis_units: 0, rows_basis_mixed: 0, rows_basis_unknown: 0 };
const molecule = (s, asl, ch, eur, n = 3) => ({ active_substance: s, asl_code: asl, channel: ch, rows_n: n, spend_eur: eur,
  comparable_rows: n, comparable_spend_eur: eur, negative_rows: 0, ...basis });
const spend = (asl, ch, eur) => ({ asl_code: asl, channel: ch, rows_observed: 4, spend_eur: eur, comparable_rows: 4,
  comparable_spend_eur: eur, negative_rows: 0, ...basis });

const M24 = deepFreeze([molecule("beta", "130201", "CO", 30), molecule("alfa", "130202", "DD", 90), molecule("alfa", "130201", "CO", 10)]);
const M25 = deepFreeze([molecule("alfa", "130201", "CO", 50), molecule("gamma", "130202", "DPC", 5), molecule("beta", "130201", "CO", 20)]);
const S24 = deepFreeze([spend("130202", "DD", 90), spend("130201", "CO", 40)]);
const S25 = deepFreeze([spend("130201", "CO", 70), spend("130202", "DPC", 5)]);
const FUNNEL = deepFreeze([
  { stage: "Quantità confrontabile", step: 4, rows_n: 5, spend_eur: 50, note: "" },
  { stage: "Spesa osservata", step: 1, rows_n: 10, spend_eur: 100, note: "" },
  { stage: "Perimetro biosimilare", step: 3, rows_n: 7, spend_eur: 70, note: "" },
  { stage: "Riga classificabile (AIC)", step: 2, rows_n: 9, spend_eur: 90, note: "" },
]);
const vu = (s, v) => ({
  active_substance: s, first_local_month_key: v.first ?? null, perimeter_rows: 1, undated_rows: 0,
  inside_biosimilar_eur: v.ib ?? 0, inside_reference_eur: v.ir ?? 0, predates_biosimilar_eur: 0, predates_reference_eur: 0,
  boundary_biosimilar_eur: 0, boundary_reference_eur: 0, outside_biosimilar_eur: 0, outside_reference_eur: 0,
  unknown_biosimilar_eur: 0, unknown_reference_eur: 0, window_biosimilar_eur: v.wb ?? 0, window_reference_eur: v.wr ?? 0,
});
const SUBSTANCES = deepFreeze([vu("zeta", { ir: 5 }), vu("alfa", { ib: 3, ir: 9, wb: 3, wr: 4, first: 2024 * 12 + 2 })]);
const UPTAKE_ROWS = deepFreeze([
  { asl_code: "130201", active_substance: "alfa", route: "SOTTOCUTANEO", comparable_unit: "mg", whole_period_biosimilar_qty: 2,
    whole_period_total_qty: 5, window_biosimilar_qty: 2, window_total_qty: 4, first_local_biosimilar_key: 2024 * 12 + 2, opening_evidence: "observed" },
]);
const UPTAKE = deepFreeze({ rows: UPTAKE_ROWS, withheld: [], scope: null, usedSpendEur: null, withheldShare: null, withheldSpendEur: 0, withheldRows: 0 });

test("every helper the page runs over shared rows leaves them untouched", () => {
  const before = JSON.stringify({ M24, M25, S24, S25, FUNNEL, SUBSTANCES, UPTAKE });

  const m24 = narrowRows(M24, ["CO"], "130201");
  const m25 = narrowRows(M25, [], null);
  const trend = moleculeTrend(M24, M25);
  sortTrend(trend, "pct");
  perimeterOnly(trend, new Set(["alfa"]));
  concentration(M24);
  concentration(m24);
  spendLike(m25);
  channelTrend(S24, S25);
  channelTrend(spendLike(M24), spendLike(M25));
  sumSpend(S24);
  coverageNotices([...S24, ...S25], UPTAKE);
  funnelRows(FUNNEL);
  const view = buildValueUptake(SUBSTANCES);
  view.rows.filter((r) => r.dateValid.reference > 0).sort((a, b) => b.dateValid.reference - a.dateValid.reference);
  SUBSTANCES.map((r) => r.active_substance).sort();
  volumeBreakdown(UPTAKE_ROWS);
  distinctUptakeGroups(UPTAKE_ROWS);

  assert.equal(JSON.stringify({ M24, M25, S24, S25, FUNNEL, SUBSTANCES, UPTAKE }), before);
});

test("the funnel and trend helpers return their own ordered copies", () => {
  const ordered = funnelRows(FUNNEL);
  assert.deepEqual(ordered.map((r) => r.step), [1, 2, 3, 4]);
  assert.deepEqual(FUNNEL.map((r) => r.step), [4, 1, 3, 2], "the shared input keeps its order");
  const trend = moleculeTrend(M24, M25);
  assert.notEqual(sortTrend(trend, "delta"), trend);
});
