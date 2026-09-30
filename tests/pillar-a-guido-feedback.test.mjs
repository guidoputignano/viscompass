import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {costPerSuppliedDdd} from '../lib/analytics/aware-metrics.ts';
import {regionalRankingRows} from '../lib/pillar-a/regional-ranking.ts';
import {reportedRoundingBounds,reconcileCostBases} from '../lib/analytics/cost-basis-reconciliation.ts';

test('category euro/DDD is a ratio of corresponding totals, with missing and zero guarded',()=>{
  assert.equal(costPerSuppliedDdd(100,20),5);
  assert.equal(costPerSuppliedDdd(0,20),0);
  for(const [cost,ddd] of [[100,0],[null,20],[100,null],[NaN,20],[100,Infinity],[-1,20]]) assert.equal(costPerSuppliedDdd(cost,ddd),null);
  assert.equal(costPerSuppliedDdd(100+900,20+30),20); // not the mean of 5 and 30
});
const row=(region,spend,population)=>({region,year:2025,group:'antibiotics',channel:'direct',spend,population,packs:100,perResident:spend===null||population===null?null:spend/population,months:12,spendYoy:.1,missingSpendCells:0,missingPackCells:0});
test('regional ranking combines province numerators and denominators, without altering source rows',()=>{
  const source=[row('041',100,10),row('042',900,30),row('130',50,5)];
  const snapshot=JSON.stringify(source);
  const result=regionalRankingRows(source);
  const region=result.find(r=>r.region==='040');
  assert.equal(result.length,2);
  assert.equal(region.spend,1000);
  assert.equal(region.population,40);
  assert.equal(region.perResident,25);
  assert.equal(region.packs,200);
  assert.equal(region.spendYoy,null);
  assert.equal(JSON.stringify(source),snapshot);
});
test('missing province data stays missing; zero spending stays zero',()=>{
  assert.equal(regionalRankingRows([row('041',100,10)])[0].spend,null);
  assert.equal(regionalRankingRows([row('041',100,10),row('042',null,20)])[0].perResident,null);
  assert.equal(regionalRankingRows([row('041',0,10),row('042',0,20)])[0].perResident,0);
  assert.throws(()=>regionalRankingRows([row('041',1,1),row('041',2,2)]));
  assert.throws(()=>regionalRankingRows([row('041',1,1),{...row('042',2,2),year:2024}]));
});
test('published 2025 source has 21 AIFA units and combines to 20 regions without rate averaging',()=>{
  const source=JSON.parse(readFileSync(new URL('../data/public-compiled/pillar-a.json',import.meta.url),'utf8'));
  const rows=source.annual.filter(r=>r.year===2025&&r.group==='antibiotics'&&r.channel==='direct'&&r.region!=='000');
  const regions=regionalRankingRows(rows);
  assert.equal(rows.length,21);
  assert.equal(regions.length,20);
  const merged=regions.find(r=>r.region==='040');
  assert.equal(merged.spend,2607411.46);
  assert.equal(merged.packs,256714);
  assert.equal(merged.population,1086252);
  assert.ok(Math.abs(merged.perResident-2607411.46/1086252)<1e-10);
});
const note='VIS_WORKBOOK_V1: SHA256=ab8e41220cb063695fab87598baf56c5fc7487de2c19d26329204de8b385ed2c; supplied rounded costs and DDD';
test('only fingerprinted rounding gets a bound; an integer or CO1 note alone does not',()=>{
  const known={cost_eur:100,ddd_count:20,source_note:note};
  assert.deepEqual(reportedRoundingBounds([known,known]),{costRoundingBound:1,dddRoundingBound:1});
  assert.deepEqual(reportedRoundingBounds([]),{});
  for(const source_note of [null,'CO1','supplied rounded costs and DDD']) assert.deepEqual(reportedRoundingBounds([{...known,source_note}]),{});
  assert.deepEqual(reportedRoundingBounds([{...known,cost_eur:100.1}]),{});
});
test('rounding-compatible is separate from exact match, mismatch and unavailable',()=>{
  const w=[{year:2023,cf:90,cmr:100.66,ddd:20.29}];
  const s={year:2023,costEur:100,dddCount:20};
  assert.equal(reconcileCostBases(w,[s])[0].status,'discrepancy');
  const rounded=reconcileCostBases(w,[{...s,costRoundingBound:2,dddRoundingBound:2}])[0];
  assert.equal(rounded.status,'reported_rounding');
  assert.equal(rounded.matches,false); // not exact
  assert.equal(reconcileCostBases(w,[{...s,costEur:96,costRoundingBound:2,dddRoundingBound:2}])[0].status,'discrepancy');
  assert.equal(reconcileCostBases(w,[{...s,costRoundingBound:Infinity}])[0].status,'discrepancy');
  assert.equal(reconcileCostBases(w,[])[0].status,'not_comparable');
  assert.equal(reconcileCostBases(w,[{...s,costEur:100.66,dddCount:20.29}])[0].status,'matched');
});
