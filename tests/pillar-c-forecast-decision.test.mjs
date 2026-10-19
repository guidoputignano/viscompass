import test from 'node:test';
import assert from 'node:assert/strict';
import {cForecastDecision} from '../lib/dashboard-review/pillar-c/forecast-decision.ts';
import {cReviewV2Fixture} from './fixtures/pillar-c-review.mjs';

// Invented amounts only; no confidential ledger or real forecast totals.
function fixture() {
  const forecast = cReviewV2Fixture().forecast;
  for (const row of forecast.observed2025) Object.assign(row, {value: '1.00', rowsSource: 2, rowsValued: 2, rowsMissing: 0, blankShareFlagged: false});
  for (const row of forecast.monthly) row.point = '2.00';
  for (const row of forecast.annual) row.total = '24.00';
  return forecast;
}

test('decision summary keeps the source annual and intervals unchanged and compares complete observed year', () => {
  const forecast = fixture(), before = structuredClone(forecast);
  const result = cForecastDecision(forecast, 'TOT');
  assert.equal(result.annual, forecast.annual.find(row => row.series === 'TOT'));
  assert.equal(result.observed2025Annual, '12.00');
  assert.equal(result.delta, '12.00');
  assert.equal(result.changePct, '100.00');
  assert.equal(result.observedHasMissingRows, false);
  assert.equal(result.observedMissingRows, 0);
  assert.deepEqual(result.largestMonth, {month: 1, point: '2.00'});
  assert.deepEqual(forecast, before);
  for (const series of ['A', 'H']) assert.equal(cForecastDecision(forecast, series).observed2025Annual, '12.00');
});

test('partial, null and duplicate observed months never become a complete annual', () => {
  for (const mutate of [
    f => {f.observed2025 = f.observed2025.filter(row => row.series !== 'TOT' || row.month !== '2025-12');},
    f => {Object.assign(f.observed2025[0], {value: null, rowsValued: 0, rowsMissing: 2});},
    f => {Object.assign(f.observed2025[0], {rowsSource: 0, rowsValued: 0});},
    f => {f.observed2025[0].month = '2025-02';},
    f => {f.observed2025[0].month = '2024-01';},
  ]) {
    const forecast = fixture(); mutate(forecast);
    const result = cForecastDecision(forecast, 'TOT');
    assert.notEqual(result, null);
    assert.equal(result.observed2025Annual, null);
    assert.equal(result.delta, null);
    assert.equal(result.changePct, null);
  }
});

test('missing source rows retain the defined observed valued subtotal with its explicit coverage flag', () => {
  const forecast = fixture();
  Object.assign(forecast.observed2025[0], {rowsValued: 1, rowsMissing: 1, blankShareFlagged: true});
  const result = cForecastDecision(forecast, 'TOT');
  assert.equal(result.observed2025Annual, '12.00');
  assert.equal(result.delta, null);
  assert.equal(result.changePct, null);
  assert.deepEqual(result.largestMonth, {month: 1, point: '2.00'});
  assert.equal(result.observedHasMissingRows, true);
  assert.equal(result.observedMissingRows, 1);
  // A carried provisional flag remains visible even when its row count is zero.
  Object.assign(forecast.observed2025[0], {rowsValued: 2, rowsMissing: 0});
  const flagged = cForecastDecision(forecast, 'TOT');
  assert.equal(flagged.observedHasMissingRows, true);
  assert.equal(flagged.delta, null);
  assert.equal(flagged.changePct, null);
});

test('zero is a known observed year; non-positive denominator suppresses percentage only', () => {
  for (const [value, observed, delta] of [['0.00', '0.00', '24.00'], ['-1.00', '-12.00', '36.00']]) {
    const forecast = fixture();
    for (const row of forecast.observed2025) row.value = value;
    const result = cForecastDecision(forecast, 'TOT');
    assert.equal(result.observed2025Annual, observed);
    assert.equal(result.delta, delta);
    assert.equal(result.changePct, null);
  }
});

test('cent arithmetic remains exact at large amounts and month ties pick the earliest, not input order', () => {
  const forecast = fixture();
  for (const row of forecast.observed2025) row.value = '9999999999999.99';
  forecast.annual.find(row => row.series === 'TOT').total = '9999999999999.98';
  const result = cForecastDecision(forecast, 'TOT');
  assert.equal(result.observed2025Annual, '119999999999999.88');
  assert.equal(result.delta, '-109999999999999.90');
  assert.equal(result.changePct, '-91.67');
  forecast.monthly.reverse();
  for (const row of forecast.monthly) row.point = row.month.endsWith('-03') || row.month.endsWith('-09') ? '2.02' : '2.01';
  assert.deepEqual(cForecastDecision(forecast, 'TOT').largestMonth, {month: 3, point: '2.02'});
});

test('exact percentage rounds signed half-cents away from zero without mutating point values', () => {
  const forecast = fixture();
  for (const row of forecast.observed2025) row.value = '0.08';
  forecast.annual.find(row => row.series === 'TOT').total = '1.00';
  assert.equal(cForecastDecision(forecast, 'TOT').changePct, '4.17');
  forecast.annual.find(row => row.series === 'TOT').total = '0.92';
  assert.equal(cForecastDecision(forecast, 'TOT').changePct, '-4.17');
  for (const row of forecast.observed2025) row.value = '0';
  forecast.observed2025[0].value = '200';
  forecast.annual.find(row => row.series === 'TOT').total = '200.01';
  assert.equal(cForecastDecision(forecast, 'TOT').changePct, '0.01');
  forecast.annual.find(row => row.series === 'TOT').total = '199.99';
  assert.equal(cForecastDecision(forecast, 'TOT').changePct, '-0.01');
});

test('unadmitted, unsupported, missing-annual and incomplete forecast series produce no summary', () => {
  for (const mutate of [
    f => {f.admission.find(row => row.series === 'TOT').decision = 'RIFIUTATA';},
    f => {f.admission = f.admission.filter(row => row.series !== 'TOT');},
    f => {f.annual = f.annual.filter(row => row.series !== 'TOT');},
    f => {f.monthly = f.monthly.filter(row => row.series !== 'TOT' || row.month !== '2026-12');},
    f => {f.monthly.find(row => row.series === 'TOT').month = '2026-02';},
  ]) {const forecast = fixture(); mutate(forecast); assert.equal(cForecastDecision(forecast, 'TOT'), null);}
  assert.equal(cForecastDecision(fixture(), 'C'), null);
  assert.equal(cForecastDecision(fixture(), 'unknown'), null);
});

test('invalid cent precision fails loudly rather than silently changing financial values', () => {
  for (const target of ['observed', 'annual', 'monthly']) {
    const forecast = fixture();
    if (target === 'observed') forecast.observed2025[0].value = '1.001';
    if (target === 'annual') forecast.annual[0].total = '1.001';
    if (target === 'monthly') forecast.monthly[0].point = '1.001';
    assert.throws(() => cForecastDecision(forecast, 'TOT'), /PILLAR_C_FORECAST_DECISION_MONEY/);
  }
});
