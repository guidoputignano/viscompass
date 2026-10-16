import test from "node:test";
import assert from "node:assert/strict";
import { isUnresolvedRecord } from "../lib/dashboard-review/normalization.ts";
import { normalizationCoverage } from "../lib/dashboard-review/biosimilar.ts";

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
