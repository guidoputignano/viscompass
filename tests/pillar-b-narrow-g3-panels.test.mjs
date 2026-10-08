import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import ts from "typescript";

import { formatEur, formatNumber, formatPercent } from "../lib/dashboard-review/format.ts";

// NARROW LAYOUTS of the panel tables (components/dashboard-review/pillar-b-panels.tsx).
//
// On a phone, and at 768 px where the sidebar leaves a card a phone's width,
// the trend, concentration and volume tables sat in a sideways-scrolling box
// with a fixed min-width that hid most of their columns. Each now switches on
// the width of its OWN wrapper (a CSS container), not the viewport: a stacked
// list below the width at which the table fits, the table, unchanged, above.
// Synthetic values only: this repository is public.

const root = fileURLToPath(new URL("..", import.meta.url));
const src = fs.readFileSync(`${root}components/dashboard-review/pillar-b-panels.tsx`, "utf8").replace(/\r\n/g, "\n");

/** The source of one top-level function, from its declaration to the closing brace at column 0. */
function fn(name) {
  const i = src.search(new RegExp(`^(export )?function ${name}\\b`, "m"));
  assert.ok(i >= 0, `${name} found`);
  const j = src.indexOf("\n}\n", i);
  assert.ok(j > i, `${name} has an end`);
  return src.slice(i, j + 2);
}

/**
 * Every narrow list and the wide wrapper after it, as
 * { list, listAt, wide, wideAt, wideHidden, tableMinRem }. A list is a
 * <ul aria-label=…> hidden from `[@container(min-width:Xrem)]`; its wide
 * sibling is the next element shown from `[@container(min-width:Yrem)]:block`.
 */
export function variantPairs(code) {
  const out = [];
  const listRe = /<ul aria-label=\{?["`]?([^\n]*?)\n?\s*className="([^"]*)"/g;
  for (let m = listRe.exec(code); m; m = listRe.exec(code)) {
    const listCls = m[2];
    const listAt = listCls.match(/\[@container\(min-width:([\d.]+)rem\)\]:hidden/);
    const rest = code.slice(m.index + m[0].length);
    const wide = rest.match(/<div className="([^"]*\[@container\(min-width:([\d.]+)rem\)\]:block[^"]*)">\s*<table className="[^"]*min-w-\[([\d.]+)rem\]/);
    out.push({
      list: m[1], listAt: listAt ? Number(listAt[1]) : null,
      wideAt: wide ? Number(wide[2]) : null, wideHidden: wide ? /(^| )hidden( |$)/.test(wide[1]) : false,
      tableMinRem: wide ? Number(wide[3]) : null,
    });
  }
  return out;
}

test("the pair checker itself: matched thresholds pass; a mismatch, a missing hidden or a low threshold is visible", () => {
  const ok = `<ul aria-label="L" className="x [@container(min-width:49rem)]:hidden">…</ul>
      <div className="hidden overflow-x-auto [@container(min-width:49rem)]:block">
        <table className="w-full min-w-[48rem] text-sm">`;
  assert.deepEqual(variantPairs(ok), [{ list: "L\"", listAt: 49, wideAt: 49, wideHidden: true, tableMinRem: 48 }]);
  const mismatch = ok.replace("49rem)]:block", "50rem)]:block");
  assert.notEqual(variantPairs(mismatch)[0].listAt, variantPairs(mismatch)[0].wideAt);
  const noHidden = ok.replace('className="hidden overflow', 'className="overflow');
  assert.equal(variantPairs(noHidden)[0].wideHidden, false);
  const low = ok.replace(/49rem/g, "40rem");
  assert.ok(variantPairs(low)[0].wideAt < variantPairs(low)[0].tableMinRem);
});

test("every table in the file has a narrow twin on the same container threshold, at or above the table's min-width", () => {
  const pairs = variantPairs(src);
  assert.equal(pairs.length, 3, "trend, concentration and volume");
  assert.equal((src.match(/<table /g) ?? []).length, 3, "no table without its narrow list");
  for (const p of pairs) {
    assert.ok(p.listAt !== null && p.listAt === p.wideAt, `${p.list}: list hidden from ${p.listAt}rem, table shown from ${p.wideAt}rem`);
    assert.ok(p.wideHidden, `${p.list}: the wide wrapper is display:none below its threshold`);
    assert.ok(p.wideAt > p.tableMinRem, `${p.list}: ${p.wideAt}rem leaves room for the table's ${p.tableMinRem}rem and its border`);
  }
  // The trend table needs up to ~839 px with nine- and ten-digit euro amounts (review of the narrow layouts): 53rem.
  assert.deepEqual(pairs.map((p) => [p.wideAt, p.tableMinRem]), [[53, 44], [41, 40], [49, 48]]);
  // The sideways scroll is gone below the threshold: no overflow box is visible at every width.
  for (const m of src.matchAll(/className="([^"]*overflow-x-auto[^"]*)"/g)) {
    assert.match(m[1], /(^| )hidden( |$)/, `${m[1]} is hidden below its container threshold`);
  }
});

test("TrendTable: its own wrapper is the container; list and table read ONE column definition", () => {
  const t = fn("TrendTable");
  assert.match(t, /<div className="flex flex-col gap-2 \[container-type:inline-size\]">/);
  assert.match(t, /<ul aria-label=\{caption\} className="[^"]*empty:hidden \[@container\(min-width:53rem\)\]:hidden" translate="no">/);
  assert.match(t, /<div className="hidden overflow-x-auto rounded-xl border border-border \[@container\(min-width:53rem\)\]:block">\n\s*<table className="w-full min-w-\[44rem\] text-sm" translate="no">/);
  // Header, wide row and narrow item all map TREND_VALUES: same labels, same values.
  assert.match(t, /TREND_VALUES\.map\(\(c\) => <Pair key=\{c\.label\} label=\{c\.label\} muted=\{c\.muted\}>\{c\.value\(row\)\}<\/Pair>\)/);
  assert.match(t, /TREND_VALUES\.map\(\(c\) => <th key=\{c\.label\} className="px-4 py-2\.5 text-right font-semibold">\{c\.label\}<\/th>\)/);
  assert.match(t, /TREND_VALUES\.map\(\(c\) => <td key=\{c\.label\} className=\{"px-4 py-2\.5 text-right font-mono text-xs" \+ \(c\.muted \? " text-muted-foreground" : ""\)\}>\{c\.value\(row\)\}<\/td>\)/);
  // The bar is the same share in both layouts.
  assert.equal((t.match(/<Bar share=\{barShare\(row\)\} \/>/g) ?? []).length, 2);
  assert.match(t, /const barShare = \(row: TrendRow\) => \(max === 0 \? 0 : Math\.abs\(row\.spend2025\) \/ max\);/);
  // The first column is the item heading.
  assert.match(t, /<li key=\{row\.key\} className="px-3 py-2\.5">\n\s*<p className="font-medium text-foreground">\{row\.label\}<\/p>/);
});

/** TREND_VALUES evaluated from the source, with the real formatters and a stub JSX factory. */
function trendValues() {
  const i = src.indexOf("const TREND_VALUES");
  const j = src.indexOf("\n];\n", i);
  assert.ok(i >= 0 && j > i, "TREND_VALUES found");
  const js = ts.transpileModule(src.slice(i, j + 3), {
    compilerOptions: { jsx: ts.JsxEmit.React, jsxFactory: "h", target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const h = (type, props, ...children) => ({ type, props, children });
  return new Function("h", "formatEur", "formatPercent", "formatNumber", `${js}\nreturn TREND_VALUES;`)(h, formatEur, formatPercent, formatNumber);
}
const textOf = (v) => (typeof v === "string" ? v : v.children.join(""));

test("TrendTable values: a year with no record says so (never 0 €), a rate from nothing is —, records are counts", () => {
  const cols = trendValues();
  assert.deepEqual(cols.map((c) => c.label), ["Spesa 2024", "Spesa 2025", "Variazione €", "Variazione %", "Record 2024", "Record 2025"]);
  assert.deepEqual(cols.map((c) => Boolean(c.muted)), [false, false, false, false, true, true]);
  const row = { key: "k", label: "Molecola sintetica", spend2024: 0, spend2025: 1234567, changeEur: 1234567, change: null, rows2024: 0, rows2025: 12, negativeRows: 0 };
  const v = cols.map((c) => c.value(row));
  assert.equal(textOf(v[0]), "nessun record", "no 2024 record: not a zero");
  assert.equal(v[0].props.className, "text-muted-foreground");
  assert.equal(v[1], formatEur(1234567));
  assert.equal(v[2], formatEur(1234567));
  assert.equal(v[3], "—", "a change from nothing has no rate");
  assert.equal(v[4], formatNumber(0, 0));
  assert.equal(v[5], formatNumber(12, 0));
  // Discriminating: a real zero spend WITH records is printed as an amount; a real rate is printed.
  const zero = { ...row, spend2024: 0, rows2024: 3, spend2025: 0, rows2025: 0, changeEur: -500, change: -0.25 };
  const z = cols.map((c) => c.value(zero));
  assert.equal(z[0], formatEur(0), "observed zero is an amount");
  assert.equal(textOf(z[1]), "nessun record");
  assert.equal(z[2], formatEur(-500));
  assert.equal(z[3], formatPercent(-0.25));
});

test("ConcentrationPanel: figures and ranking switch on their own block; the curve is called as before, outside it", () => {
  const c = fn("ConcentrationPanel");
  assert.match(c, /<ConcentrationCurve data=\{conc\} year=\{year\} scopeNote=\{scopeNote\} \/>\n(\s*\{\/\*[\s\S]*?\*\/\}\n)?\s*<div className="flex flex-col gap-3 \[container-type:inline-size\]">/);
  assert.match(c, /<div className="grid gap-3 \[@container\(min-width:32rem\)\]:grid-cols-3">/);
  assert.doesNotMatch(c, /sm:grid-cols-3/, "the viewport switch is gone");
  assert.match(c, /className="mt-3 divide-y divide-border rounded-xl border border-border text-xs \[@container\(min-width:41rem\)\]:hidden" translate="no">/);
  assert.match(c, /<div className="mt-3 hidden overflow-x-auto rounded-xl border border-border \[@container\(min-width:41rem\)\]:block">\n\s*<table className="w-full min-w-\[40rem\] text-sm" translate="no">/);
  // Rank and name as heading; the three figures as pairs; the bar is the cumulative share.
  const list = c.slice(c.indexOf("<ul aria-label="), c.indexOf("</ul>"));
  assert.match(list, /<span className="font-mono text-muted-foreground">\{row\.rank\}<\/span>\n\s*<span className="min-w-0 break-words font-medium">\{row\.label\}<\/span>/);
  assert.match(list, /<Pair label=\{`Spesa \$\{year\}`\}>\{formatEur\(row\.spend_eur\)\}<\/Pair>/);
  assert.match(list, /<Pair label="Quota">\{formatPercent\(row\.share\)\}<\/Pair>/);
  assert.match(list, /<Pair label="Quota cumulata">\{formatPercent\(row\.cumulativeShare\)\}<\/Pair>/);
  assert.match(list, /<Bar share=\{row\.cumulativeShare\} \/>/);
  // The total is the last, emphasised item, with the table footer's values.
  assert.match(list, /<li className="bg-muted\/30 px-3 py-2\.5">\n\s*<p className="font-semibold text-foreground">Totale \{count\(conc\.moleculeCount, "molecola", "molecole"\)\} \{scopeShort\}<\/p>/);
  assert.match(list, /<Pair label=\{`Spesa \$\{year\}`\}>\{formatEur\(conc\.totalEur\)\}<\/Pair>\n\s*<Pair label="Quota">\{formatPercent\(1\)\}<\/Pair>/);
  // The list carries the summary's meaning as its name.
  assert.match(c, /<ul aria-label=\{`Classifica numerica \$\{conc\.rows\.length === 1 \? "della prima molecola" : `delle prime \$\{formatNumber\(conc\.rows\.length, 0\)\} molecole`\} · \$\{year\} · \$\{scopeShort\}`\}/);
});

test("VolumePanel: the table becomes a list under 49rem; the chart rows switch on the chart's own width", () => {
  const v = fn("VolumePanel");
  assert.match(v, /<div className="mt-4 flex flex-col gap-3 \[container-type:inline-size\]">/);
  assert.match(v, /<ul aria-label="Uptake in volume per molecola e via di somministrazione" className="[^"]*empty:hidden \[@container\(min-width:49rem\)\]:hidden" translate="no">/);
  assert.match(v, /<caption className="sr-only">Uptake in volume per molecola e via di somministrazione<\/caption>/, "the list's name is the table's caption");
  assert.match(v, /<div className="hidden overflow-x-auto rounded-lg border border-border \[@container\(min-width:49rem\)\]:block">\n\s*<table className="w-full min-w-\[48rem\] text-sm" translate="no">/);
  const list = v.slice(v.indexOf("<ul aria-label="), v.indexOf("</ul>"));
  assert.match(list, /\{shown\.map\(\(v\) => \(\n\s*<li key=\{`\$\{v\.substance\}\/\$\{v\.route\}\/\$\{v\.unit\}`\}/, "every observed group, in the table's order");
  assert.match(list, /<p className="break-words font-medium text-foreground">\{v\.substance\}<\/p>/);
  assert.match(list, /<dl className="mt-1\.5 grid gap-x-6 gap-y-1 \[@container\(min-width:36rem\)\]:grid-flow-col \[@container\(min-width:36rem\)\]:grid-cols-2 \[@container\(min-width:36rem\)\]:grid-rows-3">/, "two columns filled down: the group left, its measures right");
  for (const pair of [
    /<Pair label="Via" muted text>\{v\.route\}<\/Pair>/,
    /<Pair label="Unità" muted>\{v\.unit\}<\/Pair>/,
    /<Pair label="Aziende">\{formatNumber\(v\.aslCount, 0\)\}<\/Pair>/,
    /<Pair label="Quota \(intero periodo\)">[\s\S]*?<Bar share=\{v\.wholePeriodShare \?\? 0\} \/>[\s\S]*?\{v\.wholePeriodShare === null \? "—" : formatPercent\(v\.wholePeriodShare\)\}/,
    /<Pair label="Quota \(dal primo uso\)">[\s\S]*?<Bar share=\{v\.windowShare \?\? 0\} \/>[\s\S]*?\{v\.windowShare === null \? "—" : formatPercent\(v\.windowShare\)\}/,
    /<Pair label="Primo uso" muted>\{v\.firstKey === null \? "mai" : monthKeyLabel\(v\.firstKey\)\}<\/Pair>/,
  ]) assert.match(list, pair);
  // The chart: a container of its own, three columns from 28rem, names wrap below it.
  assert.match(v, /<div className="space-y-3 \[container-type:inline-size\]" role="img"/);
  assert.match(v, /className="grid gap-1 \[@container\(min-width:28rem\)\]:grid-cols-\[11rem_1fr_4rem\] \[@container\(min-width:28rem\)\]:items-center \[@container\(min-width:28rem\)\]:gap-3"/);
  assert.doesNotMatch(v, /sm:grid-cols-\[11rem/, "the viewport switch is gone");
  assert.equal((v.match(/block break-words[^"]*\[@container\(min-width:28rem\)\]:truncate/g) ?? []).length, 2);
});

test("a narrow pair keeps a figure with its unit; only a word value may wrap", () => {
  const p = fn("Pair");
  assert.match(p, /<dt className="min-w-0 text-\[11px\] text-muted-foreground">\{label\}<\/dt>/);
  assert.match(p, /\(text \? "min-w-0 break-words" : "whitespace-nowrap font-mono"\)/);
  assert.match(fn("TrendTable") + fn("ConcentrationPanel") + fn("VolumePanel"), /<dl className="mt-1\.5 grid gap-x-6 gap-y-1/);
});

test("the file stays a client component, with no viewport layout switch left and the other agents' charts called as before", () => {
  assert.ok(src.startsWith('"use client";\n'));
  const classes = [...src.matchAll(/className=\{?["`]([^"`]*)["`]/g)].map((m) => m[1]).join(" ");
  const viewport = classes.split(/\s+/).filter((c) => /^(sm|md|lg|xl):/.test(c));
  assert.deepEqual(viewport, ["sm:p-5"], "only the volume card's padding still follows the viewport");
  assert.match(src, /<MonthlyBars rows=\{rows\} title=\{metric === "spesa" \? title : MONTH_TITLES\[metric\]\} metric=\{metric\} view=\{selected\} \/>/);
  assert.match(src, /<MoleculeChangeChart rows=\{rows\}\n\s*title=\{title\}\n\s*measure=\{order\}/);
  assert.match(src, /<AziendaBars rows=\{rows\} years=\{years\} metric=\{metric\} \/>/);
});
