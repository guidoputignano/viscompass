import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire,register} from 'node:module';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {attributionFixture} from './fixtures/pillar-c-attribution.mjs';
const root=fileURLToPath(new URL('..',import.meta.url));
register('data:text/javascript,'+encodeURIComponent(`
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
let sucrase;
export function initialize({pkg}){sucrase=createRequire(pkg)('sucrase');}
export async function resolve(specifier,context,next){return next(specifier==='next/navigation'?'next/navigation.js':specifier,context);}
export async function load(url,context,next){
 if(url.startsWith('file:')&&url.endsWith('.tsx')){const file=fileURLToPath(url);return {format:'module',source:sucrase.transform(readFileSync(file,'utf8'),{transforms:['typescript','jsx'],jsxRuntime:'automatic',production:true,filePath:file}).code,shortCircuit:true};}
 return next(url,context);
}`),{data:{pkg:pathToFileURL(`${root}package.json`).href}});
const req=createRequire(`${root}package.json`),React=req('react'),{renderToStaticMarkup}=req('react-dom/server');
const {CAttributionView}=await import('../components/dashboard-review/pillar-c/attribution-analysis.tsx');
const reviewer=await (await import('./helpers/pillar-c-audience.mjs')).reviewerAudience(React);
const packet=attributionFixture();
const view=(org,channel)=>({schema:'pillar-c-attribution-view-v1',mappingVersion:packet.mappingVersion,portfolios:packet.portfolios,scope:packet.scopes.find(s=>s.period==='FY2025'&&s.org===org&&s.channel===channel),comparison:packet.scopes.find(s=>s.period==='FY2024'&&s.org===org&&s.channel===channel)??null});
test('attribution renders exact scope, accessible conditional ranges and no invented observed allocation',()=>{
 const html=renderToStaticMarkup(reviewer(React.createElement(CAttributionView,{view:view('AQ','CO')})));
 assert.match(html,/data-period="FY2025" data-org="AQ" data-channel="CO"/);
 assert.match(html,/data-uncertain-abs="302"/);assert.match(html,/data-c-attribution-n80="1"/);
 assert.match(html,/tabindex="0" aria-label="Area sintetica A: 2,00 € – 112,00 €/);
 assert.match(html,/Nessuna allocazione locale osservata è disponibile/);
 assert.match(html,/Gli estremi delle diverse aree non sono tutti raggiungibili insieme/);
 assert.doesNotMatch(html,/NaN|Infinity|undefined|<form|<iframe/);
});
test('an empty uncertain pool is not a fabricated positive priority and remains finite',()=>{
 const html=renderToStaticMarkup(reviewer(React.createElement(CAttributionView,{view:view('CH','DD')})));
 assert.match(html,/data-c-attribution-n80="unavailable"/);
 assert.match(html,/Nessun prodotto con esposizione positiva/);
 assert.doesNotMatch(html,/NaN|Infinity|undefined/);
});

// Codex review of 26 Oct 2026, G1-R02: the fixture's shared pool has +100 and -10 (absolute 110, net 90) and the
// uncertain pool is 302 in absolute value: absolute exposure and signed net spending keep distinct values and words.
test('G1-R02: absolute exposure and signed net spending stay distinct in values and wording',()=>{
 const html=renderToStaticMarkup(reviewer(React.createElement(CAttributionView,{view:view('AQ','CO')})));
 const text=html.replace(/<[^>]*>/g,' ').replace(/\s+/g,' ');
 assert.match(text,/Spesa associata a più aree o non classificata, in valore assoluto 302(,00)? €/,'the uncertain pool is labelled absolute and reads the absolute amount');
 assert.match(text,/le rettifiche non compensano gli importi/);
 assert.match(text,/Spesa condivisa tra portafogli 90(,00)? € Importo con segno/,'the shared tile stays net: 90, not 110');
 assert.match(html,/>Spesa associata anche ad altre aree, in valore assoluto<\/th>/,'the table column of the shared exposure says absolute');
 assert.doesNotMatch(text,/Spesa associata a più aree o non classificata 302/,'never the absolute amount under an unqualified spending label');
});
