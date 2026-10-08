import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import { fileURLToPath } from "node:url";

import { formatEur, formatNumber, formatPercent } from "../lib/dashboard-review/format.ts";

// Narrow layouts, group g5 (8 October 2026): the value-uptake numeric table,
// the two review-question tables, the withheld-groups and record-funnel tables
// and the internal sheet inventory switch on the width of their OWN wrapper
// (a CSS container), not on the viewport. On a phone, on a tablet beside the
// sidebar, and in the two review cards that sit side by side from lg, the
// tables hid most of their columns behind a sideways scroll.
// Synthetic numbers only: this repository is public.

const root = fileURLToPath(new URL("..", import.meta.url));
const read = (f) => fs.readFileSync(`${root}${f}`, "utf8").replace(/\r\n/g, "\n");
const uptake = read("components/dashboard-review/pillar-b-value-uptake.tsx");
const review = read("components/dashboard-review/pillar-b-review.tsx");
const count = (src, s) => src.split(s).length - 1;
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** The source of one top-level declaration, from its first line to its closing brace. */
function declaration(src, head) {
  const i = src.indexOf(head);
  assert.ok(i >= 0, `${head} is declared`);
  // A function: past its parameter list (whose types may hold braces); a const: past its "=".
  let k = i + head.length;
  if (head.startsWith("function ")) {
    let parens = 0;
    for (k = src.indexOf("(", i); k < src.length; k++) {
      if (src[k] === "(") parens++;
      else if (src[k] === ")" && --parens === 0) break;
    }
  } else k = src.indexOf("=", i);
  const open = src.indexOf("{", k);
  let depth = 0;
  for (let j = open; j < src.length; j++) {
    if (src[j] === "{") depth++;
    else if (src[j] === "}" && --depth === 0) return src.slice(i, j + 1) + (src[j + 1] === ";" ? ";" : "");
  }
  throw new Error(`${head} is not closed`);
}

/** Evaluates the cell helpers as they are written in the component, with the real formatters. */
function helpers(src, heads, names) {
  const code = stripTypeScriptTypes(heads.map((h) => declaration(src, h)).join("\n"));
  return new Function("formatEur", "formatPercent", "formatNumber", `${code}\nreturn { ${names.join(", ")} };`)(formatEur, formatPercent, formatNumber);
}

/**
 * One container switch: a wrapper that is the container, the stacked list
 * hidden from the threshold, the unchanged table shown from it. The threshold
 * is the table's min-width plus its two 1px borders (0.125rem), so at the
 * switch the table fits without a sideways scroll.
 */
function assertSwitch(src, { wrapper, list, wide, minW, label, at = null }) {
  // The switch sits at the table's min-width plus its borders, or later where
  // the measured content needs more (\`at\`).
  const threshold = at ?? `${minW + 0.125}rem`;
  const re = new RegExp(
    esc(wrapper) + "\\n\\s*" + esc(list).replace("THRESHOLD", esc(threshold)) + "[\\s\\S]*?\\n\\s*</ul>\\n\\s*" +
    esc(wide).replace("THRESHOLD", esc(threshold)) + "\\n\\s*" + esc(`<table className="w-full min-w-[${minW}rem] text-sm" translate="no">`));
  assert.match(src, re, `${label}: one container wrapper holding the list (hidden from ${threshold}) and then the table (shown from ${threshold})`);
}

test("value uptake: the numeric table switches on its section's width at 54rem, and the cards at 30rem", () => {
  assertSwitch(uptake, {
    label: "value uptake",
    wrapper: '<div className="mt-3 [container-type:inline-size]">',
    list: '<ul aria-label="Spesa biosimilare e di riferimento per principio attivo, sui due denominatori" translate="no"\n            className="divide-y divide-border rounded-xl border border-border text-xs [@container(min-width:THRESHOLD)]:hidden">',
    wide: '<div className="hidden overflow-x-auto rounded-xl border border-border [@container(min-width:THRESHOLD)]:block">',
    minW: 52,
    // Nine-digit totals need up to 864 px (review of the narrow layouts); at
    // 52.125rem the wide table still scrolled and split its headings.
    at: "54rem",
  });
  assert.doesNotMatch(uptake, /<div className="mt-3 overflow-x-auto rounded-xl border border-border">/, "no table left behind a bare sideways scroll");
  // The list is named as the table's caption names the table.
  assert.match(uptake, /<caption className="sr-only">\n\s*Spesa biosimilare e di riferimento per principio attivo, sui due denominatori\n/);
  // Both layouts render the same cells from one helper, link to the same URL.
  assert.equal(count(uptake, "substanceCells("), 3, "defined once, used by the list and by the table");
  for (const cell of ["{c.biosimilar}", "{c.reference}", "{c.firstLocal}", "{c.held}", "{heldVisibleCell}"]) assert.equal(count(uptake, cell), 2, `${cell} in both layouts`);
  assert.equal(count(uptake, "<KeepLink href={substanceHref(r.substance)} className=\"hover:text-primary hover:underline\">"), 2);
  assert.equal(count(uptake, "<ShareBar share={r.dateValid.share} />"), 2);
  assert.equal(count(uptake, "<ShareBar share={view.locallyObserved.share} />"), 2, "the total's shares in both layouts");
  // The list's labels are the table's column headers, in the same order.
  const heads = [...uptake.matchAll(/<th scope="col" className="[^"]*">([^<]+)<\/th>/g)].map((m) => m[1]).slice(1);
  const start = uptake.indexOf("<ul aria-label=\"Spesa biosimilare");
  const list = uptake.slice(start, uptake.indexOf("</ul>", start));
  const firstItem = list.slice(0, list.indexOf("</li>"));
  assert.deepEqual([...firstItem.matchAll(/<dt className="text-muted-foreground">([^<]+)<\/dt>/g)].map((m) => m[1]), heads);
  // The two measure cards: side by side by the section's own width, not by sm.
  assert.match(uptake, /<div className="flex flex-col gap-4 \[container-type:inline-size\]">/);
  assert.match(uptake, /\{bothMeasuresAvailable \? <div className="grid gap-3 \[@container\(min-width:30rem\)\]:grid-cols-2">/);
  assert.doesNotMatch(uptake, /sm:grid-cols-2/);
});

test("value uptake: the shared cells keep the table's rules (mai, a net-zero held-out amount is a dash, never 0)", () => {
  const { substanceCells } = helpers(uptake, ["function substanceCells("], ["substanceCells"]);
  const row = (o) => ({ dateValid: { biosimilar: 300, reference: 700 }, boundary: 0, unknown: 0, outside: 0, firstLocalLabel: "2024-03", ...o });
  assert.deepEqual(substanceCells(row({})), { biosimilar: formatEur(300), reference: formatEur(700), firstLocal: "2024-03", held: "—" });
  assert.equal(substanceCells(row({ firstLocalLabel: null })).firstLocal, "mai", "never observed here is 'mai', not a dash");
  assert.equal(substanceCells(row({ boundary: 500, unknown: -500 })).held, "—", "a net-zero held-out amount stays a dash, as in the table");
  assert.equal(substanceCells(row({ outside: 1200 })).held, formatEur(1200));
  assert.equal(substanceCells(row({ boundary: 1000, unknown: 200, outside: 34 })).held, formatEur(1234), "the three held-out classes are summed");
  assert.equal(substanceCells(row({ unknown: -250 })).held, formatEur(-250), "a negative held-out amount is shown, not dashed");
  assert.equal(substanceCells(row({ dateValid: { biosimilar: -1200, reference: 80000 } })).biosimilar, formatEur(-1200));
});

test("review questions: the card is the container; the table switches at 26.125rem and the labels at 20rem", () => {
  // From lg the two cards sit side by side: only the card's width tells.
  assert.match(review, /<div className="flex flex-col rounded-xl border border-border bg-card p-4 \[container-type:inline-size\]">\n\s*<p className="text-sm font-semibold text-foreground">\{title\}<\/p>/);
  assert.match(review, /<dl className="mt-2 grid gap-x-3 gap-y-1 text-xs \[@container\(min-width:20rem\)\]:grid-cols-\[7\.5rem_1fr\]">/);
  assert.doesNotMatch(review, /sm:grid-cols-\[7\.5rem_1fr\]/, "no viewport switch for a card whose width the viewport does not decide");
  assert.match(review, new RegExp(
    esc("<ul aria-label={`${title}: molecole, ${amountColumn.toLowerCase()} e quota; il nome apre l'evidenza della molecola`} translate=\"no\"") +
    "\\n\\s*" + esc('className="mt-3 divide-y divide-border rounded-lg border border-border text-xs [@container(min-width:26.125rem)]:hidden">') +
    "[\\s\\S]*?</ul>\\n\\s*" + esc('<div className="mt-3 hidden overflow-x-auto rounded-lg border border-border [@container(min-width:26.125rem)]:block">') +
    "\\n\\s*" + esc('<table className="w-full min-w-[26rem] text-sm" translate="no">')));
  // The list's name is the caption's sentence.
  assert.match(review, /<caption className="sr-only">\{title\}: molecole, \{amountColumn\.toLowerCase\(\)\} e quota; il nome apre l&apos;evidenza della molecola<\/caption>/);
  assert.equal(count(review, "queueCells("), 3, "defined once, used by the list and by the table");
  for (const cell of ["{c.eur}", "{c.share}"]) assert.equal(count(review, cell), 2 + (cell === "{c.share}" ? 2 : 0), `${cell} in both layouts`);
  assert.equal(count(review, "{link(r)}"), 2, "the same link (or plain name) in both layouts");
  assert.equal(count(review, "{formatEur(total)}"), 2, "the total in both layouts");
  assert.equal(count(review, "{count}"), 2);
  // The empty case is unchanged.
  assert.match(review, /\{rows\.length === 0 \? <p className="mt-3 text-xs text-muted-foreground">Nessuna molecola in questa selezione\.<\/p> : <>/);
});

test("review questions: the shared cells read the chosen share and keep 0% apart from a missing share", () => {
  const { queueCells } = helpers(review, ["function queueCells("], ["queueCells"]);
  const r = { substance: "s", eur: 1234567, firstLocalLabel: null, dateValidShare: 0, locallyObservedShare: 0.25 };
  assert.deepEqual(queueCells(r, "dateValidShare"), { firstLocal: "—", eur: formatEur(1234567), share: formatPercent(0) });
  assert.notEqual(queueCells(r, "dateValidShare").share, "—", "a 0% share is a share, not a missing one");
  assert.equal(queueCells(r, "locallyObservedShare").share, formatPercent(0.25), "the column the question names, not the other one");
  assert.equal(queueCells({ ...r, locallyObservedShare: null }, "locallyObservedShare").share, "—");
  assert.equal(queueCells({ ...r, firstLocalLabel: "2025-02" }, "dateValidShare").firstLocal, "2025-02");
});

test("withheld groups and record funnel: each switches on its own panel at 34.125rem and 46.125rem", () => {
  assertSwitch(review, {
    label: "withheld groups",
    wrapper: '<div className="mt-3 [container-type:inline-size]">',
    list: '<ul translate="no" className="divide-y divide-border rounded-lg border border-border text-xs [@container(min-width:THRESHOLD)]:hidden">',
    wide: '<div className="hidden overflow-x-auto rounded-lg border border-border [@container(min-width:THRESHOLD)]:block">',
    minW: 34,
  });
  assertSwitch(review, {
    label: "record funnel",
    wrapper: '<div className="mt-3 [container-type:inline-size]">',
    list: '<ul translate="no" className="divide-y divide-border rounded-xl border border-border text-xs [@container(min-width:THRESHOLD)]:hidden">',
    wide: '<div className="hidden overflow-x-auto rounded-xl border border-border [@container(min-width:THRESHOLD)]:block">',
    minW: 46,
  });
  assert.doesNotMatch(review, /<div className="mt-3 overflow-x-auto rounded-(lg|xl) border border-border">/, "no table left behind a bare sideways scroll");
  assert.equal(count(review, "withheldCells("), 3);
  assert.equal(count(review, "funnelCells("), 3);
  for (const cell of ["{c.azienda}", "{c.reason}", "{c.dropped}"]) assert.equal(count(review, cell), 2, `${cell} in both layouts`);
  for (const cell of ["{c.rows}", "{c.spend}"]) assert.equal(count(review, cell), 4, `${cell} in both layouts of both tables`);
  assert.equal(count(review, "{stage.step}. {stage.stage}"), 2);
  // A React key reaches the page payload: neither layout keys a row by asl_code.
  assert.equal(count(review, "key={`${i}-${w.active_substance}-${w.withheld_reason}`}"), 2);
  assert.doesNotMatch(review, /key=\{[^}]*asl_code/);
});

test("withheld groups and record funnel: the shared cells keep a missing value apart from a zero", () => {
  const h = helpers(review, ["const WITHHELD_REASON_IT", "function withheldCells(", "function funnelCells("], ["withheldCells", "funnelCells"]);
  const w = { asl_code: "X1", active_substance: "s", withheld_reason: "no comparable stratum", rows_n: 1234, spend_eur: null };
  assert.deepEqual(h.withheldCells(w, { X1: "Azienda Uno" }),
    { azienda: "Azienda Uno", reason: "nessuno strato confrontabile", rows: formatNumber(1234, 0), spend: "—" });
  assert.equal(h.withheldCells(w, {}).azienda, "Azienda non mappata", "an unmapped code is never shown as a code");
  assert.equal(h.withheldCells({ ...w, withheld_reason: "a new reason" }, {}).reason, "a new reason", "an unknown reason is shown as it is");
  assert.equal(h.withheldCells({ ...w, spend_eur: 0 }, {}).spend, formatEur(0), "zero spend is a number, not a dash");
  const s = { step: 2, stage: "x", rows_n: 250000, spend_eur: 0, note: "", shareOfObserved: 0, droppedRows: 11153 };
  assert.deepEqual(h.funnelCells(s), { rows: formatNumber(250000, 0), share: formatPercent(0), dropped: `−${formatNumber(11153, 0)}`, spend: formatEur(0) });
  assert.equal(h.funnelCells({ ...s, droppedRows: 0 }).dropped, "—", "no loss is a dash, not '−0'");
  assert.equal(h.funnelCells({ ...s, shareOfObserved: null }).share, "—");
  assert.equal(h.funnelCells({ ...s, spend_eur: null }).spend, "—");
  assert.ok(h.funnelCells(s).dropped.startsWith("−"), "the minus sign is U+2212, as before");
});

test("the internal sheet inventory takes three columns by its own width, behind the same reviewer gate", () => {
  const map = declaration(review, "function WorkbookMap()");
  assert.match(map, /<ul className="mt-1\.5 divide-y divide-border rounded-lg border border-border \[container-type:inline-size\]">/);
  assert.match(map, /<li key=\{s\.id\} className="grid gap-x-4 gap-y-0\.5 px-3 py-2 text-xs \[@container\(min-width:30rem\)\]:grid-cols-\[7rem_1fr_1fr\]">/);
  assert.doesNotMatch(map, /sm:grid-cols-\[7rem_1fr_1fr\]/);
  const uses = [...review.matchAll(/<WorkbookMap \/>/g)];
  assert.equal(uses.length, 1);
  assert.match(review.slice(Math.max(0, uses[0].index - 700), uses[0].index), /\{props\.scope\.allOrganizations && \(/);
});

test("every narrow list in the two files has its wide twin at the same threshold", () => {
  for (const [name, src] of [["value uptake", uptake], ["review", review]]) {
    const narrow = [...src.matchAll(/\[@container\(min-width:([\d.]+rem)\)\]:hidden/g)].map((m) => m[1]);
    const wide = [...src.matchAll(/\bhidden [^"]*\[@container\(min-width:([\d.]+rem)\)\]:block/g)].map((m) => m[1]);
    assert.deepEqual(narrow, wide, `${name}: each list is paired with its table, in order`);
    assert.ok(narrow.length > 0);
    // Each switch is at least its own table's min-width plus the two borders.
    const pairRe = /\bhidden [^"]*\[@container\(min-width:([\d.]+)rem\)\]:block">\n\s*<table className="w-full min-w-\[([\d.]+)rem\]/g;
    const pairs = [...src.matchAll(pairRe)];
    for (const m of pairs) {
      assert.ok(Number(m[1]) >= Number(m[2]) + 0.125, `${name}: the ${m[1]}rem switch leaves room for its ${m[2]}rem table plus its borders`);
    }
    assert.equal(pairs.length, narrow.length, `${name}: every switch is checked`);
  }
});

test("the reviewer inventory: long sheet ids wrap inside their column instead of printing over the next one", () => {
  assert.match(review, /<span className="font-mono text-muted-foreground \[overflow-wrap:anywhere\]">\{s\.id\} · \{s\.sheet\}<\/span>/);
});
