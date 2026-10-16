import test from "node:test";
import assert from "node:assert/strict";
import { isUnresolvedRecord } from "../lib/dashboard-review/normalization.ts";
import { normalizationCoverage, normalizedMg, isBiosimilar, isOriginatorSide, costPerMg, penetration, buildBiosimilarRows } from "../lib/dashboard-review/biosimilar.ts";

const fact = (overrides) => ({
  total_cost_eur: 100,
  cost_per_mg: null,
  cost_per_ddd: null,
  quality_status: null,
  mapping_confidence: "Unresolved",
  atc1: null,
  ...overrides,
});

test("unresolved means no normalised per-unit cost, whatever the ATC mapping says", () => {
  // ATC now filled and marked validated, but no €/mg or €/DDD: still unresolved.
  assert.equal(isUnresolvedRecord(fact({ atc1: "L", mapping_confidence: "Validated" })), true);
  // ATC unmapped, but a per-unit cost exists: resolved for comparison purposes.
  assert.equal(isUnresolvedRecord(fact({ cost_per_mg: 0.42 })), false);
  assert.equal(isUnresolvedRecord(fact({ cost_per_ddd: 7.85 })), false);
  // A zero cost per unit is a measured value, not a missing one.
  assert.equal(isUnresolvedRecord(fact({ cost_per_mg: 0 })), false);
});

test("an explicit unresolved quality status still counts", () => {
  assert.equal(isUnresolvedRecord(fact({ cost_per_mg: 0.42, quality_status: "Unresolved: pack size" })), true);
});

test("a column absent from an older row reads as missing, never as a cost", () => {
  const older = fact({});
  delete older.cost_per_mg;
  delete older.cost_per_ddd;
  assert.equal(isUnresolvedRecord(older), true);
});

test("the unresolved count and the normalisation coverage describe the same records", () => {
  const facts = [
    fact({ cost_per_mg: 0.4 }),
    fact({ cost_per_ddd: 3 }),
    fact({}),
    fact({}),
  ];
  const unresolved = facts.filter(isUnresolvedRecord).length;
  assert.equal(unresolved, 2);
  assert.equal(normalizationCoverage(facts), 1 - unresolved / facts.length);
});

// --- Pillar B release: comparable quantity and perimeter status ------------------

const release = (overrides) => fact({ comparable_eligible: true, comparable_unit: "MG", comparable_quantity: 1000, ...overrides });

test("normalised mass comes from the comparable quantity, in mg, for gated rows only", () => {
  assert.equal(normalizedMg(release({})), 1000);
  assert.equal(normalizedMg(release({ comparable_unit: "MCG", comparable_quantity: 2500 })), 2.5);
  assert.equal(normalizedMg(release({ comparable_unit: "G", comparable_quantity: "1.5" })), 1500, "pg-wire strings are numbers");
  assert.equal(normalizedMg(release({ comparable_unit: " mg " })), 1000, "unit case and spacing do not matter");
  // Not a mass: never converted, never mixed.
  for (const unit of ["PACK", "UI", "ML", "MBQ", "U", null]) assert.equal(normalizedMg(release({ comparable_unit: unit })), null, String(unit));
  // Failed the comparability gate: excluded even with a mass.
  assert.equal(normalizedMg(release({ comparable_eligible: false })), null);
  // Zero, negative or missing quantity is not a mass.
  for (const q of [0, -5, null, "", "abc"]) assert.equal(normalizedMg(release({ comparable_quantity: q })), null, String(q));
  // Earlier loads: per-pack content x packs still works.
  assert.equal(normalizedMg(fact({ total_content_mg: 50, quantity_packs: 4 })), 200);
  assert.equal(normalizedMg(fact({ total_content_mg: 50, quantity_packs: null })), null);
});

test("a gated mass row is resolved and counts as normalised coverage", () => {
  assert.equal(isUnresolvedRecord(release({})), false);
  assert.equal(isUnresolvedRecord(release({ comparable_unit: "UI" })), true, "IU is comparable but not a €/mg basis");
  const facts = [release({}), release({ comparable_unit: "PACK" }), fact({})];
  assert.equal(normalizationCoverage(facts), 1 / 3);
  assert.equal(facts.filter(isUnresolvedRecord).length, 2);
});

test("biosimilar and originator sides follow the B03 perimeter; unproven status is neither", () => {
  assert.equal(isBiosimilar(fact({ perimeter_status: "biosimilar" })), true);
  assert.equal(isOriginatorSide(fact({ perimeter_status: "reference_medicine" })), true);
  for (const status of ["unresolved", "non_biosimilar_same_substance", "outside_biosimilar_perimeter", null]) {
    assert.equal(isBiosimilar(fact({ perimeter_status: status })), false, String(status));
    assert.equal(isOriginatorSide(fact({ perimeter_status: status })), false, String(status));
  }
  // Earlier loads keep their flags.
  assert.equal(isBiosimilar(fact({ biosimilar_flag: true })), true);
  assert.equal(isOriginatorSide(fact({ biosimilar_flag: false })), true);
  assert.equal(isOriginatorSide(fact({ originator_flag: true })), true);
});

test("cost per mg and mg penetration use the gated mass", () => {
  const ref = release({ perimeter_status: "reference_medicine", comparable_quantity: 1000, total_cost_eur: 500 });
  const bio = release({ perimeter_status: "biosimilar", comparable_quantity: 3000, total_cost_eur: 600 });
  assert.equal(costPerMg([ref]), 0.5);
  assert.equal(costPerMg([bio]), 0.2);
  assert.deepEqual(penetration([ref, bio]), { value: 0.75, basis: "mg" });
  // One ungated row makes mg incomplete: the share falls back to a complete basis (spend), never mixes.
  const ungated = release({ perimeter_status: "biosimilar", comparable_eligible: false, total_cost_eur: 100 });
  const p = penetration([ref, bio, ungated]);
  assert.equal(p.basis, "spend");
  assert.equal(p.value, 700 / 1200);
});

// --- headroom only inside one comparability stratum --------------------------------

const OPTS = { classifyArea: () => ({ label: "Test", status: "supported_by_atc" }) };
const IV = "content|MAB|ENDOVENOSO|POLVERE|MG|2025";
const SC = "content|MAB|SOTTOCUTANEO|SOLUZIONE|MG|2025";
const row = (o) => release({ year: 2025, month: 3, active_substance: "MAB", ...o });

test("an SC originator is not compared per mg with an IV biosimilar", () => {
  const facts = [
    row({ perimeter_status: "reference_medicine", comparable_stratum_id: SC, comparable_quantity: 1000, total_cost_eur: 1390 }),
    row({ perimeter_status: "biosimilar", comparable_stratum_id: IV, comparable_quantity: 1000, total_cost_eur: 227 }),
  ];
  const [r] = buildBiosimilarRows(facts, 2025, OPTS);
  assert.equal(r.substitution_headroom_eur, 0);
  assert.equal(r.evidence_status, "unresolved");
  assert.equal(r.originator_cost_per_mg, null);
});

test("inside one stratum the differential applies; strata on one side add nothing", () => {
  const facts = [
    row({ perimeter_status: "reference_medicine", comparable_stratum_id: IV, comparable_quantity: 1000, total_cost_eur: 1000 }),
    row({ perimeter_status: "biosimilar", comparable_stratum_id: IV, comparable_quantity: 1000, total_cost_eur: 400 }),
    // SC originator spend with no SC biosimilar: not substitutable here.
    row({ perimeter_status: "reference_medicine", comparable_stratum_id: SC, comparable_quantity: 1000, total_cost_eur: 5000 }),
  ];
  const [r] = buildBiosimilarRows(facts, 2025, OPTS);
  assert.equal(r.headroom_base_eur, 1000);
  assert.equal(r.substitution_headroom_eur, 1000 * (1 - 0.4 / 1));
  assert.equal(r.originator_cost_per_mg, 1);
  assert.equal(r.biosimilar_cost_per_mg, 0.4);
  assert.notEqual(r.evidence_status, "unresolved");
});

test("two shared strata each keep their own differential", () => {
  const facts = [
    row({ perimeter_status: "reference_medicine", comparable_stratum_id: IV, comparable_quantity: 1000, total_cost_eur: 1000 }),
    row({ perimeter_status: "biosimilar", comparable_stratum_id: IV, comparable_quantity: 1000, total_cost_eur: 500 }),
    row({ perimeter_status: "reference_medicine", comparable_stratum_id: SC, comparable_quantity: 100, total_cost_eur: 400 }),
    row({ perimeter_status: "biosimilar", comparable_stratum_id: SC, comparable_quantity: 100, total_cost_eur: 300 }),
  ];
  const [r] = buildBiosimilarRows(facts, 2025, OPTS);
  // IV: 1000 x (1 - 0.5/1) = 500; SC: 400 x (1 - 3/4) = 100. Pooled would give 1400 x (1 - 0.7273/1.2727).
  assert.equal(r.substitution_headroom_eur, 600);
});
