import test from "node:test";
import assert from "node:assert/strict";

import { BRIDGE_B_GATE_IDS, BRIDGE_B_GATES, bridgeB, bridgeBPerimeterCheck } from "../lib/dashboard-review/pillar-b/bridge-b.ts";
import { buildValueUptake } from "../lib/dashboard-review/pillar-b/value-uptake.ts";

// Synthetic rows, in the RPC's shape. Two substances: one with a local
// biosimilar (window inside the valid months), one never bought locally, and
// euros in every validity class, biosimilar side included, so the gates have
// to place each one somewhere exactly once.
const row = (s, v) => ({
  active_substance: s, first_local_month_key: v.first ?? null, perimeter_rows: v.rows ?? 1, undated_rows: 0,
  inside_biosimilar_eur: v.ib ?? 0, inside_reference_eur: v.ir ?? 0, predates_biosimilar_eur: v.pb ?? 0, predates_reference_eur: v.pr ?? 0,
  boundary_biosimilar_eur: v.bb ?? 0, boundary_reference_eur: v.br ?? 0, outside_biosimilar_eur: v.ob ?? 0, outside_reference_eur: v.or ?? 0,
  unknown_biosimilar_eur: v.ub ?? 0, unknown_reference_eur: v.ur ?? 0, window_biosimilar_eur: v.wb ?? 0, window_reference_eur: v.wr ?? 0,
});
const ROWS = [
  row("alfa", { ib: 100, ir: 300, pb: 5, pr: 15, bb: 2, br: 8, ob: 1, or: 40, wb: 100, wr: 120, first: 2024 * 12 + 3 }),
  row("beta", { ib: 0, ir: 200, br: 10, or: 60 }),   // EU-authorised, never bought here
];
const view = buildValueUptake(ROWS);

test("the gates partition the total exactly, every euro through one gate", () => {
  const b = bridgeB(view, 10000);
  const sum = b.gates.reduce((s, g) => s + g.eur, 0);
  assert.equal(Math.round(sum * 100) / 100, 10000);
  assert.equal(b.residual, 0);
  const by = Object.fromEntries(b.gates.map((g) => [g.id, g.eur]));
  // biosimilar euros of EVERY validity class sit in one gate
  assert.equal(by.B_BIOSIMILAR_SPEND, 100 + 5 + 2 + 1);
  assert.equal(b.biosimilar, 108);
  assert.equal(b.reference, 300 + 15 + 8 + 40 + 200 + 10 + 60);
  assert.equal(b.perimeter, 108 + 633);
  assert.equal(by.B0_outside_perimeter, 10000 - 741);
  assert.equal(by.B1_before_status_valid, 40 + 60);
  assert.equal(by.B2_boundary_month_unsplittable, 8 + 10);
  assert.equal(by.B_ADDRESSABLE_REFERENCE, 120);                // T2: window reference
  assert.equal(by.B4_eu_authorised_never_bought_here, (315 + 200) - 120);   // date-valid reference − window reference
  assert.equal("B3_date_unknown" in by, false, "no undated euro, no B3 line");
});

test("B3 appears only when an undated reference euro exists, and keeps the partition exact", () => {
  const withUnknown = buildValueUptake([...ROWS, row("gamma", { ur: 7, ub: 3 })]);
  const b = bridgeB(withUnknown, 5000);
  const by = Object.fromEntries(b.gates.map((g) => [g.id, g.eur]));
  assert.equal(by.B3_date_unknown, 7);
  assert.equal(by.B_BIOSIMILAR_SPEND, 108 + 3);
  assert.equal(b.residual, 0);
  assert.deepEqual(b.gates.map((g) => g.id), [...BRIDGE_B_GATE_IDS]);
});

test("shares are of the total and of the perimeter, and a share of nothing is null", () => {
  const b = bridgeB(view, 741 * 4);
  const bio = b.gates.find((g) => g.id === "B_BIOSIMILAR_SPEND");
  assert.ok(Math.abs(bio.shareOfTotal - 108 / (741 * 4)) < 1e-12);
  assert.ok(Math.abs(bio.shareOfPerimeter - 108 / 741) < 1e-12);
  assert.equal(b.gates.find((g) => g.id === "B0_outside_perimeter").shareOfPerimeter, null);
  const zero = bridgeB(buildValueUptake([]), 0);
  assert.ok(zero.gates.every((g) => g.shareOfTotal === null && g.shareOfPerimeter === null));
  assert.equal(zero.residual, 0);
});

test("every gate has a label and a meaning, and the addressable gate says it is not a saving", () => {
  for (const id of BRIDGE_B_GATE_IDS) {
    assert.ok(BRIDGE_B_GATES[id].label.length > 0 && BRIDGE_B_GATES[id].meaning.length > 0, id);
  }
  assert.match(BRIDGE_B_GATES.B_ADDRESSABLE_REFERENCE.meaning, /NON è un risparmio/);
  assert.equal(BRIDGE_B_GATES.B0_outside_perimeter.kind, "outside");
  assert.equal(BRIDGE_B_GATES.B_BIOSIMILAR_SPEND.kind, "biosimilar");
});

test("the perimeter cross-check reads only the biosimilar and reference statuses of the facet", () => {
  const b = bridgeB(view, 10000);
  const facet = [
    { perimeter_status: "outside_biosimilar_perimeter", aic_count: 9, rows_n: 90, spend_eur: 9000 },
    { perimeter_status: "biosimilar", aic_count: 2, rows_n: 4, spend_eur: 108 },
    { perimeter_status: "reference_medicine", aic_count: 2, rows_n: 6, spend_eur: 633 },
    { perimeter_status: "unresolved", aic_count: 1, rows_n: 1, spend_eur: 150 },
    { perimeter_status: "non_biosimilar_same_substance", aic_count: 1, rows_n: 1, spend_eur: 80 },
    { perimeter_status: "unclassified", aic_count: 0, rows_n: 1, spend_eur: 29 },
  ];
  const ok = bridgeBPerimeterCheck(b, facet);
  assert.deepEqual(ok, { facetsPerimeter: 741, difference: 0, consistent: true });
  const off = bridgeBPerimeterCheck(b, facet.map((p) => (p.perimeter_status === "biosimilar" ? { ...p, spend_eur: 100 } : p)));
  assert.equal(off.consistent, false);
  assert.equal(off.difference, 8);
  // a null spend is "no such row", not a zero that hides a mismatch
  const nul = bridgeBPerimeterCheck(b, facet.map((p) => (p.perimeter_status === "reference_medicine" ? { ...p, spend_eur: null } : p)));
  assert.equal(nul.consistent, false);
});
