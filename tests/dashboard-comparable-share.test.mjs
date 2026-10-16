import test from "node:test";
import assert from "node:assert/strict";
import { comparableQuantity, comparableQuantityShare, penetration, commonPenetrationBasis, penetrationOn } from "../lib/dashboard-review/biosimilar.ts";
import { unitCostIndexByOrg } from "../lib/dashboard-review/unit-cost-index.ts";

const IV = "content|MAB|ENDOVENOSO|POLVERE|MG|2025";
const SC = "content|MAB|SOTTOCUTANEO|SOLUZIONE|MG|2025";
const row = (o) => ({
  year: 2025, month: 3, active_substance: "MAB", total_cost_eur: 100,
  comparable_eligible: true, comparable_unit: "MG", comparable_quantity: 100, comparable_stratum_id: IV,
  ...o,
});
const ref = (o) => row({ perimeter_status: "reference_medicine", ...o });
const bio = (o) => row({ perimeter_status: "biosimilar", ...o });
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-12, `${actual} != ${expected}`);

test("a comparable quantity keeps its own unit and stratum, and needs the gate, a stratum and a unit", () => {
  assert.deepEqual(comparableQuantity(row({ comparable_unit: "ui", comparable_quantity: "4000" })), { stratum: `${IV}|UI`, quantity: 4000 });
  assert.equal(comparableQuantity(row({ comparable_eligible: false })), null);
  assert.equal(comparableQuantity(row({ comparable_stratum_id: null })), null);
  assert.equal(comparableQuantity(row({ comparable_unit: null })), null);
  assert.equal(comparableQuantity(row({ comparable_quantity: 0 })), null);
});

test("inside one stratum the share is on quantity, not on spend", () => {
  // Same mg on both sides; the biosimilar costs 40% of the originator.
  const facts = [ref({ comparable_quantity: 1000, total_cost_eur: 1000 }), bio({ comparable_quantity: 1000, total_cost_eur: 400 })];
  assert.deepEqual(penetration(facts), { value: 0.5, basis: "comparable_quantity", quantity_coverage: 1 });
  assert.equal(penetrationOn(facts, "spend"), 400 / 1400, "the spend share understates use");
});

test("an SC originator-only stratum counts at 0%, weighted by its spend; mg are never added across strata", () => {
  const facts = [
    ref({ comparable_quantity: 1000, total_cost_eur: 1000 }),
    bio({ comparable_quantity: 3000, total_cost_eur: 1000 }),
    ref({ comparable_stratum_id: SC, comparable_quantity: 10, total_cost_eur: 2000 }),
  ];
  // IV: 75% on 2000 €; SC: 0% on 2000 € -> 37.5%. Pooled mg would give 3000/4010.
  close(comparableQuantityShare(facts).value, 0.375);
});

test("IU products are measured in IU inside their stratum", () => {
  const ui = `${IV}|UI`;
  const facts = [ref({ comparable_unit: "UI", comparable_quantity: 2000, total_cost_eur: 300 }), bio({ comparable_unit: "UI", comparable_quantity: 6000, total_cost_eur: 600 })];
  assert.equal(comparableQuantity(facts[0]).stratum, ui);
  close(penetration(facts).value, 0.75);
});

test("a side mostly without quantities keeps the molecule on spend", () => {
  // The reference side is ungated (as for epoetin alfa): the gated subset alone would read 100%.
  const facts = [ref({ comparable_eligible: false, total_cost_eur: 800 }), bio({ comparable_quantity: 5000, total_cost_eur: 200 })];
  assert.deepEqual(comparableQuantityShare(facts), { value: null, quantity_coverage: null });
  assert.deepEqual(penetration(facts), { value: 0.2, basis: "spend", quantity_coverage: null });
  // 80% of each side gated is enough; the gated rows alone are measured.
  const enough = [ref({ total_cost_eur: 800 }), ref({ comparable_eligible: false, total_cost_eur: 200 }), bio({ comparable_quantity: 200, total_cost_eur: 100 })];
  close(comparableQuantityShare(enough).value, (900 * (200 / 300)) / 900);
});

test("across molecules each keeps its own measure and the quantity part is stated", () => {
  const facts = [
    ref({ comparable_quantity: 1000, total_cost_eur: 1000 }), bio({ comparable_quantity: 1000, total_cost_eur: 400 }),
    ref({ active_substance: "OTHER", comparable_eligible: false, total_cost_eur: 600 }),
  ];
  const share = comparableQuantityShare(facts);
  // MAB on quantity: 50% over 1400 €; OTHER on spend: 0% over 600 €.
  close(share.value, (1400 * 0.5) / 2000);
  close(share.quantity_coverage, 1400 / 2000);
});

test("a cohort uses the quantity basis only when every group has a molecule on it", () => {
  const measured = [ref({ comparable_quantity: 1000, total_cost_eur: 1000 }), bio({ comparable_quantity: 1000, total_cost_eur: 400 })];
  const ungated = [ref({ comparable_eligible: false }), bio({ comparable_eligible: false })];
  assert.equal(commonPenetrationBasis([measured, measured]), "comparable_quantity");
  assert.equal(commonPenetrationBasis([measured, ungated]), "spend");
});

// --- unit-cost index ---------------------------------------------------------------

const spend = (f) => f.erogato_cost_eur ?? null;
const disp = (o) => row({ erogato_cost_eur: o.total_cost_eur ?? 100, ...o });

test("the index compares the price of the same products, not the mix", () => {
  const groups = new Map([
    // A pays 12 €/mg, B 8 €/mg on the shared stratum; the cohort price is 2000/200 = 10.
    ["A", [disp({ comparable_quantity: 100, total_cost_eur: 1200 }), disp({ comparable_stratum_id: SC, comparable_quantity: 1, total_cost_eur: 800 })]],
    ["B", [disp({ comparable_quantity: 100, total_cost_eur: 800 }), disp({ comparable_eligible: false, total_cost_eur: 200 })]],
  ]);
  const { byOrg, sharedStrata } = unitCostIndexByOrg(groups, spend);
  assert.equal(sharedStrata, 1, "a stratum only A dispenses is no comparison");
  close(byOrg.get("A").index, 120);
  close(byOrg.get("B").index, 80);
  close(byOrg.get("A").coverage, 1200 / 2000);
  close(byOrg.get("B").coverage, 800 / 1000);
});

test("the index weights strata by each Azienda's own quantities", () => {
  const S2 = "content|OTHER|ORALE|COMPRESSA|MG|2025";
  const groups = new Map([
    // A buys only the cheap stratum at the cohort price; B buys both at the cohort price.
    ["A", [disp({ comparable_stratum_id: S2, comparable_quantity: 100, total_cost_eur: 100 })]],
    ["B", [disp({ comparable_stratum_id: S2, comparable_quantity: 100, total_cost_eur: 100 }), disp({ comparable_quantity: 10, total_cost_eur: 1000 })]],
    ["C", [disp({ comparable_quantity: 10, total_cost_eur: 1000 })]],
  ]);
  const { byOrg } = unitCostIndexByOrg(groups, spend);
  // Different mixes, same prices: 100 for all three.
  for (const org of ["A", "B", "C"]) close(byOrg.get(org).index, 100);
});

test("with one Azienda, or no spend on the comparison basis, there is no index", () => {
  const one = unitCostIndexByOrg(new Map([["A", [disp({})]]]), spend);
  assert.deepEqual(one.byOrg.get("A"), { index: null, coverage: null });
  assert.equal(one.sharedStrata, 0);
  const purchases = unitCostIndexByOrg(new Map([["A", [row({})]], ["B", [row({})]]]), spend);
  assert.equal(purchases.byOrg.get("A").index, null);
});
