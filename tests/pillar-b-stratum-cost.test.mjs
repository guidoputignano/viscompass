import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { register } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import React from "react";
import server from "react-dom/server";

import {
  FEW_RECORDS_NOTE, MARGIN_YEAR, STRATUM_REASONS, channelShares, formatUnitRate, marginBase, openingLabel, orderMolecules,
  orderStrata, parseStratumLabel, parseStratumUnitCost, reconcileYear, selectionMatch, stratumCostPanel,
  stratumFacetsReference, windowMonths,
} from "../lib/dashboard-review/pillar-b/stratum-cost.ts";
import { RELEASE_COVERAGE } from "../lib/dashboard-review/pillar-b/period.ts";
import { formatEurSignificant, formatNumberUpTo } from "../lib/dashboard-review/format.ts";
import { buildBiosimilarRows } from "../lib/dashboard-review/biosimilar.ts";

// The per-stratum observed gross unit cost (owner decision, 17 October 2026):
// for ONE Azienda, the two observed values per unit of each comparability
// stratum, side by side, with no ratio, no difference, no saving, and no
// colour or order that says which side is cheaper.
//
// Synthetic fixtures only (this repository is public): invented substance and
// Azienda codes, round amounts. The database function is reconciled with the
// margin's own code on the frozen release in the private harness
// (outputs/pillar-b/stratum-cost/b54), not here.

const root = fileURLToPath(new URL("..", import.meta.url));
const read = (f) => fs.readFileSync(`${root}${f}`, "utf8").replace(/\r\n/g, "\n");
const NBSP = " ";

// ------------------------------------------------------------------ fixtures

const MG = { MG: 1, MCG: 0.001, G: 1000 };
const sid = (route, form, unit = "MG", year = 2025, mol = "TEST-S") => `content|${mol}|${route}|${form}|${unit}|${year}`;
const side = (spend, quantity, rows = 12, unit = "MG", channels = { CO: spend }) => ({
  spend_eur: spend, quantity, mass_mg: quantity * MG[unit], rows_n: rows, unit, unit_count: 1, channels,
});
const stratum = (id, reference, biosimilar) => ({ stratum_id: id, shared: reference !== null && biosimilar !== null, reference, biosimilar });

/** A molecule whose parts are consistent with its strata: M and S from them, W = M + n, R = P + W. */
function molecule({ name = "TEST-S", opening = 2024 * 12 + 3, undated = false, strata = [], p = 100, n = 0, bioP = 0, bioN = 0,
  nc = { unresolved_eur: 0, non_biosimilar_same_substance_eur: 0, other_eur: 0 } } = {}) {
  const total = (pick, sharedOnly) => strata.filter((s) => !sharedOnly || s.shared).reduce((t, s) => t + (pick(s)?.spend_eur ?? 0), 0);
  const refM = total((s) => s.reference, false), refS = total((s) => s.reference, true);
  const bioM = total((s) => s.biosimilar, false), bioS = total((s) => s.biosimilar, true);
  const refW = refM + n, bioW = bioM + bioN;
  return {
    active_substance: name, opening_key: opening, opening_from_undated: undated,
    reference: { r_eur: p + refW, p_eur: p, w_eur: refW, m_eur: refM, s_eur: refS, rows_n: 30 },
    biosimilar: { b_eur: bioP + bioW, p_eur: bioP, w_eur: bioW, m_eur: bioM, s_eur: bioS, rows_n: 20 },
    not_compared: nc,
    strata,
  };
}

/** A year whose totals are consistent with its molecules. */
function year(y, molecules, { without = 50, noSubstance = 0, undated = 0, months = 12, legacy = 0 } = {}) {
  const r = molecules.reduce((t, m) => t + m.reference.r_eur, 0);
  return {
    year: y, months_observed: months, reference_all_eur: r + without + noSubstance, reference_undated_eur: undated,
    reference_no_substance_eur: noSubstance, reference_without_biosimilar_eur: without, legacy_mass_rows: legacy, molecules,
  };
}
const facetsOf = (y) => y.reference_all_eur - y.reference_undated_eur;

/** The 2025 fixture: one shared stratum, one reference-only, one biosimilar-only (2 records). */
function base2025() {
  return year(2025, [molecule({
    strata: [
      stratum(sid("ENDOVENOSO", "POLVERE"), side(800, 4000), side(600, 4000, 12, "MG", { CO: 450, DPC: 150 })),
      stratum(sid("SOTTOCUTANEO", "SOLUZIONE", "MCG"), side(300, 1500000, 9, "MCG"), null),
      stratum(sid("SOTTOCUTANEO", "PENNA"), null, side(90, 300, 2)),
    ],
  })]);
}
const raw = (byYear, { channels = null, substance = null } = {}) => ({
  years: byYear.map((y) => y.year).sort((a, b) => a - b), channels, substance, byYear,
});
const payloadOf = (r) => ({ years: r.years, channels: r.channels, substance: r.substance, by_year: r.byYear });
const ctx = (over = {}) => ({ aziendaLabel: "ASL 9", channels: [], substance: null, facetsReference: null, showStratumIds: false, ...over });
const facetsFor = (...years) => new Map(years.map((y) => [y.year, facetsOf(y)]));
const clone = (x) => JSON.parse(JSON.stringify(x));

// --------------------------------------------------------------------- parse

const ARGS = { years: [2025], aslCode: "TEST-ASL-9", channels: null, substance: null };

test("parse: a well-formed payload is accepted, numerics sent as strings included", () => {
  const p = payloadOf(raw([base2025()]));
  const strings = clone(p);
  strings.by_year[0].reference_all_eur = String(strings.by_year[0].reference_all_eur);
  strings.by_year[0].molecules[0].strata[0].reference.spend_eur = "800.00";
  strings.by_year[0].molecules[0].strata[0].reference.rows_n = "12";
  strings.by_year[0].molecules[0].opening_key = String(2024 * 12 + 3);
  strings.years = ["2025"];
  for (const payload of [p, strings]) {
    const out = parseStratumUnitCost(payload, ARGS);
    assert.deepEqual(out.years, [2025]);
    assert.equal(out.byYear.length, 1);
    assert.equal(out.byYear[0].molecules[0].strata[0].reference.spend_eur, 800);
    assert.equal(out.byYear[0].molecules[0].strata[0].reference.rows_n, 12);
    assert.equal(out.byYear[0].molecules[0].opening_key, 2024 * 12 + 3);
    assert.equal(typeof out.byYear[0].reference_all_eur, "number");
  }
  // Two years, in either order of the request.
  const two = payloadOf(raw([base2025(), { ...base2025(), year: 2024 }]));
  assert.deepEqual(parseStratumUnitCost(two, { ...ARGS, years: [2025, 2024] }).years, [2024, 2025]);
  // The channel and molecule echoes, when asked.
  const filtered = { ...p, channels: ["CO", "DPC"], substance: "TEST-S" };
  assert.equal(parseStratumUnitCost(filtered, { ...ARGS, channels: ["CO", "DPC"], substance: "TEST-S" }).substance, "TEST-S");
});

test("parse: a broken or mismatched answer throws PBR-STRATUM-SHAPE, never a partial read", () => {
  const good = payloadOf(raw([base2025()]));
  const bad = (mutate, args = ARGS) => {
    const p = clone(good);
    mutate(p);
    assert.throws(() => parseStratumUnitCost(p, args), /^Error: PBR-STRATUM-SHAPE$/);
  };
  bad((p) => { delete p.by_year; });
  bad((p) => { p.by_year[0].year = 2026; });
  bad((p) => { p.years = [2026]; p.by_year[0].year = 2026; }, { ...ARGS, years: [2026] });
  bad((p) => { p.years = [2024, 2025]; });
  bad(() => {}, { ...ARGS, years: [2024, 2025] });
  bad((p) => { p.channels = ["CO"]; });
  bad((p) => { p.channels = ["DD"]; }, { ...ARGS, channels: ["CO"] });
  bad(() => {}, { ...ARGS, channels: ["CO"] });
  bad((p) => { p.substance = "TEST-OTHER"; });
  bad(() => {}, { ...ARGS, substance: "TEST-S" });
  bad((p) => { delete p.substance; });
  bad((p) => { p.by_year[0].molecules[0].strata[0].reference.spend_eur = "non un numero"; });
  bad((p) => { p.by_year[0].molecules[0].strata[0].reference.rows_n = -1; });
  bad((p) => { p.by_year[0].molecules[0].reference.rows_n = 1.5; });
  bad((p) => { p.by_year[0].months_observed = null; });
  bad((p) => { p.by_year[0].molecules[0].strata[0].shared = "true"; });
  // NaN cannot travel in JSON, but a caller can hand one over.
  const nan = clone(good);
  nan.by_year[0].reference_all_eur = Number.NaN;
  assert.throws(() => parseStratumUnitCost(nan, ARGS), /PBR-STRATUM-SHAPE/);
  assert.throws(() => parseStratumUnitCost(null, ARGS), /PBR-STRATUM-SHAPE/);
  assert.throws(() => parseStratumUnitCost([], ARGS), /PBR-STRATUM-SHAPE/);
});

// ------------------------------------------------------------ reconciliation

test("reconcileYear: a consistent year reconciles, with the cross-check", () => {
  const y = base2025();
  assert.deepEqual(reconcileYear(y, facetsOf(y)), { ok: true, reasons: [], crossCheck: "ok" });
});

test("reconcileYear: without the facets the cross-check is unavailable, not a failure", () => {
  assert.deepEqual(reconcileYear(base2025(), null), { ok: true, reasons: [], crossCheck: "unavailable" });
});

test("reconcileYear: each defect fails the year with its own reason", () => {
  const cases = [
    ["P + W differs from R", (y) => { y.molecules[0].reference.p_eur += 5; }, "parts"],
    ["the strata's spend differs from M", (y) => { y.molecules[0].reference.m_eur += 5; }, "strata"],
    ["the shared strata's spend differs from S", (y) => { y.molecules[0].biosimilar.s_eur -= 5; }, "strata"],
    ["a shared stratum misses a side", (y) => { y.molecules[0].strata[0].biosimilar = null; }, "strata"],
    ["a side has two units", (y) => { y.molecules[0].strata[1].reference.unit_count = 2; }, "unit"],
    ["a side is not in a mass unit", (y) => { y.molecules[0].strata[2].biosimilar.unit = "UI"; }, "unit"],
    ["the mass is not quantity × the unit's factor", (y) => { y.molecules[0].strata[1].reference.mass_mg *= 1000; }, "mass"],
    ["the channels do not sum to the spend", (y) => { y.molecules[0].strata[0].biosimilar.channels.DPC = 100; }, "strata"],
    ["a record would carry a mass from packs × content", (y) => { y.legacy_mass_rows = 1; }, "mass"],
    ["the year's identity breaks", (y) => { y.reference_without_biosimilar_eur += 10; }, "year"],
  ];
  for (const [what, mutate, reason] of cases) {
    const y = base2025();
    mutate(y);
    const check = reconcileYear(y, null);
    assert.equal(check.ok, false, what);
    assert.ok(check.reasons.includes(STRATUM_REASONS[reason]), `${what}: ${check.reasons.join(" / ")}`);
  }
  // The cross-check against the facets, off by one euro.
  const y = base2025();
  const check = reconcileYear(y, facetsOf(y) + 1);
  assert.equal(check.ok, false);
  assert.equal(check.crossCheck, "failed");
  assert.deepEqual(check.reasons, [STRATUM_REASONS.facets]);
  // Sub-cent float drift is not a defect.
  assert.equal(reconcileYear(y, facetsOf(y) + 0.004).crossCheck, "ok");
});

test("reconcileYear: the reasons are plain Italian, with no code or function name", () => {
  for (const reason of Object.values(STRATUM_REASONS)) {
    assert.doesNotMatch(reason, /pillar_b|rpc|PBR|_|\bR\b|\bS\b|\bM\b/);
  }
});

test("stratumFacetsReference: one Azienda's reference spend per year, the code only as a filter", () => {
  const rows = [
    { asl_code: "TEST-ASL-9", year: 2025, spend_eur: 900, rows_n: 3, comparable_spend_eur: 0, biosimilar_eur: 100, reference_eur: 700 },
    { asl_code: "TEST-ASL-9", year: 2024, spend_eur: 900, rows_n: 3, comparable_spend_eur: 0, biosimilar_eur: 100, reference_eur: null },
    { asl_code: "TEST-ASL-8", year: 2025, spend_eur: 900, rows_n: 3, comparable_spend_eur: 0, biosimilar_eur: 100, reference_eur: 999 },
  ];
  const map = stratumFacetsReference(rows, "TEST-ASL-9");
  assert.deepEqual([...map.entries()].sort(), [[2024, 0], [2025, 700]]);
  assert.doesNotMatch(JSON.stringify([...map.entries()]), /TEST-ASL/);
});

// --------------------------------------------------------------- margin base

test("marginBase: min(S, max(0, W), max(0, R)), binding only below S", () => {
  assert.deepEqual(marginBase({ r_eur: 100, w_eur: 30, s_eur: 40 }), { base: 30, binds: true, cap: "window" });
  assert.deepEqual(marginBase({ r_eur: 100, w_eur: 70, s_eur: 40 }), { base: 40, binds: false, cap: null });
  // Credit notes before the opening (P < 0) make R the binding cap, not W.
  assert.deepEqual(marginBase({ r_eur: 25, w_eur: 30, s_eur: 40 }), { base: 25, binds: true, cap: "year" });
  assert.equal(marginBase({ r_eur: -5, w_eur: 70, s_eur: 40 }).base, 0);
  assert.equal(marginBase({ r_eur: 100, w_eur: -10, s_eur: 40 }).base, 0);
});

test("marginBase is the margin's own base (biosimilar.ts headroom_base_eur)", () => {
  const stratumId = sid("ENDOVENOSO", "POLVERE");
  const fact = (over) => ({
    id: 1, source_record_id: "r", source_version_id: "v", year: 2025, month: 1, region_code: "975", region_name: null,
    asl_code: "TEST-ASL-9", channel: "CO", aic: null, atc1: null, atc2: null, atc3: null, atc4: null, atc5: null,
    product_description_raw: null, brand_name: null, active_substance: "TEST-S", quantity_packs: null, total_cost_eur: 0,
    acquistato_cost_eur: null, erogato_cost_eur: null, cost_basis: null, biosimilar_flag: null, originator_flag: null,
    units_per_pack: null, strength_value_mg: null, volume_per_unit_ml: null, ddd_value_mg: null, unit_cost_eur: null,
    total_content_mg: null, ddds_per_pack: null, cost_per_mg: null, cost_per_ddd: null, mapping_confidence: null,
    quality_status: null, created_at: "2026-01-01T00:00:00Z", perimeter_status: "reference_medicine",
    comparable_eligible: true, comparable_unit: "MG", comparable_quantity: 100, comparable_stratum_id: stratumId, ...over,
  });
  const facts = [
    fact({ perimeter_status: "biosimilar", month: 1, total_cost_eur: 10, comparable_quantity: 100 }),
    fact({ month: 2, total_cost_eur: 100, comparable_quantity: 400 }),
    // A credit note: in the window and in R, never measurable.
    fact({ month: 3, total_cost_eur: -80, comparable_eligible: false, comparable_quantity: null }),
  ];
  const [row] = buildBiosimilarRows(facts, 2025, { classifyArea: () => ({ label: "-", status: "unmapped" }) });
  assert.equal(row.headroom_base_eur, 20);
  assert.equal(marginBase({ r_eur: 20, w_eur: 20, s_eur: 100 }).base, row.headroom_base_eur);
  assert.equal(marginBase({ r_eur: 20, w_eur: 20, s_eur: 100 }).binds, true);
});

// --------------------------------------------------------- selection match

test("selectionMatch: only all channels, the margin's year and twelve observed months", () => {
  assert.equal(MARGIN_YEAR, 2025);
  assert.equal(MARGIN_YEAR, Math.max(...Object.entries(RELEASE_COVERAGE).filter(([, m]) => m === 12).map(([y]) => Number(y))));
  assert.deepEqual(selectionMatch(2025, [], 12), { matches: true, text: "Coincide con la selezione del margine: tutti i canali, 2025." });
  assert.deepEqual(selectionMatch(2024, [], 12),
    { matches: false, text: "Anno diverso da quello del margine (2025): il confronto con il margine non si applica." });
  assert.deepEqual(selectionMatch(2025, ["CO"], 12),
    { matches: false, text: "Il margine conta tutti i canali: con un filtro per canale il confronto con il margine non si applica." });
  assert.deepEqual(selectionMatch(2025, [], 11),
    { matches: false, text: "In questa Azienda il 2025 ha 11 mesi osservati: la corrispondenza con il margine non è verificabile." });
});

// -------------------------------------------------------------------- labels

test("parseStratumLabel: the six-part content layout only, else a neutral fallback", () => {
  assert.deepEqual(parseStratumLabel("content|TEST-S|ENDOVENOSO|POLVERE|MG|2025", "MG", 2025),
    { route: "endovenosa", form: "polvere", unit: "MG" });
  assert.deepEqual(parseStratumLabel("content|TEST-S|INALATORIA_ORALE|SOSPENSIONE|G|2024", "G", 2024),
    { route: "inalatoria orale", form: "sospensione", unit: "G" }, "an unlisted route falls back to lower case");
  assert.deepEqual(parseStratumLabel("content|TEST-S|ENDOVENOSO+SOTTOCUTANEO|COLLIRIO, SOLUZIONE|MCG|2025", "MCG", 2025),
    { route: "endovenosa o sottocutanea", form: "collirio, soluzione", unit: "MCG" }, "a stratum of products with two routes");
  assert.deepEqual(parseStratumLabel("content|TEST-S|OFTALMICO|GEL|MG|2025", "MG", 2025).route, "oftalmica");
  assert.equal(parseStratumLabel("pack|TEST-S|ENDOVENOSO|POLVERE|2025|K1|P1", "MG", 2025), null, "a pack-tier id");
  assert.equal(parseStratumLabel("content|TEST-S|ENDOVENOSO|POLVERE|MG|2025", "MCG", 2025), null, "the unit disagrees");
  assert.equal(parseStratumLabel("content|TEST-S|ENDOVENOSO|POLVERE|MG|2025", "MG", 2024), null, "the year disagrees");
  assert.equal(parseStratumLabel("content|TEST-S|ENDOVENOSO|POLVERE|MG|2025|100", "MG", 2025), null, "an extra part");
  assert.equal(parseStratumLabel("content|TEST-S| |POLVERE|MG|2025", "MG", 2025), null, "a blank route");
  assert.equal(parseStratumLabel("content|TEST-S|ENDOVENOSO|POLVERE|UI|2025", "UI", 2025), null, "not a mass unit");
  const ordered = orderStrata([
    stratum("pack|TEST-S|X|Y|2025|K2|P", side(1, 1), null),
    stratum("pack|TEST-S|X|Y|2025|K1|P", side(1, 1), null),
    stratum(sid("ENDOVENOSO", "POLVERE"), side(1, 1), null),
  ], 2025);
  assert.deepEqual(ordered.map((o) => o.label),
    ["via endovenosa · polvere · mg", "Strato senza descrizione 1", "Strato senza descrizione 2"]);
  assert.equal(ordered[1].stratum.stratum_id, "pack|TEST-S|X|Y|2025|K1|P", "fallback numbers follow the id order");
});

test("the raw stratum id reaches the panel only for a widened reviewer", () => {
  const r = raw([base2025()]);
  const hidden = stratumCostPanel({ kind: "read", raw: r }, ctx());
  const shown = stratumCostPanel({ kind: "read", raw: r }, ctx({ showStratumIds: true }));
  assert.ok(hidden.blocks[0].molecules[0].strata.every((s) => s.rawId === null));
  assert.doesNotMatch(JSON.stringify(hidden), /content\|/);
  assert.deepEqual(shown.blocks[0].molecules[0].strata.map((s) => s.rawId).sort(), base2025().molecules[0].strata.map((s) => s.stratum_id).sort());
});

// ------------------------------------------------------------------ ordering

test("molecules: by reference spend, largest first, then by name", () => {
  const a = molecule({ name: "TEST-B", p: 500 }), b = molecule({ name: "TEST-A", p: 500 }), c = molecule({ name: "TEST-C", p: 900 });
  assert.deepEqual(orderMolecules([a, b, c]).map((m) => m.active_substance), ["TEST-C", "TEST-A", "TEST-B"]);
});

test("strata: by route, form and unit, unparsed last; never by a value per unit or by either side", () => {
  const ids = [
    sid("SOTTOCUTANEO", "SOLUZIONE"), "pack|TEST-S|X|Y|2025|K9|P", sid("ENDOVENOSO", "POLVERE"),
    sid("SOTTOCUTANEO", "PENNA"), sid("ENDOVENOSO", "POLVERE", "G"), "pack|TEST-S|X|Y|2025|K1|P",
  ];
  const unitOf = (id) => (id.startsWith("content") ? id.split("|")[4] : "MG");
  const values = [[100, 50], [700, 1000], [40, 900], [12, 3], [5000, 2], [80, 80]];
  const build = (vals, swap) => ids.map((id, i) => {
    const [spend, q] = vals[i];
    const one = side(spend, q, 5, unitOf(id)), other = side(spend * 2 + 1, q + 7, 5, unitOf(id));
    return stratum(id, swap[i] ? other : one, i % 3 === 0 ? null : swap[i] ? one : other);
  });
  const expected = [
    "via endovenosa · polvere · g", "via endovenosa · polvere · mg", "via sottocutanea · penna · mg",
    "via sottocutanea · soluzione · mg", "Strato senza descrizione 1", "Strato senza descrizione 2",
  ];
  const labelsOf = (strata) => {
    const y = year(2025, [molecule({ strata })]);
    const panel = stratumCostPanel({ kind: "read", raw: raw([y]) }, ctx({ facetsReference: facetsFor(y) }));
    assert.equal(panel.blocks[0].reconciled, true);
    return panel.blocks[0].molecules[0].strata.map((s) => s.label);
  };
  assert.deepEqual(labelsOf(build(values, ids.map(() => false))), expected);
  // 50 seeded shuffles: spend and quantity permuted across strata, and which
  // side carries the larger amount flipped at random. The order never moves.
  let seed = 20261017;
  const rand = () => { seed = (seed + 0x6d2b79f5) | 0; let t = seed; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  for (let k = 0; k < 50; k++) {
    const vals = [...values];
    for (let i = vals.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [vals[i], vals[j]] = [vals[j], vals[i]]; }
    const swap = ids.map(() => rand() < 0.5);
    assert.deepEqual(labelsOf(build(vals, swap)), expected, `shuffle ${k}`);
    assert.deepEqual(orderStrata(build(vals, swap), 2025).map((o) => o.label), expected);
  }
});

// -------------------------------------------------------- flags and channels

test("a side with fewer than 3 records is flagged, never hidden", () => {
  const y = base2025();
  y.molecules[0].strata[1].reference.rows_n = 3;
  const panel = stratumCostPanel({ kind: "read", raw: raw([y]) }, ctx());
  const rows = panel.blocks[0].molecules[0].strata;
  const pen = rows.find((s) => s.label === "via sottocutanea · penna · mg");
  const sol = rows.find((s) => s.label === "via sottocutanea · soluzione · mcg");
  assert.equal(pen.biosimilar.fewRecords, true, "2 records");
  assert.equal(pen.biosimilar.records, "2");
  assert.equal(sol.reference.fewRecords, false, "3 records");
  assert.equal(panel.fewRecordsNote, FEW_RECORDS_NOTE);
  assert.equal(FEW_RECORDS_NOTE, "⚑ meno di 3 record: il valore può coincidere con il prezzo di un singolo acquisto.");
});

test("channelShares: CO, DD, DPC, then the rest; zeros omitted; never an amount", () => {
  assert.equal(channelShares({ DPC: 15, CO: 85 }), "canali: CO 85% · DPC 15%");
  assert.equal(channelShares({ ZZ: 10, "": 10, DPC: 20, DD: 20, CO: 40, XX: 0 }),
    "canali: CO 40% · DD 20% · DPC 20% · canale non indicato 10% · ZZ 10%");
  for (const s of [channelShares({ CO: 1234.56 }), channelShares({ DD: 3, DPC: 1 })]) assert.doesNotMatch(s, /€/);
});

// ---------------------------------------------------------------- formatting

test("formatting: four significant digits, the unit after the euro sign, quantities up to two decimals", () => {
  assert.equal(formatEurSignificant(0.123449), `0,1234${NBSP}€`);
  assert.equal(formatEurSignificant(0.09871), `0,09871${NBSP}€`);
  assert.equal(formatEurSignificant(1234.5), `1.235${NBSP}€`);
  assert.equal(formatEurSignificant(0.5), `0,5000${NBSP}€`);
  assert.equal(formatEurSignificant(0.0000123456), `0,00001235${NBSP}€`);
  assert.equal(formatNumberUpTo(123456.789), "123.456,79");
  assert.match(formatUnitRate(0.123449, "MG"), /^0,1234 €\/mg$/);
  assert.equal(formatUnitRate(0.5, "MCG"), `0,5000${NBSP}€/mcg`);
  // A tiny rate is never printed as zero.
  const y = year(2025, [molecule({ strata: [stratum(sid("ENDOVENOSO", "POLVERE"), side(1, 400000), side(2, 900000))] })]);
  const panel = stratumCostPanel({ kind: "read", raw: raw([y]) }, ctx({ facetsReference: facetsFor(y) }));
  // Exact sums print zero parts as 0,00 €; a unit cost never prints as zero.
  for (const st of panel.blocks[0].molecules[0].strata) for (const r of [st.reference.rate, st.biosimilar.rate]) assert.doesNotMatch(r, /^0,00\D/);
  assert.equal(panel.blocks[0].molecules[0].strata[0].reference.rate, `0,000002500${NBSP}€/mg`);
});

test("the window and the opening as a reader sees them", () => {
  assert.equal(windowMonths(null, 2025), 0);
  assert.equal(windowMonths(2024 * 12 + 3, 2025), 12);
  assert.equal(windowMonths(2025 * 12 + 1, 2025), 12);
  assert.equal(windowMonths(2025 * 12 + 10, 2025), 3);
  assert.equal(windowMonths(2026 * 12 + 1, 2025), 0);
  assert.equal(openingLabel({ opening_key: null, opening_from_undated: false }, 2025), "nessun biosimilare con spesa positiva qui");
  assert.equal(openingLabel({ opening_key: 2025 * 12 + 4, opening_from_undated: false }, 2025), "2025-04");
  assert.equal(openingLabel({ opening_key: 2024 * 12 + 1, opening_from_undated: true }, 2025), "2024 (mese non indicato: la finestra parte da gennaio)");
  assert.equal(openingLabel({ opening_key: 2026 * 12 + 2, opening_from_undated: false }, 2025), "dopo il 2025");
  assert.equal(openingLabel({ opening_key: 2026 * 12 + 1, opening_from_undated: true }, 2025), "dopo il 2025");
});

// --------------------------------------------------------------- panel states

const FUNCTION_NAMES = /pillar_b|rpc|funzione pillar|stratum_unit_cost|getStratumUnitCost|PBR-/;

test("notices: exact copy, no function name", () => {
  const n = (kind) => stratumCostPanel({ kind }, ctx());
  assert.deepEqual(n("pick-azienda"), {
    kind: "notice",
    summary: "Costo lordo osservato per unità, nello stesso strato · scegli un'Azienda",
    notice: "Il costo per unità si legge un'Azienda alla volta: scegli un'Azienda nel filtro in alto.",
    linkToFilters: true,
  });
  assert.deepEqual(n("not-deployed"), {
    kind: "notice",
    summary: "Costo lordo osservato per unità, nello stesso strato · non ancora disponibile",
    notice: "Costo per strato non disponibile finché la funzione del database che lo calcola non è pubblicata.",
    linkToFilters: false,
  });
  assert.deepEqual(n("failed"), {
    kind: "notice",
    summary: "Costo lordo osservato per unità, nello stesso strato · non disponibile",
    notice: "La lettura del costo per strato non è riuscita in questo momento; il resto della pagina non ne dipende.",
    linkToFilters: false,
  });
  for (const kind of ["pick-azienda", "not-deployed", "failed"]) assert.doesNotMatch(JSON.stringify(n(kind)), FUNCTION_NAMES);
});

test("a reconciled panel is closed and prints every line of the year", () => {
  const y = base2025();
  y.molecules[0].not_compared = { unresolved_eur: 70, non_biosimilar_same_substance_eur: 30, other_eur: 0 };
  const panel = stratumCostPanel({ kind: "read", raw: raw([y]) }, ctx({ facetsReference: facetsFor(y) }));
  assert.equal(panel.kind, "ready");
  assert.equal(panel.open, false);
  assert.equal(panel.summary, "Costo lordo osservato per unità, nello stesso strato · ASL 9 · 2025 · somme verificate");
  assert.equal(panel.lead.length, 3);
  assert.equal(panel.exclusions.length, 8);
  const b = panel.blocks[0];
  assert.equal(b.reconciled, true);
  assert.equal(b.selectionLine, "Selezione: ASL 9 · 2025 · tutti i canali · tutte le molecole");
  assert.equal(b.selection.matches, true);
  assert.equal(b.funnelLine,
    `Spesa del riferimento 2025, molecole con un biosimilare: 1.200,00${NBSP}€ = prima del primo biosimilare qui 100,00${NBSP}€ + nella finestra, senza quantità di massa confrontabile 0,00${NBSP}€ + in strati con un solo lato 300,00${NBSP}€ + in strati con entrambi i lati 800,00${NBSP}€. Somma verificata al centesimo.`);
  assert.equal(b.notComparedLine, `Non attribuiti a nessuno dei due lati: stato non risolto 70${NBSP}€ · stessa sostanza, non biosimilare 30${NBSP}€.`);
  assert.equal(b.withoutBiosimilarLine, `Riferimento di molecole senza biosimilare in questa selezione: 50${NBSP}€.`);
  assert.equal(b.crossCheckLine, "La spesa del riferimento con mese indicato coincide al centesimo con quella letta per Azienda nel resto della pagina.");
  assert.equal(b.emptyLine, null);
  const m = b.molecules[0];
  assert.equal(m.openingLabel, "primo biosimilare con spesa positiva qui: 2024-03");
  assert.equal(m.windowLabel, "finestra 2025: 12 mesi su 12");
  assert.equal(m.funnelLine,
    `Riferimento 1.200,00${NBSP}€ = prima del primo biosimilare 100,00${NBSP}€ + senza quantità di massa 0,00${NBSP}€ + un solo lato 300,00${NBSP}€ + entrambi i lati 800,00${NBSP}€`);
  assert.equal(m.clampNote, null);
  const shared = m.strata.find((s) => s.sides === "entrambi i lati");
  assert.deepEqual(shared.reference, {
    spend: `800${NBSP}€`, quantity: "4.000 mg", rate: `0,2000${NBSP}€/mg`, records: "12", fewRecords: false, channels: "canali: CO 100%",
  });
  assert.equal(shared.biosimilar.rate, `0,1500${NBSP}€/mg`);
  assert.equal(shared.biosimilar.channels, "canali: CO 75% · DPC 25%");
  assert.deepEqual(m.strata.map((s) => s.sides), ["entrambi i lati", "solo biosimilare", "solo riferimento"]);
  // Without the facets the cross-check line says so.
  const noFacets = stratumCostPanel({ kind: "read", raw: raw([y]) }, ctx());
  assert.equal(noFacets.blocks[0].crossCheckLine, "Verifica con la spesa per Azienda del resto della pagina non disponibile.");
  assert.equal(noFacets.open, false);
});

test("the clamp note appears only on the margin's selection, when the window's net spend binds", () => {
  const strata = [stratum(sid("ENDOVENOSO", "POLVERE"), side(100, 400), side(10, 100))];
  const y = year(2025, [molecule({ strata, p: 0, n: -80 })]);       // R = W = 20, S = 100
  const panel = (c) => stratumCostPanel({ kind: "read", raw: raw([y]) }, ctx({ facetsReference: facetsFor(y), ...c }));
  assert.equal(panel().blocks[0].molecules[0].clampNote,
    `Nel margine la base di questa molecola si ferma alla spesa netta del riferimento nella finestra, rettifiche comprese: 20,00${NBSP}€ invece di 100,00${NBSP}€.`);
  assert.equal(panel({ channels: ["CO"] }).blocks[0].molecules[0].clampNote, null);
  assert.equal(panel({ channels: ["CO"] }).blocks[0].selectionLine, "Selezione: ASL 9 · 2025 · CO · tutte le molecole");
  const y24 = { ...clone(y), year: 2024 };
  const p24 = stratumCostPanel({ kind: "read", raw: raw([y24]) }, ctx());
  assert.equal(p24.blocks[0].molecules[0].clampNote, null);
});

test("an unreconciled year opens the panel and prints no value per unit", () => {
  const good = base2025();
  const bad = { ...base2025(), year: 2024 };
  bad.molecules[0].reference.m_eur += 1;
  const panel = stratumCostPanel({ kind: "read", raw: raw([bad, good]) }, ctx({ channels: ["CO", "DPC"], substance: "TEST-S" }));
  assert.equal(panel.open, true);
  assert.match(panel.summary, / · 2024 e 2025 · non riconciliato$/);
  assert.deepEqual(panel.blocks.map((b) => b.year), [2025, 2024], "the latest year first");
  const b = panel.blocks[1];
  assert.equal(b.reconciled, false);
  assert.deepEqual(b.molecules, []);
  assert.deepEqual([b.funnelLine, b.notComparedLine, b.withoutBiosimilarLine, b.crossCheckLine, b.emptyLine], [null, null, null, null, null]);
  assert.deepEqual(b.reasons, [STRATUM_REASONS.strata]);
  assert.doesNotMatch(JSON.stringify(b), /€\//);
  assert.equal(b.selectionLine, "Selezione: ASL 9 · 2024 · CO + DPC · TEST-S");
  // Every block unreconciled: no value per unit anywhere in the panel.
  const none = stratumCostPanel({ kind: "read", raw: raw([bad]) }, ctx());
  assert.doesNotMatch(JSON.stringify(none.blocks), /€\//);
  assert.doesNotMatch(JSON.stringify(none), /€\/(mg|mcg|g)\b/);
});

test("both empty states, the second keeping its funnel line", () => {
  const noMolecule = year(2025, [], { without: 400 });
  const a = stratumCostPanel({ kind: "read", raw: raw([noMolecule]) }, ctx({ facetsReference: facetsFor(noMolecule) })).blocks[0];
  assert.equal(a.reconciled, true);
  assert.equal(a.emptyLine, "Nessuna molecola con un biosimilare in questa selezione.");
  assert.equal(a.withoutBiosimilarLine, `Riferimento di molecole senza biosimilare in questa selezione: 400${NBSP}€.`);
  const oneSided = year(2025, [molecule({ strata: [stratum(sid("ENDOVENOSO", "POLVERE"), side(300, 100), null)] })], { noSubstance: 25 });
  const b = stratumCostPanel({ kind: "read", raw: raw([oneSided]) }, ctx({ facetsReference: facetsFor(oneSided) })).blocks[0];
  assert.equal(b.emptyLine, "Nessuno strato con entrambi i lati misurabili in questa selezione.");
  assert.match(b.funnelLine, /^Spesa del riferimento 2025, molecole con un biosimilare: /);
  assert.equal(b.withoutBiosimilarLine,
    `Riferimento di molecole senza biosimilare in questa selezione: 50${NBSP}€. Riferimento senza principio attivo: 25${NBSP}€.`);
  assert.equal(b.molecules[0].strata[0].sides, "solo riferimento");
});

test("an opening in 2026 is 'dopo il 2025', and 2026 appears nowhere", () => {
  const y = year(2025, [molecule({ opening: 2026 * 12 + 2, strata: [], p: 640, bioP: -5 })]);
  const panel = stratumCostPanel({ kind: "read", raw: raw([y]) }, ctx({ facetsReference: facetsFor(y) }));
  const m = panel.blocks[0].molecules[0];
  assert.equal(m.openingLabel, "primo biosimilare con spesa positiva qui: dopo il 2025");
  assert.equal(m.windowLabel, "finestra 2025: 0 mesi su 12");
  assert.doesNotMatch(JSON.stringify(panel), /2026/);
});

test("no organisation code reaches the panel: the code is used only to filter the facets", () => {
  const y = base2025();
  const facetsRows = [{ asl_code: "TEST-ASL-9", year: 2025, spend_eur: 1, rows_n: 1, comparable_spend_eur: null, biosimilar_eur: null, reference_eur: facetsOf(y) }];
  const panel = stratumCostPanel({ kind: "read", raw: raw([y]) },
    ctx({ facetsReference: stratumFacetsReference(facetsRows, "TEST-ASL-9"), showStratumIds: true }));
  assert.equal(panel.blocks[0].crossCheckLine.startsWith("La spesa del riferimento con mese indicato coincide"), true);
  const json = JSON.stringify(panel);
  assert.doesNotMatch(json, /"asl_code"|TEST-ASL-9/);
});

// -------------------------------------------------------------------- render

// The component is RENDERED, not only read: a load hook transpiles the .tsx
// with the project's own TypeScript (as in the narrow-layout tests).
const hook = `
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
let ts;
export async function initialize({ root }) { ts = createRequire(root + "package.json")("typescript"); }
export async function load(url, context, nextLoad) {
  if (!url.startsWith("file:") || !url.endsWith(".tsx")) return nextLoad(url, context);
  const file = fileURLToPath(url);
  const out = ts.transpileModule(readFileSync(file, "utf8"), { fileName: file, compilerOptions: {
    jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } });
  return { format: "module", source: out.outputText, shortCircuit: true };
}`;
register(`data:text/javascript,${encodeURIComponent(hook)}`, import.meta.url, { data: { root } });
const COMPONENT = "components/dashboard-review/pillar-b-stratum-cost.tsx";
const { PillarBStratumCost } = await import(pathToFileURL(`${root}${COMPONENT}`).href);
const html = (panel) => server.renderToStaticMarkup(React.createElement(PillarBStratumCost, { panel }));

const unescape = (s) => s.replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
const textOf = (s) => unescape(s.replace(/<[^>]+>/g, "")).trim();
const attr = (tag, name) => { const m = tag.match(new RegExp(`\\s${name}="([^"]*)"`)); return m ? unescape(m[1]) : null; };
/** The element that opens at `i` (a "<tag" index), whole, matched by nesting. */
function element(s, i) {
  const name = s.slice(i + 1).match(/^[a-zA-Z0-9]+/)[0];
  const re = new RegExp(`<(/?)${name}\\b[^>]*?(/?)>`, "g");
  re.lastIndex = i;
  let depth = 0, m;
  while ((m = re.exec(s))) {
    if (m[2] === "/") { if (depth === 0) return s.slice(i, re.lastIndex); continue; }
    depth += m[1] ? -1 : 1;
    if (depth === 0) return s.slice(i, re.lastIndex);
  }
  throw new Error(`unclosed <${name}>`);
}
const all = (s, re) => [...s.matchAll(re)].map((m) => element(s, m.index));
const REFUSED_WORDS = /risparmi|scont[oi]|rapport|differenz|econom|convenien|più bass|più car|meno car|guadagn|recuperabil|opportunit|cheaper|saving/i;

/** The swapped twin: the two sides' spends exchanged, everything else kept consistent. */
function sideSwapped() {
  const strata = (refSpend, bioSpend) => [stratum(sid("ENDOVENOSO", "POLVERE"), side(refSpend, 4000), side(bioSpend, 4000))];
  const make = (refSpend, bioSpend) => year(2025, [molecule({ strata: strata(refSpend, bioSpend) })]);
  return [make(800, 600), make(600, 800)];
}

function everyState() {
  const y = base2025();
  const reconciled = stratumCostPanel({ kind: "read", raw: raw([y]) }, ctx({ facetsReference: facetsFor(y) }));
  const reviewer = stratumCostPanel({ kind: "read", raw: raw([y]) }, ctx({ facetsReference: facetsFor(y), showStratumIds: true }));
  const bad = base2025();
  bad.legacy_mass_rows = 2;
  const failedYear = stratumCostPanel({ kind: "read", raw: raw([bad]) }, ctx());
  const empty = stratumCostPanel({ kind: "read", raw: raw([year(2025, [])]) }, ctx());
  const notices = ["pick-azienda", "not-deployed", "failed"].map((kind) => stratumCostPanel({ kind }, ctx()));
  return { reconciled, reviewer, failedYear, empty, notices };
}

test("render: no refused word, no 2026, no amount beside a share, in every state", () => {
  const s = everyState();
  for (const panel of [s.reconciled, s.reviewer, s.failedYear, s.empty, ...s.notices]) {
    const out = html(panel);
    assert.doesNotMatch(out, REFUSED_WORDS);
    assert.doesNotMatch(out, /2026/);
    // Exact sums print zero parts as 0,00 €; a unit cost never prints as zero.
    for (const t of all(out, /<span data-part="tariffa"[^>]*>[^<]*/g)) assert.doesNotMatch(t, />0,00\D/);
    // Every "%" lies inside a channel line, which carries no euro amount.
    const channelLines = all(out, /<span data-part="canali"/g);
    for (const c of channelLines) assert.doesNotMatch(c, /€/);
    let rest = out;
    for (const c of channelLines) rest = rest.replace(c, "");
    assert.doesNotMatch(rest, /%/);
    for (const t of all(out, /<span data-part="tariffa"/g)) assert.doesNotMatch(t, /%/);
    assert.doesNotMatch(out, /TEST-ASL|asl_code/);
  }
  assert.match(html(s.notices[0]), /<a href="#filtri"[^>]*>\s*Cambia selezione ↑\s*<\/a>/);
  assert.doesNotMatch(html(s.notices[1]), /href="#filtri"/);
  assert.match(html(s.reconciled), /^<details id="costo-per-strato" class="scroll-mt-8 rounded-xl border border-border bg-card p-4">/);
  assert.match(html(s.failedYear), /^<details id="costo-per-strato" class="[^"]*" open="">/, "a year that does not reconcile opens the panel");
  assert.doesNotMatch(html(s.failedYear), /data-part="tariffa"|€\/mg/);
  assert.match(textOf(html(s.failedYear)), /non riconciliato/);
});

test("render: both sides look the same; the cheaper side changes nothing but digits", () => {
  const out = html(everyState().reconciled);
  const classes = new Set(all(out, /<span data-part="tariffa"/g).map((t) => attr(t.match(/^<span[^>]*>/)[0], "class")));
  assert.equal(classes.size, 1, "every rate, on either side, carries the same class");
  const notes = new Set(all(out, /<span data-part="canali"/g).map((t) => attr(t.match(/^<span[^>]*>/)[0], "class")));
  assert.equal(notes.size, 1);
  const [a, b] = sideSwapped();
  const pa = stratumCostPanel({ kind: "read", raw: raw([a]) }, ctx({ facetsReference: facetsFor(a) }));
  const pb = stratumCostPanel({ kind: "read", raw: raw([b]) }, ctx({ facetsReference: facetsFor(b) }));
  assert.equal(pa.blocks[0].reconciled && pb.blocks[0].reconciled, true);
  assert.notEqual(html(pa), html(pb), "the figures did move");
  assert.equal(html(pa).replace(/\d/g, "#"), html(pb).replace(/\d/g, "#"));
});

test("render: the stacked list and the table hold the same strings; the raw id only for a reviewer", () => {
  const s = everyState();
  for (const panel of [s.reconciled, s.reviewer]) {
    const out = html(panel);
    const lists = all(out, /<ul translate="no"/g);
    const tables = all(out, /<table /g);
    assert.equal(lists.length, tables.length);
    assert.ok(lists.length > 0);
    lists.forEach((ul, i) => {
      const rates = (el) => all(el, /<span data-part="tariffa"/g).map(textOf);
      const shares = (el) => all(el, /<span data-part="canali"/g).map(textOf);
      assert.deepEqual(rates(ul), rates(tables[i]));
      assert.deepEqual(shares(ul), shares(tables[i]));
      assert.ok(rates(ul).length >= 3);
    });
    assert.match(out, /\[@container\(min-width:44\.125rem\)\]:hidden/);
    assert.match(out, /<table class="w-full min-w-\[44rem\] text-sm" translate="no">/);
  }
  const ids = base2025().molecules[0].strata.map((x) => x.stratum_id);
  for (const id of ids) {
    assert.ok(!html(s.reconciled).includes(id), "no raw id for a pseudonymised viewer");
    assert.ok(html(s.reviewer).includes(id), "the raw id for a reviewer");
  }
  // ⚑ follows the record count of the 2-record side, in both layouts.
  const flagged = (html(s.reconciled).match(/⚑/g) ?? []).length;
  assert.equal(flagged, 3, "twice for the flagged side (list and table), once in the footnote");
});

// -------------------------------------------------------------- source pins

test("the page reads one Azienda, optionally, after every filter, outside the shared cache", () => {
  const page = read("app/dashboard-review/revisione-pillar-b/page.tsx");
  assert.ok(page.includes("const stratumAsl = aslCode ?? (scope.scopedOrgs.length === 1 ? scope.scopedOrgs[0].aslCode : null);"));
  assert.match(page, /stratumAsl === null\s*\? Promise\.resolve\(\{ kind: "pick-azienda" \}\)/);
  assert.match(page, /getStratumUnitCost\(db, \{ years, aslCode: stratumAsl, channels, substance: filters\.substance \}\)\n\s*\.then\(\(raw\): StratumCostOutcome => \(\{ kind: "read", raw \}\)\)\n\s*\.catch\(\(error\): StratumCostOutcome => \{\n\s*if \(isMissingFunction\(error\)\) return \{ kind: "not-deployed" \};/);
  assert.match(page, /return \{ kind: "failed" \};/);
  assert.match(page, /aziendaRegionalWork,\n\s*stratumWork,\n\s*\]\);/, "in the second wave");
  assert.match(page, /coverage, aziendaRegional, stratum\] =/);
  assert.doesNotMatch(page, /(identified|shared)\([^\n]*(stratumWork|getStratumUnitCost)/, "neither fatal nor shared across filters");
  assert.equal((page.match(/getStratumUnitCost\(/g) ?? []).length, 1);
  assert.match(page, /aziendaLabel: stratumAsl === null \? null : \(scope\.aslLabels\[stratumAsl\] \?\? "Azienda selezionata"\)/);
  assert.match(page, /showStratumIds: scope\.allOrganizations,/);
  assert.match(page, /stratumCostSection: <PillarBStratumCost panel=\{stratumPanel\} \/>,/);
});

test("the review renders the panel last in Adozione, and its refusal list names the new limits", () => {
  const review = read("components/dashboard-review/pillar-b-review.tsx");
  const volume = review.indexOf('<Sub title="In volume');
  const section = review.indexOf("{adoption.stratumCostSection}");
  const concentration = review.indexOf('<Group id="concentrazione"');
  const close = review.lastIndexOf("</Group>", concentration);
  assert.ok(volume > 0 && section > volume && close > section);
  assert.doesNotMatch(review.slice(volume, section), /<\/Group>/);
  assert.match(review.slice(section, close), /^\{adoption\.stratumCostSection\}\s*$/);
  assert.ok(review.includes(`//   - a package total, or a quantity summed across comparability strata or
//     units (a quantity appears only as the denominator of one stratum's
//     observed €/unit, beside its spend)
//   - a ratio, a difference or a saving between two unit costs, or a colour
//     or an order that says which side is cheaper`));
  assert.ok(!review.includes("a package or quantity total of any kind"));
  const rpc = read("lib/dashboard-review/pillar-b/rpc.ts");
  assert.ok(rpc.includes("//   - a quantity outside its stratum: pillar_b_stratum_unit_cost returns quantity only per (stratum, side), in that stratum's own unit, beside its spend"));
  assert.match(rpc, /db\.rpc\("pillar_b_stratum_unit_cost", \{\n\s*p_years: \[\.\.\.args\.years\], p_asl_code: args\.aslCode,/);
  assert.match(rpc, /return parseStratumUnitCost\(data, args\);/);
});

test("the component is a server component with ordinal keys", () => {
  const src = read(COMPONENT);
  assert.doesNotMatch(src, /["']use client["']/);
  assert.doesNotMatch(src, /key=\{[^}]*(rawId|stratum|asl|label)[^}]*\}/i);
  assert.match(src, /<section key=\{`y\$\{b\.year\}`\}/);
  assert.match(src, /<details id="costo-per-strato" className="scroll-mt-8 rounded-xl border border-border bg-card p-4" open=\{panel\.kind === "ready" && panel\.open\}>/);
  const lib = read("lib/dashboard-review/pillar-b/stratum-cost.ts");
  assert.doesNotMatch(lib, /^import "server-only";/m, "pure: the harness and the tests drive it directly");
  // The one asl_code it touches is the facets rows' filter.
  assert.deepEqual(lib.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "").match(/\w*asl_code\w*/g), ["asl_code"]);
  assert.match(lib, /if \(r\.asl_code !== aslCode\) continue;/);
});
