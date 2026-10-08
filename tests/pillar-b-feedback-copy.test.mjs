import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

import { dumbbellCountPhrase, dumbbellLead, dumbbellRows, timelineLead, timelineModel } from "../lib/dashboard-review/pillar-b/adoption.ts";
import { buildValueUptake } from "../lib/dashboard-review/pillar-b/value-uptake.ts";
import { partialYearCopy } from "../lib/dashboard-review/pillar-b/view-options.ts";
import { notObservedFootnote, notObservedIntro } from "../lib/dashboard-review/pillar-b/review-queue.ts";
import { BRIDGE_B_GATES } from "../lib/dashboard-review/pillar-b/bridge-b.ts";
import { formatEur } from "../lib/dashboard-review/format.ts";

// The four findings the adversarial review of the reviewer-feedback batch
// confirmed (5 October 2026). Synthetic numbers only: this repository is public.

const vu = (s, v) => ({
  active_substance: s, first_local_month_key: v.first ?? null, perimeter_rows: 1, undated_rows: 0,
  inside_biosimilar_eur: v.ib ?? 0, inside_reference_eur: v.ir ?? 0, predates_biosimilar_eur: 0, predates_reference_eur: 0,
  boundary_biosimilar_eur: 0, boundary_reference_eur: 0, outside_biosimilar_eur: 0, outside_reference_eur: v.or ?? 0,
  unknown_biosimilar_eur: 0, unknown_reference_eur: 0, window_biosimilar_eur: v.wb ?? 0, window_reference_eur: v.wr ?? 0,
});

test("the dumbbell counts molecules with a measure by the table's own rule, and names the ones without", () => {
  const view = buildValueUptake([
    vu("alfa", { ib: 30, ir: 70, wb: 30, wr: 20, first: 2024 * 12 + 2 }),
    vu("beta", { ir: 50 }),                       // valid months, never used here: measured (quota 1)
    vu("gamma", { or: 40 }),                      // no valid month in the period: no measure at all
  ]);
  const rows = dumbbellRows(view);
  const tableMeasured = view.rows.filter((r) => r.dateValid.share !== null || r.locallyObserved.share !== null).length;
  assert.equal(tableMeasured, 2);
  const phrase = dumbbellCountPhrase(rows);
  assert.match(phrase, /^3 molecole: 2 con almeno una misura e 1 senza mesi validi nel periodo/);
  assert.doesNotMatch(phrase, /Tutte le 3/, "the old lead called all three measured");
  assert.equal(dumbbellCountPhrase(rows.filter((r) => r.substance !== "gamma")), "Tutte le 2 molecole con almeno una misura");
  assert.equal(dumbbellCountPhrase(rows.filter((r) => r.substance === "alfa")), "La molecola con almeno una misura");
});

test("with no 2026 record in the selection, no sentence says 2026 is in the calendar", () => {
  const cells = (year, months) => Array.from({ length: 12 }, (_, i) => ({ year, month: i + 1, spend_eur: months.includes(i + 1) ? 1 : null }));
  const seen = partialYearCopy([{ year: 2024, cells: cells(2024, [1, 2, 3]) }, { year: 2026, cells: cells(2026, [1, 2, 3, 4, 5]) }]);
  assert.equal(seen.observed, true);
  assert.equal(seen.header, "gen–mag 2026 · dati osservati fuori dai confronti annuali");
  assert.match(seen.distributionLead, /compaiono solo nel calendario/);
  assert.match(seen.limitsNote, /^gen–mag 2026 · dati osservati: zero record con quantità confrontabile\. Compare nel calendario/);

  for (const calendar of [
    [{ year: 2024, cells: cells(2024, [1, 2, 3]) }],                                   // no 2026 row
    [{ year: 2024, cells: cells(2024, [1]) }, { year: 2026, cells: cells(2026, []) }],  // a 2026 row with no month
  ]) {
    const none = partialYearCopy(calendar);
    assert.equal(none.observed, false);
    assert.equal(none.header, "2026: nessun record in questa selezione");
    for (const sentence of [none.header, none.distributionLead, none.limitsNote]) {
      assert.doesNotMatch(sentence, /nessun mese osservato fuori|compaiono solo nel calendario|^Compare nel calendario|· nessun mese osservato:/, sentence);
    }
    assert.match(none.distributionLead, /nessun mese ha record in questa selezione/);
    assert.match(none.limitsNote, /nessun mese del 2026 ha record/);
    assert.match(none.limitsNote, /mai un «primo semestre»/);
  }
  // without the calendar facet the release-wide five months stand
  assert.equal(partialYearCopy(null).header, "gen–mag 2026 · dati osservati fuori dai confronti annuali");
});

test("the timeline key is drawn only when there are dots to explain", () => {
  const root = fileURLToPath(new URL("..", import.meta.url));
  const src = fs.readFileSync(`${root}components/dashboard-review/pillar-b-adoption-visuals.tsx`, "utf8");
  const key = src.indexOf("THE KEY, VISIBLE");
  assert.ok(key > 0);
  const after = src.slice(key, key + 900);
  assert.match(after, /\{rows\.length > 0 && <ul /, "the key list sits behind the same guard as the timeline svg");
  assert.match(after, /\{rows\.length === 0 && <p /, "an empty timeline says so in words");
  assert.doesNotMatch(after, /^\s*<ul /m, "no unguarded key list");
});

test("the second queue's footnote is true for a zero, a positive and a negative pre-switch total", () => {
  const label = BRIDGE_B_GATES.B4_eu_authorised_never_bought_here.label;
  assert.equal(notObservedFootnote(0), `Questa lista coincide con la soglia «${label}».`);
  assert.equal(notObservedFootnote(0.004), `Questa lista coincide con la soglia «${label}».`, "sub-cent drift is zero");
  const plus = notObservedFootnote(1500);
  assert.match(plus, new RegExp(`^Sommata ai ${formatEur(1500)} di riferimento`));
  assert.match(plus, new RegExp(`coincide con la soglia «${label}»\\.$`));
  const minus = notObservedFootnote(-1500);
  assert.doesNotMatch(minus, /^Questa lista coincide/, "the old footnote claimed equality here");
  assert.match(minus, /un saldo di riferimento negativo \(rettifiche superiori alle dispensazioni\)/);
  assert.match(minus, new RegExp(`questa lista, meno ${formatEur(1500)}, coincide`), "B4 = list − |balance|: the unsigned amount is subtracted by name");
  assert.doesNotMatch(minus, /meno quel saldo/, "subtracting a negative balance would read as adding it");
  assert.doesNotMatch(minus, /-1\.500/, "the amount is named as a negative balance, not printed with a minus sign");
});

test("the dumbbell lead never points to dots or a table the state does not draw", () => {
  assert.equal(dumbbellLead([]), undefined, "no rows: the chart's own empty state speaks");
  assert.equal(dumbbellCountPhrase([]), "Nessuna molecola");
  const none = [{ dateValid: null, locallyObserved: null }];
  const lead = dumbbellLead(none);
  assert.match(lead, /^1 molecola senza mesi validi nel periodo: nessuna quota da disegnare/);
  assert.doesNotMatch(lead, /I valori esatti sono nella tabella|Tutte le|0 con almeno una misura|tabella numerica/,
    "with nothing measured the table is not rendered, so the lead does not name it");
  assert.match(dumbbellLead([{ dateValid: 0.25, locallyObserved: null }]), /I valori esatti sono nella tabella numerica/);
});

test("without the calendar facet no sentence points to a calendar", () => {
  const copy = partialYearCopy(null);
  for (const sentence of [copy.distributionLead, copy.limitsNote]) {
    assert.doesNotMatch(sentence, /[Cc]ompar(e|iono) (solo )?nel calendario/, sentence);
    assert.match(sentence, /calendario mensile non è disponibile/);
  }
  assert.equal(copy.header, "gen–mag 2026 · dati osservati fuori dai confronti annuali");
});

test("the queue intro and its footnote agree on how the second list relates to B4, for every sign", () => {
  for (const before of [1500, 0, 0.004, -0.004, -1500]) {
    const intro = notObservedIntro(before);
    const foot = notObservedFootnote(before);
    const cent = Math.round(before * 100) / 100;
    if (cent > 0) {
      assert.match(intro, /solo una parte di B4/);
      assert.match(foot, /^Sommata ai/);
    } else if (cent === 0) {
      assert.match(intro, /coincide con B4/);
      assert.match(foot, /^Questa lista coincide/);
      assert.doesNotMatch(intro, /solo una parte/, `before=${before}`);
    } else {
      assert.match(intro, /supera B4/);
      assert.match(foot, /meno /);
      assert.doesNotMatch(intro, /solo una parte/, `before=${before}`);
    }
  }
});

test("a selection whose only molecules have no valid month is not called empty by the timeline", () => {
  const view = buildValueUptake([vu("gamma", { or: 40 })]);
  const model = timelineModel(view, { fromKey: 2024 * 12 + 1, toKey: 2026 * 12 + 5 });
  assert.deepEqual([model.rows.length, model.neverObserved.length, model.notYetValid.length], [0, 0, 1]);
  const root = fileURLToPath(new URL("..", import.meta.url));
  const src = fs.readFileSync(`${root}components/dashboard-review/pillar-b-adoption-visuals.tsx`, "utf8");
  assert.match(src, /rows\.length === 0 && neverObserved\.length === 0 && model\.notYetValid\.length === 0 \? <p[^>]*>Nessuna molecola nel perimetro/,
    "the empty state requires notYetValid to be empty too, so its list is shown");
});

test("the timeline lead describes dots only when there are dots", () => {
  const window = { fromKey: 2024 * 12 + 1, toKey: 2026 * 12 + 5 };
  const neverHere = timelineModel(buildValueUptake([vu("beta", { ir: 50 })]), window);
  const notYetValid = timelineModel(buildValueUptake([vu("gamma", { or: 40 })]), window);
  const withDot = timelineModel(buildValueUptake([vu("alfa", { ib: 3, ir: 7, wb: 3, wr: 4, first: 2024 * 12 + 2 })]), window);
  assert.equal(timelineLead(neverHere, true), undefined, "the second queue's links lead here: no dot, no dot lead");
  assert.equal(timelineLead(notYetValid, true), undefined);
  assert.match(timelineLead(withDot, true), /^Un punto per molecola/);
  assert.match(timelineLead(withDot, false), /il filtro per Azienda non è applicato/);
});

test("a single-molecule dumbbell lead is grammatical: no plural ordering clause", () => {
  const one = dumbbellLead([{ dateValid: 0.3, locallyObserved: 0.5 }]);
  assert.match(one, /^La molecola con almeno una misura\. Grigio/);
  assert.doesNotMatch(one, /ordinate/);
  assert.match(dumbbellLead([{ dateValid: 0.3, locallyObserved: null }, { dateValid: 0.1, locallyObserved: 0.2 }]),
    /^Tutte le 2 molecole con almeno una misura, ordinate per spesa/);
});

test("the components call the helpers, so reverting a call site fails a test", () => {
  const root = fileURLToPath(new URL("..", import.meta.url));
  const read = (p) => fs.readFileSync(`${root}${p}`, "utf8");
  const vis = read("components/dashboard-review/pillar-b-adoption-visuals.tsx");
  assert.ok(vis.includes("lead={dumbbellLead(shown)}"), "dumbbell lead from the helper");
  assert.ok(vis.includes("lead={timelineLead(model, followsAzienda)}"), "timeline lead from the helper");
  assert.doesNotMatch(vis, /Tutte le \$\{formatNumber\(shown\.length/, "the old literal dumbbell lead is gone");
  assert.doesNotMatch(vis, /lead=\{"Un punto per molecola/, "the old literal timeline lead is gone");

  const review = read("components/dashboard-review/pillar-b-review.tsx");
  for (const call of ["{partial.header}", "${partial.distributionLead}", "{partial.limitsNote}",
    "notObservedIntro(adoption.reviewQueue.beforeLocalSwitchTotal)", "notObservedFootnote(adoption.reviewQueue.beforeLocalSwitchTotal)"]) {
    assert.ok(review.includes(call), `review renders ${call}`);
  }
  assert.doesNotMatch(review, /partialLabel/, "no sentence is built around the bare span label any more");
  assert.doesNotMatch(review, /La seconda è <strong>solo una parte di B4<\/strong>/, "the unconditional intro sentence is gone");

  const bar = read("components/dashboard-review/pillar-b-filter-bar.tsx");
  assert.match(bar, /partialYear\.months === 1 \? "mese" : "mesi"/, "one observed month is 'mese', not '1 mesi'");
  assert.match(bar, /partialYear\.inCalendar \? "; visibile solo nel calendario, non nei confronti\."/);
  assert.match(bar, /partialYear\.months === 1 \? " osservato" : " osservati"/);
  const page = read("app/dashboard-review/revisione-pillar-b/page.tsx");
  assert.match(page, /calendar === null\s*\? \{ \.\.\.PARTIAL_YEAR, inCalendar: false \}/, "no calendar facet: the pill does not point to a calendar");
  assert.match(page, /partialRow\.monthsObserved === 0 \? null/, "no observed 2026 month: no pill");
});

test("the timeline's lists are exhaustive: a never-switched molecule with net-negative valid spend is listed, not dropped", () => {
  const window = { fromKey: 2024 * 12 + 1, toKey: 2026 * 12 + 5 };
  const negative = buildValueUptake([vu("delta", { ir: -120 })]);
  const m = timelineModel(negative, window);
  assert.deepEqual([m.rows.length, m.neverObserved.length, m.notYetValid.length], [0, 1, 0]);
  assert.equal(m.neverObserved[0].referenceEur, -120);
  const mixed = buildValueUptake([
    vu("alfa", { ib: 3, ir: 7, wb: 3, wr: 4, first: 2024 * 12 + 2 }), vu("beta", { ir: 50 }), vu("gamma", { or: 40 }), vu("delta", { ir: -120 }),
  ]);
  const mm = timelineModel(mixed, window);
  assert.equal(mm.rows.length + mm.neverObserved.length + mm.notYetValid.length, mixed.rows.length, "every molecule lands in exactly one list");
});
