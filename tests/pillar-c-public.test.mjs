import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {register, createRequire} from 'node:module';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {C_PUBLIC_DEFAULTS, C_PUBLIC_SECTIONS, parsePublicCSelection, publicCSearch, regionalRows, forecastSeries, territoryName} from '../lib/pillar-c-public/model.ts';
import {isPublicPath} from '../lib/supabase/public-paths.ts';

const root=fileURLToPath(new URL('..',import.meta.url));
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const data=JSON.parse(read('data/public-compiled/pillar-c.json'));
register('data:text/javascript,'+encodeURIComponent(`
import {readFileSync} from 'node:fs';import {fileURLToPath} from 'node:url';import {createRequire} from 'node:module';
let sucrase;export function initialize({pkg}){sucrase=createRequire(pkg)('sucrase');}
export async function resolve(s,c,n){return n(s==='next/link'?s+'.js':s,c);}
export async function load(u,c,n){if(u.startsWith('file:')&&u.endsWith('.tsx')){const f=fileURLToPath(u);return {format:'module',source:sucrase.transform(readFileSync(f,'utf8'),{transforms:['typescript','jsx'],jsxRuntime:'automatic',production:true,filePath:f}).code,shortCircuit:true};}return n(u,c);}
`),{data:{pkg:pathToFileURL(path.join(root,'package.json')).href}});
const require=createRequire(path.join(root,'package.json')),React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
const {PillarCPublic}=await import('../components/pillar-c-public.tsx');
const {PublicCLineChart}=await import('../components/pillar-c-public-charts.tsx');
const render=(patch={},asset=data)=>renderToStaticMarkup(React.createElement(PillarCPublic,{data:asset,initial:{...C_PUBLIC_DEFAULTS,...patch}}));

test('only the exact public page bypasses authentication; private and bulk paths stay protected',()=>{
  assert.equal(isPublicPath('/pillar-c'),true);
  for(const p of ['/pillar-c/','/pillar-c/data','/pillar-cx','/api/pillar-c','/api/pillar-c/review','/dashboard-review/pillar-c','/Pillar-C'])assert.equal(isPublicPath(p),false,p);
});

test('the complete public import graph cannot reach private data, auth, Storage or workbook modules',()=>{
  const seen=new Set(),stack=['app/pillar-c/page.tsx'];
  while(stack.length){
    const file=stack.pop();if(seen.has(file))continue;seen.add(file);
    assert.doesNotMatch(file,/^(lib\/(?:dashboard-review|supabase|auth)|components\/dashboard-review|data\/(?!public-compiled))/);
    const source=read(file);if(file.endsWith('.json'))continue;
    const imports=[...source.matchAll(/(?:import|export)\s[^'";]*?from\s+["']([^"']+)["']|import\s*\(\s*["']([^"']+)["']/g)].map(m=>m[1]??m[2]);
    for(const spec of imports){
      assert.doesNotMatch(spec,/@supabase|recharts|workbook|scoped-storage|service-role/);
      if(!spec.startsWith('@/')&&!spec.startsWith('.'))continue;
      const base=spec.startsWith('@/')?spec.slice(2):path.join(path.dirname(file),spec);
      const resolved=['','.ts','.tsx','.json'].map(ext=>base+ext).find(p=>fs.existsSync(path.join(root,p)));
      assert.ok(resolved,`${file}: ${spec}`);stack.push(resolved.replaceAll('\\','/'));
    }
  }
  assert.ok(seen.has('data/public-compiled/pillar-c.json')&&seen.has('components/public-pillar-header.tsx'));
});

test('the public projection carries no private identifiers, workbook metadata or model diagnostics',()=>{
  const serialized=JSON.stringify(data),keys=new Set();
  function walk(v){if(Array.isArray(v))v.forEach(walk);else if(v&&typeof v==='object')for(const [k,x] of Object.entries(v)){keys.add(k);walk(x);}}
  walk(data);
  for(const key of ['workbookSha256','attivitaSha256','sourceState','ranges','admission','sigma','model','method','variants','budgets','recipients','scope','lineage','org','unit'])assert.equal(keys.has(key),false,key);
  assert.doesNotMatch(serialized,/ASL [1-4]|13020[1-4]|File F|ARIMA|ETS\(|MASE|Winkler|[a-f0-9]{64}/);
  assert.equal(data.schema,'public-pillar-c-v1');
  for(const ref of data.references){
    assert.deepEqual(Object.keys(ref).sort(),['id','licence','licenceUrl','name','url']);
    assert.ok(['www.aifa.gov.it','www.dati.salute.gov.it','www.salute.gov.it'].includes(new URL(ref.url).hostname));
  }
});

test('forecast admission and ordered intervals are preserved, with no unsupported class C',()=>{
  assert.deepEqual(data.forecast.series.map(s=>s.key),['TOT','A','H']);
  for(const s of data.forecast.series){
    assert.deepEqual(s.months.map(m=>m.month),Array.from({length:12},(_,i)=>i+1));
    for(const m of s.months)assert.ok(m.low95<=m.low80&&m.low80<=m.point&&m.point<=m.high80&&m.high80<=m.high95);
    assert.ok(s.annual.low95<=s.annual.low80&&s.annual.low80<=s.annual.total&&s.annual.total<=s.annual.high80&&s.annual.high80<=s.annual.high95);
  }
  assert.equal(forecastSeries(data,'C').key,'TOT');
});

test('regional comparisons exclude pooled national rows; selectors reject invented scopes and invalid years',()=>{
  assert.equal(regionalRows(data).length,21);
  assert.ok(regionalRows(data).every(r=>!r.name.startsWith('Italia')));
  const s=parsePublicCSelection(new URLSearchParams('region=Italia+%2821+unit%C3%A0%29&composition=atc&year=2018&series=C&band=99&org=130204&view2=raw'),data);
  assert.equal(s.region,'ABRUZZO');assert.equal(s.year,'2025');assert.equal(s.series,'TOT');assert.equal(s.band,'80');assert.equal(s.view2,'chart');
  assert.equal('org' in s,false);
  const valid=parsePublicCSelection(new URLSearchParams('region=LAZIO&series=H&band=95&view5=table'),data);
  assert.deepEqual(parsePublicCSelection(new URLSearchParams(publicCSearch(valid)),data),valid);
  assert.equal(publicCSearch({...C_PUBLIC_DEFAULTS}),'');
  assert.equal(territoryName('VALLE D\'AOSTA'),'Valle d’Aosta');
  assert.equal(territoryName('PA BOLZANO'),'P.A. Bolzano');
});

test('all five public sections have consistent controls, disclosures and table alternatives',()=>{
  const html=render();
  for(const s of C_PUBLIC_SECTIONS)assert.ok(html.includes(`id="${s.id}"`)&&html.includes(`aria-labelledby="${s.id}-title"`));
  assert.equal((html.match(/aria-label="Visualizzazione"/g)??[]).length,5);
  assert.equal((html.match(/Fonte e lettura dei dati/g)??[]).length,5);
  assert.equal((html.match(/<select /g)??[]).length,9);
  assert.ok(html.includes('448.983.754')&&html.includes('472.238.904')&&html.includes('338,12'));
  assert.doesNotMatch(html,/NaN|Infinity|MASE|ARIMA|Winkler/);
  const tables=render({view1:'table',view2:'table',view3:'table',view4:'table',view5:'table'});
  assert.equal((tables.match(/<table /g)??[]).length,5);
  assert.equal((tables.match(/<caption /g)??[]).length,5);
  assert.ok(tables.includes('scope="row"')&&tables.includes('scope="col"'));
  const amountTable=render({trend:'amount',view1:'table'});
  assert.ok(amountTable.includes('448.983.753,70 €'),'exact-value amounts retain cents instead of the chart’s million-euro scale');
});

test('every supported analysis variant renders without invalid values or replacing missing data with zero',()=>{
  for(const trend of ['index','amount','change'])for(const view1 of ['chart','table'])assert.doesNotMatch(render({trend,view1}),/NaN|Infinity/);
  for(const regional of ['direct','classA','classH','classC','conventional'])assert.doesNotMatch(render({regional,view2:'table'}),/NaN|Infinity/);
  for(const composition of ['classes','atc'])for(const year of composition==='atc'?['2024','2025']:data.trend.map(r=>String(r.year)))assert.doesNotMatch(render({composition,year,view3:'table'}),/NaN|Infinity/);
  for(const activity of ['rate','stay','occupancy','prescriptions','prescriptionCost'])assert.doesNotMatch(render({activity,view4:'table'}),/NaN|Infinity/);
  for(const diagnosis of ['rate','stay','admissions'])assert.doesNotMatch(render({context:'diagnoses',diagnosis,view4:'table'}),/NaN|Infinity/);
  for(const series of ['TOT','A','H'])for(const band of ['80','95'])assert.doesNotMatch(render({series,band,view5:'table'}),/NaN|Infinity/);
  const synthetic=structuredClone(data);synthetic.forecast.series[0].months[0].observed=null;synthetic.forecast.series[0].months[1].observed=0;
  const html=render({view5:'table'},synthetic),forecast=html.slice(html.indexOf('id="previsione"'));
  assert.match(forecast,/Gen<\/th><td[^>]*>—<\/td>/);assert.match(forecast,/Feb<\/th><td[^>]*>0,00 €<\/td>/);
});

test('a missing observation breaks the chart line rather than becoming an observed zero',()=>{
  const html=renderToStaticMarkup(React.createElement(PublicCLineChart,{title:'Synthetic discontinuity',labels:['1','2','3'],lines:[{name:'Test',values:[10,null,20],color:'black'}],format:String}));
  assert.equal((html.match(/<circle /g)??[]).length,2);
  assert.equal((html.match(/<path /g)??[]).length,2);
  assert.doesNotMatch(html,/NaN|Infinity/);
});
