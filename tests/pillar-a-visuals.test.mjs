import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {expenditureBridge,spendingComposition} from '../lib/analytics/pillar-a-visuals.ts';
const {annual}=JSON.parse(fs.readFileSync(new URL('../public/data/pillar-a.json',import.meta.url),'utf8'));
test('every supported public waterfall reconciles; missing values do not become zero',()=>{
 let count=0;
 for(const after of annual){const before=annual.find(r=>r.year===after.year-1&&r.region===after.region&&r.group===after.group&&r.channel===after.channel);const b=expenditureBridge(before,after);if(b){count++;assert.ok(Math.abs(b.start+b.volume+b.average-b.end)<.01);}}
 assert.ok(count>0);
 const base={year:2024,region:'000',group:'antibiotics',channel:'direct',spend:100,packs:10,missingSpendCells:0,missingPackCells:0};
 assert.equal(expenditureBridge(base,{...base,year:2025,packs:0}),null);
 assert.equal(expenditureBridge(base,{...base,year:2025,spend:null}),null);
 assert.equal(expenditureBridge(base,{...base,year:2025,region:'010'}),null);
 assert.equal(expenditureBridge(base,{...base,year:2025,missingSpendCells:1}).missingCells,1);
 const b=expenditureBridge(base,{...base,year:2025,spend:90,packs:15});assert.ok(Math.abs(b.volume+b.average+10)<1e-10);
});
test('Sankey links conserve totals and reject incomplete or repeated inputs',()=>{
 let actualCount=0;
 for(const region of new Set(annual.map(r=>r.region))){
  for(let year=2017;year<=2025;year++){
   const actual=spendingComposition(annual,region,year);
   assert.ok(actual);
   assert.ok(Math.abs(actual.links.reduce((sum,l)=>sum+l.value,0)-actual.total)<.01);
   actualCount++;
  }
 }
 assert.equal(actualCount,198);
 const fixture=['direct','convenzionata'].flatMap(channel=>['antibiotics','antifungals'].map(group=>({year:2025,region:'000',channel,group,spend:100,packs:10,missingSpendCells:0,missingPackCells:0})));
 const s=spendingComposition(fixture,'000',2025);assert.equal(s.total,400);assert.equal(s.links.length,4);
 for(const dimension of ['source','target'])assert.equal([0,1].reduce((t,i)=>t+s.links.filter(l=>l[dimension]===i).reduce((v,l)=>v+l.value,0),0),s.total);
 assert.equal(spendingComposition(fixture.slice(1),'000',2025),null);
 assert.equal(spendingComposition([...fixture,fixture[0]],'000',2025),null);
});
