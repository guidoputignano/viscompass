import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {privateComparisons} from '../lib/analytics/private-pillar-comparison.ts';
import {PRIVATE_RELEASE} from '../lib/analytics/private-pillar-a.ts';
const fixture=()=>['x','y'].flatMap((org_code,i)=>[2023,2024,2025].flatMap(year=>{
 const cats=['A','W','R'].map((aware_category,j)=>({release_id:PRIVATE_RELEASE,org_code,year,aware_category,cf:(i+1)*(j+1)*100,cmr:(j+1)*90,ddd:(j+1+i)*10,activity:100,activity_variant:'A3/T1',source_hash:'a'.repeat(64)}));
 return [...cats,{...cats[0],aware_category:'T',cf:cats.reduce((s,r)=>s+r.cf,0),cmr:cats.reduce((s,r)=>s+r.cmr,0),ddd:cats.reduce((s,r)=>s+r.ddd,0)}];
}));
function verify(rows){const out=privateComparisons(rows);assert.ok(out.length>0);for(const r of out){assert.ok(r.available);assert.ok(Math.abs(r.baseline+r.price+r.mix+r.interaction-r.actual)<.01);}for(const y of [2023,2024,2025])assert.ok(Math.abs(out.filter(r=>r.year===y).reduce((s,r)=>s+r.difference,0))<.01);}
test('three-term benchmark reconciles and peer differences sum to zero',()=>verify(fixture()));
test('single organization does not create a peer reference',()=>assert.deepEqual(privateComparisons(fixture().filter(r=>r.org_code==='x')),[]));
test('private staged source comparisons reconcile',{skip:!fs.existsSync('private-staging/closure/private-v2-facts.json')},()=>verify(JSON.parse(fs.readFileSync('private-staging/closure/private-v2-facts.json','utf8'))));
