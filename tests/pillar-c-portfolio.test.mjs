import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildCPortfolioPacket,parseCPortfolioPacket,cPortfolioView,cPortfolioProductChanges} from '../lib/dashboard-review/pillar-c/portfolio.ts';
import {loadCPortfolioView} from '../lib/dashboard-review/pillar-c/portfolio-loader.ts';

// Explicit fictional fixtures only. No pilot amounts or product identifiers are committed.
function fixture(){
  const row=(key,c,state,candidates,year=2025,month=1,atc='TEST',org='AQ',channel='CO')=>({anno:year,mese:month,asl:org,canale:channel,prodotto_key:key,atc,c,attribution_status:state,candidate_portfolios:candidates});
  const portfolios=[{id:'AA',label:'Area sintetica A',kind:'area_terapeutica'},{id:'BB',label:'Area sintetica B',kind:'area_terapeutica'}];
  const rows=[row('900000001','10.004','S2',['AA']),row('900000001','0.001','S2',['AA'],2025,2),row('900000002','-3','S2',['AA'],2025,2),row('900000003','0','S2',['AA'],2025,3),row('900000004','100','S3',['AA','BB']),row('900000004','-20','S3',['AA','BB'],2025,2),row('900000005','2','S4',[]),row('UNKNOWN','5','S5',[]),row('900000001','8','S2',['AA'],2024),row('900000006','4','S2',['AA'],2024),row('900000007','1','S2',['BB']),row('900000001','6','S2',['AA'],2026),row('900000001','50','S2',['AA'],2025,7),row('900000008','3','S2',['BB'],2025,1,'TEST','CH','DD')];
  return buildCPortfolioPacket(rows,portfolios,new Map(rows.map(r=>[r.prodotto_key,`Prodotto sintetico ${r.prodotto_key}`])),'1'.repeat(64),'2'.repeat(64),'fictional-test-only');
}
const view=(p=fixture(),period='FY2025',id='AA')=>cPortfolioView(p,period,'AQ','CO',id,'3'.repeat(64));

test('portfolio dossier exact sums reconcile all 80 scopes; S3 exposure never becomes fixed allocation',()=>{
  const p=parseCPortfolioPacket(fixture()),v=view(p);assert.equal(p.scopes.length,80);assert.equal(v.dossier.fixed.net,'57.005');assert.equal(v.dossier.shared.net,'80');assert.equal(v.dossier.shared.abs,'120');assert.equal(v.dossier.observedAllocation,null);assert.equal(v.scope.total.net,'145.005');
  assert.equal(v.summaries[1].shared.abs,'120');assert.equal(v.scope.states.S3.abs,'120');assert.equal(v.dossier.lower1,'37.005');assert.equal(v.dossier.upper1,'157.005');assert.equal(v.dossier.upper2,'164.005');
  assert.equal(v.mappingStatus,'draft');assert.equal(v.attributionBasis,'atc-portfolio-proxy');assert.equal(v.sourceSha256,'1'.repeat(64));assert.equal(v.sourceSnapshot,'3'.repeat(64));
});
test('monthly absence is null while an explicitly reported zero retains a row and amount',()=>{
  const v=view();assert.equal(v.dossier.monthly.length,12);assert.equal(v.dossier.monthly[2].fixed.net,'0');assert.equal(v.dossier.monthly[2].fixed.n,1);assert.equal(v.dossier.monthly[3].fixed,null);assert.equal(v.dossier.monthly[3].shared,null);
  const jm=view(fixture(),'JM2026');assert.equal(jm.dossier.monthly.length,5);assert.equal(jm.comparison.scope.period,'JM2025');assert.equal(jm.comparison.dossier.fixed.net,'7.005');assert.equal(jm.dossier.fixed.net,'6');assert.equal(jm.change,'-1.005');
});
test('fixed product changes conserve change exactly with entry/exit at portfolio grain and observed zero',()=>{
  const v=view();assert.equal(v.change,'45.005');assert.deepEqual(v.changePeriods,{from:'FY2024',to:'FY2025'});assert.equal(v.changeSemantic,'later-minus-earlier');
  const continuing=v.productChanges.find(p=>p.key==='900000001');assert.equal(continuing.kind,'continuing');assert.equal(continuing.delta,'52.005');
  const exit=v.productChanges.find(p=>p.key==='900000006');assert.equal(exit.kind,'exit');assert.equal(exit.current,null);assert.equal(exit.previous.net,'4');assert.equal(exit.delta,'-4');
  const zero=v.productChanges.find(p=>p.key==='900000003');assert.equal(zero.kind,'entry');assert.equal(zero.current.net,'0');assert.equal(zero.previous,null);
  assert.equal(v.productChanges.some(p=>p.key==='900000004'),false,'shared exposure cannot explain a fixed-spend bridge');
  const backwards=view(fixture(),'FY2024');assert.equal(backwards.change,v.change);assert.deepEqual(backwards.productChanges,v.productChanges);assert.deepEqual(backwards.changePeriods,v.changePeriods);
});
test('same product with a different ATC remains distinct evidence instead of overwriting identity',()=>{
  const r={anno:2025,mese:1,asl:'AQ',canale:'CO',prodotto_key:'900000001',atc:'TEST',c:'1',attribution_status:'S2',candidate_portfolios:['AA']};
  const p=buildCPortfolioPacket([r,{...r,atc:'OTHER'}],fixture().portfolios,new Map(),'1'.repeat(64),'2'.repeat(64),'fictional');
  assert.equal(view(p).dossier.products.length,2);assert.equal(view(p).dossier.fixed.net,'2');assert.equal(view(p).productChanges.length,2);
});
test('parser rejects private fields, missing monthly cells, unbalanced products, invented observed allocation and altered bounds',()=>{
  for(const change of [p=>p.scopes[0].dossiers[0].observedAllocation='0',p=>p.scopes[0].dossiers[0].monthly.pop(),p=>p.scopes[0].dossiers[0].lower1='999',p=>p.scopes[0].total.net='999',p=>p.scopes[0].patient='not allowed',p=>{const d=p.scopes.find(s=>s.period==='FY2025'&&s.org==='AQ'&&s.channel==='CO').dossiers[0];d.products[0].net='999';},p=>p.portfolios[1].id=p.portfolios[0].id]){const p=fixture();change(p);assert.throws(()=>parseCPortfolioPacket(p));}
});
test('unknown source classifications and out-of-window months are rejected rather than silently excluded',()=>{
  const r={anno:2025,mese:1,asl:'AQ',canale:'CO',prodotto_key:'900000001',atc:'TEST',c:'1',attribution_status:'S2',candidate_portfolios:['AA']};
  for(const altered of [{...r,candidate_portfolios:['AA','BB']},{...r,attribution_status:'S1'},{...r,anno:2026,mese:6},{...r,candidate_portfolios:['ZZ']},{...r,c:'1.0000000000000000000001'}])assert.throws(()=>buildCPortfolioPacket([altered],fixture().portfolios,new Map(),'1'.repeat(64),'2'.repeat(64),'test'));
  assert.throws(()=>cPortfolioProductChanges(view().dossier,view(fixture(),'FY2024','BB').dossier));
});
test('authorization and parameter checks occur before reads and cache access',async()=>{
  let reads=0;const reader=async()=>{reads++;return null;};
  for(const [approved,reviewer]of[[false,false],[true,false],[false,true]])assert.equal((await loadCPortfolioView(approved,reviewer,'FY2025','Regione','Tutti','AA',{},reader)).state,'forbidden');assert.equal(reads,0);
  for(const [period,org,channel,id]of[['FY2026','Regione','Tutti','AA'],['FY2025','OTHER','Tutti','AA'],['FY2025','Regione','OTHER','AA'],['FY2025','Regione','Tutti','../AA']])assert.equal((await loadCPortfolioView(true,true,period,org,channel,id,{},reader)).state,'invalid');assert.equal(reads,0);
  assert.equal((await loadCPortfolioView(true,true,'FY2025','Regione','Tutti','AA',{},reader)).state,'invalid');assert.equal(reads,1);
});
test('private route repeats live role checks and private no-store headers',()=>{
  const source=readFileSync(new URL('../app/api/pillar-c/portfolio/route.ts',import.meta.url),'utf8');assert.match(source,/!org \|\| !\(viewer\?\.isReviewer \|\| admin\)/);assert.match(source,/private, no-store/);assert.match(source,/invalid_scope/);assert.doesNotMatch(source,/anonymous|isPublicPath/);
});
