import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

import { BRIDGE_B_GATES, bridgeB, bridgeBPerimeterCheck } from "../lib/dashboard-review/pillar-b/bridge-b.ts";
import { buildValueUptake } from "../lib/dashboard-review/pillar-b/value-uptake.ts";
import { formatEur, formatPercent } from "../lib/dashboard-review/format.ts";

// Bridge B on phones and tablets (components/dashboard-review/pillar-b-bridge-b.tsx).
// Each of its three wide drawings sits in a size container and switches on the
// width of that wrapper, not the viewport: the per-gate bars and the
// whole-ledger bar (760 units, drawn 1:1 from 47.5rem) and the four-column gate
// table (46rem inside its border). Under the threshold the same values are
// re-flowed, never shrunk to 7 px or hidden behind a sideways scroll.
//
// The source is pinned as text, and the component is also RENDERED, with
// synthetic figures only (the repository is public), through the project's own
// TypeScript compiler and react-dom/server: the narrow drawings are checked for
// geometry, and every narrow value against its wide twin.

const root = fileURLToPath(new URL("..", import.meta.url));
const FILE = "components/dashboard-review/pillar-b-bridge-b.tsx";
const src = fs.readFileSync(`${root}${FILE}`, "utf8").replace(/\r\n/g, "\n");
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// ------------------------------------------------------------ the source

test("the per-gate bars switch on their own wrapper at 47.5rem, the 760-unit drawing's 1:1 width", () => {
  assert.match(src, /const width = 760, left = 16, right = 744/);
  assert.match(src, new RegExp(esc(`<div className="[container-type:inline-size]">
            <div className="[@container(min-width:47.5rem)]:hidden">
              <p className="mb-1.5 text-[11px] leading-relaxed text-muted-foreground">Spesa per soglia · barre indipendenti sulla stessa scala in euro; non una quota di adozione</p>
              <GateBarsNarrow gates={perimeterGates} maxGate={maxGate} ariaLabel={gatesAria} />
            </div>
            <div className="hidden overflow-x-auto [@container(min-width:47.5rem)]:block">
              <svg role="img" viewBox={\`0 0 \${width} \${perimeterGates.length * 35 + 28}\`} className="w-full min-w-[46rem]"`)));
  // The narrow drawing is capped, so its 13-unit text does not balloon below the threshold.
  assert.match(src, /<svg role="img" viewBox=\{`0 0 \$\{width\} \$\{height\}`\} className="w-full max-w-\[18rem\]"[^>]*aria-label=\{ariaLabel\}>/);
});

test("the gate table switches inside its own border at 46rem, the table's min-width", () => {
  assert.match(src, new RegExp(esc(`<div className="mt-3 overflow-hidden rounded-xl border border-border [container-type:inline-size]">
        <ul aria-label={caption} className="divide-y divide-border text-xs [@container(min-width:46rem)]:hidden" translate="no">`)));
  assert.match(src, new RegExp(esc(`<div className="hidden overflow-x-auto [@container(min-width:46rem)]:block">
          <table className="w-full min-w-[46rem] text-sm" translate="no">
            <caption className="sr-only">Perimetro biosimilare per soglia: spesa, quota del totale rendicontato, e che cosa se ne può fare ({scopeLabel} · {monthsLabel})</caption>`)));
  // The list's accessible name is the caption's text, as one string.
  assert.match(src, /const caption = `Perimetro biosimilare per soglia: spesa, quota del totale rendicontato, e che cosa se ne può fare \(\$\{scopeLabel\} · \$\{monthsLabel\}\)`;/);
});

test("the whole-ledger bar switches on its own wrapper inside the audit panel at 47.5rem", () => {
  assert.match(src, new RegExp(esc(`<div className="mt-2 [container-type:inline-size]">
            <svg role="img" viewBox={\`0 0 \${nl.width} 112\`} className="w-full max-w-[15.5rem] [@container(min-width:47.5rem)]:hidden"`)));
  assert.match(src, new RegExp(esc(`<div className="hidden overflow-x-auto [@container(min-width:47.5rem)]:block">
              <svg role="img" viewBox={\`0 0 \${width} 76\`} className="w-full min-w-[34rem]"`)));
});

test("no viewport switch is left for these layouts, and every <svg> sits under one of the three switches", () => {
  assert.doesNotMatch(src, /\b(sm|md|lg):(hidden|block|table|flex|grid)\b|\bhidden (sm|md|lg):/);
  assert.equal([...src.matchAll(/\[container-type:inline-size\]/g)].length, 3);
  assert.equal([...src.matchAll(/<svg role="img"/g)].length, 4, "two drawings, each in a narrow and a wide variant");
  // Hidden-by-default wide variants: exactly one variant shows at any width.
  assert.equal([...src.matchAll(/className="hidden overflow-x-auto \[@container\(min-width:(47\.5|46)rem\)\]:block"/g)].length, 3);
});

test("the notices and the cross-check keep their wording", () => {
  for (const s of [
    "<strong className=\"text-foreground\">Ponte non disegnato.</strong>",
    "Le due letture devono coincidere al centesimo prima che il ponte sia pubblicabile.",
    "Barra non disegnata: in questa selezione",
    "perché le note di credito superano le dispensazioni. La tabella resta esatta: la somma delle soglie è il totale.",
    "Perimetro verificato due volte: la ricostruzione mese per mese",
    "Perimetro ricostruito solo mese per mese: la spesa per stato del prodotto non è disponibile in questa selezione.",
  ]) assert.ok(src.includes(s), s);
});

// ------------------------------------------------------------ the render

// Compiled with the project's TypeScript and imported as a data: module; the
// "@/" imports go through tests/_alias-hooks.mjs, react from the repository.
const require = createRequire(`${root}package.json`);
const ts = require("typescript");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const js = ts.transpileModule(src, {
  compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText.replace(/(["'])react\/jsx-runtime\1/g, JSON.stringify(pathToFileURL(require.resolve("react/jsx-runtime")).href));
const { BridgeBChart } = await import(`data:text/javascript;base64,${Buffer.from(js).toString("base64")}`);

// Synthetic rows in the RPC's shape (as in tests/pillar-b-bridge-b.test.mjs),
// scaled: k = 1 gives hundreds of euros, k = 1e7 gives billions.
const row = (s, v) => ({
  active_substance: s, first_local_month_key: v.first ?? null, perimeter_rows: 1, undated_rows: 0,
  inside_biosimilar_eur: v.ib ?? 0, inside_reference_eur: v.ir ?? 0, predates_biosimilar_eur: 0, predates_reference_eur: 0,
  boundary_biosimilar_eur: 0, boundary_reference_eur: v.br ?? 0, outside_biosimilar_eur: 0, outside_reference_eur: v.or ?? 0,
  unknown_biosimilar_eur: 0, unknown_reference_eur: v.ur ?? 0, window_biosimilar_eur: v.wb ?? 0, window_reference_eur: v.wr ?? 0,
});
const rows = (k) => [
  row("alfa", { ib: 320 * k, ir: 300 * k, br: 8 * k, or: 40 * k, ur: 0.7 * k, wb: 300 * k, wr: 120 * k, first: 2024 * 12 + 3 }),
  row("beta", { ir: 200 * k, br: 10 * k, or: 60 * k }),
];
const fixture = (k, total) => {
  const b = bridgeB(buildValueUptake(rows(k)), total);
  return { bridge: b, check: bridgeBPerimeterCheck(b, [{ perimeter_status: "biosimilar", spend_eur: b.biosimilar }, { perimeter_status: "reference_medicine", spend_eur: b.reference }]) };
};
const P = { monthsLabel: "12 e 12 mesi osservati", scopeLabel: "Azienda sintetica · 2024 e 2025" };
const render = (f) => renderToStaticMarkup(React.createElement(BridgeBChart, { ...f, ...P }));
const SMALL = fixture(1, 10000), HUGE = fixture(1e7, 9_876_543_210);

const svgs = (html) => [...html.matchAll(/<svg role="img"[\s\S]*?<\/svg>/g)].map((m) => m[0]);
const attr = (tag, name) => { const m = tag.match(new RegExp(`\\s${name}="([^"]*)"`)); return m ? decode(m[1]) : null; };
const texts = (svg) => [...svg.matchAll(/<text([^>]*)>([\s\S]*?)<\/text>/g)].map((m) => ({
  x: +attr(m[1], "x"), y: +attr(m[1], "y"), size: +attr(m[1], "font-size"), anchor: attr(m[1], "text-anchor") ?? "start",
  text: decode(m[2]),
}));
const rects = (svg) => [...svg.matchAll(/<rect([^>]*)\/?>/g)].map((m) => ({
  x: +attr(m[1], "x"), y: +attr(m[1], "y"), w: +attr(m[1], "width"), h: +attr(m[1], "height"), stroke: +(attr(m[1], "stroke-width") ?? 0),
}));
const viewBox = (svg) => attr(svg, "viewBox").split(" ").map(Number);
const decode = (s) => s.replace(/<!-- -->/g, "").replace(/&#x27;/g, "'").replace(/&quot;/g, "\"").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
// Estimated advance of 0.55 em per character, and the extent of a text anchored at x.
const extent = (t) => { const w = t.text.length * 0.55 * t.size; return t.anchor === "end" ? [t.x - w, t.x] : t.anchor === "middle" ? [t.x - w / 2, t.x + w / 2] : [t.x, t.x + w]; };

test("render: each drawing is in the markup twice, narrow first, with the same exact-value label", () => {
  for (const f of [SMALL, HUGE]) {
    const s = svgs(render(f));
    assert.equal(s.length, 4);
    assert.deepEqual(s.map((x) => viewBox(x)[2]), [256, 760, 216, 760]);
    assert.equal(attr(s[0], "aria-label"), attr(s[1], "aria-label"));
    assert.equal(attr(s[2], "aria-label"), attr(s[3], "aria-label"));
    assert.equal(attr(s[0], "aria-label"), `Spesa assoluta per soglia, in euro: ${f.bridge.gates.slice(1).map((g) => `${g.label} ${formatEur(g.eur)}`).join(", ")}`);
  }
});

test("render: the narrow per-gate drawing keeps every name whole, the same values, inside its viewBox, never over a bar", () => {
  for (const f of [SMALL, HUGE]) {
    const [narrow, wide] = svgs(render(f));
    const [, , W, H] = viewBox(narrow);
    const n = texts(narrow), w = texts(wide).slice(1);   // the wide heading is a <p> above the narrow drawing
    assert.deepEqual(n.map((t) => t.text), w.map((t) => t.text), "same names (not shortened) and same euro values, same order");
    assert.ok(f.bridge.gates.some((g) => g.id === "B3_date_unknown"), "the fixture includes the undated gate");
    for (const t of n) {
      assert.equal(t.size, 13);
      const [a, b] = extent(t);
      assert.ok(a >= 0 && b <= W && t.y - t.size >= -1 && t.y + 4 <= H, `"${t.text}" stays inside ${W}x${H}`);
    }
    const bars = rects(narrow);
    assert.equal(bars.length, n.length / 2);
    bars.forEach((r, i) => {
      const value = n[2 * i + 1];
      assert.ok(r.x + r.w + 4 <= extent(value)[0], `bar ${i} ends before its value "${value.text}"`);
      assert.ok(r.y >= n[2 * i].y + 4 && r.y + r.h <= (n[2 * i + 2]?.y ?? H + 13) - 13, `bar ${i} sits between its name and the next`);
    });
    // The largest gate takes the whole bar width, 136 units, and the others are
    // in proportion, as in the wide drawing (360 units there).
    const max = Math.max(...f.bridge.gates.slice(1).map((g) => g.eur));
    bars.forEach((r, i) => assert.ok(Math.abs(r.w - 136 * f.bridge.gates[i + 1].eur / max) < 1e-9));
    assert.ok(Math.abs(Math.max(...bars.map((r) => r.w)) - (256 - 4 - 116)) < 1e-9);
  }
  // Rendered size: 13 units in 256: at least 11 px from a 218 px drawing (a 360 px phone), at most 15 px at the cap; the
  // chart, and at the 18rem cap; the wide drawing below 47.5rem was 10 units in 760.
  assert.ok(13 * 218 / 256 >= 11 && 13 * 288 / 256 <= 15);
});

test("render: the narrow whole-ledger bar names each part under its end of the bar, values from the same formatters", () => {
  for (const f of [SMALL, HUGE]) {
    const [, , narrow, wide] = svgs(render(f));
    const [, , W, H] = viewBox(narrow);
    const n = texts(narrow);
    const b0 = f.bridge.gates[0];
    const share = f.bridge.perimeter / f.bridge.total;
    assert.deepEqual(n.map((t) => t.text), [
      "fuori dal perimetro", `${formatEur(b0.eur)} · ${formatPercent(b0.shareOfTotal)}`,
      "perimetro biosimilare", `${formatEur(f.bridge.perimeter)} · ${formatPercent(share)}`,
    ]);
    assert.deepEqual(texts(wide).map((t) => t.text), [`fuori dal perimetro · ${n[1].text}`, `perimetro biosimilare · ${n[3].text}`]);
    assert.deepEqual(n.map((t) => t.anchor), ["start", "start", "end", "end"], "left part on the left, right part on the right, as in the wide drawing");
    for (let i = 1; i < n.length; i++) assert.ok(n[i].y - n[i - 1].y >= 19, "lines 19 units apart: no two lines touch");
    for (const t of n) { const [a, b] = extent(t); assert.ok(t.size === 13 && a >= 0 && b <= W && t.y + 4 <= H, t.text); }
    const [outside, perimeter] = rects(narrow);
    assert.ok(Math.abs(outside.w / (W - 2) - b0.shareOfTotal) < 1e-12 && Math.abs(perimeter.w / (W - 2) - share) < 1e-12);
    assert.ok(perimeter.x + perimeter.w + perimeter.stroke / 2 <= W, "the stroked segment stays inside the viewBox");
  }
  assert.ok(13 * 184 / 216 >= 11 && 13 * 248 / 216 <= 15, "13 units in 216: at least 11 px in a 184 px panel (360 px phone), at most 15 px at the 15.5rem cap");
});

const cells = (s) => [...s.matchAll(/<(td|th|dd|p)[^>]*>([\s\S]*?)<\/\1>/g)].map((m) => decode(m[2].replace(/<!-- -->/g, "").replace(/<[^>]+>/g, "")));

test("render: the stacked list carries every table row in order, the total last and emphasised", () => {
  for (const f of [SMALL, HUGE]) {
    const html = render(f);
    const ul = html.match(/<ul aria-label="([^"]*)"[^>]*>([\s\S]*?)<\/ul>/);
    assert.equal(ul[1], `Perimetro biosimilare per soglia: spesa, quota del totale rendicontato, e che cosa se ne può fare (${P.scopeLabel} · ${P.monthsLabel})`);
    const items = [...ul[2].matchAll(/<li class="([^"]*)">([\s\S]*?)<\/li>/g)];
    const trs = [...html.match(/<tbody[\s\S]*?<\/tfoot>/)[0].matchAll(/<tr>([\s\S]*?)<\/tr>/g)].map((m) => cells(m[1]));
    const gates = f.bridge.gates.slice(1);
    assert.equal(items.length, gates.length + 1);
    gates.forEach((g, i) => {
      const [label, eur, share, meaning] = cells(items[i][2]);
      assert.deepEqual([label, eur, share], [g.label, formatEur(g.eur), formatPercent(g.shareOfTotal)]);
      assert.deepEqual([label, meaning, eur, share], trs[i], "the same four cells as the table row");
      assert.ok(meaning.startsWith(g.meaning), "the meaning and the action, whole");
      assert.match(items[i][2], /<dd class="whitespace-nowrap text-right font-mono">/);
    });
    const total = items.at(-1);
    assert.match(total[1], /bg-muted\/30/);
    assert.deepEqual(cells(total[2]), trs.at(-1));
    assert.deepEqual(cells(total[2]).slice(1), [formatEur(f.bridge.perimeter), formatPercent(f.bridge.perimeter / f.bridge.total)]);
  }
});

test("render: a share of nothing stays a dash, and the notices replace both drawings, never one", () => {
  // Zero total: every share is null, the outside gate nets negative.
  const zero = fixture(1, 0);
  const html = render(zero);
  assert.equal(svgs(html).length, 0);
  assert.match(html, /Barra non disegnata/);
  const ul = html.match(/<ul aria-label="[^"]*"[^>]*>([\s\S]*?)<\/ul>/)[1];
  const shares = [...ul.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/g)].map((m) => cells(m[1])[2]);
  assert.deepEqual(shares, Array(shares.length).fill("—"));
  assert.ok(!/>0%</.test(ul), "never 0 %");
  // A failed cross-check: the alert, the list and the table, no drawing.
  const failed = render({ bridge: SMALL.bridge, check: { ...SMALL.check, consistent: false, difference: 1.5 } });
  assert.match(failed, /role="alert"/);
  assert.equal(svgs(failed).length, 0);
  assert.match(failed, /<ul aria-label=/);
  assert.match(failed, /<table/);
});

test("the gate names of the narrow drawing fit its line at 13 units, so none is shortened", () => {
  const block = src.match(/const SHORT_LABEL[^=]*= \{([\s\S]*?)\n\};/)[1];
  const labels = [...block.matchAll(/: "([^"]+)"/g)].map((m) => m[1]);
  assert.equal(labels.length, Object.keys(BRIDGE_B_GATES).length);
  for (const l of labels) assert.ok(l.length * 0.55 * 13 <= 256 - 4, `"${l}" fits 252 units`);
  // Discriminating: a label twice as long would not.
  assert.ok(!("Riferimento dopo primo uso locale nelle Aziende".length * 0.55 * 13 <= 260));
});

test("the narrow ledger keeps its last line inside the viewBox in the production font (112 units high)", () => {
  const src = fs.readFileSync(new URL("../components/dashboard-review/pillar-b-bridge-b.tsx", import.meta.url), "utf8").replace(/\r\n/g, "\n");
  assert.match(src, /viewBox=\{`0 0 \$\{nl\.width\} 112`\}/);
  assert.doesNotMatch(src, /viewBox=\{`0 0 \$\{nl\.width\} 110`\}/);
});
