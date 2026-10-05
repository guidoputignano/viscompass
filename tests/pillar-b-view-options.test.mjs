import test from "node:test";
import assert from "node:assert/strict";

import {
  partialPeriodLabel, trendFigures, TREND_FIGURE_HEADINGS,
  calendarCellValue, effectiveCalendarState, localOptionParams, monthSlots, monthlyChartSeries, parseViewOptions, perimeterOnly, routeOptions,
  slimConcentration, sortTrend, volumeByRoute, withViewOption,
} from "../lib/dashboard-review/pillar-b/view-options.ts";
import { concentration } from "../lib/dashboard-review/pillar-b/review-data.ts";
import { DEFAULT_PILLAR_B_FILTERS, pillarBHref } from "../lib/dashboard-review/pillar-b/filters.ts";

const T = (key, spend2024, spend2025) => ({
  key, label: key, spend2024, spend2025, changeEur: spend2025 - spend2024,
  change: spend2024 === 0 ? null : (spend2025 - spend2024) / Math.abs(spend2024), rows2024: 1, rows2025: 1, negativeRows: 0,
});

test("options parse to their closed lists and fall back to defaults", () => {
  const o = parseViewOptions({ cal: "comparabile", serie: "2024", az: "record", ord: "pct", n: "25", perimetro: "biosimilare", conc: "2024", concperimetro: "biosimilare", via: "SOTTOCUTANEO" }, ["SOTTOCUTANEO"], 2025);
  assert.deepEqual(o, { calendar: "comparabile", monthView: "2024", azienda: "record", trendOrder: "pct", trendLimit: 25, perimeter: "biosimilare", concentrationYear: 2024, concentrationPerimeter: "biosimilare", route: null });
  const d = parseViewOptions({ cal: "x", n: "7", conc: "2026", via: "ORALE" }, ["SOTTOCUTANEO"], 2025);
  assert.deepEqual(d, { calendar: "spesa", monthView: "confronto", azienda: "spesa", trendOrder: "delta", trendLimit: 10, perimeter: "tutto", concentrationYear: 2025, concentrationPerimeter: "tutto", route: null });
  // The two perimeter switches are independent keys: one cannot move the other.
  const p = parseViewOptions({ perimetro: "biosimilare" }, [], 2025);
  assert.equal(p.perimeter, "biosimilare");
  assert.equal(p.concentrationPerimeter, "tutto");
  assert.equal(parseViewOptions({ serie: "2026", cal: "comparabile" }, [], 2025).calendar, "spesa");
});

test("a route not present in the rows is dropped, so the table cannot be narrowed to nothing by the URL", () => {
  assert.equal(parseViewOptions({ via: "ENDOVENOSO" }, ["SOTTOCUTANEO"], 2025).route, null);
  assert.equal(parseViewOptions({ via: "ENDOVENOSO" }, ["SOTTOCUTANEO", "ENDOVENOSO"], 2025).route, "ENDOVENOSO");
  // One route is no choice: the key is dropped rather than shown as a note without a control.
  assert.equal(parseViewOptions({ via: "SOTTOCUTANEO" }, ["SOTTOCUTANEO"], 2025).route, null);
});

test("a global filter change carries the local options and never lets them override a filter key", () => {
  const keep = localOptionParams("?anno=2025&cal=comparabile&serie=2024&ord=pct&n=25&via=SOTTOCUTANEO&foo=bar&molecola=x");
  assert.deepEqual([...keep.entries()], [["cal", "comparabile"], ["serie", "2024"], ["ord", "pct"], ["n", "25"], ["via", "SOTTOCUTANEO"]]);
  const href = pillarBHref("/b", DEFAULT_PILLAR_B_FILTERS, { substance: "adalimumab" }, keep);
  assert.equal(href, "/b?molecola=adalimumab&cal=comparabile&serie=2024&ord=pct&n=25&via=SOTTOCUTANEO");
  // A key that collides with a filter key cannot be smuggled in through `keep`.
  assert.equal(pillarBHref("/b", DEFAULT_PILLAR_B_FILTERS, {}, new URLSearchParams("ambito=204&cal=spesa")), "/b?cal=spesa");
  assert.equal(pillarBHref("/b", DEFAULT_PILLAR_B_FILTERS, {}), "/b");
});

test("sorting ties are deterministic: equal rates break by 2025 spend, then by key, in every input order", () => {
  const rows = [T("x", 10, 20), T("y", 50, 100), T("z", 10, 20), T("n1", 0, 5), T("n2", 0, 5)];
  const expected = ["y", "x", "z", "n1", "n2"];
  assert.deepEqual(sortTrend(rows, "pct").map((r) => r.key), expected);
  assert.deepEqual(sortTrend([...rows].reverse(), "pct").map((r) => r.key), expected);
  assert.deepEqual(sortTrend(rows, "delta").map((r) => r.key), ["y", "x", "z", "n1", "n2"]);
});

test("writing an option keeps the other parameters and removes defaults", () => {
  assert.equal(withViewOption("?anno=2025&cal=spesa", "cal", "comparabile", "spesa"), "?anno=2025&cal=comparabile");
  assert.equal(withViewOption("?anno=2025&cal=comparabile", "cal", "spesa", "spesa"), "?anno=2025");
  assert.equal(withViewOption("", "n", 10, 10), "");
  assert.equal(withViewOption("?via=SOTTOCUTANEO", "via", "", ""), "");
});

test("sorting: by euro change, by rate with null rates last, by 2025 spend", () => {
  const rows = [T("a", 100, 150), T("b", 0, 40), T("c", 1000, 900), T("d", 10, 30)];
  assert.deepEqual(sortTrend(rows, "delta").map((r) => r.key), ["c", "a", "b", "d"]);
  assert.deepEqual(sortTrend(rows, "pct").map((r) => r.key), ["d", "a", "c", "b"]);   // b: change from zero is null → last
  assert.deepEqual(sortTrend(rows, "spesa").map((r) => r.key), ["c", "a", "b", "d"]);
});

test("the perimeter switch keeps only perimeter substances and says it is substance-level", () => {
  const rows = [T("adalimumab", 1, 2), T("ossigeno", 3, 4), T("etanercept", 5, 6)];
  assert.deepEqual(perimeterOnly(rows, new Set(["adalimumab", "etanercept"])).map((r) => r.key), ["adalimumab", "etanercept"]);
});

test("the slim concentration samples the same points the full curve draws", () => {
  const rows = Array.from({ length: 300 }, (_, i) => ({
    active_substance: `m${i}`, asl_code: "130201", channel: "DD", rows_n: 1, spend_eur: 300 - i,
    comparable_rows: 0, comparable_spend_eur: null, negative_rows: 0,
    rows_basis_packages: 0, rows_basis_units: 0, rows_basis_mixed: 0, rows_basis_unknown: 0,
  }));
  const full = concentration(rows);
  const slim = slimConcentration(full);
  assert.equal(slim.rows.length, 25);
  assert.deepEqual(slim.samples.map((s) => s.rank), [1, 5, 10, 25, 50, 100, 250, 300]);
  for (const s of slim.samples) assert.equal(s.cumulativeShare, full.rows[s.rank - 1].cumulativeShare);
  assert.equal(slim.topFiveShare, full.topFiveShare);
  assert.equal(slim.totalEur, full.totalEur);
});

test("calendar metrics: a month with no record is null under every metric; the perimeter metric is an amount", () => {
  const cell = { year: 2024, month: 1, spend_eur: 100, rows_n: 3, comparable_share: 0.75, perimeter_eur: 40, partial: false };
  assert.equal(calendarCellValue(cell, "spesa"), 100);
  assert.equal(calendarCellValue(cell, "comparabile"), 0.75);
  assert.equal(calendarCellValue(cell, "perimetro"), 40);
  const none = { ...cell, spend_eur: null, comparable_share: null, perimeter_eur: null };
  for (const m of ["spesa", "comparabile", "perimetro"]) assert.equal(calendarCellValue(none, m), null);
});

test("monthly bars omit missing months without converting them to zero and isolate partial 2026", () => {
  const cell = (year, month, spend, share) => ({ year, month, spend_eur: spend, rows_n: spend === null ? 0 : 1,
    comparable_share: share, perimeter_eur: spend === null ? null : spend / 2, partial: year === 2026 });
  const rows = [
    { year: 2024, partial: false, monthsObserved: 2, total_eur: 10, cells: [cell(2024, 1, 10, .5), cell(2024, 2, 0, null), cell(2024, 3, null, null)] },
    { year: 2025, partial: false, monthsObserved: 1, total_eur: 12, cells: [cell(2025, 1, 12, .75), cell(2025, 2, null, null)] },
    { year: 2026, partial: true, monthsObserved: 1, total_eur: 9, cells: [cell(2026, 1, 9, null), cell(2026, 6, null, null)] },
  ];
  assert.deepEqual(monthlyChartSeries(rows, "confronto", "spesa"), [
    { year: 2024, month: 1, value: 10 }, { year: 2024, month: 2, value: 0 }, { year: 2025, month: 1, value: 12 },
  ]);
  assert.deepEqual(monthlyChartSeries(rows, "2026", "comparabile"), []);
  assert.deepEqual(monthlyChartSeries(rows, "2026", "spesa"), [{ year: 2026, month: 1, value: 9 }]);
});

test("routes are the distinct routes of the rows, and the route filter is exact", () => {
  const v = (route) => ({ substance: "x", route, unit: "mg", aslCount: 1, wholePeriod: { biosimilar: 1, total: 2, share: 0.5 }, window: { biosimilar: 1, total: 2, share: 0.5 }, firstKey: null });
  const rows = [v("SOTTOCUTANEO"), v("ENDOVENOSO"), v("SOTTOCUTANEO")];
  assert.deepEqual(routeOptions(rows), ["ENDOVENOSO", "SOTTOCUTANEO"]);
  assert.equal(volumeByRoute(rows, "SOTTOCUTANEO").length, 2);
  assert.equal(volumeByRoute(rows, null).length, 3);
});

test("the calendar falls back to a period with records, and a fallback to 2026 never draws a comparable share", () => {
  const only2026 = [{ year: 2024, monthsObserved: 0 }, { year: 2025, monthsObserved: 0 }, { year: 2026, monthsObserved: 3 }];
  assert.deepEqual(effectiveCalendarState(only2026, "confronto", "comparabile"), { available: ["2026"], view: "2026", metric: "spesa" });
  const both = [{ year: 2024, monthsObserved: 12 }, { year: 2025, monthsObserved: 12 }, { year: 2026, monthsObserved: 5 }];
  assert.deepEqual(effectiveCalendarState(both, "confronto", "comparabile"), { available: ["confronto", "2024", "2025", "2026"], view: "confronto", metric: "comparabile" });
  assert.deepEqual(effectiveCalendarState(both, "2026", "perimetro").metric, "perimetro");
  const none = [];
  assert.deepEqual(effectiveCalendarState(none, "2025", "spesa"), { available: [], view: "confronto", metric: "spesa" });
});

test("month slots: twelve for a complete year, the observed span for 2026, so a missing month is a visible gap", () => {
  const cells = (year, months) => Array.from({ length: 12 }, (_, i) => ({ year, month: i + 1, spend_eur: months.includes(i + 1) ? 1 : null }));
  const rows = [{ year: 2024, cells: cells(2024, [1, 2]) }, { year: 2026, cells: cells(2026, [1, 2, 3, 4, 5]) }];
  assert.deepEqual(monthSlots(rows, "2024"), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  assert.deepEqual(monthSlots(rows, "confronto").length, 12);
  assert.deepEqual(monthSlots(rows, "2026"), [1, 2, 3, 4, 5]);
  assert.deepEqual(monthSlots([], "2026"), []);
});

test("the partial year is named by its observed months, never 'parziale' alone or a semester", () => {
  const cells = (year, months) => Array.from({ length: 12 }, (_, i) => ({ year, month: i + 1, spend_eur: months.includes(i + 1) ? 1 : null }));
  assert.equal(partialPeriodLabel([{ year: 2026, cells: cells(2026, [1, 2, 3, 4, 5]) }]), "gen–mag 2026 · dati osservati");
  assert.equal(partialPeriodLabel([{ year: 2026, cells: cells(2026, [3]) }]), "mar 2026 · dati osservati");
  // a gap inside the span stays a gap on the chart; the label names the span
  assert.equal(partialPeriodLabel([{ year: 2026, cells: cells(2026, [1, 3]) }]), "gen–mar 2026 · dati osservati");
  assert.equal(partialPeriodLabel([{ year: 2024, cells: cells(2024, [1, 2]) }]), "2026 · nessun mese osservato");
  assert.equal(partialPeriodLabel([]), "2026 · nessun mese osservato");
  for (const label of [partialPeriodLabel([{ year: 2026, cells: cells(2026, [1, 2, 3, 4, 5, 6]) }])]) {
    assert.doesNotMatch(label, /semestre|parziale/i);
  }
});

test("the figure beside a molecule follows the sort measure, and a rate over no 2024 base is not calculable", () => {
  const row = { changeEur: -4321, change: -0.12, spend2025: 31690 };
  assert.deepEqual(trendFigures(row, "delta"), { primary: { kind: "eur", value: -4321 }, secondary: { kind: "pct", value: -0.12 } });
  assert.deepEqual(trendFigures(row, "pct"), { primary: { kind: "pct", value: -0.12 }, secondary: { kind: "eur", value: -4321 } });
  assert.deepEqual(trendFigures(row, "spesa"), { primary: { kind: "eur", value: 31690 }, secondary: { kind: "eur", value: -4321 } });
  const fromNothing = { changeEur: 777, change: null, spend2025: 777 };
  assert.deepEqual(trendFigures(fromNothing, "pct").primary, { kind: "na" });
  assert.deepEqual(trendFigures(fromNothing, "delta").secondary, { kind: "na" });
  for (const order of ["delta", "pct", "spesa"]) assert.ok(TREND_FIGURE_HEADINGS[order].length > 0);
  assert.match(TREND_FIGURE_HEADINGS.spesa, /della molecola/);
});
