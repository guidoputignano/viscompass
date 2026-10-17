import test from 'node:test';
import assert from 'node:assert/strict';
import { cInsightCanTrend, cInsightChartOptions, cInsightComparable, cInsightDefaultChart, cInsightIntervals, cInsightMatrixColumns, cInsightPoints, cInsightPreferredComparison, cInsightWaterfall } from '../lib/dashboard-review/pillar-c/insight-charts.ts';
import { cWorkbookRows } from '../lib/dashboard-review/pillar-c/workbook.ts';

const formats = { 0: 'General', 1: '#,##0.00 "€"', 2: '0.0%', 3: '0.0 " pp"' };
const n = (v, f = 1) => v === null ? null : [String(v), f];
function table(columns, rows, numericColumns = columns.flatMap((_, c) => rows.some(r => Array.isArray(r[c])) ? [c] : [])) {
  return { columns, rows, numericColumns, sourceRows: rows.map((_, i) => i + 7), sheet: 'Test', range: 'A6:Z20', startColumn: 1, headerRow: 6, notes: [] };
}
const options = (t, metric, output = 'TEST') => cInsightChartOptions({ table: t, rows: cWorkbookRows(t, '', {}, null, 'asc'), formats, metric, visible: t.numericColumns, output });

test('chart adapter preserves source rows, raw precision, signed values, null and real zero', () => {
  const t = table(['Categoria', 'Spesa (€)', 'Altra (€)'], [['Uno', n('123456.7890123'), n(null)], ['Due', n('-8.50'), n('0')]]);
  const p = cInsightPoints(t, cWorkbookRows(t, '', {}, null, 'asc'), formats);
  assert.equal(p[0].sourceRow, 7); assert.equal(p[1].sourceRow, 8);
  assert.equal(p[0].values[1].value, 123456.7890123);
  assert.equal(p[0].values[1].exact, '123.456,79 €');
  assert.equal(p[0].values[2].value, null); assert.equal(p[1].values[2].value, 0);
  assert.equal(p[1].values[1].value, -8.5); assert.equal(p[1].values[1].exact, '-8,50 €');
});

test('matrix groups same measures over matching periods, never full years with five months by default', () => {
  const t = table(['Categoria', 'Con segno Anno 2024 (€)', 'Con segno Anno 2025 (€)', 'Con segno Gen–Mag 2025 (€)', 'Righe Anno 2025'], [['Uno', n(3), n(4), n(2), n(9, 0)]]);
  const rows = cWorkbookRows(t, '', {}, null, 'asc'), comparable = cInsightComparable(t, rows, formats, 1, t.numericColumns);
  assert.deepEqual(comparable, [2, 3]);
  assert.deepEqual(cInsightMatrixColumns(t, 1, comparable, 'TEST'), [1, 2]);
  assert.equal(cInsightPreferredComparison(t, 1, comparable), 2);
  assert.equal(cInsightDefaultChart(options(t, 1), 'composizione'), 'matrix');
  assert.ok(!options(t, 1).includes('line'));
  assert.equal(cInsightPoints(t, rows, formats)[0].name, 'Uno', 'year-prefixed measures never pollute the category label with raw amounts');
});

test('mixed units suppress every numerical view, compatible units cannot differ by explicit basis', () => {
  const mixed = table(['Categoria', 'Unità', 'Valore'], [['A', '€', n(3, 0)], ['B', 'residenti', n(4, 0)]]);
  assert.deepEqual(options(mixed, 2), []);
  const scales = table(['Categoria', 'Euro', 'Quota'], [['A', n(3), n(0.5, 2)], ['B', n(4), n(0.6, 2)]]);
  const o = options(scales, 1);
  assert.ok(o.includes('scatter')); assert.ok(!o.includes('paired')); assert.ok(!o.includes('matrix'));
});

test('time lines require distinct ascending periods and a single context, including numerical years', () => {
  const t = table(['Anno', 'Spesa (€)'], [[n(2023, 0), n(10)], [n(2024, 0), null], [n(2025, 0), n(15)]]);
  const rows = cWorkbookRows(t, '', {}, null, 'asc');
  assert.equal(cInsightCanTrend(t, rows), true); assert.ok(options(t, 1).includes('area'));
  assert.equal(cInsightDefaultChart(options(t, 1), 'attivita'), 'line');
  assert.equal(cInsightPoints(t, rows, formats)[1].values[1].value, null);
  assert.equal(cInsightPoints(t, rows, formats)[0].name, '2023');
  assert.equal(cInsightCanTrend(t, [...rows].reverse()), false);
  const multi = table(['Mese', 'Azienda', 'Spesa (€)'], [['2024-01', 'ASL 1', n(2)], ['2024-02', 'ASL 2', n(3)]]);
  assert.equal(cInsightCanTrend(multi, cWorkbookRows(multi, '', {}, null, 'asc')), false);
  multi.rows[1][1] = 'ASL 1'; multi.rows[1][0] = '2024-01';
  assert.equal(cInsightCanTrend(multi, cWorkbookRows(multi, '', {}, null, 'asc')), false);
  multi.rows[1][0] = '2024-03';
  assert.equal(cInsightCanTrend(multi, cWorkbookRows(multi, '', {}, null, 'asc')), false, 'a missing month must not be bridged');
});

test('interval eligibility requires a recognized source contract and ordered observed bounds', () => {
  const t = table(['Serie', 'Pendenza (€/mese)', 'Intervallo di variabilità 95 %: inf. (€/mese)', 'Intervallo di variabilità 95 %: sup. (€/mese)'], [['A', n(5), n(2), n(8)]]);
  assert.deepEqual(cInsightIntervals(t, 1, [2, 3], 'O-17-05'), [{ low: 2, high: 3, label: 'Variabilità al 95 %' }]);
  assert.ok(options(t, 1, 'O-17-05').includes('interval'));
  assert.ok(!options(t, 1, 'UNRECOGNIZED').includes('interval'));
  assert.equal(cInsightDefaultChart(options(t, 1, 'O-17-05'), 'tendenze'), 'interval');
  t.rows[0][2] = n(9); assert.ok(!options(t, 1, 'O-17-05').includes('interval'));
  t.rows[0][2] = null; assert.ok(!options(t, 1, 'O-17-05').includes('interval'));
  t.rows[0][2] = n(0); assert.ok(options(t, 1, 'O-17-05').includes('interval'));
});

test('attribution interval pairs stay inside the selected period and uncertainty hypothesis', () => {
  const t = table(['Area', 'Anno 2025 (12 mesi) · F (S2) (€)', 'Anno 2025 (12 mesi) · LB1 (€)', 'Anno 2025 (12 mesi) · UB1 (€)', 'Anno 2025 (12 mesi) · LB2 (€)', 'Anno 2025 (12 mesi) · UB2 (€)', 'Anno 2024 (12 mesi) · LB1 (€)'], [['A', n(5), n(3), n(8), n(1), n(10), n(99)]]);
  assert.deepEqual(cInsightIntervals(t, 1, [2, 3, 4, 5, 6], 'O-10-05').map(b => [b.low, b.high]), [[2, 3], [4, 5]]);
});

test('waterfall reconciles decimals exactly, retains negative components and rejects broken closure', () => {
  const parts = [{ component: 'B-C', value: '0.2' }, { component: 'B-E', value: '-0.05' }, { component: 'B-X', value: '0' }, { component: 'B-N', value: '0.01' }];
  const steps = cInsightWaterfall('0.1', '0.26', parts);
  assert.equal(steps.length, 6); assert.equal(steps[1].end, '0.3'); assert.equal(steps[2].end, '0.25');
  assert.equal(steps[2].value, '-0.05'); assert.equal(steps[4].end, steps[5].value);
  assert.deepEqual(cInsightWaterfall('0.1', '0.2600000001', parts), []);
  assert.deepEqual(cInsightWaterfall('0.1', '0.26', parts.slice(1)), []);
});
