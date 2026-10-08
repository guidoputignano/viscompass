import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire, register } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

// NARROW LAYOUTS, GROUP 2: the review charts (pillar-b-review-visuals.tsx) and
// the monthly bars (pillar-b-monthly-bars.tsx) switch layout on the width of
// their OWN card, through a CSS container query, not on the viewport. Below
// the threshold a narrow drawing (280 units, capped at 20rem, 12-13 unit
// text) or a stacked grid; from the threshold the wide layout, unchanged.
//
// Two kinds of check: the source pins (wrapper, variants, thresholds), and a
// static render with SYNTHETIC values only, through sucrase, so the narrow
// geometry, the shared numbers and the missing-month gaps are asserted on the
// markup React actually produces.

const root = fileURLToPath(new URL("..", import.meta.url));
const read = (f) => fs.readFileSync(`${root}${f}`, "utf8").replace(/\r\n/g, "\n");
const VISUALS = "components/dashboard-review/pillar-b-review-visuals.tsx";
const MONTHLY = "components/dashboard-review/pillar-b-monthly-bars.tsx";

/** The source of one top-level function, from its declaration to the next top-level declaration. */
function fnSource(src, name) {
  const start = src.search(new RegExp(`\\n(export )?function ${name}\\(`));
  assert.ok(start >= 0, `${name} is declared`);
  const rest = src.slice(start + 1);
  const next = rest.slice(1).search(/\n(export )?(function|const|type|interface) /);
  return next < 0 ? rest : rest.slice(0, next + 1);
}

// ------------------------------------------------------------ source pins

test("every container switch sits on a [container-type:inline-size] wrapper, never on the viewport", () => {
  for (const f of [VISUALS, MONTHLY]) {
    const src = read(f);
    // The only viewport variant left is the Frame's padding.
    const viewport = [...src.matchAll(/\b(sm|md|lg|xl):[\w[\]().,-]+/g)].map((m) => m[0]);
    assert.deepEqual([...new Set(viewport)].filter((v) => v !== "sm:p-5"), [], `${f}: ${viewport.join(" ")}`);
  }
});

test("ChannelSlopeChart and ConcentrationCurve: narrow drawing below 47.5rem of card, the 760-unit one from 47.5rem", () => {
  const src = read(VISUALS);
  for (const [chart, narrow] of [["ChannelSlopeChart", "ChannelSlopeNarrow"], ["ConcentrationCurve", "ConcentrationNarrow"]]) {
    const body = fnSource(src, chart);
    const wrap = body.indexOf('<div className="[container-type:inline-size]">');
    const n = body.indexOf('<div className="[@container(min-width:47.5rem)]:hidden">');
    const w = body.indexOf('<div className="hidden [@container(min-width:47.5rem)]:block">');
    assert.ok(wrap >= 0 && n > wrap && w > n, `${chart}: wrapper, then the narrow variant, then the wide one`);
    assert.match(body.slice(n, w), new RegExp(`<${narrow} `), `${chart}: the narrow variant draws ${narrow}`);
    assert.match(body.slice(w), /viewBox=\{`0 0 \$\{width\} \$\{height\}`\} className="w-full"/, `${chart}: the wide SVG is the one drawn w-full`);
    assert.match(body, /const width = 760,/, `${chart}: the wide drawing is still 760 units, hence 47.5rem`);
    const nsrc = fnSource(src, narrow);
    assert.match(nsrc, /const W = NARROW_W,/);
    assert.match(nsrc, /className="w-full max-w-\[20rem\]"/, `${narrow}: capped so its text does not balloon`);
  }
  assert.match(src, /export const NARROW_W = 280;/);
});

test("MonthlyBars: the month list below 52rem of card, the 840-unit column chart from 52rem", () => {
  const body = fnSource(read(MONTHLY), "MonthlyBars");
  const wrap = body.indexOf('<div className="[container-type:inline-size]">');
  const n = body.indexOf('<div className="[@container(min-width:52rem)]:hidden">');
  const w = body.indexOf('<div className="hidden [@container(min-width:52rem)]:block">');
  assert.ok(wrap >= 0 && n > wrap && w > n);
  assert.match(body.slice(n, w), /<MonthlyBarsNarrow /);
  assert.match(body, /const width = 840,/);
  assert.match(body.slice(w), /viewBox=\{`0 0 \$\{width\} \$\{height\}`\} className="w-full"/);
  assert.match(fnSource(read(MONTHLY), "MonthlyBarsNarrow"), /className="w-full max-w-\[20rem\]"/);
});

test("EvidenceFunnelChart, MoleculeChangeChart and UptakeCoverageChart: their grids follow the card, at 36rem and 28rem", () => {
  const src = read(VISUALS);
  const funnel = fnSource(src, "EvidenceFunnelChart");
  assert.match(funnel, /<div className="\[container-type:inline-size\]">\n\s*<div role="img"/);
  assert.match(funnel, /className="grid gap-1\.5 \[@container\(min-width:36rem\)\]:grid-cols-\[13rem_1fr_9rem\] \[@container\(min-width:36rem\)\]:items-center \[@container\(min-width:36rem\)\]:gap-3"/);

  const mol = fnSource(src, "MoleculeChangeChart");
  assert.match(mol, /<div className="\[container-type:inline-size\]">\n\s*<div className="mb-1 grid grid-cols-\[minmax\(0,1fr\)_auto\]/);
  // Row: name and figure on the first line, the bar across the second, below 36rem;
  // the old three columns from 36rem.
  assert.match(mol, /className="grid grid-cols-\[minmax\(0,1fr\)_auto\] items-center gap-x-2 gap-y-1 text-xs \[@container\(min-width:36rem\)\]:grid-cols-\[minmax\(0,12rem\)_1fr_9rem\] \[@container\(min-width:36rem\)\]:gap-y-2"/);
  assert.equal([...mol.matchAll(/col-span-2 row-start-2 [^"]*\[@container\(min-width:36rem\)\]:col-span-1 \[@container\(min-width:36rem\)\]:row-start-auto/g)].length, 2, "the bar explanation and the bar move to the second line");
  assert.equal([...mol.matchAll(/min-w-0 break-words text-foreground[^"]*\[@container\(min-width:36rem\)\]:truncate/g)].length, 2, "the name wraps when narrow, truncates in the wide columns (link and plain)");
  assert.doesNotMatch(mol, /grid-cols-\[minmax\(0,9rem\)_1fr_7rem\]/, "the 9rem/7rem phone grid that squeezed the bar is gone");

  const uptake = fnSource(src, "UptakeCoverageChart");
  assert.match(uptake, /<div className="mt-3 \[container-type:inline-size\]">\n\s*<div className="grid gap-2 text-xs \[@container\(min-width:28rem\)\]:grid-cols-2">/);
});

// ------------------------------------------------------------ static render

const REPO_PKG = pathToFileURL(`${root}package.json`).href;
const hooks = `
import { readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createRequire } from "node:module";
let sucrase, stubs;
export async function initialize({ pkg }) {
  const req = createRequire(pkg);
  sucrase = req("sucrase");
  const react = pathToFileURL(req.resolve("react")).href;
  // KeepLink's Next.js imports: a plain <a> and a no-op router, for a static render.
  stubs = {
    "next/link": "import React from " + JSON.stringify(react) + "; export default function Link({ href, scroll, ...rest }) { return React.createElement('a', { href, ...rest }); }",
    "next/navigation": "export function useRouter() { return { replace() {}, push() {}, refresh() {} }; }",
  };
}
export async function resolve(specifier, context, nextResolve) {
  if (stubs[specifier]) return { url: "data:text/javascript," + encodeURIComponent(stubs[specifier]), shortCircuit: true };
  return nextResolve(specifier, context);
}
export async function load(url, context, nextLoad) {
  if (url.startsWith("file:") && url.endsWith(".tsx")) {
    const file = fileURLToPath(url);
    const source = sucrase.transform(readFileSync(file, "utf8"), { transforms: ["typescript", "jsx"], jsxRuntime: "automatic", production: true, filePath: file }).code;
    return { format: "module", source, shortCircuit: true };
  }
  return nextLoad(url, context);
}`;
register("data:text/javascript," + encodeURIComponent(hooks), { data: { pkg: REPO_PKG } });
const req = createRequire(`${root}package.json`);
const React = req("react");
const { renderToStaticMarkup } = req("react-dom/server");
const V = await import(new URL(`../${VISUALS}`, import.meta.url).href);
const M = await import(new URL(`../${MONTHLY}`, import.meta.url).href);
const h = React.createElement;
const html = (el) => renderToStaticMarkup(el);

/** The inner markup of the first <div class="cls"> (nested divs balanced). */
function divInner(markup, cls) {
  const open = `<div class="${cls}">`;
  const start = markup.indexOf(open);
  assert.ok(start >= 0, `found <div class="${cls}">`);
  let depth = 1, i = start + open.length;
  const re = /<div\b|<\/div>/g;
  re.lastIndex = i;
  for (let m; (m = re.exec(markup));) {
    depth += m[0] === "</div>" ? -1 : 1;
    if (depth === 0) return markup.slice(i, m.index);
  }
  throw new Error("unbalanced");
}
const unescape = (s) => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&amp;/g, "&");
const attr = (tag, name) => { const m = tag.match(new RegExp(`\\s${name}="([^"]*)"`)); return m ? unescape(m[1]) : null; };
function svgParts(svg) {
  const vb = attr(svg.match(/^<svg[^>]*>/)[0], "viewBox").split(" ").map(Number);
  const texts = [...svg.matchAll(/<text([^>]*)>([\s\S]*?)<\/text>/g)].map((m) => ({
    x: Number(attr(m[1], "x")), y: Number(attr(m[1], "y")), size: Number(attr(m[1], "font-size")),
    anchor: attr(m[1], "text-anchor") ?? "start", text: unescape(m[2].replace(/<title>[\s\S]*?<\/title>/g, "")),
  }));
  const rects = [...svg.matchAll(/<rect([^>]*)>([\s\S]*?)<\/rect>|<rect([^>]*)\/>/g)].map((m) => {
    const a = m[1] ?? m[3];
    return { x: +attr(a, "x"), y: +attr(a, "y"), w: +attr(a, "width"), h: +attr(a, "height"), label: attr(a, "aria-label"), title: m[2] ? unescape((m[2].match(/<title>([\s\S]*?)<\/title>/) ?? [])[1] ?? "") : null };
  });
  return { width: vb[2], height: vb[3], texts, rects, label: attr(svg.match(/^<svg[^>]*>/)[0], "aria-label"), cls: attr(svg.match(/^<svg[^>]*>/)[0], "class") };
}
const svgsIn = (markup) => [...markup.matchAll(/<svg role="img"[\s\S]*?<\/svg>/g)].map((m) => m[0]);

/** Every text inside the drawing at an estimated 0.55 em per character, 12-13 units, and no two overlapping. */
function assertNarrowGeometry(p, what) {
  assert.equal(p.width, 280, `${what}: narrow viewBox width`);
  assert.equal(p.cls, "w-full max-w-[20rem]", `${what}: capped width`);
  const boxes = p.texts.map((t) => {
    const w = t.text.length * t.size * 0.55;
    const x0 = t.anchor === "end" ? t.x - w : t.anchor === "middle" ? t.x - w / 2 : t.x;
    return { ...t, x0, x1: x0 + w, y0: t.y - t.size * 0.75, y1: t.y + t.size * 0.25 };
  });
  for (const b of boxes) {
    assert.ok(b.size >= 12 && b.size <= 13, `${what}: "${b.text}" at ${b.size} units`);
    assert.ok(b.x0 >= 0 && b.x1 <= p.width && b.y0 >= 0 && b.y1 <= p.height, `${what}: "${b.text}" inside the viewBox (${b.x0.toFixed(1)}..${b.x1.toFixed(1)}, ${b.y0}..${b.y1} of ${p.width}x${p.height})`);
  }
  for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
    const a = boxes[i], b = boxes[j];
    const overlap = a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
    assert.ok(!overlap, `${what}: "${a.text}" and "${b.text}" overlap`);
  }
  for (const r of p.rects) assert.ok(r.x >= 0 && r.x + r.w <= p.width && r.y >= 0 && r.y + r.h <= p.height, `${what}: a bar inside the viewBox`);
  // 12 units in a 267 px phone card and at the 20rem cap (320 px: at most about 15 px), as CSS px.
  const min = Math.min(...p.texts.map((t) => t.size)), max = Math.max(...p.texts.map((t) => t.size));
  assert.ok(min * 267 / p.width >= 11.4 && max * 320 / p.width <= 15, `${what}: ${min * 267 / p.width} to ${max * 320 / p.width} px`);
}

const T = (key, label, a, b, href = null) => ({ key, label, spend2024: a, spend2025: b, changeEur: b - a, change: a === 0 ? null : (b - a) / Math.abs(a), rows2024: 1, rows2025: 1, negativeRows: 0, href });

test("pure helpers: clearLabels keeps the last label and every earlier one that clears the previous KEPT label", () => {
  assert.deepEqual(V.clearLabels([]), []);
  assert.deepEqual(V.clearLabels([[0, 10], [40, 50], [80, 90]]), [true, true, true]);
  assert.deepEqual(V.clearLabels([[0, 30], [25, 50]]), [false, true], "the end of the scale wins a collision");
  assert.deepEqual(V.clearLabels([[0, 10], [14, 20], [40, 50]]), [true, false, true], "4 units apart is under the 6-unit gap");
  assert.deepEqual(V.clearLabels([[0, 10], [14, 20], [40, 50]], 2), [true, true, true], "the gap is a parameter");
  // [17,27] clears the kept [0,10] by 7 but not the dropped [8,18]: compared with the kept one.
  assert.deepEqual(V.clearLabels([[0, 10], [8, 18], [17, 27], [60, 70]]), [true, false, true, true]);
  assert.deepEqual(V.clearLabels([[0, 10], [50, 58], [55, 70]]), [true, false, true], "an earlier label must also clear the last");
});

test("pure helpers: clipLabel shortens to max characters with an ellipsis; textWidth is 0.6 em per character", () => {
  assert.equal(V.clipLabel("Distribuzione diretta", 30), "Distribuzione diretta");
  assert.equal(V.clipLabel("Distribuzione diretta", 21), "Distribuzione diretta", "exactly max stays whole");
  assert.equal(V.clipLabel("Canale sintetico lungo", 10), "Canale si…");
  assert.equal(V.clipLabel("abc defgh", 5), "abc…", "no space left before the ellipsis");
  assert.equal(V.clipLabel("Canale sintetico lungo", 10.9), "Canale si…", "a fractional room is floored");
  assert.equal(V.textWidth("abc", 12), 3 * 12 * 0.6);
  assert.equal(V.textWidth("", 13), 0);
});

test("ChannelSlopeChart render: both variants, same accessible name, the narrow one prints the same spends and changes", () => {
  const rows = [T("CO", "Consumi ospedalieri", 1_200_000, 1_500_000), T("DD", "Distribuzione diretta", 4_800_000, 4_100_000), T("DPC", "Distribuzione per conto", 0, 350_000)];
  const out = html(h(V.ChannelSlopeChart, { rows }));
  assert.ok(out.includes('<div class="[container-type:inline-size]"><div class="[@container(min-width:47.5rem)]:hidden"><svg role="img"'));
  const narrow = svgParts(svgsIn(divInner(out, "[@container(min-width:47.5rem)]:hidden"))[0]);
  const wide = svgParts(svgsIn(divInner(out, "hidden [@container(min-width:47.5rem)]:block"))[0]);
  assert.equal(svgsIn(out).length, 2);
  assert.equal(wide.width, 760);
  assert.equal(narrow.label, wide.label);
  assertNarrowGeometry(narrow, "slope");
  const words = narrow.texts.map((t) => t.text);
  for (const s of ["Consumi ospedalieri", "25%", "-14,6%", "2024 · 1,2 Mln €", "2025 · 1,5 Mln €", "2024 · 0 €", "2025 · 350.000 €"]) {
    assert.ok(words.includes(s), `narrow prints "${s}"`);
  }
  // DPC from zero has no rate: no percentage is invented for it, in either drawing.
  assert.equal(narrow.texts.filter((t) => /%$/.test(t.text)).length, 2);
  assert.equal(wide.texts.filter((t) => /%$/.test(t.text)).length, 2);
  // formatEur puts a no-break space before €: an amount never splits from its unit.
  // The axis keeps both ends of the same ticks the wide chart labels.
  const wideTicks = wide.texts.filter((t) => t.y === wide.height - 9).map((t) => t.text);
  assert.ok(words.includes(wideTicks[0]) && words.includes(wideTicks.at(-1)));
});

test("ChannelSlopeChart render: spends too long for one line stack, a long name is clipped with its <title>", () => {
  const rows = [T("CO", "Consumi ospedalieri", 123_400_000, 98_700_000), T("XX", "Canale sintetico con un nome davvero molto lungo per la prova", 5_000, 6_000)];
  const out = html(h(V.ChannelSlopeChart, { rows }));
  const svg = svgsIn(divInner(out, "[@container(min-width:47.5rem)]:hidden"))[0];
  const narrow = svgParts(svg);
  assertNarrowGeometry(narrow, "slope, long");
  const a = narrow.texts.find((t) => t.text === "2024 · 123,4 Mln €"), b = narrow.texts.find((t) => t.text === "2025 · 98,7 Mln €");
  assert.ok(a && b && b.y > a.y && b.anchor === "start", "2025 on its own line below 2024");
  assert.ok(svg.includes("<title>Canale sintetico con un nome davvero molto lungo per la prova</title>"));
  assert.ok(narrow.texts.some((t) => t.text.endsWith("…") && t.text.startsWith("Canale sintetico")));
});

test("ConcentrationCurve render: the same points, the molecule count always labelled, colliding ranks dropped", () => {
  const ranks = [1, 5, 10, 25, 50, 100, 250, 300];
  const shares = [0.18, 0.52, 0.71, 0.88, 0.97, 1.125, 1.01, 1];
  const data = { rows: [], moleculeCount: 300, samples: ranks.map((rank, i) => ({ rank, cumulativeShare: shares[i] })) };
  const out = html(h(V.ConcentrationCurve, { data, year: 2025, scopeNote: "di tutta la spesa sintetica" }));
  const nmark = divInner(out, "[@container(min-width:47.5rem)]:hidden"), wmark = divInner(out, "hidden [@container(min-width:47.5rem)]:block");
  const narrow = svgParts(svgsIn(nmark)[0]), wide = svgParts(svgsIn(wmark)[0]);
  assert.equal(narrow.label, wide.label);
  assertNarrowGeometry(narrow, "concentration");
  assert.equal((nmark.match(/<circle/g) ?? []).length, ranks.length, "every sampled point is drawn");
  assert.equal((wmark.match(/<circle/g) ?? []).length, ranks.length);
  const words = narrow.texts.map((t) => t.text);
  assert.ok(words.includes("300") && words.includes("1") && words.includes("10"));
  assert.ok(!words.includes("250"), "250 beside 300 would collide");
  for (const pct of ["0%", "112,5%"]) assert.ok(words.includes(pct), `share gridline ${pct}, as in the wide drawing`);
  assert.ok(words.includes("Molecole ordinate per spesa") && words.includes("asse orizzontale logaritmico"));
});

// Synthetic calendar: March 2024 and August 2025 have no record; November 2025 is negative; 2026 has Jan-May with February missing.
const cell = (year, month, spend) => ({ year, month, spend_eur: spend, rows_n: spend === null ? 0 : 1, comparable_share: spend === null || year === 2026 ? null : 0.5, perimeter_eur: spend === null ? null : 10, partial: year === 2026 });
const yearRow = (year, n, f) => { const cells = Array.from({ length: n }, (_, i) => cell(year, i + 1, f(i + 1))); const obs = cells.filter((c) => c.spend_eur !== null); return { year, partial: year === 2026, monthsObserved: obs.length, cells, total_eur: obs.reduce((t, c) => t + c.spend_eur, 0) }; };
const calendar = [
  yearRow(2024, 12, (m) => (m === 3 ? null : 800_000 + m * 95_000)),
  yearRow(2025, 12, (m) => (m === 8 ? null : m === 11 ? -120_000 : 900_000 + m * 70_000)),
  yearRow(2026, 5, (m) => (m === 2 ? null : 700_000 + m * 10_000)),
];

for (const [view, metric, bars, gaps] of [["confronto", "spesa", 22, 2], ["2025", "comparabile", 11, 1], ["2026", "spesa", 4, 1]]) {
  test(`MonthlyBars render (${view}, ${metric}): every month a line, the same bars and exact titles as the wide chart, gaps never zero`, () => {
    const out = html(h(M.MonthlyBars, { rows: calendar, metric, view, title: "Spesa mese per mese" }));
    assert.ok(out.includes('<div class="[container-type:inline-size]"><div class="[@container(min-width:52rem)]:hidden"><svg role="img"'));
    const narrow = svgParts(svgsIn(divInner(out, "[@container(min-width:52rem)]:hidden"))[0]);
    const wide = svgParts(svgsIn(divInner(out, "hidden [@container(min-width:52rem)]:block"))[0]);
    assert.equal(wide.width, 840);
    assert.equal(narrow.label, wide.label);
    assertNarrowGeometry(narrow, `monthly ${view}`);
    assert.equal(narrow.rects.length, bars);
    assert.equal(wide.rects.length, bars);
    // The same exact values, as <title> and accessible name, bar for bar.
    assert.deepEqual(narrow.rects.map((r) => r.title).sort(), wide.rects.map((r) => r.title).sort());
    assert.deepEqual(narrow.rects.map((r) => r.label), narrow.rects.map((r) => r.title));
    for (const r of narrow.rects) assert.ok(r.w >= 1 && r.h > 0, "no zero-size bar");
    // A month without a value: "—", no bar.
    assert.equal(narrow.texts.filter((t) => t.text === "—").length, gaps);
    const months = view === "2026" ? 5 : 12;
    assert.equal(narrow.texts.filter((t) => /^(gen|feb|mar|apr|mag|giu|lug|ago|set|ott|nov|dic)$/.test(t.text)).length, months, "every month slot is named");
    if (view === "confronto") {
      assert.equal(narrow.texts.filter((t) => t.text === "2024").length, 12, "the year is written beside each bar, not left to colour");
      assert.ok(!narrow.rects.some((r) => r.title.startsWith("mar 2024")) && !narrow.rects.some((r) => r.title.startsWith("ago 2025")));
      assert.ok(narrow.rects.some((r) => r.title === "nov 2025: -120.000 €") && narrow.texts.some((t) => t.text === "-120 k€"), "a negative month keeps its sign");
    }
    if (view === "2025") assert.ok(narrow.texts.some((t) => t.text === "50%") && narrow.texts.some((t) => t.text === "100%"));
    if (view === "2026") assert.ok(!narrow.texts.some((t) => /2024|2025/.test(t.text)), "the partial year stands alone");
  });
}

test("MoleculeChangeChart render: one grid that re-flows by container, link kept", () => {
  const rows = [T("m1", "Molecola sintetica A", 900_000, 1_400_000, "/dashboard-review/revisione-pillar-b?m=a"), T("m2", "Molecola sintetica B", 2_000_000, 1_100_000)];
  const out = html(h(V.MoleculeChangeChart, { rows, measure: "delta" }));
  assert.ok(out.includes('<div class="[container-type:inline-size]"><div class="mb-1 grid grid-cols-[minmax(0,1fr)_auto]'));
  assert.ok(out.includes('href="/dashboard-review/revisione-pillar-b?m=a"'));
  assert.equal((out.match(/<a /g) ?? []).length, 1, "one link per molecule: a single DOM, not two copies");
  assert.ok(out.includes(">500.000 €<") && out.includes(">-900.000 €<"));
});

test("EvidenceFunnelChart and UptakeCoverageChart render inside their container wrappers", () => {
  const funnel = html(h(V.EvidenceFunnelChart, { rows: [{ step: 1, stage: "Record osservati", rows_n: 100, spend_eur: 1, note: "", shareOfObserved: 1, droppedRows: 0 }], year: 2025 }));
  assert.ok(funnel.includes('<div class="[container-type:inline-size]"><div role="img"'));
  const uptake = html(h(V.UptakeCoverageChart, { withheldShare: 0.125, usedSpend: 875, withheldSpend: 125 }));
  assert.ok(uptake.includes('<div class="mt-3 [container-type:inline-size]"><div class="grid gap-2 text-xs [@container(min-width:28rem)]:grid-cols-2">'));
});

// ------------------------------------------- what the review of the narrow layouts found

test("ChannelSlopeChart: a channel-year with no record says 'nessun record' and draws no point, in both layouts; a real 0 € stays 0 €", () => {
  const noRecord = { ...T("dpc", "Distribuzione per conto", 0, 350_000), rows2024: 0, change: null };
  const out = html(h(V.ChannelSlopeChart, { rows: [noRecord, T("co", "Consumi ospedalieri", 120_000, 150_000)] }));
  const narrow = svgsIn(divInner(out, "[@container(min-width:47.5rem)]:hidden"))[0];
  const wide = svgsIn(divInner(out, "hidden [@container(min-width:47.5rem)]:block"))[0];
  const texts = svgParts(narrow).texts.map((t) => t.text);
  assert.ok(texts.includes("2024 · nessun record"), texts.join(" | "));
  assert.ok(!texts.some((t) => /^2024 · 0\s?€$/.test(t)), "absence is not printed as 0 €");
  // Three points, not four, and one connector, not two: the missing year has no mark.
  for (const svg of [narrow, wide]) {
    assert.equal((svg.match(/<circle/g) ?? []).length, 3, "the no-record year draws no point");
    assert.equal((svg.match(/stroke-width="5"/g) ?? []).length, 1, "no segment from a missing year");
  }
  const realZero = html(h(V.ChannelSlopeChart, { rows: [T("dpc", "Distribuzione per conto", 0, 350_000)] }));
  const zt = svgParts(svgsIn(divInner(realZero, "[@container(min-width:47.5rem)]:hidden"))[0]).texts.map((t) => t.text);
  assert.ok(zt.some((t) => /^2024 · 0\s?€$/.test(t)) && !zt.includes("2024 · nessun record"), "a recorded zero is a zero");
});

test("MonthlyBars: a comparable share above 100% or below 0 (credit notes) stays inside both drawings", () => {
  const odd = calendar.map((y) => y.year !== 2025 ? y : { ...y, cells: y.cells.map((c) => c.month === 2 ? { ...c, comparable_share: 1.32 } : c.month === 5 ? { ...c, comparable_share: -0.18 } : c) });
  const out = html(h(M.MonthlyBars, { rows: odd, metric: "comparabile", view: "2025", title: "Spesa mese per mese" }));
  const narrow = svgParts(svgsIn(divInner(out, "[@container(min-width:52rem)]:hidden"))[0]);
  const wide = svgParts(svgsIn(divInner(out, "hidden [@container(min-width:52rem)]:block"))[0]);
  for (const r of narrow.rects) assert.ok(r.x >= 0 && r.x + r.w <= narrow.width + 1e-9, `narrow bar ${r.title}: ${r.x}..${r.x + r.w}`);
  for (const r of wide.rects) assert.ok(r.y >= 0 && r.y + r.h <= wide.height + 1e-9, `wide bar ${r.title}: ${r.y}..${r.y + r.h}`);
  assert.ok(narrow.rects.some((r) => r.title.startsWith("feb 2025")) && narrow.rects.some((r) => r.title.startsWith("mag 2025")));
  // In range, the scale is the old 0..1: the shipped calendar draws exactly as before.
  const src = read(MONTHLY);
  assert.match(src, /const low = Math\.min\(0, \.\.\.values\);\n\s*const high = Math\.max\(1, \.\.\.values\);/);
});
