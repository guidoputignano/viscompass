import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, mkdir, writeFile, rm} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import {parseCReviewPacket, selectCReview, cMoneyLabel, cMoneyDifference, cReviewFilters, cReviewSearch, DEFAULT_C_REVIEW, C_COMPONENT_LABELS} from '../lib/dashboard-review/pillar-c/review.ts';
import {loadCReviewPacket} from '../lib/dashboard-review/pillar-c/review-loader.ts';
import {cReviewFixture} from './fixtures/pillar-c-review.mjs';

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

test('unrelated fields and future forecast results cannot leak into the parsed RSC payload', () => {
  const input = cReviewFixture(); input.secret = 'private-token'; input.forecasts = [{point: 999}];
  input.monthly[0].real_organization_name = 'unapproved label';
  const text = JSON.stringify(parseCReviewPacket(input));
  for (const forbidden of ['private-token', 'unapproved label', 'forecasts']) assert.equal(text.includes(forbidden), false);
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
