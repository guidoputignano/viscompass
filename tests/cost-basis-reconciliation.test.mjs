import test from 'node:test';
import assert from 'node:assert/strict';
import {reconcileCostBases} from '../lib/analytics/cost-basis-reconciliation.ts';
import {daysInYear,indicatorsFromTotals} from '../lib/analytics/antibiotic-indicators.ts';

test('reporting-year indicators include Gregorian leap days',()=>{
  assert.equal(daysInYear(2024),366);
  assert.equal(daysInYear(2025),365);
  assert.equal(daysInYear(1900),365);
  assert.equal(daysInYear(2000),366);
  assert.throws(()=>daysInYear(NaN));
  const t={cost:100,ddd:366,bedDays:0,population:1000};
  assert.equal(indicatorsFromTotals(t,2024).dddPer1000ResidentsDay,1);
  assert.equal(indicatorsFromTotals(t,2025).dddPer1000ResidentsDay,366/365);
  assert.equal(indicatorsFromTotals(t,2024).dddPer100BedDays,null);
  assert.equal(indicatorsFromTotals({...t,population:0},2024).dddPer1000ResidentsDay,null);
});
test('cost bridge distinguishes CF from matching CMR and DDD',()=>{
  const w=[{year:2025,cf:100,cmr:110,ddd:20}];
  const [r]=reconcileCostBases(w,[{year:2025,costEur:110,dddCount:20}]);
  assert.equal(r.matches,true);
  assert.equal(r.cf,100);
  assert.equal(r.cmrDelta,0);
  assert.equal(reconcileCostBases(w,[{year:2025,costEur:100,dddCount:20}])[0].matches,false);
  assert.equal(reconcileCostBases(w,[{year:2025,costEur:110,dddCount:21}])[0].matches,false);
});
test('missing year or invalid input is not a zero or a reconciled result',()=>{
  const w=[{year:2025,cf:0,cmr:0,ddd:0}];
  assert.equal(reconcileCostBases(w,[])[0].matches,null);
  assert.equal(reconcileCostBases(w,[{year:2024,costEur:0,dddCount:0}])[0].summaryCost,null);
  assert.equal(reconcileCostBases(w,[{year:2025,costEur:NaN,dddCount:0}])[0].matches,null);
  assert.equal(reconcileCostBases(w,[{year:2025,costEur:0,dddCount:0}])[0].matches,true);
});
