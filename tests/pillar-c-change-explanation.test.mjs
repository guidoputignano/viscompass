import test from 'node:test';
import assert from 'node:assert/strict';
import {buildCPortfolioPacket,cPortfolioView} from '../lib/dashboard-review/pillar-c/portfolio.ts';
import {cPortfolioExplanation,cPortfolioExplanationSteps} from '../lib/dashboard-review/pillar-c/change-explanation.ts';

const row=(key,c,year)=>({anno:year,mese:1,asl:'AQ',canale:'CO',prodotto_key:key,atc:'TEST',c,attribution_status:'S2',candidate_portfolios:['AA']});
function view(rows,period='FY2025'){
 const p=buildCPortfolioPacket(rows,[{id:'AA',label:'Portafoglio sintetico',kind:'area_terapeutica'}],new Map(),'1'.repeat(64),'2'.repeat(64),'fictional');
 return cPortfolioView(p,period,'AQ','CO','AA','3'.repeat(64));
}
test('change explanation separates increases, reductions and entry/exit without dividing by net change',()=>{
 const rows=[row('900000001','100',2024),row('900000001','120',2025),row('900000002','30',2024),row('900000003','8',2025)];
 const v=view(rows),x=cPortfolioExplanation(v);
 assert.equal(x.net,'-2');assert.equal(x.positive,'28');assert.equal(x.negative,'-30');assert.equal(x.hasOffsets,true);assert.equal(x.direction,'decrease');
 assert.deepEqual(x.components.map(r=>[r.kind,r.count,r.value]),[['continuing',1,'20'],['entry',1,'8'],['exit',1,'-30']]);
 assert.equal(x.dominant.kind,'exit');assert.equal(x.opening,'130');assert.equal(x.closing,'128');
 assert.deepEqual(cPortfolioExplanation(view(rows,'FY2024')),x);
 assert.deepEqual(cPortfolioExplanationSteps(v).map(r=>[r.from,r.to]),[['0','20'],['20','28'],['28','-2']]);
});
test('a credit-only entry is a reduction; removal of a prior credit is an increase',()=>{
 const x=cPortfolioExplanation(view([row('900000001','-10.005',2024),row('900000002','-3.001',2025)]));
 assert.equal(x.positive,'10.005');assert.equal(x.negative,'-3.001');assert.equal(x.net,'7.004');
 assert.equal(x.increases.top[0].kind,'exit');assert.equal(x.decreases.top[0].kind,'entry');
});
test('zero net can hide offsetting changes, while missing observations are unavailable',()=>{
 const zero=cPortfolioExplanation(view([row('900000001','10',2024),row('900000002','10',2025)]));
 assert.equal(zero.direction,'unchanged');assert.equal(zero.hasOffsets,true);assert.equal(zero.positive,'10');assert.equal(zero.negative,'-10');
 const missing=cPortfolioExplanation(view([]));assert.equal(missing.state,'unavailable');assert.equal(missing.positive,null);assert.equal(missing.opening,null);assert.deepEqual(cPortfolioExplanationSteps(view([])),[]);
 const observed=cPortfolioExplanation(view([row('900000001','0',2024),row('900000001','0',2025)]));
 assert.equal(observed.state,'available');assert.equal(observed.opening,'0');assert.equal(observed.hasOffsets,false);assert.equal(observed.unchangedProducts,1);
});
test('top-three lists and the remaining contributions reconcile exactly with deterministic ties',()=>{
 const rows=['2.005','8','8','1','-4','-4','-5','-0.001'].map((n,i)=>row(`90000000${i+1}`,n,2025));
 const v=view(rows),before=JSON.stringify(v),x=cPortfolioExplanation(v);
 assert.deepEqual(x.increases.top.map(r=>r.key),['900000002','900000003','900000001']);assert.equal(x.increases.remainder,'1');
 assert.equal(x.decreases.remainder,'-0.001');assert.equal(x.net,'6.004');assert.equal(JSON.stringify(v),before);
 const altered=structuredClone(v);altered.change='999';assert.throws(()=>cPortfolioExplanation(altered));
});
