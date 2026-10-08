import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { register } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import React from "react";
import server from "react-dom/server";

import { formatEur, formatPercent } from "../lib/dashboard-review/format.ts";

// Phones and tablets (8 October 2026): the adoption visuals switch layout on
// the width of their OWN card (a container query on the Frame), never on the
// viewport, because at 768-1180 px the sidebar leaves a phone-sized card.
// Synthetic numbers only: this repository is public.
//
// The component is RENDERED here, not only read: a load hook transpiles the
// .tsx with the project's own TypeScript (a devDependency), so the markup,
// the thresholds and the narrow drawings' geometry are checked as served.

const root = fileURLToPath(new URL("..", import.meta.url));
const FILE = "components/dashboard-review/pillar-b-adoption-visuals.tsx";
const src = fs.readFileSync(`${root}${FILE}`, "utf8").replace(/\r\n/g, "\n");

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
const V = await import(pathToFileURL(`${root}${FILE}`).href);
const html = (type, props) => server.renderToStaticMarkup(React.createElement(type, props));

// ------------------------------------------------------------ tiny parsers

const unescape = (s) => s.replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
const text = (s) => unescape(s.replace(/<[^>]+>/g, "")).trim();
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
const svgs = (s) => all(s, /<svg role="img"/g).map((el) => {
  const open = el.match(/^<svg[^>]*>/)[0];
  const [, , W, H] = attr(open, "viewBox").split(" ").map(Number);
  return { el, cls: attr(open, "class"), W, H };
});
/** The class of the element that directly wraps `needle`. */
const wrapperClass = (s, needle) => { const i = s.indexOf(needle); assert.ok(i > 0, needle); const open = s.slice(0, i).match(/<div class="([^"]*)">$/); return open ? open[1] : null; };

/** Every text and circle of a drawing, with its extent estimated at 0.55 em. */
function geometry({ el, W, H }) {
  const texts = [...el.matchAll(/<text([^>]*)>([\s\S]*?)<\/text>/g)].map((m) => {
    const x = Number(attr(m[1], "x")), y = Number(attr(m[1], "y")), fs = Number(attr(m[1], "font-size"));
    const body = text(m[2].replace(/<title>[\s\S]*?<\/title>/g, "")), w = body.length * fs * 0.55;
    const anchor = attr(m[1], "text-anchor") ?? "start";
    const x0 = anchor === "end" ? x - w : anchor === "middle" ? x - w / 2 : x;
    return { body, x, y, fs, anchor, x0, x1: x0 + w, y0: y - fs * 0.75, y1: y + fs * 0.25 };
  });
  const circles = [...el.matchAll(/<circle([^>]*)>/g)].map((m) => {
    const cx = Number(attr(m[1], "cx")), cy = Number(attr(m[1], "cy")), r = Number(attr(m[1], "r")) + Number(attr(m[1], "stroke-width") ?? 0) / 2;
    return { cx, cy, r, label: attr(m[1], "aria-label") };
  });
  return { W, H, texts, circles };
}
function assertInside(g, what) {
  for (const t of g.texts) {
    assert.ok(t.x0 >= 0 && t.x1 <= g.W, `${what}: "${t.body}" spans ${t.x0.toFixed(1)}–${t.x1.toFixed(1)} of ${g.W}`);
    assert.ok(t.y0 >= 0 && t.y1 <= g.H, `${what}: "${t.body}" at y ${t.y} of ${g.H}`);
  }
  for (const c of g.circles) assert.ok(c.cx - c.r >= 0 && c.cx + c.r <= g.W && c.cy - c.r >= 0 && c.cy + c.r <= g.H, `${what}: a mark at ${c.cx} (r ${c.r}) leaves the ${g.W}-unit viewBox`);
  for (let i = 0; i < g.texts.length; i++) for (let j = i + 1; j < g.texts.length; j++) {
    const a = g.texts[i], b = g.texts[j];
    const overlap = Math.min(a.x1, b.x1) > Math.max(a.x0, b.x0) && Math.min(a.y1, b.y1) > Math.max(a.y0, b.y0);
    assert.ok(!overlap, `${what}: "${a.body}" overlaps "${b.body}"`);
  }
}
/** A table's body rows as cell texts, and a stacked list's items as [heading, ...values], with the dt labels. */
const tableRows = (s) => all(element(s, s.indexOf("<tbody")), /<tr>/g).map((tr) => [...tr.matchAll(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/g)].map((m) => text(m[1])));
const tableHeads = (s) => [...element(s, s.indexOf("<thead")).matchAll(/<th[^>]*>([\s\S]*?)<\/th>/g)].map((m) => text(m[1]));
const listItems = (ul) => all(ul, /<li /g).map((li) => ({
  heading: text(li.match(/<p[^>]*>([\s\S]*?)<\/p>/)[1]),
  labels: [...li.matchAll(/<dt[^>]*>([\s\S]*?)<\/dt>/g)].map((m) => text(m[1])),
  values: [...li.matchAll(/<dd[^>]*>([\s\S]*?)<\/dd>/g)].map((m) => text(m[1])),
  ddClasses: [...li.matchAll(/<dd class="([^"]*)"/g)].map((m) => m[1]),
}));
function assertListMatchesTable(markup, ulOpen, what) {
  const ul = element(markup, markup.indexOf(ulOpen));
  const rows = tableRows(markup), heads = tableHeads(markup), items = listItems(ul);
  assert.equal(items.length, rows.length, `${what}: one item per table row, none dropped`);
  items.forEach((it, i) => {
    assert.equal(it.heading, rows[i][0], `${what}: item ${i} is headed by the row's first cell, same order`);
    assert.deepEqual(it.values, rows[i].slice(1), `${what}: item ${i} carries the row's values, same formatting`);
    assert.deepEqual(it.labels, heads.slice(1), `${what}: item ${i} labels its values with the column headings`);
    for (const c of it.ddClasses) assert.match(c, /whitespace-nowrap text-right font-mono/, `${what}: a value is right-aligned and never split from its unit`);
  });
  return ul;
}

// ---------------------------------------------------------------- fixtures

const D = (substance, dv, lo, bioDv, denDv, bioLo, denLo, first) => ({ substance, dateValid: dv, locallyObserved: lo, referenceEur: denDv - bioDv, denominatorEur: denDv,
  firstLocalLabel: first, dateValidBiosimilarEur: bioDv, localBiosimilarEur: bioLo, localDenominatorEur: denLo });
const DUMBBELL = [
  D("alfa (zero e cento)", 0, 1, 0, 1000, 500, 500, "2024-02"),
  D("beta uguali", 0.5, 0.5, 300, 600, 300, 600, "2024-01"),
  D("gamma mai osservata", 0.25, null, 100, 400, 0, 0, null),
  D("delta senza mesi validi", null, null, 0, 0, 0, 0, null),
  D("epsilon quota negativa per rettifiche nette", -50 / 350, 0.2, -50, 350, 20, 100, "2024-04"),
  D("un nome sintetico lungo più di trentotto caratteri", 1, 1, 50, 50, 50, 50, "2024-01"),
];
const mk = (y, m) => y * 12 + m;
const T = (substance, k, ref, valid, share) => ({ substance, firstKey: k, firstLabel: `${Math.floor((k - 1) / 12)}-${String(k - Math.floor((k - 1) / 12) * 12).padStart(2, "0")}`, referenceEur: ref, validEur: valid, share });
const TIMELINE = {
  fromKey: mk(2024, 1), toKey: mk(2026, 5),
  rows: [
    T("primo mese, il più grande", mk(2024, 1), 4800000, 9100000, 0.4725),
    T("un nome sintetico lungo più di trentotto caratteri del rilascio", mk(2024, 6), 120000, 300000, 0.6),
    T("metà finestra, senza quota", mk(2025, 3), 900, 1500, null),
    T("penultimo mese", mk(2026, 4), 2400000, 2500000, 0.04),
    T("ultimo mese", mk(2026, 5), 300000, 310000, 0.0322),
  ],
  neverObserved: [], notYetValid: [],
};
const mix = (by) => Object.entries(by).map(([channel, byYear]) => ({ channel, byYear, spend_eur: Object.values(byYear).reduce((s, v) => s + v, 0), share: null, comparable_share: null }));
// 2024: CO 16,7% · DD 75% · DPC 8,3%; 2025: CO 30% · DD 70% · no DPC record.
const OWN = mix({ CO: { 2024: 100000, 2025: 120000 }, DD: { 2024: 450000, 2025: 280000 }, DPC: { 2024: 50000 } });
// 2025: DPC 13,4%, and 20% for CO 2024.
const REGION = mix({ CO: { 2024: 600000, 2025: 950000 }, DD: { 2024: 1400000, 2025: 1500000 }, DPC: { 2024: 1000000, 2025: 380000 } });
const PERIM = [
  { perimeter_status: "biosimilar", aic_count: 12, rows_n: 400, spend_eur: 115000 },
  { perimeter_status: "reference_medicine", aic_count: 9, rows_n: 300, spend_eur: 885000 },
  { perimeter_status: "outside_biosimilar_perimeter", aic_count: 900, rows_n: 9000, spend_eur: 9000000 },
];
const AZ = [
  { label: "Azienda sintetica uno", rows_n: 1200, spend_eur: 2300000, comparable_share: 0.81, byYear: { 2024: 1100000, 2025: 1200000 } },
  { label: "Azienda sintetica due", rows_n: 300, spend_eur: 400000, comparable_share: null, byYear: { 2024: 400000 } },
];

// ------------------------------------------------------------------- tests

test("the Frame is the size container, and only where a component asks", () => {
  assert.match(src, /export function Frame\(\{ title, lead, children, container = false \}/);
  assert.match(src, /\(container \? " \[container-type:inline-size\]" : ""\)/);
  const plain = html(V.Frame, { title: "t", children: "x" });
  assert.doesNotMatch(plain, /container-type/, "pillar-b-monthly-bars.tsx keeps a plain Frame");
  assert.match(html(V.Frame, { title: "t", container: true, children: "x" }), /^<figure class="[^"]* \[container-type:inline-size\]">/);
  const figures = [
    html(V.DumbbellUptakeChart, { rows: DUMBBELL, periodScope: "s" }),
    html(V.FirstUseTimeline, { model: TIMELINE }),
    html(V.ChannelStack, { rows: OWN, years: [2024, 2025] }),
    html(V.PerimeterComposition, { rows: PERIM }),
    ...["spesa", "comparabile", "record"].map((metric) => html(V.AziendaBars, { rows: AZ, years: [2024, 2025], metric })),
  ];
  for (const f of figures) assert.match(f, /^<figure class="overflow-hidden rounded-xl border border-border bg-card p-3 sm:p-5 \[container-type:inline-size\]">/);
  assert.equal([...src.matchAll(/<Frame\n\s+container\n/g)].length, 6, "every Frame in this file is a container (AziendaBars twice)");
});

test("no viewport switch is left: every layout switch is a container query", () => {
  const sm = [...src.matchAll(/\b(sm|md|lg|xl):[\w[\]()-]+/g)].map((m) => m[0]);
  assert.deepEqual(sm, ["sm:p-5"], "only the Frame's padding still follows the viewport");
  // Each pair of variants switches at ONE width: what hides at X shows at X.
  const hides = new Set([...src.matchAll(/\[@container\(min-width:([\d.]+rem)\)\]:hidden/g)].map((m) => m[1]));
  const shows = new Set([...src.matchAll(/\[@container\(min-width:([\d.]+rem)\)\]:(?:block|inline)\b/g)].map((m) => m[1]));
  assert.deepEqual([...hides].sort(), [...shows].sort());
  assert.deepEqual([...hides].sort(), ["20.125rem", "26.25rem", "34.125rem", "40.125rem", "40rem", "47.5rem"]);
});

test("(a) the dumbbell: the 280-unit drawing below a 47.5rem card, the 760-unit one from there, with the legend's position words", () => {
  const out = html(V.DumbbellUptakeChart, { rows: DUMBBELL, periodScope: "2024–2025 · sintetico" });
  const [phone, wide] = svgs(out);
  assert.equal(svgs(out).length, 2, "both variants are in the DOM; CSS shows one");
  assert.equal(phone.W, 280);
  assert.equal(phone.cls, "w-full max-w-[20rem] [@container(min-width:47.5rem)]:hidden", "capped at 20rem: 12-13 units never render above about 15 px");
  assert.equal(wide.W, 760);
  assert.equal(wide.cls, "w-full min-w-[47.5rem]", "the wide drawing is unchanged");
  assert.equal(wrapperClass(out, wide.el), "hidden overflow-x-auto [@container(min-width:47.5rem)]:block", "47.5rem = 760 px: the wide drawing renders 1:1");
  assert.ok(out.includes('<span class="hidden [@container(min-width:47.5rem)]:inline">a destra: spesa di riferimento nei mesi validi</span><span class="[@container(min-width:47.5rem)]:hidden">«rif.» sotto ogni riga: spesa di riferimento nei mesi validi</span>'),
    "the legend says where the reference amount is, on the same switch as the drawings");
  const gp = geometry(phone), gw = geometry(wide);
  assert.deepEqual(gp.circles.map((c) => c.label), gw.circles.map((c) => c.label), "the same marks with the same exact-value labels, in the same order");
  assert.ok(gp.circles.length >= 8);
  assertInside(gp, "dumbbell phone");
  // A ring at 0% and at 100% keeps its stroke inside (the 6-unit margin did not).
  const xs = gp.circles.map((c) => [c.cx - c.r, c.cx + c.r]);
  assert.ok(Math.min(...xs.map((x) => x[0])) >= 0 && Math.max(...xs.map((x) => x[1])) <= 280);
  assert.ok(gp.circles.some((c) => c.cx === 8) && gp.circles.some((c) => c.cx === 272), "the fixture does reach 0% and 100%");
  const long = gp.texts.find((t) => t.body.startsWith("un nome sintetico"));
  const full = "un nome sintetico lungo più di trentotto caratteri";
  assert.equal(long.body, `${full.slice(0, 37)}…`, "a long name is shortened to 38 characters…");
  assert.equal(long.body.length, 38);
  assert.ok(phone.el.includes("<title>un nome sintetico lungo più di trentotto caratteri</title>"), "…and its title keeps it whole");
});

test("(b) the timeline: a re-flowed 300-unit drawing below a 47.5rem card, the month beside every dot, inside the viewBox", () => {
  const out = html(V.FirstUseTimeline, { model: TIMELINE });
  const [phone, wide] = svgs(out);
  assert.equal(phone.W, 300);
  assert.equal(phone.cls, "w-full max-w-[22rem] [@container(min-width:47.5rem)]:hidden");
  assert.equal(wide.W, 760);
  assert.equal(wrapperClass(out, wide.el), "hidden overflow-x-auto [@container(min-width:47.5rem)]:block");
  assert.match(out, /<ul class="mb-2 grid gap-x-6 gap-y-1 text-\[11px\] text-muted-foreground \[@container\(min-width:47\.5rem\)\]:grid-cols-3">/, "the key goes to three columns on the same switch");
  const g = geometry(phone);
  assertInside(g, "timeline phone");
  assert.deepEqual(g.circles.map((c) => c.label), geometry(wide).circles.map((c) => c.label), "the same dots with the same exact-value labels");
  // The rule for the month label: right of the dot unless "aaaa-mm" (48 units) would leave the viewBox.
  const sides = TIMELINE.rows.map((row, i) => {
    const c = g.circles[i], t = g.texts.find((x) => x.body === row.firstLabel);
    assert.ok(Math.abs(t.y - 4 - c.cy) < 1e-9, `${row.firstLabel} sits on its dot's line`);
    assert.equal(t.anchor === "end", c.cx + c.r - 0.5 + 4 + 48 > 300, `${row.firstLabel}: the side follows the rule`);
    return t.anchor;
  });
  assert.deepEqual(sides, ["start", "start", "start", "end", "end"], "discriminating: early months right of the dot, the last two months left");
  for (const label of ["2024", "2025", "2026"]) assert.ok(g.texts.some((t) => t.body === label), `the year ${label} is written once, above`);
  assert.ok(g.texts.some((t) => t.body === "2026-05 · fine osservazione"));
  assert.ok(phone.el.includes("<title>un nome sintetico lungo più di trentotto caratteri del rilascio</title>"), "a shortened name keeps its title");
  assert.match(phone.el, /paint-order="stroke"/, "the month label has a halo, so the track does not strike through it");
  // Rendered size: 12-13 units in a 275-300 px card is 11-13 px; capped at 22rem it never passes about 15 px.
  for (const t of g.texts) assert.ok(t.fs * 275 / 300 >= 11 && t.fs * 352 / 300 <= 15.3, `${t.body} at ${t.fs} units`);
});

test("(b) the timeline's exact values: a stacked list below 40.125rem, the same cells as the table", () => {
  const out = html(V.FirstUseTimeline, { model: TIMELINE });
  const caption = "Primo biosimilare dispensato qui, spesa di riferimento e spesa valida per molecola; osservazione fino a 2026-05";
  const open = `<ul aria-label="${caption}" class="mt-2 divide-y divide-border rounded-lg border border-border text-xs [@container(min-width:40.125rem)]:hidden" translate="no">`;
  assertListMatchesTable(out, open, "timeline");
  assert.ok(out.includes('<div class="mt-2 hidden overflow-x-auto rounded-lg border border-border [@container(min-width:40.125rem)]:block"><table class="w-full min-w-[40rem] text-sm" translate="no"><caption class="sr-only">' + caption + "</caption>"),
    "the table from 40rem plus its 2 px of border, so it never scrolls by a pixel");
  const ul = element(out, out.indexOf(open));
  assert.ok(ul.includes(`<dd class="whitespace-nowrap text-right font-mono text-foreground">${formatEur(4800000)}</dd>`));
  assert.ok(ul.includes('<dd class="whitespace-nowrap text-right font-mono text-foreground">—</dd>'), "a missing share stays —, never 0%");
  assert.ok(ul.includes(`<dd class="whitespace-nowrap text-right font-mono text-foreground">${formatPercent(0.4725)}</dd>`));
});

test("(c) the channel table: stacked below its own min-width plus border, 34.125rem with the Region, 20.125rem without", () => {
  const withRegion = html(V.ChannelStack, { rows: OWN, years: [2024, 2025], selectedLabel: "Azienda X", comparator: { label: "Regione · 4 Aziende", aziende: 4, rows: REGION } });
  const capR = "Spesa e quota per canale, Azienda selezionata e Regione, per anno";
  const ulR = assertListMatchesTable(withRegion, `<ul aria-label="${capR}" class="mt-2 divide-y divide-border rounded-lg border border-border text-xs [@container(min-width:34.125rem)]:hidden" translate="no">`, "channels + Region");
  assert.ok(withRegion.includes('<div class="mt-2 hidden overflow-x-auto rounded-lg border border-border [@container(min-width:34.125rem)]:block"><table class="w-full text-sm min-w-[34rem]" translate="no">'));
  assert.equal(listItems(ulR).length, 6, "two years × three channels");
  assert.deepEqual(listItems(ulR)[5].values, ["nessun record", "—", formatEur(380000), formatPercent(380000 / 2830000)], "a channel with no record is 'nessun record' and —, never 0");
  assert.deepEqual(listItems(ulR)[0].labels, ["Azienda X", "Quota Azienda", "Regione", "Quota Regione"]);

  const own = html(V.ChannelStack, { rows: OWN, years: [2024, 2025] });
  const ulO = assertListMatchesTable(own, '<ul aria-label="Spesa e quota per canale, per anno" class="mt-2 divide-y divide-border rounded-lg border border-border text-xs [@container(min-width:20.125rem)]:hidden" translate="no">', "channels");
  assert.ok(own.includes('<div class="mt-2 hidden overflow-x-auto rounded-lg border border-border [@container(min-width:20.125rem)]:block"><table class="w-full text-sm min-w-[20rem]" translate="no">'));
  assert.deepEqual(listItems(ulO)[0].labels, ["Spesa", "Quota"]);
});

test("(c) MixBar: the name above the bar below a 40rem card; segment labels by the BAR's width (26.25rem), in an ink that clears 4.5:1", () => {
  assert.match(src, /<div className="grid gap-1\.5 \[@container\(min-width:40rem\)\]:grid-cols-\[13rem_1fr\] \[@container\(min-width:40rem\)\]:items-center \[@container\(min-width:40rem\)\]:gap-3">/);
  const out = html(V.ChannelStack, { rows: OWN, years: [2024, 2025], selectedLabel: "Azienda X", comparator: { label: "Regione", aziende: 4, rows: REGION } });
  // [narrow, wide] text inside each segment, bar by bar, in drawing order.
  // The label thresholds follow the bar, not the grid: from 420 px of card
  // (the wide grid's narrowest bar) the bar is wide enough for 16 / 8 even
  // when it is stacked under its name (a 600 px tablet card kept its labels).
  const segs = [...out.matchAll(/<div title="([^"]*)"[^>]*><span class="\[@container\(min-width:26\.25rem\)\]:hidden">([^<]*)<\/span><span class="hidden \[@container\(min-width:26\.25rem\)\]:inline">([^<]*)<\/span><\/div>/g)]
    .map((m) => [unescape(m[1]).split(" · ")[1].split(":")[0], m[2], m[3]]);
  const p = formatPercent;
  assert.deepEqual(segs, [
    ["CO", p(1 / 6), `CO ${p(1 / 6)}`], ["DD", `DD ${p(0.75)}`, `DD ${p(0.75)}`], ["DPC", "", p(1 / 12)],          // Azienda 2024: 16,7 · 75 · 8,3
    ["CO", p(0.2), `CO ${p(0.2)}`], ["DD", `DD ${p(1400 / 3000)}`, `DD ${p(1400 / 3000)}`], ["DPC", `DPC ${p(1 / 3)}`, `DPC ${p(1 / 3)}`], // Region 2024: 20 · 46,7 · 33,3
    ["CO", `CO ${p(0.3)}`, `CO ${p(0.3)}`], ["DD", `DD ${p(0.7)}`, `DD ${p(0.7)}`], ["DPC", "", ""],               // Azienda 2025: no DPC
    ["CO", `CO ${p(950 / 2830)}`, `CO ${p(950 / 2830)}`], ["DD", `DD ${p(1500 / 2830)}`, `DD ${p(1500 / 2830)}`], ["DPC", "", p(380 / 2830)], // Region 2025: DPC 13,4
  ], "narrow 24 / 14 (a 275 px bar), wide 16 / 8 (a 420 px bar beside the name)");
  // White on the segment colours was 2.6-3.5:1; the dark ink is 4.8-6.6:1 on all of them, in both themes.
  assert.doesNotMatch(src, /font-semibold text-white" style=\{\{ width/);
  assert.equal([...src.matchAll(/font-semibold text-\[#0b1f28\]" style=\{\{ width/g)].length, 2, "MixBar and the perimeter bar");
});

test("(b) TimelinePhone: an observation that ends in a January gives one tick, not two with the same key", () => {
  assert.match(src, /const ticks = \[\.\.\.new Set\(\[\.\.\.years\.map\(\(yr\) => yr \* 12 \+ 1\), toKey\]\)\];/);
});

test("(d) the perimeter composition: list below 34.125rem, table from there, segment labels by the bar's width", () => {
  const out = html(V.PerimeterComposition, { rows: PERIM });
  const caption = "Composizione del perimetro biosimilare e spesa fuori dal perimetro";
  const ulOpen = `<ul aria-label="${caption}" class="mt-3 divide-y divide-border rounded-lg border border-border text-xs [@container(min-width:34.125rem)]:hidden" translate="no">`;
  assert.ok(out.includes(ulOpen));
  assert.ok(out.includes(`<div class="mt-3 hidden overflow-x-auto rounded-lg border border-border [@container(min-width:34.125rem)]:block"><table class="w-full min-w-[34rem] text-sm" translate="no"><caption class="sr-only">${caption}</caption>`));
  const ul = element(out, out.indexOf(ulOpen));
  for (const v of [formatEur(115000), formatEur(885000), `${formatPercent(0.115)} del perimetro`, "12 AIC", `${formatEur(1000000)} · ${formatPercent(1)}`]) assert.ok(ul.includes(v), v);
  const segs = [...out.matchAll(/<span class="\[@container\(min-width:34\.125rem\)\]:hidden">([^<]*)<\/span><span class="hidden \[@container\(min-width:34\.125rem\)\]:inline">([^<]*)<\/span>/g)].map((m) => [m[1], m[2]]);
  assert.deepEqual(segs, [["", formatPercent(0.115)], [formatPercent(0.885), formatPercent(0.885)]], "11,5%: too narrow for its label in a 275 px bar, shown from 34.125rem");
  const at = (share) => { const o = html(V.PerimeterComposition, { rows: [{ ...PERIM[0], spend_eur: share * 1000 }, { ...PERIM[1], spend_eur: (1 - share) * 1000 }] }); return o.match(/:hidden">([^<]*)<\/span><span class="hidden \[@container\(min-width:34\.125rem\)\]:inline">([^<]*)</).slice(1); };
  assert.deepEqual(at(0.135), ["", formatPercent(0.135)], "13,5%: wide only");
  assert.deepEqual(at(0.145), [formatPercent(0.145), formatPercent(0.145)], "14,5%: both");
  assert.deepEqual(at(0.075), ["", ""], "7,5%: neither");
  assert.match(out, /<li class="grid gap-x-4 px-3 py-2 \[@container\(min-width:38rem\)\]:grid-cols-\[1fr_9rem_6rem_6rem\]">/, "the context rows go to four columns only where the name keeps 200 px");
});

test("AziendaBars: side by side from 30rem (one bar) and 40rem (bars per year), stacked below, the lead's position words following", () => {
  const spesa = html(V.AziendaBars, { rows: AZ, years: [2024, 2025], metric: "spesa" });
  assert.match(spesa, /<div class="grid gap-1\.5 \[@container\(min-width:40rem\)\]:grid-cols-\[9rem_1fr_11rem\] \[@container\(min-width:40rem\)\]:items-center \[@container\(min-width:40rem\)\]:gap-3">/);
  assert.ok(spesa.includes('nei canali e nella molecola selezionati; <span class="hidden [@container(min-width:40rem)]:inline">a destra</span><span class="[@container(min-width:40rem)]:hidden">sotto le barre</span> il totale degli anni e la quota con quantità confrontabile.'),
    "stacked, the totals are under the bars and the lead says so");
  assert.ok(spesa.includes('<span class="whitespace-nowrap text-right text-[10px] text-muted-foreground [@container(min-width:40rem)]:w-20 [@container(min-width:40rem)]:whitespace-normal">2025: nessun record</span>'),
    "a missing year stays 'nessun record' on one line when stacked; beside the name, the 5rem column as before");
  for (const metric of ["comparabile", "record"]) {
    assert.match(html(V.AziendaBars, { rows: AZ, years: [2024, 2025], metric }), /<div class="grid gap-1 \[@container\(min-width:30rem\)\]:grid-cols-\[9rem_1fr_7rem\] \[@container\(min-width:30rem\)\]:items-center \[@container\(min-width:30rem\)\]:gap-3">/);
  }
});
