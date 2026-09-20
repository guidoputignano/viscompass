import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const data=JSON.parse(fs.readFileSync(new URL('../public/data/pillar-a.json',import.meta.url),'utf8'));
test('public series has unique annual keys and reconciles national sums',()=>{
  assert.equal(data.annual.length,1320);
  assert.equal(new Set(data.annual.map(r=>[r.year,r.region,r.group,r.channel].join('|'))).size,1320);
  for(const n of data.annual.filter(r=>r.region==='000')){
    const rows=data.annual.filter(r=>r.region!=='000'&&r.year===n.year&&r.group===n.group&&r.channel===n.channel);
    assert.equal(rows.length,21);
    for(const field of ['spend','packs'])assert.ok(Math.abs(rows.reduce((s,r)=>s+(r[field]??0),0)-(n[field]??0))<0.01);
  }
});
test('population rates and annual variations use matching periods and scopes',()=>{
  for(const r of data.annual){
    if(r.year<2019||['041','042'].includes(r.region))assert.equal(r.perResident,null);
    if(r.perResident!==null)assert.ok(Math.abs(r.perResident-r.spend/r.population)<1e-10);
    if(r.spendYoy!==null){const p=data.annual.find(p=>p.year===r.year-1&&p.region===r.region&&p.group===r.group&&p.channel===r.channel);assert.ok(Math.abs(r.spendYoy-(r.spend/p.spend-1))<1e-10);}
  }
});
test('only public coverage is delivered and antifungals cannot carry AWaRe',()=>{
  for(const r of data.candidates){
    assert.equal(Object.keys(r).some(k=>/hospital|aic_count|cost/i.test(k)),false);
    if(r.group==='antifungals'){assert.equal(r.aware,'');assert.equal(r.aware_status,'not_applicable');}
  }
  assert.equal(data.monthly.length,720);
  assert.equal(data.activity.length,88);
  assert.equal(JSON.stringify(data).includes('activity_a2'),false);
});
