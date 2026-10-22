// Reviewer regression matrix of the Pillar C client components (recommendation 5, interface step).
// It renders, on synthetic data only, the reviewer workspace for a fixed list of addresses (with and without a
// workbook index) and every leaf view the organisation-scoped interface now shares with it, and returns one
// canonical JSON string of the markup. The hash was first pinned on the components of 30e9e57, before the audience
// existed, and re-recorded at 1.2b on the same synthetic data (six-section regroup, the 1.2b copy rows and the
// reviewer queue link at 44 px), when the leaves of the six-section page were added: the section frame, the scope
// bar, the decision overview and the evidence sources, each on literal synthetic props outside `data`, so the data
// hash is unchanged.
//
// `root` is the checkout to render (a file URL ending with '/'); `wrap(React, element)` adds what that checkout
// needs around a leaf view (the reviewer's audience provider now, nothing at 30e9e57); `workspaceProps` are the
// props beyond packet and workbook (the reviewer's audience now; ignored at 30e9e57). The caller registers a .tsx
// loader and the checkout's own "@/" alias first.
import {createRequire} from 'node:module';

export const UI_MATRIX_SEARCHES = [
  '',
  'c_org=AQ',
  'c_org=TE&c_channel=CO&c_period=FY2024',
  'c_trend=cumulative&c_comparison=K2&c_channel=DD',
  'c_budget_org=TE&c_budget_channel=CO&c_budget_period=FY2024&c_budget=published&c_level=Dipartimento',
  'c_budget_org=AQ&c_budget_channel=DD&c_budget_period=FY2025&c_budget=synthetic&c_level=Disciplina&c_budget_order=difference',
  'c_count_year=FY2024&c_portfolio=ONC',
  'c_forecast_series=A',
  // Keys of the organisation-scoped vocabulary in a reviewer's address: the reviewer reads them exactly as before.
  'c_org=asl-4&c_port_org=aggregato&c_attr_org=asl-1&c_budget_org=Regione',
  'c_port_org=CH&c_port_period=JM2026&c_port_channel=DPC&c_port_id=AA&c_attr_org=PE&c_attr_channel=DD&c_attr_period=FY2024',
  'c_plan_ids=ONC.AA&c_plan_v1=500',
];

const sha = async (text) => (await import('node:crypto')).createHash('sha256').update(text).digest('hex');

export async function reviewerUiMatrix({root, wrap, workspaceProps}){
  const req=createRequire(new URL('package.json',root)),React=req('react'),{renderToStaticMarkup}=req('react-dom/server');
  const {SearchParamsContext}=req('next/dist/shared/lib/hooks-client-context.shared-runtime');
  const at=(p)=>import(new URL(p,root).href);
  const {PillarCAnalyticalWorkspace}=await at('components/dashboard-review/pillar-c/analytical-workspace.tsx');
  const {CAttributionView}=await at('components/dashboard-review/pillar-c/attribution-analysis.tsx');
  const {CPortfolioDossierView}=await at('components/dashboard-review/pillar-c/portfolio-dossier.tsx');
  const {CPortfolioChangeSummary}=await at('components/dashboard-review/pillar-c/change-summary.tsx');
  const {CPlanningPanel}=await at('components/dashboard-review/pillar-c/planning-workspace.tsx');
  const {CPortfolioReviewPlan}=await at('components/dashboard-review/pillar-c/review-plan.tsx');
  const {PillarCSectionFrame,PillarCSectionEmpty}=await at('components/dashboard-review/pillar-c/section-frame.tsx');
  const {PillarCScopeBar}=await at('components/dashboard-review/pillar-c/scope-bar.tsx');
  const {PillarCDecisionOverview}=await at('components/dashboard-review/pillar-c/decision-overview.tsx');
  const {PillarCEvidenceSources}=await at('components/dashboard-review/pillar-c/evidence-sources.tsx');
  const {parseCReviewPacket}=await at('lib/dashboard-review/pillar-c/review.ts');
  const {buildCPortfolioPacket,cPortfolioView}=await at('lib/dashboard-review/pillar-c/portfolio.ts');
  const {cPlanningAccept,C_PLANNING_MATCHED}=await at('lib/dashboard-review/pillar-c/planning.ts');
  const {C_WORKBOOK_HASH}=await at('lib/dashboard-review/pillar-c/workbook.ts');
  const {cReviewV2Fixture}=await at('tests/fixtures/pillar-c-review.mjs');
  const {attributionFixture}=await at('tests/fixtures/pillar-c-attribution.mjs');

  // ---- synthetic data (invented amounts, products and labels)
  const packet=parseCReviewPacket(cReviewV2Fixture());
  const workbook={schema:'pillar-c-workbook-index-v1',workbookSha256:C_WORKBOOK_HASH,outputs:[{id:'TEST-1',title:'Invented test only',section:'spesa',tier:'Fonte pubblica',qualifier:'—',grain:'anno',ranges:['Example!A1:C4'],availability:'snapshot',reason:null,sourceState:'review'}],sections:{spesa:{sha256:'4'.repeat(64),bytes:10,outputs:1}}};
  const attr=attributionFixture();
  const attrView=(period,org,channel)=>({schema:'pillar-c-attribution-view-v1',sourceSha256:attr.sourceSha256,classificationSha256:attr.classificationSha256,mappingVersion:attr.mappingVersion,sourceSnapshot:'3'.repeat(64),portfolios:attr.portfolios,
    scope:attr.scopes.find(s=>s.period===period&&s.org===org&&s.channel===channel),comparison:attr.scopes.find(s=>s.period===C_PLANNING_MATCHED[period]&&s.org===org&&s.channel===channel)??null});
  const prow=(key,c,year,state='S2',candidates=['AA'])=>({anno:year,mese:1,asl:'AQ',canale:'CO',prodotto_key:key,atc:'TEST',c,attribution_status:state,candidate_portfolios:candidates});
  const ports=[{id:'AA',label:'Area sintetica A',kind:'area_terapeutica'},{id:'BB',label:'Area sintetica B',kind:'area_terapeutica'}];
  const portPacket=buildCPortfolioPacket([prow('900000001','8',2024),prow('900000001','10.005',2025),prow('900000002','2',2025,'S3',['AA','BB']),prow('900000003','-0.75',2025,'S3',['AA','BB'])],ports,new Map([['900000001','Prodotto sintetico A']]),'1'.repeat(64),'2'.repeat(64),'fictional');
  const portView=(id)=>cPortfolioView(portPacket,'FY2025','AQ','CO',id,'3'.repeat(64));
  const planScope=(period,org,channel)=>`c_port_period=${period}&c_port_org=${org}&c_port_channel=${channel}`;
  const ready=(period,org,channel)=>({key:`${period}|${org}|${channel}`,view:cPlanningAccept(JSON.parse(JSON.stringify(attrView(period,org,channel))),period,org,channel)});
  const data={packet,workbook,attr,portPacket};

  const render=(element,search='')=>renderToStaticMarkup(React.createElement(SearchParamsContext.Provider,{value:new URLSearchParams(search)},element));
  const leaf=(type,props,search)=>render(wrap(React,React.createElement(type,props)),search);
  const out=[];
  for(const withWorkbook of [false,true])for(const search of UI_MATRIX_SEARCHES)
    out.push([`workspace ${withWorkbook?'with':'without'} workbook ?${search}`,render(React.createElement(PillarCAnalyticalWorkspace,{...workspaceProps,packet,workbook:withWorkbook?workbook:undefined}),search)]);
  for(const [period,org,channel] of [['FY2025','AQ','CO'],['FY2025','Regione','Tutti'],['FY2025','CH','DD'],['FY2024','Regione','Tutti']])
    out.push([`attribution ${period}|${org}|${channel}`,leaf(CAttributionView,{view:attrView(period,org,channel)})]);
  for(const id of ['AA','BB']){
    out.push([`dossier ${id}`,leaf(CPortfolioDossierView,{view:portView(id),search:'c_port_period=FY2025&c_port_org=AQ&c_port_channel=CO&c_port_id=AA&c_plan_ids=BB&c_plan_v1=300_BB.10'})]);
    out.push([`dossier ${id} with workbook`,leaf(CPortfolioDossierView,{view:portView(id),workbook})]);
    out.push([`change summary ${id}`,leaf(CPortfolioChangeSummary,{view:portView(id)})]);
  }
  const planning=[
    [planScope('FY2025','AQ','CO')+'&c_plan_ids=AA.BB',ready('FY2025','AQ','CO'),[]],
    [planScope('FY2025','AQ','CO')+'&c_plan_ids=AA&c_plan_v1=1000&c_plan_split=eq',ready('FY2025','AQ','CO'),['TE|FY2024|CO']],
    [planScope('FY2025','Regione','Tutti')+'&c_plan_ids=AA',ready('FY2025','Regione','Tutti'),['TE|FY2024|CO','TE|FY2024|DD']],
    [planScope('FY2024','Regione','Tutti'),ready('FY2024','Regione','Tutti'),['TE|FY2024|CO']],
    [planScope('FY2025','AQ','CO'),{key:'FY2025|AQ|CO',error:'forbidden'},[]],
    [planScope('FY2025','AQ','CO'),{key:'FY2025|AQ|CO',error:'unavailable'},[]],
    [planScope('FY2025','AQ','CO'),null,[]],
    ['c_port_org=asl-2&c_plan_ids=AA',null,['Regione|FY2024|CO']],
  ];
  for(const [search,load,acts] of planning)for(const evidenceAnchor of [false,true])
    out.push([`planning ?${search} ${load?('view' in load?'ready':load.error):'loading'} evidence=${evidenceAnchor}`,leaf(CPlanningPanel,{search,load,acts,evidenceAnchor,onSearch(){},onRetry(){}},search)]);
  const context={period:'FY2025',org:'AQ',channel:'CO',portfolioId:'AA',portfolioLabel:'Area sintetica A',sourceSha256:'1'.repeat(64),classificationSha256:'2'.repeat(64),mappingVersion:'fictional',sourceSnapshot:'3'.repeat(64),fixedNet:'10.005',sharedAbs:'2'};
  for(const org of ['AQ','Regione','TE'])out.push([`review plan ${org}`,leaf(CPortfolioReviewPlan,{context:{...context,org}})]);
  // ---- the six-section leaves (1.2b): literal synthetic props only, outside `data`; invented organisations and amounts.
  const e=React.createElement,NB=String.fromCharCode(0xa0),none=()=>{};
  out.push(['frame with scope line',leaf(PillarCSectionFrame,{id:'sezione-a',number:'3',title:'Sezione sintetica A',question:'Domanda sintetica della sezione?',scope:['Azienda sintetica Alfa','Tutti i canali','Anno 2025'],children:e('p',null,'contenuto')})]);
  out.push(['frame with empty state',leaf(PillarCSectionFrame,{id:'sezione-b',number:'2',title:'Sezione sintetica B',question:'Seconda domanda sintetica?',children:e(PillarCSectionEmpty,null,'Frase sintetica. Nessun valore viene sostituito.')})]);
  const scopeBar={orgOptions:[{value:'unit-a',label:'Azienda sintetica Alfa'},{value:'tutte',label:'Aggregato sintetico'}],org:'unit-a',channelOptions:[{value:'Tutti',label:'Tutti i canali'},{value:'CO',label:'CO'}],channel:'Tutti',onChange:none,onReset:none,tamperedText:'Nota sintetica.',scope:'Azienda sintetica Alfa · Tutti i canali'};
  out.push(['scope bar',leaf(PillarCScopeBar,scopeBar)]);
  out.push(['scope bar tampered',leaf(PillarCScopeBar,{...scopeBar,tampered:true})]);
  const overview={
    cards:[
      {title:'Variazione contabile',value:`+1.000,00${NB}€`,detail:'Azienda sintetica Alfa · tutti i canali · 2024–2025'},
      {title:'Contributo dei prodotti presenti nei due periodi',value:`+600,00${NB}€`,detail:'Contributo alla variazione, non un effetto causale o clinico.'},
      {title:'Persone trattate osservate',value:'Non disponibili',detail:'Gli scenari CO stimano il denominatore; non misurano più persone trattate.'},
    ],
    comparison:'Confronto: 2024 → 2025',
    links:[{href:'#portafogli-attribuzione',label:'Portafogli e attribuzione'},{href:'#fattori',label:'Fattori di spesa'},{href:'#budget-scenari',label:'Budget e scenari'}],
  };
  out.push(['decision overview with regional',leaf(PillarCDecisionOverview,{...overview,regional:{annual:`9.000,00${NB}€`,band:`8.000,00${NB}€ – 10.000,00${NB}€`,href:'#previsione'}})]);
  out.push(['decision overview without regional',leaf(PillarCDecisionOverview,{...overview,regional:null})]);
  const criteria=[{title:'Criterio sintetico A',text:'Lettura sintetica del primo criterio.'},{title:'Criterio sintetico B',text:'Lettura sintetica del secondo criterio.'}];
  const sources=[{term:'Fonte sintetica A',detail:'Descrizione sintetica della prima fonte.'},{term:'Fonte sintetica B',detail:'Descrizione sintetica della seconda fonte.'}];
  out.push(['evidence sources with children',leaf(PillarCEvidenceSources,{criteria,sources,children:e('details',null,e('summary',null,'Dettaglio sintetico'))})]);
  out.push(['evidence sources without sources',leaf(PillarCEvidenceSources,{criteria,sources:[]})]);
  return {json:JSON.stringify(out),cases:out.length,data:await sha(JSON.stringify(data))};
}
