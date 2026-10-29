// Owner decisions of 29 October: secondary details, plain summaries, task-oriented entry points. Synthetic data only.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire,register} from 'node:module';
import {fileURLToPath} from 'node:url';
import {readFileSync} from 'node:fs';
import {registerPillarCStubs} from './helpers/pillar-c-scoped-stubs.mjs';
import {extUnit} from './fixtures/pillar-c-extension.mjs';

registerPillarCStubs({}, {tsx:true});
register('data:text/javascript,'+encodeURIComponent(`export async function resolve(s,c,n){return n(s==='next/link'?'next/link.js':s,c);}`),import.meta.url);
const root=fileURLToPath(new URL('..',import.meta.url));
const req=createRequire(`${root}package.json`),React=req('react'),{renderToStaticMarkup}=req('react-dom/server');
const h=React.createElement,render=(C,props)=>renderToStaticMarkup(h(C,props));
const {PillarCRecipientsSection,PillarCFileFRecipients}=await import('../components/dashboard-review/pillar-c/extension-sections.tsx');
const {PillarCSecondaryAnalyses}=await import('../components/dashboard-review/pillar-c/secondary-analyses.tsx');
const {PillarCStartingViews}=await import('../components/dashboard-review/pillar-c/starting-views.tsx');
const {cStartingView,cStartingViewSearch}=await import('../lib/dashboard-review/pillar-c/starting-views.ts');
const {PillarCPeriodCatalogProvider}=await import('../components/dashboard-review/pillar-c/period-context.tsx');
const {buildCPeriodCatalog,publicCPeriodCatalog}=await import('../lib/dashboard-review/pillar-c/period-catalog.ts');
const view={units:[{key:'asl-3',label:'Unità sintetica Tre',data:extUnit('asl-3',1000)},{key:'aggregato',label:'Aggregato sintetico',data:extUnit('aggregato',4000)}],drivers:null,baskets:null,fileFBasket:null,findings:null};
const catalog=publicCPeriodCatalog(buildCPeriodCatalog(view,{mode:'synthetic'}));
const filef=(initial)=>renderToStaticMarkup(h(PillarCPeriodCatalogProvider,{catalog},h(PillarCFileFRecipients,{view,initial})));

test('DPC opens with the unchanged counts and plain cost/concentration facts; detailed charts are secondary',()=>{
  const html=render(PillarCRecipientsSection,{view});
  assert.match(html,/Assistiti con erogazioni DPC/);assert.match(html,/1\.000/);assert.match(html,/4\.000/);
  assert.match(html,/Almeno metà degli assistiti ha un costo registrato fino a 80,00/);
  assert.match(html,/Il 10 % degli assistiti con costo più alto rappresenta il 40,0 %/);
  assert.match(html,/data-c-secondary="dpc"/);
  assert.match(html,/Quanto pesa il servizio delle farmacie/);assert.match(html,/Giorni tra prescrizione ed erogazione/);
  assert.doesNotMatch(html,/data-c-distribution=|data-c-typical-use=|data-c-pharmacy=|<polyline|Indice di Gini/);
  const opened=render(PillarCRecipientsSection,{view,initialDetailsOpen:true});
  for(const marker of ['data-c-distribution=','data-c-typical-use=','data-c-pharmacy=','<polyline','Indice di Gini'])assert.ok(opened.includes(marker),marker);
  assert.match(opened,/Costo per assistito nelle singole ASL/);
});

test('aggregate-only DPC never invents a median or a top-decile distribution',()=>{
  const html=render(PillarCRecipientsSection,{view:{...view,units:[view.units[1]]}});
  assert.doesNotMatch(html,/data-c-cost-summary|data-c-concentration-summary/);
});

test('File F opens with annual identifiers and reported amount, retaining detailed statistics only on request',()=>{
  const html=filef();
  assert.match(html,/data-c-filef-summary/);assert.match(html,/Identificativi distinti nell’anno/);assert.match(html,/Importo riportato nell’anno/);
  const amount=view.units[0].data.fileF.months.reduce((sum,row)=>sum+row.amount,0);
  assert.ok(html.includes(new Intl.NumberFormat('it-IT',{style:'currency',currency:'EUR',maximumFractionDigits:0}).format(amount)));
  assert.doesNotMatch(html,/Indice di Gini|Contatti e mesi attivi|Profilo anagrafico/);
  const opened=filef({detailsOpen:true});
  for(const label of ['Indice di Gini','Contatti e mesi attivi','Profilo anagrafico'])assert.ok(opened.includes(label),label);
});

test('a File F month never acquires annual statistics, even when annual details were requested',()=>{
  const month=catalog.entries.find((e)=>e.sourceFamily==='file-f'&&e.granularity==='month');
  assert.ok(month);
  const html=filef({period:month.id,detailsOpen:true});
  assert.match(html,/Identificativi distinti nel mese/);
  assert.doesNotMatch(html,/Indice di Gini|Identificativi distinti nell’anno|data-c-filef-summary|data-c-secondary="filef-profile"/);
});

test('a closed secondary section does not mount its children; open uses the same original children',()=>{
  let mounts=0;function Child(){mounts++;return h('button',null,'Valore di dettaglio');}
  const props={id:'synthetic',summary:'Altre analisi',children:h(Child)};
  const closed=render(PillarCSecondaryAnalyses,props);assert.equal(mounts,0);assert.doesNotMatch(closed,/<button|open=""/);
  const open=render(PillarCSecondaryAnalyses,{...props,initialOpen:true});assert.equal(mounts,1);assert.match(open,/open=""/);assert.match(open,/Valore di dettaglio/);
});

test('starting preferences use the account only for the default, and preserve source periods and existing scopes',()=>{
  assert.equal(cStartingView(new URLSearchParams(),'regione'),'regione');
  assert.equal(cStartingView(new URLSearchParams(),'azienda'),'direzione');
  assert.equal(cStartingView(new URLSearchParams('c_percorso=farmacia'),'regione'),'farmacia');
  assert.equal(cStartingView(new URLSearchParams('c_percorso=admin'),'azienda'),'direzione');
  const initial='?c_org=asl-4&c_channel=CO&c_period=FY2024&c_port_org=asl-4&c_fonte=filef';
  const next=new URLSearchParams(cStartingViewSearch(initial,'farmacia'));
  assert.equal(next.get('c_fonte'),'dpc');assert.equal(next.get('c_percorso'),'farmacia');
  for(const [key,value] of new URLSearchParams(initial))if(key!=='c_fonte')assert.equal(next.get(key),value);
  assert.equal(new URLSearchParams(cStartingViewSearch(next.toString(),'direzione')).has('c_fonte'),false);
});

test('all three entry points have named links and useful questions; Azienda wording promises only its aggregate comparator',()=>{
  const html=render(PillarCStartingViews,{value:'farmacia',peerComparison:false,href:c=>`?c_percorso=${c}`,taskHref:()=>'?c_org=asl-4&c_fonte=dpc',onSelect:()=>{}});
  for(const label of ['Direzione ASL','Farmacia','Regione','La tua ASL a confronto con l’aggregato','Farmaci sotto 10 €'])assert.ok(html.includes(label),label);
  assert.doesNotMatch(html,/confronto tra le ASL disponibili|tabindex="[1-9]/);
  assert.match(html,/\?c_org=asl-4&amp;c_fonte=dpc#c-under10/);
  assert.match(html,/aria-current="true"/);
  // The task selector reads no data, has no service client and makes no permission decision.
  const src=readFileSync(`${root}lib/dashboard-review/pillar-c/starting-views.ts`,'utf8');
  assert.doesNotMatch(src,/fetch\(|createClient|service.role|REVIEWER_EMAILS/);
});
