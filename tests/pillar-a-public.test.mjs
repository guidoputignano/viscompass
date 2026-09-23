import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const data=JSON.parse(fs.readFileSync(new URL('../data/public-compiled/pillar-a.json',import.meta.url),'utf8'));
// 10 years x 22 territories x 2 families x 2 channels. The J04A family is not published.
const ANNUAL_ROWS=880;
// Monthly detail is published only for the years the page plots.
const MONTHLY_YEARS=[2023,2024,2025];
const MONTHLY_ROWS=MONTHLY_YEARS.length*22*2*2*12;

test('public series has unique annual keys and reconciles national sums',()=>{
  assert.equal(data.annual.length,ANNUAL_ROWS);
  assert.equal(new Set(data.annual.map(r=>[r.year,r.region,r.group,r.channel].join('|'))).size,ANNUAL_ROWS);
  for(const n of data.annual.filter(r=>r.region==='000')){
    const rows=data.annual.filter(r=>r.region!=='000'&&r.year===n.year&&r.group===n.group&&r.channel===n.channel);
    assert.equal(rows.length,21);
    for(const field of ['spend','packs'])assert.ok(Math.abs(rows.reduce((s,r)=>s+(r[field]??0),0)-(n[field]??0))<0.01);
  }
});
test('population rates and annual variations use matching periods and scopes',()=>{
  for(const r of data.annual){
    assert.ok(r.population>0);
    assert.ok(r.populationBasis.includes(r.year<2019?'reconstruction':'POSAS'));
    if(r.year>=2019&&['041','042'].includes(r.region))assert.ok(r.population>0&&r.perResident!==null);
    if(r.perResident!==null)assert.ok(Math.abs(r.perResident-r.spend/r.population)<1e-10);
    if(r.spendYoy!==null){const p=data.annual.find(p=>p.year===r.year-1&&p.region===r.region&&p.group===r.group&&p.channel===r.channel);assert.ok(Math.abs(r.spendYoy-(r.spend/p.spend-1))<1e-10);}
  }
});
test('only public coverage is delivered and antifungals cannot carry AWaRe',()=>{
  for(const r of data.candidates){
    assert.equal(Object.keys(r).some(k=>/hospital|aic_count|cost/i.test(k)),false);
    if(r.group==='antifungals'){assert.equal(r.aware,'');assert.equal(r.aware_status,'not_applicable');}
  }
  assert.equal(data.monthly.length,MONTHLY_ROWS);
  assert.equal(data.activity.length,88);
  assert.equal(JSON.stringify(data).includes('activity_a2'),false);
});

test('regional monthly sums reproduce each annual spending value',()=>{
  for(const a of data.annual.filter(r=>MONTHLY_YEARS.includes(r.year))){
    const rows=data.monthly.filter(r=>r.region===a.region&&r.year===a.year&&r.group===a.group&&r.channel===a.channel);
    assert.equal(rows.length,12);
    assert.ok(Math.abs(rows.reduce((sum,r)=>sum+(r.spend??0),0)-(a.spend??0))<0.01);
  }
  // Years outside the published window carry no monthly detail at all.
  assert.equal(data.monthly.some(r=>!MONTHLY_YEARS.includes(r.year)),false);
});

test('the published payload carries no withdrawn family and no internal provenance',()=>{
  // Guido asked for the antitubercolari to be removed, not merely hidden.
  for(const key of ['annual','monthly','candidates']){
    assert.equal(data[key].some(r=>r.group==='tuberculosis'),false,`${key} still carries tuberculosis rows`);
  }
  assert.equal((data.scope?.groups??[]).some(g=>g.id==='tuberculosis'||g.prefix==='J04A'),false);
  assert.equal(JSON.stringify(data).toLowerCase().includes('tubercul'),false);

  // Source hashes, extraction cell references and internal paths stay internal.
  assert.equal('sources' in data,false);
  assert.equal('checks' in data,false);
  for(const row of data.activity){
    for(const field of ['source_file','source_sha256','source_cells']) assert.equal(field in row,false);
  }
  const serialised=JSON.stringify(data);
  assert.equal(/[a-f0-9]{64}/.test(serialised),false,'a sha256-shaped value is still published');
  assert.equal(serialised.includes('data\\\\raw'),false,'an internal filesystem path is still published');
});
