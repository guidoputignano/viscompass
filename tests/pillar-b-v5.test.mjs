import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

import { channelYearMix, perimeterComposition, regionalComparatorAllowed } from "../lib/dashboard-review/pillar-b/facets.ts";
import { dumbbellGapPoints, dumbbellLead, dumbbellMarkLabel, dumbbellPlottable } from "../lib/dashboard-review/pillar-b/adoption.ts";
import { notObservedFootnoteAdds } from "../lib/dashboard-review/pillar-b/review-queue.ts";
import { formatEur, formatPercent } from "../lib/dashboard-review/format.ts";

// Feedback v5 (Guido, 8 October 2026), items PB-V5-01, 02, 04, 06, 07.
// Synthetic numbers only: this repository is public.

const p = (perimeter_status, spend_eur, aic_count = 1) => ({ perimeter_status, spend_eur, aic_count, rows_n: 1 });

test("PB-V5-04: the composition's 100% is biosimilar + reference spend; everything else is context", () => {
  const c = perimeterComposition([
    p("outside_biosimilar_perimeter", 9000, 50), p("biosimilar", 300, 4), p("reference_medicine", 700, 3),
    p("unresolved", 40, 2), p("non_biosimilar_same_substance", 20, 1), p("unclassified", 10, 0),
  ]);
  assert.equal(c.base, 1000);
  assert.deepEqual(c.parts.map((x) => [x.status, x.eur, x.share]), [["biosimilar", 300, 0.3], ["reference_medicine", 700, 0.7]]);
  assert.equal(c.parts.reduce((s, x) => s + x.share, 0), 1, "the composition sums to 100%");
  assert.ok(!c.context.some((x) => x.status === "biosimilar" || x.status === "reference_medicine"));
  const outside = c.context.find((x) => x.status === "outside_biosimilar_perimeter");
  assert.equal(outside.eur, 9000);
  assert.equal(c.reported, 10070);
  assert.ok(Math.abs(outside.shareOfReported - 9000 / 10070) < 1e-12, "outside spend is a share of ALL reported spend, never of the perimeter");
  assert.equal(c.drawable, true);
});

test("PB-V5-04: an empty or negative base draws no composition, and a missing status is not a zero row", () => {
  const empty = perimeterComposition([p("outside_biosimilar_perimeter", 500)]);
  assert.equal(empty.base, 0);
  assert.ok(empty.parts.every((x) => x.share === null && x.observed === false));
  assert.equal(empty.drawable, false);
  const credit = perimeterComposition([p("biosimilar", -50), p("reference_medicine", 400)]);
  assert.equal(credit.drawable, false, "a credit-note-negative part cannot be a segment of a 100% bar");
  const onlyRef = perimeterComposition([p("reference_medicine", 400)]);
  assert.equal(onlyRef.parts[0].observed, false);
  assert.equal(onlyRef.parts[1].share, 1);
  const nulls = perimeterComposition([p("biosimilar", null), p("reference_medicine", 400)]);
  assert.equal(nulls.parts[0].observed, false, "a null spend is 'no record', not 0 €");
});

const mixRow = (channel, byYear) => ({ channel, spend_eur: Object.values(byYear).reduce((s, v) => s + v, 0), share: null, byYear, comparable_share: null });

test("PB-V5-01: each population's channel mix sums to 100% per year, on its own total", () => {
  const azienda = [mixRow("CO", { 2024: 30, 2025: 40 }), mixRow("DD", { 2024: 70, 2025: 60 })];
  const region = [mixRow("CO", { 2024: 300, 2025: 330 }), mixRow("DD", { 2024: 500, 2025: 520 }), mixRow("DPC", { 2024: 200, 2025: 150 })];
  const channels = ["CO", "DD", "DPC"];
  const a = channelYearMix(azienda, [2024, 2025], channels);
  const r = channelYearMix(region, [2024, 2025], channels);
  for (const mix of [...a, ...r]) {
    assert.equal(mix.drawable, true);
    const sum = mix.parts.reduce((s, x) => s + (x.share ?? 0), 0);
    assert.ok(Math.abs(sum - 1) < 1e-12, `${mix.year} sums to ${sum}`);
  }
  assert.deepEqual(a[0].parts.map((x) => x.share), [0.3, 0.7, null], "a channel the Azienda has no record in is 'nessun record', not 0%");
  assert.equal(a[0].parts[2].eur, null);
  assert.equal(r[1].total, 1000);
  assert.deepEqual(a.map((m) => m.parts.map((x) => x.channel)), r.map((m) => m.parts.map((x) => x.channel)), "same channels, same order: comparable bars");
});

test("PB-V5-01: a zero or negative year total is not a 100% bar", () => {
  const zero = channelYearMix([mixRow("CO", { 2024: 0 })], [2024, 2025], ["CO"]);
  assert.equal(zero[0].drawable, false);
  assert.equal(zero[0].parts[0].share, null);
  assert.equal(zero[1].drawable, false, "a year with no record at all");
  const credit = channelYearMix([mixRow("CO", { 2024: 100 }), mixRow("DD", { 2024: -20 })], [2024], ["CO", "DD"]);
  assert.equal(credit[0].drawable, false);
});

test("PB-V5-01: the regional comparator is for a multi-Azienda scope with an Azienda selected, never for an Azienda account", () => {
  assert.equal(regionalComparatorAllowed({ scopeAziende: 4, aziendaSelected: true }), true, "Regione or reviewer, one Azienda selected");
  assert.equal(regionalComparatorAllowed({ scopeAziende: 4, aziendaSelected: false }), false, "nothing selected: the mix already is regional");
  assert.equal(regionalComparatorAllowed({ scopeAziende: 1, aziendaSelected: true }), false, "an Azienda account");
  assert.equal(regionalComparatorAllowed({ scopeAziende: 0, aziendaSelected: false }), false);
  const root = fileURLToPath(new URL("..", import.meta.url));
  const page = fs.readFileSync(`${root}app/dashboard-review/revisione-pillar-b/page.tsx`, "utf8");
  assert.match(page, /comparatorAllowed\s*\?\s*getFacets\(db, \{ years, channels, substance: filters\.substance, aslCode: null, facets: \["channels"\] \}\)\s*\.catch\([\s\S]{0,140}?\)\s*: Promise\.resolve\(null\)/,
    "the regional call is made only when allowed, under the same client and the same filters, without the Azienda predicate");
  assert.match(page, /regionalComparatorAllowed\(\{ scopeAziende: scope\.narrowable\.length, aziendaSelected: aslCode !== null \}\)/);
});

const R = {
  substance: "alfa", dateValid: 0.25, locallyObserved: 0.4, dateValidBiosimilarEur: 250, denominatorEur: 1000,
  localBiosimilarEur: 200, localDenominatorEur: 500, firstLocalLabel: "2024-03",
};

test("PB-V5-02: every dumbbell mark names its measure, value, numerator over denominator, period and scope", () => {
  const scope = "intero perimetro visibile · 2024 e 2025 · tutti i canali";
  const q1 = dumbbellMarkLabel(R, "quota1", scope);
  assert.ok(q1.includes("quota 1, mesi a validità riconosciuta"));
  assert.ok(q1.includes(scope));
  assert.ok(q1.includes(`${formatPercent(0.25)} = ${formatEur(250)} biosimilare ÷ ${formatEur(1000)} biosimilare + riferimento`));
  const q2 = dumbbellMarkLabel(R, "quota2", scope);
  assert.ok(q2.includes("quota 2, mesi dal primo uso qui") && q2.includes(`${formatEur(200)} biosimilare ÷ ${formatEur(500)}`));
  assert.ok(Math.abs(dumbbellGapPoints(R) - 15) < 1e-9, "the connector is a gap in percentage points");
});

test("PB-V5-02: a missing measure says why, and a measured zero is shown as 0%", () => {
  const never = dumbbellMarkLabel({ ...R, locallyObserved: null, firstLocalLabel: null }, "quota2", "s");
  assert.match(never, /non calcolabile, nessun biosimilare dispensato qui nel rilascio/);
  assert.doesNotMatch(never, /0%/);
  const outside = dumbbellMarkLabel({ ...R, locallyObserved: null }, "quota2", "s");
  // The first-use clock reads the whole release: a missing quota 2 means no
  // spend from the first use on IN THIS SELECTION, not "outside the period".
  assert.match(outside, /nessuna spesa in questa selezione dal primo uso qui \(2024-03\)/);
  assert.doesNotMatch(outside, /fuori dal periodo/);
  const noValid = dumbbellMarkLabel({ ...R, dateValid: null }, "quota1", "s");
  assert.match(noValid, /nessun mese a validità riconosciuta/);
  const zero = dumbbellMarkLabel({ ...R, dateValid: 0, dateValidBiosimilarEur: 0 }, "quota1", "s");
  assert.ok(zero.includes(`${formatPercent(0)} = ${formatEur(0)} biosimilare`));
  assert.equal(dumbbellGapPoints({ dateValid: null, locallyObserved: 0.3 }), null);
  assert.equal(dumbbellGapPoints({ dateValid: 0.3, locallyObserved: 0.3 }), 0, "coincident shares: a zero gap, drawn as a dot inside a ring");
});

test("PB-V5-02: the lead says the marks are positions on 0–100%, the line is a gap, not time, and coincident marks stay visible", () => {
  const lead = dumbbellLead([{ dateValid: 0.2, locallyObserved: 0.3 }, { dateValid: 0.5, locallyObserved: 0.5 }]);
  assert.match(lead, /la sua posizione è la quota misurata, non l'inizio di una barra/);
  assert.match(lead, /differenza fra le due quote, in punti percentuali, non un andamento nel tempo/);
  assert.match(lead, /quando le quote coincidono il cerchio circonda il punto/);
  const root = fileURLToPath(new URL("..", import.meta.url));
  const vis = fs.readFileSync(`${root}components/dashboard-review/pillar-b-adoption-visuals.tsx`, "utf8");
  assert.match(vis, /r="6\.5" fill="none" stroke=\{slate\}/, "quota 1 is a hollow ring");
  assert.match(vis, /r="4\.5" fill=\{teal\}/, "quota 2 is a filled dot inside it");
  assert.match(vis, /<line x1=\{x\(0\)\} y1=\{y\} x2=\{x\(1\)\} y2=\{y\}/, "each row has its 0–100% track");
});

// PB-V5-06 / 07: no internal implementation term reaches the hospital-facing copy.
function stripComments(src) {
  // Comments and import lines are code, not copy: a module path like
  // "@/lib/.../workbook-map" is not hospital-facing text. Line endings first:
  // a Windows checkout (core.autocrlf) has CRLF, and every pattern below is
  // written for "\n".
  return src.replace(/\r\n/g, "\n").replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1").replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, "")
    .replace(/^import [^;]*;$/gm, "");
}

test("PB-V5-06/07: customer-facing copy carries no gate code, workbook block code, ledger jargon or sheet number", () => {
  const root = fileURLToPath(new URL("..", import.meta.url));
  const files = [
    "components/dashboard-review/pillar-b-review.tsx", "components/dashboard-review/pillar-b-bridge-b.tsx",
    "components/dashboard-review/pillar-b-adoption-visuals.tsx", "components/dashboard-review/pillar-b-value-uptake.tsx",
    "components/dashboard-review/pillar-b-panels.tsx", "components/dashboard-review/pillar-b-review-visuals.tsx",
    "components/dashboard-review/pillar-b-monthly-bars.tsx", "components/dashboard-review/pillar-b-filter-bar.tsx",
    "lib/dashboard-review/pillar-b/view-options.ts", "lib/dashboard-review/pillar-b/review-queue.ts",
    "lib/dashboard-review/pillar-b/bridge-b.ts", "lib/dashboard-review/pillar-b/facets.ts", "lib/dashboard-review/pillar-b/adoption.ts",
  ];
  for (const f of files) {
    let src = stripComments(fs.readFileSync(`${root}${f}`, "utf8"));
    if (f.endsWith("pillar-b-review.tsx")) {
      // The internal inventory is allowed inside its own component, which the
      // page renders only for the platform reviewers (checked below).
      const i = src.indexOf("function WorkbookMap()");
      const j = src.indexOf("\n}\n", i);
      assert.ok(i >= 0 && j > i, "the reviewer-only block was found and cut, not duplicated");
      src = src.slice(0, i) + src.slice(j + 3);
    }
    for (const bad of [/libro mastro/i, /\bworkbook\b/i, /fogli? (0?\d|\d{2})\b/i, /\(B(0[3-9]|1[0-6])\)/, /\bB1[0-6] nei Limiti/, /con B_ADDRESSABLE_REFERENCE/, /\{g\.id\}<\/span>/, /coincide con B4|parte di B4|supera B4/]) {
      assert.doesNotMatch(src, bad, `${f} still shows ${bad}`);
    }
  }
});

test("PB-V5-07: the workbook inventory and the release id render only for the platform reviewers", () => {
  const root = fileURLToPath(new URL("..", import.meta.url));
  const review = fs.readFileSync(`${root}components/dashboard-review/pillar-b-review.tsx`, "utf8");
  const uses = [...review.matchAll(/<WorkbookMap \/>/g)];
  assert.equal(uses.length, 1, "rendered in one place only");
  const before = review.slice(Math.max(0, uses[0].index - 700), uses[0].index);
  assert.match(before, /\{props\.scope\.allOrganizations && \(/, "behind the reviewer-widening flag");
  assert.match(before, /Interno · visibile solo ai revisori della piattaforma · rilascio \{props\.releaseId\}/);
  assert.equal([...review.matchAll(/\{props\.releaseId\}/g)].length, 1, "the release id appears only in the internal panel");
});

test("PB-V5-04: a status with no record has no share in the composition", () => {
  const onlyRef = perimeterComposition([p("reference_medicine", 700, 3)]);
  assert.equal(onlyRef.parts[0].observed, false);
  assert.equal(onlyRef.parts[0].share, null, "'nessun record', never 0%");
  assert.equal(onlyRef.parts[1].share, 1);
});

test("PB-V5-02: a share outside 0–100% or on a non-positive denominator is never drawn or clamped", () => {
  const neg = { ...R, dateValid: -50 / 350, dateValidBiosimilarEur: -50, denominatorEur: 350 };
  assert.equal(dumbbellPlottable(neg, "quota1"), false);
  assert.match(dumbbellMarkLabel(neg, "quota1", "s"), /non calcolabile, rettifiche nette/);
  assert.equal(dumbbellGapPoints(neg), null, "no gap beside a mark that is not drawn");
  const credit = { ...R, dateValid: 0 / -120, dateValidBiosimilarEur: 0, denominatorEur: -120 };
  assert.equal(dumbbellPlottable(credit, "quota1"), false, "a credit-note denominator is not a 0% position");
  assert.doesNotMatch(dumbbellMarkLabel(credit, "quota1", "s"), /-0%/);
  assert.equal(dumbbellPlottable({ ...R, locallyObserved: 1.5 }, "quota2"), false);
  assert.equal(dumbbellPlottable(R, "quota1"), true);
  const lead = dumbbellLead([{ dateValid: -0.1, locallyObserved: 0.3 }]);
  assert.match(lead, /fuori da 0–100% per rettifiche nette non è disegnata/);
});

test("PB-V5-02: the gap is rounded before its sign is taken and agrees with the printed shares", () => {
  const g = (a, b) => dumbbellGapPoints({ dateValid: a, locallyObserved: b });
  assert.ok(Object.is(g(0.3334, 0.3333), 0), "33,3% and 33,3%: 0, never -0");
  assert.ok(Object.is(g(0.3, 0.1 + 0.2), 0), "float noise is not a gap");
  assert.equal(g(0.33349, 0.33351), 0.1, "33,3% and 33,4% print a 0,1 gap");
  assert.equal(g(0.124, 0.2), 7.6, "12,4% and 20%: 7,6 p.p., as a reader would subtract");
  assert.equal(g(0.2, 0.124), -7.6);
});

test("PB-V5-05: the second list's method says 'coincide' once", () => {
  assert.equal(notObservedFootnoteAdds(0), false);
  assert.equal(notObservedFootnoteAdds(-0.004), false, "sub-cent drift is zero");
  assert.equal(notObservedFootnoteAdds(1500), true);
  assert.equal(notObservedFootnoteAdds(-1500), true);
});

test("PB-V5-01/03: what the review of the v5 diff found stays fixed", () => {
  const root = fileURLToPath(new URL("..", import.meta.url));
  const read = (f) => fs.readFileSync(`${root}${f}`, "utf8").replace(/\r\n/g, "\n");
  const page = read("app/dashboard-review/revisione-pillar-b/page.tsx");
  // The note names an Azienda account by the account, not by a count of one.
  assert.match(page, /channelsComparatorNote: !scope\.regional && !scope\.allOrganizations\n/);
  // The optional regional read fails on its own, never taking the page down.
  assert.match(page, /aslCode: null, facets: \["channels"\] \}\)\n\s*\.catch\(/);
  assert.match(page, /regionalWork,\n\s*\]\);/);
  // No database function name in a notice a hospital user can read.
  assert.doesNotMatch(page, /"[^"\n]*pillar_b_[a-z_]+[^"\n]*"/);
  assert.doesNotMatch(page, /`[^`\n]*pillar_b_[a-z_]+[^`\n]*`/);
  const review = read("components/dashboard-review/pillar-b-review.tsx");
  // A reconciliation that does not tie opens and says so.
  assert.match(review, /open=\{adoption\.bridge !== null && !adoption\.bridgeReady\}/);
  assert.match(review, / · non riconciliata in questa selezione/);
  assert.match(page, /bridgeOutcome !== null && !bridgeReady\n\s*\? "Le domande di revisione non sono mostrate/);
  const vis = read("components/dashboard-review/pillar-b-adoption-visuals.tsx");
  assert.doesNotMatch(vis, /opacity: sub/, "the Region bar is told apart by height and label, not by fading its text");
  assert.doesNotMatch(vis, /uso fuori periodo/);
  assert.doesNotMatch(vis, /a !== null && <circle/, "a mark is drawn only when plottable");
});
