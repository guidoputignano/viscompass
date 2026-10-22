// THE SIX SECTIONS FOR EVERY READER (commit 1.2c of docs/PILLAR_C_SIX_SECTIONS_20261022.md, §5.2 row 1.2c, §6 and §7).
// Server-side renders of the real workspaces for the four readers of /dashboard-review/pillar-c: the project reviewer
// (analytical-workspace.tsx), an Azienda and the Regione (scoped-workspace.tsx) and a member who receives only the
// public regional forecast (regional-forecast-workspace.tsx), with the harness of tests/pillar-c-scoped-ui.test.mjs.
// Synthetic data only: the invented bucket of tests/fixtures/pillar-c-six-sections.mjs (a null, a zero and a negative
// month), the invented reviewer packet and forecast of tests/fixtures/pillar-c-review.mjs. No real figure, organisation
// name, place or province key appears here. The reviewer's own blocks are pinned by pillar-c-six-sections-reviewer.
//
// Every test names, in its leading comment, the regression it catches. Chart rework (1.3) and responsive measurements
// (1.4) are not tested here: the chart test pins only today's pairing of each chart with its exact values.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire,register} from 'node:module';
import {readFileSync} from 'node:fs';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {IDENTITY_STUBS,registerPillarCStubs} from './helpers/pillar-c-scoped-stubs.mjs';
import {SENTINEL} from './fixtures/pillar-c-scoped.mjs';
import {sixSectionsReviews,EDGE_UNIT,EDGE_MONTHS} from './fixtures/pillar-c-six-sections.mjs';
import {cReviewV2Fixture} from './fixtures/pillar-c-review.mjs';

registerPillarCStubs({'lib/dashboard-review/pillar-c/scoped-storage.ts':IDENTITY_STUBS['lib/dashboard-review/pillar-c/scoped-storage.ts']},{tsx:true});
// next/link is a CommonJS entry without an exports map: resolve it by its file name.
register('data:text/javascript,'+encodeURIComponent(`export async function resolve(s,c,n){return n(s==='next/link'?'next/link.js':s,c);}`),import.meta.url);
const root=fileURLToPath(new URL('..',import.meta.url));
const req=createRequire(`${root}package.json`),React=req('react'),{renderToStaticMarkup}=req('react-dom/server');
const {SearchParamsContext}=req('next/dist/shared/lib/hooks-client-context.shared-runtime');
// The regional workspace calls useRouter(): without an app-router context the render throws.
const {AppRouterContext}=req('next/dist/shared/lib/app-router-context.shared-runtime');
const at=p=>import(pathToFileURL(`${root}${p}`).href);
const read=p=>readFileSync(`${root}${p}`,'utf8').replace(/\r\n/g,'\n');
/** The source without its comments, for pins on what the code does. */
const code=p=>read(p).replace(/\/\*[\s\S]*?\*\//g,'').replace(/^[ \t]*\/\/.*$/gm,'');

const {PillarCScopedWorkspace,cScopedPageScopeSearch}=await at('components/dashboard-review/pillar-c/scoped-workspace.tsx');
const {PillarCRegionalForecastWorkspace}=await at('components/dashboard-review/pillar-c/regional-forecast-workspace.tsx');
const {PillarCAnalyticalWorkspace}=await at('components/dashboard-review/pillar-c/analytical-workspace.tsx');
const {C_REVIEW_UI}=await at('components/dashboard-review/pillar-c/review-blocks.tsx');
const {C_REVIEWER_CLIENT_AUDIENCE,toClientAudience}=await at('lib/dashboard-review/pillar-c/audience-rules.ts');
const {guardCClientAudience,guardCScopedPayload,C_PROVINCE_TOKEN,C_PLACE_NAME}=await at('lib/dashboard-review/pillar-c/payload-guard.ts');
const {mergeCScopedReview,parseCScopedReviewFile}=await at('lib/dashboard-review/pillar-c/scoped-review.ts');
const {C_AUDIENCE_COPY,cScopedDecision,cScopedReviewFilters}=await at('lib/dashboard-review/pillar-c/audience-view.ts');
const {cForecastDecision}=await at('lib/dashboard-review/pillar-c/forecast-decision.ts');
const {C_FORECAST_LABEL,cMoneyLabel,parseCReviewPacket}=await at('lib/dashboard-review/pillar-c/review.ts');
const {PILLAR_C_SECTIONS}=await at('lib/dashboard-review/pillar-c/section-navigation.ts');
const {C_PLANNING_LABELS}=await at('lib/dashboard-review/pillar-c/planning.ts');

const SCOPED='components/dashboard-review/pillar-c/scoped-workspace.tsx';
const REGIONAL='components/dashboard-review/pillar-c/regional-forecast-workspace.tsx';
// The no-break space, built at runtime so this file holds neither the invisible character nor an escape of it.
const NBSP=String.fromCharCode(0xa0);
const eur=cMoneyLabel;
const signed=v=>`${Number(v)>0?'+':''}${eur(v)}`;

// ---------------------------------------------------------------- synthetic readers and data
const ORG_NAME='Azienda sintetica Quattro';
const SERVER={
  azienda4:{kind:'azienda',orgCode:'204',orgName:ORG_NAME,unit:'asl-4',units:['asl-4','aggregato']},
  regione:{kind:'regione',orgCode:'130',units:['aggregato','asl-1','asl-2','asl-3','asl-4']},
};
const reviews=sixSectionsReviews();
const client=k=>guardCClientAudience(toClientAudience(SERVER[k]),SERVER[k]);
const packetOf=k=>{const units=[...SERVER[k].units];return guardCScopedPayload('review',mergeCScopedReview(units,units.map(u=>parseCScopedReviewFile(reviews[u],u))),units);};
const reviewerPacket=parseCReviewPacket(cReviewV2Fixture());
const forecast=reviewerPacket.forecast;

// ---------------------------------------------------------------- render harness
const el=React.createElement;
const quiet=f=>{const e=console.error,w=console.warn;console.error=()=>{};console.warn=()=>{};try{return f();}finally{console.error=e;console.warn=w;}};
const withSearch=(node,search='')=>el(SearchParamsContext.Provider,{value:new URLSearchParams(search)},node);
const router={back(){},forward(){},refresh(){},hmrRefresh(){},push(){},replace(){},prefetch(){}};
const scoped=(k,search='',f=forecast)=>quiet(()=>renderToStaticMarkup(withSearch(el(PillarCScopedWorkspace,{audience:client(k),packet:packetOf(k),forecast:f}),search)));
const reviewer=(search='')=>quiet(()=>renderToStaticMarkup(withSearch(el(PillarCAnalyticalWorkspace,{audience:C_REVIEWER_CLIENT_AUDIENCE,packet:reviewerPacket}),search)));
const forecastOnly=(search='')=>quiet(()=>renderToStaticMarkup(withSearch(el(AppRouterContext.Provider,{value:router},el(PillarCRegionalForecastWorkspace,{forecast})),search)));

const SCOPED_RENDERS=[['azienda4',''],['azienda4','c_org=aggregato&c_channel=CO&c_comparison=K2'],['azienda4','c_org=TE'],['regione',''],['regione','c_org=asl-2&c_channel=DD'],['regione','c_budget_org=asl-1&c_budget_channel=DD']]
  .flatMap(([k,search])=>[forecast,null].map(f=>({k,search,forecast:f,label:`${k} ?${search} ${f?'with':'without'} forecast`,html:scoped(k,search,f)})));
const REGIONAL_RENDERS=['','c_forecast_series=A','c_forecast_series=H&c_org=asl-1&c_port_org=asl-2'].map(search=>({search,label:`forecast_only ?${search}`,html:forecastOnly(search)}));
const REVIEWER_HTML=reviewer('');

// ---------------------------------------------------------------- markup helpers
const IDS=PILLAR_C_SECTIONS.map(s=>s.id);
const NUMERAL='flex size-9 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/5 text-xs font-semibold text-primary';
const FRAME_H2='text-xl font-semibold tracking-tight focus-visible:outline-2 focus-visible:outline-primary';
const LEAD='mt-1 max-w-4xl text-sm leading-6 text-muted-foreground';
const SCOPE_LINE='mt-1 max-w-4xl text-xs leading-5 text-muted-foreground';
const CROSS='inline-flex min-h-11 items-center text-sm font-medium text-primary underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-primary';
const STATUS_P='<p role="status" class="rounded-xl bg-secondary/50 p-4 text-sm leading-6 text-muted-foreground">';
const frameHead=({id,number,label,question})=>`<section id="${id}" aria-labelledby="${id}-title" class="scroll-mt-6 xl:scroll-mt-36"><div class="mb-5 flex items-start gap-3"><span aria-hidden="true" class="${NUMERAL}">${number}</span><div class="min-w-0"><h2 id="${id}-title" tabindex="-1" class="${FRAME_H2}">${label}</h2><p class="${LEAD}">${question}</p>`;
function frames(html){
  const starts=PILLAR_C_SECTIONS.map(s=>html.indexOf(frameHead(s)));
  assert.ok(starts.every(i=>i>=0),`every frame heading is present: ${starts}`);
  return Object.fromEntries(IDS.map((id,i)=>[id,html.slice(starts[i],i<5?starts[i+1]:html.length)]));
}
const count=(html,s)=>html.split(s).length-1;
const depth=fragment=>(fragment.match(/<section\b/g)||[]).length-(fragment.match(/<\/section>/g)||[]).length;
const sectionIds=html=>[...html.matchAll(/<section\b[^>]*?\sid="([^"]+)"/g)].map(m=>m[1]);
const headingIds=(html,tag)=>[...html.matchAll(new RegExp(`<${tag}\\b[^>]*>`,'g'))].map(m=>(m[0].match(/\sid="([^"]*)"/)||[null,null])[1]);
const anchors=html=>[...html.matchAll(/<a ([^>]*)>([\s\S]*?)<\/a>/g)].map(([,attrs,inner])=>({href:(attrs.match(/href="([^"]*)"/)||[])[1],cls:(attrs.match(/class="([^"]*)"/)||[])[1],current:(attrs.match(/aria-current="([^"]*)"/)||[])[1]??null,label:inner.replace(/<[^>]*>/g,'')}));
/** The in-page link targets (href="#…") with no element of that id in the same render. */
const unresolved=html=>{const ids=new Set([...html.matchAll(/\sid="([^"]*)"/g)].map(m=>m[1]));return [...new Set([...html.matchAll(/href="#([^"]*)"/g)].map(m=>m[1]))].filter(t=>!ids.has(t));};
function options(html,label){
  const m=html.match(new RegExp(`<select[^>]* aria-label="${label}"[^>]*>(.*?)</select>`));
  assert.ok(m,`select «${label}»`);
  return [...m[1].matchAll(/<option value="([^"]*)"( selected="")?>([^<]*)<\/option>/g)].map(x=>[x[1],x[3],Boolean(x[2])]);
}
const between=(html,from,to)=>{const a=html.indexOf(from),b=html.indexOf(to,a+1);assert.ok(a>=0&&b>a,`«${from}» before «${to}»`);return html.slice(a,b);};
const decode=s=>s.replace(/&#x27;/g,"'").replace(/&quot;/g,'"').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&');
const textNodes=html=>html.split(/<[^>]*>/).map(t=>decode(t).trim()).filter(Boolean);
const text=html=>textNodes(html).join(' ');
const NEVER=/NaN|Infinity|undefined|\b[Dd]emo\b|[Dd]imostra|[Vv]erificat|in arrivo/;
// tests/pillar-c-scoped-ui.test.mjs REVIEWER_ONLY, verbatim (a leak check is never loosened).
const REVIEWER_ONLY=[/id="evidence-workflow"/,/href="#evidence-workflow"/,/coda condivisa|Assegna le verifiche/i,/href="#costi"/,/Versione e tracciabilità/,/Fonti e significato delle analisi/,/Ricevute numeriche/,/Budget modellato/,/Piano modellato/,/data-pillar-c-review="v[12]"/,/\/api\/pillar-c\/workbook/,/id="(composizione|costi|confronti|attivita|tendenze|sensibilita|priorita)"/,/Riservato ai revisori del progetto/,
  /Atti di budget dipartimentali pubblicati nel pacchetto/,/Nessun atto di budget dipartimentale pubblicato nel pacchetto/,/Aggregato delle quattro Aziende e ASL 1–4/];
const IDENT=/\s(value|href|id|for|name|download|aria-controls|aria-describedby|aria-labelledby|data-[a-z0-9-]+)="([^"]*)"/g;
function identifiers(html,units,label){
  for(const [,attr,value] of html.matchAll(IDENT)){
    assert.doesNotMatch(value,C_PROVINCE_TOKEN,`${label}: ${attr}="${value}"`);
    assert.doesNotMatch(value,C_PLACE_NAME,`${label}: ${attr}="${value}"`);
    assert.doesNotMatch(value,/13020[1-4]/,`${label}: ${attr}="${value}"`);
    assert.notEqual(value,'Regione',`${label}: ${attr}`);
    for(const m of value.matchAll(/(?:^|[^A-Za-z0-9])(asl-\d+|aggregato)(?=$|[^A-Za-z0-9])/g))assert.ok(units.includes(m[1]),`${label}: foreign unit ${m[1]} in ${attr}`);
  }
}
const INTERNAL_CODE=/\b(?:O-\d{2}-\d{2}|PC-\d{2}|PUB-\d{2}|ML-\d|SG-\d|T\d{2}|B-[CEXN]|S[1-5])\b/;

// ---------------------------------------------------------------- the copy 1.2c pins
const SCOPED_LEAD='La spesa osservata e i prodotti che la compongono sono misurabili. I dati disponibili non contano le persone trattate: non possiamo attribuire la variazione a un aumento dei pazienti.';
const DESTINATARI_EMPTY='Le fonti attualmente disponibili in questa vista non contano le persone trattate e non misurano l’utilizzo. Nessun valore viene mostrato né sostituito.';
// The forecast_only sentence speaks about the page, never about the organisation (lead amendment K1).
const FORECAST_ONLY_SENTENCE='Quadro decisionale, Destinatari e utilizzo, Portafogli e attribuzione, Fattori di spesa e Priorità ed evidenza non sono disponibili in questa pagina; in Budget e scenari è disponibile solo la previsione regionale. Nessun valore viene sostituito.';
const UNAVAILABLE_ENTRY=', sezione non disponibile in questa pagina';
const M2_NOTE='Organizzazione e canale si scelgono nell’ambito della pagina, nella sezione Quadro decisionale; il periodo scelto qui vale anche per l’attribuzione, lo spazio scenari e il piano di revisione. I raggruppamenti ATC non sono reparti o titolari di budget.';
// The count scenario's lead (section 5); the «Scenario CO» row of «Fonti e versione» repeats it verbatim (K7).
const NUMEROSITA_LEAD='Scenario CO con tasso regionale di dimissione 2023 e residenti al 31 dicembre 2024. Non rappresenta pazienti distinti osservati.';
// Spazio scenari's link back to the dossier, registered in lib/dashboard-review/pillar-c/planning.ts (Codex-owned). From
// 1.2c no reader's dossier has organisation or channel selects; Codex rewords it before release (design §8 request 6, K3).
const DOSSIER_SCOPE='Cambia periodo, organizzazione o canale nel dossier';
const SCOPED_CRITERIA=[
  ['Spesa e variazioni','Importi riportati, rettifiche conservate e confronto fra periodi omogenei. Il ponte descrive contributi contabili.'],
  ['Budget per area','Atti di budget pubblicati affiancati alla spesa ripartita con due chiavi. Le differenze sono neutrali rispetto alla performance.'],
  ['Scenario CO','Rapporto fra spesa e numerosità stimata, con sensibilità esplicita del denominatore e portafogli non sommabili.'],
  ['Previsione regionale',`Dati pubblici AIFA a livello regionale, non aziendali. Intervalli all’80${NBSP}% e al 95${NBSP}%; totale annuo supplementare; la classe C non è ammessa.`],
];
const SCOPED_SOURCES=[
  ['Spesa','Importi netti, rettifiche negative e mesi rappresentati nel registro fornito.'],
  ['Raggruppamenti terapeutici','Raggruppamenti terapeutici in bozza, con revisione di dominio distinta dai controlli numerici.'],
  ['Scenario CO',NUMEROSITA_LEAD],
  ['Previsione regionale',C_FORECAST_LABEL],
];
function sourcesOf(html){
  const m=html.match(/<h4 class="text-sm font-semibold">Fonti e versione<\/h4><dl class="mt-3 grid gap-3 text-xs md:grid-cols-2">([\s\S]*?)<\/dl>/);
  return m?[...m[1].matchAll(/<div><dt class="font-semibold">([^<]*)<\/dt><dd class="mt-1 leading-5 text-muted-foreground">([^<]*)<\/dd><\/div>/g)].map(x=>[x[1],x[2]]):null;
}

// ================================================================ 1. one page for every reader
// Catches: a reader given another order, another set of sections or another bar; a frame missing, renamed, nested or
// carrying a scope line it should not; the six section ids missing for a reader who receives the six sections.
test('1. reviewer, Azienda and Regione: the same six frames in the same order and the same section bar; forecast_only: the same bar order with section 5 only',()=>{
  const navOf=html=>html.slice(html.indexOf('<nav aria-label="Sezioni dell’analisi Pillar C"'),html.indexOf('</nav>')+6);
  const reviewerNav=navOf(REVIEWER_HTML);
  for(const {label,html} of [{label:'reviewer',html:REVIEWER_HTML},...SCOPED_RENDERS]){
    const starts=PILLAR_C_SECTIONS.map(s=>html.indexOf(frameHead(s)));
    for(const [i,s] of PILLAR_C_SECTIONS.entries()){
      assert.equal(count(html,frameHead(s)),1,`${label}: frame ${s.id} once`);
      if(i)assert.ok(starts[i]>starts[i-1],`${label}: ${s.id} after ${IDS[i-1]}`);
      assert.equal(depth(html.slice(starts[i],i<5?starts[i+1]:html.lastIndexOf('</div>'))),0,`${label}: frame ${s.id} closes before the next`);
    }
    assert.deepEqual([...html.matchAll(new RegExp(`<span aria-hidden="true" class="${NUMERAL}">([^<]*)</span>`,'g'))].map(m=>m[1]),['1','2','3','4','5','6'],label);
    assert.equal(count(html,'<nav aria-label="Sezioni dell’analisi Pillar C"'),1,label);
    assert.ok(html.indexOf('</header><nav aria-label="Sezioni dell’analisi Pillar C"')>0&&html.indexOf('<nav ')<starts[0],`${label}: header, then the bar, then frame 1`);
    assert.equal(navOf(html),reviewerNav,`${label}: the bar is the reviewer's, byte for byte`);
    for(const s of PILLAR_C_SECTIONS){
      const after=html.slice(html.indexOf(frameHead(s))+frameHead(s).length);
      if(s.id==='portafogli-attribuzione')assert.match(after,new RegExp(`^<p class="${SCOPE_LINE}">[^<]+</p></div></div><div class="space-y-5">`),label);
      else assert.ok(after.startsWith('</div></div><div class="space-y-5">'),`${label}: ${s.id} has no scope line`);
    }
  }
  for(const {k,label,html} of SCOPED_RENDERS)assert.ok(html.startsWith(`<div class="space-y-8 pb-12 xl:[&amp;_[id]]:scroll-mt-36" data-pillar-c-review="scoped-${k==='regione'?'regione':'azienda'}" data-release-state="review_only"><header `),label);
  for(const {label,html} of REGIONAL_RENDERS){
    assert.ok(html.startsWith('<div class="space-y-8 pb-12 xl:[&amp;_[id]]:scroll-mt-36" data-pillar-c-forecast="signed_in"><header '),label);
    assert.deepEqual(sectionIds(html),['budget-scenari','previsione'],`${label}: section 5 and its forecast block only`);
    assert.equal(count(html,frameHead(PILLAR_C_SECTIONS[4])),1,label);
    for(const s of PILLAR_C_SECTIONS.filter(s=>s.id!=='budget-scenari'))assert.equal(count(html,` id="${s.id}"`),0,`${label}: no ${s.id}`);
    // The bar keeps the six entries in order: one link, five plain entries.
    const nav=navOf(html),entries=[...nav.matchAll(/<(a|span) [^>]*class="[^"]*min-h-11[^"]*"[^>]*>/g)].map(m=>m[1]);
    assert.deepEqual(entries,['span','span','span','span','a','span'],label);
    assert.deepEqual(textNodes(nav).filter(t=>!/^\d$/.test(t)&&t!==UNAVAILABLE_ENTRY),PILLAR_C_SECTIONS.map(s=>s.label),label);
  }
});

// ================================================================ 2. blocks per frame, organisation-scoped pages
// Catches: a block in the wrong section or order, the old decision links or the old «Ambito» paragraph back, the
// regional card shown without a forecast or as a placeholder, the attribution reading c_attr_*, the queue or the
// reviewer's traceability on a scoped page, the forecast block not last in section 5; the Spazio scenari link to the
// dossier reworded or retargeted without a re-pin (K3); an in-page link to a target the page never renders (K4).
test('2. Azienda and Regione: each frame holds the scoped blocks in the recorded order',()=>{
  const PARETO=`<a href="#attribuzione" class="${CROSS}">Quali prodotti approfondire per primi? →</a>`;
  const PLAN=`<a href="#piano-revisione" class="${CROSS}">Piano di revisione del portafoglio →</a>`;
  const CROSS_4=`<a href="#portafogli-attribuzione" class="${CROSS}">Per il portafoglio selezionato → Portafogli e attribuzione</a>`;
  assert.equal(C_PLANNING_LABELS.section.dossierScope,DOSSIER_SCOPE,'the registered Spazio scenari copy (K3)');
  for(const {k,search,forecast:f,label,html} of SCOPED_RENDERS){
    const fr=frames(html);
    // Section 1: the scope bar, the decision heading block (the scoped lead: no price-quantity-mix sentence), the overview.
    const decision=`<div><p class="text-xs font-medium text-primary">La domanda di gestione</p><h3 id="c-decision-title" class="mt-1 text-lg font-semibold">Più persone trattate o prodotti più costosi?</h3><p class="mt-2 max-w-4xl text-sm leading-6 text-muted-foreground">${SCOPED_LEAD}</p></div>`;
    assert.equal(count(fr.quadro,'<div class="space-y-5"><section aria-label="Ambito di revisione" class="'),1,`${label}: the scope bar opens section 1`);
    assert.equal(count(fr.quadro,`</section>${decision}<div class="rounded-2xl border border-primary/20 bg-card p-5 md:p-6">`),1,`${label}: the decision block between the bar and the overview`);
    assert.ok(fr.quadro.endsWith('>Vai a Budget e scenari</a></div></div></div></section>'),`${label}: the overview closes section 1`);
    const {filters}=cScopedReviewFilters(client(k),new URLSearchParams(search));
    const orgLabel=client(k).orgs.find(o=>o.key===filters.org).label;
    const d=cScopedDecision(packetOf(k),filters,`${orgLabel} · ${filters.channel==='Tutti'?'tutti i canali':filters.channel}`);
    assert.deepEqual([...fr.quadro.matchAll(/<div class="rounded-xl bg-secondary\/40 p-4"><p class="text-xs text-muted-foreground">([^<]*)<\/p><p class="mt-2 text-xl font-semibold">([^<]*)<\/p><p class="mt-2 text-xs text-muted-foreground">([^<]*)<\/p><\/div>/g)].map(m=>m.slice(1)),[
      ['Variazione contabile',d.change===null?'Non disponibile':signed(d.change),`${d.scope} · ${filters.comparison==='K1'?'2024–2025':'gen–mag 2025–2026'}`],
      ['Contributo dei prodotti presenti nei due periodi',d.continuing===null?'Non disponibile':signed(d.continuing),'Contributo alla variazione, non un effetto causale o clinico.'],
      ['Persone trattate osservate','Non disponibili','Gli scenari CO stimano il denominatore; non misurano più persone trattate.'],
    ],`${label}: the three cards keep the values and wording of cScopedDecision`);
    assert.equal(count(fr.quadro,`<p class="mt-4 text-xs text-muted-foreground">Confronto: ${filters.comparison==='K1'?'2024 → 2025':'Gen–mag 2025 → 2026'}</p>`),1,`${label}: the comparison as keyed text`);
    const fd=f?cForecastDecision(f,'TOT'):null;
    assert.deepEqual(anchors(fr.quadro).map(a=>[a.href,a.label]),[...(fd?[['#previsione','Apri la previsione regionale']]:[]),['#portafogli-attribuzione','Vai a Portafogli e attribuzione'],['#fattori','Vai a Fattori di spesa'],['#budget-scenari','Vai a Budget e scenari']],label);
    if(fd)assert.equal(count(fr.quadro,`<span class="text-xl font-semibold tabular-nums">${eur(fd.annual.total)}</span><span class="text-xs text-muted-foreground">Fascia annua indicativa · 80${NBSP}%</span><span class="text-sm font-medium tabular-nums">${eur(fd.annual.low80)} – ${eur(fd.annual.high80)}</span>`),1,label);
    else assert.equal(count(fr.quadro,'Previsione regionale 2026 · stima annua indicativa'),0,`${label}: no regional card and nothing in its place`);
    // Section 2: exactly the status sentence and one link.
    assert.equal(fr.destinatari,`${frameHead(PILLAR_C_SECTIONS[1])}</div></div><div class="space-y-5">${STATUS_P}${DESTINATARI_EMPTY}</p><a href="#numerosita" class="${CROSS}">Scenario di numerosità stimata →</a></div></section>`,label);
    // Section 3: the dossier, then the attribution, nothing else; the attribution follows c_port_* (never c_attr_*).
    assert.deepEqual(sectionIds(fr['portafogli-attribuzione']).slice(1),['portafogli','attribuzione'],label);
    const port=new URLSearchParams(search);
    const portOrg=client(k).orgs.some(o=>o.key===port.get('c_port_org'))?port.get('c_port_org'):client(k).defaultOrg;
    assert.equal(count(fr['portafogli-attribuzione'],`data-c-attribution-scope="FY2025|${portOrg}|Tutti"`),1,label);
    assert.equal(count(fr['portafogli-attribuzione'],`<p class="mt-3 text-xs text-muted-foreground">${M2_NOTE}</p>`),1,`${label}: the dossier states where organisation and channel are chosen`);
    // Section 4: spesa, cambiamento, then the cross-link.
    assert.deepEqual(sectionIds(fr.fattori).slice(1),['spesa','cambiamento'],label);
    assert.ok(fr.fattori.endsWith(`</section>${CROSS_4}</div></section>`),`${label}: the cross-link closes section 4`);
    // Section 5: the budget panel, Spazio scenari, the count scenario, the forecast last.
    assert.deepEqual(sectionIds(fr['budget-scenari']).slice(1),['pianificazione','scenari','numerosita','previsione'],label);
    const prev=between(fr['budget-scenari'],'<section id="previsione"','</div></section>');
    if(f)assert.ok(text(prev).includes(f.labels.forecast),label);
    else assert.ok(prev.endsWith(`</div>${STATUS_P}${C_AUDIENCE_COPY.forecastUnavailable}</p></section>`),`${label}: the forecast's honest empty state, alone in its block`);
    // Section 6: the two cross-links, then the evidence block; no queue and no traceability.
    assert.equal(count(fr['priorita-evidenza'],`<div class="space-y-5"><div class="flex flex-wrap gap-x-4 gap-y-1">${PARETO}${PLAN}</div><section id="evidenza" `),1,label);
    assert.deepEqual(sectionIds(fr['priorita-evidenza']).slice(1),['evidenza'],label);
    assert.ok(fr['priorita-evidenza'].endsWith('</article></section></div></section></div>'),`${label}: the evidence block closes the page`);
    // Section 5, Spazio scenari (K3): the link back to the dossier with the registered copy that still names the dossier's
    // old organisation and channel controls; the Codex rewording and the 1.3 href change re-pin these lines.
    assert.equal(count(html,'href="#portafogli"'),1,`${label}: one link to the dossier`);
    assert.match(between(fr['budget-scenari'],'<section id="scenari"','<section id="numerosita"'),new RegExp(`<a href="#portafogli" [^>]*>${DOSSIER_SCOPE}<`),`${label}: «${DOSSIER_SCOPE}» in Spazio scenari`);
    // Every in-page link resolves except #piano-revisione, rendered after the dossier loads (reviewer test 5, K4).
    assert.deepEqual(unresolved(html),['piano-revisione'],`${label}: the only dangling target`);
  }
});

// ================================================================ 3. the evidence block on a scoped page
// Catches: the reviewer's criteria («Budget pubblicati o modellati») or rows («Dati sintetici: …») on a scoped page,
// «Contiene stime» outside the count rows (UI-2), the forecast row listed without a forecast, traceability children;
// the «Scenario CO» row drifting from the count scenario's lead or naming the estimate («dimessi», «dati sintetici»),
// which the page states only in the note beside the count rows and never under the count empty state (K7).
test('3. section 6 on a scoped page: the scoped reading criteria and «Fonti e versione» rows, the forecast row only with a forecast',()=>{
  for(const {label,html,forecast:f} of SCOPED_RENDERS){
    const block=between(html,'<section id="evidenza"','</article></section>');
    assert.deepEqual([...block.matchAll(/<div><h5 class="text-sm font-semibold">([^<]*)<\/h5><p class="mt-2 text-xs leading-5 text-muted-foreground">([^<]*)<\/p><\/div>/g)].map(m=>[m[1],m[2]]),SCOPED_CRITERIA,label);
    assert.deepEqual(sourcesOf(html),f?SCOPED_SOURCES:SCOPED_SOURCES.slice(0,3),label);
    assert.doesNotMatch(block,/<details|<summary|Budget pubblicati o modellati|Dati sintetici:|Contiene stime/,label);
    assert.doesNotMatch(block,/dimessi|dati sintetici/i,`${label}: no estimate wording in section 6 (K7)`);
    assert.equal(count(html,`<p class="${LEAD}">${NUMEROSITA_LEAD}</p>`),1,`${label}: the count scenario's lead the row repeats`);
    assert.ok(block.endsWith('</dl></div>'),`${label}: nothing follows the source list`);
  }
  // A portfolio without a ratio, and the CO year without one: the count empty state alone. The page shows no estimate
  // note under it (tests/pillar-c-scoped-ui.test.mjs, UI-2) and the «Scenario CO» row adds none (K7).
  for(const [k,search] of [['azienda4','c_portfolio=VAC'],['regione','c_org=asl-3&c_portfolio=VAC'],['azienda4','c_count_year=FY2024']]){
    const label=`${k} ?${search}`,html=scoped(k,search);
    assert.ok(text(between(html,'<section id="numerosita"','</section>')).includes('Il portafoglio selezionato non ha un rapporto disponibile'),`${label}: the count empty state`);
    assert.equal(count(html,'data-c-scoped-note="counts"'),0,`${label}: no count note under the empty state`);
    assert.doesNotMatch(between(html,'<section id="evidenza"','</article></section>'),/dimessi|dati sintetici/i,`${label}: section 6`);
    assert.doesNotMatch(text(html),/dimessi|dati sintetici|Contiene stime/i,`${label}: nowhere on the page`);
    assert.deepEqual(sourcesOf(html),SCOPED_SOURCES,label);
  }
});

// ================================================================ 4. exact empty sentences
// Catches: an empty state reworded, doubled, replaced by a placeholder or a zero, or shown with its rows.
test('4. the exact empty sentences: section 2 for every reader with six sections, the forecast when unavailable, the five sections for forecast_only',()=>{
  for(const {label,html} of [{label:'reviewer',html:REVIEWER_HTML},...SCOPED_RENDERS]){
    assert.equal(count(html,`${STATUS_P}${DESTINATARI_EMPTY}</p>`),1,label);
    assert.equal(count(html,FORECAST_ONLY_SENTENCE),0,label);
  }
  for(const {label,html,forecast:f} of SCOPED_RENDERS)assert.equal(count(text(html),C_AUDIENCE_COPY.forecastUnavailable),f?0:1,label);
  for(const {label,html} of REGIONAL_RENDERS){
    assert.equal(count(html,`</nav>${STATUS_P}${FORECAST_ONLY_SENTENCE}</p>${frameHead(PILLAR_C_SECTIONS[4])}`),1,`${label}: the bar, the one sentence, then section 5`);
    assert.equal(count(html,DESTINATARI_EMPTY),0,label);
  }
  // The sentence names the five other sections, in page order, then what section 5 holds. It speaks about the page and
  // never about the organisation or the member (K1): the workspace is also mounted for outage branches, where nothing may
  // be said about whether the member is enabled, and it claims nothing an outage would contradict
  // (tests/pillar-c-scoped-page.test.mjs: never «attiv…», «ancora», «riprova», «più tardi»; one statement for all reasons).
  const others=PILLAR_C_SECTIONS.filter(s=>s.id!=='budget-scenari').map(s=>s.label);
  assert.equal(FORECAST_ONLY_SENTENCE,`${others.slice(0,-1).join(', ')} e ${others.at(-1)} non sono disponibili in questa pagina; in ${PILLAR_C_SECTIONS[4].label} è disponibile solo la previsione regionale. Nessun valore viene sostituito.`);
  assert.doesNotMatch(FORECAST_ONLY_SENTENCE,/organizzazion|profilo|abilitat|attiv|ancora|riprov|più tardi|in arrivo/i);
  assert.doesNotMatch(FORECAST_ONLY_SENTENCE,/(?<!\p{L})tua(?!\p{L})/iu,'the standalone word «tua»');
  assert.equal(count(read(REGIONAL),FORECAST_ONLY_SENTENCE),1,'one static sentence, the single text child of PillarCSectionEmpty');
});

// ================================================================ 5. forecast_only: no organisation data, no dangling link
// Catches: any organisation control, key, label, figure or copy reaching a member who receives only the public
// forecast; a bar link to a section the page does not render; «Quadro decisionale» marked current on a page without it;
// any wording about the organisation (K1: the role=note line of page.tsx stays the only one).
test('5. forecast_only: the forecast exactly as before inside section 5, one bar link, no organisation data',()=>{
  for(const {label,html,search} of REGIONAL_RENDERS){
    const nav=html.slice(html.indexOf('<nav '),html.indexOf('</nav>'));
    assert.deepEqual(anchors(nav).map(a=>[a.href,a.current]),[['#budget-scenari','location']],`${label}: one link, current from the server render`);
    assert.equal(count(nav,`<span class="sr-only">${UNAVAILABLE_ENTRY}</span>`),5,label);
    assert.doesNotMatch(nav,/tabindex|href="#(?!budget-scenari")/,label);
    assert.deepEqual(unresolved(html),[],`${label}: every in-page link resolves`);
    // The forecast block is today's, inside the frame.
    assert.equal(count(html,'<section id="previsione" aria-label="Previsione regionale 2026">'),1,label);
    assert.equal(depth(between(html,frameHead(PILLAR_C_SECTIONS[4]),'<section id="previsione"')),1,label);
    assert.ok(text(html).includes(forecast.labels.forecast),label);
    const series=new URLSearchParams(search).get('c_forecast_series')??'TOT';
    assert.deepEqual([...html.matchAll(/<button type="button" title="[^"]*" aria-pressed="true"[^>]*>([^<]*)/g)].map(m=>m[1]),[{TOT:'Totale',A:'Classe A',H:'Classe H'}[series]],`${label}: the series read from c_forecast_series`);
    // No organisation data or control.
    assert.doesNotMatch(html,/<select|Ambito di revisione|data-c-attribution|data-c-portfolio|data-c-scoped-note|id="(scenari|portafogli|attribuzione|spesa|pianificazione|numerosita|evidenza)"|value="(asl-\d|aggregato)"|Azienda sintetica|Aggregato regionale|Spesa, budget e aree cliniche|Copia vista|Azzera/,label);
    for(const v of Object.values(SENTINEL))assert.ok(!text(html).includes(eur(v)),`${label}: ${v}`);
    for(const [key,value] of Object.entries(C_AUDIENCE_COPY))if(typeof value==='string')assert.ok(!text(html).includes(value),`${label}: C_AUDIENCE_COPY.${key}`);
    for(const r of REVIEWER_ONLY)assert.doesNotMatch(html,r,`${label}: ${r}`);
    identifiers(html,[],label);
    assert.doesNotMatch(html,NEVER,label);
    assert.doesNotMatch(html,/organizzazion/i,`${label}: nothing about the organisation (K1)`);
    // The rest of the K1 list over the whole page, text and markup. «profilo» stays a check on the sentence alone: the
    // forecast panel's own copy says «profilo mensile» (series A and H).
    for(const s of [text(html),html])assert.doesNotMatch(s,/organizzazion|(?<!\p{L})tua(?!\p{L})|abilitat|attiv|ancora|riprov|più tardi|in arrivo/iu,`${label}: nothing about the organisation or the member anywhere on the page (K1)`);
  }
  // The file never names the reader group, and the router.replace series contract is today's, verbatim.
  const src=read(REGIONAL);
  // K2: the forecast_only header is today's, verbatim (b2579dc, line 20 of the same file); a description that adds a
  // statement about the member or the organisation fails here and in the K1 check above.
  assert.equal(count(src,'<PageHeader eyebrow="Pillar C" title="Previsione regionale 2026" description="Abruzzo · andamento mensile e intervalli di previsione." />'),1,'K2: the forecast_only PageHeader is unchanged');
  assert.doesNotMatch(src,/audience/i);
  assert.ok(src.includes('  function update(next: CForecastSelectable) {\n    const query = new URLSearchParams();\n    if (next !== "TOT") query.set("c_forecast_series", next);\n    router.replace(`/dashboard-review/pillar-c${query.size ? `?${query}` : ""}`, { scroll: false });\n  }'));
  assert.ok(src.includes('export function PillarCRegionalForecastWorkspace({ forecast }: { forecast: CForecast }) {'));
  assert.doesNotMatch(code(REGIONAL),/pushState|replaceState|window\.|fetch\(/);
  assert.deepEqual(code(REGIONAL).match(/^import .*$/gm),[
    'import { useRouter, useSearchParams } from "next/navigation";',
    'import { PageHeader } from "@/components/dashboard-review/analytics-ui";',
    'import { PillarCSectionBar } from "@/components/dashboard-review/pillar-c/section-navigation";',
    'import { PillarCSectionEmpty, PillarCSectionFrame } from "@/components/dashboard-review/pillar-c/section-frame";',
    'import { PillarCForecastPanel } from "@/components/dashboard-review/pillar-c/forecast-section";',
    'import { PILLAR_C_SECTIONS } from "@/lib/dashboard-review/pillar-c/section-navigation";',
    'import { C_FORECAST_SELECTABLE, type CForecast, type CForecastSelectable } from "@/lib/dashboard-review/pillar-c/review";',
  ]);
  assert.equal(count(src,'<PillarCSectionBar available={[BUDGET.id]} />'),1);
  assert.equal(count(src,'const BUDGET = PILLAR_C_SECTIONS[4];'),1);
  assert.equal(PILLAR_C_SECTIONS[4].id,'budget-scenari');
});

// ================================================================ 6. leak lists on every scoped render
// Catches: a reviewer-only string, id or link on a scoped page; a province key, place name or foreign unit in an
// identifier; another unit's figure; an internal code in visible text (all four readers).
test('6. no reviewer-only content, no province token in keys and attributes, no foreign figure, no internal code in text',()=>{
  for(const {k,label,html} of SCOPED_RENDERS){
    for(const r of REVIEWER_ONLY)assert.doesNotMatch(html,r,`${label}: ${r}`);
    identifiers(html,SERVER[k].units,label);
    for(const [,l] of [...html.matchAll(/<option value="[^"]*"[^>]*>([^<]*)<\/option>/g)])assert.doesNotMatch(l,C_PROVINCE_TOKEN,`${label}: ${l}`);
    for(const unit of ['asl-1','asl-2','asl-3','asl-4','aggregato'].filter(u=>!SERVER[k].units.includes(u)))assert.ok(!text(html).includes(eur(SENTINEL[unit])),`${label}: no ${unit} figure`);
  }
  for(const {label,html} of [{label:'reviewer',html:REVIEWER_HTML},...SCOPED_RENDERS,...REGIONAL_RENDERS])
    for(const t of textNodes(html))assert.doesNotMatch(t,INTERNAL_CODE,`${label}: «${t}»`);
});

// ================================================================ 7. the page scope bar of a scoped page
// Catches: the scoped bar writing only c_org (sections 1 and 3 would disagree), a reviewer key or a foreign key in the
// address, the defaults written, c_attr_* left behind, other keys dropped, a second pushState, «Azzera» not the shared
// reset, the tampered note missing; the helper imported from the reviewer workspace.
test('7. the scoped scope bar writes c_org, c_channel, c_port_org and c_port_channel together, only the audience’s own keys, and deletes c_attr_org and c_attr_channel',()=>{
  const az=client('azienda4'),rg=client('regione');
  const entries=s=>{assert.ok(s===''||s.startsWith('?'));return [...new URLSearchParams(s)].sort((a,b)=>a[0].localeCompare(b[0]));};
  // (a) an organisation: both org keys, no channel key at the default, the attribution keys deleted, the rest kept.
  assert.deepEqual(entries(cScopedPageScopeSearch(az,'?c_attr_org=asl-1&c_attr_channel=DD&c_attr_period=FY2024&c_port_period=JM2026&c_port_id=AA&c_plan_ids=ONC&c_budget_org=asl-4',{org:'aggregato'})),
    [['c_attr_period','FY2024'],['c_budget_org','asl-4'],['c_org','aggregato'],['c_plan_ids','ONC'],['c_port_id','AA'],['c_port_org','aggregato'],['c_port_period','JM2026']]);
  // (b) a channel: the current organisation is written to c_port_org too, never a reviewer key.
  assert.deepEqual(entries(cScopedPageScopeSearch(az,'?c_org=aggregato',{channel:'DD'})),[['c_channel','DD'],['c_org','aggregato'],['c_port_channel','DD'],['c_port_org','aggregato']]);
  assert.deepEqual(entries(cScopedPageScopeSearch(rg,'?c_org=asl-2',{channel:'CO'})),[['c_channel','CO'],['c_org','asl-2'],['c_port_channel','CO'],['c_port_org','asl-2']]);
  // (c) back to the audience's defaults: nothing is left.
  assert.equal(cScopedPageScopeSearch(az,'?c_org=aggregato&c_channel=DD&c_port_org=aggregato&c_port_channel=DD&c_attr_org=aggregato&c_attr_channel=CO',{org:'asl-4',channel:'Tutti'}),'');
  assert.equal(cScopedPageScopeSearch(rg,'?c_org=asl-3&c_port_org=asl-3',{org:'aggregato'}),'');
  // (d) a divergent or tampered old link converges: c_port_org takes the bar's organisation; a foreign c_org is dropped.
  assert.deepEqual(entries(cScopedPageScopeSearch(rg,'?c_org=asl-1&c_port_org=asl-4',{channel:'DD'})),[['c_channel','DD'],['c_org','asl-1'],['c_port_channel','DD'],['c_port_org','asl-1']]);
  assert.deepEqual(entries(cScopedPageScopeSearch(az,'?c_org=TE&c_port_org=asl-1',{channel:'CO'})),[['c_channel','CO'],['c_port_channel','CO']]);
  // (e) only the audience's own keys and the four channels are ever written, whatever the patch says.
  for(const org of ['asl-1','TE','Regione','aggregato ','ASL-4',''])assert.deepEqual(entries(cScopedPageScopeSearch(az,'?c_org=aggregato',{org})),[['c_org','aggregato'],['c_port_org','aggregato']],org);
  for(const channel of ['Altro','co',''])assert.equal(cScopedPageScopeSearch(az,'',{channel}),'',channel);
  for(const s of ['','?c_org=aggregato','?c_org=TE&c_port_org=CH'])for(const p of [{org:'asl-4'},{org:'aggregato'},{channel:'DPC'},{org:'TE',channel:'CO'}]){
    const out=new URLSearchParams(cScopedPageScopeSearch(az,s,p));
    for(const key of ['c_org','c_port_org'])if(out.has(key))assert.ok(az.orgs.some(o=>o.key===out.get(key)),`${s} ${JSON.stringify(p)}: ${key}=${out.get(key)}`);
    assert.ok(!out.has('c_attr_org')&&!out.has('c_attr_channel'));
  }
  // The workspace's one writer, the bar's props, and the helper's home.
  const src=read(SCOPED);
  const update=src.match(/^ {2}const updateScope = .*$/m)?.[0];
  assert.ok(update,'updateScope is one statement');
  assert.equal(count(update,'window.history.pushState('),1);
  assert.equal(count(update,'cScopedPageScopeSearch(audience, window.location.search, patch)'),1);
  assert.equal(count(src,'window.history.pushState('),3,'updateBudget, update and updateScope, nothing else');
  assert.ok(src.includes('reset ? cInsightResetSearch(window.location.search) : cScopedReviewSearch(audience, window.location.search, patch)'),'«Azzera» is the shared page reset');
  const bar=src.match(/<PillarCScopeBar [^\n]*?\/>/)?.[0];
  assert.equal(bar,'<PillarCScopeBar orgOptions={orgOptions} org={filters.org} channelOptions={SCOPE_CHANNELS} channel={filters.channel} onChange={updateScope} onReset={() => update({}, true)} tampered={tampered} tamperedText={C_AUDIENCE_COPY.tampered} scope={scope} />');
  assert.doesNotMatch(src,/\bcopied\b|setCopied|Copia vista|Link copiato/,'the copy state lives in the bar (R8)');
  // In the page: the bar shows c_org and c_channel with the audience's own options, the note for a tampered key.
  for(const [k,search,org,channel,tampered] of [['azienda4','','asl-4','Tutti',false],['azienda4','c_org=aggregato&c_channel=CO&c_comparison=K2','aggregato','CO',false],['azienda4','c_org=TE','asl-4','Tutti',true],['regione','c_org=asl-2&c_channel=DD','asl-2','DD',false]]){
    const html=SCOPED_RENDERS.find(r=>r.k===k&&r.search===search&&r.forecast).html,bar=between(html,'<section aria-label="Ambito di revisione"','</section>');
    assert.deepEqual(options(bar,'Ambito aziendale'),client(k).orgs.map(o=>[o.key,o.label,o.key===org]),`${k} ?${search}`);
    assert.deepEqual(options(bar,'Canale dell’analisi').filter(o=>o[2]).map(o=>o[0]),[channel]);
    assert.equal(count(bar,`<p role="note" class="mt-4 text-xs font-medium">${C_AUDIENCE_COPY.tampered}</p>`),tampered?1:0,`${k} ?${search}`);
    const orgLabel=client(k).orgs.find(o=>o.key===org).label;
    assert.equal(count(bar,`<span>${orgLabel} · ${channel==='Tutti'?'Tutti i canali':channel}. Selezione aggiornata.</span>`),1);
  }
});

// ================================================================ 8. a null, a zero and a negative month
// Catches: an absent month drawn or tabled as zero, a zero month dropped, a negative month clipped, NaN or undefined.
test('8. the invented null, zero and negative months render as «Nessuna riga nel registro», zero and a negative amount',()=>{
  const months=['Gen','Feb','Mar','Apr','Mag','Giu','Lug','Ago','Set','Ott','Nov','Dic'];
  const own=reviews[EDGE_UNIT].monthly.filter(r=>r.year===2025&&r.channel==='CO');
  assert.equal(own.some(r=>r.month===EDGE_MONTHS.absent),false);
  const negative=own.find(r=>r.month===EDGE_MONTHS.negative).net;
  assert.ok(Number(negative)<0);
  for(const k of ['azienda4','regione']){
    const search=`c_channel=CO&c_period=FY2025${k==='regione'?'&c_org=asl-4':''}`;
    const html=scoped(k,search),spend=between(html,'<section id="spesa"','</section>');
    const rows=[...spend.matchAll(/<tr><t[dh][^>]*>([^<]*)<\/t[dh]><td[^>]*>([^<]*)<\/td>/g)].map(m=>[m[1],m[2]]);
    const row=m=>rows.find(([label])=>label===months[m-1])?.[1];
    assert.equal(row(EDGE_MONTHS.negative),eur(negative),`${k}: the negative month keeps its sign`);
    assert.equal(row(EDGE_MONTHS.absent),'Nessuna riga nel registro',`${k}: the absent month is never a zero`);
    assert.equal(row(EDGE_MONTHS.zero),eur('0'),`${k}: the zero month is a zero`);
    assert.doesNotMatch(html,NEVER,k);
    // Cumulated: the absent month interrupts the series; nothing after it is invented.
    const cumulative=between(scoped(k,`${search}&c_trend=cumulative`),'<section id="spesa"','</section>');
    const crow=m=>[...cumulative.matchAll(/<tr><t[dh][^>]*>([^<]*)<\/t[dh]><td[^>]*>([^<]*)<\/td>/g)].find(x=>x[1]===months[m-1])?.[2];
    for(let m=EDGE_MONTHS.absent;m<=12;m++)assert.equal(crow(m),m===EDGE_MONTHS.absent?'Nessuna riga nel registro':'Non disponibile',`${k}: cumulated ${months[m-1]}`);
  }
});

// ================================================================ 9. one exact-value alternative per chart (today's pairing; charts change in 1.3)
// Catches: a chart without its exact values, an exact table without its chart's block, an alternative rendered for an
// empty state.
test('9. each chart block carries its exact values: spend, bridge, budget and count rows, and the forecast when available',()=>{
  const ALT=caption=>`Valori e dettaglio · ${caption}</summary>`;
  for(const {label,html,forecast:f} of [...SCOPED_RENDERS]){
    const block=id=>between(html,`<section id="${id}"`,'</section>');
    // Point 19: the drawing loads after hydration; the server renders the chart slot, counted here.
    assert.equal(count(block('spesa'),'data-chart-slot="spend"'),1,label);assert.equal(count(block('spesa'),ALT('Spesa e righe per mese')),1,label);
    assert.equal(count(block('cambiamento'),'role="img"')>0,count(block('cambiamento'),ALT('Componenti del ponte'))===1,label);
    const budgetRows=count(block('pianificazione'),'Scala comune · euro')>0;
    assert.equal(count(block('pianificazione'),ALT('Budget, due chiavi e differenze neutrali')),budgetRows?1:0,label);
    const countRows=text(block('numerosita')).includes(C_AUDIENCE_COPY.countsLabels.scale);
    assert.equal(count(block('numerosita'),ALT('Numerosità e sensibilità del denominatore')),countRows?1:0,label);
    const prev=html.slice(html.indexOf('<section id="previsione"'),html.indexOf('<section id="priorita-evidenza"'));
    assert.equal(count(prev,'data-chart-slot="forecast"'),f?1:0,label);
    assert.equal(count(prev,'Valori esatti · previsione regionale mensile 2026 e osservato 2025'),f?1:0,label);
    assert.equal(count(html,'data-chart-slot='),f?2:1,`${label}: no other chart`);
    assert.equal(count(html,'recharts-responsive-container')+count(html,'recharts-wrapper'),0,`${label}: no chart library markup on the server`);
  }
  for(const {label,html} of REGIONAL_RENDERS){
    assert.equal(count(html,'data-chart-slot="forecast"'),1,label);assert.equal(count(html,'recharts-responsive-container')+count(html,'recharts-wrapper'),0,label);
    assert.equal(count(html,'Valori esatti · previsione regionale mensile 2026 e osservato 2025'),1,label);
  }
});

// ================================================================ 10. keyboard, focus, 44 px, sticky, motion
// Catches: a positive tabindex, a frame heading the bar cannot focus, a new target under 44 px (bar entries, scope bar,
// overview and cross-links, the scoped workspace's own selects back at h-10), a second sticky element, the old root
// offset back, a transition without motion-safe in either workspace.
test('10. keyboard and focus: no positive tabindex, every frame h2 focusable by the bar, 44 px targets, one sticky bar',()=>{
  const SELECT_44=C_REVIEW_UI.selectClass;
  for(const {k,label,html} of SCOPED_RENDERS){
    assert.doesNotMatch(html,/tabindex="[1-9]/,label);
    for(const id of IDS)assert.equal(count(html,`<h2 id="${id}-title" tabindex="-1"`),1,`${label}: ${id}`);
    // The outline: one h1, the six frame h2 and the Spazio scenari h2 (until 1.3); every inner block an h3.
    assert.equal(count(html,'<h1'),1,label);
    assert.deepEqual(headingIds(html,'h2'),['quadro-title','destinatari-title','portafogli-attribuzione-title','fattori-title','budget-scenari-title','scenari-title','priorita-evidenza-title'],label);
    for(const id of ['c-decision-title','portfolio-dossier-title','attribuzione-title','spesa-title','cambiamento-title','pianificazione-title','numerosita-title','previsione-title','evidenza-title'])assert.ok(new RegExp(`<h3\\b[^>]*\\sid="${id}"`).test(html),`${label}: ${id} is an h3`);
    const fr=frames(html);
    const links=[...anchors(html.slice(html.indexOf('<nav '),html.indexOf('</nav>'))),...anchors(fr.quadro),...anchors(fr.destinatari),...anchors(fr.fattori).filter(a=>a.href==='#portafogli-attribuzione'),...anchors(fr['priorita-evidenza']).filter(a=>a.href==='#attribuzione'||a.href==='#piano-revisione')];
    for(const a of links)assert.match(a.cls,/(^|\s)min-h-11(\s|$)/,`${label}: ${a.href}`);
    const bar=between(html,'<section aria-label="Ambito di revisione"','</section>');
    for(const [,c] of bar.matchAll(/<select[^>]* class="([^"]*)"/g))assert.match(c,/(^|\s)h-11(\s|$)/,label);
    for(const [,c] of bar.matchAll(/<button type="button" class="([^"]*)"/g))assert.match(c,/(^|\s)min-h-11(\s|$)/,label);
    for(const l of ['Periodo della spesa',...(k==='regione'?['Azienda del budget']:[]),'Canale del budget','Periodo del budget','Livello organizzativo del budget','Portafoglio dello scenario']){
      const m=html.match(new RegExp(`<select aria-label="${l}" class="([^"]*)"`));assert.ok(m,`${label}: «${l}»`);assert.equal(m[1],SELECT_44,`${label}: «${l}» at 44 px`);
    }
    const sticky=[...html.matchAll(/<([a-z0-9]+)\b[^>]*\sclass="([^"]*)"/g)].filter(m=>/(^|\s)(xl:)?sticky(\s|$)/.test(m[2]));
    assert.deepEqual(sticky.map(m=>m[1]),['nav'],label);
  }
  for(const {label,html} of REGIONAL_RENDERS){
    assert.doesNotMatch(html,/tabindex="[1-9]/,label);
    assert.equal(count(html,'<h2 id="budget-scenari-title" tabindex="-1"'),1,label);
    assert.equal(count(html,'<h1'),1,label);assert.deepEqual(headingIds(html,'h2'),['budget-scenari-title'],label);
    const nav=html.slice(html.indexOf('<nav '),html.indexOf('</nav>'));
    for(const [,c] of nav.matchAll(/<(?:a|span) [^>]*class="([^"]*min-h-[^"]*)"/g))assert.match(c,/(^|\s)min-h-11(\s|$)/,label);
    assert.deepEqual([...html.matchAll(/<([a-z0-9]+)\b[^>]*\sclass="([^"]*)"/g)].filter(m=>/(^|\s)(xl:)?sticky(\s|$)/.test(m[2])).map(m=>m[1]),['nav'],label);
  }
  for(const file of [SCOPED,REGIONAL]){
    const src=read(file);
    assert.doesNotMatch(src,/\btransition\b|transition-|\bsticky\b|\[&_section\[id\]\]/,file);
    assert.equal(count(src,'xl:[&_[id]]:scroll-mt-36'),1,file);
  }
  assert.equal(count(read(SCOPED),'const { selectClass } = C_REVIEW_UI;'),1);
});

// ================================================================ 11. copy lint and source pins
// Catches: forbidden wording, per-person or per-patient wording, a placeholder, changing text beside literal text
// (Chrome page translation), an invisible no-break space, a fixed pixel width, the old navigation, the purpose
// navigation or the old mounts back, reviewer vocabulary in the scoped source, a security line of the scoped page edited.
test('11. copy lint and source pins of the two workspaces',()=>{
  for(const {label,html} of [{label:'reviewer',html:REVIEWER_HTML},...SCOPED_RENDERS,...REGIONAL_RENDERS])assert.doesNotMatch(html,NEVER,label);
  const DRIVEN=String.raw`\{(?:scope|filters\.|budgets\.length|data\.|copied|eur\(|signed\(|orgLabel|budgetLabel|missingCounts|decision\.|audience\.|comparison|portScope|series|forecast\.)[^{}]*\}`;
  const TEXT=String.raw`[^<>{}\`\n]*[^<>{}\`\s][^<>{}\`\n]*`;
  for(const file of [SCOPED,REGIONAL]){
    const src=read(file);
    assert.doesNotMatch(src,new RegExp(`>${TEXT}${DRIVEN}`),file);assert.doesNotMatch(src,new RegExp(`${DRIVEN}${TEXT}<`),file);
    assert.doesNotMatch(src,/verificat|\bdemo\b|dimostra|in arrivo/i,file);
    assert.doesNotMatch(src,/paziente|persona\b/,file);
    assert.equal(count(src,NBSP),0,`${file}: no invisible no-break space`);
    assert.doesNotMatch(src,/\d %/,file);
    assert.doesNotMatch(src,/\b(?:min-)?w-\[\d+px\]/,file);
    assert.doesNotMatch(src,/PillarCSectionNavigation|PILLAR_C_SCOPED_SECTIONS|PILLAR_C_ALL_SECTIONS|PILLAR_C_SIX_SECTIONS|PillarPurposeNavigation|pageScope|number="0|Vai alla sezione/,file);
    assert.doesNotMatch(src,/analytical-workspace|insight-panels|pillar-c\/insights"|reviewer-labels|C_ORG_LABELS|C_ORGS|C_ATTR_ORGS|evidence-workflow|OutputLineage/,file);
    assert.doesNotMatch(src,/fetch\(|process\.env|localStorage|sessionStorage/,file);
  }
  const src=read(SCOPED);
  // The security lines of the scoped page, verbatim (design 2.3 scoped#root, §6 claim row).
  for(const line of [
    'const label = (key: string) => cAudienceLabel(audience, key) ?? "";',
    'if (!checked || checked.kind === "reviewer" || !coherent(checked, packet)) return null;',
    'return audience && audience.kind !== "reviewer" && coherent(audience, packet) ? <ScopedWorkspace audience={audience} packet={packet} forecast={forecast} extension={extension} /> : null;',
    'if (!extension || extension.drivers || extension.baskets || extension.fileFBasket || extension.findings) return null;',
    'return extension.units.length === keys.length && extension.units.every((u, i) => u.key === keys[i] && u.data.unit === keys[i]) ? extension : null;',
    '&& packet.orgs.length === audience.orgs.length && packet.orgs.every((unit, i) => unit === audience.orgs[i].key);',
    'data-pillar-c-review={`scoped-${audience.kind}`} data-release-state="review_only"',
    'const publishedActs = useMemo(() => cScopedPublishedActs(packet), [packet]);',
    '<CountRows countRows={countRows} labels={C_AUDIENCE_COPY.countsLabels} />',
    '{budgets.length > 0 && <p className="mt-5 text-xs font-medium leading-5" data-c-scoped-note="budget">{C_AUDIENCE_COPY.budgetNote}</p>}',
    '{countRows.length > 0 && <p className="mt-4 text-xs font-medium leading-5" data-c-scoped-note="counts">{C_AUDIENCE_COPY.countsNote}</p>}',
    '<div className="text-xs font-medium text-muted-foreground"><span>Fonte del budget</span><p className={staticField}>{C_AUDIENCE_COPY.budgetSource}</p></div>',
    '{forecast ? <PillarCForecastPanel forecast={forecast} series={filters.forecastSeries} onSeries={(forecastSeries) => update({ forecastSeries })} published /> : <Empty>{C_AUDIENCE_COPY.forecastUnavailable}</Empty>}',
    '<PillarCPlanningWorkspace publishedActs={publishedActs} />',
    '<PillarCPortfolioDossier />',
    '<PillarCAttributionAnalysis />',
    '<PillarCEvidenceSources criteria={EVIDENCE_CRITERIA} sources={evidenceSources} />',
    '<PillarCDecisionOverview cards={decisionCards} comparison={comparison} regional={regional} links={OVERVIEW_LINKS} />',
    '<PillarCSectionBar />',
  ])assert.equal(count(src,line),1,line);
  assert.match(src,/from "@\/components\/dashboard-review\/pillar-c\/review-blocks"/);
  // Every Heading of the scoped page is an inner one, in page order.
  assert.deepEqual([...code(SCOPED).matchAll(/<Heading\b([^>]*)>/g)].map(m=>(m[1].match(/^ inner id="([a-z]+)" title="/)||[])[1]),['spesa','cambiamento','pianificazione','numerosita','previsione']);
  assert.equal(count(code(SCOPED),'<PillarCSectionFrame '),6);
  assert.equal(count(code(REGIONAL),'<PillarCSectionFrame '),1);
  assert.equal(count(code(REGIONAL),'<PillarCSectionEmpty>'),1);
});
