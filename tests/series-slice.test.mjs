import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {slicePublicSeries} from '../lib/pillar-a/series-slice.ts';
const data=JSON.parse(fs.readFileSync(new URL('../data/public-compiled/pillar-a.json',import.meta.url),'utf8'));
test('series requests reject omitted, unknown and withdrawn selectors',()=>{
 for(const args of [['','',''],['999','antibiotics','direct'],['000','antituberculars','direct'],['000','antibiotics','bad']])assert.equal(slicePublicSeries(data,...args),null);
});
test('every public slice preserves selected history, Sankey combinations and rankings',()=>{
 for(const region of Object.keys(data.regions))for(const group of ['antibiotics','antifungals'])for(const channel of ['direct','convenzionata']){
  const s=slicePublicSeries(data,region,group,channel);
  assert.deepEqual(s.annual.filter(r=>r.region===region),data.annual.filter(r=>r.region===region));
  assert.deepEqual(s.annual.filter(r=>r.year===2025&&r.group===group&&r.channel===channel),data.annual.filter(r=>r.year===2025&&r.group===group&&r.channel===channel));
  assert.ok(s.monthly.every(r=>r.group===group&&r.channel===channel&&(r.region==='000'||r.region===region)));
  assert.ok(s.annual.length<data.annual.length);
  assert.ok(s.monthly.length<data.monthly.length);
 }
});
