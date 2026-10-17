import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire, register } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
register('data:text/javascript,' + encodeURIComponent(`
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
let sucrase;
export function initialize({pkg}) { sucrase = createRequire(pkg)('sucrase'); }
export async function load(url, context, next) {
  if (url.startsWith('file:') && url.endsWith('.tsx')) {
    const file = fileURLToPath(url);
    return {format:'module',source:sucrase.transform(readFileSync(file,'utf8'),{transforms:['typescript','jsx'],jsxRuntime:'automatic',production:true,filePath:file}).code,shortCircuit:true};
  }
  return next(url,context);
}`), { data: { pkg: pathToFileURL(`${root}package.json`).href } });
const req = createRequire(`${root}package.json`), React = req('react'), { renderToStaticMarkup } = req('react-dom/server');
const { PillarCInsightChart } = await import('../components/dashboard-review/pillar-c/insight-chart.tsx');
const { PillarCChangeBridge } = await import('../components/dashboard-review/pillar-c/change-bridge.tsx');
const p = (sourceRow, name, a, b, low = null, high = null) => ({ sourceRow, name, values: Object.fromEntries([a, b, low, high].map((value, c) => [c, { value, exact: value === null ? '—' : String(value) }])) });
const points = [p(7, 'Categoria sintetica lunga da mantenere accessibile', -4, 8, -6, -2), p(8, 'Zero osservato', 0, 0, 0, 0), p(9, 'Assente', null, 5)];
const props = { points, metric: 0, comparison: 1, xMetric: 1, matrix: [0, 1], interval: { low: 2, high: 3, label: 'Sensibilità' }, heading: c => ['Importo iniziale', 'Importo finale', 'Minimo', 'Massimo'][c], axis: n => `${n} €`, title: 'Analisi sintetica' };
const render = kind => renderToStaticMarkup(React.createElement(PillarCInsightChart, { ...props, kind }));

test('point, paired, interval and bar render finite geometry and retain exact accessible values', () => {
  for (const kind of ['dot', 'paired', 'interval', 'bar']) {
    const html = render(kind);
    assert.doesNotMatch(html, /NaN|Infinity|undefined/);
    assert.match(html, /tabindex="0"/);
    assert.match(html, /Categoria sintetica lunga da mantenere accessibile/);
    assert.match(html, /aria-label="Zero osservato: Importo iniziale 0/);
    assert.match(html, /aria-label="Assente: Importo iniziale —/);
  }
  const paired = render('paired');
  assert.match(paired, /rotate\(45/);
  assert.match(paired, /Importo iniziale -4; Importo finale 8/);
  const interval = render('interval');
  assert.match(interval, /Minimo -6; Massimo -2/);
  assert.ok((interval.match(/stroke-width="5"/g) ?? []).length === 2, 'two valid intervals, including zero-width; no interval invented for absent bounds');
});

test('heatmap renders each source cell as keyboard-accessible exact data, including missing and zero', () => {
  const html = render('matrix');
  assert.equal((html.match(/<button/g) ?? []).length, 6);
  assert.match(html, /Assente · Importo iniziale: —/);
  assert.match(html, /Zero osservato · Importo iniziale: 0/);
  assert.match(html, /var\(--viz-2\)/, 'negative cells have a distinct signed color');
  assert.doesNotMatch(html, /NaN|Infinity/);
});

test('scatter excludes absent pairs without inventing a zero point and names each axis', () => {
  const html = render('scatter');
  assert.equal((html.match(/<circle/g) ?? []).length, 2);
  assert.match(html, /Importo iniziale/); assert.match(html, /Importo finale/);
  assert.doesNotMatch(html, /aria-label="Assente:/);
});

test('waterfall static output has six accessible steps and single-child titles, signed values and safe fallback', () => {
  const components = [{component:'B-C',value:'4'},{component:'B-E',value:'-2'},{component:'B-X',value:'0'},{component:'B-N',value:'1'}];
  const html = renderToStaticMarkup(React.createElement(PillarCChangeBridge, {opening:'10',closing:'13',components}));
  assert.equal((html.match(/tabindex="0"/g) ?? []).length, 6);
  assert.match(html, /Spesa iniziale: 10,00/);assert.match(html, /Spesa finale: 13,00/);
  assert.match(html, />\+4 €/); assert.match(html, />-2 €/);
  assert.doesNotMatch(html, /NaN|Infinity/);
  const broken = renderToStaticMarkup(React.createElement(PillarCChangeBridge, {opening:'10',closing:'14',components}));
  assert.doesNotMatch(broken, /<svg/);assert.match(broken, /non è disponibile/);
});
