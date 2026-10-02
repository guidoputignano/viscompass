import test from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULT_PILLAR_B_FILTERS, activePillarBFilterCount, aslCodeFor, channelsArg,
  describePillarBFilters, orgCodeFromAsl, parsePillarBFilters, pillarBHref, toggleChannel,
  yearsArg,
} from "../lib/dashboard-review/pillar-b/filters.ts";
import {
  aslBreakdown, calendarRows, channelMix, parseFacets, perimeterRows,
} from "../lib/dashboard-review/pillar-b/facets.ts";
import {
  distinctUptakeGroups, distinctWithheldGroups, dumbbellRows, timelineModel, volumeBreakdown,
} from "../lib/dashboard-review/pillar-b/adoption.ts";
import { buildValueUptake } from "../lib/dashboard-review/pillar-b/value-uptake.ts";

const BASE = "/dashboard-review/revisione-pillar-b";

// --- years -----------------------------------------------------------------

test("the default is both complete years, and 2026 cannot be typed in", () => {
  assert.deepEqual(parsePillarBFilters({}).years, [2024, 2025]);
  assert.deepEqual(parsePillarBFilters({ anno: "2025" }).years, [2025]);
  // A hand-edited partial year is dropped, not honoured.
  assert.deepEqual(parsePillarBFilters({ anno: "2026" }).years, [2024, 2025]);
  assert.deepEqual(parsePillarBFilters({ anno: "abc" }).years, [2024, 2025]);
});

test("the years argument to the RPC is an explicit array, never null", () => {
  assert.deepEqual(yearsArg(DEFAULT_PILLAR_B_FILTERS), [2024, 2025]);
  assert.deepEqual(yearsArg(parsePillarBFilters({ anno: "2024" })), [2024]);
  assert.ok(Array.isArray(yearsArg(DEFAULT_PILLAR_B_FILTERS)));
});

// --- channels ---------------------------------------------------------------

test("channels combine, unknown codes are dropped, all three normalise to all", () => {
  assert.deepEqual(parsePillarBFilters({ canale: "CO,DD" }).channels, ["CO", "DD"]);
  assert.deepEqual(parsePillarBFilters({ canale: "CO,XX" }).channels, ["CO"]);
  assert.deepEqual(parsePillarBFilters({ canale: "CO,DD,DPC" }).channels, []);
  assert.deepEqual(parsePillarBFilters({ canale: "DD,DD" }).channels, ["DD"]);
  assert.equal(channelsArg(parsePillarBFilters({})), null);
  assert.deepEqual(channelsArg(parsePillarBFilters({ canale: "DPC" })), ["DPC"]);
});

test("toggling a channel never leaves an empty selection", () => {
  const all = DEFAULT_PILLAR_B_FILTERS;
  // From "all", switching one off leaves the other two.
  assert.deepEqual(toggleChannel(all, "CO"), ["DD", "DPC"]);
  const two = { ...all, channels: ["DD", "DPC"] };
  assert.deepEqual(toggleChannel(two, "DPC"), ["DD"]);
  const one = { ...all, channels: ["DD"] };
  // Switching the last one off means "all", which is the only thing a view can show.
  assert.deepEqual(toggleChannel(one, "DD"), []);
  // Switching the third back on is "all" again, normalised to empty.
  assert.deepEqual(toggleChannel(two, "CO"), []);
});

// --- Azienda ------------------------------------------------------------------

test("an Azienda is accepted only from the caller's own allowed list", () => {
  assert.equal(parsePillarBFilters({ ambito: "201" }, ["201", "202"]).asl, "201");
  // An Azienda account has no narrowable list: the parameter is ignored.
  assert.equal(parsePillarBFilters({ ambito: "202" }, []).asl, null);
  // A code outside the list is ignored even for a Regione.
  assert.equal(parsePillarBFilters({ ambito: "999" }, ["201", "202"]).asl, null);
});

test("asl_code and org_code translate both ways and are idempotent", () => {
  assert.equal(aslCodeFor("201", "130"), "130201");
  assert.equal(aslCodeFor("130201", "130"), "130201");
  assert.equal(orgCodeFromAsl("130201", "130"), "201");
  assert.equal(orgCodeFromAsl("201", "130"), "201");
});

// --- URL round-trip ----------------------------------------------------------

test("a filter state round-trips through its URL", () => {
  const state = {
    years: [2025], channels: ["CO", "DPC"], substance: "adalimumab", asl: "203",
  };
  const href = pillarBHref(BASE, state, {});
  const url = new URL(href, "https://example.invalid");
  const back = parsePillarBFilters(Object.fromEntries(url.searchParams), ["203"]);
  assert.deepEqual(back, state);
  assert.equal(pillarBHref(BASE, DEFAULT_PILLAR_B_FILTERS, {}), BASE);
});

test("the scope line names what is selected and never a raw code", () => {
  assert.equal(describePillarBFilters(DEFAULT_PILLAR_B_FILTERS),
    "intero perimetro visibile · 2024 e 2025 · tutti i canali");
  assert.equal(describePillarBFilters(
    { years: [2024], channels: ["DD"], substance: "etanercept", asl: "201" }, "ASL 1"),
    "ASL 1 · 2024 · DD · etanercept");
  assert.equal(activePillarBFilterCount(DEFAULT_PILLAR_B_FILTERS), 0);
  assert.equal(activePillarBFilterCount({ years: [2024], channels: ["DD"], substance: "x", asl: "201" }), 4);
});

// --- facets ------------------------------------------------------------------

const FACETS = {
  release: "R", years: [2024, 2025],
  totals: { spend_eur: "100", rows_n: "3", comparable_spend_eur: "60", asl_count: 2, substance_count: 2 },
  months: [
    { year: 2024, month: 1, key: 2024 * 12 + 1, spend_eur: "40", rows_n: 1, comparable_spend_eur: "30", biosimilar_eur: null, reference_eur: null },
    { year: 2025, month: 2, key: 2025 * 12 + 2, spend_eur: "60", rows_n: 2, comparable_spend_eur: "30", biosimilar_eur: "10", reference_eur: "20" },
    { year: 2026, month: 1, key: 2026 * 12 + 1, spend_eur: "5", rows_n: 1, comparable_spend_eur: null, biosimilar_eur: null, reference_eur: null },
  ],
  asl: [
    { asl_code: "130201", year: 2024, spend_eur: "40", rows_n: 1, comparable_spend_eur: "30", biosimilar_eur: "0", reference_eur: "10" },
    { asl_code: "130201", year: 2025, spend_eur: "20", rows_n: 1, comparable_spend_eur: "10", biosimilar_eur: "10", reference_eur: "0" },
    { asl_code: "130202", year: 2025, spend_eur: "40", rows_n: 1, comparable_spend_eur: "20", biosimilar_eur: null, reference_eur: null },
  ],
  channels_by_year: [
    { channel: "DD", year: 2024, spend_eur: "40", rows_n: 1, comparable_spend_eur: "30", biosimilar_eur: null, reference_eur: null },
    { channel: "CO", year: 2025, spend_eur: "60", rows_n: 2, comparable_spend_eur: "30", biosimilar_eur: null, reference_eur: null },
  ],
  perimeter: [
    { perimeter_status: "outside_biosimilar_perimeter", aic_count: 5, rows_n: 2, spend_eur: "80" },
    { perimeter_status: "biosimilar", aic_count: 1, rows_n: 1, spend_eur: "20" },
  ],
  molecules: null,
};

test("facet numerics arrive as strings and are parsed, not concatenated", () => {
  const f = parseFacets(FACETS);
  assert.equal(f.totals.spend_eur, 100);
  assert.equal(f.months[1].biosimilar_eur, 10);
  assert.equal(f.molecules, null);
});

test("the calendar keeps 'not observed' apart from zero and marks 2026 partial", () => {
  const rows = calendarRows(parseFacets(FACETS).months);
  assert.deepEqual(rows.map((r) => r.year), [2024, 2025, 2026]);
  const y24 = rows[0];
  assert.equal(y24.partial, false);
  assert.equal(y24.cells[0].spend_eur, 40);
  assert.equal(y24.cells[1].spend_eur, null);      // February 2024: no record
  assert.equal(y24.monthsObserved, 1);
  assert.equal(y24.total_eur, 40);
  const y26 = rows[2];
  assert.equal(y26.partial, true);
  assert.equal(y26.cells[0].comparable_share, null); // null comparable, not 0%
});

test("the Azienda breakdown sums years, labels through the caller, and keeps shares honest", () => {
  const rows = aslBreakdown(parseFacets(FACETS).asl, (c) => (c === "130201" ? "ASL 1" : c));
  assert.equal(rows.length, 2);
  const a = rows.find((r) => r.asl_code === "130201");
  assert.equal(a.label, "ASL 1");
  assert.equal(a.spend_eur, 60);
  assert.deepEqual(a.byYear, { 2024: 40, 2025: 20 });
  assert.equal(a.comparable_share, 40 / 60);
  assert.equal(a.biosimilar_eur, 10);
  assert.equal(a.reference_eur, 10);
  // No adoption ratio on this row: a status-only share would be a third
  // denominator. The model must not offer one for a component to reach for.
  assert.equal("perimeter_share" in a, false);
  const b = rows.find((r) => r.asl_code === "130202");
  assert.equal(b.label, "130202");               // unmapped stays a bare code
  assert.equal(b.biosimilar_eur, 0);
});

test("channel mix orders CO, DD, DPC and shares sum to one", () => {
  const mix = channelMix(parseFacets(FACETS).channelsByYear);
  assert.deepEqual(mix.map((m) => m.channel), ["CO", "DD"]);
  assert.ok(Math.abs(mix.reduce((s, m) => s + m.share, 0) - 1) < 1e-12);
});

test("perimeter rows carry a label and a share of the whole", () => {
  const rows = perimeterRows(parseFacets(FACETS).perimeter);
  assert.equal(rows[0].label, "Fuori dal perimetro biosimilare");
  assert.equal(rows[0].share, 0.8);
});

// --- adoption ---------------------------------------------------------------

const VU = [
  { active_substance: "a", inside_biosimilar_eur: 30, inside_reference_eur: 70, predates_biosimilar_eur: null,
    predates_reference_eur: null, boundary_biosimilar_eur: null, boundary_reference_eur: 5, outside_biosimilar_eur: null,
    outside_reference_eur: 10, unknown_biosimilar_eur: null, unknown_reference_eur: null,
    window_biosimilar_eur: 30, window_reference_eur: 20, first_local_month_key: 2024 * 12 + 3, perimeter_rows: 9, undated_rows: 0 },
  { active_substance: "b", inside_biosimilar_eur: 0, inside_reference_eur: 200, predates_biosimilar_eur: null,
    predates_reference_eur: null, boundary_biosimilar_eur: null, boundary_reference_eur: null, outside_biosimilar_eur: null,
    outside_reference_eur: null, unknown_biosimilar_eur: null, unknown_reference_eur: null,
    window_biosimilar_eur: null, window_reference_eur: null, first_local_month_key: null, perimeter_rows: 4, undated_rows: 0 },
];

test("the dumbbell orders by reference spend at stake and keeps a never-observed share null", () => {
  const rows = dumbbellRows(buildValueUptake(VU));
  assert.deepEqual(rows.map((r) => r.substance), ["b", "a"]);
  assert.equal(rows[0].dateValid, 0);              // alternative exists, never bought: 0%, a real figure
  assert.equal(rows[0].locallyObserved, null);     // never observed here: no share, not 0%
  assert.equal(rows[1].locallyObserved, 0.6);
});

test("the timeline separates opened substances from never-observed ones", () => {
  const m = timelineModel(buildValueUptake(VU), { fromKey: 2024 * 12 + 1, toKey: 2026 * 12 + 5 });
  assert.deepEqual(m.rows.map((r) => r.substance), ["a"]);
  assert.equal(m.rows[0].firstLabel, "2024-03");
  assert.deepEqual(m.neverObserved.map((r) => r.substance), ["b"]);
  assert.deepEqual(m.notYetValid, []);
});

test("a substance with no date-valid spend is distinct from 'an alternative existed and was not used'", () => {
  // pertuzumab in 2024–2025: every month is `outside` (biosimilar authorised
  // 2026-04), so the date-valid denominator is 0 and nothing could be used.
  const rows = [...VU, {
    active_substance: "pertuzumab", inside_biosimilar_eur: null, inside_reference_eur: null,
    predates_biosimilar_eur: null, predates_reference_eur: null, boundary_biosimilar_eur: null,
    boundary_reference_eur: null, outside_biosimilar_eur: null, outside_reference_eur: 9_000_000,
    unknown_biosimilar_eur: null, unknown_reference_eur: null, window_biosimilar_eur: null,
    window_reference_eur: null, first_local_month_key: null, perimeter_rows: 12, undated_rows: 0,
  }];
  const m = timelineModel(buildValueUptake(rows), { fromKey: 2024 * 12 + 1, toKey: 2026 * 12 + 5 });
  assert.deepEqual(m.neverObserved.map((r) => r.substance), ["b"]);
  assert.deepEqual(m.notYetValid.map((r) => r.substance), ["pertuzumab"]);
});

test("the dumbbell keeps a first use outside the selected period distinguishable from 'never'", () => {
  // aflibercept: first local use 2026-03, selected years 2024–2025 → no window
  // month in the period, but it WAS dispensed here.
  const rows = [...VU, {
    active_substance: "aflibercept", inside_biosimilar_eur: 0, inside_reference_eur: 5_900_000,
    predates_biosimilar_eur: null, predates_reference_eur: null, boundary_biosimilar_eur: null,
    boundary_reference_eur: null, outside_biosimilar_eur: null, outside_reference_eur: null,
    unknown_biosimilar_eur: null, unknown_reference_eur: null, window_biosimilar_eur: null,
    window_reference_eur: null, first_local_month_key: 2026 * 12 + 3, perimeter_rows: 24, undated_rows: 0,
  }];
  const d = dumbbellRows(buildValueUptake(rows)).find((r) => r.substance === "aflibercept");
  assert.equal(d.locallyObserved, null);
  assert.equal(d.firstLocalLabel, "2026-03");   // the chart must say "fuori periodo", not "mai"
  assert.ok(d.denominatorEur > 0);
});

test("group counts are of groups, not of per-year rows", () => {
  // The same (Azienda, substance, route, unit) group appears once per selected
  // year; concatenating two years must not count it twice.
  const row = (year) => ({
    asl_code: "130201", active_substance: "x", route: "sc", comparable_unit: "mg",
    whole_period_biosimilar_qty: 1, whole_period_total_qty: 2, window_biosimilar_qty: 1,
    window_total_qty: 2, first_local_biosimilar_key: year * 12 + 1, opening_evidence: "",
  });
  assert.equal(distinctUptakeGroups([row(2024), row(2025)]), 1);
  assert.equal(distinctUptakeGroups([row(2024), { ...row(2025), comparable_unit: "IU" }]), 2);
  const w = (year) => ({ asl_code: "130201", active_substance: "x", withheld_reason: "basis", rows_n: year, spend_eur: 1 });
  assert.equal(distinctWithheldGroups([w(2024), w(2025)]), 1);
  assert.equal(distinctWithheldGroups([w(2024), { ...w(2025), asl_code: "130202" }]), 2);
});

test("volume breakdown never adds quantities across units", () => {
  const rows = volumeBreakdown([
    { asl_code: "130201", active_substance: "x", route: "sc", comparable_unit: "mg",
      whole_period_biosimilar_qty: 10, whole_period_total_qty: 100, window_biosimilar_qty: 10, window_total_qty: 50,
      first_local_biosimilar_key: 2024 * 12 + 6, opening_evidence: "" },
    { asl_code: "130202", active_substance: "x", route: "sc", comparable_unit: "mg",
      whole_period_biosimilar_qty: 30, whole_period_total_qty: 100, window_biosimilar_qty: null, window_total_qty: null,
      first_local_biosimilar_key: null, opening_evidence: "" },
    { asl_code: "130202", active_substance: "x", route: "sc", comparable_unit: "IU",
      whole_period_biosimilar_qty: 1, whole_period_total_qty: 1, window_biosimilar_qty: 1, window_total_qty: 1,
      first_local_biosimilar_key: 2025 * 12 + 1, opening_evidence: "" },
  ]);
  assert.equal(rows.length, 2);                    // mg and IU are separate cells
  const mg = rows.find((r) => r.unit === "mg");
  assert.equal(mg.aslCount, 2);
  assert.equal(mg.wholePeriod.share, 0.2);
  assert.equal(mg.window.share, 0.2);              // the null window row contributed nothing
  assert.equal(mg.firstKey, 2024 * 12 + 6);
});
