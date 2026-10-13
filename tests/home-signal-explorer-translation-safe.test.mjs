import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

// MACHINE TRANSLATION AND THE HOMEPAGE YEAR SELECTOR (13 October 2026). With
// Chrome's translation on, a click on «2024» updated the spend and the signal
// sentence but left «783k» DDD, «€7.85 per DDD», «Segnale 2025» and the 2025
// change chips on screen, with no error. The translator replaces React's text
// nodes with its own <font> elements, and React patched the old, detached text
// nodes; a lone text child only survived because React rewrites it whole. The
// fix renders whatever the year changes inside YearView, a keyed element that
// is the only child of its wrapper (as Fresh in pillar-b-panels.tsx), replaced
// whole on each change. Reproduced and verified in the browser against next
// dev by wrapping every text node in <font><font>; here, the pins.

const root = fileURLToPath(new URL("..", import.meta.url));
const src = fs.readFileSync(`${root}components/home/signal-explorer.tsx`, "utf8").replace(/\r\n/g, "\n");
const body = src.slice(src.indexOf("export function SignalExplorer("));
const jsx = body.slice(body.indexOf("  return ("));
const REGION = /<YearView year=\{selected\.year\}[^>]*>[\s\S]*?<\/YearView>/g;

test("YearView: the keyed element is the only child of its own wrapper, keyed on the year", () => {
  assert.match(src, /function YearView\(\{ year, className, children \}[^)]*\) \{\n\s*return <div><div key=\{year\} className=\{className\}>\{children\}<\/div><\/div>;\n\}/);
});

test("every figure the year changes renders inside a YearView keyed on the selected year", () => {
  const regions = jsx.match(REGION) ?? [];
  assert.equal(regions.length, 2, "the KPI tiles and the signal box");
  const [tiles, signal] = regions;
  for (const expr of ["{formatMillion(selected.spend)}", "{selected.ddd}k", "€{selected.costPerDdd.toFixed(2)}"]) {
    assert.ok(tiles.includes(expr), `tiles: ${expr}`);
  }
  for (const expr of ["Segnale {selected.year}", "{selected.signal}", "{previous && (", "Spesa {spendChange!", "DDD {dddChange!"]) {
    assert.ok(signal.includes(expr), `signal box: ${expr}`);
  }
  const outside = jsx.replace(REGION, "");
  assert.doesNotMatch(outside, /\b(selected|previous|spendChange|dddChange)\b/, "nothing derived from the year is rendered outside the keyed regions");
  // Outside them the year only drives attributes (pressed state, class, point radius), never text.
  for (const [line] of outside.matchAll(/^.*\bselectedYear\b.*$/gm)) {
    assert.match(line, /row\.year === selectedYear/, line.trim());
  }
  assert.match(outside, /aria-pressed=\{row\.year === selectedYear\}\n\s*>\n\s*\{row\.year\}\n\s*<\/button>/, "each button's own text is its fixed year");
});
