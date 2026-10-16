import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, mkdir, writeFile, rm} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import fs from 'node:fs';
import {parseCReviewPacket, selectCReview, selectCForecast, cMoneyLabel, cMoneyDifference, cReviewFilters, cReviewSearch, DEFAULT_C_REVIEW, C_COMPONENT_LABELS, C_FORECAST_LABEL} from '../lib/dashboard-review/pillar-c/review.ts';
import {loadCReviewPacket} from '../lib/dashboard-review/pillar-c/review-loader.ts';
import {C_REVIEW_STORAGE} from '../lib/dashboard-review/pillar-c/review-storage.ts';
import {cReviewFixture, cReviewV2Fixture, C_FORECAST_LABEL as FIXTURE_LABEL} from './fixtures/pillar-c-review.mjs';

test('strict project-review schema admits the invented complete fixture, without promotion', () => {
  const packet = parseCReviewPacket(cReviewFixture());
  assert.equal(packet.state, 'review_only');
  assert.equal(packet.monthly.length, 348);
  assert.equal(packet.baseline.length, 80);
  assert.equal(packet.bridges.length, 160);
  assert.match(C_COMPONENT_LABELS['B-N'], /non AIC/);
});

test('financial display rounds exact decimals, including negative and large half-cent boundaries', () => {
  for (const [input, expected] of [['1.005', '1,01\u00a0€'], ['-1.005', '-1,01\u00a0€'], ['1234567890123.005', '1.234.567.890.123,01\u00a0€'], ['0', '0,00\u00a0€'], ['-0.004', '0,00\u00a0€'], ['-0.005', '-0,01\u00a0€']]) assert.equal(cMoneyLabel(input), expected);
  assert.equal(cMoneyLabel(null), 'Non disponibile');
  assert.equal(cMoneyDifference('1000000000000.005', '1000000000000'), '0.005');
  assert.equal(cMoneyLabel(cMoneyDifference('1000000000000.005', '1000000000000')), '0,01\u00a0€');
});

test('every analytical section requires its precise pending output, source, method and receipt contract', () => {
  for (const mutate of [
    p => {p.lineage = [];}, p => {p.lineage[0].acceptance = 'accepted';},
    p => {p.lineage[0].verification = 'independent_v2_pass';},
    p => {p.lineage[0].outputIds = ['ALL_WORKBOOK'];},
    p => {p.lineage[2].claim = 'observed_clinical_actual';},
    p => {p.lineage[0].sourceHashes = [];}, p => {p.lineage[0].methodHashes = ['unknown'];},
    p => {p.lineage[0].receiptSha256 = '0'.repeat(64);},
    p => {p.lineage[0].workbookRanges = ['C:/private.xlsx'];},
  ]) {const p = cReviewFixture(); mutate(p); assert.throws(() => parseCReviewPacket(p), /PILLAR_C_PACKET_/);}
});

test('publication state, digest, empty evidence, malformed units and category mutations fail', () => {
  const mutations = [
    p => {p.state = 'accepted';}, p => {p.workbookSha256 = '';}, p => {p.evidence.financial = 'PASS';},
    p => {p.monthly = [];}, p => {p.monthly[0].org = 'outside';}, p => {p.monthly[0].channel = 'PACKS';},
    p => {p.monthly[0].net = '1e3';}, p => {p.monthly[0].net = Infinity;}, p => {p.monthly[0].rows = -1;},
    p => {p.monthly[0].month = 0;}, p => {p.monthly.at(-1).month = 6;},
    p => {p.budgets[0].area = 'NON_ATTRIBUITO';}, p => {p.budgets[0].org = 'AQ';},
    p => {p.counts[0].persons = '0';}, p => {p.counts.at(-1).perPerson = '0';},
  ];
  for (const mutate of mutations) {const p = cReviewFixture(); mutate(p); assert.throws(() => parseCReviewPacket(p), /PILLAR_C_PACKET_/);}
});

test('actual exact comparison detects cent, row, membership and bridge mutations', () => {
  for (const mutate of [
    p => {p.monthly[0].positive = '999';},
    p => {p.monthly[0].net = '1.01'; p.monthly[0].positive = '1.01';},
    p => {p.monthly[0].rows += 1;},
    p => {p.bridges[0].value = String(Number(p.bridges[0].value) + 1);},
    p => {p.bridges.splice(0, 1);},
    p => {p.monthly.push(structuredClone(p.monthly[0]));},
  ]) {const packet = cReviewFixture(); mutate(packet); assert.throws(() => parseCReviewPacket(packet), /PILLAR_C_PACKET_/);}
});

test('forecast fields reach the RSC payload only through the validated forecast section; unknown fields never do', () => {
  // v1 (the R4 shape): unknown fields, including forecast-like ones, are dropped and no forecast appears.
  const input = cReviewFixture(); input.secret = 'private-token'; input.forecasts = [{point: 999}];
  input.monthly[0].real_organization_name = 'unapproved label';
  const parsedV1 = parseCReviewPacket(input), text = JSON.stringify(parsedV1);
  for (const forbidden of ['private-token', 'unapproved label', 'forecasts', '999']) assert.equal(text.includes(forbidden), false);
  assert.equal('forecast' in parsedV1, false);
  // v2: the forecast section passes with exactly its allow-listed keys, at every level.
  const parsed = parseCReviewPacket(cReviewV2Fixture()), f = parsed.forecast;
  const sorted = (o) => Object.keys(o).sort();
  assert.deepEqual(sorted(f), ['admission', 'annual', 'labels', 'monthly', 'observed2025', 'region', 'scope']);
  assert.deepEqual(sorted(f.monthly[0]), ['high80', 'high95', 'low80', 'low95', 'month', 'point', 'series', 'sigma']);
  assert.deepEqual(sorted(f.annual[0]), ['high80', 'high95', 'low80', 'low95', 'monthlyPointsSum', 'series', 'sigma', 'total']);
  assert.deepEqual(sorted(f.observed2025[0]), ['blankShareFlagged', 'month', 'rowsMissing', 'rowsSource', 'rowsValued', 'series', 'value']);
  assert.deepEqual(sorted(f.admission[0]), ['decision', 'label', 'model', 'registeredReasons', 'rejection', 'series', 'variants']);
  assert.deepEqual(sorted(f.admission[0].variants[0]), ['bestBaseline', 'candidates', 'maseBaseline', 'variant', 'winkler80Baseline']);
  assert.deepEqual(sorted(f.admission[0].variants[0].candidates[0]), ['admitted', 'candidate', 'coverage80', 'coverage95', 'failedConditions', 'mase', 'maseRatio', 'maseThreshold', 'winkler80']);
  assert.deepEqual(sorted(parsed.lineage[4]), ['acceptance', 'checkedFields', 'claim', 'crossSystemReceiptSha256', 'methodHashes', 'numericState', 'outputIds', 'receiptSha256', 'section', 'sourceHashes', 'verification', 'workbookRanges', 'workbookSha256']);
  assert.equal(f.monthly.some(r => r.series === 'C') || f.annual.some(r => r.series === 'C'), false, 'C carries no forecast row');
  // v2 is closed: an unknown field anywhere fails loudly instead of being silently dropped.
  for (const mutate of [
    p => {p.accepted = true;}, p => {p.secret = 'private-token';}, p => {p.evidence.extra = 'a'.repeat(64);},
    p => {p.lineage[4].approvedBy = 'reviewer';}, p => {p.monthly[0].real_organization_name = 'unapproved label';}, p => {p.counts[0].extra = '1';},
    p => {p.forecast.monthly[0].covariance = [[1]];}, p => {p.forecast.annual[0].covariance = [[1]];}, p => {p.forecast.etsForecast = [];},
    p => {p.forecast.admission[3].rejection.point = '1';}, p => {p.forecast.labels.extra = 'x';}, p => {p.forecast.labels.models.NAIVE = 'x';},
    p => {p.forecast.observed2025[0].organization = 'x';}, p => {p.forecast.admission[0].variants[0].candidates[0].parameters = '1';},
  ]) {const p = cReviewV2Fixture(); mutate(p); assert.throws(() => parseCReviewPacket(p), /PILLAR_C_PACKET_UNKNOWN_FIELD/);}
});

test('v2 admits the invented forecast fixture exactly; v1 R4-shaped packets still parse, with or without a valid forecast', () => {
  const input = cReviewV2Fixture(), packet = parseCReviewPacket(input);
  assert.equal(packet.schema, 'pillar-c-review-v2'); assert.equal(packet.state, 'review_only');
  assert.deepEqual(packet.forecast, input.forecast, 'every carried value survives byte-for-byte');
  assert.equal(packet.lineage.length, 5); assert.equal(packet.lineage[4].acceptance, 'pending');
  assert.equal(packet.evidence.forecast, 'f'.repeat(64));
  assert.equal(C_FORECAST_LABEL, FIXTURE_LABEL);
  assert.deepEqual(packet.forecast.admission.map(a => `${a.series}:${a.decision}`), ['TOT:AMMESSA', 'A:AMMESSA', 'H:AMMESSA', 'C:RIFIUTATA']);
  // R4 shape: four sections, no forecast, still accepted on the local-file path.
  const v1 = parseCReviewPacket(cReviewFixture());
  assert.equal(v1.schema, 'pillar-c-review-v1'); assert.equal(v1.lineage.length, 4); assert.equal(v1.forecast, undefined);
  // The forecast section is optional in v1, never unvalidated: with it come its lineage row and receipt.
  const withForecast = cReviewV2Fixture(); withForecast.schema = 'pillar-c-review-v1';
  assert.deepEqual(parseCReviewPacket(withForecast).forecast, input.forecast);
  const brokenV1 = cReviewV2Fixture(); brokenV1.schema = 'pillar-c-review-v1'; brokenV1.forecast.monthly[0].low95 = '999';
  assert.throws(() => parseCReviewPacket(brokenV1), /PILLAR_C_PACKET_FORECAST_BOUNDS/);
  const orphan = cReviewV2Fixture(); orphan.schema = 'pillar-c-review-v1'; orphan.lineage.pop();
  assert.throws(() => parseCReviewPacket(orphan), /PILLAR_C_PACKET_SECTION_LINEAGE/);
});

// The exact error code, never a prefix: a case for «FORECAST_ANNUAL» must not pass on «FORECAST_ANNUAL_SUM».
const rejects = (packet, reason, label) => assert.throws(() => parseCReviewPacket(packet), {name: 'Error', message: `PILLAR_C_PACKET_${reason}`}, label);
// A candidate that meets every registered condition decidable from the fixture's carried values.
const PASSING = {admitted: true, failedConditions: [], mase: '0.5', maseThreshold: '0.9', maseRatio: '0.5', coverage80: '0.8', coverage95: '0.95', winkler80: '8'};
// Admission indexes: series 0 TOT, 1 A, 2 H, 3 C; variant 0 primaria, 1 sensibilita_2020; candidate 0 ETS, 1 ARIMA.
// The fixture shares candidate objects between variants, so a patch replaces one candidate in one variant only.
const setCandidate = (p, series, variant, candidate, patch) => {const v = p.forecast.admission[series].variants[variant]; v.candidates[candidate] = {...v.candidates[candidate], ...patch};};

test('forecast mutations fail: schema, state, bounds, annual sum, rejected C, months, labels, claims, receipts and admission', () => {
  const cases = [
    // schema and state
    [p => {p.schema = 'pillar-c-review-v3';}, 'STATE'], [p => {p.state = 'accepted';}, 'STATE'],
    [p => {delete p.forecast;}, 'FORECAST_REQUIRED'], [p => {p.lineage.pop();}, 'SECTION_LINEAGE'],
    [p => {p.forecast.scope = 'azienda_forecast';}, 'FORECAST_SCOPE'], [p => {p.forecast.region = 'Italia';}, 'FORECAST_SCOPE'],
    // bound order, via exact scaled comparison (a cent is enough)
    [p => {p.forecast.monthly[0].low80 = p.forecast.monthly[0].low95; p.forecast.monthly[0].low95 = (Number(p.forecast.monthly[0].low80) + 0.01).toFixed(2);}, 'FORECAST_BOUNDS'],
    [p => {p.forecast.monthly[5].high80 = (Number(p.forecast.monthly[5].high95) + 0.01).toFixed(2);}, 'FORECAST_BOUNDS'],
    [p => {p.forecast.monthly[7].point = (Number(p.forecast.monthly[7].high80) + 0.01).toFixed(2);}, 'FORECAST_BOUNDS'],
    [p => {p.forecast.annual[1].low80 = (Number(p.forecast.annual[1].total) + 0.01).toFixed(2);}, 'FORECAST_BOUNDS'],
    [p => {p.forecast.monthly[0].sigma = '0';}, 'FORECAST_SIGMA'],
    // annual total versus the twelve monthly points
    [p => {p.forecast.annual[0].monthlyPointsSum = (Number(p.forecast.annual[0].monthlyPointsSum) + 0.01).toFixed(2);}, 'FORECAST_ANNUAL_SUM'],
    [p => {p.forecast.annual[0].total = (Number(p.forecast.annual[0].total) + 0.07).toFixed(2); p.forecast.annual[0].high80 = '99999'; p.forecast.annual[0].high95 = '99999';}, 'FORECAST_ANNUAL_SUM'],
    [p => {p.forecast.monthly[0].point = (Number(p.forecast.monthly[0].point) + 0.01).toFixed(2);}, 'FORECAST_ANNUAL_SUM'],
    [p => {p.forecast.annual.pop();}, 'FORECAST_ANNUAL'],
    // class C is rejected: no forecast row of any kind, never admitted
    [p => {p.forecast.monthly[35] = {...p.forecast.monthly[35], series: 'C'};}, 'FORECAST_REJECTED_SERIES'],
    [p => {p.forecast.annual[2] = {...p.forecast.annual[2], series: 'C'};}, 'FORECAST_REJECTED_SERIES'],
    [p => {Object.assign(p.forecast.admission[3], {decision: 'AMMESSA', model: 'ARIMA_011_011_12', rejection: null});}, 'FORECAST_DECISION'],
    // C stays rejected even when every C candidate passes and the row caps are free: TOT is rejected
    // (consistently, its candidates fail a condition) and its monthly, annual and observed rows are relabelled C.
    [p => {
      const f = p.forecast;
      for (const v of f.admission[3].variants) v.candidates = v.candidates.map(c => ({...c, ...PASSING}));
      Object.assign(f.admission[3], {decision: 'AMMESSA', model: 'ARIMA_011_011_12', rejection: null});
      for (const v of f.admission[0].variants) v.candidates = v.candidates.map(c => ({...c, admitted: false, failedConditions: ['a_origini']}));
      Object.assign(f.admission[0], {decision: 'RIFIUTATA', model: null, registeredReasons: ['Rifiuto di prova'], rejection: {reason: 'Motivo di prova', fallback: 'Esito di prova'}});
      for (const rows of [f.monthly, f.annual, f.observed2025]) for (const r of rows) if (r.series === 'TOT') r.series = 'C';
    }, 'FORECAST_DECISION'],
    [p => {p.forecast.admission[3].rejection = null;}, 'OBJECT'],
    // row caps: at most 12 monthly rows and one annual row for each of the three selectable series
    [p => {p.forecast.monthly.push({...p.forecast.monthly[0], series: 'C'});}, 'ROWS'],
    [p => {p.forecast.annual.push({...p.forecast.annual[0], series: 'C'});}, 'ROWS'],
    // admitted series carry exactly twelve months of 2026, in order
    [p => {p.forecast.monthly = p.forecast.monthly.filter(r => !(r.series === 'A' && r.month === '2026-06'));}, 'FORECAST_MONTHS'],
    [p => {const i = p.forecast.monthly.findIndex(r => r.series === 'H'); [p.forecast.monthly[i], p.forecast.monthly[i + 1]] = [p.forecast.monthly[i + 1], p.forecast.monthly[i]];}, 'FORECAST_MONTHS'],
    [p => {p.forecast.monthly[11].month = '2027-01';}, 'PERIOD'], [p => {p.forecast.monthly[1] = structuredClone(p.forecast.monthly[0]);}, 'DUPLICATE'],
    [p => {p.forecast.observed2025 = p.forecast.observed2025.filter(r => r.series !== 'H');}, 'OBSERVED_MONTHS'],
    // missing is never zero; units are cent strings
    [p => {const r = p.forecast.observed2025.find(o => o.value === null); r.value = '0';}, 'OBSERVED_COVERAGE'],
    [p => {p.forecast.observed2025[0].value = null;}, 'OBSERVED_COVERAGE'],
    [p => {p.forecast.observed2025[0].rowsMissing += 1;}, 'OBSERVED_COVERAGE'],
    [p => {p.forecast.monthly[0].point = 101;}, 'MONEY'], [p => {p.forecast.monthly[0].point = '101.005';}, 'MONEY'],
    // fixed label, pending state, licence, copy
    [p => {p.forecast.labels.forecast = 'Fonte pubblica · AIFA (CC BY 4.0) · previsione aziendale';}, 'FORECAST_LABEL'],
    [p => {p.forecast.labels.tierState = 'VERIFICATO';}, 'TEXT'], [p => {p.forecast.labels.tierState = 'ACCETTATO';}, 'FORECAST_LABEL'],
    [p => {p.forecast.labels.licence = 'Tutti i diritti riservati';}, 'FORECAST_LABEL'],
    [p => {p.forecast.labels.note = 'Dato verificato';}, 'TEXT'], [p => {p.forecast.labels.reading = 'Versione demo';}, 'TEXT'],
    [p => {p.forecast.labels.amendments = ['ML-A15'];}, 'FORECAST_AMENDMENTS'],
    [p => {p.forecast.admission[0].label = 'Altra serie';}, 'FORECAST_LABEL'],
    // lineage claim, state, receipts
    [p => {p.lineage[4].claim = 'reported_spend';}, 'SECTION_STATE'], [p => {p.lineage[4].claim = 'azienda_forecast';}, 'SECTION_STATE'],
    [p => {p.lineage[4].numericState = 'scoped_pass';}, 'SECTION_STATE'], [p => {p.lineage[4].verification = 'implementation_separated_not_formal_v2';}, 'SECTION_STATE'],
    [p => {p.lineage[4].acceptance = 'accepted';}, 'SECTION_STATE'], [p => {p.lineage[0].numericState = 'cross_system_pass';}, 'SECTION_STATE'],
    [p => {p.lineage[4].outputIds = ['ML-5-ADM', 'ML-5-FCX'];}, 'OUTPUT_IDS'],
    [p => {p.lineage[4].receiptSha256 = p.evidence.financial;}, 'SECTION_RECEIPT'], [p => {p.evidence.forecast = p.evidence.financial;}, 'SECTION_RECEIPT'],
    [p => {p.lineage[4].crossSystemReceiptSha256 = p.evidence.financialR5Review;}, 'SECTION_RECEIPT'],
    [p => {p.lineage[0].crossSystemReceiptSha256 = p.evidence.budgetCountR5Review;}, 'SECTION_RECEIPT'],
    [p => {p.lineage[2].workbookSha256 = 'b'.repeat(64);}, 'WORKBOOK_HASH'], [p => {p.evidence.forecastInputs = 'PASS';}, 'RECEIPT'],
    // admission consistency with the registered conditions and the registered model
    [p => {p.forecast.admission[0].model = 'ETS_AAA';}, 'FORECAST_DECISION'],
    [p => {const c = p.forecast.admission[2].variants[0].candidates[0]; c.admitted = true; c.failedConditions = [];}, 'FORECAST_CONDITION'],
    [p => {p.forecast.admission[0].variants[0].candidates[1].admitted = false;}, 'FORECAST_ADMISSION'],
    [p => {p.forecast.admission[0].variants[0].candidates[1].coverage80 = '0.95';}, 'FORECAST_CONDITION'],
    [p => {p.forecast.admission[3].variants[0].candidates[1].failedConditions = ['b_mase', 'unregistered'];}, 'CATEGORY'],
    [p => {p.forecast.admission[0].variants.pop();}, 'ROWS'], [p => {p.forecast.admission.pop();}, 'ROWS'],
    // every registered admission check on its own: an admitted series needs its model admitted in EVERY variant
    [p => setCandidate(p, 0, 1, 1, {admitted: false, failedConditions: ['a_origini']}), 'FORECAST_DECISION'],
    // a flagged condition must be one the carried values fail (TOT ETS primaria: MASE 0.5 <= 0.9, coverage 0.8, Winkler 8 <= 10)
    [p => setCandidate(p, 0, 0, 0, {admitted: false, failedConditions: ['b_mase']}), 'FORECAST_CONDITION'],
    [p => setCandidate(p, 0, 0, 0, {admitted: false, failedConditions: ['c_copertura80']}), 'FORECAST_CONDITION'],
    [p => setCandidate(p, 0, 0, 0, {admitted: false, failedConditions: ['d_winkler']}), 'FORECAST_CONDITION'],
    // and a condition the carried values fail must be flagged
    [p => setCandidate(p, 0, 0, 0, {mase: '0.9000000001'}), 'FORECAST_CONDITION'],
    [p => setCandidate(p, 0, 0, 0, {winkler80: '10.000001'}), 'FORECAST_CONDITION'],
    // metrics are non-negative and coverages are shares
    [p => setCandidate(p, 0, 0, 0, {mase: '-0.5'}), 'FORECAST_METRIC'],
    [p => {p.forecast.admission[0].variants[0].winkler80Baseline = '-10';}, 'FORECAST_METRIC'],
    [p => setCandidate(p, 0, 0, 0, {coverage95: '1.5'}), 'FORECAST_METRIC'],
    [p => setCandidate(p, 0, 0, 0, {coverage80: '1.0000000001', admitted: false, failedConditions: ['c_copertura80']}), 'FORECAST_METRIC'],
  ];
  for (const [mutate, reason] of cases) {const p = cReviewV2Fixture(); mutate(p); rejects(p, reason, mutate.toString());}
});

test('admission bounds are inclusive, as registered: coverage80 0.70 and 0.90, MASE at its threshold, Winkler at its baseline, coverage 1', () => {
  const p = cReviewV2Fixture();
  setCandidate(p, 0, 0, 0, {coverage80: '0.70', coverage95: '1'});
  setCandidate(p, 0, 0, 1, {coverage80: '0.90', mase: '0.9'});
  setCandidate(p, 0, 1, 0, {coverage80: '0.7000000000', winkler80: '10'});
  setCandidate(p, 0, 1, 1, {coverage80: '0.9000000000', winkler80: '10.000000', coverage95: '1.0000000000'});
  const admission = parseCReviewPacket(p).forecast.admission[0];
  assert.equal(admission.decision, 'AMMESSA');
  assert.ok(admission.variants.every(v => v.candidates.every(c => c.admitted && c.failedConditions.length === 0)));
  // One step past each bound fails, unless the condition is flagged.
  for (const [patch, reason] of [[{coverage80: '0.6999999999'}, 'FORECAST_CONDITION'], [{coverage80: '0.9000000001'}, 'FORECAST_CONDITION'], [{mase: '0.9000000001'}, 'FORECAST_CONDITION'], [{winkler80: '10.000001'}, 'FORECAST_CONDITION'], [{coverage95: '1.0000000001'}, 'FORECAST_METRIC']]) {
    const q = cReviewV2Fixture(); setCandidate(q, 0, 0, 1, patch); rejects(q, reason, JSON.stringify(patch));
  }
  const flagged = cReviewV2Fixture(); setCandidate(flagged, 1, 0, 0, {coverage80: '0.6999999999', admitted: false, failedConditions: ['c_copertura80']});
  assert.equal(parseCReviewPacket(flagged).forecast.admission[1].decision, 'AMMESSA', 'a failed ETS alternative does not affect the admitted ARIMA series');
});

test('v2 requires every evidence pin and every lineage key; a cross-system state always carries its receipt', () => {
  for (const key of ['financialR5Review', 'budgetCountR5Review', 'forecast', 'forecastInputs', 'forecastWorkbookIntegration']) {
    const p = cReviewV2Fixture(); delete p.evidence[key]; rejects(p, 'MISSING_FIELD', `evidence.${key}`);
  }
  for (const key of ['crossSystemReceiptSha256', 'workbookSha256']) for (let i = 0; i < 5; i++) {
    const p = cReviewV2Fixture(); delete p.lineage[i][key]; rejects(p, 'MISSING_FIELD', `lineage[${i}].${key}`);
  }
  // v1 keeps the R5 pins optional: the R4 shape carries none of them.
  const r4 = parseCReviewPacket(cReviewFixture());
  assert.equal(r4.lineage.some(r => 'crossSystemReceiptSha256' in r || 'workbookSha256' in r), false);
  assert.deepEqual(Object.keys(r4.evidence).sort(), ['budgetCount', 'financial']);
  const scopedOnly = cReviewV2Fixture(); scopedOnly.schema = 'pillar-c-review-v1';
  for (const r of scopedOnly.lineage.slice(0, 4)) {delete r.crossSystemReceiptSha256; delete r.workbookSha256;}
  for (const key of ['financialR5Review', 'budgetCountR5Review', 'forecastInputs']) delete scopedOnly.evidence[key];
  assert.equal(parseCReviewPacket(scopedOnly).lineage.length, 5);
  // In v1 too, the forecast row's cross-system state needs its receipt, and every receipt must resolve.
  const unbacked = cReviewV2Fixture(); unbacked.schema = 'pillar-c-review-v1'; delete unbacked.lineage[4].crossSystemReceiptSha256;
  rejects(unbacked, 'MISSING_FIELD', 'v1 forecast row without its cross-system receipt');
  for (const key of ['forecast', 'forecastWorkbookIntegration']) {
    const p = cReviewV2Fixture(); p.schema = 'pillar-c-review-v1'; delete p.evidence[key]; rejects(p, 'SECTION_RECEIPT', `v1 without evidence.${key}`);
  }
});

test('the forecast selector keeps the twelve exact months, the 2025 context and the rounding note, per series', () => {
  const {forecast} = parseCReviewPacket(cReviewV2Fixture());
  for (const series of ['TOT', 'A', 'H']) {
    const view = selectCForecast(forecast, series);
    assert.equal(view.admission.decision, 'AMMESSA');
    assert.deepEqual(view.rows.map(r => r.month), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    assert.ok(view.rows.every(r => r.forecast.series === series && r.observed.series === series));
    assert.deepEqual(view.chart.map(r => r.key), [...Array.from({length: 12}, (_, i) => `2025-${String(i + 1).padStart(2, '0')}`), ...Array.from({length: 12}, (_, i) => `2026-${String(i + 1).padStart(2, '0')}`)]);
    assert.ok(view.chart.slice(0, 12).every(r => r.point === null && r.band80 === null), 'no forecast drawn over 2025');
    assert.ok(view.chart.slice(12).every(r => r.observed === null && r.band95[0] <= r.band80[0] && r.band80[1] <= r.band95[1]));
    assert.equal(view.chart[12].exact.point, view.rows[0].forecast.point, 'exact strings, not re-rounded numbers');
    assert.ok(view.chart.slice(0, 12).every((r, i) => r.rows.valued === view.observed[i].rowsValued && r.rows.source === view.observed[i].rowsSource), 'the 2025 tooltip carries the valued-row counts');
    assert.ok(view.chart.slice(12).every(r => r.rows === null), 'no row counts on forecast months');
  }
  assert.equal(selectCForecast(forecast, 'A').roundingDifference, '0.02');
  assert.equal(selectCForecast(forecast, 'TOT').roundingDifference, '0');
  // A missing observed month stays missing (null) in the chart and the table, never zero.
  const h = selectCForecast(forecast, 'H');
  assert.equal(h.chart[2].observed, null); assert.equal(h.chart[2].exact.observed, null); assert.equal(h.rows[2].observed.value, null);
  assert.equal(cMoneyLabel(h.rows[2].observed.value), 'Non disponibile');
});

test('the forecast series is shareable URL state; C and unknown values fall back to the total; reset and other panels are preserved', () => {
  assert.equal(DEFAULT_C_REVIEW.forecastSeries, 'TOT');
  const search = '?vista=analisi&other=keep&c_comparison=K2&c_count_year=FY2024';
  const updated = cReviewSearch(search, {forecastSeries: 'H'});
  assert.equal(new URLSearchParams(updated).get('c_forecast_series'), 'H');
  const parsed = cReviewFilters(new URLSearchParams(updated));
  assert.equal(parsed.forecastSeries, 'H'); assert.equal(parsed.comparison, 'K2'); assert.equal(parsed.countPeriod, 'FY2024');
  assert.equal(new URLSearchParams(cReviewSearch(updated, {org: 'TE'})).get('c_forecast_series'), 'H', 'a global filter keeps the forecast series');
  assert.equal(cReviewFilters(new URLSearchParams(cReviewSearch(updated, {forecastSeries: 'A'}))).forecastSeries, 'A');
  assert.equal(cReviewSearch('?c_forecast_series=TOT', {}), '', 'the default is not written');
  for (const value of ['C', 'tot', 'ALL', '<script>', '']) assert.equal(cReviewFilters(new URLSearchParams(`c_forecast_series=${value}`)).forecastSeries, 'TOT');
  assert.equal(cReviewSearch(updated, {}, true), '?vista=analisi&other=keep');
  // The forecast does not follow the Azienda/channel filters, and they do not follow it.
  const packet = parseCReviewPacket(cReviewV2Fixture());
  assert.deepEqual(selectCReview(packet, {...DEFAULT_C_REVIEW, forecastSeries: 'H'}), selectCReview(packet, DEFAULT_C_REVIEW));
});

test('production storage pins the immutable R5 object by its own SHA-256; the bucket is unchanged', () => {
  assert.equal(C_REVIEW_STORAGE.bucket, 'pillar-c-review');
  assert.match(C_REVIEW_STORAGE.sha256, /^[a-f0-9]{64}$/);
  assert.equal(C_REVIEW_STORAGE.sha256, 'fd09373fafeb5ef2c9acd1788504bac2c911c7d33a828b956e584f4b820d93df');
  assert.equal(C_REVIEW_STORAGE.object, `r5/${C_REVIEW_STORAGE.sha256}.json`);
});

test('matched periods and negative/zero/missing values survive all org/channel/period selections', () => {
  const packet = parseCReviewPacket(cReviewFixture());
  for (const org of ['Regione', 'AQ', 'CH', 'PE', 'TE']) for (const channel of ['Tutti', 'CO', 'DD', 'DPC']) for (const period of ['FY2024', 'FY2025', 'JM2025', 'JM2026']) {
    const data = selectCReview(packet, {...DEFAULT_C_REVIEW, org, channel, period});
    assert.ok(data.baseline);
    assert.equal(data.months.length, period.startsWith('JM') ? 5 : 12);
    assert.equal(data.months.reduce((s, r) => s + r.amount, 0), Number(data.baseline.net));
    const cumulative = selectCReview(packet, {...DEFAULT_C_REVIEW, org, channel, period, trend: 'cumulative'});
    assert.equal(cumulative.months.at(-1).amount, Number(data.baseline.net));
  }
  const negative = selectCReview(packet, {...DEFAULT_C_REVIEW, org: 'AQ', channel: 'CO'});
  assert.equal(negative.months[1].amount, -5);
  const missing = structuredClone(packet); missing.monthly = missing.monthly.filter(r => !(r.org === 'AQ' && r.channel === 'CO' && r.year === 2025 && r.month === 3));
  const view = selectCReview(missing, {...DEFAULT_C_REVIEW, org: 'AQ', channel: 'CO', trend: 'cumulative'});
  assert.equal(view.months[2].amount, null); assert.equal(view.months[11].amount, null);
});

test('budget scopes never silently sum levels or Aziendas; missing actual is not zero', () => {
  const packet = parseCReviewPacket(cReviewFixture());
  assert.equal(selectCReview(packet, DEFAULT_C_REVIEW).budgets.length, 0);
  const own = {...DEFAULT_C_REVIEW, org: 'TE', channel: 'CO', budgetPeriod: 'FY2024'};
  assert.equal(selectCReview(packet, own).budgets[0].actual, '0');
  assert.equal(selectCReview(packet, {...own, channel: 'DD'}).budgets[0].actual, null);
  assert.equal(selectCReview(packet, {...own, level: 'Disciplina'}).budgets.length, 0);
});

test('budget period is independent of spending and is restored by the shared URL', () => {
  const packet = parseCReviewPacket(cReviewFixture());
  const filters = {...DEFAULT_C_REVIEW, org: 'TE', channel: 'CO', period: 'JM2026', budgetPeriod: 'FY2024'};
  const view = selectCReview(packet, filters);
  assert.equal(view.baseline.period, 'JM2026');
  assert.equal(view.budgets.length, 1); assert.equal(view.budgets[0].period, 'FY2024');
  const shared = cReviewFilters(new URLSearchParams(cReviewSearch('', filters)));
  assert.equal(shared.period, 'JM2026'); assert.equal(shared.budgetPeriod, 'FY2024');
  assert.equal(selectCReview(packet, {...filters, period: 'FY2025'}).budgets[0].period, 'FY2024');
  assert.equal(cReviewFilters(new URLSearchParams('c_budget_period=FY2026')).budgetPeriod, 'FY2025');
});

test('CO count view is separately year-labelled and does not pool overlapping portfolios', () => {
  const packet = parseCReviewPacket(cReviewFixture());
  const view = selectCReview(packet, {...DEFAULT_C_REVIEW, org: 'AQ', channel: 'DPC', period: 'JM2026'});
  assert.equal(view.counts.length, 1); assert.equal(view.counts[0].period, 'FY2025');
  assert.equal(selectCReview(packet, {...DEFAULT_C_REVIEW, org: 'AQ', portfolio: 'UNKNOWN'}).counts.length, 0);
});

test('URL contract preserves panel options and unrelated parameters; reset is scoped', () => {
  const search = '?vista=analisi&other=keep&c_comparison=K2&c_budget=synthetic&c_count_year=FY2024';
  const updated = cReviewSearch(search, {org: 'TE', period: 'JM2026'});
  const parsed = cReviewFilters(new URLSearchParams(updated));
  assert.equal(parsed.org, 'TE'); assert.equal(parsed.comparison, 'K2'); assert.equal(parsed.budget, 'synthetic'); assert.equal(parsed.countPeriod, 'FY2024');
  assert.equal(new URLSearchParams(updated).get('other'), 'keep');
  assert.equal(cReviewSearch(updated, {}, true), '?vista=analisi&other=keep');
  assert.deepEqual(cReviewFilters(new URLSearchParams('c_org=administrator&c_period=FY2026&c_portfolio=<script>')), DEFAULT_C_REVIEW);
});

test('budget order and selected area survive URL sharing and missing comparisons sort last', () => {
  const p = cReviewFixture(); p.budgets.push({...p.budgets[2], id: 'TEST-SECOND', area: '09', budget: '100', actual: '500', alternative: '510'});
  p.budgets.push({...p.budgets[2], id: 'TEST-NO-ROWS', area: '10', actual: null, alternative: null});
  const packet = parseCReviewPacket(p);
  const filters = {...DEFAULT_C_REVIEW, org: 'AQ', channel: 'CO', budget: 'synthetic', level: 'Disciplina', budgetOrder: 'difference'};
  assert.deepEqual(selectCReview(packet, filters).budgets.map(r => r.area), ['09', '08', '10']);
  const saved = cReviewSearch('', {...filters, area: '08'});
  assert.equal(cReviewFilters(new URLSearchParams(saved)).budgetOrder, 'difference');
  assert.equal(cReviewFilters(new URLSearchParams(saved)).area, '08');
  assert.equal(selectCReview(packet, {...filters, area: '08'}).budgets.length, 1);
  assert.equal(selectCReview(packet, {...filters, area: '9999'}).budgets.length, 0);
});

test('loader rejects non-reviewers before filesystem access and fails closed without configuration', async () => {
  for (const [approved, reviewer] of [[false, false], [false, true], [true, false]]) assert.deepEqual(await loadCReviewPacket(approved, reviewer, {file: '/never-read', sha: 'a'.repeat(64)}), {state: 'forbidden'});
  assert.deepEqual(await loadCReviewPacket(true, true, {}), {state: 'not_configured'});
  assert.deepEqual(await loadCReviewPacket(true, true, {file: 'relative.json', sha: 'a'.repeat(64)}), {state: 'invalid'});
});

test('production storage cannot be read before approved reviewer authorization', async () => {
  let calls = 0;
  const remote = async () => {calls++; throw new Error('must not fetch');};
  for (const [approved, reviewer] of [[false, false], [false, true], [true, false]]) assert.deepEqual(await loadCReviewPacket(approved, reviewer, {}, remote), {state: 'forbidden'});
  assert.equal(calls, 0);
});

test('production storage requires pinned exact bytes and the same strict review schema', async () => {
  const bytes = new TextEncoder().encode(JSON.stringify(cReviewFixture()));
  const sha = createHash('sha256').update(bytes).digest('hex');
  assert.equal((await loadCReviewPacket(true, true, {}, async () => ({state: 'ready', bytes, sha}))).state, 'ready');
  assert.deepEqual(await loadCReviewPacket(true, true, {}, async () => ({state: 'ready', bytes, sha: '0'.repeat(64)})), {state: 'invalid'});
  const v2 = new TextEncoder().encode(JSON.stringify(cReviewV2Fixture())), v2Sha = createHash('sha256').update(v2).digest('hex');
  const loaded = await loadCReviewPacket(true, true, {}, async () => ({state: 'ready', bytes: v2, sha: v2Sha}));
  assert.equal(loaded.state, 'ready'); assert.equal(loaded.packet.forecast.monthly.length, 36);
  const tampered = cReviewV2Fixture(); tampered.forecast.monthly.push({...tampered.forecast.monthly[0], series: 'C'});
  const bad = new TextEncoder().encode(JSON.stringify(tampered));
  assert.deepEqual(await loadCReviewPacket(true, true, {}, async () => ({state: 'ready', bytes: bad, sha: createHash('sha256').update(bad).digest('hex')})), {state: 'invalid'}, 'exact bytes do not excuse an invalid forecast');
  const invalid = new TextEncoder().encode('{}');
  assert.deepEqual(await loadCReviewPacket(true, true, {}, async () => ({state: 'ready', bytes: invalid, sha: createHash('sha256').update(invalid).digest('hex')})), {state: 'invalid'});
  assert.deepEqual(await loadCReviewPacket(true, true, {}, async () => {throw new Error('secret-storage-error');}), {state: 'invalid'});
  assert.deepEqual(await loadCReviewPacket(true, true, {}, async () => ({state: 'not_configured'})), {state: 'not_configured'});
});

test('loader verifies raw bytes and external location; no malformed packet becomes a fixture fallback', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'vis-c-review-'));
  try {
    const file = path.join(dir, 'packet.json'), bytes = JSON.stringify(cReviewFixture());
    await writeFile(file, bytes);
    const sha = createHash('sha256').update(bytes).digest('hex');
    const valid = await loadCReviewPacket(true, true, {file, sha}); assert.equal(valid.state, 'ready');
    assert.deepEqual(await loadCReviewPacket(true, true, {file, sha: '0'.repeat(64)}), {state: 'invalid'});
    await writeFile(file, '{}');
    assert.deepEqual(await loadCReviewPacket(true, true, {file, sha: createHash('sha256').update('{}').digest('hex')}), {state: 'invalid'});
    const inside = path.join(process.cwd(), 'work', 'c-review-loader-test'); await mkdir(inside, {recursive: true});
    const candidate = path.join(inside, 'invented.json');
    try {await writeFile(candidate, bytes); assert.deepEqual(await loadCReviewPacket(true, true, {file: candidate, sha}), {state: 'invalid'});}
    finally {await rm(candidate);}
  } finally {await rm(dir, {recursive: true});}
});

// MACHINE TRANSLATION (see tests/pillar-b-translation-safe.test.mjs): the
// owner reads these pages through Chrome's translation, which replaces React's
// text nodes. Whatever the forecast series selector changes is rendered inside
// SeriesView, a keyed element that is the only child of its wrapper, replaced
// whole on each change; the selector itself sits outside it.
const forecastSource = fs.readFileSync(fileURLToPath(new URL('../components/dashboard-review/pillar-c/forecast-section.tsx', import.meta.url)), 'utf8').replace(/\r\n/g, '\n');

test('forecast panel: SeriesView is the keyed only child of its wrapper, and the tooltip is replaced whole', () => {
  assert.match(forecastSource, /function SeriesView\(\{ series, className, children \}[^)]*\) \{\n\s*return <div><div key=\{series\} className=\{className\}>\{children\}<\/div><\/div>;\n\}/);
  assert.match(forecastSource, /return <div key=\{row\.key\} style=\{tooltipStyle\}/);
});

test('forecast panel: every series-dependent value renders inside SeriesView; the selector and fixed labels sit outside', () => {
  const body = forecastSource.slice(forecastSource.indexOf('export function PillarCForecastPanel('));
  const jsx = body.slice(body.indexOf('  return <div className="space-y-5">'));
  const REGION = /<SeriesView series=\{series\}[^>]*>[\s\S]*?<\/SeriesView>/g;
  const regions = jsx.match(REGION) ?? [];
  assert.equal(regions.length, 2, 'the chart region and the exact table');
  for (const expr of ['eur(annual.total)', 'range(annual.low80, annual.high80)', 'range(annual.low95, annual.high95)', '{axisUnit}', 'data={view.chart}', 'view.rows.map', 'eur(annual.monthlyPointsSum)']) {
    assert.ok(regions.some(r => r.includes(expr)), expr);
  }
  const outside = jsx.replace(REGION, '');
  assert.doesNotMatch(outside, /(?<![.\w])(view|annual|axisUnit|divisor|firstForecast|admitted)\b/,'nothing derived from the series is rendered outside the keyed regions');
  assert.match(outside, /<LocalToggle label="Serie" value=\{series\}/);
  assert.ok(jsx.indexOf('<LocalToggle ') < jsx.indexOf('<SeriesView '), 'the selector is outside (before) the replaced region, so focus stays on it');
  assert.ok(outside.includes('{C_FORECAST_LABEL}') && outside.includes('Non è una previsione di un’Azienda, né un budget o un tetto di spesa.'));
  assert.match(outside, /In revisione · accettazione in attesa/);
  assert.doesNotMatch(forecastSource, /verificat|\bdemo\b|dimostra/i, 'no «Verificato», no demo wording');
});

// FORECAST COPY (review round 1, 15 October 2026). The rendered text is checked
// with the real packet in the private QA harness; these pins keep the copy rules.
// The sources write the no-break space as its escape; NB_SRC is that escape as source text.
const NB_SRC = String.fromCharCode(92) + 'u00a0';
const panelJsx = forecastSource.slice(forecastSource.indexOf('  return <div className="space-y-5">'));

test('forecast copy: the annual total is a supplementary regional forecast that follows the chart, never a headline figure', () => {
  assert.ok(forecastSource.includes('{`Previsione regionale · totale annuo 2026 · ${annualScope}`}'));
  assert.match(forecastSource, /const annualScope = series === "TOT" \? "tutte le classi" : view\.label;/, 'no «Totale … Totale (tutte le classi)»');
  for (const level of ['80', '95']) assert.ok(forecastSource.includes(`Intervallo annuo ${level}${NB_SRC}% · supplementare, non sottoposto a backtest`), `${level} card qualifier`);
  assert.ok(forecastSource.includes('Supplementare, non sottoposto a backtest'));
  assert.ok(panelJsx.indexOf('</figure>') < panelJsx.indexOf('totale annuo 2026'), 'the monthly chart comes first');
  assert.doesNotMatch(panelJsx.slice(panelJsx.indexOf('<article')), /bg-primary\/5 p-4/, 'no accent card inside the panel');
  assert.ok(forecastSource.includes('{`Previsione regionale mensile 2026 e osservato 2025 · ${view.label}`}'), 'table caption says «regionale»');
  assert.match(forecastSource, /<h3 className="text-base font-semibold">Previsione regionale mensile 2026 e osservato 2025<\/h3>/);
});

test('forecast copy: observed 2025 is provisional and sums valued rows only; the forecast is ex ante; nothing implies a class C forecast', () => {
  const outside = panelJsx.replace(/<SeriesView series=\{series\}[^>]*>[\s\S]*?<\/SeriesView>/g, '');
  assert.ok(outside.includes('Osservato 2025 = somma delle sole righe con spesa valorizzata, senza stima delle righe vuote; la previsione 2026 riguarda la stessa base. ${typeset(labels.observedNote)}'), 'the valued-rows note and the packet note (snapshot date, missing never zero) are visible');
  assert.ok(forecastSource.includes('<span>Osservato 2025 (provvisorio)</span>') && forecastSource.includes('"Osservato 2025 (provvisorio)"'), 'legend and table header');
  assert.match(forecastSource, /\["Righe valorizzate", row\.rows \? `\$\{itNumber\(row\.rows\.valued\)\} di \$\{itNumber\(row\.rows\.source\)\}`/, 'the 2025 tooltip gives the valued rows');
  assert.ok(forecastSource.includes('Previsione formulata con dati fino a dicembre 2025; non include dati osservati del 2026.'));
  assert.ok(outside.includes('Classe C non ammessa: nessuna previsione (vedi «Ammissione delle serie»). La differenza fra il totale e le classi A e H non è una previsione della classe C.'));
  assert.ok(outside.indexOf('<LocalToggle ') < outside.indexOf('Classe C non ammessa'), 'the C line sits right after the selector');
});

test('forecast copy: reasons read as conditions not met; the C reason keeps its registered text; reason codes are not rendered', () => {
  assert.doesNotMatch(forecastSource, /registeredReasons/, 'raw codes such as «ETS_AAA · primaria: non superate c_copertura80» never reach the page');
  assert.doesNotMatch(forecastSource, /non superat/);
  assert.match(forecastSource, /return `\$\{conditions\.length > 1 \? "condizioni non soddisfatte" : "condizione non soddisfatta"\}: \$\{conditions\.join\(" · "\)\}`;/);
  assert.match(forecastSource, /if \(a\.decision === "RIFIUTATA"\) return typeset\(`Motivo del rifiuto \(registrato\): \$\{a\.rejection\?\.reason \?\? "non disponibile"\}`\);/);
  assert.ok(panelJsx.includes('{admissionNote(a, labels)}') && !panelJsx.includes('Motivazione: ${admissionNote'), 'no «Motivazione: non ammessa: …»');
  assert.match(forecastSource, /\{`\$\{view\.label\}: nessuna previsione mostrata\.\$\{view\.admission\?\.rejection \?/, 'the fallback does not repeat «non ammessa»');
});

test('forecast copy: the CC BY 4.0 attribution links the licence and the AIFA source page, and names the licence once', () => {
  assert.ok(forecastSource.includes('const LICENCE_URL = "https://creativecommons.org/licenses/by/4.0/deed.it";'));
  assert.ok(forecastSource.includes('const SOURCE_URL = "https://www.aifa.gov.it/it/spesa-e-consumo-relativi-al-flusso-della-farmaceutica-convenzionata-e-degli-acquisti-diretti";'));
  assert.match(panelJsx, /<span>\{labels\.attribution\}<\/span> <a href=\{LICENCE_URL\} target="_blank" rel="license noopener noreferrer" className=\{linkClass\}>Licenza<\/a> · <a href=\{SOURCE_URL\} target="_blank" rel="noopener noreferrer" className=\{linkClass\}>Dati e documentazione AIFA<\/a>/);
  assert.doesNotMatch(panelJsx, /Licenza \$\{labels\.licence\}/, 'the packet attribution already says «CC BY 4.0»');
});

test('forecast copy: a number and its «%» never wrap apart in either component; packet copy is typeset for display only', () => {
  for (const file of ['components/dashboard-review/pillar-c/forecast-section.tsx', 'components/dashboard-review/pillar-c/analytical-workspace.tsx']) {
    const source = fs.readFileSync(fileURLToPath(new URL(`../${file}`, import.meta.url)), 'utf8');
    assert.doesNotMatch(source, /\d %/, `${file}: ordinary space before %`);
    assert.equal(source.includes(String.fromCharCode(0xa0)), false, `${file}: the no-break space is written as its escape, never as an invisible character`);
  }
  assert.ok(forecastSource.includes(`const typeset = (text: string) => text.replace(/(\\d) %/g, "$1${NB_SRC}%");`));
  for (const expr of ['typeset(labels.reading)', 'typeset(labels.observedNote)', 'typeset(detail)', 'typeset(`Valori registrati']) assert.ok(forecastSource.includes(expr), expr);
});

test('forecast chart: band opacities rise on the dark card, the legend reads the same values, and a halo separates the point line', () => {
  assert.ok(forecastSource.includes('const BAND_VARS = "[--fc-band-95:0.14] [--fc-band-80:0.24] [--fc-swatch-80:0.34] dark:[--fc-band-95:0.24] dark:[--fc-band-80:0.28] dark:[--fc-swatch-80:0.45]";'));
  assert.ok(forecastSource.includes('const BAND_FILL = "[&_.fc-band-95_.recharts-area-area]:[fill-opacity:var(--fc-band-95)] [&_.fc-band-80_.recharts-area-area]:[fill-opacity:var(--fc-band-80)]";'));
  assert.ok(panelJsx.includes('<figure aria-labelledby={caption} className={`min-w-0 ${BAND_VARS}`}>') && panelJsx.includes('<div className={`h-72 min-w-0 ${BAND_FILL}`} aria-hidden="true">'));
  assert.ok(panelJsx.includes('opacity-[var(--fc-swatch-80)]') && panelJsx.includes('opacity-[var(--fc-band-95)]'), 'legend swatches follow the chart');
  assert.ok(panelJsx.includes('<Area className="fc-band-95" dataKey="band95"') && panelJsx.includes('<Area className="fc-band-80" dataKey="band80"'));
  const halo = panelJsx.indexOf('<Line dataKey="point" type="linear" stroke="hsl(var(--card))" strokeWidth={4} strokeDasharray="6 4"'), line = panelJsx.indexOf('<Line dataKey="point" type="linear" stroke="var(--viz-1)"');
  assert.ok(halo > 0 && halo < line, 'the halo is drawn first, under the point line');
  assert.match(panelJsx.slice(halo, line), /dot=\{false\} activeDot=\{false\} legendType="none" tooltipType="none"/);
});

// The workspace's own copy that follows a filter. React updates ADJACENT text
// nodes in place, and machine translation has already replaced them, so such a
// text stays stale on screen. It must be a single text child (React rewrites the
// element's content) or a keyed element (replaced whole).
const workspaceSource = fs.readFileSync(fileURLToPath(new URL('../components/dashboard-review/pillar-c/analytical-workspace.tsx', import.meta.url)), 'utf8').replace(/\r\n/g, '\n');

test('workspace: text that follows a filter is one text child or a keyed element, so translation cannot leave it stale', () => {
  for (const expr of [
    '{`${scope}. Periodi e misure sono accanto ai grafici;',
    '{`${scope}. Selezione aggiornata.`}',
    '{`Piano modellato 2025 · ${budgetFilters.org === "Regione" ? "ASL 1" : C_ORG_LABELS[budgetFilters.org]}`}',
    '{`Prime 12 aree nel grafico; tutte le ${budgets.length} aree sono nella tabella.`}',
    '{`${eur(r.perPerson)} / persona nello scenario`}',
    '{`${data.counts.filter((r) => r.state !== "CALCOLATO").length} portafogli senza rapporto disponibile',
    '<span key={copied ? "copied" : "copy"}>{copied ? "Link copiato" : "Copia vista"}</span>',
  ]) assert.ok(workspaceSource.includes(expr), expr);
  // No literal JSX text next to a filter-, data- or state-driven expression inside the same element (same line, outside template literals).
  const DRIVEN = String.raw`\{(?:scope|filters\.|budgets\.length|data\.|copied|eur\(|signed\()[^{}]*\}`;
  const TEXT = String.raw`[^<>{}\`\n]*[^<>{}\`\s][^<>{}\`\n]*`;
  const before = new RegExp(`>${TEXT}${DRIVEN}`), after = new RegExp(`${DRIVEN}${TEXT}<`);
  assert.doesNotMatch(workspaceSource, before);
  assert.doesNotMatch(workspaceSource, after);
});

test('every Pillar C review state stays pending: no page source presents data as «verificato», nothing as a demo', () => {
  for (const file of ['components/dashboard-review/pillar-c/analytical-workspace.tsx', 'components/dashboard-review/pillar-c/forecast-section.tsx', 'components/dashboard-review/pillar-c/section-navigation.tsx', 'app/dashboard-review/pillar-c/page.tsx', 'lib/dashboard-review/pillar-c/section-navigation.ts']) {
    const source = fs.readFileSync(fileURLToPath(new URL(`../${file}`, import.meta.url)), 'utf8');
    assert.doesNotMatch(source, /verificat|\bdemo\b|dimostra/i, file);
  }
});
