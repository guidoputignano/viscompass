import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluatePeriodForecastReadiness as assess} from '../lib/dashboard-review/pillar-c/period-forecast.ts';

// All values, methods and check receipts are synthetic fixtures. These are
// architecture tests, not an approved method or real organizational forecast.
const identity = {sourceFamily:'file-f',unit:'asl-3',mode:'real',amountBasis:'reported-amount'};
const historyHash = 'a'.repeat(64), methodHash = 'b'.repeat(64);
function fixture(count = 36) {
  const history = Array.from({length:count}, (_,i) => {
    const dt = new Date(Date.UTC(2022, i + 1, 0));
    return {...identity,month:dt.toISOString().slice(0,7),value:i % 4 ? 100 + i : 0,observedAt:dt.toISOString().slice(0,10)};
  });
  const passed = {status:'passed',evidenceSha256:'c'.repeat(64)};
  return {...identity,target:'monthly-reported-expenditure',historyFrom:'2022-01',cutoffMonth:history.at(-1)?.month ?? '2022-01',
    asOfDate:'2025-01-01',horizon:3,historySha256:historyHash,history,
    method:{id:'test-method-v1',methodologySha256:methodHash,registeredAt:'2021-12-01',sourceFamily:identity.sourceFamily,
      amountBasis:identity.amountBasis,target:'monthly-reported-expenditure',minTrainingMonths:24,minOrigins:6,maxHorizon:6},
    validation:{methodologySha256:methodHash,historySha256:historyHash,cutoffMonth:history.at(-1)?.month ?? '2022-01',
      checkedAt:'2025-01-01',chronologicalTrainingOnly:true,origins:6,evaluatedHorizon:3,
      baseline:{...passed},backtest:{...passed},uncertainty:{...passed}}};
}
function reason(f, expected) { assert.equal(assess(f).status, 'blocked'); assert.equal(assess(f).reason, expected); }

test('complete history with bound checks is only eligible for candidate review, never admitted or published', () => {
  const input = fixture(), before = structuredClone(input);
  assert.deepEqual(assess(input), {status:'eligible_for_candidate_review',observedMonths:36,expectedMonths:36,missingMonths:0,requiredMonths:32});
  assert.deepEqual(input, before);
  input.history.reverse(); assert.equal(assess(input).status, 'eligible_for_candidate_review');
});
test('one DPC month and twelve File F months are insufficient under an explicitly supplied test method', () => {
  const dpc = fixture(1); dpc.sourceFamily = dpc.method.sourceFamily = 'nsis-dpc'; dpc.history.forEach(p=>p.sourceFamily='nsis-dpc');
  reason(dpc, 'insufficient_history'); reason(fixture(12), 'insufficient_history');
});
test('no approved default method is inferred even from long history', () => {
  const f = fixture(); f.method = null; reason(f, 'method_not_registered');
});
test('zero is observed, whereas null, absent, leading and trailing missing months block', () => {
  const f = fixture(); f.history.forEach(p=>p.value=0);
  assert.equal(assess(f).status,'eligible_for_candidate_review'); assert.equal(assess(f).observedMonths,36);
  for (const mutate of [f=>f.history[1].value=null,f=>f.history.splice(1,1),f=>f.history.shift(),f=>f.history.pop()]) {
    const candidate=fixture();mutate(candidate);reason(candidate,'missing_months');assert.equal(assess(candidate).missingMonths,1);
  }
  f.history.forEach(p=>p.value=null); reason(f,'insufficient_history'); assert.equal(assess(f).observedMonths,0);
});
test('duplicate months, nonfinite values, malformed months and partial cutoff are rejected', () => {
  for (const mutate of [f=>f.history.push({...f.history[0]}),f=>f.history[0].value=NaN,f=>f.history[0].value=Infinity,
    f=>f.history[0].value='0',f=>f.history[0].month='2022-13',f=>f.history[0].month='2022-1',
    f=>f.historyFrom='2025-01',f=>f.asOfDate='2024-12-30',f=>f.history[0].observedAt='2022-02-30']) {
    const f=fixture();mutate(f);reason(f,'invalid_history');
  }
});
test('calendar continuity works across leap February and December/January', () => {
  const f = fixture(); const feb=f.history.find(p=>p.month==='2024-02'); assert.equal(feb.observedAt,'2024-02-29');
  assert.equal(assess(f).status,'eligible_for_candidate_review'); feb.observedAt='2024-02-28'; reason(f,'invalid_history');
});
test('mixed organization, source, amount basis and observed/synthetic histories cannot enter one series', () => {
  for (const [key,value] of [['unit','asl-2'],['sourceFamily','nsis-dpc'],['mode','synthetic'],['amountBasis','service-amount']]) {
    const f=fixture();f.history[0][key]=value;reason(f,'invalid_history');
  }
  const f=fixture(); f.mode='synthetic'; f.history.forEach(p=>p.mode='synthetic');reason(f,'synthetic_only');
});
test('future data, later vintages and evidence checked before its history are rejected', () => {
  for (const mutate of [f=>f.history[0].month='2025-01',f=>f.history[0].observedAt='2025-01-02',
    f=>f.history[0].observedAt='2021-12-31']) {const f=fixture();mutate(f);reason(f,'invalid_history');}
  const f=fixture(); f.history[0].observedAt='2025-01-01';f.validation.checkedAt='2024-12-31';reason(f,'not_admitted');
});
test('method registration is source-, basis-, target- and date-specific, with bounded positive policy', () => {
  for (const mutate of [m=>m.sourceFamily='nsis-dpc',m=>m.amountBasis='service-amount',m=>m.target='patients',
    m=>m.registeredAt='2025-01-02',m=>m.methodologySha256='not-a-hash',m=>m.minOrigins=0,m=>m.minTrainingMonths=-1,
    m=>m.maxHorizon=25,m=>m.id='']) {const f=fixture();mutate(f.method);reason(f,'method_not_registered');}
});
test('target and horizon are bounded and unsupported sources do not borrow AIFA acceptance', () => {
  for (const mutate of [f=>f.horizon=0,f=>f.horizon=-1,f=>f.horizon=1.5,f=>f.horizon=25,
    f=>f.target='recipient-growth',f=>f.sourceFamily='aifa']) {const f=fixture();mutate(f);reason(f,'invalid_history');}
  const f=fixture();f.horizon=7;reason(f,'not_admitted');
});
test('the training window plus each rolling origin and full horizon must fit before cutoff', () => {
  reason(fixture(31),'insufficient_history'); assert.equal(assess(fixture(32)).status,'eligible_for_candidate_review');
  const f=fixture(32);f.validation.origins=7;reason(f,'not_admitted');
});
test('all three independent check statuses are required, with evidence receipts', () => {
  const f=fixture();f.validation=null;reason(f,'validation_pending');
  for (const name of ['baseline','backtest','uncertainty']) {
    const pending=fixture();pending.validation[name]={status:'pending',evidenceSha256:null};reason(pending,'validation_pending');
    const failed=fixture();failed.validation[name].status='failed';reason(failed,'not_admitted');
    const unfounded=fixture();unfounded.validation[name].evidenceSha256=null;reason(unfounded,'not_admitted');
  }
});
test('stale or wrong-method receipts, insufficient validation horizons and leakage fail admission', () => {
  for (const mutate of [r=>r.methodologySha256='d'.repeat(64),r=>r.historySha256='e'.repeat(64),r=>r.cutoffMonth='2024-11',
    r=>r.checkedAt='2025-01-02',r=>r.checkedAt='2021-11-01',r=>r.chronologicalTrainingOnly=false,
    r=>r.origins=5,r=>r.evaluatedHorizon=2,r=>r.evaluatedHorizon=7,r=>r.origins=999]) {
    const f=fixture();mutate(f.validation);reason(f,'not_admitted');
  }
});
test('closed runtime request rejects extras, sparse arrays and accessors without evaluating them', () => {
  const extra=fixture();extra.forecast=[1];reason(extra,'invalid_history');
  const sparse=fixture();delete sparse.history[1];reason(sparse,'invalid_history');
  const getter=fixture();Object.defineProperty(getter.history[0],'value',{get(){throw Error('must not execute');},enumerable:true});reason(getter,'invalid_history');
  for (const bad of [null,[],{},'history']) reason(bad,'invalid_history');
});

test('candidate readiness is retrospective, not preregistration or per-origin vintage certification', () => {
  const f=fixture();
  f.method.registeredAt='2024-12-31';
  f.history.forEach(p=>p.observedAt='2024-12-31');
  const result=assess(f);
  assert.equal(result.status,'eligible_for_candidate_review');
  assert.equal('admitted' in result,false);
  assert.equal('published' in result,false);
  assert.equal('realTimeValidated' in result,false);
});
