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

registerPillarCStubs({'lib/dashboard-review/pillar-c/scoped-storage.ts':IDENTITY_STUBS['lib/dashboard-review/pillar-c/scoped-storage.ts']},{tsx:true});
// next/link is a CommonJS entry without an exports map: resolve it by its file name (the dossier's Pillar B link).
register('data:text/javascript,'+encodeURIComponent(`export async function resolve(s,c,n){return n(s==='next/link'?'next/link.js':s,c);}`),import.meta.url);
const rootUrl=new URL('..',import.meta.url),root=fileURLToPath(rootUrl);
const req=createRequire(`${root}package.json`),React=req('react'),{renderToStaticMarkup}=req('react-dom/server');
const {SearchParamsContext}=req('next/dist/shared/lib/hooks-client-context.shared-runtime');
const at=p=>import(pathToFileURL(`${root}${p}`).href);
const {PillarCAudienceProvider}=await at('components/dashboard-review/pillar-c/audience-context.tsx');
const {PillarCScopedWorkspace}=await at('components/dashboard-review/pillar-c/scoped-workspace.tsx');
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
const REVIEWER_ONLY_1_2B=[/Atti di budget dipartimentali pubblicati nel pacchetto/,/Nessun atto di budget dipartimentale pubblicato nel pacchetto/,/Aggregato delle quattro Aziende e ASL 1–4/];
const REVIEWER_ONLY=[/id="evidence-workflow"/,/href="#evidence-workflow"/,/coda condivisa|Assegna le verifiche/i,/href="#costi"/,/Versione e tracciabilità/,/Fonti e significato delle analisi/,/Ricevute numeriche/,/Budget modellato/,/Piano modellato/,/data-pillar-c-review="v[12]"/,/\/api\/pillar-c\/workbook/,/id="(composizione|costi|confronti|attivita|tendenze|sensibilita|priorita)"/,/Riservato ai revisori del progetto/,...REVIEWER_ONLY_1_2B];
const NEVER=/NaN|Infinity|undefined|\b[Dd]emo\b|[Dd]imostra|[Vv]erificat/;
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
    ['portfolio-dossier.tsx',/export function PillarCPortfolioDossier\([^)]*\)\{\n  const audience=usePillarCAudience\(\);\n  return audience\?<PortfolioDossier audience=\{audience\} workbook=\{workbook\}\/>:null;\n\}/,/function PortfolioDossier\(\{audience,workbook\}:\{audience:CClientAudience;/],
    ['planning-workspace.tsx',/export function PillarCPlanningWorkspace\(props: CPlanningWorkspaceProps\) \{\n  const audience = usePillarCAudience\(\);\n  return audience \? <PlanningWorkspace \{\.\.\.props\} audience=\{audience\}\/> : null;\n\}/,/function PlanningWorkspace\(\{ publishedActs, evidenceAnchor = false, audience \}: CPlanningWorkspaceProps & \{ audience: CClientAudience \}\)/],
    ['evidence-workflow.tsx',/export function PillarCEvidenceWorkflow\(\)\{\n  const audience=usePillarCAudience\(\);\n  return audience\?\.capabilities\.evidence===true\?<EvidenceWorkflow\/>:null;\n\}/,/function EvidenceWorkflow\(\)\{/],
    ['portfolio-pvm.tsx',/const audience=usePillarCAudience\(\);\n  if\(!audience\)return null;\n  if\(!audience\.capabilities\.pvm\)return <p [^\n]*\{C_AUDIENCE_COPY\.pvm\}<\/p>;\n  return <PriceQuantityMix view=\{view\} workbook=\{workbook\}\/>;/,/function PriceQuantityMix\(/],
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

test('the client audience validator accepts the guarded audiences and the reviewer\'s, and nothing else',()=>{
  for(const k of Object.keys(SERVER))assert.deepEqual(AV.cClientAudience(client(k)),client(k),k);
  assert.equal(AV.cClientAudience(C_REVIEWER_CLIENT_AUDIENCE),C_REVIEWER_CLIENT_AUDIENCE);
  const a=client('azienda4');
  for(const broken of [undefined,null,[],'x',{...a,schema:undefined},{...a,kind:'altro'},{...a,orgs:[]},{...a,orgs:[{key:'asl-4',label:''},a.orgs[1]]},{...a,orgs:[a.orgs[0],a.orgs[0]]},{...a,defaultOrg:'asl-1'},{...a,aggregateKey:'Regione'},
    {...a,monthlyMode:'summed'},{...a,orgs:[{key:'asl-9',label:'X'},a.orgs[1]]},{...a,budgetOrgs:[{key:'aggregato',label:'X'}]},{...a,capabilities:{...a.capabilities,syntheticBudgets:true}},{...a,capabilities:{...a.capabilities,pvm:undefined}},{...a,exportLabel:' '},{...a,scopeLine:null},
    {...C_REVIEWER_CLIENT_AUDIENCE,defaultOrg:'asl-1'}])assert.equal(AV.cClientAudience(broken),null,JSON.stringify(broken)?.slice(0,80));
});

// ---------------------------------------------------------------- Azienda
test('Azienda: own name and the four-Azienda aggregate only, no peer, no reviewer-only section, O4 notes and its export label',()=>{
  for(const search of ['','c_org=aggregato','c_org=aggregato&c_channel=CO&c_period=FY2024&c_comparison=K2&c_trend=cumulative']){
    const h=workspace('azienda4',search),t=text(h);
    assert.match(h,/data-pillar-c-review="scoped-azienda" data-release-state="review_only"/);
    assert.ok(t.includes(`${ORG_NAME} e aggregato delle quattro Aziende · analisi in revisione`),'scope line');
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
    assert.ok(t.includes('Aggregato regionale e ASL 1–4 · analisi in revisione'));
    assert.deepEqual(options(h,'Ambito aziendale'),[['aggregato','Aggregato regionale'],['asl-1','ASL 1'],['asl-2','ASL 2'],['asl-3','ASL 3'],['asl-4','ASL 4']]);
    assert.deepEqual(options(h,'Azienda del budget'),[['asl-1','ASL 1'],['asl-2','ASL 2'],['asl-3','ASL 3'],['asl-4','ASL 4']]);
    identifiers(h,SERVER.regione.units,`regione ?${search}`);
    for(const [,label] of [...h.matchAll(/<option value="[^"]*"[^>]*>([^<]*)<\/option>/g)])assert.doesNotMatch(label,C_PROVINCE_TOKEN,label);
    assert.doesNotMatch(t,/Azienda sintetica|Aggregato delle quattro Aziende/,'no Azienda name and not the Azienda wording');
    for(const r of REVIEWER_ONLY)assert.doesNotMatch(h,r,`${r} ?${search}`);
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
  const nav=h.slice(h.indexOf('<nav aria-label="Sezioni dell’analisi Pillar C"'),h.indexOf('</nav>'));
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
  // Dossier: the PVM is a short note with no fetch and no link; the dossier still offers the attribution analysis.
  const pview=await portView('azienda4','asl-4'),d=under(client('azienda4'),React.createElement(CPortfolioDossierView,{view:pview}));
  assert.match(d,/data-c-portfolio-pvm="withheld">La scomposizione prezzo, quantità e mix resta nella revisione di progetto e non è inclusa in questa vista\.<\/p>/);
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
  assert.equal(f(r,'c_budget=synthetic').filters.budget,'published');
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
test('reviewer: the workspace and every shared view render the markup recorded at 1.2d under the reviewer audience',async()=>{
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
  assert.equal(createHash('sha256').update(out.json).digest('hex'),'f7f4e2c6c224ade5791fa3fc716cf54aee50a95bacdf81c2716e48e8a28de299');
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
