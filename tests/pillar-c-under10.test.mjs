// Pillar C, the DPC medicines with an average acquisition below 10 € per pack (joint feedback 2, G2-16): the closed
// schema and the arithmetic of the parser, the loaders per audience against a fake Storage, the client audience check,
// the list itself (initial order, search, sort, totals, the zero-acquisition flag, the «others» row) and its place in
// the DPC view of every workspace. Synthetic data only (tests/fixtures/pillar-c-under10.mjs); the private objects are
// read, when present locally, for a pass/fail check against the pins.
import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import {createRequire,register} from 'node:module';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {IDENTITY_STUBS,registerPillarCStubs,as} from './helpers/pillar-c-scoped-stubs.mjs';
import {fakeSessionClient,scopedFixture} from './fixtures/pillar-c-scoped.mjs';
import {U10_UNITS,u10Entry,u10Object,u10Fixture,u10ViewOf} from './fixtures/pillar-c-under10.mjs';
import {extUnit,extReviewer} from './fixtures/pillar-c-extension.mjs';
import {cReviewV2Fixture} from './fixtures/pillar-c-review.mjs';

registerPillarCStubs({...IDENTITY_STUBS,
  'lib/dashboard-review/pillar-c/under10-storage.ts':`export const C_UNDER10_STORAGE=new Proxy({},{get:(_,k)=>globalThis.__pcs.u10[k]});export const C_UNDER10_MAX_BYTES=262144;`,
},{tsx:true});
// next/link is a CommonJS entry without an exports map: resolve it by its file name (the dossier's Pillar B link).
register('data:text/javascript,'+encodeURIComponent(`export async function resolve(s,c,n){return n(s==='next/link'?'next/link.js':s,c);}`),import.meta.url);
const root=fileURLToPath(new URL('..',import.meta.url));
const req=createRequire(`${root}package.json`),React=req('react'),{renderToStaticMarkup}=req('react-dom/server');
const {SearchParamsContext}=req('next/dist/shared/lib/hooks-client-context.shared-runtime');
const at=p=>import(pathToFileURL(`${root}${p}`).href);
const {parseCUnder10}=await at('lib/dashboard-review/pillar-c/under10-parse.ts');
const {loadCUnder10Reviewer,loadCUnder10Scoped}=await at('lib/dashboard-review/pillar-c/under10-loader.ts');
const {C_U10_COPY,cUnder10For}=await at('lib/dashboard-review/pillar-c/under10.ts');
const {C_EXT_UNIT_LABELS}=await at('lib/dashboard-review/pillar-c/extension.ts');
const {PillarCUnder10List,cU10Matches}=await at('components/dashboard-review/pillar-c/under10-list.tsx');
const {PillarCScopedWorkspace}=await at('components/dashboard-review/pillar-c/scoped-workspace.tsx');
const {PillarCAnalyticalWorkspace}=await at('components/dashboard-review/pillar-c/analytical-workspace.tsx');
const {PillarCPeriodCatalogProvider}=await at('components/dashboard-review/pillar-c/period-context.tsx');
const {buildCPeriodCatalog,publicCPeriodCatalog}=await at('lib/dashboard-review/pillar-c/period-catalog.ts');
const {C_REVIEWER_CLIENT_AUDIENCE,toClientAudience}=await at('lib/dashboard-review/pillar-c/audience-rules.ts');
const {guardCClientAudience,guardCScopedPayload}=await at('lib/dashboard-review/pillar-c/payload-guard.ts');
const {mergeCScopedReview,parseCScopedReviewFile}=await at('lib/dashboard-review/pillar-c/scoped-review.ts');
const {parseCReviewPacket}=await at('lib/dashboard-review/pillar-c/review.ts');

const refuse=(fn,reason)=>assert.throws(fn,e=>e instanceof Error&&e.message.startsWith(`PILLAR_C_UNDER10_${reason}`),reason);
const quiet=async fn=>{const w=console.warn;console.warn=()=>{};try{return await fn();}finally{console.warn=w;}};
const ALL=['aggregato','asl-1','asl-2','asl-3','asl-4'],AZ4=['asl-4','aggregato'];
const AZIENDA4={kind:'azienda',orgCode:'204',orgName:'Azienda sintetica Quattro',unit:'asl-4',units:AZ4};
const REGIONE={kind:'regione',orgCode:'130',units:ALL};

// ================================================================ the parser
test('valid objects parse: one ASL, or the four in order; the aggregate has no list',()=>{
  for(const u of U10_UNITS)assert.deepEqual(parseCUnder10(u10Object([u]),[u]),[u10Entry(u)]);
  assert.deepEqual(parseCUnder10(u10Object(U10_UNITS),U10_UNITS).map(e=>e.unit),U10_UNITS);
  refuse(()=>parseCUnder10(u10Object(['asl-2','asl-1']),['asl-1','asl-2']),'UNIT_ORDER');
  refuse(()=>parseCUnder10(u10Object(['asl-1']),['asl-1','asl-2']),'UNITS');
  refuse(()=>parseCUnder10(u10Object(['asl-1'],o=>{o.units[0].unit='aggregato';}),['asl-1']),'UNIT');
  refuse(()=>parseCUnder10(u10Object(['asl-1'],o=>{o.units[0].unit='PE';}),['asl-1']),'UNIT');
});

test('closed schema: every key exact, amounts as safe integers, a nine-digit AIC, short screened text',()=>{
  const bad=(f,reason)=>refuse(()=>parseCUnder10(u10Object(['asl-1'],f),['asl-1']),reason);
  bad(o=>{o.extra=1;},'KEYS');bad(o=>{delete o.minRecipients;},'KEYS');bad(o=>{o.units[0].rows[0].patients=3;},'KEYS');bad(o=>{delete o.units[0].others.zeroAcquisition;},'KEYS');
  bad(o=>{o.thresholdCents=1100;},'HEADER');bad(o=>{o.period='2026-02';},'HEADER');bad(o=>{o.schema='pillar-c-under10-v2';},'HEADER');
  bad(o=>{o.units[0].rows[0].aic='90000110';},'AIC');bad(o=>{o.units[0].rows[0].aic=900001101;},'AIC');
  bad(o=>{o.units[0].rows[0].packs=0;},'NUMBER');bad(o=>{o.units[0].rows[0].serviceCents=-1;},'NUMBER');bad(o=>{o.units[0].rows[0].acquisitionCents=1.5;},'NUMBER');bad(o=>{o.units[0].rows[0].serviceCents='80000';},'NUMBER');
  bad(o=>{o.units[0].rows[0].medicine='';},'TEXT');bad(o=>{o.units[0].rows[0].pack='x'.repeat(201);},'TEXT');bad(o=>{o.units[0].rows[0].ingredient='<b>x</b>';},'TEXT');
  bad(o=>{o.units[0].rows[0].medicine='Farmaco di Pescara';},'PLACE');bad(o=>{o.units[0].rows[1].pack='lotto 130204';},'NSIS');
  // An AIFA pack description may name a packaging material such as PE: the province screen is for keys only.
  assert.equal(parseCUnder10(u10Object(['asl-1']),['asl-1'])[0].rows[0].pack,'28 compresse in blister PVC/PE');
});

test('arithmetic: under the threshold unrounded, one row per AIC by service, and everything adds up to the total',()=>{
  const bad=(f,reason)=>refuse(()=>parseCUnder10(u10Object(['asl-1'],f),['asl-1']),reason);
  // Exactly 10 € a pack is excluded; 9,999 € (shown as 10,00 €) is in.
  bad(o=>{const r=o.units[0].rows[2];r.acquisitionCents=40000;o.units[0].total.acquisitionCents+=4;},'THRESHOLD');
  assert.equal(parseCUnder10(u10Object(['asl-1']),['asl-1'])[0].rows[2].acquisitionCents,39996);
  bad(o=>{o.units[0].rows.reverse();},'ORDER');bad(o=>{o.units[0].rows[1].aic=o.units[0].rows[0].aic;},'DUPLICATE');
  bad(o=>{o.units[0].total.serviceCents+=1;},'TOTAL');bad(o=>{o.units[0].total.products+=1;},'TOTAL');bad(o=>{o.units[0].others.packs+=1;},'TOTAL');
  bad(o=>{o.units[0].others.zeroAcquisition=3;},'OTHERS');bad(o=>{o.units[0].others.acquisitionCents=7000;o.units[0].total.acquisitionCents+=4900;},'OTHERS');
  // No «others» row: the rows alone add up.
  assert.equal(parseCUnder10(u10Object(['asl-4']),['asl-4'])[0].others,null);
});

// ================================================================ the loaders
test('reviewer loader: gated, pinned by size and hash, ASL 1-4 under the reviewed labels, fails closed',async()=>{
  const fx=u10Fixture();as({pins:{root:'v1',bucket:'pillar-c-scoped'},client:()=>null});globalThis.__pcs.u10=fx.pins;
  const remote=async()=>({state:'ready',bytes:new Uint8Array(fx.fullBytes)});
  let reads=0;const counted=async()=>{reads++;return remote();};
  assert.deepEqual(await loadCUnder10Reviewer(true,false,counted),{state:'forbidden'});assert.deepEqual(await loadCUnder10Reviewer(false,true,counted),{state:'forbidden'});
  assert.equal(reads,0,'nothing is read before the gate');
  const ok=await loadCUnder10Reviewer(true,true,remote);
  assert.equal(ok.state,'ready');assert.deepEqual(ok.view.units.map(u=>[u.key,u.label]),U10_UNITS.map(u=>[u,C_EXT_UNIT_LABELS[u]]));
  const tampered=Buffer.from(fx.fullBytes);tampered[40]^=1;
  assert.deepEqual(await loadCUnder10Reviewer(true,true,async()=>({state:'ready',bytes:new Uint8Array(tampered)})),{state:'unavailable'});
  assert.deepEqual(await loadCUnder10Reviewer(true,true,async()=>({state:'invalid'})),{state:'unavailable'});
  assert.deepEqual(await loadCUnder10Reviewer(true,true,async()=>({state:'not_configured'})),{state:'not_configured'});
  // Bytes that match their pin but break a rule are unavailable too.
  const bad=u10Fixture({full:o=>{o.units[1].total.packs+=1;}});globalThis.__pcs.u10=bad.pins;
  assert.deepEqual(await loadCUnder10Reviewer(true,true,async()=>({state:'ready',bytes:new Uint8Array(bad.fullBytes)})),{state:'unavailable'});
});

test('Regione loader: the four ASLs from its regional folder, under its own session and labels',async()=>{
  const fx=u10Fixture();as({pins:{root:'v1',bucket:'pillar-c-scoped'},client:()=>null});globalThis.__pcs.u10=fx.pins;
  const labels=u=>u==='aggregato'?'Aggregato regionale':`ASL ${u.slice(4)}`;
  const s=fakeSessionClient(fx,{visible:[...ALL,'regione']});
  const r=await loadCUnder10Scoped(REGIONE,s.client,labels);
  assert.equal(r.state,'ready');assert.deepEqual(r.view.units.map(u=>[u.key,u.label]),U10_UNITS.map(u=>[u,labels(u)]));
  assert.deepEqual(s.calls.downloads.map(d=>[d.bucket,d.path,d.params.cache]),[['pillar-c-scoped',`v9/regione/${fx.pins.regional.name}`,'no-store']]);
  assert.deepEqual(await quiet(()=>loadCUnder10Scoped(REGIONE,fakeSessionClient(fx,{visible:ALL}).client,labels)),{state:'unavailable'},'the regional folder refused');
  assert.deepEqual(await quiet(()=>loadCUnder10Scoped(REGIONE,fakeSessionClient(fx,{visible:[...ALL,'regione']}).client,()=>null)),{state:'unavailable'},'a label the audience does not give');
  const shuffled=fakeSessionClient(fx,{visible:[...ALL,'regione']});
  assert.deepEqual(await loadCUnder10Scoped({...REGIONE,units:['aggregato','asl-2','asl-1','asl-3','asl-4']},shuffled.client,labels),{state:'forbidden'});
  assert.equal(shuffled.calls.downloads.length,0);
});

test('Azienda loader: its own ASL only, never another unit or the regional folder; any defect is «unavailable»',async()=>{
  const fx=u10Fixture();as({pins:{root:'v1',bucket:'pillar-c-scoped'},client:()=>null});globalThis.__pcs.u10=fx.pins;
  const labels=u=>({'asl-4':'Azienda sintetica Quattro',aggregato:'Aggregato delle quattro Aziende'})[u]??null;
  const s=fakeSessionClient(fx,{visible:AZ4});
  const r=await loadCUnder10Scoped(AZIENDA4,s.client,labels);
  assert.equal(r.state,'ready');assert.deepEqual(r.view.units.map(u=>[u.key,u.label]),[['asl-4','Azienda sintetica Quattro']]);
  assert.deepEqual(s.calls.downloads.map(d=>d.path),[`v9/asl-4/${fx.pins.scoped['asl-4'].name}`],'one read: its own ASL');
  for(const visible of [['aggregato'],[]])assert.deepEqual(await quiet(()=>loadCUnder10Scoped(AZIENDA4,fakeSessionClient(fx,{visible}).client,labels)),{state:'unavailable'},String(visible));
  assert.deepEqual(await quiet(()=>loadCUnder10Scoped(AZIENDA4,fakeSessionClient(fx,{visible:AZ4,fail:'throw'}).client,labels)),{state:'unavailable'});
  globalThis.__pcs.u10={...fx.pins,scoped:{...fx.pins.scoped,'asl-4':{...fx.pins.scoped['asl-4'],sha256:'0'.repeat(64)}}};
  assert.deepEqual(await quiet(()=>loadCUnder10Scoped(AZIENDA4,fakeSessionClient(fx,{visible:AZ4}).client,labels)),{state:'unavailable'},'another hash');
  globalThis.__pcs.u10=fx.pins;
  const odd=fakeSessionClient(fx,{visible:ALL});
  assert.deepEqual(await loadCUnder10Scoped({...AZIENDA4,unit:'asl-1'},odd.client,labels),{state:'forbidden'},'a unit the audience does not hold');
  assert.equal(odd.calls.downloads.length,0);
});

const PRIVATE=fileURLToPath(new URL('../../outputs/pillar-c/feedback-joint-2-20261027/claude-implementation/under10-delivery/',import.meta.url));
test('the private objects pass the real parser and match the pins in the repository (pass/fail only)',{skip:existsSync(`${PRIVATE}PINS_UNDER10.json`)?false:'the private build is not available locally'},async()=>{
  const pins=JSON.parse(readFileSync(`${PRIVATE}PINS_UNDER10.json`,'utf8'));
  const src=readFileSync(`${root}lib/dashboard-review/pillar-c/under10-storage.ts`,'utf8');
  for(const p of [...Object.values(pins.scoped),pins.regional])assert.ok(src.includes(p.name)&&src.includes(String(p.bytes)),p.name.slice(0,20));
  assert.ok(src.includes(pins.reviewer.object));
  for(const u of U10_UNITS){const b=readFileSync(`${PRIVATE}objects/v9/${u}/${pins.scoped[u].name}`);assert.equal(b.length,pins.scoped[u].bytes);assert.equal(parseCUnder10(JSON.parse(b),[u]).length,1);}
  const full=readFileSync(`${PRIVATE}objects/v9/regione/${pins.regional.name}`);
  assert.deepEqual(full,readFileSync(`${PRIVATE}objects/${pins.reviewer.object}`),'the reviewer object is the regional object byte for byte');
  assert.equal(parseCUnder10(JSON.parse(full),U10_UNITS).length,4);
});

// ================================================================ the client audience check
test('client check: exactly the audience’s ASLs under its labels, otherwise «not available»',()=>{
  const SERVER={azienda4:AZIENDA4,regione:REGIONE};
  const client=k=>guardCClientAudience(toClientAudience(SERVER[k]),SERVER[k]);
  const az=client('azienda4'),rg=client('regione');
  const own=u10ViewOf(['asl-4'],()=>'Azienda sintetica Quattro');
  assert.equal(cUnder10For(az,own),own);
  assert.equal(cUnder10For(az,u10ViewOf(['asl-4'])),null,'another label');
  assert.equal(cUnder10For(az,u10ViewOf(U10_UNITS)),null,'the Regione’s list');
  assert.equal(cUnder10For(az,u10ViewOf(['asl-3'],()=>'Azienda sintetica Quattro')),null,'a peer');
  const four=u10ViewOf(U10_UNITS);
  assert.equal(cUnder10For(rg,four),four);assert.equal(cUnder10For(rg,u10ViewOf(['asl-1','asl-2','asl-4','asl-3'])),null);
  const reviewer=u10ViewOf(U10_UNITS,u=>C_EXT_UNIT_LABELS[u]);
  assert.equal(cUnder10For(C_REVIEWER_CLIENT_AUDIENCE,reviewer),reviewer);assert.equal(cUnder10For(C_REVIEWER_CLIENT_AUDIENCE,u10ViewOf(U10_UNITS,u=>`Unità ${u.slice(4)}`)),null,'not the reviewed labels');
  assert.equal(cUnder10For(null,four),null);assert.equal(cUnder10For(rg,null),null);
});

// ================================================================ the list
const render=(el,search='')=>renderToStaticMarkup(React.createElement(SearchParamsContext.Provider,{value:new URLSearchParams(search)},el));
const text=h=>h.replace(/<[^>]*>/g,' ').replace(/&#x27;/g,'’').replace(/&amp;/g,'&').replace(/\s+/g,' ');
const n=s=>s.replace(/\s/g,' ');
const bodyRows=h=>[...h.slice(h.indexOf('<tbody>'),h.indexOf('</tbody>')).matchAll(/<tr[^>]*>(.*?)<\/tr>/g)].map(m=>[...m[1].matchAll(/<t[hd][^>]*>(.*?)<\/t[hd]>/g)].map(x=>n(text(x[1]).trim())));
const list=(view,initial)=>render(React.createElement(PillarCUnder10List,{view,initial}));

test('the list: by service first, the columns asked for, per-pack values of the row, the «others» row and the totals',()=>{
  const h=list(u10ViewOf(['asl-1']));
  assert.ok(text(h).includes(C_U10_COPY.title));assert.ok(text(h).includes(C_U10_COPY.lead));
  assert.deepEqual([...h.matchAll(/<th scope="col"[^>]*>([^<]*)<\/th>/g)].map(m=>m[1]),['Principio attivo','Farmaco e confezione','AIC','Confezioni','Acquisto medio per confezione','Servizio medio per confezione','Spesa di servizio']);
  const rows=bodyRows(h);
  assert.deepEqual(rows.slice(0,3).map(r=>r[2]),['900001101','900001102','900001103'],'nine-digit AICs, highest service first');
  assert.deepEqual(rows[0],['Sostanza sintetica uno','Farmaco sintetico Alfa 1 28 compresse in blister PVC/PE','900001101','100','5,00 €','8,00 €','800,00 €']);
  assert.equal(rows[2][4],'10,00 €','9,999 € a pack is shown as 10,00 € and stays in the list');
  assert.deepEqual(rows[3],['Altri 2 farmaci, ciascuno erogato a meno di 5 assistiti (di cui 1 con acquisto registrato pari a zero)','7','3,00 €','8,00 €','56,00 €']);
  const total=h.slice(h.indexOf('<tfoot>'),h.indexOf('</tfoot>'));
  assert.deepEqual([...total.matchAll(/<t[hd][^>]*>([^<]*)<\/t[hd]>/g)].map(m=>n(m[1])),['Totale del gruppo sotto 10 €: 5 farmaci','207','7,06 €','8,00 €','1.656,00 €'],'the group: rows and «others» together');
  assert.match(text(h),/ASL 1: 5 farmaci \(codici AIC\) sotto la soglia, 207 confezioni, spesa di servizio 1\.656,00\s€ e acquisto 1\.460,96\s€\./);
  for(const s of [C_U10_COPY.threshold,C_U10_COPY.others,C_U10_COPY.zeroNote,C_U10_COPY.identity,C_U10_COPY.noAggregate])assert.ok(text(h).includes(s),s.slice(0,30));
  assert.match(h,/<summary[^>]*>Da dove viene questo dato\?<\/summary>/);
  assert.doesNotMatch(h,/risparmi(?! accertati)|÷|NaN|undefined/,'no saving, no formula');
});

test('the list: a listed zero acquisition is flagged in words; search ignores case and accents; sorting keeps the totals',()=>{
  const v=u10ViewOf(['asl-1']);v.units[0].entry=structuredClone(v.units[0].entry);
  const e=v.units[0].entry;e.rows[1].acquisitionCents=0;e.total.acquisitionCents-=54000;
  const h=list(v);
  assert.match(h,/data-c-under10-zero="true"><span class="block">0,00\s€<\/span><span class="block[^"]*">acquisto registrato pari a zero<\/span>/,'in words, not colour alone');
  assert.equal(cU10Matches(e.rows[1],'ACIDO'),true);assert.equal(cU10Matches(e.rows[1],'900001102'),true);assert.equal(cU10Matches(e.rows[1],'gamma'),false);
  const found=list(u10ViewOf(['asl-1']),{query:'acido'});
  assert.deepEqual(bodyRows(found).map(r=>r[2]),['900001102'],'the «others» row never matches a search');
  assert.match(text(found),/Righe trovate: 1 di 3 farmaci elencati\. La riga dei farmaci riuniti non entra nella ricerca\./);
  assert.ok(!found.includes('<tfoot>'),'no group total under a filtered list');
  assert.match(text(list(u10ViewOf(['asl-1']),{query:'zzz'})),/Nessun farmaco elencato corrisponde alla ricerca\./);
  const byIngredient=bodyRows(list(u10ViewOf(['asl-1']),{sort:'ingredient'})).slice(0,3).map(r=>r[0]);
  assert.deepEqual(byIngredient,['Àcido sintetico due','Base sintetica tre','Sostanza sintetica uno']);
  assert.deepEqual(bodyRows(list(u10ViewOf(['asl-1']),{sort:'acquisition'})).slice(0,3).map(r=>r[2]),['900001101','900001102','900001103'],'lowest average acquisition first');
});

test('the list: one ASL at a time for the Regione and the reviewer; an Azienda has no selector; an honest unavailable state',()=>{
  const four=list(u10ViewOf(U10_UNITS),{unit:'asl-3'});
  assert.deepEqual([...four.matchAll(/<option value="(asl-[1-4])"[^>]*>([^<]*)<\/option>/g)].map(m=>[m[1],m[2]]),U10_UNITS.map(u=>[u,`ASL ${u.slice(4)}`]));
  assert.match(four,/data-c-under10="asl-3"/);assert.equal(bodyRows(four)[0][2],'900003101');
  const own=list(u10ViewOf(['asl-4'],()=>'Azienda sintetica Quattro'));
  assert.doesNotMatch(own,/aria-label="ASL dell’elenco"/);assert.ok(!own.includes('data-c-under10-others'),'no «others» row when there is none');
  assert.equal(list(null),'');
  assert.ok(text(render(React.createElement(PillarCUnder10List,{view:null,unavailable:true}))).includes(C_U10_COPY.unavailable));
  assert.match(own,/<input type="search" aria-label="Cerca per farmaco, principio attivo o AIC"[^>]*class="[^"]*\bh-11\b/,'a 44 px control');
});

// ================================================================ the place of the list in each workspace
const SERVER={azienda4:AZIENDA4,regione:REGIONE};
const client=k=>guardCClientAudience(toClientAudience(SERVER[k]),SERVER[k]);
const fixture=scopedFixture();
const packetOf=k=>{const units=[...SERVER[k].units];return guardCScopedPayload('review',mergeCScopedReview(units,units.map(u=>parseCScopedReviewFile(fixture.reviews[u],u))),units);};
const reviewerPacket=parseCReviewPacket(cReviewV2Fixture());
const extensionOf=k=>{const c=client(k);if(k==='regione'){const r=extReviewer();return {units:c.orgs.map(o=>({key:o.key,label:o.label,data:r.units.find(u=>u.unit===o.key)})),drivers:r.drivers,baskets:r.baskets,fileFBasket:r.fileFBasket,findings:r.findings};}
  return {units:c.orgs.map(o=>({key:o.key,label:o.label,data:o.key===SERVER[k].unit?extUnit(o.key):{...extUnit(o.key,4000),unitCosts:null}})),drivers:null,baskets:null,fileFBasket:null,findings:null};};
const reviewerExtension=()=>{const r=extReviewer();return {units:ALL.map(u=>({key:u,label:C_EXT_UNIT_LABELS[u],data:r.units.find(x=>x.unit===u)})),drivers:r.drivers,baskets:r.baskets,fileFBasket:r.fileFBasket,findings:r.findings};};
const catalogued=(el,view)=>React.createElement(PillarCPeriodCatalogProvider,{catalog:publicCPeriodCatalog(buildCPeriodCatalog(view,{mode:'synthetic'}))},el);
const quietRender=(el,search)=>{const e=console.error;console.error=()=>{};try{return render(el,search);}finally{console.error=e;}};
const scoped=(k,props,search='?c_fonte=dpc')=>{const extension=extensionOf(k);return quietRender(catalogued(React.createElement(PillarCScopedWorkspace,{audience:client(k),packet:packetOf(k),forecast:null,extension,...props}),extension),search);};
const reviewer=(props,search='?c_fonte=dpc')=>{const extension=reviewerExtension();return quietRender(catalogued(React.createElement(PillarCAnalyticalWorkspace,{audience:C_REVIEWER_CLIENT_AUDIENCE,packet:reviewerPacket,extension,...props}),extension),search);};

test('in every workspace: in the DPC view right after the service measures, the audience’s own ASLs only, never in the ledger view',()=>{
  const cases=[['reviewer',s=>reviewer({under10:u10ViewOf(U10_UNITS,u=>C_EXT_UNIT_LABELS[u])},s),'asl-1'],
    ['regione',s=>scoped('regione',{under10:u10ViewOf(U10_UNITS)},s),'asl-1'],
    ['azienda4',s=>scoped('azienda4',{under10:u10ViewOf(['asl-4'],()=>'Azienda sintetica Quattro')},s),'asl-4']];
  for(const [label,render_,first] of cases){
    const h=render_('?c_fonte=dpc'),i=h.indexOf(`data-c-under10="${first}"`);
    assert.ok(i>0,`${label}: the list`);
    assert.ok(h.indexOf('<section id="dpc"')<h.indexOf('Quanto pesa il servizio delle farmacie sul costo DPC?')&&h.indexOf('Quanto pesa il servizio delle farmacie sul costo DPC?')<i&&i<h.indexOf('Giorni tra prescrizione ed erogazione registrata'),`${label}: right after the service measures, before recorded intervals`);
    for(const s of ['','?c_fonte=filef'])assert.ok(!render_(s).includes('data-c-under10='),`${label} ${s||'ledger'}: not outside the DPC view`);
  }
  const az=scoped('azienda4',{under10:u10ViewOf(['asl-4'],()=>'Azienda sintetica Quattro')});
  assert.doesNotMatch(az,/data-c-under10="asl-[123]"|90000[123]10/,'no peer medicine');
  // A list that is not the audience's (the Regione's under an Azienda, another label) reads as unavailable, with no row.
  for(const leaked of [u10ViewOf(U10_UNITS),u10ViewOf(['asl-4'])]){
    const h=scoped('azienda4',{under10:leaked});
    assert.ok(text(h).includes(C_U10_COPY.unavailable));assert.ok(!h.includes('data-c-under10='));
  }
  assert.ok(text(scoped('regione',{under10Unavailable:true})).includes(C_U10_COPY.unavailable),'published but unreadable');
  assert.ok(!text(scoped('regione',{})).includes(C_U10_COPY.unavailable),'not part of the page: nothing');
});

test('copy and source rules of the list modules',()=>{
  const read=p=>readFileSync(`${root}${p}`,'utf8');
  for(const file of ['components/dashboard-review/pillar-c/under10-list.tsx','lib/dashboard-review/pillar-c/under10.ts']){
    const src=read(file);
    assert.doesNotMatch(src,/verificat|\bdemo\b|dimostra|in arrivo|destinatar|paziente/i,file);
    assert.equal(src.split(String.fromCharCode(0xa0)).length-1,0,`${file}: no raw no-break space`);
    assert.doesNotMatch(src,/fetch\(|process\.env|localStorage|sessionStorage|import "server-only"/,file);
  }
  for(const file of ['lib/dashboard-review/pillar-c/under10-parse.ts','lib/dashboard-review/pillar-c/under10-loader.ts','lib/dashboard-review/pillar-c/under10-storage.ts'])assert.match(read(file),/^import "server-only";/,file);
  // A change of ASL, order or search replaces the keyed block whole (Chrome page translation keeps no stale value).
  assert.ok(read('components/dashboard-review/pillar-c/under10-list.tsx').includes('<div key={`${unit.key}|${sort}|${query}`} data-c-under10={unit.key}>'));
});
