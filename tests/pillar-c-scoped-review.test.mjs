// Pillar C organisation-scoped delivery: closed parsers of the per-unit index and review files, the merge
// into the client packet, and the explicit-rows selection. Synthetic data only.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {parseCScopedIndex,parseCScopedReviewFile,mergeCScopedReview,checkCScopedAggregate,C_SCOPED_ROW_KEYS} from '../lib/dashboard-review/pillar-c/scoped-review.ts';
import {selectCReview,DEFAULT_C_REVIEW,parseCReviewPacket} from '../lib/dashboard-review/pillar-c/review.ts';
import {cReviewV2Fixture} from './fixtures/pillar-c-review.mjs';
import {scopedFixture,scopedReviewFile,SCOPED_UNITS,ASL_UNITS,PERIODS,CHANNELS,SOURCE} from './fixtures/pillar-c-scoped.mjs';

const clone=v=>structuredClone(v);
const freeze=v=>{if(v&&typeof v==='object'){Object.freeze(v);for(const k of Object.keys(v))freeze(v[k]);}return v;};
const fixture=scopedFixture();
const indexOf=unit=>JSON.parse(fixture.files.get(`v1/${unit}/index-${fixture.pins.index[unit]}.json`).toString());
const EXPECT=unit=>({unit,root:'v1',build:'rec5-scoped-v1',source:SOURCE});
const fails=(fn,reason)=>assert.throws(fn,new RegExp(`PILLAR_C_SCOPED_${reason}`));

test('the reviewer row keys are the scoped row keys, in the same order',()=>{
  const p=parseCReviewPacket(cReviewV2Fixture());
  for(const key of Object.keys(C_SCOPED_ROW_KEYS))assert.deepEqual(Object.keys(p[key][0]),[...C_SCOPED_ROW_KEYS[key]],key);
});

test('index: closed, bound to its unit, root, build and the reviewer source pins',()=>{
  for(const unit of SCOPED_UNITS){
    const ix=parseCScopedIndex(freeze(indexOf(unit)),EXPECT(unit));
    assert.equal(ix.unit,unit);assert.equal(Object.keys(ix.attribution.scopes).length,16);assert.equal(Object.keys(ix.portfolio.scopes).length,16);
    for(const p of PERIODS)for(const c of CHANNELS){assert.match(ix.attribution.scopes[`${p}|${unit}|${c}`].name,new RegExp(`^attr-${p}-${c}-[a-f0-9]{64}\\.json$`));assert.match(ix.portfolio.scopes[`${p}|${unit}|${c}`].name,new RegExp(`^port-${p}-${c}-[a-f0-9]{64}\\.json$`));}
  }
  const ix=indexOf('asl-2');
  fails(()=>parseCScopedIndex(ix,EXPECT('asl-1')),'INDEX_UNIT');
  fails(()=>parseCScopedIndex(ix,{...EXPECT('asl-2'),root:'v2'}),'INDEX_SCHEMA');
  fails(()=>parseCScopedIndex(ix,{...EXPECT('asl-2'),build:'other'}),'INDEX_SCHEMA');
  fails(()=>parseCScopedIndex(ix,{...EXPECT('asl-2'),source:{...SOURCE,review:'f'.repeat(64)}}),'INDEX_SOURCE');
  const mutations=[
    [i=>{i.lineage=[];},'FIELDS'],[i=>{delete i.source;},'FIELDS'],[i=>{i.source.extra='x';},'FIELDS'],
    [i=>{i.review.name=`review-${'0'.repeat(64)}.json`;},'REF_NAME'],[i=>{i.review.bytes=0;},'REF_BYTES'],[i=>{i.review.path='x';},'FIELDS'],
    [i=>{const k=Object.keys(i.attribution.scopes)[0];i.attribution.scopes[k.replace('asl-2','asl-1')]=i.attribution.scopes[k];delete i.attribution.scopes[k];},'FIELDS'],
    [i=>{delete i.portfolio.scopes[Object.keys(i.portfolio.scopes)[3]];},'FIELDS'],
    [i=>{const k='FY2025|asl-2|Tutti';i.attribution.scopes[k].name=i.attribution.scopes[k].name.replace('FY2025','FY2024');},'REF_NAME'],
    [i=>{const k='FY2025|asl-2|Tutti';i.portfolio.scopes[k].name=i.portfolio.scopes[k].name.replace('port-','attr-');},'REF_NAME'],
    [i=>{i.portfolio.scopes['FY2025|asl-2|Tutti'].bytes=5_000_001;},'REF_BYTES'],[i=>{i.attribution.scopes['FY2025|asl-2|Tutti'].bytes=1_000_001;},'REF_BYTES'],
    [i=>{i.attribution.precision='float';},'PRECISION'],[i=>{i.attribution.portfolios[0].id='aa';},'PORTFOLIO_ID'],[i=>{i.attribution.portfolios.push({...i.attribution.portfolios[0]});},'PORTFOLIO_ID'],
    [i=>{i.schema='pillar-c-scoped-index-v2';},'INDEX_SCHEMA'],[i=>{i.unit='asl-1';},'INDEX_UNIT'],
  ];
  for(const [mutate,reason] of mutations){const i=clone(ix);mutate(i);fails(()=>parseCScopedIndex(i,EXPECT('asl-2')),reason);}
});

test('review file: closed rows of exactly its unit, reconciled, input never mutated',()=>{
  for(const unit of SCOPED_UNITS){
    const raw=freeze(scopedReviewFile(unit)),f=parseCScopedReviewFile(raw,unit);
    assert.equal(f.unit,unit);assert.notEqual(f.monthly,raw.monthly);assert.deepEqual(f.monthly,raw.monthly);
    for(const key of Object.keys(C_SCOPED_ROW_KEYS))for(const row of f[key])assert.equal(row.org,unit);
  }
  fails(()=>parseCScopedReviewFile(scopedReviewFile('asl-2'),'asl-1'),'FILE_SCHEMA');
  fails(()=>parseCScopedReviewFile(scopedReviewFile('asl-2'),'Regione'),'UNIT');
  const mutations=[
    ['asl-2',f=>{f.lineage=[];},'FIELDS'],['asl-2',f=>{f.evidence={};},'FIELDS'],['asl-2',f=>{f.forecast={};},'FIELDS'],['asl-2',f=>{f.workbookSha256='a'.repeat(64);},'FIELDS'],
    ['asl-2',f=>{f.monthly[0].note='x';},'FIELDS'],['asl-2',f=>{f.monthly[0].org='asl-1';},'FOREIGN_ROW'],['asl-2',f=>{f.counts[0].org='aggregato';},'FOREIGN_ROW'],
    ['asl-2',f=>{f.monthly[0].org='AQ';},'FOREIGN_ROW'],['aggregato',f=>{f.baseline[0].org='Regione';},'FOREIGN_ROW'],
    ['asl-2',f=>{f.monthlyBasis='derived_exact_sum_of_asl_units';},'MONTHLY_BASIS'],['aggregato',f=>{f.monthlyBasis='source_rows';},'MONTHLY_BASIS'],
    ['asl-4',f=>{f.budgets[0].basis='synthetic';},'MODELLED_BUDGET'],['asl-4',f=>{f.budgets[0].id='TE-2024-p0001';},'BUDGET_ID'],['asl-4',f=>{f.budgets[0].id='asl-3-b-0001';},'BUDGET_ID'],
    ['asl-2',f=>{f.budgets=[{id:'asl-2-b-0001',period:'FY2024',org:'asl-2',channel:'CO',level:'Dipartimento',area:'4000',basis:'published',budget:'1',actual:'1',alternative:'1'}];},'BUDGET_SOURCE'],
    ['aggregato',f=>{f.budgets=[{id:'aggregato-b-0001',period:'FY2024',org:'aggregato',channel:'CO',level:'Dipartimento',area:'4000',basis:'published',budget:'1',actual:'1',alternative:'1'}];},'AGGREGATE_BUDGET'],
    ['asl-4',f=>{f.budgets[0].actual=null;},'ALLOCATION_PAIR'],
    ['asl-2',f=>{f.monthly[3].net=String(Number(f.monthly[3].net)+1);f.monthly[3].positive=String(Number(f.monthly[3].positive)+1);},'MONTHLY_RECONCILIATION'],
    ['asl-2',f=>{f.baseline[0].rows+=1;},'ROW_RECONCILIATION'],['asl-2',f=>{f.bridges[0].value='1';},'BRIDGE_RECONCILIATION'],
    ['asl-2',f=>{f.monthly[0].positive='-1';},'SIGNED_TOTAL'],['asl-2',f=>{f.monthly[0].net='1e3';},'MONEY'],['asl-2',f=>{f.monthly.push(clone(f.monthly[0]));},'DUPLICATE'],
    ['asl-2',f=>{f.counts[0].perPerson=null;},'SCENARIO_REQUIRED'],['asl-2',f=>{f.monthly[0].month=13;},'PERIOD'],['asl-2',f=>{f.state='accepted';},'FILE_SCHEMA'],
  ];
  for(const [unit,mutate,reason] of mutations){const f=scopedReviewFile(unit);mutate(f);fails(()=>parseCScopedReviewFile(f,unit),reason);}
});

test('an empty section is no data, never zero',()=>{
  const f=scopedReviewFile('asl-1');f.budgets=[];f.counts=[];f.bridges=[];
  const p=parseCScopedReviewFile(f,'asl-1');assert.deepEqual([p.budgets,p.counts,p.bridges],[[],[],[]]);
  const empty={...scopedReviewFile('asl-1'),monthly:[],baseline:[],bridges:[],budgets:[],counts:[]};
  assert.deepEqual(parseCScopedReviewFile(empty,'asl-1').monthly,[]);
  fails(()=>parseCScopedReviewFile({...empty,baseline:scopedReviewFile('asl-1').baseline},'asl-1'),'BASELINE_EMPTY');
});

test('merge: the audience order, its units only, and for five units the aggregate is the exact sum of the four',()=>{
  const parsed=Object.fromEntries(SCOPED_UNITS.map(u=>[u,parseCScopedReviewFile(scopedReviewFile(u),u)]));
  const az=mergeCScopedReview(['asl-3','aggregato'],[parsed['asl-3'],parsed.aggregato]);
  assert.deepEqual(az.orgs,['asl-3','aggregato']);assert.deepEqual(Object.keys(az),['schema','state','monthlyMode','orgs','monthly','baseline','bridges','budgets','counts']);
  assert.equal(az.monthly.length,parsed['asl-3'].monthly.length+parsed.aggregato.monthly.length);
  assert.throws(()=>mergeCScopedReview(['aggregato','asl-3'],[parsed['asl-3'],parsed.aggregato]),/MERGE_ORDER/);
  assert.throws(()=>mergeCScopedReview(['asl-3','asl-3'],[parsed['asl-3'],parsed['asl-3']]),/MERGE_UNITS/);
  const units=['aggregato',...ASL_UNITS],re=mergeCScopedReview(units,units.map(u=>parsed[u]));
  assert.deepEqual(re.orgs,units);
  const bad=clone(parsed.aggregato);bad.monthly[5].rows+=1;
  assert.throws(()=>checkCScopedAggregate([bad,...ASL_UNITS.map(u=>parsed[u])]),/AGGREGATE_SUM/);
  const missing=clone(parsed.aggregato);missing.monthly.pop();
  assert.throws(()=>checkCScopedAggregate([missing,...ASL_UNITS.map(u=>parsed[u])]),/AGGREGATE_CELLS/);
  const extra=clone(parsed['asl-1']);extra.monthly=extra.monthly.filter(r=>!(r.year===2026&&r.month===5&&r.channel==='DPC'));
  assert.throws(()=>checkCScopedAggregate([parsed.aggregato,extra,...ASL_UNITS.slice(1).map(u=>parsed[u])]),/AGGREGATE_SUM/);
});

const scopedFilters=(org,over={})=>({...DEFAULT_C_REVIEW,org,...over});
const regionePacket=()=>{const units=['aggregato',...ASL_UNITS];return mergeCScopedReview(units,units.map(u=>parseCScopedReviewFile(scopedReviewFile(u),u)));};

test('explicit rows: the aggregate series is its own rows and equals the exact sum of the four Aziende in every selection',()=>{
  const packet=regionePacket();
  for(const period of PERIODS)for(const channel of CHANNELS)for(const trend of ['monthly','cumulative']){
    const agg=selectCReview(packet,scopedFilters('aggregato',{period,channel,trend}));
    const parts=ASL_UNITS.map(u=>selectCReview(packet,scopedFilters(u,{period,channel,trend})));
    agg.months.forEach((m,i)=>{
      assert.equal(m.exact,String(parts.reduce((s,p)=>s+Number(p.months[i].exact),0)),`${period} ${channel} ${trend} month ${i+1}`);
      assert.equal(m.rows,parts.reduce((s,p)=>s+p.months[i].rows,0));
    });
    assert.equal(agg.baseline.org,'aggregato');
    for(const [u,p] of ASL_UNITS.map((u,i)=>[u,parts[i]]))assert.equal(p.baseline.org,u);
  }
});

test('explicit rows: an Azienda series is only its own rows; the aggregate is never a budget scope',()=>{
  const packet=regionePacket();
  const own=selectCReview(packet,scopedFilters('asl-2',{period:'FY2025',channel:'CO'}));
  const rows=packet.monthly.filter(r=>r.org==='asl-2'&&r.year===2025&&r.channel==='CO');
  assert.deepEqual(own.months.map(m=>m.exact),rows.map(r=>r.net));
  const budget={channel:'CO',budgetPeriod:'FY2024',budget:'published',level:'Dipartimento'};
  assert.equal(selectCReview(packet,scopedFilters('asl-4',budget)).availableBudgets.length,1);
  assert.deepEqual(selectCReview(packet,scopedFilters('aggregato',budget)).availableBudgets,[]);
  assert.deepEqual(selectCReview(packet,scopedFilters('asl-1',budget)).availableBudgets,[],'no published act: empty, never zero');
  assert.deepEqual(selectCReview(packet,scopedFilters('aggregato',{countPeriod:'FY2025'})).counts.map(c=>c.org),['aggregato','aggregato']);
});

test('the trap explicit rows avoid: the reviewer summing rule over a merged packet counts the aggregate twice',()=>{
  const packet=regionePacket();
  const summed=clone(packet);delete summed.monthlyMode;for(const r of summed.monthly)if(r.org==='aggregato')r.org='Regione';
  const f=scopedFilters('aggregato',{period:'FY2025',channel:'Tutti'});
  const right=selectCReview(packet,f),wrong=selectCReview(summed,{...f,org:'Regione'});
  wrong.months.forEach((m,i)=>assert.equal(Number(m.exact),2*Number(right.months[i].exact),`month ${i+1}`));
});

test('reviewer selection is byte-identical to the pre-change implementation over the filter matrix',()=>{
  // Baseline computed from review.ts at commit 30e9e57 (before recommendation 5) on the same synthetic fixture.
  const packet=parseCReviewPacket(cReviewV2Fixture()),out=[];
  for(const org of ['Regione','AQ','CH','PE','TE'])for(const channel of ['Tutti','CO','DD','DPC'])for(const period of ['FY2024','FY2025','JM2025','JM2026'])for(const comparison of ['K1','K2'])for(const trend of ['monthly','cumulative']){
    for(const v of [{},{budgetPeriod:'FY2024',budget:'published',level:'Dipartimento'},{budgetPeriod:'FY2025',budget:'synthetic',level:'Disciplina',budgetOrder:'difference'},{countPeriod:'FY2024',portfolio:'ONC'}])
      out.push(selectCReview(packet,{...DEFAULT_C_REVIEW,org,channel,period,comparison,trend,...v}));
  }
  assert.equal(createHash('sha256').update(JSON.stringify(out)).digest('hex'),'0b6f08bd4a31df0667de9e31b827d03e6cfff2d93f19e2c53b50bd81c2b1d4cb');
});

test('the fixture bucket itself carries no province key and no reviewer aggregate key in any identifier or name',()=>{
  for(const [path,bytes] of fixture.files){
    assert.doesNotMatch(path,/(^|[^A-Za-z])(AQ|CH|PE|TE)([^A-Za-z]|$)|Regione/);
    assert.doesNotMatch(bytes.toString(),/"org":"(AQ|CH|PE|TE|Regione)"/);
  }
});
