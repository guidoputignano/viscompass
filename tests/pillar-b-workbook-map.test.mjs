import test from "node:test";
import assert from "node:assert/strict";

import {
  WORKBOOK_SHEETS, WORKBOOK_STATUS_LABELS, WORKBOOK_STATUS_ORDER, workbookByStatus, workbookTally,
} from "../lib/dashboard-review/pillar-b/workbook-map.ts";

// The 25 sheet names of VIS_PillarB_Analytical_R2.xlsx, as extracted verbatim
// to the evidence repository (derived/workbook_r2_sheets.json, sha 334d2aa5…).
const SHEETS = [
  "00_README", "01_Verification", "03_Spend_by_Period", "04_Spend_by_ASL", "05_Spend_by_Channel",
  "06_Spend_by_Molecule", "07_Perimeter", "07b_B03_Candidates", "08_Bridge_A_Comparability",
  "09_Bridge_B_Opportunity", "10_Coverage_Cuts", "11_Date_and_Availability", "12_Uptake",
  "13_Expenditure_Change", "14_Benchmarks", "15_Trends_and_Adoption", "16_Heterogeneity", "17_Anomalies",
  "18_Uncertainty", "19_Opportunity_Scenarios", "20_Exclusivity", "21_Action_Register", "22_Refusals",
  "23_Artifact_Manifest", "24_Caveats",
];

test("every one of the 25 workbook sheets is mapped exactly once", () => {
  assert.equal(WORKBOOK_SHEETS.length, 25);
  const names = WORKBOOK_SHEETS.map((s) => `${s.id}_${s.sheet}`).sort();
  assert.deepEqual(names, [...SHEETS].sort());
  assert.equal(new Set(WORKBOOK_SHEETS.map((s) => s.id)).size, 25);
});

test("each sheet is in one of four states, every state has a label, and the tally adds up", () => {
  const states = Object.keys(WORKBOOK_STATUS_LABELS);
  assert.deepEqual([...states].sort(), ["blocked", "evidence", "implementable", "implemented"]);
  assert.deepEqual([...WORKBOOK_STATUS_ORDER].sort(), [...states].sort());
  for (const s of WORKBOOK_SHEETS) {
    assert.ok(states.includes(s.status), `${s.id} has an unknown status`);
    assert.ok(s.holds.length > 0 && s.where.length > 0, `${s.id} is missing text`);
  }
  const tally = workbookTally();
  assert.equal(Object.values(tally).reduce((a, b) => a + b, 0), 25);
  const grouped = workbookByStatus();
  assert.equal(grouped.reduce((n, g) => n + g.sheets.length, 0), 25);
});

test("the states that need a data contract or a migration say so, and no scenario is presented as a saving", () => {
  for (const id of ["13", "14", "15", "16", "17", "18", "21"]) {
    const s = WORKBOOK_SHEETS.find((x) => x.id === id);
    assert.equal(s.status, "blocked", `${id} is a statistical or imported result`);
  }
  const scenarios = WORKBOOK_SHEETS.find((x) => x.id === "19");
  assert.equal(scenarios.status, "evidence");
  assert.match(scenarios.where + (scenarios.note ?? ""), /nessuna cifra di risparmio|mai un risparmio/);
  const exclusivity = WORKBOOK_SHEETS.find((x) => x.id === "20");
  assert.match(exclusivity.where, /non è esclusività legale/);
  // Sheets whose headline is live but whose breakdown is not say "parziale".
  const bridgeA = WORKBOOK_SHEETS.find((x) => x.id === "08");
  assert.match(bridgeA.note, /parziale/);
});

test("every sheet's state is pinned, so none can be promoted quietly", () => {
  assert.deepEqual(workbookTally(), { implemented: 10, implementable: 0, blocked: 9, evidence: 6 });
  assert.deepEqual(Object.fromEntries(WORKBOOK_SHEETS.map((s) => [s.id, s.status])), {
    "00": "evidence", "01": "evidence", "03": "implemented", "04": "implemented", "05": "implemented",
    "06": "implemented", "07": "implemented", "07b": "evidence", "08": "blocked", "09": "implemented",
    "10": "implemented", "11": "implemented", "12": "implemented", "13": "blocked", "14": "blocked",
    "15": "blocked", "16": "blocked", "17": "blocked", "18": "blocked", "19": "evidence", "20": "blocked",
    "21": "blocked", "22": "evidence", "23": "evidence", "24": "implemented",
  });
});

test("the map quotes no figure from the confidential workbook (this repository is public)", () => {
  const text = JSON.stringify(WORKBOOK_SHEETS);
  assert.equal(/€|EUR\s?\d|\d{1,3}[.,]\d{3}|\d+[.,]\d+\s?%/.test(text), false, text.match(/€[^"]*|EUR\s?\d[^"]*|\d{1,3}[.,]\d{3}[^"]*|\d+[.,]\d+\s?%[^"]*/)?.[0]);
});
