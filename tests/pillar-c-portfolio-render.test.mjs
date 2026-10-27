import test from 'node:test';
import assert from 'node:assert/strict';
import {register,createRequire} from 'node:module';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {readFileSync} from 'node:fs';
import {buildCPortfolioPacket,cPortfolioView} from '../lib/dashboard-review/pillar-c/portfolio.ts';
const root=fileURLToPath(new URL('..',import.meta.url));
register('data:text/javascript,'+encodeURIComponent(`
import {readFileSync} from 'node:fs';import {fileURLToPath} from 'node:url';import {createRequire} from 'node:module';
let sucrase;export function initialize({pkg}){sucrase=createRequire(pkg)('sucrase');}
export async function resolve(specifier,context,next){return next(['next/navigation','next/link'].includes(specifier)?specifier+'.js':specifier,context);}
export async function load(url,context,next){if(url.startsWith('file:')&&url.endsWith('.tsx')){const file=fileURLToPath(url);return{format:'module',source:sucrase.transform(readFileSync(file,'utf8'),{transforms:['typescript','jsx'],jsxRuntime:'automatic',production:true,filePath:file}).code,shortCircuit:true};}return next(url,context);}
`),{data:{pkg:pathToFileURL(`${root}package.json`).href}});
const req=createRequire(`${root}package.json`),React=req('react'),{renderToStaticMarkup}=req('react-dom/server');
const dossierModule=await import('../components/dashboard-review/pillar-c/portfolio-dossier.tsx'),{CPortfolioDossierView}=dossierModule;
const {CPortfolioChangeSummary}=await import('../components/dashboard-review/pillar-c/change-summary.tsx');
const {CPortfolioPvmReading}=await import('../components/dashboard-review/pillar-c/portfolio-pvm.tsx');
const reviewer=await (await import('./helpers/pillar-c-audience.mjs')).reviewerAudience(React);
function view(portfolio='AA'){
 const row=(key,c,year,state='S2',candidates=['AA'])=>({anno:year,mese:1,asl:'AQ',canale:'CO',prodotto_key:key,atc:'TEST',c,attribution_status:state,candidate_portfolios:candidates});
 const packet=buildCPortfolioPacket([row('900000001','8',2024),row('900000001','10.005',2025),row('900000002','2',2025,'S3',['AA','BB'])],[{id:'AA',label:'Area sintetica A',kind:'area_terapeutica'},{id:'BB',label:'Area sintetica B',kind:'area_terapeutica'}],new Map([['900000001','Prodotto sintetico A']]),'1'.repeat(64),'2'.repeat(64),'fictional');
 return cPortfolioView(packet,'FY2025','AQ','CO',portfolio,'3'.repeat(64));
}
test('portfolio dossier renders scope, exact product amounts, chronological comparison and explicit scenario basis',()=>{
 const html=renderToStaticMarkup(reviewer(React.createElement(CPortfolioDossierView,{view:view()})));
 assert.match(html,/data-fixed-net="10.005"/);assert.match(html,/data-shared-abs="2"/);assert.match(html,/data-change="2.005"/);
 assert.match(html,/Anno 2024 → Anno 2025/);assert.match(html,/10,01 €/);assert.match(html,/Prodotto sintetico A/);
 assert.match(html,/data-c-portfolio-scenario/);assert.match(html,/non previsione né budget approvato/);
 assert.match(html,/Che cosa spiega la variazione/);assert.match(html,/Maggiori contributi in aumento/);assert.match(html,/Contributi in riduzione/);
 assert.match(html,/Importi mensili esatti del portafoglio/);assert.match(html,/Non presente nei dati selezionati/);assert.doesNotMatch(html,/Nessun record/);
 // G2-25: the basis, the two cards with their financial basis, one note at the point of use, the exact amounts on demand.
 assert.match(html,/data-c-portfolio-basis="true">Raggruppamento dei farmaci per ATC e regole di mappatura; area di utilizzo da verificare · ASL 1 · CO · Anno 2025<\/p>/);
 assert.match(html,/Spesa dei farmaci con una sola area candidata<\/p><p[^>]*>10 €<\/p><p[^>]*>Importo netto, rettifiche incluse<\/p>/);
 assert.match(html,/Importi dei farmaci con più aree candidate<\/p><p[^>]*>2 €<\/p><p[^>]*>Valore assoluto; non ripartito tra le aree<\/p>/);
 assert.match(html,/Per sapere quale area li ha utilizzati serve un riscontro locale\. Questa distinzione deriva dalla mappatura dei farmaci, non da informazioni su patologie concomitanti o reazioni avverse\./);
 assert.match(html,/Importo esatto dei farmaci con una sola area candidata: 10,01 €, su 1 riga osservata\. Farmaci con più aree candidate: 2,00 € in valore assoluto, 2,00 € con segno \(rettifiche incluse\), su 1 riga osservata\./);
 assert.match(html,/ATC TEST · aree candidate: Area sintetica A, Area sintetica B/,'the shared detail names the candidate areas');
 assert.doesNotMatch(html,/portafogli candidati<\/span>|associata solo a quest’area|associata anche ad altre aree/,'no count without names, no old card wording');
 // G2-24: presence in the selected comparison, never a market entry or exit; absence explained beside the table.
 assert.match(html,/>Presenza nei dati selezionati<\/th>/);assert.match(html,/non è un importo zero e non dice se il farmaco è nuovo, ritirato o distribuito in un altro canale/);
 assert.doesNotMatch(html,/Entrati nel portafoglio|Usciti dal portafoglio/);
 assert.doesNotMatch(html,/NaN|Infinity|undefined/);
});

test('change summary exposes product drill-down and does not interpret a spending change as patient growth',()=>{
 const html=renderToStaticMarkup(reviewer(React.createElement(CPortfolioChangeSummary,{view:view()})));
 assert.match(html,/data-c-change-summary/);assert.match(html,/data-increases="2.005"/);assert.match(html,/href="#portfolio-product-detail"/);
 assert.match(html,/non è un lancio sul mercato né un passaggio di pazienti/);assert.match(html,/non effetti di prezzo, quantità o crescita delle persone trattate/);
 const missing=renderToStaticMarkup(reviewer(React.createElement(CPortfolioChangeSummary,{view:view('BB')})));
 assert.match(missing,/data-change="unavailable"/);assert.doesNotMatch(missing,/Contributi in aumento/);
});

test('change summary uses singular only for one unchanged product',()=>{
 const row=(key,c,year)=>({anno:year,mese:1,asl:'AQ',canale:'CO',prodotto_key:key,atc:'TEST',c,attribution_status:'S2',candidate_portfolios:['AA']});
 const render=rows=>{
  const packet=buildCPortfolioPacket(rows,[{id:'AA',label:'Area sintetica A',kind:'area_terapeutica'}],new Map(),'1'.repeat(64),'2'.repeat(64),'fictional');
  return renderToStaticMarkup(reviewer(React.createElement(CPortfolioChangeSummary,{view:cPortfolioView(packet,'FY2025','AQ','CO','AA','3'.repeat(64))})));
 };
 for(const count of [0,1,2]){
  const rows=[row('900000001','8',2024),row('900000001','10',2025)];
  for(let i=0;i<count;i++)rows.push(row(`90000001${i}`,'3',2024),row(`90000001${i}`,'3',2025));
  const html=render(rows);
  assert.ok(html.includes(`${count} ${count===1?'voce':'voci'} senza variazione`),`unchanged count ${count}`);
  assert.ok(!html.includes(`${count} ${count===1?'voci':'voce'} senza variazione`),`wrong grammar for ${count}`);
 }
});

test('PVM rendering gives the admitted subset its own denominator and never shows effects without support',()=>{
 const result={status:'ready',support:'partial',coverage:{earlier:'0.6',later:'0.7'},admittedChange:'8',effects:{quantity:'5',mix:'4',unitCost:'-1'},rounding:{rawResidual:'0',displayResidual:'0'}};
 const html=renderToStaticMarkup(React.createElement(CPortfolioPvmReading,{result}));
 assert.match(html,/60%/);assert.match(html,/70%/);assert.match(html,/data-c-pvm-admitted-change="8"/);assert.match(html,/data-c-pvm-effect="unitCost" data-value="-1"/);
 assert.match(html,/non scompongono l’intera variazione/);assert.match(html,/non è convalidata dall’Azienda/);assert.doesNotMatch(html,/NaN|Infinity|undefined/);
 assert.doesNotMatch(html,/registro AIFA|convenzione Q|ledger/,'no internal source wording in the reading (1.2b)');
 const unsupported=renderToStaticMarkup(React.createElement(CPortfolioPvmReading,{result:{status:'unsupported',reason:'scope'}}));assert.match(unsupported,/Non viene applicato a questa selezione/);assert.doesNotMatch(unsupported,/data-c-pvm-effect/);
 const insufficient=renderToStaticMarkup(React.createElement(CPortfolioPvmReading,{result:{status:'insufficient',coverage:{earlier:'0.3',later:'0.4'},effects:null,admittedChange:null}}));assert.match(insufficient,/inferiore al 50%/);assert.doesNotMatch(insufficient,/data-c-pvm-effect/);
 const rounded=renderToStaticMarkup(React.createElement(CPortfolioPvmReading,{result:{...result,rounding:{rawResidual:'0',displayResidual:'0.01'}}}));assert.match(rounded,/differisce dal saldo arrotondato di \+0,01 €/);
});
test('candidate-only portfolio never invents fixed spending or a scenario baseline',()=>{
 const html=renderToStaticMarkup(reviewer(React.createElement(CPortfolioDossierView,{view:view('BB')})));
 assert.match(html,/Non presente nei dati selezionati/);assert.match(html,/Nei dati selezionati non ci sono farmaci con quest’area come sola candidata\./);
 assert.doesNotMatch(html,/come sola candidata è/);
 assert.match(html,/data-change="unavailable"/);assert.match(html,/Non disponibile/);
 assert.doesNotMatch(html,/data-c-portfolio-scenario/);assert.doesNotMatch(html,/NaN|Infinity|undefined/);
});
test('purpose navigation removed for every reader (1.2c); the sidebar carries the Pillar B / Pillar C distinction; all local reset keys are registered',()=>{
 assert.equal('PillarPurposeNavigation' in dossierModule,false,'the export is gone');
 assert.doesNotMatch(readFileSync(new URL('../components/dashboard-review/pillar-c/portfolio-dossier.tsx',import.meta.url),'utf8'),/PillarPurposeNavigation|Obiettivi distinti dei Pillar B e C/);
 const workspace=readFileSync(new URL('../components/dashboard-review/pillar-c/analytical-workspace.tsx',import.meta.url),'utf8');
 assert.match(workspace,/<PillarCPortfolioDossier workbook=\{workbook\}\s*\/>/);
 assert.doesNotMatch(workspace,/PillarPurposeNavigation/,'the reviewer no longer mounts the purpose navigation (1.2b, D5)');
 const sidebar=readFileSync(new URL('../components/dashboard-review/nav.tsx',import.meta.url),'utf8');
 assert.ok(sidebar.includes('href: "/dashboard-review/revisione-pillar-b", label: "Pillar B · Biosimilari ed esclusività"'),'the sidebar names Pillar B');
 assert.ok(sidebar.includes('label: "Pillar C · Aree cliniche e budget"'),'the sidebar names Pillar C');
 assert.doesNotMatch(readFileSync(new URL('../components/dashboard-review/pillar-c/scoped-workspace.tsx',import.meta.url),'utf8'),/PillarPurposeNavigation/,'the scoped page no longer mounts it (1.2c)');
 // The page-level reset lives in reset-search.ts (shared by both workspaces); insights.ts re-exports it.
 const source=readFileSync(new URL('../lib/dashboard-review/pillar-c/reset-search.ts',import.meta.url),'utf8');
 for(const key of ['c_port_org','c_port_channel','c_port_period','c_port_id'])assert.ok(source.includes(key));
 assert.match(readFileSync(new URL('../lib/dashboard-review/pillar-c/insights.ts',import.meta.url),'utf8'),/export \{ cInsightResetSearch \} from "@\/lib\/dashboard-review\/pillar-c\/reset-search";/);
});
