import test from "node:test";
import assert from "node:assert/strict";

import { reviewQueue } from "../lib/dashboard-review/pillar-b/review-queue.ts";
import { bridgeB } from "../lib/dashboard-review/pillar-b/bridge-b.ts";
import { buildValueUptake } from "../lib/dashboard-review/pillar-b/value-uptake.ts";

const row = (s, v) => ({
  active_substance: s, first_local_month_key: v.first ?? null, perimeter_rows: v.rows ?? 1, undated_rows: 0,
  inside_biosimilar_eur: v.ib ?? 0, inside_reference_eur: v.ir ?? 0, predates_biosimilar_eur: v.pb ?? 0, predates_reference_eur: v.pr ?? 0,
  boundary_biosimilar_eur: v.bb ?? 0, boundary_reference_eur: v.br ?? 0, outside_biosimilar_eur: v.ob ?? 0, outside_reference_eur: v.or ?? 0,
  unknown_biosimilar_eur: v.ub ?? 0, unknown_reference_eur: v.ur ?? 0, window_biosimilar_eur: v.wb ?? 0, window_reference_eur: v.wr ?? 0,
});
const ROWS = [
  row("alfa", { ib: 100, ir: 300, pb: 5, pr: 15, bb: 2, br: 8, ob: 1, or: 40, wb: 100, wr: 120, first: 2024 * 12 + 3 }),
  row("beta", { ib: 0, ir: 200, br: 10, or: 60 }),                       // never observed here, date-valid reference
  row("gamma", { ib: 50, ir: 0, wb: 50, wr: 0, first: 2025 * 12 + 1 }),  // switched, nothing left on the reference
  row("delta", { ib: 0, ir: 0, or: 30 }),                                // never observed, no date-valid month: not a question
];
const view = buildValueUptake(ROWS);

test("the two lists are the two actionable gates, read per molecule, and add up to them exactly", () => {
  const q = reviewQueue(view);
  const b = bridgeB(view, 10000);
  const gate = (id) => b.gates.find((g) => g.id === id).eur;
  assert.deepEqual(q.afterLocalSwitch.map((r) => [r.substance, r.eur, r.firstLocalLabel]), [["alfa", 120, "2024-03"]]);
  assert.equal(q.afterLocalSwitchTotal, gate("B_ADDRESSABLE_REFERENCE"));
  assert.deepEqual(q.notObservedHere.map((r) => [r.substance, r.eur, r.firstLocalLabel]), [["beta", 200, null]]);
  assert.equal(q.beforeLocalSwitchTotal, 315 - 120);
  assert.equal(q.notObservedHereTotal + q.beforeLocalSwitchTotal, gate("B4_eu_authorised_never_bought_here"));
});

test("a switched substance with no reference left and a never-observed one with no valid month ask no question", () => {
  const q = reviewQueue(view);
  assert.ok(!q.afterLocalSwitch.some((r) => r.substance === "gamma"));
  assert.ok(!q.notObservedHere.some((r) => r.substance === "delta"));
  // delta's euros are outside-validity reference: B1's, not the queue's
  assert.equal(bridgeB(view, 10000).gates.find((g) => g.id === "B1_before_status_valid").eur, 40 + 60 + 30);
});

test("ordering is by euros, descending, then by name; shares travel with the row", () => {
  const q = reviewQueue(buildValueUptake([
    row("b", { ir: 10, wr: 5, first: 2024 * 12 + 1 }), row("a", { ir: 10, wr: 5, first: 2024 * 12 + 1 }), row("c", { ir: 100, wr: 50, first: 2024 * 12 + 1 }),
  ]));
  assert.deepEqual(q.afterLocalSwitch.map((r) => r.substance), ["c", "a", "b"]);
  assert.equal(q.afterLocalSwitch[0].dateValidShare, 0);
  assert.equal(q.afterLocalSwitch[0].locallyObservedShare, 0);
});

test("an empty view yields empty lists and zero totals, not nulls", () => {
  const q = reviewQueue(buildValueUptake([]));
  assert.deepEqual(q, { afterLocalSwitch: [], afterLocalSwitchTotal: 0, notObservedHere: [], notObservedHereTotal: 0, beforeLocalSwitchTotal: 0 });
});
