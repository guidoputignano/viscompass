// Pillar C additions (build add-v1, owner decision D24-4 of 24 Oct 2026): P8-03 residence, P10-04 narrowing by area and
// P10-05 File F attribution fields. The closed-schema guard, the semantic parser and its disclosure rules (hidden-cell
// pattern, small remainders, complements), the loaders per audience against fake storage, the check against the
// extension, the client audience check, the pins, and the rendered panels in both workspaces. Synthetic data only
// (tests/fixtures/pillar-c-additions.mjs); the private objects are read, when present locally, for a pass/fail check.
import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync,readdirSync} from 'node:fs';
import {createRequire,register} from 'node:module';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {IDENTITY_STUBS,registerPillarCStubs,as} from './helpers/pillar-c-scoped-stubs.mjs';
import {fakeSessionClient,scopedFixture} from './fixtures/pillar-c-scoped.mjs';
import {ADD_UNITS,ADD_ASL,HIDDEN,addEntry,addUnitObject,addFullObject,addFixture,addViewOf,sha256} from './fixtures/pillar-c-additions.mjs';
import {extUnit,extReviewer} from './fixtures/pillar-c-extension.mjs';
import {cReviewV2Fixture} from './fixtures/pillar-c-review.mjs';

registerPillarCStubs({...IDENTITY_STUBS,
  'lib/dashboard-review/pillar-c/additions-storage.ts':`export const C_ADDITIONS_STORAGE=new Proxy({},{get:(_,k)=>globalThis.__pcs.add[k]});export const C_ADDITIONS_MAX_BYTES=65536;`,
},{tsx:true});
// next/link is a CommonJS entry without an exports map: resolve it by its file name (the dossier's Pillar B link).
register('data:text/javascript,'+encodeURIComponent(`export async function resolve(s,c,n){return n(s==='next/link'?'next/link.js':s,c);}`),import.meta.url);
const root=fileURLToPath(new URL('..',import.meta.url));
const req=createRequire(`${root}package.json`),React=req('react'),{renderToStaticMarkup}=req('react-dom/server');
const {SearchParamsContext}=req('next/dist/shared/lib/hooks-client-context.shared-runtime');
const at=p=>import(pathToFileURL(`${root}${p}`).href);
const {parseCAdditionsUnit,parseCAdditionsFull,cAdditionsComplementCheck,cAdditionsWithExtension}=await at('lib/dashboard-review/pillar-c/additions-parse.ts');
const {loadCAdditionsReviewer,loadCAdditionsScoped}=await at('lib/dashboard-review/pillar-c/additions-loader.ts');
const {cAdditionsFor,cAdditionsHoldsFileF,C_ADD_COPY,C_ADD_HIDDEN_LABEL}=await at('lib/dashboard-review/pillar-c/additions.ts');
const {C_EXT_UNIT_LABELS}=await at('lib/dashboard-review/pillar-c/extension.ts');
const {C_SCOPED_POLICY_NAME}=await at('lib/dashboard-review/pillar-c/scoped-transport.ts');
const {PillarCAdditionsResidence,PillarCAdditionsNarrowing,PillarCAdditionsFileF}=await at('components/dashboard-review/pillar-c/additions-sections.tsx');
const {PillarCScopedWorkspace}=await at('components/dashboard-review/pillar-c/scoped-workspace.tsx');
const {PillarCAnalyticalWorkspace}=await at('components/dashboard-review/pillar-c/analytical-workspace.tsx');
const {PillarCPeriodCatalogProvider}=await at('components/dashboard-review/pillar-c/period-context.tsx');
const {buildCPeriodCatalog,publicCPeriodCatalog}=await at('lib/dashboard-review/pillar-c/period-catalog.ts');
const {C_REVIEWER_CLIENT_AUDIENCE,toClientAudience}=await at('lib/dashboard-review/pillar-c/audience-rules.ts');
const {guardCClientAudience,guardCScopedPayload,C_PROVINCE_TOKEN,C_PLACE_NAME}=await at('lib/dashboard-review/pillar-c/payload-guard.ts');
const {mergeCScopedReview,parseCScopedReviewFile}=await at('lib/dashboard-review/pillar-c/scoped-review.ts');
const {parseCReviewPacket}=await at('lib/dashboard-review/pillar-c/review.ts');

const ALL=['aggregato','asl-1','asl-2','asl-3','asl-4'];
const AZ3=['asl-3','aggregato'],AZ4=['asl-4','aggregato'];
const AZIENDA3={kind:'azienda',orgCode:'203',orgName:'Azienda sintetica Tre',unit:'asl-3',units:AZ3};
const AZIENDA4={kind:'azienda',orgCode:'204',orgName:'Azienda sintetica Quattro',unit:'asl-4',units:AZ4};
const REGIONE={kind:'regione',orgCode:'130',units:ALL};
const refuse=(fn,reason)=>assert.throws(fn,e=>e instanceof Error&&e.message.startsWith('PILLAR_C_ADDITIONS_')&&new RegExp(reason).test(e.message),reason);
const unit=(u,f)=>{const o=addUnitObject(u);f?.(o);return o;};
const full=f=>{const o=addFullObject();f?.(o);return o;};
const at_=(o,u)=>o.units.find(e=>e.unit===u);
const quiet=async fn=>{const w=console.warn;console.warn=()=>{};try{return await fn();}finally{console.warn=w;}};

// ================================================================ parser
test('valid objects parse: the five unit objects, the full object, and each Azienda pair',()=>{
  for(const u of ADD_UNITS){const e=parseCAdditionsUnit(addUnitObject(u),u,ALL);assert.equal(e.unit,u);assert.deepEqual(e,addEntry(u));assert.equal(e.fileFFields!==null,u==='asl-3');}
  const entries=parseCAdditionsFull(addFullObject());
  assert.deepEqual(entries.map(e=>e.unit),ALL);assert.deepEqual(entries,ADD_UNITS.map(addEntry),'each unit object equals its entry of the full object');
  for(const u of ADD_ASL)cAdditionsComplementCheck(parseCAdditionsUnit(addUnitObject(u),u,[u,'aggregato']),parseCAdditionsUnit(addUnitObject('aggregato'),'aggregato',[u,'aggregato']));
  // The hidden marker survives the guard as the marker itself, never as a value.
  assert.equal(parseCAdditionsUnit(addUnitObject('asl-4'),'asl-4',AZ4).narrowing.narrowed.byArea.NEF,HIDDEN);
});

test('closed schema: unknown, missing and undelivered keys, small counts, shares outside [0, 1] and other literals are refused',()=>{
  refuse(()=>parseCAdditionsUnit(unit('asl-1',o=>{o.extra=1;}),'asl-1',ALL),'GUARD .*UNKNOWN_FIELD');
  refuse(()=>parseCAdditionsUnit(unit('asl-1',o=>{delete o.residence.unknown;}),'asl-1',ALL),'GUARD .*MISSING_FIELD');
  // What the delivery disclosure review does not ship: the eligible spend, the rule internals, labels, sources, prose.
  refuse(()=>parseCAdditionsUnit(unit('asl-1',o=>{o.narrowing.eligibleSpendEUR='1000.00';}),'asl-1',ALL),'GUARD .*UNKNOWN_FIELD');
  for(const key of ['candidateOrder','scanOrder','knownTotals','rowTotals'])refuse(()=>parseCAdditionsUnit(unit('asl-1',o=>{o.narrowing.rule={[key]:[]};}),'asl-1',ALL),'GUARD .*UNKNOWN_FIELD');
  for(const key of ['label','sources','reconciliation','screen','measures','notes','outsideOrUnknown','quality','sourcePins','status'])refuse(()=>parseCAdditionsUnit(unit('asl-1',o=>{o.residence[key]='x';}),'asl-1',ALL),'GUARD');
  refuse(()=>parseCAdditionsUnit(unit('asl-1',o=>{o.lineage=[];}),'asl-1',ALL),'GUARD .*REVIEWER_ONLY');
  for(const n of [1,2,3,4])refuse(()=>parseCAdditionsUnit(unit('asl-1',o=>{o.narrowing.narrowed.byArea.CV.recipients=n;}),'asl-1',ALL),'GUARD .*COUNT');
  refuse(()=>parseCAdditionsUnit(unit('asl-3',o=>{o.fileFFields.categories['mode:09'].rows=4;}),'asl-3',ALL),'GUARD .*COUNT');
  refuse(()=>parseCAdditionsUnit(unit('asl-1',o=>{o.narrowing.lineClasses.none.shareOfEligibleSpend=1.2;}),'asl-1',ALL),'GUARD .*SHARE');
  refuse(()=>parseCAdditionsUnit(unit('asl-1',o=>{o.residence.sameAsl.count=900.5;}),'asl-1',ALL),'GUARD .*COUNT');
  refuse(()=>parseCAdditionsUnit(unit('asl-1',o=>{o.narrowing.narrowed.total.shareOfEligibleSpend=Infinity;}),'asl-1',ALL),'GUARD .*SHARE');
  refuse(()=>parseCAdditionsUnit(unit('asl-1',o=>{o.schema='pillar-c-additions-unit-v2';}),'asl-1',ALL),'GUARD .*VALUE');
  refuse(()=>parseCAdditionsUnit(unit('asl-1',o=>{o.build='add-v2';}),'asl-1',ALL),'GUARD .*VALUE');
  refuse(()=>parseCAdditionsUnit(unit('asl-1',o=>{o.narrowing.domainReviewPending=false;}),'asl-1',ALL),'GUARD .*VALUE');
  refuse(()=>parseCAdditionsUnit(unit('asl-1',o=>{o.residence.period='2026-02';}),'asl-1',ALL),'GUARD .*VALUE');
  refuse(()=>parseCAdditionsFull(full(o=>{o.units[0].schema='pillar-c-additions-unit-v1';})),'GUARD .*UNKNOWN_FIELD');
  refuse(()=>parseCAdditionsFull(full(o=>{o.units.push(addEntry('asl-1'));})),'GUARD .*LIST');
});

test('strings: no place name, Region, province key, NSIS code or unit the audience cannot read',()=>{
  for(const [value,reason] of [['Pescara','PLACE'],['ASL di Teramo','PLACE'],['Abruzzo','PLACE'],['AQ','PROVINCE'],['dati TE','PROVINCE'],['130203','NSIS'],['x-130201','NSIS']]){
    refuse(()=>parseCAdditionsUnit(unit('asl-1',o=>{o.residence.channel=value;}),'asl-1',ALL),`^PILLAR_C_ADDITIONS_${reason}$`);
    refuse(()=>parseCAdditionsFull(full(o=>{o.units[2].narrowing.period=value;})),`^PILLAR_C_ADDITIONS_${reason}$`);
  }
  // An amount is a number written as text: six digits inside it are not an Azienda code.
  assert.doesNotThrow(()=>parseCAdditionsUnit(unit('asl-3',o=>{const c=o.fileFFields.categories;c['mode:01'].amountEUR='130201.00';c['mode:03'].amountEUR='2879799.00';
    for(const k of ['mode:01','mode:03'])c[k].amountShare=Math.round(Number(c[k].amountEUR)/5000000*10000)/10000;}),'asl-3',ALL));
  // An Azienda's audience holds its own unit and the aggregate: another unit's object, or a File F scope of another unit, is foreign.
  refuse(()=>parseCAdditionsUnit(addUnitObject('asl-1'),'asl-1',AZ3),'GUARD .*ORG');
  refuse(()=>parseCAdditionsUnit(unit('asl-3',o=>{o.fileFFields.scope.organisationUnit='asl-1';}),'asl-3',AZ3),'GUARD .*ORG');
  refuse(()=>parseCAdditionsUnit(addUnitObject('asl-2'),'asl-4',ALL),'^PILLAR_C_ADDITIONS_UNIT$');
});

test('P8-03: the categories add up to the eligible recipients, shares match their counts, the sum flag is the aggregate’s',()=>{
  refuse(()=>parseCAdditionsUnit(unit('asl-1',o=>{o.residence.sameAsl.count+=5;}),'asl-1',ALL),'RESIDENCE_PARTITION');
  refuse(()=>parseCAdditionsUnit(unit('asl-1',o=>{o.residence.otherAslInRegion.share+=0.001;}),'asl-1',ALL),'RESIDENCE_SHARE');
  refuse(()=>parseCAdditionsUnit(unit('asl-1',o=>{o.residence.recipientsAreSum=true;}),'asl-1',ALL),'RESIDENCE_SUM_FLAG');
  refuse(()=>parseCAdditionsUnit(unit('aggregato',o=>{o.residence.recipientsAreSum=false;}),'aggregato',ALL),'RESIDENCE_SUM_FLAG');
  // Full object: the aggregate is the sum of the four ASLs, category by category.
  refuse(()=>parseCAdditionsFull(full(o=>{const r=o.units[0].residence;r.sameAsl.count-=5;r.outsideRegion.count+=5;r.sameAsl.share=Math.round(r.sameAsl.count/r.eligible*1000)/1000;r.outsideRegion.share=Math.round(r.outsideRegion.count/r.eligible*1000)/1000;})),'RESIDENCE_AGGREGATE');
});

test('P10-04: one screened table: the marker never on the aggregate, never alone on a row or column, never back-filled',()=>{
  // The aggregate is never hidden.
  refuse(()=>parseCAdditionsUnit(unit('aggregato',o=>{o.narrowing.narrowed.byArea.NEF=HIDDEN;o.narrowing.narrowed.byArea.PNE=HIDDEN;}),'aggregato',ALL),'NARROWING_AGGREGATE_HIDDEN');
  // A row with exactly one hidden cell: one of a hidden pair revealed (back-filled), or one extra cell hidden.
  refuse(()=>parseCAdditionsUnit(unit('asl-4',o=>{o.narrowing.narrowed.byArea.NEF={recipients:5,shareOfNarrowedSpend:0.05,shareOfEligibleSpend:0.0075};}),'asl-4',ALL),'NARROWING_ROW_SINGLE_HIDDEN');
  refuse(()=>parseCAdditionsUnit(unit('asl-3',o=>{o.narrowing.narrowed.byArea.CV=HIDDEN;}),'asl-3',ALL),'NARROWING_ROW_SINGLE_HIDDEN');
  // Full object: a column with exactly one hidden cell (the other ASL's pair revealed with its exact values).
  refuse(()=>parseCAdditionsFull(full(o=>{const b=at_(o,'asl-2').narrowing.narrowed.byArea;b.NEF={recipients:5,shareOfNarrowedSpend:0.05,shareOfEligibleSpend:0.01};b.PNE={recipients:5,shareOfNarrowedSpend:0.05,shareOfEligibleSpend:0.01};})),'NARROWING_ROW_REMAINDER|NARROWING_AREA_SUM|NARROWING_COLUMN_SINGLE_HIDDEN|NARROWING_COLUMN_REMAINDER');
  refuse(()=>parseCAdditionsFull(full(o=>{const b=at_(o,'asl-1').narrowing.narrowed.byArea;b.NEF=HIDDEN;b.CV=HIDDEN;})),'NARROWING_COLUMN_SINGLE_HIDDEN');
  // A hidden group of fewer than 5 recipients is derivable from the aggregate column.
  refuse(()=>parseCAdditionsFull(full(o=>{at_(o,'aggregato').narrowing.narrowed.byArea.NEF.recipients=78;})),'NARROWING_COLUMN_REMAINDER');
  // A fully visible column adds up exactly.
  refuse(()=>parseCAdditionsFull(full(o=>{at_(o,'aggregato').narrowing.narrowed.byArea.CV.recipients+=5;})),'NARROWING_COLUMN_SUM');
  // A row whose total minus its visible counts is 1 to 4 reads as a small hidden group.
  for(const rest of [1,2,3,4])refuse(()=>parseCAdditionsUnit(unit('asl-4',o=>{o.narrowing.narrowed.total.recipients=205+rest;}),'asl-4',ALL),'NARROWING_ROW_REMAINDER');
  // Any other marker is not the marker: «<5», a range, a blank, a zero.
  for(const marker of ['<5','1–4','oscurato','',0,null])refuse(()=>parseCAdditionsUnit(unit('asl-4',o=>{o.narrowing.narrowed.byArea.NEF=marker;}),'asl-4',ALL),'GUARD');
});

test('P10-04: the cohort, the shares and the line classes hold together',()=>{
  refuse(()=>parseCAdditionsUnit(unit('asl-1',o=>{o.narrowing.eligibleRecipients+=5;}),'asl-1',ALL),'NARROWING_ELIGIBLE');
  refuse(()=>parseCAdditionsUnit(unit('asl-1',o=>{o.narrowing.recipientsAreSum=true;}),'asl-1',ALL),'NARROWING_SUM_FLAG');
  refuse(()=>parseCAdditionsUnit(unit('asl-1',o=>{o.narrowing.narrowed.total.recipients=1005;}),'asl-1',ALL),'NARROWING_TOTAL');
  refuse(()=>parseCAdditionsUnit(unit('asl-1',o=>{o.narrowing.narrowed.byArea.CV.recipients=305;}),'asl-1',ALL),'NARROWING_AREA_ABOVE_TOTAL');
  refuse(()=>parseCAdditionsUnit(unit('asl-1',o=>{o.narrowing.narrowed.byArea.CV.shareOfEligibleSpend+=0.01;}),'asl-1',ALL),'NARROWING_AREA_SHARE');
  refuse(()=>parseCAdditionsUnit(unit('asl-1',o=>{const c=o.narrowing.narrowed.byArea.CV;c.shareOfNarrowedSpend=0.45;c.shareOfEligibleSpend=0.1125;}),'asl-1',ALL),'NARROWING_AREA_SUM');
  refuse(()=>parseCAdditionsUnit(unit('asl-1',o=>{o.narrowing.lineClasses.consistent.shareOfEligibleSpend+=0.01;}),'asl-1',ALL),'LINE_CLASS_SUM');
  refuse(()=>parseCAdditionsUnit(unit('asl-1',o=>{o.narrowing.lineClasses.none.recipients=1005;}),'asl-1',ALL),'LINE_CLASS_ABOVE_ELIGIBLE');
  refuse(()=>parseCAdditionsFull(full(o=>{at_(o,'aggregato').narrowing.lineClasses.rare.recipients+=5;})),'NARROWING_AGGREGATE');
  // Order and completeness of the full object.
  refuse(()=>parseCAdditionsFull(full(o=>{o.units.reverse();})),'^PILLAR_C_ADDITIONS_UNITS$');
  refuse(()=>parseCAdditionsFull(full(o=>{o.units.pop();})),'^PILLAR_C_ADDITIONS_UNITS$');
  refuse(()=>parseCAdditionsFull(full(o=>{o.units[1]=addEntry('asl-2');})),'^PILLAR_C_ADDITIONS_UNITS$');
});

test('P10-05: the File F fields on asl-3 alone, partitions of the same rows, shares exact to their rounding, two-decimal amounts',()=>{
  refuse(()=>parseCAdditionsUnit(unit('asl-1',o=>{o.fileFFields=addEntry('asl-3').fileFFields;o.fileFFields.scope.organisationUnit='asl-1';}),'asl-1',ALL),'FILEF_UNIT');
  refuse(()=>parseCAdditionsUnit(unit('aggregato',o=>{o.fileFFields=addEntry('asl-3').fileFFields;o.fileFFields.scope.organisationUnit='aggregato';}),'aggregato',ALL),'FILEF_UNIT');
  refuse(()=>parseCAdditionsUnit(unit('asl-3',o=>{o.fileFFields=null;}),'asl-3',ALL),'FILEF_UNIT');
  refuse(()=>parseCAdditionsFull(full(o=>{at_(o,'asl-1').fileFFields=addEntry('asl-3').fileFFields;})),'FILEF_UNIT|FILEF_SCOPE');
  refuse(()=>parseCAdditionsUnit(unit('asl-3',o=>{o.fileFFields.scope.organisationUnit='asl-1';}),'asl-3',ALL),'FILEF_SCOPE');
  refuse(()=>parseCAdditionsUnit(unit('asl-3',o=>{o.fileFFields.scope.countedUnit='persons';}),'asl-3',ALL),'GUARD .*VALUE');
  refuse(()=>parseCAdditionsUnit(unit('asl-3',o=>{o.fileFFields.categories['mode:03'].rowShare+=0.0002;}),'asl-3',ALL),'FILEF_ROW_SHARE');
  refuse(()=>parseCAdditionsUnit(unit('asl-3',o=>{o.fileFFields.categories['ticket:01'].amountShare-=0.0002;}),'asl-3',ALL),'FILEF_AMOUNT_SHARE');
  refuse(()=>parseCAdditionsUnit(unit('asl-3',o=>{const c=o.fileFFields.categories;c['mode:01'].rows+=5;c['mode:01'].rowShare=Math.round(c['mode:01'].rows/10000*10000)/10000;}),'asl-3',ALL),'FILEF_PARTITION_ROWS');
  refuse(()=>parseCAdditionsUnit(unit('asl-3',o=>{o.fileFFields.categories['sdo:present'].amountEUR='800000.05';}),'asl-3',ALL),'FILEF_PARTITION_AMOUNT');
  for(const amount of ['800000.5','800000','8e5'])refuse(()=>parseCAdditionsUnit(unit('asl-3',o=>{o.fileFFields.categories['sdo:present'].amountEUR=amount;}),'asl-3',ALL),'FILEF_AMOUNT|GUARD .*MONEY');
  refuse(()=>parseCAdditionsUnit(unit('asl-3',o=>{o.fileFFields.categories['sdo:present'].amountEUR=800000;}),'asl-3',ALL),'GUARD .*MONEY');
  refuse(()=>parseCAdditionsUnit(unit('asl-3',o=>{o.fileFFields.categories.all.rowShare=0.9999;}),'asl-3',ALL),'FILEF_ALL');
  refuse(()=>parseCAdditionsUnit(unit('asl-3',o=>{delete o.fileFFields.categories['ticket:02'];}),'asl-3',ALL),'GUARD .*MISSING_FIELD');
  refuse(()=>parseCAdditionsUnit(unit('asl-3',o=>{o.fileFFields.categories['ticket:03']=o.fileFFields.categories['ticket:02'];}),'asl-3',ALL),'GUARD .*UNKNOWN_FIELD');
});

test('an Azienda’s pair: the aggregate minus its own figures is 0 or at least 5 wherever its own figure is visible',()=>{
  const pair=(own,mutate)=>{const o=parseCAdditionsUnit(addUnitObject(own),own,[own,'aggregato']),a=structuredClone(parseCAdditionsUnit(addUnitObject('aggregato'),'aggregato',[own,'aggregato']));mutate?.(a,o);return ()=>cAdditionsComplementCheck(o,a);};
  assert.doesNotThrow(pair('asl-4'));
  refuse(pair('asl-4',a=>{a.residence.otherAslInRegion.count=53;}),'COMPLEMENT');
  refuse(pair('asl-1',(a,o)=>{a.narrowing.narrowed.byArea.NEF.recipients=o.narrowing.narrowed.byArea.NEF.recipients+2;}),'COMPLEMENT');
  refuse(pair('asl-1',(a,o)=>{a.narrowing.lineClasses.rare.recipients=o.narrowing.lineClasses.rare.recipients-5;}),'COMPLEMENT');
  refuse(pair('asl-2',a=>{a.narrowing.narrowed.byArea.CV=HIDDEN;}),'NARROWING_AGGREGATE_HIDDEN');
  // Its own hidden cells are not compared (the Azienda cannot see them either).
  assert.doesNotThrow(pair('asl-2',a=>{a.narrowing.narrowed.byArea.NEF.recipients=1;}));
  refuse(()=>cAdditionsComplementCheck(addEntry('aggregato'),addEntry('asl-1')),'PAIR');
});

// ================================================================ the check against the extension (P8-H5)
test('the additions reach a page only when each unit’s eligible recipients are the extension’s January recipients',()=>{
  const ext=units=>({state:'ready',view:{units:units.map(u=>({key:u,label:u,data:{...extUnit(u),unit:u,january:{...extUnit(u).january,recipients:addEntry(u).residence.eligible,recipientsAreSum:u==='aggregato'}}})),drivers:null,baskets:null,fileFBasket:null,findings:null}});
  const ready={state:'ready',view:addViewOf(ALL)};
  assert.equal(cAdditionsWithExtension(ready,ext(ALL)),ready);
  assert.deepEqual(cAdditionsWithExtension(ready,{state:'unavailable'}),{state:'unavailable'},'no extension, no check, no additions');
  const off=ext(ALL);off.view.units[3].data.january.recipients+=5;
  assert.deepEqual(cAdditionsWithExtension(ready,off),{state:'unavailable'});
  const flag=ext(ALL);flag.view.units[0].data.january.recipientsAreSum=false;
  assert.deepEqual(cAdditionsWithExtension(ready,flag),{state:'unavailable'});
  assert.deepEqual(cAdditionsWithExtension(ready,ext(['aggregato','asl-1','asl-2','asl-4'])),{state:'unavailable'},'a unit the extension lacks');
  for(const state of ['unavailable','forbidden','not_configured'])assert.deepEqual(cAdditionsWithExtension({state},ext(ALL)),{state});
});

// ================================================================ loaders
test('reviewer loader: gated, pinned by size and hash, labelled with the reviewed labels, fails closed',async()=>{
  const fx=addFixture();as({pins:{root:'v1',bucket:'pillar-c-scoped'},client:()=>null});globalThis.__pcs.add=fx.pins;
  const remote=async()=>({state:'ready',bytes:new Uint8Array(fx.fullBytes)});
  let reads=0;const counted=async()=>{reads++;return remote();};
  assert.deepEqual(await loadCAdditionsReviewer(true,false,counted),{state:'forbidden'});
  assert.deepEqual(await loadCAdditionsReviewer(false,true,counted),{state:'forbidden'});
  assert.equal(reads,0,'nothing is read before the gate');
  const ok=await loadCAdditionsReviewer(true,true,remote);
  assert.equal(ok.state,'ready');assert.deepEqual(ok.view.units.map(u=>[u.key,u.label]),ALL.map(u=>[u,C_EXT_UNIT_LABELS[u]]));
  assert.deepEqual(ok.view.units.map(u=>u.entry),ADD_UNITS.map(addEntry));
  const tampered=Buffer.from(fx.fullBytes);tampered[20]^=1;
  assert.deepEqual(await loadCAdditionsReviewer(true,true,async()=>({state:'ready',bytes:new Uint8Array(tampered)})),{state:'unavailable'},'other bytes');
  assert.deepEqual(await loadCAdditionsReviewer(true,true,async()=>({state:'ready',bytes:new Uint8Array([...fx.fullBytes,10])})),{state:'unavailable'},'other size');
  assert.deepEqual(await loadCAdditionsReviewer(true,true,async()=>({state:'invalid'})),{state:'unavailable'});
  assert.deepEqual(await loadCAdditionsReviewer(true,true,async()=>({state:'not_configured'})),{state:'not_configured'});
  // Bytes that match their pin but break a disclosure rule are unavailable too.
  const bad=addFixture({full:o=>{at_(o,'asl-3').narrowing.narrowed.byArea.CV=HIDDEN;}});globalThis.__pcs.add=bad.pins;
  assert.deepEqual(await loadCAdditionsReviewer(true,true,async()=>({state:'ready',bytes:new Uint8Array(bad.fullBytes)})),{state:'unavailable'});
});

test('Regione loader: the full object of its regional folder, under its own session, exactly its five units and labels',async()=>{
  const fx=addFixture();as({pins:{root:'v1',bucket:'pillar-c-scoped'},client:()=>null});globalThis.__pcs.add=fx.pins;
  const labels=u=>u==='aggregato'?'Aggregato regionale':`ASL ${u.slice(4)}`;
  const s=fakeSessionClient(fx,{visible:[...ALL,'regione']});
  const r=await loadCAdditionsScoped(REGIONE,s.client,labels);
  assert.equal(r.state,'ready');assert.deepEqual(r.view.units.map(u=>[u.key,u.label]),ALL.map(u=>[u,labels(u)]));
  assert.deepEqual(s.calls.downloads.map(d=>[d.bucket,d.path,d.params.cache]),[['pillar-c-scoped',`v9/regione/${fx.pins.regional.name}`,'no-store']],'one read, the regional folder');
  // The folder refused (Storage answers 4xx), a transport failure, other bytes: «unavailable».
  assert.deepEqual(await quiet(()=>loadCAdditionsScoped(REGIONE,fakeSessionClient(fx,{visible:ALL}).client,labels)),{state:'unavailable'});
  assert.deepEqual(await quiet(()=>loadCAdditionsScoped(REGIONE,fakeSessionClient(fx,{visible:[...ALL,'regione'],fail:'5xx'}).client,labels)),{state:'unavailable'});
  const tampered=new Map(fx.files);const path=`v9/regione/${fx.pins.regional.name}`,t=Buffer.from(tampered.get(path));t[30]^=1;tampered.set(path,t);
  assert.deepEqual(await quiet(()=>loadCAdditionsScoped(REGIONE,fakeSessionClient({files:tampered},{visible:[...ALL,'regione']}).client,labels)),{state:'unavailable'});
  // A label the audience does not give, or units out of the Regione's order, are not this audience.
  assert.deepEqual(await quiet(()=>loadCAdditionsScoped(REGIONE,fakeSessionClient(fx,{visible:[...ALL,'regione']}).client,()=>null)),{state:'unavailable'});
  const shuffled=fakeSessionClient(fx,{visible:[...ALL,'regione']});
  assert.deepEqual(await loadCAdditionsScoped({...REGIONE,units:['asl-1','aggregato','asl-2','asl-3','asl-4']},shuffled.client,labels),{state:'forbidden'});
  assert.equal(shuffled.calls.downloads.length,0);
});

test('Azienda loader: its own unit and the aggregate only, under its own session; any refusal or defect is «unavailable»',async()=>{
  const fx=addFixture();as({pins:{root:'v1',bucket:'pillar-c-scoped'},client:()=>null});globalThis.__pcs.add=fx.pins;
  const labels=u=>({'asl-4':'Azienda sintetica Quattro',aggregato:'Aggregato delle quattro Aziende'})[u]??null;
  const s=fakeSessionClient(fx,{visible:AZ4});
  const r=await loadCAdditionsScoped(AZIENDA4,s.client,labels);
  assert.equal(r.state,'ready');assert.deepEqual(r.view.units.map(u=>[u.key,u.label]),[['asl-4','Azienda sintetica Quattro'],['aggregato','Aggregato delle quattro Aziende']]);
  assert.deepEqual(s.calls.downloads.map(d=>[d.bucket,d.path,d.params.cache]),[['pillar-c-scoped',`v9/asl-4/${fx.pins.scoped['asl-4'].name}`,'no-store'],['pillar-c-scoped',`v9/aggregato/${fx.pins.scoped.aggregato.name}`,'no-store']],'never another unit, never the regional folder');
  assert.equal(r.view.units[0].entry.narrowing.narrowed.byArea.PNE,HIDDEN,'its own hidden cells stay hidden');
  // ASL 3 reads its File F fields with its own unit.
  const s3=fakeSessionClient(fx,{visible:AZ3});
  const r3=await loadCAdditionsScoped(AZIENDA3,s3.client,u=>({'asl-3':'Azienda sintetica Tre',aggregato:'Aggregato delle quattro Aziende'})[u]??null);
  assert.equal(r3.state,'ready');assert.equal(r3.view.units[0].entry.fileFFields.scope.organisationUnit,'asl-3');assert.equal(r3.view.units[1].entry.fileFFields,null);
  // Storage refuses the own unit or the aggregate (RLS): the whole additions are unavailable, never partial.
  for(const visible of [['aggregato'],['asl-4'],[]])assert.deepEqual(await quiet(()=>loadCAdditionsScoped(AZIENDA4,fakeSessionClient(fx,{visible}).client,labels)),{state:'unavailable'},String(visible));
  assert.deepEqual(await quiet(()=>loadCAdditionsScoped(AZIENDA4,fakeSessionClient(fx,{visible:AZ4,fail:'throw'}).client,labels)),{state:'unavailable'});
  // A hash or size that is not the pin's: unavailable.
  for(const pin of [{sha256:'0'.repeat(64)},{bytes:fx.pins.scoped['asl-4'].bytes+1}]){
    globalThis.__pcs.add={...fx.pins,scoped:{...fx.pins.scoped,'asl-4':{...fx.pins.scoped['asl-4'],...pin}}};
    assert.deepEqual(await quiet(()=>loadCAdditionsScoped(AZIENDA4,fakeSessionClient(fx,{visible:AZ4}).client,labels)),{state:'unavailable'},JSON.stringify(pin).slice(0,20));
  }
  // Consistent bytes, but a complement of 1 to 4 for the other Aziende: unavailable.
  const small=addFixture({unit:(u,o)=>{if(u==='aggregato'){o.residence.otherAslInRegion.count=53;o.residence.sameAsl.count=4120+240-53;o.residence.sameAsl.share=Math.round(o.residence.sameAsl.count/4500*1000)/1000;o.residence.otherAslInRegion.share=Math.round(53/4500*1000)/1000;}}});
  globalThis.__pcs.add=small.pins;
  assert.deepEqual(await quiet(()=>loadCAdditionsScoped(AZIENDA4,fakeSessionClient(small,{visible:AZ4}).client,labels)),{state:'unavailable'});
  // An Azienda whose units are not exactly its own and the aggregate is not this audience: nothing is read.
  globalThis.__pcs.add=fx.pins;
  const odd=fakeSessionClient(fx,{visible:ALL});
  assert.deepEqual(await loadCAdditionsScoped({...AZIENDA4,units:['aggregato','asl-4']},odd.client,labels),{state:'forbidden'});
  assert.deepEqual(await loadCAdditionsScoped({...AZIENDA4,units:['asl-4','aggregato','asl-1']},odd.client,labels),{state:'forbidden'});
  assert.deepEqual(await loadCAdditionsScoped({...AZIENDA4,units:['asl-1','aggregato']},odd.client,labels),{state:'forbidden'});
  assert.equal(odd.calls.downloads.length,0);
});

// ================================================================ pins
test('the pins: names carry their hashes, the regional object is the reviewer object byte for byte, every path is a policy path',()=>{
  const src=readFileSync(`${root}lib/dashboard-review/pillar-c/additions-storage.ts`,'utf8');
  assert.match(src,/^import "server-only";/);
  const pins=[...src.matchAll(/(?:"(asl-[1-4])"|(aggregato)|(regional)): \{ name: "([^"]+)", sha256: "([a-f0-9]{64})", bytes: ([0-9]+) \}/g)].map(m=>({key:m[1]??m[2]??m[3],name:m[4],sha256:m[5],bytes:Number(m[6])}));
  assert.deepEqual(pins.map(p=>p.key),['asl-1','asl-2','asl-3','asl-4','aggregato','regional']);
  for(const p of pins){
    assert.equal(p.name,`aggiunte-${p.sha256}.json`,p.key);
    assert.match(`v9/${p.key==='regional'?'regione':p.key}/${p.name}`,C_SCOPED_POLICY_NAME,p.key);
    assert.ok(p.bytes>1&&p.bytes<=65536,p.key);
  }
  assert.equal(new Set(pins.map(p=>p.sha256)).size,6,'six distinct objects');
  const reviewer={object:/object: "add1\/([a-f0-9]{64})\.json"/.exec(src)[1],sha256:/reviewer: \{[^}]*sha256: "([a-f0-9]{64})"/.exec(src)[1],bytes:Number(/reviewer: \{[^}]*bytes: ([0-9]+)/.exec(src)[1])};
  const regional=pins.find(p=>p.key==='regional');
  assert.deepEqual(reviewer,{object:regional.sha256,sha256:regional.sha256,bytes:regional.bytes},'the Regione reads the reviewer’s bytes');
  assert.match(src,/bucket: "pillar-c-review"/);assert.match(src,/build: "add-v1",\s+root: "v9",/);
  assert.match(src,/export const C_ADDITIONS_MAX_BYTES = 65_536;/);
});

const PRIVATE=fileURLToPath(new URL('../../outputs/pillar-c/additions-20261024/',import.meta.url));
test('the pins equal the private build receipt (pass/fail only)',{skip:existsSync(`${PRIVATE}PINS_ADDITIONS.json`)?false:'the private build receipt is not available locally'},()=>{
  const receipt=JSON.parse(readFileSync(`${PRIVATE}PINS_ADDITIONS.json`,'utf8')),src=readFileSync(`${root}lib/dashboard-review/pillar-c/additions-storage.ts`,'utf8');
  assert.ok(receipt.build==='add-v1'&&receipt.root==='v9','build and root');
  for(const u of ALL){const p=receipt.scoped[u];assert.ok(src.includes(`{ name: "${p.name}", sha256: "${p.sha256}", bytes: ${p.bytes} }`),u);}
  assert.ok(src.includes(`regional: { name: "${receipt.regional.name}", sha256: "${receipt.regional.sha256}", bytes: ${receipt.regional.bytes} }`),'regional');
  for(const k of ['bucket','object','sha256'])assert.ok(src.includes(`${k}: "${receipt.reviewer[k]}"`),`reviewer ${k}`);
  assert.ok(src.includes(`bytes: ${receipt.reviewer.bytes},`),'reviewer bytes');
});

test('the private objects pass the real parsers and match their pins (pass/fail only)',{skip:existsSync(`${PRIVATE}objects`)?false:'the private objects are not available locally'},()=>{
  // Only booleans and reason codes leave this test: no value of the objects is printed.
  const receipt=JSON.parse(readFileSync(`${PRIVATE}PINS_ADDITIONS.json`,'utf8'));
  const only=dir=>{const f=readdirSync(dir);assert.equal(f.length,1,dir.slice(-12));return readFileSync(`${dir}/${f[0]}`);};
  const ok=(bytes,pin)=>bytes.length===pin.bytes&&sha256(bytes)===pin.sha256;
  const decode=b=>JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(b));
  const entries={};
  for(const u of ALL){
    const b=only(`${PRIVATE}objects/v9/${u}`);assert.ok(ok(b,receipt.scoped[u]),`${u} pin`);
    let parsed=null;try{parsed=parseCAdditionsUnit(decode(b),u,u==='aggregato'?ALL:[u,'aggregato']);}catch(e){assert.fail(`${u}: ${String(e.message).split(' ')[0]}`);}
    entries[u]=parsed;
  }
  for(const u of ADD_ASL)assert.doesNotThrow(()=>cAdditionsComplementCheck(entries[u],entries.aggregato),u);
  for(const [dir,pin] of [['v9/regione',receipt.regional],['add1',receipt.reviewer]]){
    const b=only(`${PRIVATE}objects/${dir}`);assert.ok(ok(b,pin),`${dir} pin`);
    let all=null;try{all=parseCAdditionsFull(decode(b));}catch(e){assert.fail(`${dir}: ${String(e.message).split(' ')[0]}`);}
    assert.ok(all.every(e=>JSON.stringify(e)===JSON.stringify(entries[e.unit])),`${dir}: each unit object equals its entry`);
  }
});

// ================================================================ client audience check
const SERVER={azienda4:AZIENDA4,azienda3:AZIENDA3,regione:REGIONE};
const client=k=>guardCClientAudience(toClientAudience(SERVER[k]),SERVER[k]);
const labelled=k=>{const c=client(k);return addViewOf(c.orgs.map(o=>o.key),u=>c.orgs.find(o=>o.key===u).label);};
const reviewerView=()=>addViewOf(ALL,u=>C_EXT_UNIT_LABELS[u]);

test('the client renders only the audience’s units, in its order, under its labels, with File F on asl-3 alone',()=>{
  for(const k of Object.keys(SERVER))assert.ok(cAdditionsFor(client(k),labelled(k)),k);
  assert.ok(cAdditionsFor(C_REVIEWER_CLIENT_AUDIENCE,reviewerView()));
  // A peer unit, another order, another label, a missing unit: refused.
  assert.equal(cAdditionsFor(client('azienda4'),labelled('regione')),null,'the Regione’s view under an Azienda');
  assert.equal(cAdditionsFor(client('azienda4'),addViewOf(['asl-3','aggregato'],u=>u)),null,'a peer’s unit');
  const swapped=labelled('azienda4');swapped.units.reverse();assert.equal(cAdditionsFor(client('azienda4'),swapped),null);
  const relabelled=labelled('regione');relabelled.units[0].label='Aggregato delle quattro Aziende';assert.equal(cAdditionsFor(client('regione'),relabelled),null);
  const short=labelled('regione');short.units.pop();assert.equal(cAdditionsFor(client('regione'),short),null);
  assert.equal(cAdditionsFor(C_REVIEWER_CLIENT_AUDIENCE,labelled('regione')),null,'the Regione’s labels are not the reviewer’s');
  // File F only on asl-3; the aggregate never hidden; an entry of another unit under a key.
  const moved=labelled('azienda4');moved.units[0].entry={...moved.units[0].entry,fileFFields:addEntry('asl-3').fileFFields};assert.equal(cAdditionsFor(client('azienda4'),moved),null);
  const hidden=labelled('azienda4');hidden.units[1].entry=structuredClone(hidden.units[1].entry);hidden.units[1].entry.narrowing.narrowed.byArea.CV=HIDDEN;assert.equal(cAdditionsFor(client('azienda4'),hidden),null);
  const foreign=labelled('azienda4');foreign.units[0]={...foreign.units[0],entry:addEntry('asl-1')};assert.equal(cAdditionsFor(client('azienda4'),foreign),null);
  assert.equal(cAdditionsFor(null,reviewerView()),null);assert.equal(cAdditionsFor(client('regione'),null),null);
  assert.equal(cAdditionsHoldsFileF(C_REVIEWER_CLIENT_AUDIENCE),true);assert.equal(cAdditionsHoldsFileF(client('regione')),true);
  assert.equal(cAdditionsHoldsFileF(client('azienda3')),true);assert.equal(cAdditionsHoldsFileF(client('azienda4')),false);
});

// ================================================================ rendered panels
const withSearch=(el,search='')=>React.createElement(SearchParamsContext.Provider,{value:new URLSearchParams(search)},el);
const html=(el,search='')=>{const e=console.error;console.error=()=>{};try{return renderToStaticMarkup(withSearch(el,search));}finally{console.error=e;}};
const text=h=>h.replace(/<[^>]*>/g,' ').replace(/&#x27;/g,'’').replace(/&quot;/g,'"').replace(/&amp;/g,'&').replace(/\s+/g,' ');
const options=(h,label)=>{const m=h.match(new RegExp(`<select[^>]* aria-label="${label}"[^>]*>(.*?)</select>`));return m?[...m[1].matchAll(/<option value="([^"]*)"[^>]*>([^<]*)<\/option>/g)].map(x=>[x[1],x[2]]):null;};
// The extension's attribution copy says «non dimostra» (does not prove): as in tests/pillar-c-scoped-ui.test.mjs, pages that
// carry the extension are read without that one word.
const NEVER=/NaN|Infinity|undefined|\b[Dd]emo\b|[Dd]imostrazion|[Dd]imostrativ|[Vv]erificat|in arrivo/;
const panel=(h,attr)=>{const i=h.indexOf(`data-c-additions="${attr}"`);if(i<0)return null;const start=h.lastIndexOf('<article',i);return h.slice(start,h.indexOf('</article>',i)+10);};
const scopedFixtureData=scopedFixture();
const packetOf=k=>{const units=[...SERVER[k].units];return guardCScopedPayload('review',mergeCScopedReview(units,units.map(u=>parseCScopedReviewFile(scopedFixtureData.reviews[u],u))),units);};
const reviewerPacket=parseCReviewPacket(cReviewV2Fixture());
const forecast=reviewerPacket.forecast;
const extensionOf=k=>{const c=client(k);if(k==='regione'){const r=extReviewer();return {units:c.orgs.map(o=>({key:o.key,label:o.label,data:r.units.find(u=>u.unit===o.key)})),drivers:r.drivers,baskets:r.baskets,fileFBasket:r.fileFBasket,findings:r.findings};}
  return {units:c.orgs.map(o=>({key:o.key,label:o.label,data:o.key===SERVER[k].unit?extUnit(o.key):{...extUnit(o.key,4000),unitCosts:null}})),drivers:null,baskets:null,fileFBasket:null,findings:null};};
/** The page wraps each workspace in the period catalogue of its extension view (the File F panels read it). */
const catalogued=(el,view)=>view?React.createElement(PillarCPeriodCatalogProvider,{catalog:publicCPeriodCatalog(buildCPeriodCatalog(view,{mode:'synthetic'}))},el):el;
const scoped=(k,props={},search='')=>{const p={audience:client(k),packet:packetOf(k),forecast,extension:extensionOf(k),...props};return html(catalogued(React.createElement(PillarCScopedWorkspace,p),p.extension),search);};
const reviewerExtension=()=>{const r=extReviewer();return {units:ALL.map(u=>({key:u,label:C_EXT_UNIT_LABELS[u],data:r.units.find(x=>x.unit===u)})),drivers:r.drivers,baskets:r.baskets,fileFBasket:r.fileFBasket,findings:r.findings};};
const reviewer=(props={},search='')=>{const p={audience:C_REVIEWER_CLIENT_AUDIENCE,packet:reviewerPacket,extension:reviewerExtension(),...props};return html(catalogued(React.createElement(PillarCAnalyticalWorkspace,p),p.extension),search);};
/** The rows of a table whose caption starts with `caption`, as [row header, cells...]. */
function rowsOf(h,caption){
  const i=h.indexOf(`<caption class="sr-only">${caption}`);if(i<0)return null;
  const table=h.slice(i,h.indexOf('</table>',i));
  return [...table.matchAll(/<tr>(.*?)<\/tr>/g)].slice(1).map(m=>[...m[1].matchAll(/<t[hd][^>]*>([^<]*)<\/t[hd]>/g)].map(x=>x[1]));
}
const IDENT=/\s(value|href|id|for|name|aria-controls|aria-describedby|aria-labelledby|data-[a-z0-9-]+)="([^"]*)"/g;
function identifiers(h,units,label){
  for(const [,attr,value] of h.matchAll(IDENT)){
    assert.doesNotMatch(value,C_PROVINCE_TOKEN,`${label}: ${attr}="${value}"`);assert.doesNotMatch(value,C_PLACE_NAME,`${label}: ${attr}`);assert.doesNotMatch(value,/13020[1-4]/,`${label}: ${attr}`);
    for(const m of value.matchAll(/(?:^|[^A-Za-z0-9])(asl-\d+|aggregato)(?=$|[^A-Za-z0-9])/g))assert.ok(units.includes(m[1]),`${label}: foreign unit ${m[1]} in ${attr}`);
  }
}

test('reviewer: the three panels where they belong, the five units under the reviewed labels, the File F fields of ASL 3',()=>{
  const h=reviewer({additions:reviewerView()},'?c_fonte=dpc'),f=reviewer({additions:reviewerView()},'?c_fonte=filef'),t=text(h);
  // Placement (joint feedback 2, G2-01/G2-02): residence and narrowing in the DPC view, residence right after the
  // January recipients and narrowing after the narrowing evidence; the File F fields in the File F view, after the File F
  // portfolios. The expenditure view holds none of them.
  const at=(x,a)=>x.indexOf(`data-c-additions="${a}"`);
  assert.ok(h.indexOf('<section id="dpc"')>0&&h.indexOf('<section id="dpc"')<at(h,'residence'),'residence in the DPC view');
  assert.ok(h.indexOf('Quanti sono gli assistiti DPC e chi sono')>0&&h.indexOf('Quanti sono gli assistiti DPC e chi sono')<at(h,'residence')&&at(h,'residence')<h.indexOf('Come si distribuiscono gli assistiti'),'right after the January recipient totals');
  assert.ok(h.indexOf('Quanto si restringe il campo dei portafogli candidati?')<at(h,'narrowing')&&at(h,'narrowing')<h.indexOf('Assistiti per stato del prodotto e gruppo'),'beside the narrowing evidence');
  assert.equal(at(h,'filef-fields'),-1,'no File F field in the DPC view');
  assert.ok(f.indexOf('<section id="filef"')>0&&f.indexOf('<section id="filef"')<f.indexOf('File F 2025 · ASL 3: portafogli candidati')&&f.indexOf('File F 2025 · ASL 3: portafogli candidati')<at(f,'filef-fields'),'beside the File F portfolios, in the File F view');
  assert.equal(at(f,'residence'),-1);assert.equal(at(f,'narrowing'),-1);
  assert.ok(!reviewer({additions:reviewerView()}).includes('data-c-additions='),'the expenditure view holds none');
  // Residence: five columns in fixed order, counts with their shares, the aggregate read as a sum.
  assert.deepEqual(rowsOf(h,'ASL di riferimento degli assistiti DPC')[0],['Assistiti con erogazioni DPC','4.500','1.000','1.200','1.500','800']);
  assert.deepEqual(rowsOf(h,'ASL di riferimento degli assistiti DPC')[1],['Stessa ASL del flusso','4.120 (91,6 %)','900 (90,0 %)','1.100 (91,7 %)','1.400 (93,3 %)','720 (90,0 %)']);
  assert.ok(t.includes(C_ADD_COPY.residenceAggregate));
  // Narrowing: the unit selector over the five units, the aggregate first (no hidden cell there).
  assert.deepEqual(options(h,'Unità delle aree delle esenzioni'),ALL.map(u=>[u,C_EXT_UNIT_LABELS[u]]));
  assert.match(h,/<select aria-label="Unità delle aree delle esenzioni" class="[^"]*\bh-11\b[^"]*"/,'a 44 px control');
  assert.match(h,/data-c-additions="narrowing" data-c-unit="aggregato"/);
  assert.deepEqual(rowsOf(h,'Spesa ristretta per area candidata')[0],['Malattie cardiovascolari','550','42,00 %','9,66 %']);
  assert.ok(!h.includes('data-c-hidden="true"'),'the aggregate has no hidden cell');
  // File F fields: 17 rows, rows and amounts with their shares.
  const ff=rowsOf(f,'Righe del File F 2025 per campo');assert.equal(ff.length,17);
  assert.deepEqual(ff[0],['Tutte le righe','10.000','100,00 %','5.000.000,00 €','100,00 %']);
  assert.deepEqual(ff.find(r=>r[0]==='Modalità di erogazione 09'),['Modalità di erogazione 09','50','0,50 %','200.000,00 €','4,00 %']);
  assert.doesNotMatch(h,NEVER);assert.doesNotMatch(f,NEVER);
});

test('Regione: the five units under its own labels, the hidden cells as the uniform marker, the File F fields',()=>{
  const h=scoped('regione',{additions:labelled('regione')},'?c_fonte=dpc'),f=scoped('regione',{additions:labelled('regione')},'?c_fonte=filef');
  assert.deepEqual(options(h,'Unità delle aree delle esenzioni'),[['aggregato','Aggregato regionale'],['asl-1','ASL 1'],['asl-2','ASL 2'],['asl-3','ASL 3'],['asl-4','ASL 4']]);
  assert.deepEqual(rowsOf(h,'ASL di riferimento degli assistiti DPC')[0],['Assistiti con erogazioni DPC','4.500','1.000','1.200','1.500','800']);
  assert.match(h,/<th scope="col"[^>]*>Aggregato regionale<\/th>/);
  assert.ok(text(f).includes('File F 2025 · ASL 3: campi utili all’attribuzione'));
  for(const [view,x] of [['dpc',h],['filef',f]]){
    assert.doesNotMatch(text(x),/Aggregato delle quattro Aziende|Azienda sintetica/,`${view}: no Azienda name and not the Azienda wording`);
    identifiers(x,ALL,`regione ${view}`);assert.doesNotMatch(x,NEVER);
  }
});

test('Azienda 204: its own unit and the aggregate, its hidden cells as «dato oscurato», never a number; no File F fields',()=>{
  const h=scoped('azienda4',{additions:labelled('azienda4')},'?c_fonte=dpc'),f=scoped('azienda4',{additions:labelled('azienda4')},'?c_fonte=filef');
  assert.deepEqual(options(h,'Unità delle aree delle esenzioni'),[['asl-4','Azienda sintetica Quattro'],['aggregato','Aggregato delle quattro Aziende']]);
  assert.deepEqual(rowsOf(h,'ASL di riferimento degli assistiti DPC')[0],['Assistiti con erogazioni DPC','800','4.500']);
  // The own unit opens the narrowing panel: its two hidden cells are three markers each, with no digit, and the note.
  assert.match(h,/data-c-additions="narrowing" data-c-unit="asl-4"/);
  const areas=rowsOf(h,'Spesa ristretta per area candidata · Azienda sintetica Quattro');
  for(const label of ['Malattie renali e dialisi','Malattie respiratorie e allergiche']){
    const row=areas.find(r=>r[0]===label);assert.deepEqual(row.slice(1),[C_ADD_HIDDEN_LABEL,C_ADD_HIDDEN_LABEL,C_ADD_HIDDEN_LABEL],label);
  }
  assert.equal((h.match(/data-c-hidden="true"/g)||[]).length,6,'six hidden measure cells, no more');
  for(const row of areas.filter(r=>r.includes(C_ADD_HIDDEN_LABEL)))assert.doesNotMatch(row.slice(1).join(' '),/\d/,'a hidden cell never shows a number');
  assert.match(h,/data-c-hidden-note="true">Dato oscurato: le celle con meno di 5 assistiti/);
  assert.doesNotMatch(text(panel(h,'narrowing')),/&lt;5|<5|1–4|≤/,'never a range or a bound for a hidden cell');
  // No peer and no File F fields; no euro in the narrowing panel; no sentence across units. Its File F view says its
  // own File F was not received.
  for(const [view,x] of [['dpc',h],['filef',f]]){
    assert.doesNotMatch(x,/value="asl-[123]"|ASL [1-4]\b|Aggregato regionale|Azienda sintetica (Uno|Due|Tre)/,view);
    assert.ok(!text(x).includes('campi utili all’attribuzione')&&!text(x).includes(C_ADD_COPY.fileFUnavailable),`${view}: not the File F holder: no panel, no unavailable line`);
    identifiers(x,AZ4,`azienda4 ${view}`);assert.doesNotMatch(x,NEVER);
  }
  assert.ok(text(f).includes('File F: non ricevuto per Azienda sintetica Quattro. Nessun valore File F viene mostrato né stimato.'));
  assert.doesNotMatch(text(panel(h,'narrowing')),/€|altre Aziende|aggregato meno|graduatoria/i);
});

test('Azienda 203: its File F fields beside the File F blocks, under its own name',()=>{
  const h=scoped('azienda3',{additions:labelled('azienda3')},'?c_fonte=filef'),t=text(h);
  assert.ok(t.includes('File F 2025 · Azienda sintetica Tre: campi utili all’attribuzione'));
  const port=h.indexOf('File F 2025 · Azienda sintetica Tre: portafogli candidati');
  assert.ok(h.indexOf('<section id="filef"')>0&&h.indexOf('<section id="filef"')<port&&port<h.indexOf('data-c-additions="filef-fields"'),'in the File F view, after the File F portfolios');
  assert.equal(rowsOf(h,'Righe del File F 2025 per campo').length,17);
  assert.ok(!h.includes('data-c-hidden="true"'),'its own row has no hidden cell');
  identifiers(h,AZ3,'azienda3');assert.doesNotMatch(h,NEVER);
});

test('unavailable: an honest line per panel, never a value; nothing at all when the additions are not part of the page',()=>{
  const lines=[C_ADD_COPY.residenceUnavailable,C_ADD_COPY.narrowingUnavailable,C_ADD_COPY.fileFUnavailable];
  // Residence and narrowing in the DPC view, the File F fields in the File F view (G2-01/G2-02).
  for(const [label,render] of [['reviewer',s=>reviewer({additionsUnavailable:true},s)],['regione',s=>scoped('regione',{additionsUnavailable:true},s)],['azienda3',s=>scoped('azienda3',{additionsUnavailable:true},s)]]){
    const d=render('?c_fonte=dpc'),f=render('?c_fonte=filef');
    assert.ok(text(d).includes(lines[0])&&text(d).includes(lines[1])&&!text(d).includes(lines[2]),`${label}: the DPC lines`);
    assert.ok(text(f).includes(lines[2])&&!text(f).includes(lines[0]),`${label}: the File F line`);
    for(const h of [d,f])assert.ok(!h.includes('data-c-additions='),`${label}: no table`);
  }
  // ASL 4 does not hold the File F unit: two lines.
  const four=s=>text(scoped('azienda4',{additionsUnavailable:true},s));
  assert.ok(four('?c_fonte=dpc').includes(lines[0])&&four('?c_fonte=dpc').includes(lines[1])&&!four('?c_fonte=filef').includes(lines[2]));
  // Not part of the page (no prop): nothing in any view, so the existing pages are unchanged.
  for(const s of ['','?c_fonte=dpc','?c_fonte=filef'])for(const h of [reviewer({},s),scoped('regione',{},s),scoped('azienda3',{},s)]){assert.ok(!h.includes('data-c-additions='));for(const line of lines)assert.ok(!text(h).includes(line));}
  // A view that is not the audience's (the Regione's under an Azienda, the reviewer's labels under the Regione) is refused
  // and reads as unavailable: none of its rows is rendered.
  const leaked=scoped('azienda4',{additions:labelled('regione')},'?c_fonte=dpc');
  assert.ok(text(leaked).includes(lines[0]));assert.ok(!leaked.includes('data-c-additions='));assert.doesNotMatch(leaked,/ASL [1-3]\b|Aggregato regionale/);
  assert.ok(!scoped('regione',{additions:reviewerView()},'?c_fonte=dpc').includes('data-c-additions='));
  assert.ok(!reviewer({additions:labelled('regione')},'?c_fonte=dpc').includes('data-c-additions='));
  // Without the extension the panels still sit in the DPC view, after the view's own unavailable line.
  const noExt=html(React.createElement(PillarCScopedWorkspace,{audience:client('regione'),packet:packetOf('regione'),forecast,extensionUnavailable:true,additions:labelled('regione')}),'?c_fonte=dpc');
  const empty=noExt.indexOf('I dati DPC non sono disponibili in questo momento');
  assert.ok(noExt.indexOf('<section id="dpc"')<empty&&empty<noExt.indexOf('data-c-additions="residence"'));
});

test('the panels alone: the selector of an audience with one unit is not shown; no bar, no colour-only value',()=>{
  const one={units:[{key:'asl-3',label:'Azienda sintetica Tre',entry:addEntry('asl-3')}]};
  const n=html(React.createElement(PillarCAdditionsNarrowing,{view:one}));
  assert.doesNotMatch(n,/<select/);assert.match(n,/Azienda sintetica Tre: 450 dei 1\.500 assistiti con erogazioni DPC hanno almeno una riga ristretta a un’area; quella spesa è il 30,00\u00a0% della loro spesa\./);
  assert.doesNotMatch(n,/style="width|role="img"/,'tables only');
  assert.equal(html(React.createElement(PillarCAdditionsResidence,{view:null})),'');
  assert.equal(html(React.createElement(PillarCAdditionsFileF,{view:addViewOf(AZ4)})),'','no File F unit, no panel');
  assert.equal(html(React.createElement(PillarCAdditionsFileF,{view:addViewOf(AZ4),unavailable:true})),'','a view without the File F unit is not an outage');
});

test('copy and source rules of the additions modules',()=>{
  const read=p=>readFileSync(`${root}${p}`,'utf8');
  const files=['components/dashboard-review/pillar-c/additions-sections.tsx','lib/dashboard-review/pillar-c/additions.ts'];
  for(const file of files){
    const src=read(file);
    assert.doesNotMatch(src,/verificat|\bdemo\b|dimostra|in arrivo/i,file);
    assert.doesNotMatch(src,/paziente|persona\b/,file);
    assert.equal(src.split(String.fromCharCode(0xa0)).length-1,0,`${file}: no raw no-break space`);
    assert.doesNotMatch(src,/\b(?:min-)?w-\[\d+px\]/,file);
    assert.doesNotMatch(src,/fetch\(|process\.env|localStorage|sessionStorage|eligibleSpendEUR|candidateOrder|scanOrder|knownTotals|rowTotals/,file);
  }
  const ui=read(files[0]);
  // A change of unit replaces the keyed block whole (Chrome page translation keeps no stale value).
  assert.ok(ui.includes('<div key={unit.key} data-c-additions="narrowing" data-c-unit={unit.key}>'));
  // No literal JSX text next to a data-driven expression inside one element.
  const DRIVEN=String.raw`\{(?:unit\.|holder\.|num\(|pct\(|total\.|n\.|view\.|c\.|r\.)[^{}]*\}`,TEXT=String.raw`[^<>{}\`\n]*[^<>{}\`\s][^<>{}\`\n]*`;
  assert.doesNotMatch(ui,new RegExp(`>${TEXT}${DRIVEN}`));assert.doesNotMatch(ui,new RegExp(`${DRIVEN}${TEXT}<`));
  // The copy names no figure, no year beyond the outputs' own periods, and no Region of the four Aziende.
  for(const [key,value] of Object.entries(C_ADD_COPY)){
    assert.doesNotMatch(value,/\b(?!2018\b|2025\b|2026\b)\d{4}\b/,key);assert.doesNotMatch(value,C_PLACE_NAME,key);
  }
});
