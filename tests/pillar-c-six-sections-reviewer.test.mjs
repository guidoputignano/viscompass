// THE REVIEWER PAGE IN SIX SECTIONS (commit 1.2b of docs/PILLAR_C_SIX_SECTIONS_20261022.md, plan §4.2 tests 1–16
// with the lead's amendments M2, M3, M7, M8, M11, M13, M14 and M15). Server-side renders of the real reviewer workspace
// (react-dom/server, the harness of tests/pillar-c-scoped-ui.test.mjs) with and without the literal workbook index of
// tests/helpers/pillar-c-ui-matrix.mjs, for two addresses, plus renders of the dossier, the attribution, the evidence
// block and the shared review blocks, and source pins on the files 1.2b edits. Synthetic data only: the invented
// packet of tests/fixtures/pillar-c-review.mjs, the invented attribution and portfolio rows of the matrix helper, and
// invented strings. No real figure, organisation name or place appears here.
//
// Every test names, in its leading comment, the regression it catches.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire,register} from 'node:module';
import {readFileSync} from 'node:fs';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {IDENTITY_STUBS,registerPillarCStubs} from './helpers/pillar-c-scoped-stubs.mjs';

registerPillarCStubs({'lib/dashboard-review/pillar-c/scoped-storage.ts':IDENTITY_STUBS['lib/dashboard-review/pillar-c/scoped-storage.ts']},{tsx:true});
// next/link is a CommonJS entry without an exports map: resolve it by its file name (the dossier's Pillar B link).
register('data:text/javascript,'+encodeURIComponent(`export async function resolve(s,c,n){return n(s==='next/link'?'next/link.js':s,c);}`),import.meta.url);
const root=fileURLToPath(new URL('..',import.meta.url));
const req=createRequire(`${root}package.json`),React=req('react'),{renderToStaticMarkup}=req('react-dom/server');
const {SearchParamsContext}=req('next/dist/shared/lib/hooks-client-context.shared-runtime');
const at=p=>import(pathToFileURL(`${root}${p}`).href);
const read=p=>readFileSync(`${root}${p}`,'utf8').replace(/\r\n/g,'\n');
/** The source without its comments, for pins on what the code does rather than on what the comments say. */
const code=p=>read(p).replace(/\/\*[\s\S]*?\*\//g,'').replace(/^[ \t]*\/\/.*$/gm,'');

const {PillarCAnalyticalWorkspace,cReviewerScopeSearch}=await at('components/dashboard-review/pillar-c/analytical-workspace.tsx');
const {CAttributionView,PillarCAttributionAnalysis}=await at('components/dashboard-review/pillar-c/attribution-analysis.tsx');
const {CPortfolioDossierView,PillarCPortfolioDossier}=await at('components/dashboard-review/pillar-c/portfolio-dossier.tsx');
const {PillarCAudienceProvider}=await at('components/dashboard-review/pillar-c/audience-context.tsx');
const {PillarCInsightsPanel,PillarCInsightsProvider}=await at('components/dashboard-review/pillar-c/insight-panels.tsx');
const {CountRows,C_REVIEW_UI}=await at('components/dashboard-review/pillar-c/review-blocks.tsx');
const {PillarCEvidenceSources}=await at('components/dashboard-review/pillar-c/evidence-sources.tsx');
const {C_REVIEWER_CLIENT_AUDIENCE,toClientAudience}=await at('lib/dashboard-review/pillar-c/audience-rules.ts');
const {guardCClientAudience,C_PROVINCE_TOKEN,C_PLACE_NAME,C_NSIS_CODE}=await at('lib/dashboard-review/pillar-c/payload-guard.ts');
const {C_AUDIENCE_COPY}=await at('lib/dashboard-review/pillar-c/audience-view.ts');
const {cForecastDecision}=await at('lib/dashboard-review/pillar-c/forecast-decision.ts');
const {cDecisionAnswer}=await at('lib/dashboard-review/pillar-c/insights.ts');
const {C_FORECAST_LABEL,C_PERIOD_LABELS,cMoneyLabel,cReviewFilters,parseCReviewPacket}=await at('lib/dashboard-review/pillar-c/review.ts');
const {C_ORG_LABELS}=await at('lib/dashboard-review/pillar-c/reviewer-labels.ts');
const {PILLAR_C_SECTIONS}=await at('lib/dashboard-review/pillar-c/section-navigation.ts');
const {C_WORKBOOK_HASH}=await at('lib/dashboard-review/pillar-c/workbook.ts');
const {buildCPortfolioPacket,cPortfolioView}=await at('lib/dashboard-review/pillar-c/portfolio.ts');
const {C_PLANNING_MATCHED}=await at('lib/dashboard-review/pillar-c/planning.ts');
const {cReviewV2Fixture}=await at('tests/fixtures/pillar-c-review.mjs');
const {attributionFixture}=await at('tests/fixtures/pillar-c-attribution.mjs');

const WS='components/dashboard-review/pillar-c/analytical-workspace.tsx';
const ATTR='components/dashboard-review/pillar-c/attribution-analysis.tsx';
const DOSSIER='components/dashboard-review/pillar-c/portfolio-dossier.tsx';
const EVIDENCE='components/dashboard-review/pillar-c/evidence-sources.tsx';
const BLOCKS='components/dashboard-review/pillar-c/review-blocks.tsx';
// The no-break space, built at runtime so this file holds neither the invisible character nor an escape of it.
const NBSP=String.fromCharCode(0xa0);
const eur=cMoneyLabel;
const signed=v=>`${Number(v)>0?'+':''}${eur(v)}`;

// ---------------------------------------------------------------- synthetic data
const packet=parseCReviewPacket(cReviewV2Fixture());
// The literal workbook index of tests/helpers/pillar-c-ui-matrix.mjs (one invented output, section spesa).
const WB={schema:'pillar-c-workbook-index-v1',workbookSha256:C_WORKBOOK_HASH,outputs:[{id:'TEST-1',title:'Invented test only',section:'spesa',tier:'Fonte pubblica',qualifier:'—',grain:'anno',ranges:['Example!A1:C4'],availability:'snapshot',reason:null,sourceState:'review'}],sections:{spesa:{sha256:'4'.repeat(64),bytes:10,outputs:1}}};
// The same index with one more invented output per insight panel, so that every panel mount renders (test 2, M4).
const PANEL_SECTIONS=['spesa','cambiamento','pianificazione','numerosita','previsione','evidenza'];
const WB_PANELS={...WB,outputs:PANEL_SECTIONS.map((section,i)=>({...WB.outputs[0],id:`TEST-${i+1}`,section}))};
// The matrix helper's invented attribution and portfolio views.
const attr=attributionFixture();
const attrView=(period,org,channel)=>({schema:'pillar-c-attribution-view-v1',sourceSha256:attr.sourceSha256,classificationSha256:attr.classificationSha256,mappingVersion:attr.mappingVersion,sourceSnapshot:'3'.repeat(64),portfolios:attr.portfolios,
  scope:attr.scopes.find(s=>s.period===period&&s.org===org&&s.channel===channel),comparison:attr.scopes.find(s=>s.period===C_PLANNING_MATCHED[period]&&s.org===org&&s.channel===channel)??null});
const prow=(key,c,year,state='S2',candidates=['AA'])=>({anno:year,mese:1,asl:'AQ',canale:'CO',prodotto_key:key,atc:'TEST',c,attribution_status:state,candidate_portfolios:candidates});
const ports=[{id:'AA',label:'Area sintetica A',kind:'area_terapeutica'},{id:'BB',label:'Area sintetica B',kind:'area_terapeutica'}];
const portPacket=buildCPortfolioPacket([prow('900000001','8',2024),prow('900000001','10.005',2025),prow('900000002','2',2025,'S3',['AA','BB']),prow('900000003','-0.75',2025,'S3',['AA','BB'])],ports,new Map([['900000001','Prodotto sintetico A']]),'1'.repeat(64),'2'.repeat(64),'fictional');
const portView=id=>cPortfolioView(portPacket,'FY2025','AQ','CO',id,'3'.repeat(64));
// An organisation-scoped audience (synthetic units), for the scoped default renders of test 12.
const REGIONE_SERVER={kind:'regione',orgCode:'130',units:['aggregato','asl-1','asl-2','asl-3','asl-4']};
const regione=guardCClientAudience(toClientAudience(REGIONE_SERVER),REGIONE_SERVER);

// ---------------------------------------------------------------- render harness
const el=React.createElement;
const quiet=f=>{const e=console.error,w=console.warn;console.error=()=>{};console.warn=()=>{};try{return f();}finally{console.error=e;console.warn=w;}};
const withSearch=(node,search='')=>el(SearchParamsContext.Provider,{value:new URLSearchParams(search)},node);
const page=(search='',workbook,p=packet)=>quiet(()=>renderToStaticMarkup(withSearch(el(PillarCAnalyticalWorkspace,{audience:C_REVIEWER_CLIENT_AUDIENCE,packet:p,workbook}),search)));
const under=(audience,node,search='')=>quiet(()=>renderToStaticMarkup(withSearch(el(PillarCAudienceProvider,{audience},node),search)));
const bare=node=>quiet(()=>renderToStaticMarkup(node));

const S0='',S1='c_org=AQ&c_channel=CO&c_port_org=TE&c_port_period=FY2024&c_attr_org=PE&c_attr_period=JM2026';
const RENDERS=[[S0,undefined],[S0,WB],[S1,undefined],[S1,WB]].map(([search,workbook])=>({search,workbook,label:`?${search} ${workbook?'with':'without'} workbook`,html:page(search,workbook)}));

// ---------------------------------------------------------------- markup helpers
const SIX=PILLAR_C_SECTIONS.map(s=>s.id);
const NUMERAL='flex size-9 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/5 text-xs font-semibold text-primary';
const FRAME_H2='text-xl font-semibold tracking-tight focus-visible:outline-2 focus-visible:outline-primary';
const LEAD='mt-1 max-w-4xl text-sm leading-6 text-muted-foreground';
const SCOPE_LINE='mt-1 max-w-4xl text-xs leading-5 text-muted-foreground';
const CROSS='inline-flex min-h-11 items-center text-sm font-medium text-primary underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-primary';
const OVERVIEW_LINK='inline-flex min-h-11 items-center font-medium text-primary underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-primary';
const INSIGHT_SECTIONS=['composizione','costi','confronti','attivita','tendenze','sensibilita','priorita'];
const frameHead=({id,number,label,question})=>`<section id="${id}" aria-labelledby="${id}-title" class="scroll-mt-6 xl:scroll-mt-36"><div class="mb-5 flex items-start gap-3"><span aria-hidden="true" class="${NUMERAL}">${number}</span><div class="min-w-0"><h2 id="${id}-title" tabindex="-1" class="${FRAME_H2}">${label}</h2><p class="${LEAD}">${question}</p>`;
/** The six frames of a render, each from its opening tag to the next frame's (the last to the end). */
function frames(html){
  const starts=PILLAR_C_SECTIONS.map(s=>html.indexOf(frameHead(s)));
  assert.ok(starts.every(i=>i>=0),`every frame heading is present: ${starts}`);
  return Object.fromEntries(SIX.map((id,i)=>[id,html.slice(starts[i],i<5?starts[i+1]:html.length)]));
}
const count=(html,s)=>html.split(s).length-1;
const depth=fragment=>(fragment.match(/<section\b/g)||[]).length-(fragment.match(/<\/section>/g)||[]).length;
/** The ids of every section in a fragment, in document order. */
const sectionIds=html=>[...html.matchAll(/<section\b[^>]*?\sid="([^"]+)"/g)].map(m=>m[1]);
/** The tag that carries id="x", whatever the attribute order (M3: React keeps prop order, the dossier heading renders class before id). */
function tagOf(html,id){
  const i=html.indexOf(` id="${id}"`);
  if(i<0)return null;
  const lt=html.lastIndexOf('<',i);
  assert.ok(!html.slice(lt,i).includes('>'),`id="${id}" sits inside one tag`);
  return html.slice(lt+1).match(/^[a-z0-9]+/)[0];
}
const headingIds=(html,tag)=>[...html.matchAll(new RegExp(`<${tag}\\b[^>]*>`,'g'))].map(m=>(m[0].match(/\sid="([^"]*)"/)||[null,null])[1]);
const anchors=html=>[...html.matchAll(/<a ([^>]*)>([\s\S]*?)<\/a>/g)].map(([,attrs,inner])=>({href:(attrs.match(/href="([^"]*)"/)||[])[1],cls:(attrs.match(/class="([^"]*)"/)||[])[1],label:inner.replace(/<[^>]*>/g,'')}));
/** The options of a select, by aria-label, as [value, label, selected]. */
function options(html,label){
  const m=html.match(new RegExp(`<select[^>]* aria-label="${label}"[^>]*>(.*?)</select>`));
  assert.ok(m,`select «${label}»`);
  return [...m[1].matchAll(/<option value="([^"]*)"( selected="")?>([^<]*)<\/option>/g)].map(x=>[x[1],x[3],Boolean(x[2])]);
}
const selected=(html,label)=>options(html,label).filter(o=>o[2]).map(o=>o[0]);
const selectLabels=html=>[...html.matchAll(/<select\b([^>]*)>/g)].map(m=>(m[1].match(/aria-label="([^"]*)"/)||[])[1]);
const between=(html,from,to)=>{const a=html.indexOf(from),b=html.indexOf(to,a+1);assert.ok(a>=0&&b>a,`«${from}» before «${to}»`);return html.slice(a,b);};
const assertOrder=(html,markers,label)=>{
  let last=-1;
  for(const m of markers){assert.equal(count(html,m),1,`${label}: exactly one «${m.slice(0,80)}»`);const i=html.indexOf(m);assert.ok(i>last,`${label}: «${m.slice(0,80)}» comes after the previous marker`);last=i;}
};
const NEVER=/NaN|Infinity|undefined|\b[Dd]emo\b|[Dd]imostra|[Vv]erificat|in arrivo/;

// ---------------------------------------------------------------- the copy 1.2b introduces (amendments M2, M7, M13, M15)
const M2_NOTE='Organizzazione e canale si scelgono nell’ambito della pagina, nella sezione Quadro decisionale; il periodo scelto qui vale anche per l’attribuzione, lo spazio scenari e il piano di revisione. I raggruppamenti ATC non sono reparti o titolari di budget.';
const OLD_DOSSIER_NOTE='I controlli aggiornano solo questo dossier e il suo piano di revisione. I raggruppamenti ATC non sono reparti o titolari di budget.';
const M7_SCENARIO='Scenario CO con tasso regionale di dimissione 2023 e residenti al 31 dicembre 2024. Dati sintetici: numerosità stimata dai dimessi. Non rappresenta pazienti distinti osservati.';
const ACTS_NONE='Nessun atto di budget dipartimentale pubblicato nel pacchetto di revisione.';
const actsLine=parts=>`Atti di budget dipartimentali pubblicati nel pacchetto: ${parts}.`;
const S2_LABEL='Portafoglio singolo · da mappatura';
const DECISION_LEAD='La spesa osservata e i prodotti che la compongono sono misurabili. I dati disponibili non contano le persone trattate: non possiamo attribuire la variazione a un aumento dei pazienti. Quantità, mix e costo unitario sono scomponibili soltanto nei sottoinsiemi con unità confrontabili.';
const DESTINATARI_EMPTY='Le fonti attualmente disponibili in questa vista non contano le persone trattate e non misurano l’utilizzo. Nessun valore viene mostrato né sostituito.';
const SOURCES=[
  ['Spesa','Importi netti, rettifiche negative e mesi rappresentati nel registro fornito.'],
  ['Raggruppamenti terapeutici','Raggruppamenti terapeutici in bozza, con revisione di dominio distinta dai controlli numerici.'],
  ['Scenario CO',M7_SCENARIO],
  ['Previsione regionale',C_FORECAST_LABEL],
];
const CRITERIA=[
  ['Spesa e variazioni','Importi riportati, rettifiche conservate e confronto fra periodi omogenei. Il ponte descrive contributi contabili.'],
  ['Budget per area','Budget pubblicati o modellati affiancati alla spesa ripartita con due chiavi. Le differenze sono neutrali rispetto alla performance.'],
  ['Scenario CO','Rapporto fra spesa e numerosità stimata, con sensibilità esplicita del denominatore e portafogli non sommabili.'],
  ['Previsione regionale',`Dati pubblici AIFA a livello regionale, non aziendali. Intervalli all’80${NBSP}% e al 95${NBSP}%; totale annuo supplementare; la classe C non è ammessa.`],
];
/** The «Fonti e versione» list of a render as [term, detail] pairs, or null when the list is absent. */
function sourcesOf(html){
  const m=html.match(/<h4 class="text-sm font-semibold">Fonti e versione<\/h4><dl class="mt-3 grid gap-3 text-xs md:grid-cols-2">([\s\S]*?)<\/dl>/);
  return m?[...m[1].matchAll(/<div><dt class="font-semibold">([^<]*)<\/dt><dd class="mt-1 leading-5 text-muted-foreground">([^<]*)<\/dd><\/div>/g)].map(x=>[x[1],x[2]]):null;
}

// ================================================================ 1. frames
// Catches: a frame missing, reordered or nested in another; frameOf mapping a wrong field (label, number or question);
// the page header losing its scope pill or the section bar moving below the frames.
test('1. six frames, in the order of PILLAR_C_SECTIONS, each with its hidden numeral, its h2 and its question; none nested',()=>{
  assert.deepEqual(SIX,['quadro','destinatari','portafogli-attribuzione','fattori','budget-scenari','priorita-evidenza']);
  for(const {label,html} of RENDERS){
    const starts=PILLAR_C_SECTIONS.map(s=>html.indexOf(frameHead(s)));
    for(const [i,s] of PILLAR_C_SECTIONS.entries()){
      assert.equal(count(html,frameHead(s)),1,`${label}: frame ${s.id} once`);
      if(i)assert.ok(starts[i]>starts[i-1],`${label}: ${s.id} after ${SIX[i-1]}`);
    }
    // Siblings, never nested: every section opened inside a frame closes before the next frame opens.
    for(let i=0;i<6;i++)assert.equal(depth(html.slice(starts[i],i<5?starts[i+1]:html.lastIndexOf('</div>'))),0,`${label}: frame ${SIX[i]} is closed before the next one`);
    // The hidden numerals are exactly the frames' 1–6.
    assert.deepEqual([...html.matchAll(new RegExp(`<span aria-hidden="true" class="${NUMERAL}">([^<]*)</span>`,'g'))].map(m=>m[1]),['1','2','3','4','5','6'],label);
    // Only section 3 carries a scope line (c_port_*); every other frame goes straight from the question to its blocks.
    for(const s of PILLAR_C_SECTIONS){
      const after=html.slice(html.indexOf(frameHead(s))+frameHead(s).length);
      if(s.id==='portafogli-attribuzione')assert.match(after,new RegExp(`^<p class="${SCOPE_LINE}">[^<]+</p></div></div><div class="space-y-5">`),label);
      else assert.ok(after.startsWith('</div></div><div class="space-y-5">'),`${label}: ${s.id} has no scope line`);
    }
    // The root opens with the header (with the reviewer scope pill), then the one section bar, then frame 1.
    assert.ok(html.startsWith('<div class="space-y-8 pb-12 xl:[&amp;_[id]]:scroll-mt-36" data-pillar-c-review="v2" data-release-state="review_only"><header '),label);
    assert.equal(count(html,'>Aggregato delle quattro Aziende e ASL 1–4 · revisione di progetto</span></div></header><nav aria-label="Sezioni dell’analisi Pillar C"'),1,`${label}: the scope pill closes the header and the section bar follows`);
    assert.equal(count(html,'<nav aria-label="Sezioni dell’analisi Pillar C"'),1,`${label}: one section bar`);
    assert.ok(html.indexOf('<nav aria-label="Sezioni dell’analisi Pillar C"')<starts[0],label);
    assert.deepEqual(anchors(html.slice(html.indexOf('<nav '),html.indexOf('</nav>'))).map(a=>a.href),SIX.map(id=>`#${id}`),`${label}: the bar links the six frames`);
  }
});

// ================================================================ 2. blocks per frame
// Catches: a block mounted in the wrong frame or order (the attribution before the dossier, composizione or the spesa
// panel left where they were at ac5e058 (M4), the forecast block not last in section 5, the queue before the
// cross-links), an old decision link kept in section 1, anything added to section 2.
test('2. each frame holds its blocks in the recorded order (M4: composizione after the attribution, the spesa panel in section 4)',()=>{
  const CROSS_4=`<a href="#portafogli-attribuzione" class="${CROSS}">Per il portafoglio selezionato → Portafogli e attribuzione</a>`;
  const PARETO=`<a href="#attribuzione" class="${CROSS}">Quali prodotti approfondire per primi? →</a>`;
  const PLAN=`<a href="#piano-revisione" class="${CROSS}">Piano di revisione del portafoglio →</a>`;
  for(const {label,html,search,workbook} of RENDERS){
    const f=frames(html);
    // Section 1: the scope bar, then the decision heading block, then the overview, and nothing else.
    const decision=`<div><p class="text-xs font-medium text-primary">La domanda di gestione</p><h3 id="c-decision-title" class="mt-1 text-lg font-semibold">Più persone trattate o prodotti più costosi?</h3><p class="mt-2 max-w-4xl text-sm leading-6 text-muted-foreground">${DECISION_LEAD}</p></div>`;
    assert.equal(count(f.quadro,'<div class="space-y-5"><section aria-label="Ambito di revisione" class="'),1,`${label}: the scope bar opens section 1`);
    assert.equal(count(f.quadro,`</section>${decision}<div class="rounded-2xl border border-primary/20 bg-card p-5 md:p-6">`),1,`${label}: the decision block between the bar and the overview`);
    assert.ok(f.quadro.endsWith('>Vai a Budget e scenari</a></div></div></div></section>'),`${label}: the overview closes section 1`);
    const filters=cReviewFilters(new URLSearchParams(search)),d=cDecisionAnswer(packet,filters);
    assert.deepEqual([...f.quadro.matchAll(/<div class="rounded-xl bg-secondary\/40 p-4"><p class="text-xs text-muted-foreground">([^<]*)<\/p><p class="mt-2 text-xl font-semibold">([^<]*)<\/p><p class="mt-2 text-xs text-muted-foreground">([^<]*)<\/p><\/div>/g)].map(m=>m.slice(1)),[
      ['Variazione contabile',d.change===null?'Non disponibile':signed(d.change),`${d.scope} · 2024–2025`],
      ['Contributo dei prodotti presenti nei due periodi',d.continuing===null?'Non disponibile':signed(d.continuing),'Contributo alla variazione, non un effetto causale o clinico.'],
      ['Persone trattate osservate','Non disponibili','Gli scenari CO stimano il denominatore; non misurano più persone trattate.'],
    ],`${label}: the three cards keep the values and wording of ac5e058`);
    assert.deepEqual(anchors(f.quadro).map(a=>[a.href,a.label]),[['#previsione','Apri la previsione regionale'],['#portafogli-attribuzione','Vai a Portafogli e attribuzione'],['#fattori','Vai a Fattori di spesa'],['#budget-scenari','Vai a Budget e scenari']],`${label}: the old #attribuzione, #numerosita and #costi links are gone`);
    // Section 2: exactly the status sentence and one link, nothing else.
    assert.equal(f.destinatari,`${frameHead(PILLAR_C_SECTIONS[1])}</div></div><div class="space-y-5"><p role="status" class="rounded-xl bg-secondary/50 p-4 text-sm leading-6 text-muted-foreground">${DESTINATARI_EMPTY}</p><a href="#numerosita" class="${CROSS}">Scenario di numerosità stimata →</a></div></section>`,label);
    // Section 3: the dossier first, then (with the workbook) the attribution, then composizione.
    assert.deepEqual(sectionIds(f['portafogli-attribuzione']).slice(1),workbook?['portafogli','attribuzione','composizione']:['portafogli'],label);
    assert.equal(count(f['portafogli-attribuzione'],'<div class="space-y-5"><section id="portafogli" '),1,`${label}: the dossier opens section 3`);
    // Section 4: spesa, cambiamento, the cross-link, then the workbook sections.
    assert.deepEqual(sectionIds(f.fattori).slice(1),['spesa','cambiamento',...(workbook?['costi','confronti','attivita']:[])],label);
    assert.equal(count(f.fattori,CROSS_4),1,label);
    assert.ok(f.fattori.indexOf(CROSS_4)>f.fattori.indexOf('<section id="cambiamento"'),label);
    assert.equal(depth(between(f.fattori,'<section id="cambiamento"',CROSS_4)),0,`${label}: the cross-link follows the closed cambiamento block`);
    if(workbook)assert.ok(f.fattori.indexOf(CROSS_4)<f.fattori.indexOf('<section id="costi"'),label);
    // Section 5: pianificazione, Spazio scenari, numerosita, (tendenze), and the regional forecast last.
    assert.deepEqual(sectionIds(f['budget-scenari']).slice(1),['pianificazione','scenari','numerosita',...(workbook?['tendenze']:[]),'previsione'],label);
    // Section 6: the cross-links first, then (with the workbook) the two insight sections and the queue, then evidenza.
    assert.equal(count(f['priorita-evidenza'],`<div class="space-y-5"><div class="flex flex-wrap gap-x-4 gap-y-1">${workbook?PARETO:''}${PLAN}</div>`),1,`${label}: the cross-links open section 6 (the Pareto link only with the workbook)`);
    assert.deepEqual(sectionIds(f['priorita-evidenza']).slice(1),[...(workbook?['sensibilita','priorita','evidence-workflow']:[]),'evidenza'],label);
  }
  // M4, every insight panel at its place: rendered with one invented output per panel section, each panel's own markup
  // (rendered alone) occurs once, in this order among the frames and blocks.
  const html=page(S0,WB_PANELS);
  const panel=Object.fromEntries(PANEL_SECTIONS.map(s=>[s,bare(withSearch(el(PillarCInsightsProvider,null,el(PillarCInsightsPanel,{index:WB_PANELS,section:s}))))]));
  for(const s of PANEL_SECTIONS)assert.match(panel[s],/^<article /,`the ${s} panel renders`);
  assertOrder(html,['<section id="quadro"','<section id="destinatari"','<section id="portafogli-attribuzione"','<section id="portafogli"','<section id="attribuzione"','<section id="composizione"',
    '<section id="fattori"','<section id="spesa"',panel.spesa,'<section id="cambiamento"',CROSS_4,panel.cambiamento,'<section id="costi"','<section id="confronti"','<section id="attivita"',
    '<section id="budget-scenari"','<section id="pianificazione"',panel.pianificazione,'<section id="scenari"','<section id="numerosita"',panel.numerosita,'<section id="tendenze"','<section id="previsione"',panel.previsione,
    '<section id="priorita-evidenza"',PLAN,'<section id="sensibilita"','<section id="priorita"','<section id="evidence-workflow"','<section id="evidenza"',panel.evidenza],'panels');
  assert.equal(depth(between(html,'<section id="spesa"',panel.spesa)),0,'the spesa panel follows the closed spesa block');
  assert.equal(depth(between(html,'<section id="pianificazione"',panel.pianificazione)),0,'the pianificazione panel follows its block');
  assert.equal(depth(between(html,'<section id="numerosita"',panel.numerosita)),0,'the numerosita panel follows its block');
  assert.equal(depth(between(html,'<section id="previsione"',panel.previsione)),1,'the previsione panel sits inside the forecast block');
  assert.equal(depth(between(html,'<section id="evidenza"',panel.evidenza)),0,'the evidenza panel follows the evidence block');
});

// ================================================================ 3. number badges
// Catches: an inner Heading rendered without `inner` (numbered h2), the attribution badge «03» kept under pageScope,
// any new badge outside the seven insight sections that keep theirs until 1.2d.
test('3. no number badge except the six hidden frame numerals and, until 1.2d, the seven insight-section badges',()=>{
  for(const {label,html,workbook} of RENDERS){
    const badges=[...html.matchAll(/<span([^>]*)>([^<]*)<\/span>/g)].filter(m=>/\sclass="flex size-9 /.test(m[1]));
    assert.deepEqual(badges.filter(m=>/aria-hidden="true"/.test(m[1])).map(m=>m[2]),['1','2','3','4','5','6'],label);
    const visible=badges.filter(m=>!/aria-hidden="true"/.test(m[1]));
    assert.deepEqual(visible.map(m=>m[2]),workbook?['02','05','06','07','10','12','13']:[],label);
    // Each visible badge opens one of the insight sections, and nothing else.
    assert.deepEqual(visible.map(m=>(html.slice(0,m.index).match(/<section id="([a-z]+)" aria-labelledby="([a-z]+)-title" class="scroll-mt-6 xl:scroll-mt-56"><div class="mb-5 flex items-start gap-3">$/)||[])[1]),workbook?INSIGHT_SECTIONS:[],label);
  }
  const source=code(WS);
  assert.doesNotMatch(source,/\bnumber=/,'no Heading or mount takes a number');
  const headings=[...source.matchAll(/<Heading\b([^>]*)>/g)].map(m=>m[1]);
  assert.deepEqual(headings.map(h=>(h.match(/^ inner id="([a-z]+)" title="/)||[])[1]),['spesa','cambiamento','pianificazione','numerosita','previsione'],'every Heading is an inner one');
});

// ================================================================ 4. headings
// Catches: a block heading left as h2 (the dossier or attribution mounted without pageScope, a Heading without
// `inner`), the decision heading back to h2, an h2 without id, a heading id duplicated.
test('4. the inner blocks are h3; the h2 set is exactly the frames, Spazio scenari and (with the workbook) the queue and the insight sections',()=>{
  const H3=['c-decision-title','portfolio-dossier-title','spesa-title','cambiamento-title','pianificazione-title','numerosita-title','previsione-title','evidenza-title'];
  for(const {label,html,workbook} of RENDERS){
    for(const id of [...H3,...(workbook?['attribuzione-title']:[])]){
      assert.equal(count(html,` id="${id}"`),1,`${label}: ${id} once`);
      assert.equal(tagOf(html,id),'h3',`${label}: ${id} is an h3`);
    }
    if(!workbook)assert.equal(count(html,' id="attribuzione-title"'),0,label);
    assert.deepEqual(headingIds(html,'h2'),['quadro-title','destinatari-title','portafogli-attribuzione-title',...(workbook?['composizione-title']:[]),'fattori-title',...(workbook?['costi-title','confronti-title','attivita-title']:[]),
      'budget-scenari-title','scenari-title',...(workbook?['tendenze-title']:[]),'priorita-evidenza-title',...(workbook?['sensibilita-title','priorita-title','c-evidence-title']:[])],`${label}: the h2 ids, in page order, none without id`);
    assert.deepEqual(headingIds(html,'h3').filter(Boolean),['c-decision-title','portfolio-dossier-title',...(workbook?['attribuzione-title']:[]),'spesa-title','cambiamento-title','pianificazione-title','scenari-outside-title','numerosita-title','previsione-title','evidenza-title'],`${label}: the h3 ids, in page order`);
    assert.equal(count(html,'<h1'),1,label);
  }
});

// ================================================================ 5. old anchors and links
// Catches: an old inner anchor id dropped (a bookmark to #spesa or #evidenza would land nowhere), a link to a target
// that never renders, the dossier losing the `piano-revisione` wrapper the section-6 link targets.
test('5. every old anchor still exists once; every in-page link resolves, except #piano-revisione, rendered after the dossier loads',()=>{
  for(const {label,html,workbook} of RENDERS){
    for(const id of ['portafogli','scenari','spesa','cambiamento','pianificazione','numerosita','previsione','evidenza',...(workbook?['attribuzione','evidence-workflow']:[])])
      assert.equal(count(html,` id="${id}"`),1,`${label}: #${id}`);
    const ids=new Set([...html.matchAll(/\sid="([^"]*)"/g)].map(m=>m[1]));
    const targets=[...new Set([...html.matchAll(/href="#([^"]*)"/g)].map(m=>m[1]))];
    assert.deepEqual(targets.filter(t=>!ids.has(t)),['piano-revisione'],`${label}: the only dangling target`);
    assert.equal(count(html,'href="#attribuzione"'),workbook?1:0,`${label}: the Pareto link only where the attribution renders`);
  }
  assert.equal(count(read(DOSSIER),'<div id="piano-revisione">{plan}</div>'),1,'the dossier wraps its review plan in #piano-revisione');
  const leaf=under(C_REVIEWER_CLIENT_AUDIENCE,el(CPortfolioDossierView,{view:portView('AA')}));
  assert.equal(count(leaf,' id="portfolio-product-detail"'),1,'the product detail anchor stays in the dossier view');
});

// ================================================================ 6. removed strings
// Catches: any removed element coming back (the sixteen-card strip and its select, the purpose navigation, the
// #costi links, the preset buttons and their hint, per-person count wording, the old scope paragraph, the dossier and
// attribution scope selects, the root's workbook-only scroll override).
test('6. the strings and controls 1.2b removes are absent from every reviewer render',()=>{
  const GONE=['Vai alla sezione','Obiettivi distinti dei Pillar B e C','href="#costi"','Celle prodotto','Spesa per paziente','persona nello scenario','Prova ASL 4','Budget pubblicati · ASL 4','Piano modellato',
    'Periodi e misure sono accanto ai grafici','aria-label="Organizzazione del dossier"','aria-label="Canale del dossier"','dell’attribuzione"','Ambito di questa analisi',
    'Questi controlli aggiornano tutte le analisi di attribuzione',OLD_DOSSIER_NOTE,'proxy ATC','Portafoglio singolo · proxy'];
  for(const {label,html} of RENDERS){
    for(const s of GONE)assert.equal(count(html,s),0,`${label}: «${s}»`);
    assert.doesNotMatch(html,NEVER,label);
  }
  assert.equal(count(read(WS),'[&_section[id]]'),0);
  assert.equal(count(read(WS),'PillarPurposeNavigation'),0);
  assert.equal(count(read(WS),'PillarCSectionNavigation'),0);
});

// ================================================================ 7. sticky
// Catches: the scope bar made sticky (D3), a second sticky element, the old workbook-only root override coming back.
test('7. only the section bar is sticky; the root carries the unconditional xl scroll margin',()=>{
  for(const {label,html} of RENDERS){
    const sticky=[...html.matchAll(/<([a-z0-9]+)\b[^>]*\sclass="([^"]*)"/g)].filter(m=>/(^|\s)(xl:)?sticky(\s|$)/.test(m[2]));
    assert.deepEqual(sticky.map(m=>m[1]),['nav'],label);
    assert.match(sticky[0][2],/(^|\s)xl:sticky xl:top-3(\s|$)/,label);
    assert.equal(count(html,'<section aria-label="Ambito di revisione" class="rounded-2xl border border-border bg-card p-5 shadow-sm md:p-6">'),1,`${label}: the scope bar keeps its own classes, no sticky`);
  }
  const source=read(WS);
  assert.equal(count(source,'sticky'),0);
  assert.equal(count(source,'<div className="space-y-8 pb-12 xl:[&_[id]]:scroll-mt-36" data-pillar-c-review='),1);
});

// ================================================================ 8. the page scope bar
// Catches: a write that forgets c_port_* or c_attr_* (sections 1 and 3 would disagree), the defaults written into the
// address, other keys dropped, a second pushState; and (M2) the divergent old link: the bar reads c_org, section 3
// reads c_port_*.
test('8. the scope bar writes c_org, c_channel, c_port_org and c_port_channel together, deletes c_attr_org and c_attr_channel, keeps the rest',()=>{
  const entries=s=>{assert.ok(s===''||s.startsWith('?'));return [...new URLSearchParams(s)].sort((a,b)=>a[0].localeCompare(b[0]));};
  // (a) an organisation: both org keys, no channel key at the default, the attribution keys deleted, the rest kept.
  assert.deepEqual(entries(cReviewerScopeSearch('?c_attr_org=TE&c_attr_channel=DD&c_attr_period=FY2024&c_port_period=JM2026&c_port_id=AA&c_plan_ids=ONC&c_budget_org=CH',{org:'AQ'},'Regione')),
    [['c_attr_period','FY2024'],['c_budget_org','CH'],['c_org','AQ'],['c_plan_ids','ONC'],['c_port_id','AA'],['c_port_org','AQ'],['c_port_period','JM2026']]);
  // (b) a channel: the current organisation is written to c_port_org too.
  assert.deepEqual(entries(cReviewerScopeSearch('?c_org=TE',{channel:'CO'},'Regione')),[['c_channel','CO'],['c_org','TE'],['c_port_channel','CO'],['c_port_org','TE']]);
  // (c) back to the defaults: nothing is left.
  assert.equal(cReviewerScopeSearch('?c_org=AQ&c_channel=DD&c_port_org=AQ&c_port_channel=DD&c_attr_org=PE&c_attr_channel=CO',{org:'Regione',channel:'Tutti'},'Regione'),'');
  // (d) a divergent old link converges on any change: c_port_org takes c_org.
  assert.deepEqual(entries(cReviewerScopeSearch('?c_org=AQ&c_port_org=TE',{channel:'DD'},'Regione')),[['c_channel','DD'],['c_org','AQ'],['c_port_channel','DD'],['c_port_org','AQ']]);
  // The review keys go through cReviewSearch: an invalid c_org reads as the default and is not copied to c_port_org.
  assert.deepEqual(entries(cReviewerScopeSearch('?c_org=asl-4&c_port_org=CH&c_period=FY2024&c_comparison=K2',{channel:'CO'},'Regione')),[['c_channel','CO'],['c_comparison','K2'],['c_period','FY2024'],['c_port_channel','CO']]);
  // The workspace's one writer.
  const source=read(WS);
  const update=source.match(/^ {2}const updateScope = .*$/m)?.[0];
  assert.ok(update,'updateScope is one statement');
  assert.equal(count(update,'window.history.pushState('),1);
  assert.equal(count(update,'cReviewerScopeSearch(window.location.search, patch, audience.defaultOrg)'),1);
  assert.equal(count(source,'window.history.pushState('),3,'updateBudget, update and updateScope, nothing else');
  const bar=source.match(/<PillarCScopeBar [^\n]*?\/>/)?.[0];
  assert.ok(bar,'the bar is mounted');
  assert.equal(count(bar,'onChange={updateScope}'),1);assert.equal(count(bar,'onReset={() => update({}, true)}'),1);
  assert.equal(count(source,'<PillarCScopeBar '),1);
  // In the page: the bar shows c_org and c_channel, section 3 states c_port_*.
  const scopeLine=html=>frames(html)['portafogli-attribuzione'].match(new RegExp(`^${frameHead(PILLAR_C_SECTIONS[2]).replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}<p class="${SCOPE_LINE}">([^<]*)</p>`))?.[1];
  const cases=[
    // [search, bar organisation, bar channel, section-3 scope line, attribution scope]
    ['','Regione','Tutti','Aggregato delle quattro Aziende · Tutti i canali · Anno 2025 · raggruppamenti ATC in bozza','FY2025|Regione|Tutti'],
    [S1,'AQ','CO','ASL 4 · Tutti i canali · Anno 2024 · raggruppamenti ATC in bozza','FY2024|TE|Tutti'],
    ['c_org=AQ&c_channel=CO&c_port_org=AQ&c_port_channel=CO&c_port_period=JM2026','AQ','CO','ASL 1 · CO · Gen–mag 2026 · raggruppamenti ATC in bozza','JM2026|AQ|CO'],
    // M2: an old link with c_org and no c_port_org: the bar shows AQ, section 3 and the attribution the default.
    ['c_org=AQ','AQ','Tutti','Aggregato delle quattro Aziende · Tutti i canali · Anno 2025 · raggruppamenti ATC in bozza','FY2025|Regione|Tutti'],
  ];
  for(const [search,org,channel,line,attrScope] of cases){
    for(const workbook of [undefined,WB]){
      const html=page(search,workbook),label=`?${search} ${workbook?'with':'without'} workbook`;
      assert.deepEqual(options(html,'Ambito aziendale'),[['Regione','Aggregato delle quattro Aziende',org==='Regione'],['AQ','ASL 1',org==='AQ'],['CH','ASL 2',false],['PE','ASL 3',false],['TE','ASL 4',false]],label);
      assert.deepEqual(selected(html,'Canale dell’analisi'),[channel],label);
      assert.equal(scopeLine(html),line,label);
      assert.deepEqual([...html.matchAll(/data-c-attribution-scope="([^"]*)"/g)].map(m=>m[1]),workbook?[attrScope]:[],label);
      assert.equal(count(html,`<span>${C_ORG_LABELS[org]} · ${channel==='Tutti'?'Tutti i canali':channel}. Selezione aggiornata.</span>`),1,`${label}: the bar's status names c_org and c_channel`);
    }
  }
});

// ================================================================ 9. budget availability line
// Catches: the preset buttons back, an amount in the line, the line built from every published row instead of the
// departmental acts (M13: a published Disciplina row must not appear), the plan's shorter wording, a wrong empty text.
test('9. the availability line names Azienda, period and channels of the published departmental acts, never an amount (M13)',()=>{
  const line=html=>{
    const m=[...html.matchAll(/<p class="mb-4 text-xs text-muted-foreground">Ambito del budget: [^<]*<\/p><p class="mb-5 text-xs text-muted-foreground">([^<]*)<\/p>/g)];
    assert.equal(m.length,1,'one line, right after the budget scope sentence');
    return m[0][1];
  };
  const raw=()=>cReviewV2Fixture();
  const withBudgets=extra=>{const r=raw();r.budgets.push(...extra);return parseCReviewPacket(r);};
  const dpcDept={id:'TEST-PUBLISHED-DPC',period:'FY2024',org:'TE',channel:'DPC',level:'Dipartimento',area:'3000',basis:'published',budget:'70',actual:'1',alternative:'2'};
  const dpcDisc={id:'TEST-PUBLISHED-DISC',period:'FY2024',org:'TE',channel:'DPC',level:'Disciplina',area:'08',basis:'published',budget:'30',actual:'1',alternative:'2'};
  const head=`${C_ORG_LABELS.TE} · ${C_PERIOD_LABELS.FY2024}`;
  assert.equal(head,'ASL 4 · Anno 2024');
  const cases=[
    ['fixture',packet,actsLine(`${head} · CO, DD`)],
    ['one more departmental act',withBudgets([dpcDept]),actsLine(`${head} · CO, DD, DPC`)],
    ['a published Disciplina row only adds nothing',withBudgets([dpcDisc]),actsLine(`${head} · CO, DD`)],
    ['no published row',{...packet,budgets:packet.budgets.filter(b=>b.basis!=='published')},ACTS_NONE],
    ['only a published Disciplina row',(()=>{const r=raw();r.budgets=[...r.budgets.filter(b=>b.basis!=='published'),dpcDisc];return parseCReviewPacket(r);})(),ACTS_NONE],
  ];
  for(const [label,p,expected] of cases){
    const html=page(S0,undefined,p),text=line(html);
    assert.equal(text,expected,label);
    assert.doesNotMatch(text,/€|\d+,\d{2}|\d{1,3}(\.\d{3})+/,label);
    for(const b of p.budgets)for(const v of [b.budget,b.actual,b.alternative].filter(v=>v!==null))assert.equal(count(text,eur(v)),0,`${label}: ${v}`);
    // The budget block's only buttons are the order toggle: the preset buttons are gone.
    const block=between(html,'<section id="pianificazione"','<section id="scenari"');
    assert.deepEqual([...block.matchAll(/<button[^>]*>([\s\S]*?)<\/button>/g)].map(m=>m[1].replace(/<[^>]*>/g,'')),['Importo','Differenza'],label);
  }
  for(const {label,html} of RENDERS)assert.equal(line(html),actsLine(`${head} · CO, DD`),label);
});

// ================================================================ 10. attribution follows c_port_*
// Catches: the attribution reading c_attr_* under pageScope (sections 1 and 3 would show different scopes), its
// selects, scope card or «03» badge kept under pageScope, its h2 kept, the scope attribute missing, the tampered note
// shown to the reviewer, and (M1) the unavailable sentence rewritten.
test('10. the attribution reads c_port_* only, has no selects, no badge and an h3, with no prop (1.2c)',()=>{
  const S='c_port_period=FY2024&c_port_org=AQ&c_port_channel=CO&c_attr_period=JM2026&c_attr_org=TE&c_attr_channel=DD';
  const head=scope=>`<section id="attribuzione" aria-labelledby="attribuzione-title" class="scroll-mt-6 space-y-5 xl:scroll-mt-56" data-c-attribution="v1" data-c-attribution-scope="${scope}"><div class="flex items-start gap-3"><div><h3 id="attribuzione-title" class="text-lg font-semibold">Dove è incerta l’attribuzione della spesa?</h3><p class="${LEAD}">Misuriamo importi, prodotti e aree possibili. Un raggruppamento terapeutico non identifica il reparto che ha sostenuto il costo.</p></div></div>`;
  const loading='<div role="status" class="min-w-0 rounded-2xl border border-border bg-card p-5 shadow-sm md:p-6"><p class="text-sm text-muted-foreground">Caricamento dell’ambito selezionato…</p></div></section>';
  const scoped=under(C_REVIEWER_CLIENT_AUDIENCE,el(PillarCAttributionAnalysis),S);
  assert.equal(scoped,head('FY2024|AQ|CO')+loading,'the whole pageScope render: c_port_* scope, h3, no badge, no select, no card, no note');
  // c_attr_* alone is not read under pageScope; an organisation outside the reviewer's keys falls back without a note.
  assert.equal(under(C_REVIEWER_CLIENT_AUDIENCE,el(PillarCAttributionAnalysis),'c_attr_period=JM2026&c_attr_org=TE&c_attr_channel=DD'),head('FY2025|Regione|Tutti')+loading);
  assert.equal(under(C_REVIEWER_CLIENT_AUDIENCE,el(PillarCAttributionAnalysis),'c_port_org=asl-1'),head('FY2025|Regione|Tutti')+loading,'no tampered note for the reviewer');
  // 1.2c (E6): the selects, the scope card, the badge, the h2 and the c_attr_* reading are gone from the source.
  const attrCode=code(ATTR);
  assert.doesNotMatch(attrCode,/pageScope|c_attr|aria-label="(?:Periodo|Organizzazione|Canale) dell’attribuzione"|Ambito di questa analisi|\{number\}|<h2/);
  // M1: the unavailable sentence stays verbatim, one branch, no key and no period prefix.
  const src=read(ATTR);
  assert.equal(count(src,'<p className="text-sm">L’analisi non è disponibile in questo momento. Nessun valore viene sostituito con zero.</p>'),1);
  assert.equal(count(src,'non è disponibile in questo momento'),1);
  assert.equal(count(src,'cAudienceScope(audience,params,"c_port")'),1);
});

// ================================================================ 11. dossier under pageScope
// Catches: the organisation or channel select kept under pageScope, the M2 note reworded or replaced by the plan's
// earlier text, the title left as h2, the period select lost, the dossier reading the bar's c_org or c_channel (or
// any key but c_port_*) instead of the section-3 scope; and the default render changed.
test('11. the dossier keeps only portfolio and period, states the M2 note and has an h3, with no prop (1.2c)',()=>{
  const S='c_port_period=FY2024&c_port_org=AQ&c_port_channel=CO&c_port_id=AA';
  const scoped=under(C_REVIEWER_CLIENT_AUDIENCE,el(PillarCPortfolioDossier),S);
  assert.deepEqual(selectLabels(scoped),['Portafoglio del dossier','Periodo del dossier']);
  assert.deepEqual(options(scoped,'Periodo del dossier').map(o=>[o[0],o[2]]),[['FY2024',true],['FY2025',false],['JM2025',false],['JM2026',false]]);
  assert.equal(count(scoped,'<div class="grid gap-4 sm:grid-cols-2"><label class="text-xs font-medium">Portafoglio<select '),1);
  assert.equal(count(scoped,`<p class="mt-3 text-xs text-muted-foreground">${M2_NOTE}</p>`),1,'the M2 note, typographic apostrophes');
  assert.equal(count(M2_NOTE,'’'),2);assert.equal(count(M2_NOTE,"'"),0);
  assert.equal(count(scoped,OLD_DOSSIER_NOTE),0);
  assert.equal(tagOf(scoped,'portfolio-dossier-title'),'h3');
  assert.equal(count(scoped,'<h3 class="mt-1 text-lg font-semibold" id="portfolio-dossier-title">Un portafoglio, le sue variazioni, il prossimo approfondimento</h3>'),1);
  // 1.2c (E6): the organisation and channel selects, the old note, the h2 and the four-column grid are gone from the source.
  assert.doesNotMatch(code(DOSSIER),/pageScope|aria-label="(Organizzazione|Canale) del dossier"|I controlli aggiornano solo questo dossier|xl:grid-cols-\[1\.5fr_1\.2fr_1fr_1fr\]|<h2|PillarPurposeNavigation/);
  // M2/D1: the dossier reads its whole scope from c_port_*, the keys the section-3 scope line and the attribution read;
  // never the bar's c_org or c_channel, nor c_period or c_attr_*. Its server render is the loading state, so the
  // organisation and channel it fetches never reach the markup: only the source can show which keys it reads.
  const dossierCode=code(DOSSIER);
  assert.equal(count(dossierCode,"const {period,org,channel,tampered}=cAudienceScope(audience,params,'c_port');"),1);
  assert.equal(count(dossierCode,'cAudienceScope('),1,'one scope reading');
  assert.doesNotMatch(dossierCode,/\.get\(\s*['"`]c_(?:org|channel|period|attr_[a-z]+)['"`]\s*\)|cReviewFilters|cReviewSearch/);
  // The workspace mounts both under pageScope, once.
  const ws=read(WS);
  assert.equal(count(ws,'<PillarCPortfolioDossier workbook={workbook} />'),1);
  assert.equal(count(ws,'<PillarCPortfolioDossier'),1);
  assert.equal(count(ws,'<PillarCAttributionAnalysis />'),1);
  assert.equal(count(ws,'<PillarCAttributionAnalysis'),1);
});

// ================================================================ 12. the organisation-scoped page mounts the same shape
// Catches: the scoped page keeping the old dossier or attribution shape (selects, c_attr_*, badge, h2), a scoped reader's
// tampered c_port_org shown without the note, c_attr_* read again, a pageScope prop or branch coming back anywhere.
test('12. the organisation-scoped page mounts the dossier and the attribution in the reviewer’s shape (1.2c)',()=>{
  const S='c_port_org=asl-2&c_port_channel=DD&c_port_period=FY2024&c_attr_org=asl-3&c_attr_period=JM2026&c_attr_channel=CO';
  const dossier=under(regione,el(PillarCPortfolioDossier),S);
  assert.deepEqual(selectLabels(dossier),['Portafoglio del dossier','Periodo del dossier']);
  assert.deepEqual(selected(dossier,'Periodo del dossier'),['FY2024']);
  assert.equal(count(dossier,`<p class="mt-3 text-xs text-muted-foreground">${M2_NOTE}</p>`),1);assert.equal(count(dossier,OLD_DOSSIER_NOTE),0);
  assert.equal(tagOf(dossier,'portfolio-dossier-title'),'h3');
  const attribution=under(regione,el(PillarCAttributionAnalysis),S);
  assert.deepEqual(selectLabels(attribution),[]);
  assert.equal(count(attribution,'data-c-attribution-scope="FY2024|asl-2|DD"'),1,'c_port_*, never c_attr_*');
  assert.equal(count(attribution,'class="flex size-9'),0);
  assert.equal(tagOf(attribution,'attribuzione-title'),'h3');
  // A scoped reader's foreign c_port_org: the note in both blocks; a foreign c_attr_org is not read at all.
  assert.equal(count(under(regione,el(PillarCAttributionAnalysis),'c_port_org=TE'),`<p role="note" class="mt-2 text-xs font-medium">${C_AUDIENCE_COPY.tampered}</p>`),1);
  assert.equal(count(under(regione,el(PillarCPortfolioDossier),'c_port_org=TE'),C_AUDIENCE_COPY.tampered),1);
  assert.equal(count(under(regione,el(PillarCAttributionAnalysis),'c_attr_org=TE'),C_AUDIENCE_COPY.tampered),0);
  const scopedWs=read('components/dashboard-review/pillar-c/scoped-workspace.tsx');
  assert.equal(count(scopedWs,'<PillarCPortfolioDossier />'),1);
  assert.equal(count(scopedWs,'<PillarCAttributionAnalysis />'),1);
  for(const f of ['scoped-workspace.tsx','regional-forecast-workspace.tsx','analytical-workspace.tsx','portfolio-dossier.tsx','attribution-analysis.tsx'])assert.equal(count(read(`components/dashboard-review/pillar-c/${f}`),'pageScope'),0,f);
});

// ================================================================ 13. regional card, comparison and the forecast source row
// Catches: the regional card reading another series or linking elsewhere than #previsione, the card shown without an
// admitted forecast, the comparison text not following c_comparison, and (M8) the «Previsione regionale» source row
// listed when the packet has no forecast.
test('13. the section-1 regional card and comparison; «Previsione regionale» listed as a source only with a forecast (M8)',()=>{
  const d=cForecastDecision(packet.forecast,'TOT');
  assert.ok(d,'the invented forecast admits the total');
  const card=`<div class="mt-5 rounded-xl bg-secondary/50 p-4"><p class="text-xs text-muted-foreground">Previsione regionale 2026 · stima annua indicativa</p><p class="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1"><span class="text-xl font-semibold tabular-nums">${eur(d.annual.total)}</span><span class="text-xs text-muted-foreground">Fascia annua indicativa · 80${NBSP}%</span><span class="text-sm font-medium tabular-nums">${eur(d.annual.low80)} – ${eur(d.annual.high80)}</span></p><p class="mt-1 text-[11px] text-muted-foreground">Riferimento regionale, non budget approvato</p><a href="#previsione" class="mt-3 ${OVERVIEW_LINK}">Apri la previsione regionale</a></div>`;
  for(const {label,html} of RENDERS){
    const f=frames(html);
    assert.equal(count(f.quadro,card),1,label);
    assert.equal(count(html,'Previsione regionale 2026 · stima annua indicativa'),1,label);
    assert.deepEqual(sourcesOf(html),SOURCES,`${label}: the four source rows`);
  }
  // Comparison stated as keyed text; the card detail follows it.
  const k1=frames(page(S0)).quadro,k2=frames(page('c_comparison=K2')).quadro;
  assert.equal(count(k1,'<p class="mt-4 text-xs text-muted-foreground">Confronto: 2024 → 2025</p>'),1);
  assert.equal(count(k2,'<p class="mt-4 text-xs text-muted-foreground">Confronto: Gen–mag 2025 → 2026</p>'),1);
  assert.equal(count(k2,'Confronto: 2024 → 2025'),0);
  assert.equal(count(k2,'<p class="mt-2 text-xs text-muted-foreground">Aggregato delle quattro Aziende · tutti i canali · gen–mag 2025–2026</p>'),1);
  // Without a forecast, or with the total not admitted, the card is absent and nothing stands in for it.
  const rejected={...packet,forecast:{...packet.forecast,admission:packet.forecast.admission.map(a=>a.series==='TOT'?{...a,decision:'RIFIUTATA'}:a)}};
  assert.equal(cForecastDecision(rejected.forecast,'TOT'),null);
  for(const [label,p] of [['no forecast',{...packet,forecast:undefined}],['total not admitted',rejected]])for(const workbook of [undefined,WB]){
    const html=page(S0,workbook,p),q=frames(html).quadro;
    assert.equal(count(q,'Previsione regionale'),0,label);assert.equal(count(q,'href="#previsione"'),0,label);assert.equal(count(q,'bg-secondary/50'),0,label);
    assert.deepEqual(anchors(q).map(a=>a.href),['#portafogli-attribuzione','#fattori','#budget-scenari'],label);
    assert.deepEqual(sourcesOf(html),label==='no forecast'?SOURCES.slice(0,3):SOURCES,`${label}: M8, the source row follows packet.forecast`);
    // The reading criteria keep their four cards (plan §1.4 frame 6): M8 removes only the source row.
    assert.deepEqual([...html.matchAll(/<div><h5 class="text-sm font-semibold">([^<]*)<\/h5><p class="mt-2 text-xs leading-5 text-muted-foreground">([^<]*)<\/p><\/div>/g)].map(m=>[m[1],m[2]]),CRITERIA,label);
  }
});

// ================================================================ 14. copy
// Catches: the count block's shared default left per person, the count panel title not the ratio title, «Celle
// prodotto» back, the S2 legend not M15's «· da mappatura», the dossier tile still «proxy ATC», the «Scenario CO»
// source row without «Dati sintetici» (M7), the PVM loading text back to «verificata» (M9).
test('14. the 1.2b copy: ratio count wording, «Voci prodotto», «Portafoglio singolo · da mappatura» (M15), the tile, «Scenario CO» with «Dati sintetici» (M7)',()=>{
  const rows=[{period:'FY2025',org:'Regione',portfolio:'SINT',spend:'40',persons:'4',perPerson:'10',lowCountCost:'13.3333333333',highCountCost:'8',state:'CALCOLATO'}];
  const plain=bare(el(CountRows,{countRows:rows}));
  assert.equal(plain,bare(el(CountRows,{countRows:rows,labels:C_AUDIENCE_COPY.countsLabels})),'the default labels are the ratio wording');
  assert.doesNotMatch(plain,/persona|paziente/);
  for(const {label,html} of RENDERS){
    const counts=between(html,'<section id="numerosita"','</section>');
    assert.equal(count(counts,`<h3 class="text-base font-semibold">${C_AUDIENCE_COPY.countsTitle}</h3>`),1,label);
    assert.equal(C_AUDIENCE_COPY.countsTitle,'Spesa rapportata alla numerosità stimata · scenario');
    assert.equal(count(counts,`<span>${C_AUDIENCE_COPY.countsLabels.scale}</span>`),1,label);
    assert.doesNotMatch(counts,/persona|paziente/,label);
    const bridge=between(html,'<section id="cambiamento"','</section>');
    assert.equal(count(bridge,'<th scope="col" class="whitespace-nowrap border-b border-border px-2 py-3 font-semibold">Voci prodotto</th>'),1,label);
    assert.equal(count(html,'Celle'),0,label);
    assert.deepEqual(sourcesOf(html).find(([t])=>t==='Scenario CO'),['Scenario CO',M7_SCENARIO],label);
    assert.equal(count(sourcesOf(html).find(([t])=>t==='Scenario CO')[1],'Dati sintetici'),1,`${label}: M7`);
  }
  const legend=under(C_REVIEWER_CLIENT_AUDIENCE,el(CAttributionView,{view:attrView('FY2025','AQ','CO')}));
  assert.equal(count(legend,`${S2_LABEL}</dt>`),1,'the S2 legend');
  assert.doesNotMatch(legend,/Portafoglio singolo · (proxy|derivato)/);
  for(const workbook of [undefined,WB]){
    const dossier=under(C_REVIEWER_CLIENT_AUDIENCE,el(CPortfolioDossierView,{view:portView('AA'),workbook}));
    assert.equal(count(dossier,'<p class="mt-2 text-xs leading-5 text-muted-foreground">Anno 2025 · raggruppamento ATC in bozza · rettifiche incluse</p>'),1,'the tile detail');
    assert.equal(count(dossier,'proxy'),0);
    assert.equal(count(dossier,'href="#costi"'),0,'the dossier no longer links the costi section');
  }
  const pvm=read('components/dashboard-review/pillar-c/portfolio-pvm.tsx');
  assert.equal(count(pvm,'<p role="status" className="text-sm text-muted-foreground">Caricamento della scomposizione…</p>'),1,'M9');
  assert.doesNotMatch(pvm,/verificat|href="#costi"|registro AIFA|convenzione Q/i);
});

// ================================================================ 15. evidence-sources.tsx
// Catches: reader vocabulary or a Pillar C lib import in the shared evidence block, a hook or client directive, an
// invisible no-break space, a bare transition, forbidden wording, a changed export list, the criteria outline flattened
// back to h4 (M11), «Fonti e versione» rendered for an empty list, the children placed outside the article.
test('15. evidence-sources.tsx: presentation only, the criteria as h5 under the h4 (M11), the source list absent when empty',()=>{
  assert.doesNotMatch(read(EVIDENCE),new RegExp(['audi','ence'].join(''),'i'),'the reader-group word in any form, comments included');
  assert.doesNotMatch(read(EVIDENCE),/verificat|\bdemo\b|dimostra|in arrivo/i);
  const src=code(EVIDENCE);
  assert.deepEqual(src.match(/^import .*$/gm),['import type { ReactNode } from "react";','import { cn } from "@/lib/utils";']);
  assert.doesNotMatch(src,/^import [^;]*"@\/lib\/dashboard-review\//m);
  assert.doesNotMatch(src,/"use client"|\buse[A-Z]\w*\(|onClick|onChange|window\.|document\.|fetch\(/);
  assert.equal(count(src,NBSP),0,'no invisible no-break space');
  assert.doesNotMatch(src,/\d %/);
  assert.doesNotMatch(src,C_PROVINCE_TOKEN);assert.doesNotMatch(src,C_PLACE_NAME);assert.doesNotMatch(src,C_NSIS_CODE);
  assert.doesNotMatch(src,/["'`](AQ|CH|PE|TE)["'`]|C_ORG|\.org\b/);
  assert.doesNotMatch(src,new RegExp(['Regi','one'].join('')));
  assert.doesNotMatch(src,/tabIndex=\{[1-9]/);
  assert.doesNotMatch(src,/(?<!motion-safe:|motion-reduce:)\btransition\b/);
  assert.deepEqual(src.match(/^export (?:type|function) \w+/gm),['export type PillarCEvidenceCriterion','export type PillarCEvidenceSource','export type PillarCEvidenceSourcesProps','export function PillarCEvidenceSources']);
  const HEADING='<h3 id={`${id}-title`} className="text-lg font-semibold tracking-tight">';
  assert.equal(count(src,HEADING),1);assert.equal(count(read(BLOCKS),HEADING),1,'the same inner heading as CReviewHeading');
  // M11: one h5 per criterion under the h4 «Come leggere le analisi»; «Fonti e versione» stays h4.
  assert.equal(count(src,'<h4 className="mb-5 text-base font-semibold">Come leggere le analisi</h4>'),1);
  assert.equal(count(src,'<h5 className="text-sm font-semibold">{c.title}</h5>'),1);
  assert.equal(count(src,'<h4 className="text-sm font-semibold">Fonti e versione</h4>'),1);
  assert.equal(count(src,'<h4 className="text-sm font-semibold">{c.title}'),0);
  // Renders with invented criteria, sources and children.
  const criteria=[{title:'Criterio di prova A',text:'Testo di prova A.'},{title:'Criterio di prova B',text:'Testo di prova B.'}];
  const sources=[{term:'Voce di prova',detail:'Dettaglio di prova.'},{term:'Altra voce',detail:'Altro dettaglio.'}];
  const child=el('details',null,el('summary',null,'Dettaglio sintetico'));
  const outline=html=>[...html.matchAll(/<(h[1-6])\b[^>]*>([^<]*)<\/\1>/g)].map(m=>[m[1],m[2]]);
  const full=bare(el(PillarCEvidenceSources,{criteria,sources},child));
  assert.ok(full.startsWith('<section id="evidenza" aria-labelledby="evidenza-title" class="scroll-mt-6 xl:scroll-mt-36"><div class="mb-5"><h3 id="evidenza-title" class="text-lg font-semibold tracking-tight">Fonti e criteri di lettura</h3>'));
  assert.deepEqual(outline(full),[['h3','Fonti e criteri di lettura'],['h4','Come leggere le analisi'],['h5','Criterio di prova A'],['h5','Criterio di prova B'],['h4','Fonti e versione']]);
  assert.deepEqual(sourcesOf(full),sources.map(s=>[s.term,s.detail]));
  assert.ok(full.endsWith('</dl></div><details><summary>Dettaglio sintetico</summary></details></article></section>'),'the children close the article, after the list');
  const empty=bare(el(PillarCEvidenceSources,{criteria,sources:[]},child));
  assert.equal(count(empty,'Fonti e versione'),0);assert.equal(sourcesOf(empty),null);
  assert.deepEqual(outline(empty),[['h3','Fonti e criteri di lettura'],['h4','Come leggere le analisi'],['h5','Criterio di prova A'],['h5','Criterio di prova B']]);
  assert.ok(empty.endsWith('</p></div></div><details><summary>Dettaglio sintetico</summary></details></article></section>'));
  assert.ok(bare(el(PillarCEvidenceSources,{id:'altro',criteria,sources})).startsWith('<section id="altro" aria-labelledby="altro-title" class="scroll-mt-6 xl:scroll-mt-36"><div class="mb-5"><h3 id="altro-title" '));
  // In the page: the reviewer's traceability arrives as children, inside the block.
  for(const {label,html} of RENDERS){
    const block=between(html,'<section id="evidenza"','</article></section>');
    assert.equal(count(block,'<summary class="cursor-pointer py-3 text-sm font-medium">Fonti e significato delle analisi</summary>'),1,label);
    assert.equal(count(block,'<summary class="cursor-pointer py-3 text-sm font-medium">Versione e tracciabilità</summary>'),1,label);
    assert.ok(block.indexOf('Fonti e versione</h4>')<block.indexOf('Fonti e significato delle analisi'),label);
  }
});

// ================================================================ 16. keyboard, 44 px targets and motion
// Catches: a positive tabindex, a new link or select under 44 px (the cross-links, the overview links, the scope bar,
// the workspace's own selects back at h-10, the attribution's queue link back at 40 px), a transition without
// motion-safe in the workspace, and (M14) a summary of the workspace back to a 20 px line.
test('16. no positive tabindex; every new link and the workspace’s own selects are 44 px targets; the workspace summaries have py-3 (M14)',()=>{
  const SELECT_44=C_REVIEW_UI.selectClass.replace(/\bh-10\b/,'h-11');
  assert.notEqual(SELECT_44,C_REVIEW_UI.selectClass,'the shared class is still h-10 (1.4)');
  const OWN=['Periodo della spesa','Azienda del budget','Canale del budget','Periodo del budget','Fonte del budget','Livello del budget','Area del budget','Portafoglio dello scenario'];
  for(const {label,html,workbook} of RENDERS){
    assert.doesNotMatch(html,/tabindex="[1-9]/,label);
    const f=frames(html);
    const links=[...anchors(f.quadro),...anchors(f.destinatari),...anchors(f.fattori).filter(a=>a.href==='#portafogli-attribuzione'),...anchors(f['priorita-evidenza']).filter(a=>a.href==='#attribuzione'||a.href==='#piano-revisione')];
    assert.equal(links.length,workbook?8:7,label);
    for(const a of links)assert.match(a.cls,/(^|\s)min-h-11(\s|$)/,`${label}: ${a.href} «${a.label}»`);
    const bar=between(html,'<section aria-label="Ambito di revisione"','</section>');
    const barSelects=[...bar.matchAll(/<select[^>]* class="([^"]*)"/g)].map(m=>m[1]),barButtons=[...bar.matchAll(/<button type="button" class="([^"]*)"/g)].map(m=>m[1]);
    assert.equal(barSelects.length,2,label);assert.equal(barButtons.length,2,label);
    for(const c of barSelects)assert.match(c,/(^|\s)h-11(\s|$)/,label);
    for(const c of barButtons)assert.match(c,/(^|\s)min-h-11(\s|$)/,label);
    for(const l of OWN){
      const m=html.match(new RegExp(`<select aria-label="${l}" class="([^"]*)"`));
      assert.ok(m,`${label}: «${l}»`);assert.equal(m[1],SELECT_44,`${label}: «${l}» at 44 px`);
    }
  }
  const source=read(WS);
  assert.doesNotMatch(source,/\btransition\b|transition-/);
  assert.equal(count(source,'const selectClass = C_REVIEW_UI.selectClass.replace(/\\bh-10\\b/, "h-11");'),1);
  // M14: every summary of the workspace is a 44 px target; the summary strings stay verbatim (REVIEWER_ONLY matches them).
  const summaries=[...source.matchAll(/<summary className="([^"]*)">([^<]*)<\/summary>/g)];
  assert.equal(count(source,'<summary'),2);
  assert.deepEqual(summaries.map(m=>m[2]),['Fonti e significato delle analisi','Versione e tracciabilità']);
  for(const [,cls] of summaries)assert.match(cls,/(^|\s)(py-3|min-h-11)(\s|$)/);
  assert.deepEqual(summaries.map(m=>m[1]),['cursor-pointer py-3 text-sm font-medium','cursor-pointer py-3 text-sm font-medium']);
  // The attribution's reviewer-only queue link, reworded in 1.2b, is a 44 px target too. It renders at the queue's fixed
  // priority scope (Anno 2025, the four Aziende, every channel) for an audience with the evidence capability.
  const queue=anchors(under(C_REVIEWER_CLIENT_AUDIENCE,el(CAttributionView,{view:attrView('FY2025','Regione','Tutti')}))).filter(a=>a.href==='#evidence-workflow');
  assert.equal(queue.length,1);
  assert.match(queue[0].label,/^Assegna le verifiche nella coda condivisa · priorità fissa/);
  assert.match(queue[0].cls,/(^|\s)min-h-11(\s|$)/);
});
