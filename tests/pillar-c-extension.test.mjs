// Pillar C extension (points 15-16): January DPC and File F packets. The closed-schema guard and its small-cell rule,
// the semantic parser, the reviewer and scoped loaders against a fake Storage, the audience matcher and the rendered
// blocks. Synthetic data only.
import test from 'node:test';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {createRequire,register} from 'node:module';
import {fileURLToPath} from 'node:url';
import {IDENTITY_STUBS,registerPillarCStubs,as} from './helpers/pillar-c-scoped-stubs.mjs';
import {fakeSessionClient} from './fixtures/pillar-c-scoped.mjs';
import {extUnit,extReviewer,extFixture,extBridges,EXT_UNITS} from './fixtures/pillar-c-extension.mjs';

registerPillarCStubs({...IDENTITY_STUBS,
  'lib/dashboard-review/pillar-c/extension-storage.ts':`export const C_EXTENSION_STORAGE=new Proxy({},{get:(_,k)=>globalThis.__pcs.ext[k]});export const C_EXTENSION_MAX_BYTES=1000000;`,
  'lib/dashboard-review/pillar-c/regional-storage.ts':`export const C_REGIONAL_STORAGE=new Proxy({},{get:(_,k)=>globalThis.__pcs.regional[k]});export const C_REGIONAL_MAX_BYTES=1000000;`,
},{tsx:true});
// next/link is a CommonJS entry without an exports map: resolve it by its file name (the dossier's Pillar B link).
register('data:text/javascript,'+encodeURIComponent(`export async function resolve(s,c,n){return n(s==='next/link'?'next/link.js':s,c);}`),import.meta.url);
const root=fileURLToPath(new URL('..',import.meta.url));
const req=createRequire(`${root}package.json`),React=req('react'),{renderToStaticMarkup}=req('react-dom/server');
const {parseCExtensionUnit,parseCExtensionReviewer,cExtComplementCheck}=await import('../lib/dashboard-review/pillar-c/extension-parse.ts');
const {C_EXT_UNIT_LABELS,cDecisionPeopleLine}=await import('../lib/dashboard-review/pillar-c/extension.ts');
const {loadCExtensionReviewer,loadCExtensionScoped}=await import('../lib/dashboard-review/pillar-c/extension-loader.ts');
const SECTIONS=await import('../components/dashboard-review/pillar-c/extension-sections.tsx');
const {PillarCUnitCosts,cExtensionRecipientsCard}=SECTIONS;
// The File F panels read the page's period catalogue (G1-03, G1-11): each render gets the catalogue of its own view, built
// as the page builds it (here in synthetic mode), so no panel can fall back to the first File F holder.
const PERIOD=await import('../components/dashboard-review/pillar-c/period-context.tsx');
const {buildCPeriodCatalog,publicCPeriodCatalog}=await import('../lib/dashboard-review/pillar-c/period-catalog.ts');
const catalogOf=view=>publicCPeriodCatalog(buildCPeriodCatalog(view,{mode:'synthetic'}));
const withCatalog=C=>{const Wrapped=props=>React.createElement(PERIOD.PillarCPeriodCatalogProvider,{catalog:catalogOf(props.view)},React.createElement(C,props));Wrapped.displayName=`WithCatalog(${C.name})`;return Wrapped;};
const PillarCRecipientsSection=withCatalog(SECTIONS.PillarCRecipientsSection),PillarCAttributionEvidence=withCatalog(SECTIONS.PillarCAttributionEvidence),PillarCFileFMonthly=withCatalog(SECTIONS.PillarCFileFMonthly),PillarCFileFRecipients=withCatalog(SECTIONS.PillarCFileFRecipients);
const {PillarCResidentDrivers}=await import('../components/dashboard-review/pillar-c/extension-reviewer.tsx');
const RV=await import('../components/dashboard-review/pillar-c/recipient-views.tsx');
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

test('R20-09: File F months and quarterly-index quarters come from a closed calendar vocabulary',()=>{
  // Months: 2025-01..2025-12 only, at least one, strictly increasing; a gap is allowed (absent, never zero-filled).
  for(const bad of [['0000-00'],['2025-00'],['2025-13'],['2024-12'],['2025-1'],[]]){
    const q=extUnit('asl-3',1000);q.fileF.months=bad.map(month=>({month,amount:1000,mode09:0,withoutMode09:1000}));
    refuse(()=>parseCExtensionUnit(q,'asl-3',ALL),'PCE_FILEF_MONTHS|PCS_GUARD');
  }
  const gap=extUnit('asl-3',1000);gap.fileF.months=gap.fileF.months.filter(m=>m.month!=='2025-06');gap.fileF.bridges=extBridges(gap.fileF.months);
  assert.equal(parseCExtensionUnit(gap,'asl-3',ALL).fileF.months.length,11,'a month the source did not report is absent, not refused');
  const ids=extUnit('asl-3',1000);ids.fileF.identifiersByMonth[0].month='0000-00';refuse(()=>parseCExtensionUnit(ids,'asl-3',ALL),'PCE_FILEF_MONTHS');
  // Quarters: at least one, each of Q1..Q4 once, in order.
  for(const quarters of [[],['Q1','Q1'],['Q2','Q1'],['Q5'],['T1'],['q1']]){
    const r=extReviewer();r.fileFBasket.quarters=quarters.map(quarter=>({quarter,index:100,coverage:0.9}));
    refuse(()=>parseCExtensionReviewer(r),'PCE_FILEF_BASKET_QUARTERS');
  }
  const four=extReviewer();four.fileFBasket.quarters=['Q1','Q2','Q3','Q4'].map(quarter=>({quarter,index:100,coverage:0.9}));
  assert.deepEqual(parseCExtensionReviewer(four).fileFBasket.quarters.map(q=>q.quarter),['Q1','Q2','Q3','Q4']);
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
  // A Regione (regional analytical parity) reads one object: the reviewer's own, from the regional folder.
  globalThis.__pcs.regional=fx.regional;
  const all=fakeSessionClient(fx,{visible:[...ALL,'regione']});
  const g=await loadCExtensionScoped(REGIONE,all.client,u=>u==='aggregato'?'Aggregato regionale':`ASL ${u.slice(4)}`);
  assert.equal(g.state,'ready');assert.deepEqual(all.calls.downloads.map(d=>d.path),[`v9/regione/${fx.regional.extension.name}`]);
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
  assert.equal(cScopedExtensionFor(audienceOf(AZ),{...viewOf(AZ),drivers:extReviewer().drivers}),null);
  assert.equal(cScopedExtensionFor(audienceOf(AZ),{...viewOf(AZ),baskets:extReviewer().baskets}),null,'the basket indices alone');
  assert.equal(cScopedExtensionFor(audienceOf(AZ),null),null);
  // The Regione's view must still be exactly its units, in its order.
  const reg={...audienceOf(ALL),kind:'regione'};
  assert.equal(cScopedExtensionFor(reg,viewOf(['asl-1','asl-2','asl-3','asl-4','aggregato'],true)),null);
  assert.equal(cScopedExtensionFor(reg,viewOf(['aggregato','asl-1','asl-2','asl-3'],true)),null);
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
  assert.match(renderToStaticMarkup(React.createElement(PillarCResidentDrivers,{view:viewOf(['aggregato','asl-1','asl-2','asl-3','asl-4'],true)})),/Non mostrato alle singole Aziende/);
  const attr=renderToStaticMarkup(React.createElement(PillarCAttributionEvidence,{view:viewOf(AZ)}));
  assert.match(attr,/role="img" aria-label="Unità 3: Prodotti a un solo portafoglio candidato 50,0/);
  assert.match(attr,/99,8 %/);
});

test('R20-04: admitted January use, service and File F fields already in the packets are shown; non-additive ones stay blank for the aggregate',()=>{
  const html=renderToStaticMarkup(React.createElement(PillarCRecipientsSection,{view:viewOf(AZ)}));
  assert.doesNotMatch(html,/NaN|undefined|Infinity/);
  // G1-01: no unexplained dash; totals keep the aggregate column, per-ASL statistics have none.
  assert.doesNotMatch(html,/>—</,'no dash cell anywhere in the recipients section');
  for(const t of ['Quanti sono i destinatari e chi sono','Quanto costa di solito un destinatario, in ciascuna ASL','Il costo è concentrato su pochi destinatari?','Come si distribuiscono i destinatari',
    'Quante confezioni, prescrizioni e prodotti riceve di solito un destinatario?','Quanto pesa il servizio di distribuzione sul costo?','Quanto varia il compenso per confezione fra le farmacie?',
    'Quanti giorni passano, nei dati registrati, fra prescrizione ed erogazione?','Perché gennaio 2026 e come si contano i destinatari','Profilo anagrafico degli identificativi','Donne (sul sesso noto)'])
    assert.ok(html.includes(t),t);
  const n=v=>v.replace(/\s/g,' ');
  const tableOf=(h,caption)=>{const i=h.indexOf(`<caption class="sr-only">${caption}</caption>`);assert.ok(i>=0,caption);return h.slice(i,h.indexOf('</table>',i));};
  const headers=t=>[...t.matchAll(/<th scope="col"[^>]*>([^<]*)<\/th>/g)].map(m=>m[1]);
  const row=(t,label)=>{t=n(t);label=n(label);const m=t.match(new RegExp(`>${label.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}</th>((?:<td[^>]*>[^<]*</td>)+)`));assert.ok(m,label);return [...m[1].matchAll(/<td[^>]*>([^<]*)<\/td>/g)].map(x=>n(x[1]));};
  const summary=tableOf(html,'Destinatari ammissibili, età e sesso'),cost=tableOf(html,'Costo per destinatario nelle singole ASL');
  assert.deepEqual(headers(summary),['Misura','Unità 3','Aggregato delle quattro Aziende'],'totals: every column, the aggregate included');
  assert.deepEqual(headers(cost),['Misura','Unità 3'],'per-ASL statistics: no aggregate column');
  assert.deepEqual(row(summary,'Destinatari ammissibili'),['1.000','4.000']);assert.deepEqual(row(summary,'65 anni e oltre'),['60,0 %','60,0 %']);assert.deepEqual(row(summary,'Donne (sul sesso noto)'),['52,0 %','52,0 %']);
  assert.deepEqual(row(cost,'Mediana (valore centrale)'),['80,00 €']);assert.deepEqual(row(cost,'Metà centrale dei destinatari (1° – 3° quartile)'),['40 € – 120 €']);
  assert.deepEqual(row(cost,'Quota del costo del 10 % con costo maggiore'),['40,0 %']);assert.deepEqual(row(cost,'Quota del costo del 20 % con costo maggiore'),['53,0 %']);assert.deepEqual(row(cost,'Indice di Gini (0 = costo uguale per tutti)'),['0,48']);
  const units=viewOf(AZ).units,el=(C,props)=>renderToStaticMarkup(React.createElement(C,{units,...props}));
  // G1-09: each measure reads its own quartiles; chart and table say the same.
  const use=tableOf(el(RV.PillarCTypicalUse,{initialView:'table'}),'Mediane e metà centrale dell’utilizzo per destinatario');
  assert.deepEqual(headers(use),['Misura','Unità 3'],'no aggregate column');
  assert.deepEqual([row(use,'Confezioni, mediana'),row(use,'Prescrizioni registrate, mediana'),row(use,'Prodotti AIC distinti, mediana')],[['2,0'],['1,0'],['1,5']]);
  assert.deepEqual(row(use,'Prodotti AIC distinti, metà centrale (1° – 3° quartile)'),['1,2 – 2,5']);assert.deepEqual(row(use,'Prescrizioni registrate, metà centrale (1° – 3° quartile)'),['0,9 – 2,0']);
  assert.match(html,/aria-label="Confezioni per destinatario: Unità 3 mediana 2,0, metà centrale 1,0 – 3,0"/);
  assert.match(html,/aria-label="Prescrizioni registrate per destinatario: Unità 3 mediana 1,0, metà centrale 0,9 – 2,0"/);
  assert.match(html,/Non è un box plot completo/);
  // G1-10: three views; each reads its own fields; per-ASL measures apart from those valid for the aggregate.
  const fees=tableOf(el(RV.PillarCPharmacyFees,{initialView:'table'}),'Compenso fra le farmacie');
  assert.deepEqual(row(fees,'Farmacie che erogano'),['120']);assert.deepEqual(row(fees,'Compenso per confezione, farmacia mediana'),['7,25 €']);assert.deepEqual(row(fees,'Metà centrale delle farmacie (1° – 3° quartile)'),['6,50 € – 8,75 €']);
  assert.deepEqual(row(fees,'Quota del costo del 10\u00a0% di farmacie con costo maggiore'),['25,0 %'],'pharmacy concentration, not recipient cost concentration');
  const iv=tableOf(el(RV.PillarCDispensingIntervals,{initialView:'table'}),'Giorni fra prescrizione ed erogazione');
  assert.deepEqual(row(iv,'Giorni, mediana'),['2']);assert.deepEqual(row(iv,'Giorni, metà centrale (1° – 3° quartile)'),['1 – 4']);
  assert.deepEqual(row(iv,'Prescrizione ed erogazione nello stesso giorno'),['12,0 %'],'same day, not within seven days');assert.deepEqual(row(iv,'Erogato entro 7 giorni'),['90,0 %']);
  assert.match(html,/Non è un tempo di attesa clinico/);
  const burden=el(RV.PillarCServiceBurden,{}),all=tableOf(burden,'Servizio di distribuzione: misure valide anche per l’aggregato'),own=tableOf(burden,'Servizio di distribuzione: misure delle singole ASL');
  assert.deepEqual(headers(all),['Misura','Unità 3','Aggregato delle quattro Aziende']);assert.deepEqual(headers(own),['Misura','Unità 3']);
  assert.deepEqual(row(all,'Compenso di servizio per confezione'),['8,10 €','8,10 €']);assert.deepEqual(row(own,'Confezioni sotto 10\u00a0€ di acquisto'),['11,0 %']);
  // G1-06 to G1-08: each measure reads its own bins; counts come from the count field, never share × total.
  const ex=initial=>el(RV.PillarCDistributionExplorer,{initial});
  const tab=(measure,label,mode='share')=>tableOf(ex({measure,view:'table',mode}),`${label}: destinatari per classe`);
  assert.deepEqual(row(tab('prescriptions','Prescrizioni registrate per destinatario'),'1'),['90,0 % (900)','90,0 % (3.600)']);
  assert.deepEqual(row(tab('aics','Prodotti AIC distinti per destinatario'),'1'),['95,0 % (950)','95,0 % (3.800)']);
  assert.deepEqual(row(tab('ingredients','Sostanze e combinazioni ATC5 per destinatario'),'2'),['5,0 % (50)','5,0 % (200)']);
  assert.deepEqual(row(tab('packs','Confezioni per destinatario','count'),'1–&lt;2'),['800 (80,0 %)','3.200 (80,0 %)']);
  const odd=viewOf(AZ);odd.units[0].data.january.use.packs.bins.cells[0].count=801;
  assert.equal(row(tableOf(renderToStaticMarkup(React.createElement(RV.PillarCDistributionExplorer,{units:odd.units,initial:{view:'table',mode:'count'}})),'Confezioni per destinatario: destinatari per classe'),'1–&lt;2')[0],'801 (80,0 %)','the exact count field, not 80 % of 1.000');
  const donut=ex({measure:'packs',unit:'asl-3'});
  assert.match(donut,/role="img" aria-label="Unità 3: 1–&lt;2 80,0\u00a0% \(800\); 2\+ 20,0\u00a0% \(200\)"/);assert.equal((donut.match(/<path /g)||[]).length,2,'one arc per class');
  assert.match(ex({}),/aria-label="Confronto fra organizzazioni sulla stessa scala"/,'several organisations: a common scale, not a donut');
  assert.match(ex({}),/Denominatore: Unità 3 1\.000 destinatari · Aggregato delle quattro Aziende 4\.000 destinatari\. Gennaio 2026, DPC\./);
  const withheld=viewOf(AZ);withheld.units[0].data.january.use.packs.bins={status:'withheld',total:null,cells:[]};
  assert.match(renderToStaticMarkup(React.createElement(RV.PillarCDistributionExplorer,{units:withheld.units,initial:{unit:'asl-3'}})),/La distribuzione non è mostrata: non mostrato: classi con meno di 5 persone/);
  // G1-05: every delivered Lorenz point, endpoints included; the equality line; no aggregate curve.
  const lt=tableOf(el(RV.PillarCCostConcentration,{initialView:'table'}),'Quota cumulata del costo per decimo di destinatari');
  assert.deepEqual(headers(lt),['Destinatari con costo più basso','Unità 3'],'no aggregate curve');
  assert.deepEqual(['0','10','50','90','100'].map(k=>row(lt,`${k}\u00a0%`)[0]),['0,0 %','2,0 %','20,0 %','60,0 %','100,0 %']);
  const chart=el(RV.PillarCCostConcentration,{}),pts=chart.match(/<polyline[^>]*points="([^"]*)"/)[1].split(' ');
  assert.deepEqual([pts.length,pts[0],pts[5],pts[10]],[11,'48,216','198,175.2','348,12'],'eleven points: (0,0), the median decile, (100,100)');
  assert.match(chart,/<line x1="48" y1="216" x2="348" y2="12"/,'the equality line from (0,0) to (100,100)');
  assert.match(chart,/Unità 3: la metà dei destinatari con costo più basso riceve il 20,0\u00a0% del costo; il 10\u00a0% con costo più alto ne riceve il 40,0\u00a0%\./);
  const attr=renderToStaticMarkup(React.createElement(PillarCAttributionEvidence,{view:viewOf(AZ)}));
  assert.match(attr,/Destinatari per stato del prodotto e gruppo di portafogli candidati/);
  assert.match(attr,/L’aggregato somma i destinatari delle quattro ASL: non è un conteggio di persone uniche regionali\./,'the summed aggregate is said to be a sum');
  assert.match(attr,/Ogni gruppo riunisce più portafogli candidati/);assert.doesNotMatch(attr,/Portafoglio candidato \(prodotti a candidato singolo\)/);
  assert.match(attr,/Identificativi raggiunti per gruppo di portafogli candidati[\s\S]*?Oncologia<\/th><td[^>]*>5,0 %/,'the File F reach table is present and reads its own field');
  // Every cell of the group and status tables reads its own field (review of 55593a1).
  const group=attr.slice(attr.indexOf('<caption class="sr-only">Destinatari per gruppo di portafogli candidati</caption>'));
  assert.ok(attr.includes('<caption class="sr-only">Destinatari per gruppo di portafogli candidati</caption>'),'the screen-reader caption names groups');
  assert.match(group,/Cardiovascolare<\/th><td[^>]*>100 \(10,0 %\)<\/td><td[^>]*>400 \(10,0 %\)<\/td>/,'group reach, not product status');
  assert.match(attr,/Più portafogli candidati<\/th><td[^>]*>29,0 %/);assert.match(attr,/Non mappati o evidenza insufficiente<\/th><td[^>]*>1,0 %/);
  assert.match(attr,/Ogni gruppo riunisce più portafogli candidati\. Le quote di identificativi si sovrappongono/,'the File F note keeps the group sentence');
  assert.doesNotMatch(renderToStaticMarkup(React.createElement(PillarCAttributionEvidence,{view:viewOf(['asl-3'])})),/somma i destinatari delle quattro ASL/,'no sum caveat without an aggregate column');
  assert.ok(attr.includes('600 (60,0 %)')&&attr.includes('2.400 (60,0 %)'),'counts and shares per unit, the aggregate as a sum');
  assert.match(attr,/File F 2025 · Unità 3: portafogli candidati/);assert.match(attr,/Un solo portafoglio candidato<\/th><td[^>]*>70,0 %/);
  assert.match(attr,/non indica la diagnosi, l’indicazione effettiva né l’area che sostiene il costo/);
  assert.doesNotMatch(renderToStaticMarkup(React.createElement(PillarCAttributionEvidence,{view:viewOf(['asl-1','aggregato'])})),/File F 2025/);
});

test('R20-09: a File F month the source lacks is absent, and every month row is labelled and joined by its own key',()=>{
  const v=viewOf(AZ),f=v.units.find(u=>u.key==='asl-3').data.fileF;
  f.months=f.months.filter(m=>m.month!=='2025-06').map(m=>m.month==='2025-07'?{...m,amount:1200,withoutMode09:1200}:m);f.bridges=extBridges(f.months);
  f.identifiersByMonth=f.identifiersByMonth.map(m=>m.month==='2025-07'?{...m,count:2100}:m);
  const html=renderToStaticMarkup(React.createElement(PillarCFileFMonthly,{view:v}));
  assert.match(html,/Mesi presenti nel flusso: 11 su 12; un mese assente non vale zero\./);
  assert.match(html,/>Lug<\/th>(<td[^>]*>[^<]*<\/td>){4}<td[^>]*>2\.100<\/td>/,'July shows July’s identifiers, not June’s');
  assert.doesNotMatch(html,/>Giu</);assert.doesNotMatch(html,/Giu /,'not in the chart’s accessible name either');
  // Every place the commit changed: the accessible name pairs each label with its own amount...
  assert.match(html,/aria-label="Importo mensile: Gen 1\.000\s€; Feb 1\.000\s€; Mar 1\.000\s€; Apr 1\.000\s€; Mag 1\.000\s€; Lug 1\.200\s€; Ago 1\.000\s€;/);
  // ...the mode-09 month keeps its own name, and the last-month remark still finds December.
  assert.match(html,/presenti in: Dic\./);
  assert.match(html,/Senza la modalità 09 l’ultimo mese è il più basso\./);
});

test('review of 9545a68: identifiersByMonth must be non-empty too; recipient-group shares must match their counts',()=>{
  const q=extUnit('asl-3',1000);q.fileF.identifiersByMonth=[];refuse(()=>parseCExtensionUnit(q,'asl-3',ALL),'PCE_FILEF_MONTHS');
  const s=extUnit('asl-1',1000);s.january.portfolioStatus[0].share=0.9;refuse(()=>parseCExtensionUnit(s,'asl-1',ALL),'PCE_SHARE_portfolioStatus');
  const r=extUnit('asl-1',1000);r.january.singleCandidateReach[0].share=0.5;refuse(()=>parseCExtensionUnit(r,'asl-1',ALL),'PCE_SHARE_singleCandidateReach');
  const ok=extUnit('aggregato',4000);assert.equal(parseCExtensionUnit(ok,'aggregato',ALL).unit,'aggregato','the aggregate: summed counts over summed recipients');
  // The tolerance is half a unit of the third decimal: 0.6006 over 600/1000 is refused, 0.6004 accepted.
  const t1=extUnit('asl-1',1000);t1.january.portfolioStatus[0].share=0.6006;refuse(()=>parseCExtensionUnit(t1,'asl-1',ALL),'PCE_SHARE_portfolioStatus');
  const t2=extUnit('asl-1',1000);t2.january.portfolioStatus[0].share=0.6004;assert.equal(parseCExtensionUnit(t2,'asl-1',ALL).unit,'asl-1');
});

test('the decision card counts recipients only when the extension is present, and never claims a change',()=>{
  assert.equal(cExtensionRecipientsCard(null,false,'aggregato').value,'Non disponibili');
  const c=cExtensionRecipientsCard(viewOf(['aggregato','asl-1']),false,'aggregato');
  assert.match(c.title,/Aggregato delle quattro Aziende/);assert.match(c.detail,/somma delle quattro ASL/);assert.match(c.detail,/nessuna variazione nel tempo/);
});

// Codex live check A26-01 (26 Oct 2026): the card read units[0] whatever the «Ambito», so it stayed on the first unit.
test('A26-01: the recipients card reads the selected unit, keeps its caveats, and never falls back to another unit',()=>{
  const view=viewOf(['asl-3','aggregato']);view.units[0].data.january.recipients=1300;view.units[1].data.january.recipients=5000;
  const own=cExtensionRecipientsCard(view,false,'asl-3'),agg=cExtensionRecipientsCard(view,false,'aggregato');
  assert.deepEqual([own.title,own.value],['Destinatari DPC · Unità 3','1.300']);
  assert.match(own.detail,/^Gennaio 2026: un solo mese, nessuna variazione nel tempo\./,'a single ASL is not a sum');
  assert.deepEqual([agg.title,agg.value],['Destinatari DPC · Aggregato delle quattro Aziende','5.000']);
  assert.match(agg.detail,/^Gennaio 2026, somma delle quattro ASL: un solo mese, nessuna variazione nel tempo\./,'the sum caveat stays with the aggregate');
  for(const key of ['asl-1','Regione','PE','',undefined]){
    const none=cExtensionRecipientsCard(view,false,key);
    assert.deepEqual([none.title,none.value],['Destinatari DPC','Non disponibili'],String(key));
    assert.doesNotMatch(JSON.stringify(none),/1\.300|5\.000|Unità|Aggregato/,'no count or label of a unit the key does not name');
  }
});

test('A26-01: the reviewer’s scope keys name the extension units by the same pseudonyms',async()=>{
  const {C_ORGS}=await import('../lib/dashboard-review/pillar-c/review.ts');
  const {C_ORG_LABELS,C_EXT_UNIT_OF_REVIEWER_ORG}=await import('../lib/dashboard-review/pillar-c/reviewer-labels.ts');
  assert.deepEqual(Object.keys(C_EXT_UNIT_OF_REVIEWER_ORG).sort(),[...C_ORGS].sort());
  assert.deepEqual(new Set(Object.values(C_EXT_UNIT_OF_REVIEWER_ORG)).size,5,'one unit per key');
  for(const org of C_ORGS)assert.equal(C_EXT_UNIT_LABELS[C_EXT_UNIT_OF_REVIEWER_ORG[org]],C_ORG_LABELS[org],org);
});

test('the extension root is a policy root of its own; any other root string is refused before a read',async()=>{
  const {cScopedObjectPath}=await import('../lib/dashboard-review/pillar-c/scoped-transport.ts');
  as({pins:{root:'v1',bucket:'pillar-c-scoped'},client:()=>null});
  const sha='a'.repeat(64),name=`estensione-${sha}.json`;
  assert.equal(cScopedObjectPath('asl-2',name,sha,'v9'),`v9/asl-2/${name}`);
  assert.equal(cScopedObjectPath('asl-2',name,sha),`v1/asl-2/${name}`,'the rec5 default is unchanged');
  for(const root of ['x9','v0','v1000','v9/asl-1','../v9','',null])assert.equal(cScopedObjectPath('asl-2',name,sha,root),null,String(root));
});

// ---------------------------------------------------------------- ext-v2 (owner decisions D1, D2, D3, D7 of 23 Oct 2026)
test('ext-v2 parser: Lorenz deciles, pharmacy fee quartiles and own per-pack costs are per-ASL only and internally consistent',()=>{
  const ok=parseCExtensionUnit(extUnit('asl-2'),'asl-2',ALL);assert.equal(ok.unitCosts.products.length,3);assert.equal(ok.january.cost.lorenz.length,11);
  for(const bad of [[0,0.5,1],[0.01,0.02,0.05,0.09,0.14,0.2,0.27,0.36,0.47,0.6,1],[0,0.02,0.05,0.09,0.14,0.2,0.27,0.36,0.47,0.6,0.99],[0,0.02,0.05,0.04,0.14,0.2,0.27,0.36,0.47,0.6,1]])
    refuse(()=>parseCExtensionUnit(mutate('asl-1',p=>{p.january.cost.lorenz=bad;}),'asl-1',ALL),'PCE_LORENZ');
  refuse(()=>parseCExtensionUnit(mutate('asl-1',p=>{p.january.services.pharmacyFeeQ1=9;}),'asl-1',ALL),'PCE_PHARMACY_FEE');
  // The aggregate carries no Lorenz curve, fee quartile or per-pack list; an ASL carries all three.
  refuse(()=>parseCExtensionUnit(mutate('aggregato',p=>{p.january.cost.lorenz=extUnit('asl-1').january.cost.lorenz;}),'aggregato',ALL),'PCE_ADDITIVITY');
  refuse(()=>parseCExtensionUnit(mutate('aggregato',p=>{p.unitCosts=extUnit('asl-1').unitCosts;}),'aggregato',ALL),'PCE_ADDITIVITY');
  refuse(()=>parseCExtensionUnit(mutate('asl-4',p=>{p.unitCosts=null;}),'asl-4',ALL),'PCE_ADDITIVITY');
  refuse(()=>parseCExtensionUnit(mutate('asl-4',p=>{p.january.services.pharmacyFeeMedian=null;}),'asl-4',ALL),'PCE_ADDITIVITY');
  // One row per AIC, nine digits, no negative component, total = acquisition + service within rounding.
  refuse(()=>parseCExtensionUnit(mutate('asl-1',p=>{p.unitCosts.products[1].aic=p.unitCosts.products[0].aic;}),'asl-1',ALL),'PCE_UNIT_COSTS');
  refuse(()=>parseCExtensionUnit(mutate('asl-1',p=>{p.unitCosts.products[0].aic='12345';}),'asl-1',ALL),'PCE_UNIT_COSTS');
  refuse(()=>parseCExtensionUnit(mutate('asl-1',p=>{p.unitCosts.products=[];}),'asl-1',ALL),'PCE_UNIT_COSTS');
  refuse(()=>parseCExtensionUnit(mutate('asl-1',p=>{p.unitCosts.products[0].service=-1;p.unitCosts.products[0].combined=4.1;}),'asl-1',ALL),'PCE_UNIT_COSTS_SUM');
  refuse(()=>parseCExtensionUnit(mutate('asl-1',p=>{p.unitCosts.products[0].combined+=0.02;}),'asl-1',ALL),'PCE_UNIT_COSTS_SUM');
  // Closed shape: no quantity, amount or another unit's value can ride along; a product name is screened like any descriptor.
  refuse(()=>parseCExtensionUnit(mutate('asl-1',p=>{p.unitCosts.products[0].quantity=12;}),'asl-1',ALL),'UNKNOWN_FIELD');
  refuse(()=>parseCExtensionUnit(mutate('asl-1',p=>{p.unitCosts.otherUnits=[];}),'asl-1',ALL),'UNKNOWN_FIELD');
  refuse(()=>parseCExtensionUnit(mutate('asl-3',p=>{p.unitCosts.products[0].name='Prodotto di Pescara';}),'asl-3',AZ),'PCS_GUARD_PLACE');
});

test('ext-v2 parser: File F bridges join calendar-adjacent months of the series and add up within rounding',()=>{
  const ok=parseCExtensionUnit(extUnit('asl-3'),'asl-3',AZ);assert.equal(ok.fileF.bridges.length,11);
  const bad=(f,reason)=>refuse(()=>parseCExtensionUnit(mutate('asl-3',p=>f(p.fileF)),'asl-3',AZ),reason);
  bad(f=>{f.bridges[3].to='2025-06';},'PCE_FILEF_BRIDGE_MONTHS');
  bad(f=>{f.bridges[3]={...f.bridges[3],from:'2025-04',to:'2025-06'};},'PCE_FILEF_BRIDGE_MONTHS');
  bad(f=>{f.bridges=[f.bridges[1],f.bridges[0]];},'PCE_FILEF_BRIDGE_MONTHS|PCE_FILEF_BRIDGES_INCOMPLETE');
  bad(f=>{f.bridges[0]=f.bridges[1];},'PCE_FILEF_BRIDGE_MONTHS|PCE_FILEF_BRIDGES_INCOMPLETE');
  bad(f=>{f.bridges.push({...f.bridges[10],from:'2025-12',to:'2025-13'});},'PCE_FILEF_BRIDGE_MONTHS|PCS_GUARD_LIST');
  bad(f=>{f.bridges[2].opening+=1;},'PCE_FILEF_BRIDGE_ENDS');
  bad(f=>{f.bridges[2].change+=1;},'PCE_FILEF_BRIDGE_ENDS');
  bad(f=>{f.bridges[5].entries+=0.05;},'PCE_FILEF_BRIDGE_SUM');
  bad(f=>{f.bridges[10].mode09Change+=1;},'PCE_FILEF_BRIDGE_SUM');
  bad(f=>{f.bridges[4].continuingIncrease=-1;f.bridges[4].entries+=121;},'PCE_FILEF_BRIDGE_SIGN');
  bad(f=>{f.bridges[0].top10Share=1.2;},'PCS_GUARD_SHARE');
  // A month the source lacks has no bridge into or out of it; the remaining bridges still parse.
  const gap=extUnit('asl-3');gap.fileF.months=gap.fileF.months.filter(m=>m.month!=='2025-06');gap.fileF.bridges=extBridges(gap.fileF.months);
  assert.deepEqual(parseCExtensionUnit(gap,'asl-3',AZ).fileF.bridges.map(b=>b.from),['2025-01','2025-02','2025-03','2025-04','2025-07','2025-08','2025-09','2025-10','2025-11']);
});

test('regional parity: the Regione view is the reviewer view, read under its own session; an Azienda keeps only its own list',async()=>{
  const fx=extFixture();as({pins:{root:'v1',bucket:'pillar-c-scoped'},client:()=>null});globalThis.__pcs.ext=fx.pins;globalThis.__pcs.regional=fx.regional;
  const regionLabels=u=>u==='aggregato'?'Aggregato regionale':`ASL ${u.slice(4)}`;
  const s=fakeSessionClient(fx,{visible:[...ALL,'regione']});
  const r=await loadCExtensionScoped(REGIONE,s.client,regionLabels);
  const rv=await loadCExtensionReviewer(true,true,async()=>({state:'ready',bytes:new Uint8Array(fx.reviewerBytes)}));
  assert.equal(r.state,'ready');assert.equal(rv.state,'ready');
  // Exact parity: every unit's data and every region-wide block equal the reviewer's; only the labels are the audience's.
  assert.deepEqual(r.view.units.map(u=>u.key),rv.view.units.map(u=>u.key));
  assert.deepEqual(r.view.units.map(u=>u.data),rv.view.units.map(u=>u.data));
  for(const k of ['drivers','baskets','fileFBasket','findings'])assert.deepEqual(r.view[k],rv.view[k],k);
  assert.deepEqual(r.view.units.map(u=>u.label),['Aggregato regionale','ASL 1','ASL 2','ASL 3','ASL 4']);
  assert.deepEqual(r.view.units.map(u=>u.data.unitCosts?.products.length??null),[null,3,3,3,3],'the four ASLs\u2019 lists, none on the aggregate');
  assert.equal(s.calls.downloads.every(d=>d.bucket==='pillar-c-scoped'&&d.params.cache==='no-store'),true);
  // Storage refuses the regional folder (migration not applied, or not an enabled Regione member): unavailable, never partial.
  assert.equal((await loadCExtensionScoped(REGIONE,fakeSessionClient(fx,{visible:ALL}).client,regionLabels)).state,'unavailable');
  // Other bytes under the pinned name: unavailable.
  const tampered=extFixture();const body=Buffer.from(tampered.reviewerBytes);body[20]^=1;tampered.files.set(`v9/regione/${fx.regional.extension.name}`,body);
  assert.equal((await loadCExtensionScoped(REGIONE,fakeSessionClient(tampered,{visible:[...ALL,'regione']}).client,regionLabels)).state,'unavailable');
  // A label the Regione does not give is a mismatch.
  assert.equal((await loadCExtensionScoped(REGIONE,fakeSessionClient(fx,{visible:[...ALL,'regione']}).client,u=>u==='asl-2'?null:regionLabels(u))).state,'unavailable');
  // The Azienda never requests the regional folder, keeps its own list and receives no region-wide block.
  const az=fakeSessionClient(fx,{visible:[...AZ,'regione']});
  const a=await loadCExtensionScoped(AZIENDA,az.client,u=>({'asl-3':'Azienda sintetica Tre',aggregato:'Aggregato delle quattro Aziende'})[u]??null);
  assert.equal(a.state,'ready');assert.equal(a.view.units[0].data.unitCosts.products.length,3);assert.equal(a.view.units[1].data.unitCosts,null);
  assert.deepEqual([a.view.drivers,a.view.baskets,a.view.fileFBasket,a.view.findings],[null,null,null,null]);
  assert.equal(az.calls.downloads.some(d=>d.path.split('/')[1]==='regione'),false);
});

test('ext-v2 panels: Lorenz deciles per ASL, fee quartiles, File F tiles and pooled age, shared-recipient narrowing',()=>{
  const html=renderToStaticMarkup(React.createElement(PillarCRecipientsSection,{view:viewOf(AZ)}));
  assert.match(html,/Il costo è concentrato su pochi destinatari\?/);assert.match(html,/Per l’aggregato non c’è una curva/);
  assert.match(html,/<polyline[^>]*points="48,216 /,'the curve starts at the origin');
  assert.match(html,/Compenso per confezione fra le farmacie: Unità 3 mediana 7,25\s€, metà centrale 6,50\s€ – 8,75\s€/);
  assert.match(html,/Indice di Gini<\/dt><dd[^>]*>0,80<\/dd>/);assert.match(html,/Senza modalità 09: quota dell’1 %<\/dt><dd[^>]*>29,0 %/);
  assert.match(html,/Importo per identificativo, 1° – 3° quartile<\/dt><dd[^>]*>50 € – 800 €/);
  // D3: when the unknown ages are pooled into 85+, the band and the 65+ tile say so.
  const pooled=viewOf(AZ);const f=pooled.units[0].data.fileF;f.age={status:'released',total:5000,cells:[{id:'0-64',label:'0-64',count:2000,share:0.4},{id:'85+',label:'85 e oltre, incluse le età non note',count:3000,share:0.6}]};f.ageUnknownPooled=true;
  const p=renderToStaticMarkup(React.createElement(PillarCRecipientsSection,{view:pooled}));
  assert.match(p,/65 anni e oltre, incluse le età non note/);assert.match(p,/Età 85 e oltre, incluse le età non note/);
  const attr=renderToStaticMarkup(React.createElement(PillarCAttributionEvidence,{view:viewOf(AZ)}));
  assert.match(attr,/Con almeno una riga ristretta a un candidato da un’esenzione coerente<\/th><td[^>]*>15,0 %<\/td><td[^>]*>—<\/td>/);
});

test('ext-v2 panels: File F bridges with signed components; own per-pack costs, one Azienda at a time',()=>{
  const b=renderToStaticMarkup(React.createElement(PillarCFileFMonthly,{view:viewOf(AZ)}));
  assert.match(b,/variazione da un mese all’altro/);assert.match(b,/>Nov → Dic<\/th><td[^>]*>\+500 €<\/td><td[^>]*>\+120 €<\/td><td[^>]*>-100 €<\/td>/);
  assert.match(b,/>Gen → Feb<\/th><td[^>]*>0 €<\/td>/);assert.match(b,/non indica un nuovo paziente/);
  assert.equal((b.match(/→/g)||[]).length,11);
  const own=renderToStaticMarkup(React.createElement(PillarCUnitCosts,{view:viewOf(AZ)}));
  assert.match(own,/Costo per confezione sugli stessi prodotti · Unità 3/);assert.match(own,/PRODOTTO SINTETICO B/);assert.match(own,/39,45 €/);
  assert.doesNotMatch(own,/<select/,'one Azienda: no selector');assert.doesNotMatch(own,/Unità 1|Unità 2|Unità 4/);
  const reviewer=renderToStaticMarkup(React.createElement(PillarCUnitCosts,{view:viewOf(ALL,true)}));
  assert.match(reviewer,/<select aria-label="Azienda dei costi per confezione"/);assert.equal((reviewer.match(/<option /g)||[]).length,4,'the four ASLs, never the aggregate');
  const regione=viewOf(ALL);regione.units.forEach(u=>{u.data.unitCosts=null;});
  assert.equal(renderToStaticMarkup(React.createElement(PillarCUnitCosts,{view:regione})),'');
});

test('ext-v2 wording: an extension that could not be read is «not available», never «not counted»',()=>{
  assert.equal(cExtensionRecipientsCard(null,true,'aggregato').value,'Non disponibili in questo momento');
  assert.match(cExtensionRecipientsCard(null,true,'aggregato').detail,/non è riuscita/);
  assert.equal(cExtensionRecipientsCard(null,false,'aggregato').value,'Non disponibili');
  assert.match(cDecisionPeopleLine(null,true),/non sono disponibili in questo momento/);assert.match(cDecisionPeopleLine(null),/non contano le persone trattate/);
});

// ---------------------------------------------------------------- independent review of 90f84f1 (M1, M2, L1, L3, L5, L6, test gaps)
test('review M1: the bridges’ mode-09 split follows the monthly series',()=>{
  refuse(()=>parseCExtensionUnit(mutate('asl-3',p=>{const b=p.fileF.bridges[10];b.withoutMode09+=b.mode09Change;b.mode09Change=0;}),'asl-3',AZ),'PCE_FILEF_BRIDGE_MODE09');
  refuse(()=>parseCExtensionUnit(mutate('asl-3',p=>{const b=p.fileF.bridges[10];b.withoutMode09+=2*b.mode09Change;b.mode09Change=-b.mode09Change;}),'asl-3',AZ),'PCE_FILEF_BRIDGE_MODE09');
});

test('review M2: a Lorenz curve lies under the line of equality, is convex, matches the top shares, and has 5 people per tenth',()=>{
  const lor=(f)=>refuse(()=>parseCExtensionUnit(mutate('asl-1',p=>f(p.january)),'asl-1',ALL),'PCE_LORENZ');
  lor(j=>{j.cost.lorenz=[0,0.5,0.6,0.65,0.7,0.75,0.8,0.85,0.9,0.95,1];});
  lor(j=>{j.cost.lorenz=[0,0.05,0.06,0.09,0.14,0.2,0.27,0.36,0.47,0.6,1];});
  lor(j=>{j.cost.lorenz=[0,0.02,0.05,0.09,0.14,0.2,0.27,0.36,0.47,0.95,1];});
  lor(j=>{j.cost.top10=0.3;});lor(j=>{j.cost.top20=0.7;});
  const small=extUnit('asl-1',40);refuse(()=>parseCExtensionUnit(small,'asl-1',ALL),'PCE_LORENZ_SMALL|PCS_GUARD_COUNT');
});

test('review L1: every adjacent-month bridge is present, none is dropped',()=>{
  refuse(()=>parseCExtensionUnit(mutate('asl-3',p=>{p.fileF.bridges.pop();}),'asl-3',AZ),'PCE_FILEF_BRIDGES_INCOMPLETE');
  refuse(()=>parseCExtensionUnit(mutate('asl-3',p=>{p.fileF.bridges=[];}),'asl-3',AZ),'PCE_FILEF_BRIDGES_INCOMPLETE');
  refuse(()=>parseCExtensionUnit(mutate('asl-3',p=>{p.fileF.bridges.splice(4,1);}),'asl-3',AZ),'PCE_FILEF_BRIDGES_INCOMPLETE');
});

test('review L3: the pooled-age flag must match the 85+ label',()=>{
  refuse(()=>parseCExtensionUnit(mutate('asl-3',p=>{p.fileF.ageUnknownPooled=true;}),'asl-3',AZ),'PCE_FILEF_AGE_POOLED');
  const pooled=mutate('asl-3',p=>{p.fileF.age={status:'released',total:5000,cells:[{id:'0-64',label:'0-64',count:2000,share:0.4},{id:'85+',label:'85 e oltre, incluse le età non note',count:3000,share:0.6}]};});
  refuse(()=>parseCExtensionUnit(pooled,'asl-3',AZ),'PCE_FILEF_AGE_POOLED');
  pooled.fileF.ageUnknownPooled=true;assert.equal(parseCExtensionUnit(pooled,'asl-3',AZ).fileF.ageUnknownPooled,true);
});

test('review L5 and L6: per-pack lists only for the own Azienda unit; one product set; no empty descriptor',()=>{
  refuse(()=>parseCExtensionUnit(mutate('asl-1',p=>{p.unitCosts.products[0].name='  ';}),'asl-1',ALL),'PCE_UNIT_COSTS_IDENTITY');
  const r=extReviewer();r.units.find(u=>u.unit==='asl-2').unitCosts.products.pop();refuse(()=>parseCExtensionReviewer(r),'PCE_UNIT_COSTS_SETS');
  // The scoped workspace refuses a view carrying a list on any unit but the Azienda's own.
  const az=audienceOf(['asl-3','aggregato']);
  assert.ok(cScopedExtensionFor(az,viewOf(['asl-3','aggregato'])),'own list kept');
  const leaked=viewOf(['asl-3','aggregato']);leaked.units[1].data={...leaked.units[1].data,unitCosts:extUnit('asl-1').unitCosts};
  assert.equal(cScopedExtensionFor(az,leaked),null);
  // Regional analytical parity: the Regione receives each ASL's list and the region-wide blocks, never a list on the aggregate.
  const reg={...audienceOf(ALL),kind:'regione'};
  assert.ok(cScopedExtensionFor(reg,viewOf(ALL)),'the four ASLs\u2019 lists');
  assert.ok(cScopedExtensionFor(reg,viewOf(ALL,true)),'with the region-wide blocks');
  const onAggregate=viewOf(ALL);onAggregate.units[0].data={...onAggregate.units[0].data,unitCosts:extUnit('asl-1').unitCosts};
  assert.equal(cScopedExtensionFor(reg,onAggregate),null,'a list on the aggregate is refused');
  const stripped=viewOf(ALL);stripped.units.forEach(u=>{u.data={...u.data,unitCosts:null};});
  assert.ok(cScopedExtensionFor(reg,stripped));
  assert.equal(cScopedExtensionFor({...reg,kind:'reviewer'},viewOf(ALL)),null,'never the reviewer audience');
});

test('review test gap: every pinned extension object fits under the read cap',()=>{
  const src=readFileSync(new URL('../lib/dashboard-review/pillar-c/extension-storage.ts',import.meta.url),'utf8');
  const cap=Number(src.match(/C_EXTENSION_MAX_BYTES = ([0-9_]+);/)[1].replace(/_/g,''));
  const sizes=[...src.matchAll(/bytes: ([0-9]+)/g)].map(m=>Number(m[1]));
  assert.equal(sizes.length,6);assert.ok(sizes.every(b=>b>1&&b<=cap),`${sizes} under ${cap}`);
});

// ---------------------------------------------------------------- Guido feedback 1, G1-03 and G1-11: the period catalogue
test('G1-11: File F panels show the holders the catalogue lists, never a first holder; without a catalogue they say so',()=>{
  // Without a catalogue: the recipients section says File F is unavailable; the other File F panels render nothing.
  const bare=viewOf(AZ);
  assert.match(renderToStaticMarkup(React.createElement(SECTIONS.PillarCRecipientsSection,{view:bare})),/I dati File F non sono disponibili in questo momento: il catalogo dei periodi non è stato letto/);
  assert.doesNotMatch(renderToStaticMarkup(React.createElement(SECTIONS.PillarCAttributionEvidence,{view:bare})),/File F 2025/);
  assert.equal(renderToStaticMarkup(React.createElement(SECTIONS.PillarCFileFMonthly,{view:bare})),'');
  // One holder in a full view: no selector, the holder named, the organisations without a File F named too.
  const all=renderToStaticMarkup(React.createElement(PillarCRecipientsSection,{view:viewOf(ALL)}));
  assert.doesNotMatch(all,/aria-label="Azienda del File F"/,'one holder: nothing to choose');
  assert.match(all,/File F 2025 · Unità 3: identificativi/);
  assert.match(all,/File F disponibile per: Unità 3 \(2025\)\. Non ricevuto per: Unità 1, Unità 2, Unità 4; per loro nessun valore viene stimato\./);
  // Two holders (synthetic): both offered, in catalogue order, and every File F panel follows the chosen one.
  const two=viewOf(ALL);const h1=two.units.find(u=>u.key==='asl-1').data;h1.fileF=extUnit('asl-3').fileF;h1.fileF.identifiers=6000;h1.fileF.age={...h1.fileF.age,total:6000,cells:[{id:'0-64',label:'0-64',count:2400,share:0.4},{id:'65+',label:'65+',count:3600,share:0.6}]};
  h1.fileF.contacts={status:'released',total:6000,cells:[{id:'1',label:'1',count:2400,share:0.4},{id:'2+',label:'2 o più',count:3600,share:0.6}]};h1.fileF.monthsActive={status:'released',total:6000,cells:[{id:'1',label:'1',count:3000,share:0.5},{id:'2+',label:'2 o più',count:3000,share:0.5}]};
  const cat=catalogOf(two);
  assert.deepEqual(cat.entries.filter(e=>e.sourceFamily==='file-f'&&e.granularity==='year').map(e=>e.unit),['asl-1','asl-3'],'both holders, none silently dropped');
  const opts=html=>[...(html.match(/<select aria-label="Azienda del File F"[^>]*>(.*?)<\/select>/)?.[1]??'').matchAll(/<option value="([^"]*)"[^>]*>([^<]*)<\/option>/g)].map(m=>[m[1],m[2]]);
  const rec=renderToStaticMarkup(React.createElement(PillarCRecipientsSection,{view:two}));
  assert.deepEqual(opts(rec),[['file-f.asl-1.year.2025-01','Unità 1 · 2025'],['file-f.asl-3.year.2025-01','Unità 3 · 2025']]);
  assert.match(rec,/File F 2025 · Unità 1: identificativi[\s\S]*?Identificativi distinti nell’anno<\/dt><dd[^>]*>6\.000</,'the shown holder’s own figures');
  const third=renderToStaticMarkup(React.createElement(PillarCFileFRecipients,{view:two,initial:{holder:'file-f.asl-3.year.2025-01'}}));
  assert.match(third,/File F 2025 · Unità 3: identificativi[\s\S]*?Identificativi distinti nell’anno<\/dt><dd[^>]*>5\.000</,'the other holder, when chosen');
  for(const html of [renderToStaticMarkup(React.createElement(PillarCAttributionEvidence,{view:two})),renderToStaticMarkup(React.createElement(PillarCFileFMonthly,{view:two}))])
    assert.deepEqual(opts(html).map(o=>o[0]),['file-f.asl-1.year.2025-01','file-f.asl-3.year.2025-01'],'every File F panel offers both holders');
  // A holder the catalogue does not list is not shown: a File F the catalogue refused stays out.
  const notListed=viewOf(AZ),catalog={...catalogOf(notListed),entries:catalogOf(notListed).entries.filter(e=>e.sourceFamily!=='file-f')};
  assert.doesNotMatch(renderToStaticMarkup(React.createElement(PERIOD.PillarCPeriodCatalogProvider,{catalog},React.createElement(SECTIONS.PillarCRecipientsSection,{view:notListed}))),/File F 2025 · Unità 3/);
});

test('G1-03: the File F period offers the year and the catalogued months; a month shows only the measures the catalogue lists',()=>{
  const v=viewOf(AZ),f=v.units.find(u=>u.key==='asl-3').data.fileF;
  f.months=f.months.filter(m=>m.month!=='2025-06');f.bridges=extBridges(f.months);
  f.identifiersByMonth=f.identifiersByMonth.map(m=>m.month==='2025-03'?{...m,count:2345}:m);
  const year=renderToStaticMarkup(React.createElement(PillarCFileFRecipients,{view:v}));
  const periods=[...(year.match(/<select aria-label="Periodo del File F"[^>]*>(.*?)<\/select>/)?.[1]??'').matchAll(/<option value="([^"]*)"[^>]*>([^<]*)<\/option>/g)].map(m=>m[2]);
  assert.equal(periods[0],'Anno 2025');assert.equal(periods.length,13,'the year and twelve months: June keeps its identifier count');
  assert.ok(periods.includes('giugno 2025'));
  // March: the month's amount and identifiers, and no annual distribution.
  const march=renderToStaticMarkup(React.createElement(PillarCFileFRecipients,{view:v,initial:{period:'file-f.asl-3.month.2025-03'}}));
  assert.match(march,/File F · Unità 3: marzo 2025/);
  assert.match(march,/Importo riportato nel mese<\/dt><dd[^>]*>1\.000\s€</);assert.match(march,/Di cui modalità 09<\/dt><dd[^>]*>0\s€</,'an observed zero is a number');
  assert.match(march,/Identificativi distinti nel mese<\/dt><dd[^>]*>2\.345</,'March’s own count');
  assert.doesNotMatch(march,/Identificativi distinti nell’anno|Indice di Gini|Profilo anagrafico|65 anni e oltre/,'no annual distribution shown as the month’s');
  assert.match(march,/Gli identificativi dei mesi non si sommano/);
  // June: identifiers only (no amount row in the source): the amount says unavailable, never zero.
  const june=renderToStaticMarkup(React.createElement(PillarCFileFRecipients,{view:v,initial:{period:'file-f.asl-3.month.2025-06'}}));
  assert.match(june,/Importo riportato nel mese<\/dt><dd[^>]*>non disponibile</);assert.match(june,/Identificativi distinti nel mese<\/dt><dd[^>]*>2\.000</);
  // A period id the catalogue does not list falls back to the year, never to another month.
  const unknown=renderToStaticMarkup(React.createElement(PillarCFileFRecipients,{view:v,initial:{period:'file-f.asl-3.month.2024-12'}}));
  assert.match(unknown,/Identificativi distinti nell’anno/);
  // The monthly panel: an observed zero for mode 09 is «0 €», and the forecast is stated as unavailable.
  const monthly=renderToStaticMarkup(React.createElement(PillarCFileFMonthly,{view:viewOf(AZ)}));
  assert.match(monthly,/>Gen<\/th><td[^>]*>1\.000\s€<\/td><td[^>]*>0\s€<\/td>/);
  assert.match(monthly,/data-c-forecast-readiness="filef">Previsione mensile: non disponibile\./);
  // DPC: the coverage names the catalogued reference month.
  assert.match(renderToStaticMarkup(React.createElement(PillarCRecipientsSection,{view:viewOf(AZ)})),/<dt[^>]*>Periodo<\/dt><dd[^>]*>Gennaio 2026: un solo mese<\/dd>/);
});

// ---------------------------------------------------------------- Codex review of 26 Oct 2026: G1-R01 and G1-R03
test('G1-R01: a zero reference mean gives no index, never NaN; a positive one keeps its index',()=>{
  const v=viewOf(AZ),f=v.units.find(u=>u.key==='asl-3').data.fileF;
  // Every amount in mode 09: the months without mode 09 are all zero, so the index has no base.
  f.months=f.months.map(m=>({...m,amount:m.amount,mode09:m.amount,withoutMode09:0}));f.bridges=extBridges(f.months);
  const html=renderToStaticMarkup(React.createElement(PillarCFileFMonthly,{view:v}));
  assert.doesNotMatch(html,/NaN|Infinity/);
  assert.equal((html.match(/>non calcolabile</g)||[]).length,12,'one «non calcolabile» per month');
  assert.match(html,/data-c-index-base="none">L’indice senza modalità 09 non è calcolabile: la media mensile di riferimento è pari a zero o negativa\./);
  assert.match(html,/>Gen<\/th><td[^>]*>1\.000\s€<\/td><td[^>]*>1\.000\s€<\/td><td[^>]*>0\s€<\/td>/,'the reported amounts stay as reported');
  const positive=renderToStaticMarkup(React.createElement(PillarCFileFMonthly,{view:viewOf(AZ)}));
  assert.match(positive,/>Gen<\/th>(<td[^>]*>[^<]*<\/td>){3}<td[^>]*>[0-9]+,[0-9]<\/td>/,'a positive base keeps the index');
  assert.doesNotMatch(positive,/non calcolabile|data-c-index-base/);
});

test('G1-R03: with tied values the median is described as the central value, never as a strict half',()=>{
  const v=viewOf(AZ),u=v.units.find(x=>x.key==='asl-3').data.january;
  u.use.prescriptions.quartiles={q1:1,median:1,q3:1};u.cost.quartiles={q1:40,median:40,q3:40};
  for(const html of [renderToStaticMarkup(React.createElement(RV.PillarCTypicalUse,{units:v.units})),renderToStaticMarkup(React.createElement(RV.PillarCCostPerRecipient,{units:v.units}))]){
    assert.match(html,/più destinatari possono avere lo stesso valore/);
    assert.doesNotMatch(html,/metà dei destinatari (riceve di meno|costa meno)|metà di più/,'no strict half below / half above');
  }
  assert.match(renderToStaticMarkup(React.createElement(RV.PillarCTypicalUse,{units:v.units})),/aria-label="Prescrizioni registrate per destinatario: Unità 3 mediana 1,0, metà centrale 1,0 – 1,0"/);
});

// ---------------------------------------------------------------- Codex live check A26-02 (26 Oct 2026)
test('A26-02: an Azienda without File F reads that its own File F was not received, and nothing about a peer',()=>{
  const az=viewOf(['asl-4','aggregato']);
  for(const html of [renderToStaticMarkup(React.createElement(PillarCRecipientsSection,{view:az})),renderToStaticMarkup(React.createElement(SECTIONS.PillarCRecipientsSection,{view:az}))]){
    const text=html.replace(/<[^>]*>/g,' ').replace(/\s+/g,' ');
    assert.equal((html.match(/data-c-filef-coverage="not-received"/g)||[]).length,1,'one statement, with or without a catalogue');
    assert.ok(text.includes('File F: non ricevuto per Unità 4. Le analisi di questa sezione usano solo i flussi DPC; nessun valore File F viene mostrato né stimato.'));
    assert.doesNotMatch(text,/Unità [123]|disponibile per|File F 2025|Identificativi distinti|non sono disponibili in questo momento/,'no peer, no holder, no empty analysis, not «unavailable»');
    assert.doesNotMatch(html,/aria-label="(Azienda del File F|Periodo del File F)"/);
  }
  // A view that holds File F keeps its holder panel and its coverage line; an aggregate-only view says nothing.
  const all=renderToStaticMarkup(React.createElement(PillarCRecipientsSection,{view:viewOf(ALL)}));
  assert.doesNotMatch(all,/data-c-filef-coverage/);assert.match(all,/Non ricevuto per: Unità 1, Unità 2, Unità 4; per loro nessun valore viene stimato\./);
  assert.doesNotMatch(renderToStaticMarkup(React.createElement(PillarCRecipientsSection,{view:viewOf(['aggregato'])})),/data-c-filef-coverage/);
});

test('A26-02: the coverage line names an Azienda’s own ASL and the four-Azienda aggregate, «la loro somma» only for the four ASLs',()=>{
  const orgs=units=>{const m=renderToStaticMarkup(React.createElement(PillarCRecipientsSection,{view:viewOf(units)})).match(/<dt[^>]*>Organizzazioni<\/dt><dd[^>]*>([^<]*)<\/dd>/);assert.ok(m);return m[1];};
  assert.equal(orgs(['asl-4','aggregato']),'Unità 4 e l’aggregato delle quattro Aziende');
  assert.equal(orgs(ALL),'Unità 1, Unità 2, Unità 3, Unità 4 e la loro somma');
  assert.equal(orgs(['asl-4']),'Unità 4');
});
