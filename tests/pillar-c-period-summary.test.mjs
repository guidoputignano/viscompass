// Synthetic fixtures only; no source packet, production pin or patient record.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {parseCPeriodSummary as parse} from '../lib/dashboard-review/pillar-c/period-summary-parse.ts';
import {C_PERIOD_AGE_IDS,C_PERIOD_USE_IDS} from '../lib/dashboard-review/pillar-c/period-summary.ts';

const absent=(reason='unsupported')=>({status:'unavailable',reason});
const withheld=()=>({status:'withheld',reason:'disclosure'});
function dist(ids,total=100) {
  return {status:'released',total,cells:ids.map((id,i)=>({id,count:i===0?total:0,share:i===0&&total?1:0}))};
}
function packet(unit='asl-1',from='2025-01',to=from) {
  const months=[];
  for(let y=Number(from.slice(0,4)),m=Number(from.slice(5));`${y}-${String(m).padStart(2,'0')}`<=to;m++) {
    if(m===13){m=1;y++;}
    const month=`${y}-${String(m).padStart(2,'0')}`;
    if(month>to)break;
    months.push({month,status:'records'});
  }
  return {schema:'pillar-c-period-summary-v1',id:`file-f.${unit}.${from}.${to}`,version:1,
    unit,sourceFamily:'file-f',mode:'synthetic',
    window:{from,to,timeBasis:'recorded-dispensing-month',ageReferenceYear:2025,certifiedComplete:false,months},
    populationBasis:'recorded-identifiers-within-unit',
    release:{numericalVerificationSha256:'a'.repeat(64),disclosureReviewSha256:'b'.repeat(64)},
    recipients:{status:'released',value:100},age:dist(C_PERIOD_AGE_IDS),
    use:{packs:dist(C_PERIOD_USE_IDS),products:dist(C_PERIOD_USE_IDS),contacts:dist(C_PERIOD_USE_IDS)},
    cost:{quartiles:{status:'released',n:100,q1:10,median:20,q3:30},
      concentration:{status:'released',n:100,gini:.4,lorenz:Array.from({length:11},(_,i)=>(i/10)**2)}}};
}
function serialize(p) {
  const raw=Buffer.from(JSON.stringify(p));
  const pin={sha256:createHash('sha256').update(raw).digest('hex'),bytes:raw.length,...p.release,
    id:p.id,version:p.version,unit:p.unit,sourceFamily:p.sourceFamily,mode:p.mode,
    from:p.window.from,to:p.window.to,timeBasis:p.window.timeBasis};
  return {raw,pin};
}
function read(p) {const {raw,pin}=serialize(p);return parse(raw,pin,{allowSynthetic:true});}
function reject(p){assert.throws(()=>read(p),/^Error: C_PERIOD_SUMMARY_INVALID$/);}

test('two holders and different months retain exact selection metadata and do not pool statistics',()=>{
  for(const unit of ['asl-1','asl-2'])for(const month of ['2025-01','2025-02']) {
    const p=packet(unit,month),r=read(p);
    assert.equal(r.unit,unit);assert.equal(r.window.from,month);assert.equal(r.window.to,month);
    assert.equal(r.recipients.value,100);assert.equal(r.cost.quartiles.median,20);
    assert.equal('release' in r,false);
  }
  const p=packet('asl-1','2025-01','2025-02');p.recipients.value=150;
  p.age=dist(C_PERIOD_AGE_IDS,150);for(const key of Object.keys(p.use))p.use[key]=dist(C_PERIOD_USE_IDS,150);
  p.cost.quartiles.n=p.cost.concentration.n=150;
  assert.equal(read(p).recipients.value,150,'precomputed window union, never sum of the monthly counts');
  reject({...packet(),unit:'aggregato'});
});
test('bytes, hash, exact holder and period must match independently supplied trusted pins',()=>{
  const {raw,pin}=serialize(packet());
  for(const bad of [{...pin,sha256:'f'.repeat(64)},{...pin,bytes:raw.length+1},
    {...pin,unit:'asl-2'},{...pin,from:'2025-02',to:'2025-02'}, {...pin,version:2},
    {...pin,disclosureReviewSha256:'c'.repeat(64)},{...pin,numericalVerificationSha256:'d'.repeat(64)}])
    assert.throws(()=>parse(raw,bad,{allowSynthetic:true}),/C_PERIOD_SUMMARY_INVALID/);
  const changed=Buffer.from(raw);changed[2]=100;
  assert.throws(()=>parse(changed,pin,{allowSynthetic:true}),/C_PERIOD_SUMMARY_INVALID/);
});
test('synthetic input needs explicit fixture mode and cannot be the default production packet',()=>{
  const {raw,pin}=serialize(packet());assert.throws(()=>parse(raw,pin),/C_PERIOD_SUMMARY_INVALID/);
  const p=packet();p.mode='real';const fixture=serialize(p);
  assert.equal(parse(fixture.raw,fixture.pin).mode,'real');
});
test('closed schema rejects source identities and unexpected data at every nested level',()=>{
  for(const mutate of [p=>p.recipientId='private-key',p=>p.window.organizationName='private-name',
    p=>p.recipients.ids=['private-key'],p=>p.age.cells[0].recipientIds=['private-key'],
    p=>p.use.products.rows=[],p=>p.cost.quartiles.values=[1,2,3],
    p=>p.cost.concentration.spendAmounts=[1,2,3],p=>p.release.approved=true]){
    const p=packet();mutate(p);reject(p);
  }
});
test('small counts are withheld as whole partitions, never leaked through remaining cells',()=>{
  for(const mutate of [p=>p.recipients.value=4,p=>p.age.cells[0].count=4,
    p=>p.use.contacts.cells[1].count=1,p=>p.cost.quartiles.n=4]){
    const p=packet();mutate(p);reject(p);
  }
  const p=packet();p.age=withheld();assert.deepEqual(read(p).age,withheld());
  p.age={...withheld(),total:100};reject(p);
});
test('count/share checks need exact denominators and retain unknown ages',()=>{
  for(const mutate of [p=>delete p.age.cells[0].count,p=>p.age.total=200,
    p=>p.age.cells.pop(),p=>p.age.cells[0].share=.99,p=>p.age.cells[9].id='other',
    p=>p.use.packs.cells.reverse(),p=>p.use.products.cells[0].count=99]){
    const p=packet();mutate(p);reject(p);
  }
  const p=packet();p.age.cells[0].count=95;p.age.cells[0].share=.95;p.age.cells[9].count=5;p.age.cells[9].share=.05;
  assert.equal(read(p).age.cells[9].id,'unknown');assert.equal(read(p).age.cells[9].count,5);
});
test('certified zero is distinct from missing source and uncertified empty, without fabricated statistics',()=>{
  const p=packet();p.window.months[0].status='certified-zero';p.window.certifiedComplete=true;
  p.recipients.value=0;p.age=dist(C_PERIOD_AGE_IDS,0);
  for(const k of Object.keys(p.use))p.use[k]=dist(C_PERIOD_USE_IDS,0);
  p.cost={quartiles:absent('no-recipients'),concentration:absent('no-recipients')};
  assert.equal(read(p).recipients.value,0);assert.equal(read(p).cost.quartiles.reason,'no-recipients');
  for(const [status,reason] of [['missing','missing-source'],['uncertified-empty','uncertified-empty']]) {
    const candidate=packet();candidate.window.months[0].status=status;
    reject(candidate);
    candidate.recipients=absent(reason);candidate.age=absent(reason);
    for(const k of Object.keys(candidate.use))candidate.use[k]=absent(reason);
    candidate.cost={quartiles:absent(reason),concentration:absent(reason)};
    assert.deepEqual(read(candidate).recipients,absent(reason));
    candidate.window.certifiedComplete=true;reject(candidate);
  }
});
test('a missing month cannot be silently dropped from a multi-month selection',()=>{
  const p=packet('asl-1','2025-01','2025-03');p.window.months.splice(1,1);reject(p);
  p.window.months.push({month:'2025-03',status:'records'});reject(p);
});
test('DPC reporting and File F recorded-dispensing clocks cannot be swapped',()=>{
  const p=packet();p.sourceFamily='nsis-dpc';reject(p);
  p.window.timeBasis='reporting-month';p.populationBasis='eligible-recipients-within-unit';
  assert.equal(read(p).window.timeBasis,'reporting-month');
});
test('quantiles are ordered per-unit values; concentration is bounded monotone and convex',()=>{
  for(const mutate of [p=>p.cost.quartiles.q1=25,p=>p.cost.quartiles.q3=15,
    p=>p.cost.quartiles.q3=NaN,p=>p.cost.concentration.gini=1.1,
    p=>p.cost.concentration.lorenz[5]=.6,p=>p.cost.concentration.lorenz[5]=.1,
    p=>p.cost.concentration.lorenz[4]=.2,p=>p.cost.concentration.lorenz[10]=.99]){
    const p=packet();mutate(p);reject(p);
  }
  const p=packet();p.recipients.value=10;p.age=dist(C_PERIOD_AGE_IDS,10);
  for(const key of Object.keys(p.use))p.use[key]=dist(C_PERIOD_USE_IDS,10);
  p.cost.quartiles.n=p.cost.concentration.n=10;reject(p);
  p.cost.concentration=withheld();assert.equal(read(p).cost.concentration.status,'withheld');
});
test('null and disclosure markers cannot be confused with zero or omitted values',()=>{
  const p=packet();p.use.contacts=absent('unsupported');assert.equal(read(p).use.contacts.reason,'unsupported');
  p.use.contacts=null;reject(p);delete p.use.contacts;reject(p);
  const q=packet();q.age={status:'withheld',reason:'unsupported'};reject(q);
});
test('returned objects are isolated clones and bad pin accessors are never evaluated',()=>{
  const p=packet();const{raw,pin}=serialize(p);const first=parse(raw,pin,{allowSynthetic:true});
  first.age.cells[0].count=0;
  assert.equal(parse(raw,pin,{allowSynthetic:true}).age.cells[0].count,100);
  Object.defineProperty(pin,'unit',{get(){throw Error('must-not-run');},enumerable:true});
  assert.throws(()=>parse(raw,pin,{allowSynthetic:true}),/^Error: C_PERIOD_SUMMARY_INVALID$/);
});
