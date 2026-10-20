// Pillar C organisation-scoped delivery on the PRIVATE build (outputs/pillar-c/rec5/build, rec5-scoped-v1):
// the app's own closed parsers, loaders and guard over every built object, and parity with the reviewer
// views and selections built from the reviewer-pinned originals. Pass/fail only: no figure, count, name or
// mapping is printed or written. Skips where the private outputs are absent (CI, other machines).
//
// Every comparison is reduced to a boolean BEFORE it reaches node:assert (review finding R5-DP-03): a failing
// deepStrictEqual or match prints its whole actual and expected values, which here are private euro amounts,
// product labels and budget rows. check() fails with actual false, expected true and a message that names only
// the unit, scope or field. The last two tests pin that, and run without the private data.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {existsSync,readFileSync,readdirSync} from 'node:fs';
import {isDeepStrictEqual} from 'node:util';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {C_SCOPED_STORAGE} from '../lib/dashboard-review/pillar-c/scoped-storage.ts';
import {loadCScopedReview,loadCScopedAttrView,loadCScopedPortfolioView} from '../lib/dashboard-review/pillar-c/scoped-loader.ts';
import {guardCScopedPayload} from '../lib/dashboard-review/pillar-c/payload-guard.ts';
import {parseCPortfolioPacket,cPortfolioView} from '../lib/dashboard-review/pillar-c/portfolio.ts';
import {loadCAttrView} from '../lib/dashboard-review/pillar-c/attribution-loader.ts';
import {loadCPortfolioView} from '../lib/dashboard-review/pillar-c/portfolio-loader.ts';
import {parseCReviewPacket,selectCReview,DEFAULT_C_REVIEW,C_ORGS} from '../lib/dashboard-review/pillar-c/review.ts';
import {C_REVIEW_STORAGE} from '../lib/dashboard-review/pillar-c/review-storage.ts';

const OUT=fileURLToPath(new URL('../../outputs/pillar-c/',import.meta.url));
const BUILD=path.join(OUT,'rec5','build');
const ATTR_ROOT=path.join(OUT,'attribution-dashboard-20261018'),PORT_ROOT=path.join(OUT,'portfolio-dashboard-20261018');
const R5=path.join(OUT,'dashboard-review-20261015-r5','pillar-c-review-packet-r5.json');
const present=[BUILD,ATTR_ROOT,PORT_ROOT,R5].every(existsSync);
const skip=present?false:'the private Pillar C build and originals are not available locally';
const UNITS=['asl-1','asl-2','asl-3','asl-4','aggregato'],ASL=UNITS.slice(0,4);
const PERIODS=['FY2024','FY2025','JM2025','JM2026'],CHANNELS=['Tutti','CO','DD','DPC'];
const azienda=unit=>({kind:'azienda',orgCode:`20${unit.slice(4)}`,orgName:'Azienda',unit,units:[unit,'aggregato']});
const REGIONE={kind:'regione',orgCode:'130',units:['aggregato',...ASL]};
/** A session that Storage admits to every unit: the build folder as the bucket. */
const local={storage:{from:bucket=>({download:async p=>{
  const file=path.join(BUILD,...String(p).split('/'));
  if(bucket!=='pillar-c-scoped'||!existsSync(file))return {data:null,error:{status:400}};
  return {data:new Blob([readFileSync(file)]),error:null};
}})}};
const quietly=async fn=>{const o=console.warn,lines=[];console.warn=(...a)=>lines.push(a.join(' '));try{return await fn();}finally{console.warn=o;if(lines.length)console.log(`scoped log codes: ${[...new Set(lines)].join(', ')}`);}};
const rekey=(value,from,to)=>JSON.parse(JSON.stringify(value).replaceAll(`"org":"${from}"`,`"org":"${to}"`));
/** Pass/fail only. `label` names the unit, scope or field; it never carries a value from the private data. */
const check=(condition,label)=>assert.equal(condition===true,true,label);
/** A guard refusal names its rule and the field path (PCS_GUARD_<RULE> <path>), never the refused value. */
const guardRefusal=fn=>{try{fn();return null;}catch(e){return String(e?.message??'error').split(' ').slice(0,2).join(' ');}};

test('every unit folder holds exactly its pinned index and the objects that index references',{skip},()=>{
  for(const unit of UNITS){
    const names=readdirSync(path.join(BUILD,'v1',unit)).sort();
    const indexName=`index-${C_SCOPED_STORAGE.index[unit]}.json`,bytes=readFileSync(path.join(BUILD,'v1',unit,indexName));
    check(createHash('sha256').update(bytes).digest('hex')===C_SCOPED_STORAGE.index[unit],`${unit}: index matches its pin`);
    const ix=JSON.parse(bytes.toString()),refs=[ix.review,...Object.values(ix.attribution.scopes),...Object.values(ix.portfolio.scopes)];
    check(isDeepStrictEqual(names,[indexName,...refs.map(r=>r.name)].sort()),`${unit}: the folder holds exactly the index and the objects it references`);
    for(const name of names)check(/^v[1-9][0-9]{0,2}\/(asl-[1-4]|aggregato)\/[A-Za-z0-9]+(-[A-Za-z0-9]+)*-[0-9a-f]{64}[.]json$/.test(`v1/${unit}/${name}`),`${unit}: every object name matches the policy`);
  }
});

test('the review projection loads, merges and passes the guard for all five audiences; the aggregate is the exact sum of the four',{skip},async()=>{
  for(const audience of [...ASL.map(azienda),REGIONE]){
    const label=audience.kind==='azienda'?audience.unit:'regione';
    const r=await quietly(()=>loadCScopedReview(audience,local));
    check(r.state==='ready',`${label}: review ready`);
    check(isDeepStrictEqual(r.packet.orgs,[...audience.units]),`${label}: packet units are the audience's, in order`);
    check(r.packet.budgets.every(b=>b.basis==='published'),`${label}: published budgets only`);
  }
});

test('every attribution and portfolio scope of every unit loads through the app loaders and passes the guard',{skip},async()=>{
  for(const unit of UNITS){
    const audience=unit==='aggregato'?azienda('asl-1'):azienda(unit);
    for(const period of PERIODS)for(const channel of CHANNELS){
      const a=await quietly(()=>loadCScopedAttrView(audience,local,period,unit,channel));
      check(a.state==='ready',`attr ${unit} ${period} ${channel}: ready`);
      const p=await quietly(()=>loadCScopedPortfolioView(audience,local,period,unit,channel,a.view.portfolios[0].id));
      check(p.state==='ready',`port ${unit} ${period} ${channel}: ready`);
    }
  }
});

test('every portfolio dossier of every scope passes the token rule with only its own unit admitted',{skip},()=>{
  for(const unit of UNITS){
    const ix=JSON.parse(readFileSync(path.join(BUILD,'v1',unit,`index-${C_SCOPED_STORAGE.index[unit]}.json`)).toString()).portfolio;
    for(const [later,earlier] of [['FY2025','FY2024'],['JM2026','JM2025']])for(const channel of CHANNELS){
      const shards=[later,earlier].map(p=>JSON.parse(readFileSync(path.join(BUILD,'v1',unit,ix.scopes[`${p}|${unit}|${channel}`].name)).toString()));
      const packet=parseCPortfolioPacket({schema:'pillar-c-portfolio-v1',precision:ix.precision,sourceSha256:ix.sourceSha256,classificationSha256:ix.classificationSha256,mappingVersion:ix.mappingVersion,portfolios:ix.portfolios,scopes:shards},[unit]);
      ix.portfolios.forEach(({id},i)=>{for(const period of [later,earlier]){
        const refused=guardRefusal(()=>guardCScopedPayload('portfolio',cPortfolioView(packet,period,unit,channel,id,C_SCOPED_STORAGE.index[unit]),[unit]));
        check(refused===null,`${unit} ${period} ${channel} portfolio #${i + 1}: the guard admits it${refused?` (${refused})`:''}`);
      }});
    }
  }
});

test('the aggregate views equal the reviewer’s «Regione» views except the key and the source snapshot',{skip},async()=>{
  for(const period of PERIODS)for(const channel of CHANNELS){
    const scoped=await quietly(()=>loadCScopedAttrView(REGIONE,local,period,'aggregato',channel));
    const reviewer=await loadCAttrView(true,true,period,'Regione',channel,{root:ATTR_ROOT});
    check(scoped.state==='ready'&&reviewer.state==='ready',`attr ${period} ${channel}: both views ready`);
    check(isDeepStrictEqual({...rekey(scoped.view,'aggregato','Regione'),sourceSnapshot:reviewer.view.sourceSnapshot},JSON.parse(JSON.stringify(reviewer.view))),`attr ${period} ${channel}: aggregate view equals the reviewer view`);
    const id=reviewer.view.portfolios[period==='FY2025'?0:reviewer.view.portfolios.length-1].id;
    const ps=await quietly(()=>loadCScopedPortfolioView(REGIONE,local,period,'aggregato',channel,id));
    const pr=await loadCPortfolioView(true,true,period,'Regione',channel,id,{root:PORT_ROOT});
    check(ps.state==='ready'&&pr.state==='ready',`port ${period} ${channel}: both views ready`);
    check(isDeepStrictEqual({...rekey(ps.view,'aggregato','Regione'),sourceSnapshot:pr.view.sourceSnapshot},JSON.parse(JSON.stringify(pr.view))),`port ${period} ${channel}: aggregate view equals the reviewer view`);
  }
});

const sha=f=>createHash('sha256').update(readFileSync(f)).digest('hex');
test('explicit-rows selections equal the reviewer’s summed selections: the aggregate for «Regione», each unit for exactly one distinct Azienda',{skip:skip||(sha(R5)!==C_REVIEW_STORAGE.sha256?'the R5 packet differs from its pin':false)},async()=>{
  const reviewer=parseCReviewPacket(JSON.parse(readFileSync(R5,'utf8')));
  const r=await quietly(()=>loadCScopedReview(REGIONE,local));check(r.state==='ready','regione: review ready');
  const scoped=r.packet;
  const filters=[];
  for(const period of PERIODS)for(const channel of CHANNELS)for(const trend of ['monthly','cumulative'])for(const comparison of ['K1','K2'])filters.push({period,channel,trend,comparison});
  const comparable=(sel,from,to)=>{const s=rekey(sel,from,to);return {baseline:s.baseline,months:s.months,bridge:s.bridge,left:s.left,right:s.right,counts:s.counts};};
  const equal=(unit,org)=>filters.every(f=>JSON.stringify(comparable(selectCReview(scoped,{...DEFAULT_C_REVIEW,...f,org:unit,countPeriod:f.period==='FY2024'?'FY2024':'FY2025'}),unit,org))===JSON.stringify(comparable(selectCReview(reviewer,{...DEFAULT_C_REVIEW,...f,org,countPeriod:f.period==='FY2024'?'FY2024':'FY2025'}),org,org)));
  check(equal('aggregato','Regione'),'aggregate = reviewer Regione in every selection');
  // The unit-to-Azienda correspondence is discovered, never named: each unit matches exactly one reviewer key, all distinct.
  const matches=ASL.map(unit=>C_ORGS.filter(o=>o!=='Regione'&&equal(unit,o)));
  check(matches.every(m=>m.length===1),'each unit matches exactly one Azienda');
  check(new Set(matches.map(m=>m[0])).size===4,'the four matches are distinct');
  // Published acts: the same rows in the same selection order after the id re-mint.
  ASL.forEach((unit,i)=>{
    const org=matches[i][0],pick=b=>[b.period,b.channel,b.level,b.area,b.budget,b.actual,b.alternative];
    for(const channel of ['CO','DD','DPC'])for(const budgetPeriod of ['FY2024','FY2025','JM2026'])for(const level of ['Dipartimento','Disciplina'])for(const budgetOrder of ['amount','difference']){
      const f={...DEFAULT_C_REVIEW,channel,budgetPeriod,level,budgetOrder,budget:'published'};
      check(isDeepStrictEqual(selectCReview(scoped,{...f,org:unit}).budgets.map(pick),selectCReview(reviewer,{...f,org}).budgets.map(pick)),`${unit} ${channel} ${budgetPeriod} ${level} ${budgetOrder}: published budgets in order`);
    }
  });
});

// ------------------------------------------------- the reporting rule itself, without private data
test('a failed comparison reports booleans and its label only, never a compared value',()=>{
  const privateLike={amount:'987654.32',label:'Prodotto riservato sintetico'};
  let error=null;
  try{check(isDeepStrictEqual(privateLike,{...privateLike,amount:'0'}),'asl-9 attr FY2025 Tutti: aggregate view equals the reviewer view');}catch(e){error=e;}
  assert.ok(error,'the check fails');
  assert.equal(error.actual,false);assert.equal(error.expected,true);
  // The label, and at most the boolean diff that newer Node versions append to a custom message.
  const label='asl-9 attr FY2025 Tutti: aggregate view equals the reviewer view';
  assert.ok([label,`${label}\n\nfalse !== true\n`].includes(error.message),'the message is the label and booleans only');
  const reported=`${error.message} ${error.stack} ${JSON.stringify({actual:error.actual,expected:error.expected,generatedMessage:error.generatedMessage})}`;
  assert.doesNotMatch(reported,/987654|Prodotto riservato/,'no compared value in what the runner prints');
  // A guard refusal is reduced to its rule and path.
  assert.equal(guardRefusal(()=>{throw new Error('PCS_GUARD_DESC products[3].label');}),'PCS_GUARD_DESC products[3].label');
  assert.equal(guardRefusal(()=>null),null);
});

test('this file compares private data through check() only: no deep, match or throws assertion on a private value',()=>{
  const source=readFileSync(fileURLToPath(import.meta.url),'utf8');
  const privatePart=source.slice(source.indexOf("test('every unit folder"),source.indexOf('// ------------------------------------------------- the reporting rule itself'));
  assert.ok(privatePart.length>1000);
  assert.doesNotMatch(privatePart,/assert\.(deepEqual|deepStrictEqual|notDeepEqual|notDeepStrictEqual|partialDeepStrictEqual|match|doesNotMatch|throws|rejects|doesNotThrow|doesNotReject|equal|notEqual|strictEqual|ok)\(/,'only check() inside the private tests');
  assert.equal((privatePart.match(/assert\.equal\(/g)??[]).length,0);
});
