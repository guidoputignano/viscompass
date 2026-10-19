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
const {CPortfolioDossierView,PillarPurposeNavigation}=await import('../components/dashboard-review/pillar-c/portfolio-dossier.tsx');
function view(portfolio='AA'){
 const row=(key,c,year,state='S2',candidates=['AA'])=>({anno:year,mese:1,asl:'AQ',canale:'CO',prodotto_key:key,atc:'TEST',c,attribution_status:state,candidate_portfolios:candidates});
 const packet=buildCPortfolioPacket([row('900000001','8',2024),row('900000001','10.005',2025),row('900000002','2',2025,'S3',['AA','BB'])],[{id:'AA',label:'Area sintetica A',kind:'area_terapeutica'},{id:'BB',label:'Area sintetica B',kind:'area_terapeutica'}],new Map([['900000001','Prodotto sintetico A']]),'1'.repeat(64),'2'.repeat(64),'fictional');
 return cPortfolioView(packet,'FY2025','AQ','CO',portfolio,'3'.repeat(64));
}
test('portfolio dossier renders scope, exact product amounts, chronological comparison and explicit scenario basis',()=>{
 const html=renderToStaticMarkup(React.createElement(CPortfolioDossierView,{view:view()}));
 assert.match(html,/data-fixed-net="10.005"/);assert.match(html,/data-shared-abs="2"/);assert.match(html,/data-change="2.005"/);
 assert.match(html,/Anno 2024 → Anno 2025/);assert.match(html,/10,01 €/);assert.match(html,/Prodotto sintetico A/);
 assert.match(html,/data-c-portfolio-scenario/);assert.match(html,/non previsione né budget approvato/);
 assert.match(html,/Importi mensili esatti del portafoglio/);assert.match(html,/Nessun record/);
 assert.doesNotMatch(html,/NaN|Infinity|undefined/);
});
test('candidate-only portfolio never invents fixed spending or a scenario baseline',()=>{
 const html=renderToStaticMarkup(React.createElement(CPortfolioDossierView,{view:view('BB')}));
 assert.match(html,/Nessun record/);assert.match(html,/Nessuna riga a portafoglio singolo/);
 assert.doesNotMatch(html,/La parte a portafoglio singolo è/);
 assert.match(html,/data-change="unavailable"/);assert.match(html,/Non disponibile/);
 assert.doesNotMatch(html,/data-c-portfolio-scenario/);assert.doesNotMatch(html,/NaN|Infinity|undefined/);
});
test('purpose navigation distinguishes adoption from whole-portfolio decisions; all local reset keys are registered',()=>{
 const html=renderToStaticMarkup(React.createElement(PillarPurposeNavigation));
 assert.match(html,/Pillar B · Biosimilari ed esclusività/);assert.match(html,/Intera spesa farmaceutica/);
 const workspace=readFileSync(new URL('../components/dashboard-review/pillar-c/analytical-workspace.tsx',import.meta.url),'utf8');
 assert.match(workspace,/<PillarCPortfolioDossier\s*\/>/);
 const source=readFileSync(new URL('../lib/dashboard-review/pillar-c/insights.ts',import.meta.url),'utf8');
 for(const key of ['c_port_org','c_port_channel','c_port_period','c_port_id'])assert.ok(source.includes(key));
});
