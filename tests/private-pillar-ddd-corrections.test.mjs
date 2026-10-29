// A DDD-per-pack correction replaces a pack's value only where the source still holds the value it was checked
// against, must find its pack, and changes nothing else. Synthetic packs only.
import test from 'node:test';
import assert from 'node:assert/strict';
import {applyDddCorrections,assertDddCorrections} from '../lib/analytics/private-pillar-ddd-corrections.ts';

const pack=(aic,DDD_AIC,extra={})=>({aic,DDD_AIC,QMR:10,org:'x',year:2025,...extra});
const fix=(aic,from,to)=>({aic,from,to,reason:'derived from the pack contents and the WHO DDD',evidence:'synthetic'});
const products=[pack('000000001',0.25),pack('000000001',0.25,{year:2024}),pack('000000002',6.67),pack('000000003',1.5)];

test('a correction replaces every row of its pack and nothing else',()=>{
  const {products:out,rowsChanged}=applyDddCorrections(products,[fix('000000001',0.25,5),fix('000000002',6.67,5)]);
  assert.deepEqual(out.map(p=>p.DDD_AIC),[5,5,5,1.5]);
  assert.deepEqual(rowsChanged,{'000000001':2,'000000002':1});
  const others=p=>Object.fromEntries(Object.entries(p).filter(([k])=>k!=='DDD_AIC'));
  assert.deepEqual(out.map(others),products.map(others),'only DDD_AIC changes');
  assert.equal(products[0].DDD_AIC,0.25,'the input is not mutated');
  assert.equal(out[3],products[3],'an uncorrected pack is passed through as is');
});

test('no corrections leave the release exactly as the source',()=>{
  const {products:out,rowsChanged}=applyDddCorrections(products,[]);
  assert.deepEqual(out,products);assert.deepEqual(rowsChanged,{});
});

test('a correction never applies to a value it was not checked against, and must find its pack',()=>{
  assert.throws(()=>applyDddCorrections(products,[fix('000000001',0.3,5)]),/holds 0.25, not the 0.3/);
  assert.throws(()=>applyDddCorrections(products,[fix('000000009',1,2)]),/no pack of the release has this AIC/);
});

test('malformed corrections are refused before anything is applied',()=>{
  for(const [bad,re] of [[[fix('12345',1,2)],/nine digits/],[[fix('000000001',0.25,5),fix('000000001',0.25,6)],/listed twice/],
    [[fix('000000001',0,5)],/positive and finite/],[[fix('000000001',0.25,Number.NaN)],/positive and finite/],
    [[fix('000000001',0.25,0.25)],/changes nothing/],[[{...fix('000000001',0.25,5),reason:' '}],/reason and evidence/],
    [[{...fix('000000001',0.25,5),evidence:''}],/reason and evidence/]])
    assert.throws(()=>assertDddCorrections(bad),re);
});
