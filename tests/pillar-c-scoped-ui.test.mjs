// Pillar C organisation-scoped delivery (recommendation 5), interface step: server-side renders of the real client
// components for every audience, on synthetic data only (invented organisations, products and amounts).
//   - The audience is mandatory: without one, or with an incomplete one, nothing renders and nothing is fetched.
//   - Azienda: its own name and «Aggregato delle quattro Aziende», no peer option, label or key; Regione:
//     «Aggregato regionale» and ASL 1–4 under opaque keys, no province key or place name in any identifier.
//   - No reviewer-only section (workbook, shared review queue, lineage, price/quantity/mix), the O4 notes, the
//     export labels, the honest empty states, keyed changing text.
//   - Reviewer: one regression hash over the reviewer workspace and every shared view, re-recorded at 1.2b on the same
//     synthetic data (regroup, the 1.2b copy rows and the reviewer queue link at 44 px).
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createRequire,register} from 'node:module';
import {readFileSync} from 'node:fs';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {IDENTITY_STUBS,registerPillarCStubs,as} from './helpers/pillar-c-scoped-stubs.mjs';
import {reviewerUiMatrix} from './helpers/pillar-c-ui-matrix.mjs';
import {scopedFixture,fakeSessionClient,SENTINEL,TOKEN_LABEL} from './fixtures/pillar-c-scoped.mjs';
import {cReviewV2Fixture} from './fixtures/pillar-c-review.mjs';
import {extUnit,extReviewer} from './fixtures/pillar-c-extension.mjs';

registerPillarCStubs({'lib/dashboard-review/pillar-c/scoped-storage.ts':IDENTITY_STUBS['lib/dashboard-review/pillar-c/scoped-storage.ts']},{tsx:true});
// next/link is a CommonJS entry without an exports map: resolve it by its file name (the dossier's Pillar B link).
register('data:text/javascript,'+encodeURIComponent(`export async function resolve(s,c,n){return n(s==='next/link'?'next/link.js':s,c);}`),import.meta.url);
const rootUrl=new URL('..',import.meta.url),root=fileURLToPath(rootUrl);
const req=createRequire(`${root}package.json`),React=req('react'),{renderToStaticMarkup}=req('react-dom/server');
const {SearchParamsContext}=req('next/dist/shared/lib/hooks-client-context.shared-runtime');
const at=p=>import(pathToFileURL(`${root}${p}`).href);
const {PillarCAudienceProvider}=await at('components/dashboard-review/pillar-c/audience-context.tsx');
const {PillarCScopedWorkspace,cScopedStartingSearch}=await at('components/dashboard-review/pillar-c/scoped-workspace.tsx');
const {PillarCAnalyticalWorkspace}=await at('components/dashboard-review/pillar-c/analytical-workspace.tsx');
const {CAttributionView,PillarCAttributionAnalysis}=await at('components/dashboard-review/pillar-c/attribution-analysis.tsx');
const {CPortfolioDossierView,PillarCPortfolioDossier}=await at('components/dashboard-review/pillar-c/portfolio-dossier.tsx');
const {CPortfolioChangeSummary}=await at('components/dashboard-review/pillar-c/change-summary.tsx');
const {CPortfolioPriceQuantityMix}=await at('components/dashboard-review/pillar-c/portfolio-pvm.tsx');
const {CPlanningPanel,PillarCPlanningWorkspace}=await at('components/dashboard-review/pillar-c/planning-workspace.tsx');
const {CPortfolioReviewPlan}=await at('components/dashboard-review/pillar-c/review-plan.tsx');
const {PillarCEvidenceWorkflow}=await at('components/dashboard-review/pillar-c/evidence-workflow.tsx');
const {C_REVIEWER_CLIENT_AUDIENCE,toClientAudience}=await at('lib/dashboard-review/pillar-c/audience-rules.ts');
const {guardCClientAudience,guardCScopedPayload,C_PROVINCE_TOKEN,C_PLACE_NAME}=await at('lib/dashboard-review/pillar-c/payload-guard.ts');
const {mergeCScopedReview,parseCScopedReviewFile}=await at('lib/dashboard-review/pillar-c/scoped-review.ts');
const {loadCScopedAttrView,loadCScopedPortfolioView}=await at('lib/dashboard-review/pillar-c/scoped-loader.ts');
const AV=await at('lib/dashboard-review/pillar-c/audience-view.ts');
const {cPlanningAccept,cPlanningExport,cPlanningExportName,cPlanningFilters,C_PLANNING_LABELS}=await at('lib/dashboard-review/pillar-c/planning.ts');
const {cReviewPlan,cReviewJson,cReviewCsv,cCreateReviewTask}=await at('lib/dashboard-review/pillar-c/review-plan.ts');
const {cMoneyLabel,parseCReviewPacket,selectCReview}=await at('lib/dashboard-review/pillar-c/review.ts');
const {PILLAR_C_SECTIONS}=await at('lib/dashboard-review/pillar-c/section-navigation.ts');

// ---------------------------------------------------------------- synthetic audiences, packets and views
const ORG_NAME='Azienda sintetica Quattro';
const SERVER={
  azienda4:{kind:'azienda',orgCode:'204',orgName:ORG_NAME,unit:'asl-4',units:['asl-4','aggregato']},
  azienda2:{kind:'azienda',orgCode:'202',orgName:'Azienda sintetica Due',unit:'asl-2',units:['asl-2','aggregato']},
  regione:{kind:'regione',orgCode:'130',units:['aggregato','asl-1','asl-2','asl-3','asl-4']},
};
const fixture=scopedFixture();
const client=k=>guardCClientAudience(toClientAudience(SERVER[k]),SERVER[k]);
const packetOf=k=>{const units=[...SERVER[k].units];return guardCScopedPayload('review',mergeCScopedReview(units,units.map(u=>parseCScopedReviewFile(fixture.reviews[u],u))),units);};
const forecast=parseCReviewPacket(cReviewV2Fixture()).forecast;
async function attrView(k,unit,period='FY2025',channel='Tutti'){
  as({pins:fixture.pins,client:()=>null});
  const r=await loadCScopedAttrView(SERVER[k],fakeSessionClient(fixture,{visible:SERVER[k].units}).client,period,unit,channel);
  assert.equal(r.state,'ready',`${k} ${unit}`);return r.view;
}
async function portView(k,unit,period='FY2025',channel='Tutti',portfolio='AA'){
  as({pins:fixture.pins,client:()=>null});
  const r=await loadCScopedPortfolioView(SERVER[k],fakeSessionClient(fixture,{visible:SERVER[k].units}).client,period,unit,channel,portfolio);
  assert.equal(r.state,'ready',`${k} ${unit}`);return r.view;
}
const withSearch=(el,search='')=>React.createElement(SearchParamsContext.Provider,{value:new URLSearchParams(search)},el);
const under=(audience,el,search='')=>renderToStaticMarkup(withSearch(React.createElement(PillarCAudienceProvider,{audience},el),search));
const bare=(el,search='')=>renderToStaticMarkup(withSearch(el,search));
const workspace=(k,search='',props={})=>bare(React.createElement(PillarCScopedWorkspace,{audience:client(k),packet:packetOf(k),forecast,...props}),search);
/** One source view of the page (joint feedback 2, G2-01/G2-02): «dpc» or «filef». */
const view=(k,v,props)=>workspace(k,`?c_fonte=${v}`,props);
const options=(html,label)=>{const m=html.match(new RegExp(`<select[^>]* aria-label="${label}"[^>]*>(.*?)</select>`));assert.ok(m,`select «${label}»`);return [...m[1].matchAll(/<option value="([^"]*)"[^>]*>([^<]*)<\/option>/g)].map(x=>[x[1],x[2]]);};
const text=h=>h.replace(/<[^>]*>/g,' ').replace(/&#x27;/g,'’').replace(/&quot;/g,'"').replace(/&amp;/g,'&').replace(/\s+/g,' ');
const IDENT=/\s(value|href|id|for|name|download|aria-controls|aria-describedby|aria-labelledby|data-[a-z0-9-]+)="([^"]*)"/g;
/** Every identifier-like attribute: no province key, no reviewer aggregate key, no place name, no NSIS code, no foreign unit. */
function identifiers(html,units,label){
  for(const [,attr,value] of html.matchAll(IDENT)){
    assert.doesNotMatch(value,C_PROVINCE_TOKEN,`${label}: ${attr}="${value}"`);
    assert.doesNotMatch(value,C_PLACE_NAME,`${label}: ${attr}="${value}"`);
    assert.doesNotMatch(value,/13020[1-4]/,`${label}: ${attr}="${value}"`);
    assert.notEqual(value,'Regione',`${label}: ${attr}`);
    for(const m of value.matchAll(/(?:^|[^A-Za-z0-9])(asl-\d+|aggregato)(?=$|[^A-Za-z0-9])/g))assert.ok(units.includes(m[1]),`${label}: foreign unit ${m[1]} in ${attr}`);
  }
}
// 1.2b tightening: the reviewer page's availability line (both variants) and its header scope pill. Never the shorter
// «Atti di budget pubblicati», which the scoped reading card uses. One pattern per variant, so that each has its own
// live match: the reviewer regression test below shows that each of these also matches the reviewer's own markup (the
// empty variant in one extra render of the workspace with no published act), so none can be a dead pattern.
// The fixed four-ASL header was removed by G2-04; the remaining reviewer-only availability sentences still apply.
const REVIEWER_ONLY_1_2B=[/Atti di budget dipartimentali pubblicati nel pacchetto/,/Nessun atto di budget dipartimentale pubblicato nel pacchetto/];
const REVIEWER_ONLY=[/id="evidence-workflow"/,/href="#evidence-workflow"/,/coda condivisa|Assegna le verifiche/i,/href="#costi"/,/Versione e tracciabilità/,/Fonti e significato delle analisi/,/Ricevute numeriche/,/Budget modellato/,/Piano modellato/,/data-pillar-c-review="v[12]"/,/\/api\/pillar-c\/workbook/,/id="(composizione|costi|confronti|attivita|tendenze|sensibilita|priorita)"/,/Riservato ai revisori del progetto/,...REVIEWER_ONLY_1_2B];
const NEVER=/NaN|Infinity|undefined|\b[Dd]emo\b|[Dd]imostra|[Vv]erificat/;
/** What the Regione reads besides (owner decision of 24 Oct 2026): the modelled budget source and the provenance panels.
 * Everything else in REVIEWER_ONLY (queue, workbook route, reviewer header copy) stays refused for it too. */
const REGIONE_GRANTED=['Budget modellato','Versione e tracciabilità','Fonti e significato delle analisi','Ricevute numeriche'];
const REVIEWER_ONLY_REGIONE=REVIEWER_ONLY.filter(r=>!REGIONE_GRANTED.some(t=>r.source.includes(t)));
/** The project's money label, read the way text() reads the page (whitespace, no-break included, collapsed). */
const euro=v=>cMoneyLabel(v).replace(/\s+/g,' ');

// ---------------------------------------------------------------- mandatory audience
test('without an audience, or with an incomplete one, every audience-bound component renders nothing',async()=>{
  const view=await attrView('azienda4','asl-4'),pview=await portView('azienda4','asl-4');
  const context={period:'FY2025',org:'asl-4',channel:'Tutti',portfolioId:'AA',portfolioLabel:'Area sintetica A',sourceSha256:'4d'.repeat(32),classificationSha256:'5e'.repeat(32),mappingVersion:'v-test-sintetica',sourceSnapshot:fixture.pins.index['asl-4']};
  const load={key:'FY2025|asl-4|Tutti',view:cPlanningAccept(JSON.parse(JSON.stringify(view)),'FY2025','asl-4','Tutti')};
  const elements={
    PillarCAttributionAnalysis:React.createElement(PillarCAttributionAnalysis),PillarCPortfolioDossier:React.createElement(PillarCPortfolioDossier),
    PillarCPlanningWorkspace:React.createElement(PillarCPlanningWorkspace,{publishedActs:[]}),PillarCEvidenceWorkflow:React.createElement(PillarCEvidenceWorkflow),
    CAttributionView:React.createElement(CAttributionView,{view}),CPortfolioDossierView:React.createElement(CPortfolioDossierView,{view:pview}),
    CPortfolioChangeSummary:React.createElement(CPortfolioChangeSummary,{view:pview}),CPortfolioPriceQuantityMix:React.createElement(CPortfolioPriceQuantityMix,{view:pview}),
    CPlanningPanel:React.createElement(CPlanningPanel,{search:'c_port_org=asl-4',load,acts:[],onSearch(){},onRetry(){}}),CPortfolioReviewPlan:React.createElement(CPortfolioReviewPlan,{context}),
  };
  const calls=[],original=globalThis.fetch;globalThis.fetch=(...a)=>{calls.push(a);return new Promise(()=>{});};
  try{
    for(const [name,el] of Object.entries(elements)){
      assert.equal(bare(el),'',`${name} without a provider`);
      for(const broken of [null,{...client('azienda4'),schema:'x'},{...client('azienda4'),capabilities:{...client('azienda4').capabilities,evidence:true}},{...client('azienda4'),orgs:[{key:'TE',label:'ASL 4'},{key:'aggregato',label:'Aggregato'}]},{...client('regione'),budgetOrgs:[{key:'aggregato',label:'Aggregato regionale'}]},{...client('azienda4'),scopeLine:null},{...C_REVIEWER_CLIENT_AUDIENCE,monthlyMode:'explicit'}])
        assert.equal(under(broken,el),'',`${name} under an incomplete audience`);
    }
    // The workspaces: each requires its own kind of audience, and the scoped one a packet of exactly the audience's units.
    assert.equal(bare(React.createElement(PillarCScopedWorkspace,{audience:undefined,packet:packetOf('azienda4'),forecast})),'');
    assert.equal(bare(React.createElement(PillarCScopedWorkspace,{audience:C_REVIEWER_CLIENT_AUDIENCE,packet:packetOf('azienda4'),forecast})),'');
    assert.equal(bare(React.createElement(PillarCScopedWorkspace,{audience:client('azienda4'),packet:packetOf('regione'),forecast})),'','a packet of other units');
    assert.equal(bare(React.createElement(PillarCScopedWorkspace,{audience:client('regione'),packet:{...packetOf('regione'),orgs:['asl-1','aggregato','asl-2','asl-3','asl-4']},forecast})),'','units out of order');
    const reviewerPacket=parseCReviewPacket(cReviewV2Fixture());
    assert.equal(bare(React.createElement(PillarCAnalyticalWorkspace,{packet:reviewerPacket})),'','the reviewer workspace without its audience');
    assert.equal(bare(React.createElement(PillarCAnalyticalWorkspace,{audience:client('regione'),packet:reviewerPacket})),'','the reviewer packet under a scoped audience');
    assert.equal(calls.length,0,'nothing is fetched');
  }finally{globalThis.fetch=original;}
  // Structurally, every fetch sits in a component that receives the audience as a required prop from a guard that
  // returns null without one, so a fetch cannot start without an audience.
  const src=p=>readFileSync(`${root}${p}`,'utf8').replace(/\r\n/g,'\n');
  for(const [file,guard,inner] of [
    ['attribution-analysis.tsx',/export function PillarCAttributionAnalysis\([^)]*\) \{\n  const audience=usePillarCAudience\(\);\n  return audience\?<AttributionAnalysis audience=\{audience\}\/>:null;\n\}/,/function AttributionAnalysis\(\{audience\}:\{audience:CClientAudience\}\)/],
    ['portfolio-dossier.tsx',/export function PillarCPortfolioDossier\([^)]*\)\{\n  const audience=usePillarCAudience\(\);\n  return audience\?<PortfolioDossier audience=\{audience\} workbook=\{workbook\} pvmSection=\{pvmSection\}\/>:null;\n\}/,/function PortfolioDossier\(\{audience,workbook,pvmSection\}:\{audience:CClientAudience;/],
    ['planning-workspace.tsx',/export function PillarCPlanningWorkspace\(props: CPlanningWorkspaceProps\) \{\n  const audience = usePillarCAudience\(\);\n  return audience \? <PlanningWorkspace \{\.\.\.props\} audience=\{audience\}\/> : null;\n\}/,/function PlanningWorkspace\(\{ publishedActs, evidenceAnchor = false, audience \}: CPlanningWorkspaceProps & \{ audience: CClientAudience \}\)/],
    ['evidence-workflow.tsx',/export function PillarCEvidenceWorkflow\(\)\{\n  const audience=usePillarCAudience\(\);\n  return audience\?\.capabilities\.evidence===true\?<EvidenceWorkflow\/>:null;\n\}/,/function EvidenceWorkflow\(\)\{/],
    ['portfolio-pvm.tsx',/const audience=usePillarCAudience\(\);\n  if\(!audience\)return null;\n  if\(!audience\.capabilities\.pvm\)return <p [^\n]*\{C_AUDIENCE_COPY\.pvm\}<\/p>;\n  return <PriceQuantityMix view=\{view\} workbook=\{audience\.kind==="reviewer"\?workbook:null\} loaded=\{audience\.kind==="reviewer"\?null:pvmSection\?\?null\} regional=\{audience\.kind!=="reviewer"\} aggregateKey=\{audience\.aggregateKey\}\/>;/,/function PriceQuantityMix\(/],
  ]){
    const s=src(`components/dashboard-review/pillar-c/${file}`);
    assert.match(s,guard,`${file}: the exported mount is a guard`);assert.match(s,inner,`${file}: the fetching component takes the audience`);
    const exported=[...s.matchAll(/^export function (\w+)[^\n]*\n([\s\S]*?)^\}/gm)].filter(m=>m[2].includes('fetch('));
    assert.deepEqual(exported.map(m=>m[1]),[],`${file}: no exported component fetches`);
  }
  for(const file of ['analytical-workspace.tsx','scoped-workspace.tsx','regional-forecast-workspace.tsx','change-summary.tsx','review-plan.tsx','section-navigation.tsx','section-frame.tsx','audience-context.tsx'])assert.doesNotMatch(src(`components/dashboard-review/pillar-c/${file}`),/fetch\(/,file);
  // The context has no default, and no component falls back to the reviewer's vocabulary.
  assert.match(src('components/dashboard-review/pillar-c/audience-context.tsx'),/createContext<CClientAudience \| null>\(null\)/);
  for(const file of ['attribution-analysis.tsx','portfolio-dossier.tsx','planning-workspace.tsx','change-summary.tsx','review-plan.tsx','scoped-workspace.tsx','regional-forecast-workspace.tsx'])
    assert.doesNotMatch(src(`components/dashboard-review/pillar-c/${file}`),/\bC_ORG_LABELS\b|\bC_ATTR_ORGS\b|\bC_ORGS\b/,file);
});

test('the client validator holds each scoped kind to exactly its capabilities (regional parity, 24 Oct 2026)',()=>{
  const a=client('azienda4'),r=client('regione');
  assert.ok(AV.cClientAudience(a)&&AV.cClientAudience(r));
  for(const k of ['pvm','lineage','syntheticBudgets','evidence','workbook','insights'])assert.equal(AV.cClientAudience({...a,capabilities:{...a.capabilities,[k]:true}}),null,`Azienda with ${k}`);
  for(const k of ['pvm','lineage','syntheticBudgets'])assert.equal(AV.cClientAudience({...r,capabilities:{...r.capabilities,[k]:false}}),null,`Regione without ${k}`);
  for(const k of ['evidence','workbook','insights'])assert.equal(AV.cClientAudience({...r,capabilities:{...r.capabilities,[k]:true}}),null,`Regione with ${k}`);
});

test('the client audience validator accepts the guarded audiences and the reviewer\'s, and nothing else',()=>{
  for(const k of Object.keys(SERVER))assert.deepEqual(AV.cClientAudience(client(k)),client(k),k);
  assert.equal(AV.cClientAudience(C_REVIEWER_CLIENT_AUDIENCE),C_REVIEWER_CLIENT_AUDIENCE);
  const a=client('azienda4');
  for(const broken of [undefined,null,[],'x',{...a,schema:undefined},{...a,kind:'altro'},{...a,orgs:[]},{...a,orgs:[{key:'asl-4',label:''},a.orgs[1]]},{...a,orgs:[a.orgs[0],a.orgs[0]]},{...a,defaultOrg:'asl-1'},{...a,aggregateKey:'Regione'},
    {...a,monthlyMode:'summed'},{...a,orgs:[{key:'asl-9',label:'X'},a.orgs[1]]},{...a,budgetOrgs:[{key:'aggregato',label:'X'}]},{...a,capabilities:{...a.capabilities,syntheticBudgets:true}},{...a,capabilities:{...a.capabilities,pvm:undefined}},{...a,exportLabel:' '},{...a,scopeLine:null},
    {...C_REVIEWER_CLIENT_AUDIENCE,defaultOrg:'asl-1'}])assert.equal(AV.cClientAudience(broken),null,JSON.stringify(broken)?.slice(0,80));
});

// ---------------------------------------------------------------- Azienda
test('starting links normalize rejected organizations in main, portfolio and budget controls without changing periods',()=>{
  const audience=client('azienda4'),packet=packetOf('azienda4');
  const raw='c_org=asl-1&c_port_org=asl-2&c_attr_org=TE&c_budget_org=PE&c_channel=CO&c_period=FY2024';
  for(const choice of ['direzione','farmacia','regione'])for(const keep of [false,true]){
    const params=new URLSearchParams(cScopedStartingSearch(audience,packet,raw,choice,keep));
    assert.equal(params.get('c_period'),'FY2024');assert.equal(params.get('c_channel'),'CO');
    assert.equal(params.get('c_budget_org'),'asl-4');assert.equal(params.has('c_attr_org'),false);
    for(const key of ['c_org','c_port_org'])assert.ok([null,'asl-4','aggregato'].includes(params.get(key)),key);
    assert.equal(params.get('c_fonte'),choice==='farmacia'?'dpc':null);
  }
});

test('Azienda: own name and the four-Azienda aggregate only, no peer, no reviewer-only section, O4 notes and its export label',()=>{
  for(const search of ['','c_org=aggregato','c_org=aggregato&c_channel=CO&c_period=FY2024&c_comparison=K2&c_trend=cumulative']){
    const h=workspace('azienda4',search),t=text(h);
    assert.match(h,/data-pillar-c-review="scoped-azienda" data-release-state="review_only"/);
    const selected=AV.cScopedReviewFilters(client('azienda4'),new URLSearchParams(search)).filters;
    assert.ok(text(h.slice(0,h.indexOf('</header>'))).includes(`${AV.cAudienceLabel(client('azienda4'),selected.org)} · ${selected.channel==='Tutti'?'Tutti i canali':selected.channel}`),'the header follows the authorized selection');
    assert.deepEqual(options(h,'Ambito aziendale'),[['asl-4',ORG_NAME],['aggregato','Aggregato delle quattro Aziende']]);
    assert.match(h,new RegExp(`<option value="${search?'aggregato':'asl-4'}" selected="">`));
    assert.doesNotMatch(h,/value="asl-[123]"|ASL [1-4]\b|Aggregato regionale|Azienda sintetica (Uno|Due|Tre)/,'no peer option, label or key');
    identifiers(h,SERVER.azienda4.units,`azienda ?${search}`);
    for(const r of REVIEWER_ONLY)assert.doesNotMatch(h,r,`${r} ?${search}`);
    assert.doesNotMatch(h,NEVER);
    // Budget: the own Azienda only, published acts only, the modelled-allocation note; no «Azienda del budget» select.
    assert.ok(t.includes(`Azienda: ${ORG_NAME}`));assert.doesNotMatch(h,/<select aria-label="Azienda del budget"/);
    assert.ok(t.includes('Fonte del budget Budget pubblicato'));assert.doesNotMatch(h,/<select aria-label="Fonte del budget"/);
    assert.ok(t.includes(AV.C_AUDIENCE_COPY.budgetNote));assert.ok(t.includes('Il budget si legge per singola Azienda.'));
    assert.ok(t.includes(AV.C_AUDIENCE_COPY.countsNote),'the CO count scenario carries its estimate note');
    assert.doesNotMatch(t,/Prova ASL 4|Budget pubblicati · ASL 4/);
    // The planning workspace's confidentiality label is the Azienda's own.
    assert.match(h,new RegExp(`<p id="scenari-confidentiality" class="[^"]*">Riservato a ${ORG_NAME} · dati della propria Azienda e aggregato delle quattro Aziende</p>`));
    // The PVM is not offered: no link to it from section 1 either; the three «Vai a» links of the overview (1.2c).
    assert.doesNotMatch(h,/Spesa condivisa fra aree|Scenari di numerosità|href="#costi"|Quantità, mix e costo/);
    assert.match(h,/>Vai a Portafogli e attribuzione<\/a><a href="#fattori" [^>]*>Vai a Fattori di spesa<\/a><a href="#budget-scenari" [^>]*>Vai a Budget e scenari<\/a>/);
    // The attribution analysis is in section 3 and reads the page scope (c_port_*): the bar's c_org does not move it (M2).
    assert.match(h,/<section id="attribuzione"[^>]*data-c-attribution="v1" data-c-attribution-scope="FY2025\|asl-4\|Tutti">/);
    assert.deepEqual([...h.matchAll(/<span([^>]*)>([^<]*)<\/span>/g)].filter(m=>/class="flex size-9 /.test(m[1])).map(m=>[m[2],/aria-hidden="true"/.test(m[1])]),['1','2','3','4','5','6'].map(n=>[n,true]),'no number badge: only the six hidden frame numerals');
    // The public regional forecast, as every approved member receives it.
    assert.match(h,/<section id="previsione"/);assert.ok(t.includes(forecast.labels.forecast));
  }
  // The first published act opens the budget panel; the own unit's figures and never another unit's sentinel.
  const own=workspace('azienda4');
  assert.ok(text(own).includes('Dipartimento 4000'));assert.match(own,/data-c-scoped-note="budget"/);
  assert.ok(text(own).includes(euro(SENTINEL['asl-4'])),'own count scenario');
  const agg=workspace('azienda4','c_org=aggregato');
  assert.ok(text(agg).includes(euro(SENTINEL.aggregato)),'aggregate count scenario');
  for(const h of [own,agg])for(const unit of ['asl-1','asl-2','asl-3'])assert.ok(!text(h).includes(euro(SENTINEL[unit])),`no ${unit} figure`);
});

test('Azienda without a published act: the honest empty state, never a modelled budget or a zero',()=>{
  const h=workspace('azienda2'),t=text(h);
  assert.ok(t.includes(AV.C_AUDIENCE_COPY.budgetNone));assert.ok(t.includes('Azienda: Azienda sintetica Due'));
  assert.doesNotMatch(h,/Chiave principale|Budget modellato/);
  // A link asking for a peer's budget shows the own Azienda, with the note.
  const tampered=text(workspace('azienda2','c_budget_org=asl-4&c_budget=synthetic'));
  assert.ok(tampered.includes(AV.C_AUDIENCE_COPY.tampered));assert.ok(tampered.includes(AV.C_AUDIENCE_COPY.budgetNone));assert.ok(!tampered.includes('Dipartimento 4000'));
});

// ---------------------------------------------------------------- Regione
test('Regione: «Aggregato regionale» and ASL 1–4 under opaque keys, no province key or place name in any identifier',()=>{
  for(const search of ['','c_org=asl-2&c_channel=DD','c_budget_org=asl-1&c_budget_channel=DD','c_org=asl-4&c_budget_org=asl-4&c_budget_channel=CO&c_budget_period=FY2024']){
    const h=workspace('regione',search),t=text(h);
    assert.match(h,/data-pillar-c-review="scoped-regione"/);
    const selected=AV.cScopedReviewFilters(client('regione'),new URLSearchParams(search)).filters;
    assert.ok(text(h.slice(0,h.indexOf('</header>'))).includes(`${AV.cAudienceLabel(client('regione'),selected.org)} · ${selected.channel==='Tutti'?'Tutti i canali':selected.channel}`),'the regional header follows the selected organization');
    assert.deepEqual(options(h,'Ambito aziendale'),[['aggregato','Aggregato regionale'],['asl-1','ASL 1'],['asl-2','ASL 2'],['asl-3','ASL 3'],['asl-4','ASL 4']]);
    assert.deepEqual(options(h,'Azienda del budget'),[['asl-1','ASL 1'],['asl-2','ASL 2'],['asl-3','ASL 3'],['asl-4','ASL 4']]);
    identifiers(h,SERVER.regione.units,`regione ?${search}`);
    for(const [,label] of [...h.matchAll(/<option value="[^"]*"[^>]*>([^<]*)<\/option>/g)])assert.doesNotMatch(label,C_PROVINCE_TOKEN,label);
    assert.doesNotMatch(t,/Azienda sintetica|Aggregato delle quattro Aziende/,'no Azienda name and not the Azienda wording');
    for(const r of REVIEWER_ONLY_REGIONE)assert.doesNotMatch(h,r,`${r} ?${search}`);
    assert.doesNotMatch(h,NEVER);
    // The O4 notes accompany rows only (UI-2): ASL 1 has no published act, so its budget panel has none.
    assert.equal(t.includes(AV.C_AUDIENCE_COPY.budgetNote),t.includes('Scala comune · euro'),`budget note iff budget rows ?${search}`);
    assert.equal(t.includes(AV.C_AUDIENCE_COPY.budgetNote),!search.includes('c_budget_org=asl-1'),`budget rows ?${search}`);
    assert.ok(t.includes(AV.C_AUDIENCE_COPY.countsNote));
    assert.match(h,/<p id="scenari-confidentiality" class="[^"]*">Riservato alla Regione · dati delle quattro Aziende \(ASL 1–4\) e aggregato regionale<\/p>/);
  }
  assert.ok(text(workspace('regione')).includes('Dipartimento 4000'),'the published act of ASL 4 opens the panel');
  assert.ok(text(workspace('regione','c_budget_org=asl-1&c_budget_channel=DD')).includes(AV.C_AUDIENCE_COPY.budgetNone));
  // The section navigation is the six-entry bar linking the six frames (1.2c); the nine old anchors stay as inner blocks
  // so that old links resolve; no select, no workbook section, no queue.
  const h=workspace('regione');
  assert.doesNotMatch(h,/Vai alla sezione/);
  const navAt=h.indexOf('<nav aria-label="Sezioni dell’analisi Pillar C"'),nav=h.slice(navAt,h.indexOf('</nav>',navAt));
  assert.deepEqual([...nav.matchAll(/href="#([^"]+)"/g)].map(m=>m[1]),PILLAR_C_SECTIONS.map(s=>s.id));
  for(const s of PILLAR_C_SECTIONS)assert.equal(h.split(`<section id="${s.id}" aria-labelledby="${s.id}-title"`).length-1,1,s.id);
  for(const id of ['portafogli','scenari','spesa','attribuzione','cambiamento','pianificazione','numerosita','previsione','evidenza'])assert.equal(h.split(` id="${id}"`).length-1,1,id);
});

test('O4 notes render only with the rows they describe; an empty state never says the panel «contains» anything (UI-2)',()=>{
  const notes=h=>[...h.matchAll(/data-c-scoped-note="(budget|counts)"/g)].map(m=>m[1]);
  // Rows shown: both notes, once each, after their rows.
  for(const [k,search] of [['azienda4',''],['azienda4','c_org=aggregato'],['regione',''],['regione','c_org=asl-2']]){
    const h=workspace(k,search),t=text(h);
    assert.deepEqual(notes(h),['budget','counts'],`${k} ?${search}`);
    assert.ok(t.indexOf('Scala comune · euro')<t.indexOf(AV.C_AUDIENCE_COPY.budgetNote),'budget note after the budget rows');
    assert.ok(t.includes(AV.C_AUDIENCE_COPY.countsLabels.scale),'the count rows are shown');
    assert.ok(t.indexOf(AV.C_AUDIENCE_COPY.countsLabels.scale)<t.indexOf(AV.C_AUDIENCE_COPY.countsNote),'counts note after the count rows');
  }
  // No published act: the honest empty state alone.
  for(const [k,search] of [['azienda2',''],['regione','c_budget_org=asl-1&c_budget_channel=DD'],['regione','c_budget_org=asl-2']]){
    const h=workspace(k,search),t=text(h);
    assert.ok(t.includes(AV.C_AUDIENCE_COPY.budgetNone),`${k} ?${search}`);
    assert.ok(!notes(h).includes('budget'),`${k} ?${search}: no budget note under the empty state`);
    assert.ok(!t.includes(AV.C_AUDIENCE_COPY.budgetNote));assert.ok(!t.includes('Contiene allocazioni modellate'));
  }
  // An act exists but not for this selection: the other empty state, again without the note.
  const empty=workspace('azienda4','c_budget_org=asl-4&c_budget_channel=DPC&c_budget_period=FY2024&c_level=Dipartimento'),et=text(empty);
  assert.ok(et.includes(AV.C_AUDIENCE_COPY.budgetEmpty));assert.ok(!notes(empty).includes('budget'));
  // A portfolio with no ratio (and the CO year without one): the count empty state alone, with no «Contiene stime».
  for(const [k,search] of [['azienda4','c_portfolio=VAC'],['regione','c_org=asl-3&c_portfolio=VAC'],['azienda4','c_count_year=FY2024']]){
    const h=workspace(k,search),t=text(h);
    assert.ok(t.includes('Il portafoglio selezionato non ha un rapporto disponibile'),`${k} ?${search}`);
    assert.ok(!notes(h).includes('counts'),`${k} ?${search}: no counts note under the empty state`);
    assert.ok(!t.includes(AV.C_AUDIENCE_COPY.countsNote));assert.ok(!t.includes('Contiene stime'));
  }
});

test('no per-person or per-patient wording in scoped audiences: the CO count panel reads a ratio to the estimated count; from 1.2b the reviewer reads the same ratio wording (UI-3, F-UI3-RES; design 2.3 analytical#numerosita-reviewer-wording)',()=>{
  const C=AV.C_AUDIENCE_COPY,L=C.countsLabels;
  assert.equal(C.countsTitle,'Spesa rapportata alla numerosità stimata · scenario');
  assert.deepEqual(L,{
    scale:'€ per unità di numerosità stimata · scenario',
    unit:' per unità di numerosità stimata',
    headers:['Portafoglio','Numerosità base stimata','Spesa CO attribuita tramite portafoglio','€ per unità · numerosità ridotta del 25%','€ per unità · numerosità di riferimento','€ per unità · numerosità aumentata del 25%'],
  });
  for(const s of [C.countsTitle,L.scale,L.unit,...L.headers,C.countsNote])assert.doesNotMatch(s,/person[ae]|pazient[ei]/i,s);
  // The only sentence of the scoped page that names spend per person is the planning section's negation («Non calcola
  // … spesa per persona»), shared with the reviewer view: it states what is NOT computed. Nothing else may.
  const negation=C_PLANNING_LABELS.notComputed.items.find(s=>/spesa per persona/.test(s));
  assert.ok(negation&&negation.startsWith('Non calcola '),'the shared negation sentence');
  let withRows=0,empty=0;
  for(const [k,search] of [['azienda4',''],['azienda4','c_org=aggregato'],['azienda4','c_count_year=FY2024'],['azienda4','c_portfolio=VAC'],['azienda2',''],['regione',''],['regione','c_org=asl-2'],['regione','c_org=asl-3&c_portfolio=VAC']]){
    const h=workspace(k,search),t=text(h),label=`${k} ?${search}`;
    const section=h.match(/<section id="numerosita"[\s\S]*?<\/section>/)?.[0];assert.ok(section,`${label}: the count section`);
    const panel=section.match(/<article[\s\S]*<\/article>/)?.[0];assert.ok(panel,`${label}: the count panel`);
    assert.match(panel,/<h3 class="text-base font-semibold">Spesa rapportata alla numerosità stimata · scenario<\/h3>/,label);
    // The panel (title, scale, rows, exact table, notes): no person and no patient in any form.
    assert.doesNotMatch(text(panel),/person[ae]|pazient[ei]/i,`${label}: the count panel`);
    // The section, its heading included, and the whole scoped page: neither «persona» nor «paziente», apart from the
    // planning negation.
    assert.doesNotMatch(text(section),/persona|paziente/i,`${label}: the count section`);
    assert.doesNotMatch(t.split(negation).join(' '),/persona|paziente/i,`${label}: the scoped page`);
    if(!text(panel).includes(L.scale)){empty++;assert.ok(text(panel).includes('Il portafoglio selezionato non ha un rapporto disponibile'),label);continue;}
    withRows++;
    // Every row's ratio carries the ratio unit, and the exact table labels its euro columns as ratios.
    const rowUnits=[...text(panel).matchAll(/(\d[\d.]*,\d\d €)( per unità di numerosità stimata)/g)];
    assert.ok(rowUnits.length>0,`${label}: row units`);
    assert.deepEqual([...panel.matchAll(/<th scope="col"[^>]*>([^<]*)<\/th>/g)].map(m=>m[1]),L.headers,`${label}: table headers`);
  }
  assert.ok(withRows>=5&&empty>=2,`both states rendered (${withRows} with rows, ${empty} empty)`);
  // From 1.2b the shared block's default wording is the ratio wording for every reader (it equals countsLabels); the
  // reviewer passes no labels and takes that default, and the scoped page still passes the ratio wording explicitly.
  const reviewer=readFileSync(`${root}components/dashboard-review/pillar-c/analytical-workspace.tsx`,'utf8');
  assert.ok(reviewer.includes('<Panel title={C_AUDIENCE_COPY.countsTitle}'),'the reviewer count panel takes the ratio title');
  assert.doesNotMatch(reviewer,/per paziente|persona nello scenario/,'no per-patient or per-person wording in the reviewer source');
  assert.ok(reviewer.includes('<CountRows countRows={countRows} />'),'the reviewer passes no labels');
  const blocks=readFileSync(`${root}components/dashboard-review/pillar-c/review-blocks.tsx`,'utf8');
  assert.ok(blocks.includes('scale: "€ per unità di numerosità stimata · scenario",')&&blocks.includes('unit: " per unità di numerosità stimata",'),'the shared default is the ratio wording');
  assert.doesNotMatch(blocks,/persona\b|paziente/,'the shared block names no person and no patient');
  const scoped=readFileSync(`${root}components/dashboard-review/pillar-c/scoped-workspace.tsx`,'utf8');
  assert.doesNotMatch(scoped,/paziente|persona\b/,'the scoped source names no patient and no per-person unit');
  assert.ok(scoped.includes('<CountRows countRows={countRows} labels={C_AUDIENCE_COPY.countsLabels} />'),'the scoped workspace passes the ratio wording');
});

test('a link carrying a key outside the audience shows the audience default with a visible note, in every scope',async()=>{
  for(const [k,search,shown] of [['azienda4','c_org=TE','asl-4'],['azienda4','c_org=asl-1','asl-4'],['azienda4','c_org=Regione','asl-4'],['regione','c_org=AQ','aggregato'],['regione','c_org=ASL-1','aggregato'],['regione','c_org=asl-1%20','aggregato']]){
    const h=workspace(k,search);
    assert.ok(text(h).includes(AV.C_AUDIENCE_COPY.tampered),`${k} ?${search}`);
    assert.match(h,new RegExp(`<option value="${shown}" selected="">`));
  }
  assert.ok(!text(workspace('azienda4','c_org=aggregato')).includes(AV.C_AUDIENCE_COPY.tampered),'an own key is not tampered');
  // The dossier and the attribution analysis read the page scope (c_port_*) and clamp it the same way, before any fetch;
  // their own organisation selects are gone (1.2c): the clamp shows as the note, the section-3 line and the fetched scope.
  const dossier=under(client('azienda4'),React.createElement(PillarCPortfolioDossier),'c_port_org=asl-1');
  assert.doesNotMatch(dossier,/aria-label="(Organizzazione|Canale) del dossier"/);assert.ok(text(dossier).includes(AV.C_AUDIENCE_COPY.tampered));
  assert.ok(text(workspace('azienda4','c_port_org=asl-1')).includes(`${ORG_NAME} · Tutti i canali · Anno 2025 · raggruppamenti ATC in bozza`),'section 3 states the clamped organisation');
  const attribution=under(client('regione'),React.createElement(PillarCAttributionAnalysis),'c_port_org=TE');
  assert.doesNotMatch(attribution,/<select/);
  assert.match(attribution,/data-c-attribution-scope="FY2025\|aggregato\|Tutti"/);assert.ok(text(attribution).includes(AV.C_AUDIENCE_COPY.tampered));
  assert.ok(!text(under(client('regione'),React.createElement(PillarCAttributionAnalysis),'c_attr_org=TE')).includes(AV.C_AUDIENCE_COPY.tampered),'c_attr_* is not read');
  // The reviewer reads the same addresses exactly as before: no note, today's defaults.
  assert.ok(!text(under(C_REVIEWER_CLIENT_AUDIENCE,React.createElement(PillarCPortfolioDossier),'c_port_org=asl-1')).includes(AV.C_AUDIENCE_COPY.tampered));
});

// ---------------------------------------------------------------- shared views under a scoped audience
test('shared views under a scoped audience: own labels, no queue, no PVM, no foreign view; product descriptors stay descriptors',async()=>{
  const aziendaView=await attrView('azienda4','asl-4'),aggregateView=await attrView('azienda4','aggregato');
  const h=under(client('azienda4'),React.createElement(CAttributionView,{view:aziendaView}));
  assert.match(h,/data-period="FY2025" data-org="asl-4" data-channel="Tutti"/);
  assert.ok(text(h).includes(`${ORG_NAME} · Tutti i canali`));
  assert.doesNotMatch(h,/evidence-workflow|coda condivisa/i,'no link to the shared review queue');
  assert.ok(text(under(client('azienda4'),React.createElement(CAttributionView,{view:aggregateView}))).includes('Aggregato delle quattro Aziende · Tutti i canali'));
  // A view of a unit the audience does not hold is not rendered at all.
  const peer=await attrView('regione','asl-1');
  assert.equal(under(client('azienda4'),React.createElement(CAttributionView,{view:peer})),'');
  assert.ok(text(under(client('regione'),React.createElement(CAttributionView,{view:peer}))).includes('ASL 1 · Tutti i canali'));
  // Regione: the descriptor-only tokens of the synthetic products appear as text, never as an identifier.
  const tokenView=await attrView('regione','asl-2'),r=under(client('regione'),React.createElement(CAttributionView,{view:tokenView}));
  assert.ok(text(r).includes(TOKEN_LABEL));identifiers(r,SERVER.regione.units,'regione attribution');
  // The detailed PVM is secondary; the default dossier retains the attribution link and mounts no PVM.
  const pview=await portView('azienda4','asl-4'),d=under(client('azienda4'),React.createElement(CPortfolioDossierView,{view:pview}));
  assert.match(d,/data-c-secondary="portfolio-details"/);assert.doesNotMatch(d,/data-c-portfolio-pvm=/);
  assert.doesNotMatch(d,/href="#costi"|Quantità, mix e costo unitario · evidenza disponibile/);assert.match(d,/href="#attribuzione"/);
  assert.match(d,/data-org="asl-4"/);assert.ok(text(d).includes(`${ORG_NAME} · tutti i canali`));
  assert.ok(text(under(client('azienda4'),React.createElement(CPortfolioChangeSummary,{view:pview}))).includes(`· ${ORG_NAME} · tutti i canali ·`));
  const rd=under(client('regione'),React.createElement(CPortfolioDossierView,{view:await portView('regione','asl-2')}));identifiers(rd,SERVER.regione.units,'regione dossier');
  assert.doesNotMatch(rd,NEVER);assert.doesNotMatch(d,NEVER);
});

test('planning workspace under a scoped audience: own scope and label, own acts only, its export label, no queue link',async()=>{
  const view=await attrView('azienda4','asl-4');
  const load={key:'FY2025|asl-4|Tutti',view:cPlanningAccept(JSON.parse(JSON.stringify(view)),'FY2025','asl-4','Tutti')};
  const panel=(k,search,l,acts=[],evidenceAnchor=true)=>under(client(k),React.createElement(CPlanningPanel,{search,load:l,acts,evidenceAnchor,onSearch(){},onRetry(){}}));
  const h=panel('azienda4','c_port_period=FY2025&c_port_org=asl-4&c_port_channel=Tutti&c_plan_ids=AA',load),t=text(h);
  assert.ok(t.includes(`Anno 2025 · ${ORG_NAME} · Tutti i canali`));assert.match(h,/data-scope-key="FY2025\|asl-4\|Tutti\|AA"/);
  assert.match(h,new RegExp(`id="scenari-confidentiality" class="[^"]*">Riservato a ${ORG_NAME}`));
  assert.doesNotMatch(h,/href="#evidence-workflow"/,'no queue link even where a reviewer workspace would have one');
  // The context strip names the audience's own acts by its own label, and reads the aggregate as «within».
  const agg=text(panel('azienda4','c_port_org=aggregato',null,['asl-4|FY2025|CO']));
  assert.ok(agg.includes(`${C_PLANNING_LABELS.outside.budgetWithin} ${ORG_NAME}. ${C_PLANNING_LABELS.outside.budgetWithinNote}`));
  assert.ok(text(panel('regione','c_port_org=aggregato',null,['asl-4|FY2025|CO'])).includes(`${C_PLANNING_LABELS.outside.budgetWithin} ASL 4.`));
  assert.ok(text(panel('azienda4','c_port_org=aggregato',null,['TE|FY2025|CO'])).includes(C_PLANNING_LABELS.outside.regional),'a reviewer key is malformed here and never breaks the strip');
  // A refused read says so in the audience's words, not as a reviewer-only space.
  const refused=text(panel('azienda4','c_port_org=asl-4',{key:'FY2025|asl-4|Tutti',error:'forbidden'}));
  assert.ok(refused.includes(AV.C_AUDIENCE_COPY.forbidden));assert.ok(!refused.includes(C_PLANNING_LABELS.section.forbidden));
  // The scope the panel reads is clamped to the audience: a peer's key falls back to the default and its loaded view is not used.
  assert.equal(AV.cAudiencePlanningFilters(client('azienda4'),'c_port_org=asl-1').state.org,'asl-4');
  assert.equal(AV.cAudiencePlanningFilters(client('regione'),'c_port_org=TE').state.org,'aggregato');
  for(const s of ['','c_port_org=AQ','c_port_org=asl-1','c_port_org=Regione&c_plan_ids=AA.BB'])assert.deepEqual(AV.cAudiencePlanningFilters(C_REVIEWER_CLIENT_AUDIENCE,s),cPlanningFilters(s),`reviewer ${s}`);
});

test('exports: per-audience labels and unit-keyed file names; the reviewers\' exports are unchanged',async()=>{
  const view=await attrView('azienda4','asl-4'),accepted=cPlanningAccept(JSON.parse(JSON.stringify(view)),'FY2025','asl-4','Tutti');
  const state=AV.cAudiencePlanningFilters(client('azienda4'),'c_port_org=asl-4&c_plan_ids=AA&c_plan_v1=500').state;
  const x=cPlanningExport(accepted,state,'2026-10-20T10:00:00.000Z',client('azienda4').exportLabel);
  assert.equal(x.confidentiality,`Riservato a ${ORG_NAME} · dati della propria Azienda e aggregato delle quattro Aziende`);
  assert.equal(x.scope.org,'asl-4');assert.equal(cPlanningExportName(state),'vis-scenari-FY2025-asl-4-Tutti-AA.json');
  assert.equal(cPlanningExport(accepted,state,'2026-10-20T10:00:00.000Z').confidentiality,C_PLANNING_LABELS.section.confidentiality,'the reviewers\' label stays the default');
  assert.throws(()=>cPlanningExport(accepted,state,'2026-10-20T10:00:00.000Z',' '),/C_PLANNING_EXPORT/);
  assert.throws(()=>cPlanningExport(accepted,{...state,org:'aggregato'},'2026-10-20T10:00:00.000Z',client('azienda4').exportLabel),/C_PLANNING_EXPORT/,'the export follows the view it was computed from');
  // Review plan: a scoped plan carries the label in its JSON and as the last CSV column; the reviewers' fields are unchanged.
  const context={period:'FY2025',org:'aggregato',channel:'Tutti',portfolioId:'AA',portfolioLabel:'Area sintetica A',sourceSha256:'4d'.repeat(32),classificationSha256:'5e'.repeat(32),mappingVersion:'v-test-sintetica',sourceSnapshot:fixture.pins.index.aggregato};
  const task=cCreateReviewTask(context,{type:'attribution',title:'Verifica sintetica',role:'',owner:'',dueDate:'',evidence:'',outcome:'',state:'draft'},{id:'t1',now:'2026-10-20T10:00:00.000Z'});
  const label=client('regione').exportLabel,plan=cReviewPlan(context,[task],'2026-10-20T10:01:00.000Z',label);
  assert.deepEqual(Object.keys(plan),['schema','mode','confidentiality','context','exportedAt','tasks']);assert.equal(JSON.parse(cReviewJson(plan)).confidentiality,label);
  const csv=cReviewCsv(plan).split('\r\n');assert.ok(csv[0].endsWith(',"resolved_at","confidentiality"'));assert.ok(csv[1].endsWith(`,"${label}"`));assert.match(csv[1],/"aggregato"/);
  const reviewer=cReviewPlan({...context,org:'Regione'},[cCreateReviewTask({...context,org:'Regione'},{type:'attribution',title:'Verifica sintetica',role:'',owner:'',dueDate:'',evidence:'',outcome:'',state:'draft'},{id:'t1',now:'2026-10-20T10:00:00.000Z'})],'2026-10-20T10:01:00.000Z');
  assert.deepEqual(Object.keys(reviewer),['schema','mode','context','exportedAt','tasks']);assert.ok(cReviewCsv(reviewer).split('\r\n')[0].endsWith(',"resolved_at"'));
  assert.throws(()=>cReviewPlan(context,[task],'2026-10-20T10:01:00.000Z','\u0000'),e=>e.code==='context');
  // The review plan in the page: the audience's own label for the scope, and the export label beside the downloads.
  const rp=under(client('regione'),React.createElement(CPortfolioReviewPlan,{context}));
  assert.ok(text(rp).includes('Area sintetica A · Anno 2025 · Aggregato regionale · Tutti i canali'));assert.match(rp,new RegExp(`data-c-review-plan-confidentiality="true">${label.replace(/[()]/g,'\\$&')}</p>`));
  assert.match(rp,/data-context="FY2025\|aggregato\|Tutti\|AA\|/);identifiers(rp,SERVER.regione.units,'regione review plan');
  assert.doesNotMatch(under(C_REVIEWER_CLIENT_AUDIENCE,React.createElement(CPortfolioReviewPlan,{context:{...context,org:'Regione'}})),/data-c-review-plan-confidentiality/);
  const ui=readFileSync(`${root}components/dashboard-review/pillar-c/review-plan.tsx`,'utf8');
  assert.ok(ui.includes('const name = `VIS_PillarC_Revisione_${context.period}_${context.org}_${context.channel}_${context.portfolioId}.${kind}`;'),'file names carry the context key: a unit key for a scoped audience');
  assert.ok(ui.includes('const plan = cReviewPlan(context, tasks, new Date().toISOString(), label);'));
});

// ---------------------------------------------------------------- URL clamps and explicit reading
test('URL clamps match keys exactly; the budget is always the published act; the aggregate is never a budget scope',()=>{
  const a=client('azienda4'),r=client('regione'),packet=packetOf('regione');
  const f=(aud,s)=>AV.cScopedReviewFilters(aud,new URLSearchParams(s));
  assert.deepEqual([f(a,'').filters.org,f(a,'').tampered],['asl-4',false]);
  assert.deepEqual([f(a,'c_org=aggregato').filters.org,f(a,'c_org=aggregato').tampered],['aggregato',false]);
  for(const bad of ['TE','asl-1','Regione','ASL-4','asl-4 ',' aggregato','asl-4,aggregato',''])assert.deepEqual([f(a,`c_org=${encodeURIComponent(bad)}`).filters.org,f(a,`c_org=${encodeURIComponent(bad)}`).tampered],['asl-4',true],bad);
  // The modelled source: the Regione may read it (owner decision of 24 Oct 2026); an Azienda never (O4).
  assert.equal(f(r,'c_budget=synthetic').filters.budget,'synthetic');assert.equal(f(a,'c_budget=synthetic').filters.budget,'published');
  assert.equal(f(r,'c_budget=modelled').filters.budget,'published','an unknown source is the published act');
  assert.deepEqual([...new URLSearchParams(AV.cScopedReviewSearch(r,'?c_org=asl-2&c_channel=CO',{channel:'DD'}))].sort(),[['c_channel','DD'],['c_org','asl-2']]);
  assert.equal(AV.cScopedReviewSearch(r,'?c_org=asl-2',{org:'aggregato'}),'','the default key is not written');
  assert.equal(AV.cScopedReviewSearch(a,'?c_org=TE&c_budget=synthetic',{period:'FY2024'}),'?c_period=FY2024','a foreign key and a modelled source are dropped');
  assert.equal(AV.cScopedReviewSearch(a,'?c_org=aggregato&c_port_org=asl-4',{},true),'?c_port_org=asl-4','reset only clears the review keys');
  const b=s=>AV.cScopedBudgetFilters(r,packet,new URLSearchParams(s));
  assert.deepEqual([b('').filters.org,b('').filters.channel,b('').filters.budgetPeriod,b('').filters.budget],['asl-4','CO','FY2024','published'],'opens on the first published departmental act');
  assert.deepEqual([b('c_budget_org=aggregato').filters.org,b('c_budget_org=aggregato').tampered],['asl-1',true]);
  assert.deepEqual([b('c_budget_org=asl-3&c_budget_channel=Tutti').filters.org,b('c_budget_org=asl-3&c_budget_channel=Tutti').filters.channel],['asl-3','CO']);
  const search=AV.cScopedBudgetSearch(r,packet,'?c_org=asl-2',{org:'asl-3',channel:'DD'}),q=new URLSearchParams(search);
  assert.deepEqual([q.get('c_org'),q.get('c_budget_org'),q.get('c_budget_channel'),q.get('c_budget')],['asl-2','asl-3','DD',null]);
  assert.deepEqual(AV.cAudienceScope(a,new URLSearchParams('c_port_org=asl-1&c_port_period=JM2026&c_port_channel=DPC'),'c_port'),{period:'JM2026',org:'asl-4',channel:'DPC',tampered:true});
  assert.deepEqual(AV.cAudienceScope(C_REVIEWER_CLIENT_AUDIENCE,new URLSearchParams('c_attr_org=asl-1'),'c_attr'),{period:'FY2025',org:'Regione',channel:'Tutti',tampered:true},'the reviewer keeps today\'s default');
  // Explicit reading: the aggregate is its own rows, never own + aggregate, and never a budget scope.
  const own=selectCReview(packetOf('azienda4'),{...f(a,'').filters,period:'FY2025'}),agg=selectCReview(packetOf('azienda4'),{...f(a,'c_org=aggregato').filters,period:'FY2025'});
  assert.equal(own.baseline.org,'asl-4');assert.equal(agg.baseline.org,'aggregato');assert.notEqual(own.baseline.net,agg.baseline.net);
  assert.deepEqual(selectCReview(packetOf('azienda4'),{...f(a,'c_org=aggregato').filters,channel:'CO',budgetPeriod:'FY2024',level:'Dipartimento'}).availableBudgets,[]);
  assert.deepEqual(AV.cScopedPublishedActs(packetOf('azienda4')),['asl-4|FY2024|CO','asl-4|FY2024|DD']);assert.deepEqual(AV.cScopedPublishedActs(packetOf('azienda2')),[]);
});

// ---------------------------------------------------------------- reviewer regression
test('reviewer: the workspace and every shared view render the markup recorded at point 19 under the reviewer audience',async()=>{
  // Re-recorded for R20-09 (reason: 24 px targets — py-1 on 7 product summaries, a 24 px reset button in 4 dossier cases;
  // across the 59 cases nothing else differs; data hash unchanged; earlier ec64b124…).
  // Re-recorded at point 19, lazy charts (reason: the chart drawing loads after hydration; across the 59 cases the 55 empty
  // recharts containers the server used to emit are replaced by 55 data-chart-slot markers and nothing else differs;
  // data hash unchanged; earlier 021f0914…).
  // Re-recorded at point 19 (reason: 44 px controls, motion-safe transitions, budget select names that start with their visible label, the singular count sentence; data hash unchanged; earlier 0ef441e7…).
  // Re-recorded at point 16 (reason: spend chart chosen by the question, coverage note, «Nessuna riga nel registro», responsive attribution ranges, bridge legend; data hash unchanged; earlier f7f4e2c6…).
  // Re-recorded at 1.2d (reason: the workbook insight browser removed; data hash unchanged; 1.2b value c476b18e…).
  // Re-recorded at 1.2b (reason: six-section regroup and the 1.2b copy rows; data hash unchanged); earlier baseline
  // 30e9e57, eac1cc54…, which ac5e058 still rendered byte for byte. Before the re-record, 30 of the 51 cases changed
  // (22 workspace, 4 dossier, 4 attribution) and 21 stayed byte-identical (2 change summaries, 16 planning, 3 review
  // plans); the 8 leaf changes are exactly the 1.2b copy rows, plus, in the attribution leaf at the queue's fixed scope
  // (FY2025|Regione|Tutti), the reviewer-only queue link at 44 px (min-h-10 → min-h-11, the one change between 0ea2a14a…
  // and this hash). The 8 cases added at 1.2b render the frame, the scope bar, the overview and the evidence sources on
  // literal synthetic props.
  const wrap=(R,el)=>R.createElement(PillarCAudienceProvider,{audience:C_REVIEWER_CLIENT_AUDIENCE},el);
  const quiet=console.error;console.error=()=>{};const warn=console.warn;console.warn=()=>{};
  let out,noAct;try{
    out=await reviewerUiMatrix({root:rootUrl.href,wrap,workspaceProps:{audience:C_REVIEWER_CLIENT_AUDIENCE}});
    // Outside the hashed matrix: the workspace with no published act, the only render of the empty availability line.
    const p=parseCReviewPacket(cReviewV2Fixture());
    noAct=bare(React.createElement(PillarCAnalyticalWorkspace,{audience:C_REVIEWER_CLIENT_AUDIENCE,packet:{...p,budgets:p.budgets.filter(b=>b.basis!=='published')}}));
  }finally{console.error=quiet;console.warn=warn;}
  // The 1.2b leak patterns are live: each matches the reviewer's own markup, which the scoped pages must never show.
  for(const r of REVIEWER_ONLY_1_2B)assert.match(out.json+noAct,r,`${r} matches the reviewer markup`);
  assert.match(noAct,REVIEWER_ONLY_1_2B[1],'the empty variant is live');assert.doesNotMatch(noAct,REVIEWER_ONLY_1_2B[0]);
  assert.equal(out.cases,59);
  assert.equal(out.data,'bebe2d2b3c1d254353cd668e6b67e61c1c5c4b91ec1f15f465ebcccc2aa4e9be','the same synthetic data as the baseline');
  // Re-recorded on 24 Oct 2026: the reviewer's section 5 gains «Confronti pubblici fra Regioni» after the forecast.
  // Re-recorded on 25 Oct 2026 (Guido's feedback 1): section 2's recipient views and the portfolio series labels.
  // Re-recorded on 26 Oct 2026: one plain-Italian vocabulary for the two portfolio components (G1-04 follow-up), then
  // the absolute-exposure labels of Codex's review (G1-R02).
  // Re-recorded on 27 Oct 2026 (joint feedback 2, G2-01/G2-02: the source bar «Spesa per canale · Assistiti e servizio
  // DPC · File F» between the header and the section bar). Against bb4897a (a7cec23b…): 37 of the 59 cases byte-identical;
  // the 22 workspace cases differ only by that bar and by React's useId values, renumbered because the tree gained a node.
  // Re-recorded on 27 Oct 2026 (G2-06: section 2 is «Assistiti e utilizzo»). Against 0284605b…: the same 22 workspace
  // cases change, each only by that label (twice: the section bar and the frame heading); 37 cases byte-identical.
  // Re-recorded on 27 Oct 2026 (G2-24/G2-25, Codex's verified wording). Against 44f58c18…: 50 cases byte-identical; 4
  // dossier leaves change only by the candidate wording, the basis line, the note and «Non presente nei dati selezionati»;
  // 4 attribution leaves only by the denominator of the uncertainty share; 1 change summary only by the presence labels.
  // Re-recorded 29 Oct 2026, owner-approved clarity pass. Baseline reproduced from HEAD: 5d5a62a0….
  // Same data hash, 33 cases byte-identical. The 22 workspace cases gain task entry points and a source-aware header;
  // four dossier cases defer PVM and the exact monthly table under a closed secondary section. Private evidence:
  // outputs/pillar-c/clarity-20261029/matrix-diff.json. The underlying PVM and exact data retain their own tests.
  assert.equal(createHash('sha256').update(out.json).digest('hex'),'733799ced076193676faa672a0804660e4816c3db5a8f431d0cf11dcd74f96b1');
});

// ---------------------------------------------------------------- copy, translation and layout
test('copy and translation safety: keyed or single-child changing text, no demo or verification wording, no added year',()=>{
  const s=readFileSync(`${root}components/dashboard-review/pillar-c/scoped-workspace.tsx`,'utf8').replace(/\r\n/g,'\n');
  // No literal JSX text next to a filter-, data- or state-driven expression inside the same element.
  const DRIVEN=String.raw`\{(?:scope|filters\.|budgets\.length|data\.|copied|eur\(|signed\(|orgLabel|budgetLabel|missingCounts|decision\.|audience\.)[^{}]*\}`;
  const TEXT=String.raw`[^<>{}\`\n]*[^<>{}\`\s][^<>{}\`\n]*`;
  assert.doesNotMatch(s,new RegExp(`>${TEXT}${DRIVEN}`));assert.doesNotMatch(s,new RegExp(`${DRIVEN}${TEXT}<`));
  // 1.2c: «Copia vista» and its keyed span live in the shared scope bar (scope-bar.tsx, pinned by six-sections-frames and review).
  assert.ok(s.includes('<PillarCScopeBar '));assert.doesNotMatch(s,/\bcopied\b|Copia vista|Link copiato/);
  for(const file of ['components/dashboard-review/pillar-c/scoped-workspace.tsx','components/dashboard-review/pillar-c/audience-context.tsx','lib/dashboard-review/pillar-c/audience-view.ts'])
    assert.doesNotMatch(readFileSync(`${root}${file}`,'utf8'),/\bdemo\b|dimostra|verificat/i,file);
  // Every string of the copy, nested ones (the count panel's labels) included.
  const strings=(key,value)=>typeof value==='string'?[[key,value]]:Object.entries(value).flatMap(([k,v])=>strings(`${key}.${k}`,v));
  const copy=Object.entries(AV.C_AUDIENCE_COPY).flatMap(([k,v])=>strings(k,v));
  assert.ok(copy.some(([key])=>key.startsWith('countsLabels.headers.')),'nested copy is checked too');
  for(const [key,value] of copy){assert.doesNotMatch(value,/\b20\d\d\b/,key);assert.doesNotMatch(value,/\d %/,key);}
  // The review plan's scope line is replaced whole when its context changes.
  assert.ok(readFileSync(`${root}components/dashboard-review/pillar-c/review-plan.tsx`,'utf8').includes('<p key={key} className="text-xs font-medium">'));
  // Phone width: nothing in the scoped workspace fixes a width; wide content scrolls inside its own container.
  assert.doesNotMatch(s,/\b(?:min-)?w-\[\d+px\]/);
  // The forecast-only branch composes the section bar and section 5 (1.2c); it still reads no audience.
  assert.doesNotMatch(readFileSync(`${root}components/dashboard-review/pillar-c/regional-forecast-workspace.tsx`,'utf8'),/audience/i);
});

// ---------------------------------------------------------------- regional analytical parity (owner clarification of 23 Oct 2026)
/** The extension view a loader hands each audience: the Regione's from the reviewer object (every unit, the four ASLs'
 * per-pack lists and the region-wide blocks), an Azienda's from its own unit and the aggregate (only its own list). */
function extensionOf(k){
  const labels=client(k).orgs;
  if(k==='regione'){const r=extReviewer();return {units:labels.map(o=>({key:o.key,label:o.label,data:r.units.find(u=>u.unit===o.key)})),drivers:r.drivers,baskets:r.baskets,fileFBasket:r.fileFBasket,findings:r.findings};}
  return {units:labels.map(o=>({key:o.key,label:o.label,data:o.key===SERVER[k].unit?extUnit(o.key):{...extUnit(o.key,4000),unitCosts:null}})),drivers:null,baskets:null,fileFBasket:null,findings:null};
}
/** A synthetic one-output costi section (invented values), as loadCRegionalPvm returns it. */
const PVM_SECTION={schema:'pillar-c-workbook-section-v1',workbookSha256:'f8fe8b13f10eab51194b057f52dd11a599d28d827ce92438b1043837c60894bb',section:'costi',formats:{164:'#,##0.00 "€"'},
  outputs:[{id:'ML-4-PORT-REAL',title:'Invented test only',section:'costi',tier:'Solo descrittivo',qualifier:'mappatura in bozza',grain:'portafoglio',ranges:['12A_ML4_Price_Vol_Mix!A209:L234'],availability:'snapshot',reason:null,sourceState:'WAIT-W',
    tables:[{sheet:'12A_ML4_Price_Vol_Mix',range:'A209:L234',startColumn:1,columns:['Portafoglio','Nome','Esito','Copertura t0','Copertura t1','Δ ammesso (€)','Quantità · Shapley (€)','Mix · Shapley (€)','Mix · LMDI (€)','Costo unitario · Shapley (€)','Livello','Stato di verifica'],
      headerRow:209,rows:[['AA','Portafoglio sintetico A','parziale (50–80 %)',['0.6',164],['0.7',164],['4',164],['6',164],['1',164],['0.8',164],['-3',164],'Solo descrittivo','V2_IN_ATTESA']],sourceRows:[210],notes:[],numericColumns:[3,4,5,6,7,8,9]}]}]};

test('regional parity: the Regione sees the reviewer\u2019s region-wide analyses; an Azienda sees none of them',()=>{
  // Each analysis in the view of its own source (G2-01/G2-02): the DPC drivers and per-pack costs in «Assistiti e
  // servizio DPC», the File F indices in «File F», the findings and the decomposition in the ledger view.
  const regProps={extension:extensionOf('regione'),pvmSection:PVM_SECTION};
  const r=workspace('regione','',regProps),rt=text(r),rd=view('regione','dpc',regProps),rf=view('regione','filef',regProps);
  assert.ok(text(rd).includes('Perché la spesa DPC per residente differisce fra le ASL?'),'per-resident drivers');
  assert.ok(text(rd).includes('Indici del paniere comune'),'common-basket indices');
  assert.ok(text(rf).includes('Importo unitario sugli stessi prodotti, trimestre per trimestre'),'File F quarterly index');
  assert.doesNotMatch(rt,/per residente differisce|trimestre per trimestre/,'not in the ledger view');
  assert.deepEqual(options(rd,'Azienda dei costi per confezione'),[['asl-1','ASL 1'],['asl-2','ASL 2'],['asl-3','ASL 3'],['asl-4','ASL 4']],'each ASL\u2019s list, never the aggregate');
  assert.ok(rt.includes('Rilievi delle nuove analisi')&&rt.includes('F01 · Rilievo sintetico')&&rt.includes('Azione proposta:'),'the findings, read only');
  assert.ok(rt.includes('Quantità, mix e costo unitario sono scomponibili soltanto nei sottoinsiemi con unità confrontabili.'),'the decision lead names the decomposition');
  // Still none of the reviewer's workflow: no queue, owner, case, workbook route, lineage or modelled budget.
  for(const h of [r,rd,rf]){
    for(const re of REVIEWER_ONLY_REGIONE)assert.doesNotMatch(h,re,String(re));
    assert.doesNotMatch(h,/Avvia la verifica|Apri la verifica|Referente|Non assegnato/);
  }
  // The extension's attribution copy says «non dimostra» (does not prove): NEVER's «dimostra» targets demo wording, so
  // the extension renders are read with the same pattern minus that one word.
  const NEVER_EXT=/NaN|Infinity|undefined|[Dd]emo|[Dd]imostrazion|[Dd]imostrativ|[Vv]erificat/;
  for(const h of [r,rd,rf]){identifiers(h,SERVER.regione.units,'regione with extension');assert.doesNotMatch(h,NEVER_EXT);}
  // The Azienda: its own list only, no selector, no region-wide block, no findings, no decomposition sentence.
  const azProps={extension:extensionOf('azienda4'),pvmSection:PVM_SECTION},a=[workspace('azienda4','',azProps),view('azienda4','dpc',azProps),view('azienda4','filef',azProps)];
  assert.ok(text(a[1]).includes(`Costo per confezione sugli stessi prodotti · ${ORG_NAME}`));
  for(const h of a){
    assert.doesNotMatch(h,/aria-label="Azienda dei costi per confezione"/);
    assert.doesNotMatch(text(h),/per residente differisce|Indici del paniere comune|trimestre per trimestre|Rilievi delle nuove analisi|scomponibili soltanto/);
    for(const re of REVIEWER_ONLY)assert.doesNotMatch(h,re,String(re));
  }
  // An Azienda handed a region-wide block reads «not available», never the block.
  const leaked=view('azienda4','dpc',{extension:{...extensionOf('azienda4'),drivers:extReviewer().drivers}});
  assert.doesNotMatch(text(leaked),/per residente differisce/);assert.ok(text(leaked).includes('non sono disponibili in questo momento'));
});

test('regional parity: the price/quantity/mix panel reads the Regione\u2019s own object; an Azienda keeps the short note',async()=>{
  const view=await portView('regione','aggregato');
  // The view carries the source contract the decomposition is pinned to (the reviewer's fixture values), so the panel
  // must show the reading itself, not an «unavailable» state (review of 24 Oct 2026).
  const pinned={...view,sourceSha256:'ff084e85af09c38df52445019af479397ea8313df79c736c4098c60f7edb8eac',classificationSha256:'e2b3c5900036eec54fc01134d32d0f19bd9341db790916ced99b5152f9ad50aa',
    mappingVersion:'v0.1-2026-10-12',mappingStatus:'draft',attributionBasis:'atc-portfolio-proxy',changeSemantic:'later-minus-earlier',changePeriods:{from:'FY2024',to:'FY2025'},dossier:{...view.dossier,id:'AA',label:'Portafoglio sintetico A'}};
  const closed=under(client('regione'),React.createElement(CPortfolioDossierView,{view:pinned,pvmSection:PVM_SECTION}));
  assert.match(closed,/data-c-secondary="portfolio-details"/);assert.doesNotMatch(closed,/data-c-portfolio-pvm=/);
  // Exercise the unchanged PVM leaf that the secondary disclosure mounts on request.
  const r=under(client('regione'),React.createElement(CPortfolioPriceQuantityMix,{view:pinned,pvmSection:PVM_SECTION}));
  assert.match(r,/<details class="rounded-xl border border-border bg-card" data-c-portfolio-pvm="true"><summary[^>]*>Quantità, mix e costo unitario · evidenza disponibile<\/summary>/);
  assert.doesNotMatch(r,/data-c-portfolio-pvm="withheld"/);
  assert.match(r,/data-c-pvm-status="ready"/);assert.match(r,/data-c-pvm-admitted-change="4"/);
  assert.deepEqual([...r.matchAll(/data-c-pvm-effect="([a-zA-Z]+)" data-value="([^"]+)"/g)].map(m=>[m[1],m[2]]),[['quantity','6'],['mix','1'],['unitCost','-3']]);
  // Another organisation than the aggregate: the decomposition does not apply, and says so.
  const asl=under(client('regione'),React.createElement(CPortfolioPriceQuantityMix,{view:await portView('regione','asl-2'),pvmSection:PVM_SECTION}));
  assert.match(asl,/data-c-pvm-status="unsupported"/);
  // Without its object (unreadable), the panel says the decomposition is not available, never «none exists»; nothing is fetched.
  const none=under(client('regione'),React.createElement(CPortfolioPriceQuantityMix,{view}));
  assert.ok(text(none).includes('La scomposizione non è disponibile in questo momento. Nessun valore viene sostituito.'));
  assert.doesNotMatch(none,/Nessuna scomposizione compatibile/);
  const a=under(client('azienda4'),React.createElement(CPortfolioPriceQuantityMix,{view:await portView('azienda4','aggregato'),pvmSection:PVM_SECTION}));
  assert.match(a,/data-c-portfolio-pvm="withheld"/);assert.doesNotMatch(a,/data-c-pvm-status=/);
});

// ---------------------------------------------------------------- modelled budgets and provenance (owner decision of 24 Oct 2026)
const MODELLED=[{id:'asl-1-m-0001',period:'FY2025',org:'asl-1',channel:'CO',level:'Disciplina',area:'08',basis:'synthetic',budget:'1200.00',actual:'1000.5',alternative:'1100.25'},
  {id:'asl-1-m-0002',period:'FY2025',org:'asl-1',channel:'CO',level:'Disciplina',area:'09',basis:'synthetic',budget:'800.00',actual:'900.5',alternative:'850.25'}];
const PROVENANCE={workbookVersion:'R5',workbookSha256:'f'.repeat(64),evidence:{financial:'a'.repeat(64),budgetCount:'b'.repeat(64)},sections:['spend','change','budget','counts','forecast']};
const MODELLED_SEARCH='c_budget=synthetic&c_budget_org=asl-1&c_budget_channel=CO&c_budget_period=FY2025&c_level=Disciplina';

test('modelled budgets and provenance: the Regione reads them with their own note; an Azienda never',()=>{
  const packet={...packetOf('regione'),budgets:[...packetOf('regione').budgets,...MODELLED]};
  const view=(search,props={})=>bare(React.createElement(PillarCScopedWorkspace,{audience:client('regione'),packet,forecast,provenance:PROVENANCE,...props}),search);
  const opened=view(''),t0=text(opened);
  assert.deepEqual(options(opened,'Fonte del budget'),[['published','Budget pubblicato'],['synthetic','Budget modellato']]);
  assert.match(opened,/<select aria-label="Fonte del budget" class="[^"]*"><option value="published" selected="">/,'opens on the published act');
  assert.ok(t0.includes(AV.C_AUDIENCE_COPY.budgetNote)&&!t0.includes(AV.C_AUDIENCE_COPY.budgetModelledNote));
  const m=view(MODELLED_SEARCH),t=text(m);
  assert.match(m,/<option value="synthetic" selected="">Budget modellato<\/option>/);
  assert.ok(t.includes('Disciplina 08')&&t.includes('Disciplina 09'),'the two modelled areas');
  assert.ok(t.includes(AV.C_AUDIENCE_COPY.budgetModelledNote));assert.ok(!t.includes(AV.C_AUDIENCE_COPY.budgetNote),'the modelled note replaces the O4 note');
  // Provenance: the reviewer's two panels, the receipts and the workbook version, and nothing of the reviewer's workflow.
  assert.ok(t.includes('Fonti e significato delle analisi')&&t.includes('Versione e tracciabilità')&&t.includes(`R5 · ${'f'.repeat(64)}`)&&t.includes(`Spesa: ${'a'.repeat(64)}`));
  for(const re of REVIEWER_ONLY_REGIONE)assert.doesNotMatch(m,re,String(re));
  identifiers(m,SERVER.regione.units,'regione modelled');assert.doesNotMatch(m,NEVER);
  // The «Budget per area» reading card names both sources once the packet holds modelled rows, whichever is selected.
  for(const html of [opened,m])assert.ok(text(html).includes('Budget pubblicati o modellati affiancati alla spesa ripartita con due chiavi.')&&!text(html).includes('Atti di budget pubblicati affiancati'));
  // Its regional object unreadable: an honest state for both, never a value.
  const u=text(bare(React.createElement(PillarCScopedWorkspace,{audience:client('regione'),packet:packetOf('regione'),forecast,regionalReviewUnavailable:true}),MODELLED_SEARCH));
  assert.ok(u.includes(AV.C_AUDIENCE_COPY.budgetModelledUnavailable));assert.ok(u.includes(AV.C_AUDIENCE_COPY.provenanceUnavailable));
  assert.doesNotMatch(u,/Versione e tracciabilità/);
  assert.ok(u.includes('Atti di budget pubblicati affiancati alla spesa ripartita con due chiavi.')&&!u.includes('Budget pubblicati o modellati'),'without modelled rows the card names published acts only');
  // An Azienda: the static published source, no provenance even if handed one, and a modelled row refuses the page.
  const a=workspace('azienda4',MODELLED_SEARCH,{provenance:PROVENANCE}),at_=text(a);
  assert.doesNotMatch(a,/<select aria-label="Fonte del budget"/);assert.ok(at_.includes('Fonte del budget Budget pubblicato'));
  assert.doesNotMatch(at_,/Versione e tracciabilità|Fonti e significato delle analisi|Budget modellato/);
  const leaked={...packetOf('azienda4'),budgets:[...packetOf('azienda4').budgets,{...MODELLED[0],id:'asl-4-m-0001',org:'asl-4'}]};
  assert.equal(bare(React.createElement(PillarCScopedWorkspace,{audience:client('azienda4'),packet:leaked,forecast})),'','a modelled row in an Azienda packet');
  // URL: the Regione's source is written and kept; an Azienda's is dropped.
  const q=new URLSearchParams(AV.cScopedBudgetSearch(client('regione'),packet,`?${MODELLED_SEARCH}`,{area:'08'}));
  assert.equal(q.get('c_budget'),'synthetic');
  assert.equal(new URLSearchParams(AV.cScopedBudgetSearch(client('azienda4'),packetOf('azienda4'),`?${MODELLED_SEARCH}`,{area:'all'})).get('c_budget'),null);
});

// ---------------------------------------------------------------- public comparators (owner clarification of 23 Oct 2026)
const PUB=await at('lib/dashboard-review/pillar-c/public-comparators.ts');
const {C_WORKBOOK_HASH}=await at('lib/dashboard-review/pillar-c/workbook.ts');
const ATTIVITA='a'.repeat(64);
/** Synthetic public object: the eight outputs, one two-column table each, made-up values. */
function publicObject(){
  const outputs=PUB.C_PUBLIC_OUTPUTS.map((id,i)=>({id,title:`Uscita sintetica ${i+1}`,section:'attivita',tier:'Fonte pubblica',qualifier:'sintetico',grain:'unità',ranges:[`S${i}!A1:B4`],availability:'snapshot',reason:null,sourceState:'stato congelato',
    tables:[{sheet:`S${i}`,range:'A1:B4',startColumn:1,columns:['Unità','Valore (€)'],headerRow:1,rows:[['Abruzzo',[`${i+1}.25`,7]],['Italia (21 unità)',['10.5',7]],['MOLISE',null]],sourceRows:[2,3,4],notes:[],numericColumns:[1]}]}));
  return {schema:'pillar-c-regional-public-v1',workbookSha256:C_WORKBOOK_HASH,attivitaSha256:ATTIVITA,formats:{'7':'#,##0.00\ "€"'},outputs};
}
test('public comparators: the closed parser; the Regione reads them beside the forecast',()=>{
  const section=PUB.parseCRegionalPublic(publicObject(),ATTIVITA);
  assert.deepEqual(section.outputs.map(o=>o.id),[...PUB.C_PUBLIC_OUTPUTS]);
  for(const [label,mutate] of [
    ['another attivita hash',o=>{o.attivitaSha256='b'.repeat(64);}],
    ['outputs out of order',o=>{[o.outputs[0],o.outputs[1]]=[o.outputs[1],o.outputs[0]];}],
    ['a ledger tier',o=>{o.outputs[2].tier='Ledger privato — V2 in attesa';}],
    ['an extra output',o=>{o.outputs.push({...o.outputs[0],id:'O-15-03'});}],
    ['an extra key',o=>{o.lineage=[];}],
    ['an unknown cell format',o=>{o.outputs[0].tables[0].rows[0][1]=['1',9];}],
  ]){const o=publicObject();mutate(o);assert.throws(()=>PUB.parseCRegionalPublic(o,ATTIVITA),/PILLAR_C_/,label);}
  // Regione: the panel after the forecast, the eight choices, the first table formatted, missing cells as «—».
  const html=workspace('regione','',{publicSection:section}),t=text(html);
  assert.equal(html.split('data-c-public-comparators="ready"').length-1,1);
  assert.deepEqual(options(html,'Confronto pubblico').map(([v])=>v),[...PUB.C_PUBLIC_OUTPUTS]);
  assert.ok(t.includes('1,25 €')&&t.includes('10,50 €')&&t.includes(PUB.C_PUBLIC_COPY.source)&&t.includes(PUB.C_PUBLIC_NOTES['PUB-04']));
  assert.match(html,/<tr class="font-semibold"><th scope="row"[^>]*>Abruzzo<\/th>/,'the Abruzzo row stands out, the order is the source order');
  assert.ok(html.indexOf('data-c-public-comparators')>html.indexOf('id="previsione"'),'beside the forecast, in section 5');
  assert.doesNotMatch(html,/stato congelato|sintetico/,'the frozen source state and qualifier are never shown');
  assert.doesNotMatch(html,NEVER);
  // Unreadable object: the honest state, no value.
  const u=text(workspace('regione','',{publicUnavailable:true}));
  assert.ok(u.includes(PUB.C_PUBLIC_COPY.unavailable));assert.ok(!u.includes('1,25 €'));
  // An Azienda reads the same outputs as public context (owner decision of 26 Oct 2026, PR25-04): tested below.
});

// ---------------------------------------------------------------- Codex live check A26-01 (26 Oct 2026)
// The DPC recipients card of «Quadro decisionale» stayed on the first unit whatever the «Ambito». Distinct synthetic
// counts per unit, so the card can only show the right one; the labels are the audience's own.
const A26_COUNTS={'asl-1':1100,'asl-2':1200,'asl-3':1300,'asl-4':1400,aggregato:5000};
const counted=v=>({...v,units:v.units.map(u=>({...u,data:{...u.data,january:{...u.data.january,recipients:A26_COUNTS[u.key]}}}))});
const recipientsCard=html=>{
  const m=text(html).match(/Assistiti con erogazioni DPC · (.+?) ([0-9.]+) Flussi riferiti a gennaio 2026(, somma dei conteggi delle ASL)?: un solo mese/);
  assert.ok(m,'the recipients card');return {label:m[1],value:m[2],sum:Boolean(m[3])};
};

test('A26-01: an Azienda’s recipients card follows its own Ambito, own unit to the four-Azienda aggregate',()=>{
  const extension=counted(extensionOf('azienda4'));
  const own=workspace('azienda4','?c_channel=DPC',{extension});
  assert.deepEqual(recipientsCard(own),{label:ORG_NAME,value:'1.400',sum:false});
  const agg=workspace('azienda4','?c_org=aggregato&c_channel=DPC',{extension});
  assert.deepEqual(recipientsCard(agg),{label:'Aggregato delle quattro Aziende',value:'5.000',sum:true});
  assert.ok(text(agg).includes('Aggregato delle quattro Aziende · DPC'),'the accounting card is on the same scope');
  // A peer key in the address is refused by the scope filter: the card stays on the Azienda's own count, never the peer's.
  for(const peer of ['asl-3','PE','regione']){
    const r=workspace('azienda4',`?c_org=${peer}&c_channel=DPC`,{extension});
    assert.deepEqual(recipientsCard(r),{label:ORG_NAME,value:'1.400',sum:false},peer);
    assert.doesNotMatch(text(r),/1\.[123]00\b/,`${peer}: no peer count`);
  }
});

test('A26-01: the Regione’s recipients card follows its Ambito, regional aggregate to ASL 3',()=>{
  const extension=counted(extensionOf('regione'));
  assert.deepEqual(recipientsCard(workspace('regione','?c_channel=DPC',{extension})),{label:'Aggregato regionale',value:'5.000',sum:true});
  assert.deepEqual(recipientsCard(workspace('regione','?c_org=asl-3&c_channel=DPC',{extension})),{label:'ASL 3',value:'1.300',sum:false});
  assert.deepEqual(recipientsCard(workspace('regione','?c_org=asl-1&c_channel=DPC',{extension})),{label:'ASL 1',value:'1.100',sum:false});
});

test('A26-01: the reviewer’s recipients card follows the reviewer’s Ambito keys',()=>{
  const r=extReviewer(),labels={aggregato:'Aggregato delle quattro Aziende','asl-1':'ASL 1','asl-2':'ASL 2','asl-3':'ASL 3','asl-4':'ASL 4'};
  const extension=counted({units:['aggregato','asl-1','asl-2','asl-3','asl-4'].map(k=>({key:k,label:labels[k],data:r.units.find(u=>u.unit===k)})),drivers:r.drivers,baskets:r.baskets,fileFBasket:r.fileFBasket,findings:r.findings});
  const packet=parseCReviewPacket(cReviewV2Fixture());
  const at_=search=>recipientsCard(bare(React.createElement(PillarCAudienceProvider,{audience:C_REVIEWER_CLIENT_AUDIENCE},React.createElement(PillarCAnalyticalWorkspace,{audience:C_REVIEWER_CLIENT_AUDIENCE,packet,extension})),search));
  assert.deepEqual(at_('?c_channel=DPC'),{label:'Aggregato delle quattro Aziende',value:'5.000',sum:true});
  assert.deepEqual(at_('?c_org=PE&c_channel=DPC'),{label:'ASL 3',value:'1.300',sum:false});
  assert.deepEqual(at_('?c_org=TE&c_channel=DPC'),{label:'ASL 4',value:'1.400',sum:false});
});

// ---------------------------------------------------------------- joint feedback 2, G2-01/G2-02: one source at a time
// The ledger counts no people: under «Tutti» or a channel other than DPC the card shows no DPC count (it was read as the
// patients of every channel); the DPC flows and File F open in their own views, each with its own coverage.
test('G2-01: the recipients card shows the DPC count under the DPC channel only; «Tutti» and CO point to the DPC view',()=>{
  const extension=counted(extensionOf('regione'));
  const all=text(workspace('regione','',{extension})),co=text(workspace('regione','?c_channel=CO',{extension}));
  assert.ok(all.includes('Assistiti Solo per la DPC'),'«Tutti»: no count, the DPC view named');
  assert.ok(co.includes('Assistiti · CO Non disponibili'),'CO: not available, never the DPC count');
  for(const t of [all,co])assert.doesNotMatch(t,/Assistiti con erogazioni DPC ·|5\.000/,'no DPC count beside the ledger figures');
});

test('G2-01/G2-02: the source bar opens the ledger, DPC and File F views, keeps only the validated scope and marks the current one',()=>{
  const extension=extensionOf('azienda4');
  const bar=h=>{const i=h.indexOf('<nav id="c-fonte"');assert.ok(i>0,'the source bar');return h.slice(i,h.indexOf('</nav>',i));};
  const links=h=>[...bar(h).matchAll(/<a href="([^"]*)"[^>]*>/g)].map(m=>[m[1].replace(/&amp;/g,'&'),m[0].includes('aria-current="page"')]);
  // The bar sits between the page header and the ledger's section bar.
  const ledger=workspace('azienda4','?c_org=aggregato&c_channel=DD&c_budget_channel=CO',{extension});
  assert.ok(ledger.indexOf('</header><nav aria-label="Punto di partenza"')>0&&ledger.indexOf('<nav id="c-fonte"')<ledger.indexOf('<nav aria-label="Sezioni dell’analisi Pillar C"'));
  // Each link carries the validated «Ambito» and channel and nothing else the address brought in.
  const scope='c_channel=DD&c_org=aggregato&c_port_org=aggregato&c_port_channel=DD';
  assert.deepEqual(links(ledger),[[`?${scope}`,true],[`?${scope}&c_fonte=dpc`,false],[`?${scope}&c_fonte=filef`,false]]);
  const tampered=workspace('azienda4','?c_org=TE&c_budget_org=PE&c_fonte=dpc',{extension});
  assert.deepEqual(links(tampered),[['?',false],['?c_fonte=dpc',true],['?c_fonte=filef',false]],'a key the audience cannot use is never echoed');
  // The DPC view: its own heading, source line and note; no section bar, no ledger frame, no File F.
  const d=view('azienda4','dpc',{extension}),dt=text(d);
  assert.match(d,/<section id="dpc" aria-labelledby="dpc-title"[^>]*data-c-source-view="dpc">/);
  assert.ok(dt.includes(`Flussi DPC riferiti a gennaio 2026 · ${ORG_NAME} e aggregato delle quattro Aziende`));
  assert.match(d,/<details[^>]*data-c-source-note="true"><summary[^>]*>Da dove viene questo dato\?<\/summary>/);
  assert.doesNotMatch(d,/<nav aria-label="Sezioni dell’analisi Pillar C"|<section id="quadro"/);
  assert.doesNotMatch(d.slice(d.indexOf('<section id="dpc"')),/File F/,'the DPC view itself names no File F');
  // The File F view of an Azienda without File F: its own «not received», nothing else of File F, no peer.
  const f=view('azienda4','filef',{extension}),ft=text(f);
  assert.ok(ft.includes(`File F 2025 · non ricevuto per ${ORG_NAME}`));
  assert.ok(ft.includes(`File F: non ricevuto per ${ORG_NAME}. Nessun valore File F viene mostrato né stimato.`));
  assert.doesNotMatch(ft,/Identificativi distinti|Modalità 09|ASL [1-4]/);
  // Without any flow in the page, or when the flows could not be read, the view says so and shows nothing.
  assert.ok(text(workspace('azienda4','?c_fonte=dpc')).includes('Le fonti disponibili per questa vista non includono i flussi DPC. Nessun valore viene mostrato né sostituito.'));
  assert.ok(text(workspace('azienda4','?c_fonte=dpc',{extensionUnavailable:true})).includes('I dati DPC non sono disponibili in questo momento. Nessun valore viene mostrato né sostituito.'));
});

// ---------------------------------------------------------------- PR25-04: what the public measures mean (26 Oct 2026)
const {PillarCPublicComparators}=await at('components/dashboard-review/pillar-c/public-comparators.tsx');
const {cWorkbookLabel}=await at('lib/dashboard-review/pillar-c/workbook.ts');
const publicPanel=(section,initial)=>under(client('regione'),React.createElement(PillarCPublicComparators,{loaded:section,initial}));

test('PR25-04: PUB-07-11 is a context ratio in its title, selector and column, with the published values unchanged',()=>{
  const o=publicObject(),i=PUB.C_PUBLIC_OUTPUTS.indexOf('PUB-07-11');
  // The published heading of the ratio column, as the frozen object carries it (a heading, not a figure).
  o.outputs[i].tables[0].columns=['Unità','Spesa AIFA per ricovero acuto (€)'];
  const section=PUB.parseCRegionalPublic(o,ATTIVITA),html=publicPanel(section,'PUB-07-11'),t=text(html);
  assert.match(html,/<caption class="sr-only">Rapporto di contesto, 2023: spesa per acquisti diretti ÷ ricoveri acuti<\/caption>/);
  assert.match(html,/<option value="PUB-07-11" selected="">Rapporto di contesto, 2023: spesa per acquisti diretti ÷ ricoveri acuti<\/option>/);
  assert.match(html,/<th scope="col"[^>]*>Rapporto di contesto: spesa AIFA ÷ ricoveri acuti \(€\)<\/th>/);
  assert.doesNotMatch(html,/per ricovero acuto|Spesa[^<]*per ricovero/,'never called spending per admission');
  assert.ok(t.includes(`${i+1},25 €`)&&t.includes('10,50 €'),'the values are the published ones');
  assert.ok(t.includes('Non è una spesa né un costo per ricovero, né un valore per persona trattata.'));
  // Every other output keeps its published headings.
  assert.equal(PUB.cPublicColumnLabel('PUB-07-10','Ricoveri acuti, strutture pubbliche'),'Ricoveri acuti, strutture pubbliche');
  assert.equal(PUB.cPublicColumnLabel('PUB-01','Totale (€/res.)'),'Totale (€/res.)');
  for(const id of PUB.C_PUBLIC_OUTPUTS)assert.doesNotMatch(PUB.C_PUBLIC_LABELS[id],/per ricovero/,id);
});

test('PR25-04: the selected output states its source, publication date, provisional status and geography',()=>{
  const section=PUB.parseCRegionalPublic(publicObject(),ATTIVITA);
  for(const id of PUB.C_PUBLIC_OUTPUTS){
    const v=PUB.C_PUBLIC_VINTAGE[id];assert.match(v,/Geografia: /,id);assert.match(v,/(AIFA|Annuario statistico del SSN)/,id);
    const html=publicPanel(section,id);
    assert.equal((html.match(/data-c-public-vintage="/g)||[]).length,1,id);
    assert.ok(text(html).includes(`Fonte e data: ${v}`.replace(/\s+/g,' ')),id);
  }
  // Every output that reads the 2025 AIFA file says it is provisional; no other year is called provisional.
  for(const id of ['PUB-04','PUB-02','PUB-03'])assert.match(PUB.C_PUBLIC_VINTAGE[id],/2025[^.;]*provvisori/,id);
  for(const id of ['PUB-01','PUB-05','PUB-07-10','PUB-07-11','PUB-07-03'])assert.doesNotMatch(PUB.C_PUBLIC_VINTAGE[id],/provvisori/,id);
});

test('PR25-04: change columns show «+» on an increase; a zero or unavailable value carries no sign',()=>{
  const F={'168':'\\+0.0" pp";\\-0.0" pp";0.0" pp"','175':'\\+0.00;\\-0.00;0.00','167':'0.0%','169':'0.0'};
  const s=v=>v.replace(/ /g,' ');
  assert.equal(s(cWorkbookLabel(['2.5',168],F)),'+2,5 pp');assert.equal(s(cWorkbookLabel(['-2.5',168],F)),'-2,5 pp');
  assert.equal(s(cWorkbookLabel(['0.01',168],F)),'0,0 pp','rounds to zero: no sign');
  assert.equal(cWorkbookLabel(['0.5',175],F),'+0,50');assert.equal(cWorkbookLabel(['-0.5',175],F),'-0,50');assert.equal(cWorkbookLabel(['0',175],F),'0,00');
  assert.equal(cWorkbookLabel(['109.4',169],F),'109,4','an index is not a change');
  // «var. annua» (a share format without a declared sign) gets «+» from the public panel, only on that column.
  assert.equal(s(PUB.cPublicCellLabel(['9.4024920121393185E-2',167],F,'Abruzzo: var. annua')),'+9,4 %');
  assert.equal(s(PUB.cPublicCellLabel(['-0.02',167],F,'Italia escl. Abruzzo: var. annua')),'-2,0 %');
  assert.equal(PUB.cPublicCellLabel('n.a. (primo anno)',F,'Abruzzo: var. annua'),'n.a. (primo anno)');
  assert.equal(s(PUB.cPublicCellLabel(['0.094',167],F,'Quota A')),'9,4 %','a share is not a change');
  assert.equal(s(PUB.cPublicCellLabel(['2.5',168],F,'Δ 2024 (pp)')),'+2,5 pp','never a double sign');
});

test('PR25-04: an Azienda reads the public outputs as context, titled and introduced as such, beside the forecast',()=>{
  const section=PUB.parseCRegionalPublic(publicObject(),ATTIVITA);
  const html=workspace('azienda4','',{publicSection:section}),t=text(html);
  assert.equal(html.split('data-c-public-comparators="ready" data-c-public-audience="azienda"').length-1,1);
  assert.ok(t.includes(PUB.C_PUBLIC_COPY.aziendaTitle)&&t.includes(PUB.C_PUBLIC_COPY.aziendaLead));
  assert.doesNotMatch(t,/Confronti pubblici fra Regioni/,'never the Regione’s comparison title');
  assert.ok(t.includes(PUB.C_PUBLIC_COPY.aziendaLead)&&/non si confrontano con gli importi della tua Azienda/.test(t));
  assert.deepEqual(options(html,'Confronto pubblico').map(([v])=>v),[...PUB.C_PUBLIC_OUTPUTS],'the same eight public outputs');
  assert.ok(t.includes('1,25 €')&&t.includes('10,50 €')&&t.includes(PUB.C_PUBLIC_COPY.source));
  assert.ok(html.indexOf('data-c-public-comparators')>html.indexOf('id="previsione"'),'beside the regional forecast, in section 5');
  assert.doesNotMatch(html,/stato congelato|sintetico/);assert.doesNotMatch(html,NEVER);
  // The Regione keeps its comparison title; an unreadable object is «not available» for either audience, with no value.
  assert.match(workspace('regione','',{publicSection:section}),/data-c-public-audience="regione"/);
  const u=text(workspace('azienda4','',{publicUnavailable:true}));
  assert.ok(u.includes(PUB.C_PUBLIC_COPY.unavailable));assert.ok(!u.includes('1,25 €'));
});
