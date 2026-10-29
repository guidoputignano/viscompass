// PB-Q2.1: the subcutaneous segments of the public composition chart, and their legend swatches, are filled
// url(#pbp-hatch-…). The patterns must reach the page. Recharts renders only the children it knows, so the <defs>
// that sat inside <BarChart> were dropped and every SC part was drawn as nothing. This renders the public page with
// its real asset and checks that every url(#id) the component uses resolves to a <pattern> in the markup, outside
// the chart. The drawn widths need a measured chart, so they are checked in the live pass.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {register,createRequire} from 'node:module';
import {fileURLToPath,pathToFileURL} from 'node:url';

const root=fileURLToPath(new URL('..',import.meta.url));
register('data:text/javascript,'+encodeURIComponent(`
import {readFileSync} from 'node:fs';import {fileURLToPath} from 'node:url';import {createRequire} from 'node:module';
let sucrase;export function initialize({pkg}){sucrase=createRequire(pkg)('sucrase');}
export async function resolve(s,c,n){return n(s==='next/link'?s+'.js':s,c);}
export async function load(u,c,n){if(u.startsWith('file:')&&u.endsWith('.tsx')){const f=fileURLToPath(u);return {format:'module',source:sucrase.transform(readFileSync(f,'utf8'),{transforms:['typescript','jsx'],jsxRuntime:'automatic',production:true,filePath:f}).code,shortCircuit:true};}return n(u,c);}
`),{data:{pkg:pathToFileURL(`${root}package.json`).href}});
const req=createRequire(`${root}package.json`),React=req('react'),{renderToStaticMarkup}=req('react-dom/server');
const {PillarBPublic}=await import('../components/pillar-b-public.tsx');
const {parseSelection,MOLECULES,MEASURES}=await import('../lib/pillar-b-public/ev-sc-view.ts');
const asset=JSON.parse(readFileSync(new URL('../data/public-compiled/pillar-b-aifa-ev-sc-2025.json',import.meta.url),'utf8'));
const source=readFileSync(new URL('../components/pillar-b-public.tsx',import.meta.url),'utf8').replace(/\r\n/g,'\n');

const render=(molecola,misura)=>renderToStaticMarkup(React.createElement(PillarBPublic,{asset,initial:parseSelection({molecola,misura},asset.territories)}));
// Fills written as string literals; comments that mention url(#id) are not fills.
const referenced=[...new Set([...source.matchAll(/["'`]url\(#([\w-]+)\)/g)].map(m=>m[1]))];

test('every url(#id) the page fills with is a pattern the page renders, for all nine tables',()=>{
  assert.deepEqual(referenced.sort(),['pbp-hatch-amber','pbp-hatch-teal'],'the two SC hatches, nothing else');
  for(const molecola of MOLECULES)for(const misura of MEASURES){
    const html=render(molecola,misura);
    const defined=[...html.matchAll(/<pattern id="([\w-]+)"/g)].map(m=>m[1]);
    for(const id of referenced)assert.equal(defined.filter(d=>d===id).length,1,`${molecola}/${misura}: #${id} defined exactly once`);
    // Each pattern paints a ground in its series colour and the hatch line in the card colour.
    for(const [id,color] of [['pbp-hatch-teal','#13998f'],['pbp-hatch-amber','#c27a1a']]){
      const body=html.slice(html.indexOf(`<pattern id="${id}"`)).split('</pattern>')[0];
      assert.match(body,new RegExp(`<rect width="6" height="6" fill="${color}"`),id);assert.match(body,/<line [^>]*stroke="hsl\(var\(--card\)\)"/,id);
    }
  }
});

test('the patterns sit in a zero-size hidden SVG beside the chart, never inside <BarChart>',()=>{
  const html=render('infliximab','confezioni');
  assert.match(html,/<svg width="0" height="0" aria-hidden="true" focusable="false" style="position:absolute"><defs><pattern id="pbp-hatch-teal"/);
  // The composition chart's own JSX holds no <defs> or <Hatches />: Recharts would drop them there.
  const chart=source.slice(source.indexOf('<BarChart data={composition}'),source.indexOf('</BarChart>',source.indexOf('<BarChart data={composition}')));
  assert.ok(chart.length>0);assert.doesNotMatch(chart,/<Hatches|<defs|<pattern/);
  assert.ok(source.indexOf('<Hatches />')<source.indexOf('<BarChart data={composition}'),'rendered before the chart, outside it');
  // Only the composition chart uses the hatches; the other two charts are solid fills.
  assert.equal((source.match(/fill=\{FILL\[c\]\}/g)||[]).length,1);
});
