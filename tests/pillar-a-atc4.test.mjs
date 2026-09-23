import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const atc4=JSON.parse(fs.readFileSync(new URL('../public/data/pillar-a-atc4.json',import.meta.url),'utf8'));
const published=JSON.parse(fs.readFileSync(new URL('../public/data/pillar-a.json',import.meta.url),'utf8'));
const scope=JSON.parse(fs.readFileSync(new URL('../lib/analytics/pillar-a-scope.json',import.meta.url),'utf8'));
const groupOf=(code)=>scope.groups.find(g=>code.startsWith(g.prefix))?.id;

test('every ATC4 row indexes into the declared dimensions',()=>{
  for(const [y,r,h,c,spend,packs] of atc4.rows){
    assert.ok(atc4.years[y]!==undefined&&atc4.regions[r]!==undefined);
    assert.ok(atc4.channels[h]!==undefined&&atc4.codes[c]!==undefined);
    assert.ok(Number.isFinite(spend)&&Number.isFinite(packs));
  }
  assert.equal(new Set(atc4.codes).size,atc4.codes.length);
  for(const code of atc4.codes) assert.ok(groupOf(code),`${code} is outside the published perimeter`);
});

test('the ATC4 breakdown carries no withdrawn family',()=>{
  assert.equal(atc4.codes.some(c=>c.startsWith('J04')),false);
  assert.equal(atc4.codes.every(c=>c.startsWith('J01')||c.startsWith('J02A')),true);
});

test('ATC4 spend re-aggregates to every published family total',()=>{
  const rebuilt=new Map();
  for(const [y,r,h,c,spend] of atc4.rows){
    const key=[atc4.years[y],atc4.regions[r],groupOf(atc4.codes[c]),atc4.channels[h]].join('|');
    rebuilt.set(key,(rebuilt.get(key)??0)+spend);
  }
  let checked=0;
  for(const a of published.annual){
    if(a.spend==null) continue;
    const got=rebuilt.get([a.year,a.region,a.group,a.channel].join('|'))??0;
    assert.ok(Math.abs(got-a.spend)<0.01,`${a.year} ${a.region} ${a.group} ${a.channel}: ${got} vs ${a.spend}`);
    checked++;
  }
  assert.equal(checked,published.annual.filter(r=>r.spend!=null).length);
  assert.ok(checked>0);
});

test('regional ATC4 rows sum to the national row for the same category',()=>{
  const national=new Map(), regional=new Map();
  for(const [y,r,h,c,spend] of atc4.rows){
    const key=[y,h,c].join('|');
    if(atc4.regions[r]==='000') national.set(key,(national.get(key)??0)+spend);
    else regional.set(key,(regional.get(key)??0)+spend);
  }
  assert.ok(national.size>0);
  for(const [key,value] of national){
    assert.ok(Math.abs((regional.get(key)??0)-value)<0.01,`national total for ${key} does not match the sum of territories`);
  }
});
