import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import {
  DESYNC_RELOAD_KEY, DESYNC_RELOAD_WINDOW_MS, isDomDesync, markDesyncReload, shouldReloadAfterDesync,
} from "../lib/dashboard-review/dom-desync.ts";

// MACHINE TRANSLATION AND THE LOCAL TOGGLES (12 October 2026). With Chrome's
// translation on, a click on a panel toggle (sort, perimeter, measure, year,
// route) threw NotFoundError from removeChild and the page fell to "L'analisi
// non è disponibile"; other toggles silently left the previous view's figures
// on screen. The translator replaces React's text nodes with its own elements.
// The fix renders everything a local option changes inside a keyed element,
// replaced whole (Fresh), and lets the error boundary reload once on any DOM
// desync that remains. Reproduced and verified with a DOM in
// outputs/pillar-b/logs/b53_translation_toggles.mjs (before: crashes and stale
// figures; after: none); here, the pins that keep the fix in place.

const root = fileURLToPath(new URL("..", import.meta.url));
const read = (f) => fs.readFileSync(`${root}${f}`, "utf8").replace(/\r\n/g, "\n");

// -------------------------------------------------------------- dom-desync

test("a DOM desync is recognised as the browsers raise it, and nothing else is", () => {
  // A real DOMException: Node's own carries the legacy code 8 for NotFoundError, as browsers and jsdom do.
  assert.ok(isDomDesync(new DOMException("Failed to execute 'removeChild' on 'Node': The node to be removed is not a child of this node.", "NotFoundError")), "Chromium removeChild");
  assert.ok(isDomDesync(new DOMException("Failed to execute 'insertBefore' on 'Node': The node before which the new node is to be inserted is not a child of this node.", "NotFoundError")), "Chromium insertBefore");
  assert.ok(isDomDesync(new DOMException("Node.removeChild: The node to be removed is not a child of this node", "NotFoundError")), "Firefox");
  assert.ok(isDomDesync(new DOMException("The object can not be found here.", "NotFoundError")), "WebKit: by name and code");
  assert.ok(isDomDesync(Object.assign(new Error("Failed to execute 'removeChild' on 'Node': The node to be removed is not a child of this node."), { name: "Error" })), "by the exact clause, whatever the name");
  // Defence only: React's development act() aggregates commit errors; a Next.js boundary receives the raw DOMException.
  assert.ok(isDomDesync(new AggregateError([new DOMException("x", "NotFoundError")], "")));
  assert.ok(isDomDesync(new Error("wrapped", { cause: new DOMException("x", "NotFoundError") })));
  for (const other of [
    new Error("PBR-SHAPE"),
    new TypeError("Failed to execute 'removeChild' on 'Node': parameter 1 is not of type 'Node'."),      // a programming error, not a desync
    new DOMException("Failed to execute 'appendChild' on 'Node': The new child element contains the parent.", "HierarchyRequestError"),
    Object.assign(new Error("not a child of this node"), { name: "NotFoundError" }),                    // name without code or the exact clause
    Object.assign(new DOMException("x", "NotFoundError"), { digest: "123" }),                            // anything a server component sent
    Object.assign(new Error("An error occurred in the Server Components render."), { digest: "123" }),
    null, undefined, "NotFoundError", new AggregateError([new Error("a")], ""),
  ]) {
    assert.equal(isDomDesync(other), false, String(other?.message ?? other));
  }
});

test("the error page reloads once per document, never in a loop, and not without storage", () => {
  const store = new Map();
  const s = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, v) };
  const T = 1_000_000_000;
  assert.equal(shouldReloadAfterDesync(s, T), true, "first desync in a document: reload");
  markDesyncReload(s, T + 60_000);                                  // the mark, just before reload()
  assert.equal(store.get(DESYNC_RELOAD_KEY), String(T + 60_000));
  // The reloaded document starts a few ms after the mark; a desync in it, even 40 s later (this page streams for 10-40 s), shows the card.
  assert.equal(shouldReloadAfterDesync(s, T + 60_000 + 30), false, "the product of a desync reload: the card, not another reload");
  assert.equal(shouldReloadAfterDesync(s, T + 60_000 + DESYNC_RELOAD_WINDOW_MS - 1), false);
  // A document opened later by the reader (a new navigation) may reload again.
  assert.equal(shouldReloadAfterDesync(s, T + 60_000 + DESYNC_RELOAD_WINDOW_MS + 1), true);
  assert.equal(shouldReloadAfterDesync(s, T), true, "a document that started before the mark is not its product");
  const refused = { getItem: () => { throw new Error("SecurityError"); }, setItem: () => { throw new Error("SecurityError"); } };
  assert.equal(shouldReloadAfterDesync(refused, T), false, "storage refused: no loop detection, no automatic reload");
  assert.equal(shouldReloadAfterDesync(null, T), false, "no storage at all (its getter threw)");
  assert.doesNotThrow(() => markDesyncReload(refused, T));
  assert.doesNotThrow(() => markDesyncReload(null, T));
});

test("error.tsx: a desync reloads once per document, else its own card with Ricarica; any other error is unchanged", () => {
  const src = read("app/dashboard-review/error.tsx");
  assert.match(src, /const desync = isDomDesync\(error\);/);
  assert.match(src, /useState\(\(\) => desync && typeof window !== "undefined"\n\s*&& shouldReloadAfterDesync\(sessionStore\(\), performance\.timeOrigin\)\)/,
    "the guard is the document (its navigation start), the storage read safely");
  assert.match(src, /markDesyncReload\(sessionStore\(\), Date\.now\(\)\);\n\s*window\.location\.reload\(\);/);
  assert.doesNotMatch(src, /window\.sessionStorage/, "never the raw getter, which can throw");
  assert.match(src, /role="alert">Aggiornamento della pagina…<\/p>/);
  const card = src.slice(src.indexOf("if (desync) {"), src.lastIndexOf("return ("));
  assert.match(card, /<h1 ref=\{heading\} tabIndex=\{-1\}[^>]*>La pagina non si è aggiornata correttamente<\/h1>/);
  assert.match(card, /La traduzione automatica o un’estensione del browser ha modificato la pagina mentre si aggiornava\./);
  assert.match(card, /onClick=\{\(\) => window\.location\.reload\(\)\}><RotateCcw size=\{14\} \/> Ricarica/);
  assert.doesNotMatch(card, /Riprova|fonti e dei caricamenti|non è disponibile/, "a desync is never presented as a data failure");
  assert.match(src, /heading\.current\?\.focus\(\);/);
  const ordinary = src.slice(src.lastIndexOf("return ("));
  assert.match(ordinary, /L’analisi non è disponibile/);
  assert.match(ordinary, /onClick=\{reset\}><RotateCcw size=\{14\} \/> Riprova/, "the ordinary error card is unchanged");
});

// ----------------------------------------------------------------- panels

const panels = read("components/dashboard-review/pillar-b-panels.tsx");
function fnSource(name) {
  const i = panels.search(new RegExp(`^export function ${name}\\(`, "m"));
  assert.ok(i >= 0, name);
  const j = panels.indexOf("\n}\n", i);
  return panels.slice(i, j + 2);
}

test("Fresh: the keyed element is the only child of its own wrapper", () => {
  assert.match(panels, /export function Fresh\(\{ stateKey, className, children \}[^)]*\) \{\n\s*return <div><div key=\{stateKey\} className=\{className\}>\{children\}<\/div><\/div>;\n\}/);
});

test("every panel with a local toggle renders what the toggle changes inside Fresh, keyed on ALL its options, toggles outside", () => {
  const cases = [
    ["CalendarPanel", ["selected", "metric"]],
    ["AziendaPanel", ["metric"]],
    ["TrendPanel", ["perimeter", "order", "limit"]],
    ["ConcentrationPanel", ["year", "perimeter"]],
    ["VolumePanel", ["route"]],
  ];
  for (const [name, keys] of cases) {
    const src = fnSource(name);
    const opts = [...src.matchAll(/const \[(\w+), set\w+\] = useUrlOption/g)].length;
    assert.ok(opts >= 1, `${name} has local options`);
    const fresh = src.match(/<Fresh stateKey=\{(.*?)\} className=/);
    assert.ok(fresh, `${name} uses Fresh`);
    for (const k of keys) assert.match(fresh[1], new RegExp(`\\b${k}\\b`), `${name}: the key covers ${k}`);
    const openAt = src.indexOf("<Fresh "), closeAt = src.lastIndexOf("</Fresh>");
    assert.ok(openAt > 0 && closeAt > openAt, `${name}: one Fresh region`);
    const toggles = [...src.matchAll(/<LocalToggle /g)].map((m) => m.index);
    assert.ok(toggles.length >= 1 && toggles.every((t) => t < openAt), `${name}: every toggle sits before (outside) the Fresh region, so focus stays on it`);
    // What the panel draws is inside: no chart, table, list or note after the region closes.
    assert.doesNotMatch(src.slice(closeAt), /<(MoleculeChangeChart|ConcentrationCurve|MonthlyBars|AziendaBars|Note|table|ul|details|p)\b/, `${name}: nothing drawn outside the region`);
  }
  // CalendarPanel keys on the EFFECTIVE state (the fallback rule), not the raw choice.
  assert.match(fnSource("CalendarPanel"), /const \{ available, view: selected, metric \} = effectiveCalendarState\(rows, view, metricChoice\);/);
});

test("an open section stays open when its panel's content is replaced, even one opened before hydration", () => {
  assert.match(panels, /function useDetailsOpen\(defaultOpen = false\) \{/);
  assert.match(panels, /const open = choice !== null && choice\.forDefault === defaultOpen \? choice\.open : defaultOpen;/,
    "the reader's choice holds until the panel's own default changes");
  assert.match(panels, /const el = document\.getElementById\(id\);\n\s*if \(el instanceof HTMLDetailsElement\) setChoice\(\{ forDefault: defaultOpen, open: el\.open \}\);/,
    "capture reads the element itself, in the click handler");
  const trend = fnSource("TrendPanel"), conc = fnSource("ConcentrationPanel"), cal = fnSource("CalendarPanel");
  assert.match(trend, /<details id=\{table\.id\} className="group" open=\{table\.open\} onToggle=\{table\.onToggle\}>/);
  for (const set of ["setPerimeter", "setOrder", "setLimit"]) assert.match(trend, new RegExp(`onChange=\\{keeping\\(\\[table\\], ${set}\\)\\}`));
  assert.match(conc, /<details id=\{ranking\.id\} className="group" open=\{ranking\.open\} onToggle=\{ranking\.onToggle\}>/);
  for (const set of ["setYear", "setPerimeter"]) assert.match(conc, new RegExp(`onChange=\\{keeping\\(\\[ranking\\], ${set}\\)\\}`));
  assert.match(cal, /const reading = useDetailsOpen\(selected === "confronto" && metric === "spesa"\);/);
  assert.match(cal, /<details id=\{reading\.id\} className="rounded-xl border border-border bg-card p-4" open=\{reading\.open\} onToggle=\{reading\.onToggle\}>/);
  assert.match(cal, /const sections = \[reading, exact, exactCompanion\];/, "the reading section and both charts' exact-value lists");
  assert.match(cal, /onChange=\{\(next\) => \{\n\s*for \(const d of sections\) d\.capture\(\);/);
  assert.match(cal, /onChange=\{keeping\(sections, setMetric\)\}/);
  assert.match(cal, /view=\{selected\} exact=\{exact\} \/>/);
  assert.match(cal, /view=\{selected\} exact=\{exactCompanion\} \/>/);
  const bars = read("components/dashboard-review/pillar-b-monthly-bars.tsx");
  assert.match(bars, /<details className="mt-3 rounded-lg border border-border p-3" id=\{exact\?\.id\} open=\{exact\?\.open\} onToggle=\{exact\?\.onToggle\}>/);
});

test("the review is replaced on every server answer, not only on a filter change", () => {
  const page = read("app/dashboard-review/revisione-pillar-b/page.tsx");
  // Azzera with only panel options set keeps the filters: without a per-render
  // key the panels kept the old option while the URL had dropped it, and a
  // different answer for the same filters would be patched into translated text.
  assert.match(page, /const filterKey = `\$\{pillarBHref\(BASE, filters, \{\}\)\}#\$\{crypto\.randomUUID\(\)\}`;/);
  assert.match(page, /return <PillarBReview\n\s*key=\{filterKey\}/);
  assert.ok(page.indexOf("crypto.randomUUID()") > page.indexOf("const params = await searchParams;"), "after the request is read (dynamic), as cacheComponents requires");
});

// -------------------------------------------------------------- filter bar

test("the filter bar's copy button swaps its icon and words as one keyed element", () => {
  const bar = read("components/dashboard-review/pillar-b-filter-bar.tsx");
  assert.match(bar, /<button type="button" onClick=\{copyLink\}\n\s*className="text-muted-foreground hover:text-foreground">\n\s*<span key=\{copied \? "copied" : "copy"\} className="flex items-center gap-1">\n\s*\{copied \? <Check size=\{12\} \/> : <Copy size=\{12\} \/>\}\n\s*<span>\{copied \? "Link copiato" : "Copia il link a questa vista"\}<\/span>\n\s*<\/span>\n\s*<\/button>/);
  assert.match(bar, /<RotateCcw size=\{12\} \/> <span>\{active > 0 \? `Azzera \(\$\{active\}\)` : "Azzera"\}<\/span>/);
});
