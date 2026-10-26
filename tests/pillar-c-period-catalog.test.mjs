// Synthetic fixtures only. The production adapter consumes an already-authorized
// view; this suite never imports confidential source packets or storage pins.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {extUnit,extFileF,extBridges} from './fixtures/pillar-c-extension.mjs';
import {buildCPeriodCatalog,publicCPeriodCatalog,selectCPeriodDataset,validateCPeriodCatalog} from '../lib/dashboard-review/pillar-c/period-catalog.ts';

const keys=['aggregato','asl-1','asl-2','asl-3','asl-4'];
const view=(units=keys)=>({
  units:units.map(key=>({key,label:key==='aggregato'?'Aggregato sintetico':`Azienda sintetica ${key}`,data:extUnit(key,key==='aggregato'?4000:1000)})),
  drivers:null,baskets:null,fileFBasket:null,findings:null,
});
const catalog=(v=view())=>buildCPeriodCatalog(v,{mode:'synthetic'});
const select=(c,e,capability=e.capabilities[0])=>selectCPeriodDataset(c,{
  datasetId:e.id,sourceFamily:e.sourceFamily,unit:e.unit,windowFrom:e.windowFrom,windowTo:e.windowTo,capability,
});
const file=(v,unit='asl-3')=>v.units.find(u=>u.key===unit).data.fileF;
const reject=fn=>assert.throws(fn,/C_PERIOD_INVALID:/);

test('legacy catalog discovers all entitled DPC units and every observed File F month without certifying completeness',()=>{
  const c=catalog();
  assert.equal(validateCPeriodCatalog(c),true);
  assert.equal(c.mode,'synthetic');
  assert.equal(c.entries.filter(e=>e.sourceFamily==='nsis-dpc').length,5);
  assert.equal(c.entries.filter(e=>e.sourceFamily==='file-f'&&e.granularity==='year').length,1);
  assert.equal(c.entries.filter(e=>e.sourceFamily==='file-f'&&e.granularity==='month').length,12);
  assert.ok(c.entries.every(e=>e.certifiedComplete===false));
  assert.deepEqual([...new Set(c.entries.map(e=>e.windowFrom.slice(0,4)))],['2026','2025']);
  assert.equal(buildCPeriodCatalog(view()).mode,'real','legacy real mode is explicit in the returned type');
});

test('time bases distinguish the DPC header reporting month from File F recorded dispensing dates',()=>{
  const c=catalog();
  assert.equal(c.entries.find(e=>e.sourceFamily==='nsis-dpc').timeBasis,'reporting-month');
  assert.equal(c.entries.find(e=>e.sourceFamily==='file-f'&&e.granularity==='year').timeBasis,'recorded-dispensing-year');
  assert.equal(c.entries.find(e=>e.sourceFamily==='file-f'&&e.granularity==='month').timeBasis,'recorded-dispensing-month');
});

test('all File F holders remain independently selectable rather than first-holder selection',()=>{
  const v=view();
  const second=v.units.find(u=>u.key==='asl-2').data;
  second.fileF=extFileF(); second.notes.fileFMode09='Nota sintetica.';
  second.fileF.months[0]={month:'2025-01',amount:700,mode09:200,withoutMode09:500};
  second.fileF.bridges=extBridges(second.fileF.months);
  const c=catalog(v);
  assert.equal(c.entries.filter(e=>e.sourceFamily==='file-f'&&e.granularity==='year').length,2);
  assert.equal(select(c,c.entries.find(e=>e.id==='file-f.asl-2.month.2025-01'),'reported-amount').data.reportedAmount,700);
  assert.equal(select(c,c.entries.find(e=>e.id==='file-f.asl-3.month.2025-01'),'reported-amount').data.reportedAmount,1000);
});

test('annual distinct identifiers are the admitted annual value, not a sum of monthly distinct counts',()=>{
  const c=catalog();
  const annual=select(c,c.entries.find(e=>e.id==='file-f.asl-3.year.2025-01'),'identifier-count');
  assert.equal(annual.status,'ready'); assert.equal(annual.data.kind,'legacy-file-f-year');
  assert.equal(annual.data.fileF.identifiers,5000);
  assert.equal(annual.data.fileF.identifiersByMonth.reduce((n,r)=>n+r.count,0),24000);
  assert.notEqual(annual.data.fileF.identifiers,24000);
});

test('a monthly File F selection never carries annual demographics, distributions or quantiles',()=>{
  const c=catalog(),e=c.entries.find(e=>e.id==='file-f.asl-3.month.2025-01');
  const r=select(c,e,'identifier-count');
  assert.deepEqual(r.data,{kind:'legacy-file-f-month',month:'2025-01',reportedAmount:1000,mode09Amount:0,withoutMode09Amount:1000,identifiers:2000});
  assert.equal(select(c,e,'recipient-age').status,'unsupported_capability');
  assert.equal(select(c,e,'expenditure-distribution').status,'unsupported_capability');
  assert.equal('fileF' in r.data,false); assert.equal('age' in r.data,false);
});

test('missing and observed-zero monthly values stay different, including partial metric coverage',()=>{
  const v=view(),f=file(v);
  f.months=f.months.filter(m=>!['2025-02','2025-03'].includes(m.month));
  f.identifiersByMonth=f.identifiersByMonth.filter(m=>!['2025-02','2025-04'].includes(m.month));
  f.months[0]={month:'2025-01',amount:0,mode09:0,withoutMode09:0};
  f.identifiersByMonth[0]={month:'2025-01',count:0};
  f.bridges=extBridges(f.months);
  const c=catalog(v);
  assert.equal(c.entries.some(e=>e.id==='file-f.asl-3.month.2025-02'),false);
  const zero=select(c,c.entries.find(e=>e.id==='file-f.asl-3.month.2025-01'),'reported-amount');
  assert.equal(zero.data.reportedAmount,0); assert.equal(zero.data.identifiers,0);
  const idsOnly=c.entries.find(e=>e.id==='file-f.asl-3.month.2025-03');
  assert.deepEqual(idsOnly.capabilities,['identifier-count']);
  assert.equal(select(c,idsOnly,'identifier-count').data.reportedAmount,null);
  assert.equal(select(c,idsOnly,'reported-amount').status,'unsupported_capability');
  const amountOnly=c.entries.find(e=>e.id==='file-f.asl-3.month.2025-04');
  assert.equal(select(c,amountOnly,'reported-amount').data.identifiers,null);
  assert.equal(select(c,amountOnly,'identifier-count').status,'unsupported_capability');
});

test('DPC aggregate is an explicitly labelled sum of within-unit people and never synthesizes pooled quantiles',()=>{
  const c=catalog(),e=c.entries.find(e=>e.id==='nsis-dpc.aggregato.month.2026-01');
  assert.equal(e.populationBasis,'sum-within-unit-eligible-recipients');
  const r=select(c,e,'recipient-count');
  assert.equal(r.data.january.recipients,4000); assert.equal(r.data.january.recipientsAreSum,true);
  assert.equal(r.data.january.cost.quartiles,null); assert.equal(r.data.january.cost.lorenz,null);
  assert.equal(r.data.january.use.packs.quartiles,null);
  assert.equal(e.capabilities.includes('product-unit-costs'),false);
});

test('the existing authorized view is the boundary: own plus aggregate does not acquire peers or their File F',()=>{
  const c=catalog(view(['asl-1','aggregato']));
  assert.deepEqual(c.entries.map(e=>e.unit),['asl-1','aggregato']);
  const selection={datasetId:'file-f.asl-3.year.2025-01',sourceFamily:'file-f',unit:'asl-3',windowFrom:'2025-01',windowTo:'2025-12',capability:'identifier-count'};
  assert.equal(selectCPeriodDataset(c,selection).status,'unavailable_period');
  const forged={...selection,role:'reviewer'};
  assert.equal(selectCPeriodDataset(c,forged).status,'invalid_selection');
});

test('exact identity cannot silently fall back to another unit, family, period or year',()=>{
  const c=catalog(),e=c.entries.find(e=>e.id==='file-f.asl-3.year.2025-01');
  const s={datasetId:e.id,sourceFamily:e.sourceFamily,unit:e.unit,windowFrom:e.windowFrom,windowTo:e.windowTo,capability:'identifier-count'};
  for(const change of [{unit:'asl-2'},{sourceFamily:'nsis-dpc'},{windowFrom:'2024-01'},{windowTo:'2026-12'}]){
    assert.equal(selectCPeriodDataset(c,{...s,...change}).status,'invalid_selection');
  }
  assert.equal(selectCPeriodDataset(c,{...s,datasetId:'file-f.asl-3.year.2024-01',windowFrom:'2024-01',windowTo:'2024-12'}).status,'unavailable_period');
  assert.equal(selectCPeriodDataset(c,{...s,datasetId:'nsis-dpc.asl-3.month.2026-02',sourceFamily:'nsis-dpc',windowFrom:'2026-02',windowTo:'2026-02',capability:'recipient-count'}).status,'unavailable_period');
});

test('catalogue projection is metadata only and cannot be reposted to authorize server data',()=>{
  const c=catalog(),p=publicCPeriodCatalog(c),e=c.entries[0];
  assert.equal(validateCPeriodCatalog(p),true);
  assert.deepEqual(p,c); assert.notEqual(p,c);
  assert.equal(select(p,e).status,'invalid_selection');
  assert.equal(select(structuredClone(c),e).status,'invalid_selection');
  assert.equal(JSON.stringify(p).includes('"recipients":'),false);
  assert.equal(JSON.stringify(p).includes('acquisition'),false);
  assert.equal(JSON.stringify(p).includes('aic"'),false);
});

test('snapshots isolate source and selected-result mutations without a cross-view data cache',()=>{
  const v=view(),c=catalog(v),e=c.entries.find(e=>e.id==='nsis-dpc.asl-3.month.2026-01');
  v.units.find(u=>u.key==='asl-3').data.january.recipients=999999;
  const r=select(c,e,'recipient-count'); assert.equal(r.data.january.recipients,1000);
  r.data.january.recipients=2222;
  assert.equal(select(c,e,'recipient-count').data.january.recipients,1000);
  assert.throws(()=>{c.entries.push(e);},TypeError);
  assert.throws(()=>{c.entries[0].capabilities.push('reported-amount');},TypeError);
  const next=catalog(view(['asl-2'])); assert.equal(next.entries.length,1);
  assert.equal(select(next,e,'recipient-count').status,'unavailable_period');
});

test('closed catalogue validation rejects unknown fields, unsafe prototypes and incorrect calendars/bases/capabilities',()=>{
  const mutate=fn=>{const c=structuredClone(catalog());fn(c);return c;};
  for(const c of [
    mutate(c=>{c.extra='x';}),
    mutate(c=>{c.entries[0].extra=1;}),
    mutate(c=>{c.entries[0].windowFrom='2026-00';}),
    mutate(c=>{c.entries[0].windowTo='2026-13';}),
    mutate(c=>{c.entries[0].timeBasis='dispensing-month';}),
    mutate(c=>{c.entries[0].populationBasis='regional-unique-people';}),
    mutate(c=>{c.entries[0].certifiedComplete=true;}),
    mutate(c=>{c.entries[0].capabilities.push('invented-forecast');}),
    mutate(c=>{c.entries[0].capabilities.push('identifier-count');}),
    mutate(c=>{c.entries[0].capabilities.push(c.entries[0].capabilities[0]);}),
    mutate(c=>{c.entries.push(structuredClone(c.entries[0]));}),
    mutate(c=>{c.entries[0].observedMonths.push('2026-02');}),
    mutate(c=>{c.mode='observed';}),
    Object.assign(Object.create(null),catalog()),
  ])assert.equal(validateCPeriodCatalog(c),false);
  const month=mutate(c=>{c.entries.find(e=>e.id==='file-f.asl-3.month.2025-01').capabilities.push('recipient-age');});
  assert.equal(validateCPeriodCatalog(month),false);
});

test('closed adapter input rejects duplicate units, wrong identity, unknown nested fields and invalid numbers',()=>{
  for(const mutation of [
    v=>{v.units.push(structuredClone(v.units[0]));},
    v=>{v.units[1].data.unit='asl-2';},
    v=>{v.units[1].data.period='2026-02';},
    v=>{v.units[1].data.channel='DD';},
    v=>{v.units[1].data.january.extra=1;},
    v=>{v.units[1].data.january.recipients=NaN;},
    v=>{v.units[1].data.january.services.servicePerPack=Infinity;},
    v=>{v.units[1].data.january.recipientsAreSum=true;},
    v=>{v.units[0].data.january.cost.quartiles={q1:1,median:2,q3:3};},
    v=>{v.units[1].data.january.cost.quartiles={q1:3,median:2,q3:1};},
    v=>{v.units[1].data.january.age.cells[0].count=-1;},
    v=>{v.units[1].data.january.age.cells[0].count+=10;},
    v=>{v.units[1].data.january.age.cells[0].share+=0.01;},
    v=>{v.units[1].data.january.sex.female=1.1;},
    v=>{v.units[1].data.january.cost.lorenz[5]=0.001;},
    v=>{file(v).year=2026;},
    v=>{file(v).contacts.total=3000;},
    v=>{file(v).months[0].amount=NaN;},
    v=>{file(v).months[0].month='2025-13';},
    v=>{file(v).months[0].month='2024-12';},
    v=>{file(v).months.reverse();},
    v=>{file(v).identifiersByMonth[0].count=5001;},
    v=>{file(v).bridges[0].to='2025-03';},
    v=>{file(v).months[0].amount=12;},
    v=>{v.units[0].data.fileF=extFileF();},
  ]){const v=view();mutation(v);reject(()=>catalog(v));}
  reject(()=>buildCPeriodCatalog(view(),{mode:'synthetic',anything:1}));
  const v=view();Object.setPrototypeOf(v.units[1].data.january,{privateData:'x'});reject(()=>catalog(v));
});

test('input accessors and sparse arrays are rejected rather than evaluated or silently dropped',()=>{
  let called=false;
  const v=view();Object.defineProperty(v.units[1].data.january,'recipients',{enumerable:true,get(){called=true;return 1000;}});
  reject(()=>catalog(v));assert.equal(called,false);
  const sparse=view();delete sparse.units[1];reject(()=>catalog(sparse));
  const c=catalog(),e=c.entries[0];
  const s={datasetId:e.id,sourceFamily:e.sourceFamily,unit:e.unit,windowFrom:e.windowFrom,windowTo:e.windowTo,capability:e.capabilities[0]};
  Object.defineProperty(s,'unit',{enumerable:true,get(){called=true;return e.unit;}});
  assert.equal(selectCPeriodDataset(c,s).status,'invalid_selection');assert.equal(called,false);
});

test('server adapter introduces no database/service-role client, storage pins, environment gate or browser authorization',()=>{
  const source=readFileSync(new URL('../lib/dashboard-review/pillar-c/period-catalog.ts',import.meta.url),'utf8');
  assert.match(source,/import "server-only"/);
  assert.doesNotMatch(source,/createServiceRoleClient|process\.env|from\s+["'][^"']*(?:storage|supabase|reviewer-list)/);
  const browser=readFileSync(new URL('../lib/dashboard-review/pillar-c/period-contract.ts',import.meta.url),'utf8');
  assert.doesNotMatch(browser,/from\s+["'][^"']*period-catalog|import\s+["']server-only|service-role|\.json|[a-f0-9]{64}/);
});
