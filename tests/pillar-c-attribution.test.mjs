import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {cAttrAtoms,cAttrDecimal,cAttrSum,cAttrPriority,cAttrScope,cAttrUncertain,cAttrShare,parseCAttrPacket,buildCAttrPacket} from '../lib/dashboard-review/pillar-c/attribution.ts';
import {loadCAttrView} from '../lib/dashboard-review/pillar-c/attribution-loader.ts';
import {cWorkbookDecimal} from '../lib/dashboard-review/pillar-c/workbook.ts';
import {attributionFixture} from './fixtures/pillar-c-attribution.mjs';

test('exact source arithmetic retains 21 decimal places and display ties without row rounding',()=>{
  const s=cAttrSum(['1.004','0.001','-0.000000000000000000001']);
  assert.equal(s,'1.004999999999999999999');assert.equal(cWorkbookDecimal(s,2),'1,00');
  assert.equal(cWorkbookDecimal(cAttrSum(['1.004','0.001']),2),'1,01');
  assert.equal(cAttrDecimal(cAttrAtoms('3.0000000000000001E-3')),'0.0030000000000000001');
  assert.equal(cAttrDecimal(cAttrAtoms('-0')),'0');
  for(const bad of ['NaN','Infinity','1.0000000000000000000001'])assert.throws(()=>cAttrAtoms(bad));
});
test('status spending conserves scope and never calls missing local allocation zero',()=>{
  const p=parseCAttrPacket(attributionFixture()),s=cAttrScope(p,'FY2025','AQ','CO');
  assert.equal(s.observedAllocation,null);assert.equal(s.total.net,'294');assert.equal(s.total.abs,'314');
  assert.deepEqual(cAttrUncertain(s),{net:'282',abs:'302'});
  assert.equal(s.states.S3.net,'90');assert.equal(s.states.S3.abs,'110');assert.equal(s.states.S3.negative,'-10');
  assert.equal(cAttrScope(p,'FY2025','CH','DD').total.net,'6');
  assert.equal(cAttrScope(p,'FY2025','AQ','DD'),undefined);
  assert.equal(cAttrShare('0','0'),null);
});
test('conditional ranges respect negative adjustments and unknowns without equal splits',()=>{
  const s=cAttrScope(attributionFixture(),'FY2025','AQ','CO'),a=s.bounds.find(b=>b.id==='AA'),b=s.bounds.find(b=>b.id==='BB');
  assert.deepEqual([a.fixed,a.lower1,a.upper1,a.lower2,a.upper2],['12','2','112','2','304']);
  assert.deepEqual([b.fixed,b.lower1,b.upper1],['0','-10','100']);
  assert.equal(a.shared.abs,'110');assert.equal(b.shared.abs,'110');
  assert.equal(cAttrSum([a.shared.abs,b.shared.abs]),'220','candidate exposure is deliberately non-additive');
  assert.equal(s.states.S3.abs,'110');
});
test('priority threshold has a precise denominator and query does not restart cumulative ranking',()=>{
  const s=cAttrScope(attributionFixture(),'FY2025','AQ','CO'),therapeutic=cAttrPriority(s),all=cAttrPriority(s,'all');
  assert.equal(therapeutic.total,'112');assert.equal(therapeutic.count,3);assert.equal(therapeutic.n80,1);
  assert.equal(therapeutic.rows[0].key,'900000002');assert.equal(therapeutic.rows[0].abs,'90');
  assert.equal(all.total,'302');assert.equal(all.n80,2);assert.equal(all.rows[0].key,'E-unknown');
  const searched=cAttrPriority(s,'therapeutic','900000003');
  assert.equal(searched.total,'112');assert.equal(searched.n80,1);assert.equal(searched.rows.length,1);
  assert.equal(searched.rows[0].rank,2);assert.equal(searched.rows[0].cumulative,'110');
  assert.equal(cAttrPriority(s,'S4').n80,1);assert.equal(cAttrPriority(s,'S3','not found').rows.length,0);
  assert.equal(cAttrPriority(s,'therapeutic','sintetica B',attributionFixture().portfolios).rows.length,2,'candidate-area names are searchable, not just internal IDs');
});
test('observed zero survives while a prior-year-only product is not invented in the selected year',()=>{
  const p=attributionFixture(),s=cAttrScope(p,'FY2025','AQ','CO');
  assert.equal(s.products.find(r=>r.key==='900000005').n,1);assert.equal(s.products.find(r=>r.key==='900000005').abs,'0');
  assert.equal(s.products.some(r=>r.key==='900000099'),false);
  assert.equal(cAttrScope(p,'FY2024','AQ','CO').products.find(r=>r.key==='900000099').net,'7');
  assert.equal(cAttrScope(p,'JM2026','AQ','CO').total.net,'4');
  assert.equal(cAttrScope(p,'FY2026','AQ','CO'),undefined);
});
test('changed candidate sets within one product period remain separate, not last-write-wins',()=>{
  const p=attributionFixture(),row={anno:2025,mese:1,asl:'AQ',canale:'CO',prodotto_key:'900000001',atc:'TEST',c:'1',attribution_status:'S4',candidate_portfolios:[]};
  const out=buildCAttrPacket([row,{...row,attribution_status:'S3',candidate_portfolios:['AA','BB']}],p.portfolios,new Map(),'1'.repeat(64),'2'.repeat(64),'test');
  assert.equal(cAttrScope(out,'FY2025','AQ','CO').products.length,2);
  assert.throws(()=>buildCAttrPacket([{...row,attribution_status:'S3',candidate_portfolios:['AA','AA']}],p.portfolios,new Map(),'1'.repeat(64),'2'.repeat(64),'test'));
});
test('parser rejects leakage, amount tampering, malformed totals and invented local allocations',()=>{
  for(const change of [p=>p.scopes[0].observedAllocation='0',p=>p.scopes[0].products[0].patientId='should not be accepted',p=>p.scopes[0].total.net='999',p=>p.scopes[0].bounds[0].upper1='999',p=>p.scopes[0].states.S3.negative='1',p=>p.portfolios[0].id='AA/path']) {
    const p=attributionFixture();change(p);assert.throws(()=>parseCAttrPacket(p));
  }
});
test('unauthorized callers never touch data or shared caches, including custom readers',async()=>{
  let reads=0;const reader=async()=>{reads++;return null;};
  for(const [approved,reviewer] of [[false,false],[true,false],[false,true]])assert.equal((await loadCAttrView(approved,reviewer,'FY2025','Regione','Tutti',{},reader)).state,'forbidden');
  assert.equal(reads,0);
  assert.equal((await loadCAttrView(true,true,'FY2026','Regione','Tutti',{},reader)).state,'invalid');assert.equal(reads,0);
  assert.equal((await loadCAttrView(true,true,'FY2025','Regione','Tutti',{},reader)).state,'invalid');assert.equal(reads,1);
});
test('new private endpoint checks roles and validates filters, and UI mounts only the new attribution section',()=>{
  const route=readFileSync(new URL('../app/api/pillar-c/attribution/route.ts',import.meta.url),'utf8');
  assert.match(route,/!org \|\| !\(viewer\?\.isReviewer \|\| admin\)/);assert.match(route,/private, no-store/);assert.match(route,/invalid_scope/);
  const source=readFileSync(new URL('../components/dashboard-review/pillar-c/analytical-workspace.tsx',import.meta.url),'utf8');
  // 1.2b (D1): the reviewer mounts it once, inside section 3, reading the dossier's c_port_* scope.
  assert.equal((source.match(/<PillarCAttributionAnalysis pageScope\s*\/>/g)||[]).length,1);
  assert.equal((source.match(/<PillarCAttributionAnalysis\b/g)||[]).length,1);
  assert.doesNotMatch(source,/section="attribuzione"/);
});
