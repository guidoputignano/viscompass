import test from 'node:test';
import assert from 'node:assert/strict';
import {cAttrAxis,cAttrPercent,cAttrEntries} from '../lib/dashboard-review/pillar-c/attribution-format.ts';
test('axis labels retain readable euro amounts for the small uncertainty pool',()=>{
  assert.equal(cAttrAxis(20,80),'20 €');
  assert.equal(cAttrAxis(1500,3000),'1,5 k€');
  assert.equal(cAttrAxis(1500000,6000000),'1,5 M€');
  assert.equal(cAttrAxis(-2000,3000),'-2 k€');
});
test('a nonzero tiny share is not labelled zero and a missing denominator stays unavailable',()=>{
  assert.equal(cAttrPercent(0.0000001),'<0,01%');assert.equal(cAttrPercent(0),'0%');
  assert.equal(cAttrPercent(null),'Non calcolabile');assert.equal(cAttrPercent(0.1234),'12,34%');
});
test('entry labels handle singular and plural without changing amounts',()=>{
  assert.equal(cAttrEntries(1),'1 voce prodotto');assert.equal(cAttrEntries(0),'0 voci prodotto');
});
