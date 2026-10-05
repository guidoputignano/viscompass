import test from "node:test";
import assert from "node:assert/strict";

import { BRIDGE_B_GATE_IDS, BRIDGE_B_GATES, bridgeB, bridgeBPerimeterCheck, bridgeBPublishable } from "../lib/dashboard-review/pillar-b/bridge-b.ts";
import { buildValueUptake } from "../lib/dashboard-review/pillar-b/value-uptake.ts";

// Synthetic rows, in the RPC's shape. Two substances: one with a local
// biosimilar (window inside the valid months), one never bought locally, and
// euros in every validity class, biosimilar side included, so the gates have
// to place each one somewhere exactly once.
const row = (s, v) => ({
  active_substance: s, first_local_month_key: v.first ?? null, perimeter_rows: v.rows ?? 1, undated_rows: v.undated ?? 0,
  inside_biosimilar_eur: v.ib ?? 0, inside_reference_eur: v.ir ?? 0, predates_biosimilar_eur: v.pb ?? 0, predates_reference_eur: v.pr ?? 0,
  boundary_biosimilar_eur: v.bb ?? 0, boundary_reference_eur: v.br ?? 0, outside_biosimilar_eur: v.ob ?? 0, outside_reference_eur: v.or ?? 0,
  unknown_biosimilar_eur: v.ub ?? 0, unknown_reference_eur: v.ur ?? 0, window_biosimilar_eur: v.wb ?? 0, window_reference_eur: v.wr ?? 0,
});
const ALFA = row("alfa", { ib: 100, ir: 300, pb: 5, pr: 15, bb: 2, br: 8, ob: 1, or: 40, wb: 100, wr: 120, first: 2024 * 12 + 3 });
const BETA = row("beta", { ib: 0, ir: 200, br: 10, or: 60 });   // EU-authorised, never bought here
const ROWS = [ALFA, BETA];
const view = buildValueUptake(ROWS);
const SIX = BRIDGE_B_GATE_IDS.filter((id) => id !== "B3_date_unknown");
const byId = (b) => Object.fromEntries(b.gates.map((g) => [g.id, g.eur]));

test("decision views fail closed without an independent cent-exact check or with a negative gate", () => {
  const b = bridgeB(view, 10000);
  const good = bridgeBPerimeterCheck(b, [
    { perimeter_status: "biosimilar", spend_eur: b.biosimilar },
    { perimeter_status: "reference_medicine", spend_eur: b.reference },
  ]);
  assert.equal(bridgeBPublishable(b, good), true);
  assert.equal(bridgeBPublishable(b, null), false);
  assert.equal(bridgeBPublishable(b, { ...good, consistent: false, difference: 1 }), false);
  assert.equal(bridgeBPublishable({ ...b, residual: 0.01 }, good), false);
  assert.equal(bridgeBPublishable({ ...b, gates: b.gates.map((g) => g.id === "B1_before_status_valid" ? { ...g, eur: -1 } : g) }, good), false);
  assert.equal(bridgeBPublishable(bridgeB(buildValueUptake([]), 0), good), false);
});

test("the gates partition the total exactly, every euro through one gate", () => {
  const b = bridgeB(view, 10000);
  const sum = b.gates.reduce((s, g) => s + g.eur, 0);
  assert.equal(Math.round(sum * 100) / 100, 10000);
  assert.equal(b.residual, 0);
  const by = byId(b);
  // biosimilar euros of EVERY validity class sit in one gate
  assert.equal(by.B_BIOSIMILAR_SPEND, 100 + 5 + 2 + 1);
  assert.equal(b.biosimilar, 108);
  assert.equal(b.reference, 300 + 15 + 8 + 40 + 200 + 10 + 60);
  assert.equal(b.perimeter, 108 + 633);
  assert.equal(by.B0_outside_perimeter, 10000 - 741);
  assert.equal(by.B1_before_status_valid, 40 + 60);                   // outside reference only, both substances
  assert.equal(by.B2_boundary_month_unsplittable, 8 + 10);            // boundary reference only (not boundary.total)
  assert.equal(by.B_ADDRESSABLE_REFERENCE, 120);                      // T2: window reference
  assert.equal(by.B4_eu_authorised_never_bought_here, (315 + 200) - 120);   // date-valid reference − window reference
  assert.equal("B3_date_unknown" in by, false, "no undated euro and no undated row: no B3 line");
  assert.deepEqual(b.gates.map((g) => g.id), SIX);
});

test("a swapped or widened gate is caught: B1 is not boundary, B2 is not the boundary total, B4 is not the whole date-valid reference", () => {
  const b = bridgeB(view, 10000);
  const by = byId(b);
  assert.notEqual(by.B1_before_status_valid, by.B2_boundary_month_unsplittable);
  assert.notEqual(by.B2_boundary_month_unsplittable, view.boundary.total);
  assert.notEqual(by.B4_eu_authorised_never_bought_here, view.dateValid.reference);
  assert.equal(by.B4_eu_authorised_never_bought_here + by.B_ADDRESSABLE_REFERENCE, view.dateValid.reference);
});

test("the six named gates are always present, zero euro included", () => {
  // beta alone: nothing bought as a biosimilar, nothing locally substitutable —
  // those two zeros are the most informative lines of the bridge.
  const b = bridgeB(buildValueUptake([BETA]), 1000);
  assert.deepEqual(b.gates.map((g) => g.id), SIX);
  const by = byId(b);
  assert.equal(by.B_BIOSIMILAR_SPEND, 0);
  assert.equal(by.B_ADDRESSABLE_REFERENCE, 0);
  assert.equal(by.B4_eu_authorised_never_bought_here, 200);
  assert.equal(by.B0_outside_perimeter, 1000 - 270);
  assert.equal(b.residual, 0);
});

test("B3 appears for an undated euro on either side, positive or negative, and the undated-row count is not its trigger", () => {
  const pos = bridgeB(buildValueUptake([...ROWS, row("gamma", { ur: 7, ub: 3 })]), 5000);
  assert.equal(byId(pos).B3_date_unknown, 7);
  assert.equal(byId(pos).B_BIOSIMILAR_SPEND, 108 + 3);
  assert.equal(pos.residual, 0);
  assert.deepEqual(pos.gates.map((g) => g.id), [...BRIDGE_B_GATE_IDS]);
  // credit notes: an undated net of −4 must still leave through its own gate
  const neg = bridgeB(buildValueUptake([...ROWS, row("gamma", { ur: -4 })]), 5000);
  assert.equal(byId(neg).B3_date_unknown, -4);
  assert.equal(neg.residual, 0);
  // undated biosimilar euro with no undated reference euro: the class exists, the line shows 0
  const bioOnly = bridgeB(buildValueUptake([...ROWS, row("gamma", { ub: 3 })]), 5000);
  assert.equal(byId(bioOnly).B3_date_unknown, 0);
  assert.equal(bioOnly.gates.length, 7);
  assert.equal(bioOnly.residual, 0);
  // undated_rows counts every row with no classification date, the evidence-
  // listed predates rows included, so it must NOT open the line by itself
  const predatesOnly = bridgeB(buildValueUptake([...ROWS, row("enoxaparin", { pr: 50, undated: 4 })]), 5000);
  assert.equal("B3_date_unknown" in byId(predatesOnly), false);
  assert.equal(predatesOnly.gates.length, 6);
});

test("shares are of the ledger total only, never of the perimeter, and a share of nothing is null", () => {
  const b = bridgeB(view, 741 * 4);
  const bio = b.gates.find((g) => g.id === "B_BIOSIMILAR_SPEND");
  assert.ok(Math.abs(bio.shareOfTotal - 108 / (741 * 4)) < 1e-12);
  // biosimilar / (biosimilar + reference) by status is the forbidden third denominator
  for (const g of b.gates) assert.equal("shareOfPerimeter" in g, false, g.id);
  const zero = bridgeB(buildValueUptake([]), 0);
  assert.ok(zero.gates.every((g) => g.shareOfTotal === null));
  assert.equal(zero.gates.length, 6);
  assert.equal(zero.residual, 0);
});

test("the residual is never negative zero, whichever way the float drift falls", () => {
  // 0.1 + 0.2 is 0.30000000000000004: the gate sum overshoots the total by
  // 5.5e-17, and a bare Math.round would give -0, printed as "-0 €".
  const drift = buildValueUptake([row("alfa", { ib: 0.1, ir: 0.2, rows: 1 })]);
  const b = bridgeB(drift, 0.3);
  assert.equal(b.residual, 0);
  assert.ok(!Object.is(b.residual, -0), "residual must be +0, not -0");
  const c = bridgeBPerimeterCheck(b, [{ perimeter_status: "biosimilar", aic_count: 1, rows_n: 1, spend_eur: 0.1 }, { perimeter_status: "reference_medicine", aic_count: 1, rows_n: 1, spend_eur: 0.2 }]);
  assert.ok(!Object.is(c.difference, -0));
  assert.equal(c.consistent, true);
});

test("every gate has a label and a meaning; no gate is worded as a saving except the one that denies it", () => {
  for (const id of BRIDGE_B_GATE_IDS) {
    const g = BRIDGE_B_GATES[id];
    assert.ok(g.label.length > 0 && g.meaning.length > 0, id);
    for (const text of [g.label, g.meaning]) {
      if (/risparm|recuperabil|potenziale|previst|stim/i.test(text)) {
        assert.equal(id, "B_ADDRESSABLE_REFERENCE", `${id} is worded as a saving: ${text}`);
        assert.match(text, /NON è un risparmio/);
      }
    }
  }
  assert.match(BRIDGE_B_GATES.B_ADDRESSABLE_REFERENCE.meaning, /NON è un risparmio/);
  assert.doesNotMatch(BRIDGE_B_GATES.B_ADDRESSABLE_REFERENCE.label, /sostituibil/i);
  // B4 holds the pre-switch months of substances that did switch later: "not yet", never "never"
  assert.match(BRIDGE_B_GATES.B4_eu_authorised_never_bought_here.label, /non ancora/);
  assert.doesNotMatch(BRIDGE_B_GATES.B4_eu_authorised_never_bought_here.meaning, /\bmai dispensato\b/);
  assert.equal(BRIDGE_B_GATES.B0_outside_perimeter.kind, "outside");
  assert.equal(BRIDGE_B_GATES.B_BIOSIMILAR_SPEND.kind, "biosimilar");
});

test("the perimeter cross-check is cent-exact in both directions and reads only the two perimeter statuses", () => {
  const b = bridgeB(view, 10000);
  const facet = [
    { perimeter_status: "outside_biosimilar_perimeter", aic_count: 9, rows_n: 90, spend_eur: 9000 },
    { perimeter_status: "biosimilar", aic_count: 2, rows_n: 4, spend_eur: 108 },
    { perimeter_status: "reference_medicine", aic_count: 2, rows_n: 6, spend_eur: 633 },
    { perimeter_status: "unresolved", aic_count: 1, rows_n: 1, spend_eur: 150 },
    { perimeter_status: "non_biosimilar_same_substance", aic_count: 1, rows_n: 1, spend_eur: 80 },
    { perimeter_status: "unclassified", aic_count: 0, rows_n: 1, spend_eur: 29 },
  ];
  const withBio = (v) => facet.map((p) => (p.perimeter_status === "biosimilar" ? { ...p, spend_eur: v } : p));
  assert.deepEqual(bridgeBPerimeterCheck(b, facet), { facetsPerimeter: 741, difference: 0, consistent: true });
  // facet lower than the uptake perimeter
  const lower = bridgeBPerimeterCheck(b, withBio(100));
  assert.equal(lower.consistent, false);
  assert.equal(lower.difference, 8);
  // facet HIGHER than the uptake perimeter: a negative difference is a mismatch too
  const higher = bridgeBPerimeterCheck(b, withBio(175));
  assert.equal(higher.consistent, false);
  assert.equal(higher.difference, -67);
  // thirty cents is not "to the cent"
  const cents = bridgeBPerimeterCheck(b, withBio(108.3));
  assert.equal(cents.consistent, false);
  assert.equal(cents.difference, -0.3);
  // a null spend is "no such row", not a zero that hides a mismatch
  const nul = bridgeBPerimeterCheck(b, facet.map((p) => (p.perimeter_status === "reference_medicine" ? { ...p, spend_eur: null } : p)));
  assert.equal(nul.consistent, false);
});
