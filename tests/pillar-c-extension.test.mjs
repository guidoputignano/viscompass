// Pillar C extension (points 15-16): January DPC and File F packets. The closed-schema guard and its small-cell rule,
// the semantic parser, the reviewer and scoped loaders against a fake Storage, the audience matcher and the rendered
// blocks. Synthetic data only.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire,register} from 'node:module';
import {fileURLToPath} from 'node:url';
import {IDENTITY_STUBS,registerPillarCStubs,as} from './helpers/pillar-c-scoped-stubs.mjs';
import {fakeSessionClient} from './fixtures/pillar-c-scoped.mjs';
import {extUnit,extReviewer,extFixture,EXT_UNITS} from './fixtures/pillar-c-extension.mjs';

registerPillarCStubs({...IDENTITY_STUBS,
  'lib/dashboard-review/pillar-c/extension-storage.ts':`export const C_EXTENSION_STORAGE=new Proxy({},{get:(_,k)=>globalThis.__pcs.ext[k]});export const C_EXTENSION_MAX_BYTES=200000;`,
},{tsx:true});
// next/link is a CommonJS entry without an exports map: resolve it by its file name (the dossier's Pillar B link).
register('data:text/javascript,'+encodeURIComponent(`export async function resolve(s,c,n){return n(s==='next/link'?'next/link.js':s,c);}`),import.meta.url);
const root=fileURLToPath(new URL('..',import.meta.url));
const req=createRequire(`${root}package.json`),React=req('react'),{renderToStaticMarkup}=req('react-dom/server');
const {parseCExtensionUnit,parseCExtensionReviewer,cExtComplementCheck}=await import('../lib/dashboard-review/pillar-c/extension-parse.ts');
const {C_EXT_UNIT_LABELS}=await import('../lib/dashboard-review/pillar-c/extension.ts');
const {loadCExtensionReviewer,loadCExtensionScoped}=await import('../lib/dashboard-review/pillar-c/extension-loader.ts');
const {PillarCRecipientsSection,PillarCAttributionEvidence,PillarCFileFMonthly,cExtensionRecipientsCard}=await import('../components/dashboard-review/pillar-c/extension-sections.tsx');
const {PillarCResidentDrivers}=await import('../components/dashboard-review/pillar-c/extension-reviewer.tsx');
const {cScopedExtensionFor}=await import('../components/dashboard-review/pillar-c/scoped-workspace.tsx');

const AZ=['asl-3','aggregato'],ALL=['aggregato','asl-1','asl-2','asl-3','asl-4'];
const AZIENDA={kind:'azienda',orgCode:'203',orgName:'Azienda sintetica Tre',unit:'asl-3',units:AZ};
const REGIONE={kind:'regione',orgCode:'130',units:ALL};
const refuse=(fn,reason)=>assert.throws(fn,new RegExp(reason));
const mutate=(unit,f)=>{const p=structuredClone(extUnit(unit,unit==='aggregato'?4000:1000));f(p);return p;};

test('valid packets parse for every unit, and the aggregate holds no per-ASL value',()=>{
  for(const u of EXT_UNITS){const p=parseCExtensionUnit(extUnit(u,u==='aggregato'?4000:1000),u,ALL);assert.equal(p.unit,u);assert.equal(p.fileF!==null,u==='asl-3');}
  const r=parseCExtensionReviewer(extReviewer());
  assert.equal(r.units.length,5);assert.equal(r.drivers.units.length,4);
});

test('the guard refuses a count of 1 to 4 anywhere, a share outside [0,1], an unknown or missing field',()=>{
  for(const n of [1,2,3,4])refuse(()=>parseCExtensionUnit(mutate('asl-1',p=>{p.january.age.cells[3].count=n;}),'asl-1',ALL),'PCS_GUARD_COUNT');
  refuse(()=>parseCExtensionUnit(mutate('asl-3',p=>{p.fileF.identifiersByMonth[0].count=4;}),'asl-3',ALL),'PCS_GUARD_COUNT');
  refuse(()=>parseCExtensionUnit(mutate('asl-1',p=>{p.january.recipients=3;}),'asl-1',ALL),'PCS_GUARD_COUNT');
  refuse(()=>parseCExtensionUnit(mutate('asl-1',p=>{p.january.sex.female=1.2;}),'asl-1',ALL),'PCS_GUARD_SHARE');
  refuse(()=>parseCExtensionUnit(mutate('asl-1',p=>{p.january.services.extra=1;}),'asl-1',ALL),'UNKNOWN_FIELD');
  refuse(()=>parseCExtensionUnit(mutate('asl-1',p=>{delete p.january.cost.gini;}),'asl-1',ALL),'MISSING_FIELD');
  refuse(()=>parseCExtensionUnit(mutate('asl-1',p=>{p.lineage=[];}),'asl-1',ALL),'REVIEWER_ONLY');
  refuse(()=>parseCExtensionUnit(mutate('asl-1',p=>{p.january.services.servicePerPack=Infinity;}),'asl-1',ALL),'PCS_GUARD_NUM');
});

test('no place name, NSIS code or unit the audience cannot read in any label',()=>{
  refuse(()=>parseCExtensionUnit(mutate('asl-3',p=>{p.january.age.cells[0].label='Pescara';}),'asl-3',AZ),'PCS_GUARD_PLACE');
  refuse(()=>parseCExtensionUnit(mutate('asl-3',p=>{p.fileF.modes[0].label='130204';}),'asl-3',AZ),'PCS_GUARD_PLACE');
  refuse(()=>parseCExtensionUnit(mutate('asl-3',p=>{p.january.portfolioStatus[0].label='come asl-1';}),'asl-3',AZ),'FOREIGN_UNIT');
  refuse(()=>parseCExtensionUnit(extUnit('asl-1'),'asl-1',AZ),'PCS_GUARD_ORG');
});

test('semantic checks: File F only in asl-3, sums equal totals, additivity of the aggregate, one unit per object',()=>{
  refuse(()=>parseCExtensionUnit(mutate('asl-1',p=>{p.fileF=extUnit('asl-3').fileF;}),'asl-1',ALL),'PCE_FILEF_UNIT');
  refuse(()=>parseCExtensionUnit(mutate('asl-1',p=>{p.january.age.cells[0].count+=5;}),'asl-1',ALL),'PCE_SUM_age');
  refuse(()=>parseCExtensionUnit(mutate('aggregato',p=>{p.january.cost.quartiles={q1:1,median:2,q3:3};}),'aggregato',ALL),'PCE_ADDITIVITY');
  refuse(()=>parseCExtensionUnit(mutate('asl-2',p=>{p.january.services.within7=null;}),'asl-2',ALL),'PCE_ADDITIVITY');
  refuse(()=>parseCExtensionUnit(mutate('asl-2',p=>{p.january.recipientsAreSum=true;}),'asl-2',ALL),'PCE_SUM_FLAG');
  refuse(()=>parseCExtensionUnit(extUnit('asl-2'),'asl-4',ALL),'PCE_UNIT');
  refuse(()=>parseCExtensionUnit(mutate('asl-3',p=>{p.fileF.months[11].mode09=100;}),'asl-3',ALL),'PCE_FILEF_MODE09');
  const r=extReviewer();r.units[1]=structuredClone(r.units[2]);refuse(()=>parseCExtensionReviewer(r),'PCE_UNITS');
  const d=extReviewer();d.drivers.units[0].unit='aggregato';refuse(()=>parseCExtensionReviewer(d),'PCE_REVIEWER_UNITS');
  refuse(()=>parseCExtensionUnit(mutate('asl-1',p=>{p.notes.fileFMode09='x';}),'asl-1',ALL),'PCE_NOTES');
  refuse(()=>parseCExtensionUnit(mutate('asl-3',p=>{p.notes.fileFMode09=null;}),'asl-3',ALL),'PCE_NOTES');
  const f=extReviewer();f.findings.rows[1].id='F01';refuse(()=>parseCExtensionReviewer(f),'PCE_FINDINGS');
  const g=extReviewer();g.findings.rows[0].id='X1';refuse(()=>parseCExtensionReviewer(g),'PCE_FINDINGS');
  const h=extReviewer();h.findings.rows[0].detail='Teramo';refuse(()=>parseCExtensionReviewer(h),'PCS_GUARD_PLACE');
  assert.equal(parseCExtensionReviewer(extReviewer()).findings.rows.length,2);
});

test('parser: shares match their counts, File F months appear once and in order, reviewer blocks cover the four ASLs once each',()=>{
  // Codex review 22 Oct 2026 (DELIVERY_SECURITY_V2: admitted defensive mutations).
  const p=extUnit('asl-1',1000);p.january.age.cells[0].share+=0.01;refuse(()=>parseCExtensionUnit(p,'asl-1',ALL),'PCE_SHARE_age');
  const q=extUnit('asl-3',1000);q.fileF.months[1].month=q.fileF.months[0].month;refuse(()=>parseCExtensionUnit(q,'asl-3',ALL),'PCE_FILEF_MONTHS');
  const q2=extUnit('asl-3',1000);q2.fileF.identifiersByMonth.reverse();refuse(()=>parseCExtensionUnit(q2,'asl-3',ALL),'PCE_FILEF_MONTHS');
  const r=extReviewer();r.drivers.units=[];refuse(()=>parseCExtensionReviewer(r),'PCE_REVIEWER_UNITS');
  const r2=extReviewer();r2.baskets.units[1].unit='asl-1';refuse(()=>parseCExtensionReviewer(r2),'PCE_REVIEWER_UNITS');
  const r3=extReviewer();r3.drivers.units.pop();refuse(()=>parseCExtensionReviewer(r3),'PCE_REVIEWER_UNITS');
  for(const u of EXT_UNITS)assert.equal(parseCExtensionUnit(extUnit(u,u==='aggregato'?4000:1000),u,ALL).unit,u);
});

test('O1: the File F quarterly index never travels in a unit object; the reviewer object carries it for ASL 3 only',()=>{
  // The asl-3 object built before 23 Oct 2026 carried it: the closed guard now refuses that shape.
  const old=extUnit('asl-3',1000);old.fileF.basket=[{quarter:'Q1',index:100.2,coverage:0.9}];old.fileF.basketProducts=50;
  refuse(()=>parseCExtensionUnit(old,'asl-3',AZ),'PCS_GUARD_UNKNOWN_FIELD');
  const v1=extReviewer();v1.schema='pillar-c-extension-reviewer-v1';refuse(()=>parseCExtensionReviewer(v1),'PCS_GUARD');
  const moved=extReviewer();moved.fileFBasket.unit='asl-1';refuse(()=>parseCExtensionReviewer(moved),'PCE_FILEF_BASKET_UNIT');
  const missing=extReviewer();delete missing.fileFBasket;refuse(()=>parseCExtensionReviewer(missing),'PCS_GUARD');
  assert.deepEqual(parseCExtensionReviewer(extReviewer()).fileFBasket.quarters.map(q=>q.quarter),['Q1','Q2']);
});

test('reviewer loader: gated, pinned by size and hash, fails closed',async()=>{
  const fx=extFixture();as({pins:{root:'v1',bucket:'pillar-c-scoped'},client:()=>null});globalThis.__pcs.ext=fx.pins;
  const remote=async()=>({state:'ready',bytes:new Uint8Array(fx.reviewerBytes)});
  assert.equal((await loadCExtensionReviewer(true,false,remote)).state,'forbidden');
  assert.equal((await loadCExtensionReviewer(false,true,remote)).state,'forbidden');
  const ok=await loadCExtensionReviewer(true,true,remote);
  assert.equal(ok.state,'ready');assert.deepEqual(ok.view.units.map(u=>u.key),ALL);assert.deepEqual(ok.view.units.map(u=>u.label),ALL.map(u=>C_EXT_UNIT_LABELS[u]));
  assert.ok(ok.view.drivers&&ok.view.baskets);assert.deepEqual(ok.view.fileFBasket,extReviewer().fileFBasket);
  const tampered=Buffer.from(fx.reviewerBytes);tampered[10]^=1;
  assert.equal((await loadCExtensionReviewer(true,true,async()=>({state:'ready',bytes:new Uint8Array(tampered)}))).state,'unavailable');
  assert.equal((await loadCExtensionReviewer(true,true,async()=>({state:'not_configured'}))).state,'not_configured');
});

test('scoped loader: only the audience units, under the session, labelled by the audience; any refusal is unavailable',async()=>{
  const fx=extFixture();as({pins:{root:'v1',bucket:'pillar-c-scoped'},client:()=>null});globalThis.__pcs.ext=fx.pins;
  const labels=u=>({'asl-3':'Azienda sintetica Tre',aggregato:'Aggregato delle quattro Aziende'})[u]??null;
  const {client,calls}=fakeSessionClient(fx,{visible:AZ});
  const r=await loadCExtensionScoped(AZIENDA,client,labels);
  assert.equal(r.state,'ready');assert.deepEqual(r.view.units.map(u=>[u.key,u.label]),[['asl-3','Azienda sintetica Tre'],['aggregato','Aggregato delle quattro Aziende']]);
  assert.equal(r.view.drivers,null);assert.equal(r.view.baskets,null);assert.equal(r.view.fileFBasket,null);
  assert.deepEqual(calls.downloads.map(d=>[d.bucket,d.path.split('/')[0],d.path.split('/')[1]]),[['pillar-c-scoped','v9','asl-3'],['pillar-c-scoped','v9','aggregato']],'the extension root, never the rec5 root v1');
  // Storage refuses the own unit (RLS): the whole extension is unavailable, never partial.
  const refused=fakeSessionClient(fx,{visible:['aggregato']});
  assert.equal((await loadCExtensionScoped(AZIENDA,refused.client,labels)).state,'unavailable');
  // A Regione reads its five units.
  const all=fakeSessionClient(fx,{visible:ALL});
  const g=await loadCExtensionScoped(REGIONE,all.client,u=>u==='aggregato'?'Aggregato regionale':`ASL ${u.slice(4)}`);
  assert.equal(g.state,'ready');assert.equal(all.calls.downloads.length,5);
  // A label the audience does not give is a mismatch.
  assert.equal((await loadCExtensionScoped(AZIENDA,fakeSessionClient(fx,{visible:AZ}).client,()=>null)).state,'unavailable');
});

test('no small cell is recoverable by subtraction across the units one audience receives',()=>{
  const four=['asl-1','asl-2','asl-3','asl-4'].map(u=>extUnit(u,1000)),agg=extUnit('aggregato',4000);
  cExtComplementCheck([agg,...four]);cExtComplementCheck([four[2],agg]);
  // Regione: the aggregate exceeds the four ASLs by 3 in one class.
  const off=structuredClone(agg);off.january.age.cells[0].count+=3;off.january.age.cells[1].count-=3;
  refuse(()=>cExtComplementCheck([off,...four]),'PCE_COMPLEMENT');
  // Azienda: aggregate minus its own unit leaves 2 in a class for the other three.
  const own=structuredClone(four[2]),agg2=structuredClone(agg);agg2.january.ingredients.cells[2].count=own.january.ingredients.cells[2].count+2;agg2.january.ingredients.cells[0].count-=agg2.january.ingredients.cells[2].count-agg.january.ingredients.cells[2].count;
  refuse(()=>cExtComplementCheck([own,agg2]),'PCE_COMPLEMENT');
  // A class withheld for one ASL while the aggregate is released would be recovered by a Regione.
  const held=structuredClone(four[0]);held.january.age={status:'withheld',total:null,cells:[]};
  refuse(()=>cExtComplementCheck([agg,held,...four.slice(1)]),'PCE_COMPLEMENT_WITHHELD');
  // Recipients: a gap of 1 to 4 between the aggregate and the visible ASLs.
  const gap=structuredClone(agg);gap.january.recipients=4004;
  refuse(()=>cExtComplementCheck([gap,...four]),'PCE_COMPLEMENT');
});

const viewOf=(units,extras=false)=>({units:units.map(u=>({key:u,label:u==='aggregato'?'Aggregato delle quattro Aziende':`Unità ${u.slice(4)}`,data:extUnit(u,u==='aggregato'?4000:1000)})),drivers:extras?extReviewer().drivers:null,baskets:extras?extReviewer().baskets:null,fileFBasket:extras?extReviewer().fileFBasket:null,findings:extras?extReviewer().findings:null});
const audienceOf=(keys)=>({schema:'pillar-c-client-audience-v1',kind:'azienda',monthlyMode:'explicit',aggregateKey:'aggregato',orgs:keys.map(k=>({key:k,label:k})),defaultOrg:keys[0],budgetOrgs:[],capabilities:{},scopeLine:'x',exportLabel:'x'});

test('the scoped workspace shows the extension only for exactly its units, in order, and never a reviewer-only block',()=>{
  assert.ok(cScopedExtensionFor(audienceOf(AZ),viewOf(AZ)));
  assert.equal(cScopedExtensionFor(audienceOf(AZ),viewOf(['aggregato','asl-3'])),null);
  assert.equal(cScopedExtensionFor(audienceOf(AZ),viewOf(['asl-1','aggregato'])),null);
  assert.equal(cScopedExtensionFor(audienceOf(AZ),viewOf(AZ,true)),null);
  assert.equal(cScopedExtensionFor(audienceOf(AZ),{...viewOf(AZ),fileFBasket:extReviewer().fileFBasket}),null,'the File F quarterly index is reviewer-only');
  assert.equal(cScopedExtensionFor(audienceOf(AZ),{...viewOf(AZ),findings:extReviewer().findings}),null);
  assert.equal(cScopedExtensionFor(audienceOf(AZ),null),null);
});

test('rendered blocks: units in the given order, File F only with asl-3, drivers only with the reviewer block, no colour-only value',()=>{
  const html=renderToStaticMarkup(React.createElement(PillarCRecipientsSection,{view:viewOf(AZ)}));
  assert.match(html,/Unità 3/);assert.match(html,/Aggregato delle quattro Aziende/);assert.match(html,/File F 2025/);
  assert.match(html,/somma i destinatari delle quattro ASL/);
  assert.doesNotMatch(html,/Unità 1|Unità 2|Unità 4/);
  const one=renderToStaticMarkup(React.createElement(PillarCRecipientsSection,{view:viewOf(['asl-1','aggregato'])}));
  assert.doesNotMatch(one,/File F 2025/);
  assert.equal(renderToStaticMarkup(React.createElement(PillarCFileFMonthly,{view:viewOf(['asl-1','aggregato'])})),'');
  const monthly=renderToStaticMarkup(React.createElement(PillarCFileFMonthly,{view:viewOf(AZ)}));
  assert.match(monthly,/Modalità 09/);assert.match(monthly,/l’ultimo mese è il più basso/);assert.match(monthly,/presenti in: Dic/);assert.match(monthly,/Nota sintetica sulla modalità 09\./);
  assert.equal(renderToStaticMarkup(React.createElement(PillarCResidentDrivers,{view:viewOf(AZ)})),'');
  assert.match(renderToStaticMarkup(React.createElement(PillarCResidentDrivers,{view:viewOf(['aggregato','asl-1','asl-2','asl-3','asl-4'],true)})),/Solo revisori/);
  const attr=renderToStaticMarkup(React.createElement(PillarCAttributionEvidence,{view:viewOf(AZ)}));
  assert.match(attr,/role="img" aria-label="Unità 3: Prodotti a un solo portafoglio candidato 50,0/);
  assert.match(attr,/99,8 %/);
});

test('the decision card counts recipients only when the extension is present, and never claims a change',()=>{
  assert.equal(cExtensionRecipientsCard(null).value,'Non disponibili');
  const c=cExtensionRecipientsCard(viewOf(['aggregato','asl-1']));
  assert.match(c.title,/Aggregato delle quattro Aziende/);assert.match(c.detail,/somma delle quattro ASL/);assert.match(c.detail,/nessuna variazione nel tempo/);
});

test('the extension root is a policy root of its own; any other root string is refused before a read',async()=>{
  const {cScopedObjectPath}=await import('../lib/dashboard-review/pillar-c/scoped-transport.ts');
  as({pins:{root:'v1',bucket:'pillar-c-scoped'},client:()=>null});
  const sha='a'.repeat(64),name=`estensione-${sha}.json`;
  assert.equal(cScopedObjectPath('asl-2',name,sha,'v9'),`v9/asl-2/${name}`);
  assert.equal(cScopedObjectPath('asl-2',name,sha),`v1/asl-2/${name}`,'the rec5 default is unchanged');
  for(const root of ['x9','v0','v1000','v9/asl-1','../v9','',null])assert.equal(cScopedObjectPath('asl-2',name,sha,root),null,String(root));
});
