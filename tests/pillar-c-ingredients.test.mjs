// Pillar C, the active ingredient in the portfolio dossier (joint feedback 2, G2-23): the closed schema of the labels,
// the restriction to the products of the view served, the loaders per audience, the real scoped portfolio route with
// the labels in a fake Storage, and the dossier's three states (labels, unreadable, not joined). Synthetic labels and
// AIC codes only; the private object is read, when present locally, for a pass/fail check against the pins.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {existsSync,readFileSync} from 'node:fs';
import {createRequire,register} from 'node:module';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {IDENTITY_STUBS,registerPillarCStubs,as,ORGS,viewer} from './helpers/pillar-c-scoped-stubs.mjs';
import {scopedFixture,fakeSessionClient} from './fixtures/pillar-c-scoped.mjs';

registerPillarCStubs({...IDENTITY_STUBS,
  'lib/dashboard-review/pillar-c/ingredients-storage.ts':`export const C_INGREDIENTS_STORAGE=new Proxy({},{get:(_,k)=>globalThis.__pcs.ing[k]});export const C_INGREDIENTS_MAX_BYTES=524288;`,
},{tsx:true});
register('data:text/javascript,'+encodeURIComponent(`export async function resolve(s,c,n){return n(s==='next/link'?'next/link.js':s,c);}`),import.meta.url);
const root=fileURLToPath(new URL('..',import.meta.url));
const req=createRequire(`${root}package.json`),React=req('react'),{renderToStaticMarkup}=req('react-dom/server');
const at=p=>import(pathToFileURL(`${root}${p}`).href);
const {parseCIngredients,cIngredientsFor,cPortfolioWithIngredients,loadCIngredientsReviewer,loadCIngredientsScoped}=await at('lib/dashboard-review/pillar-c/ingredients-loader.ts');
const {C_INGREDIENT_COPY,cIngredientOf}=await at('lib/dashboard-review/pillar-c/ingredients.ts');
const {buildCPortfolioPacket,cPortfolioView}=await at('lib/dashboard-review/pillar-c/portfolio.ts');
const {CPortfolioDossierView}=await at('components/dashboard-review/pillar-c/portfolio-dossier.tsx');
const {PillarCAudienceProvider}=await at('components/dashboard-review/pillar-c/audience-context.tsx');
const {C_REVIEWER_CLIENT_AUDIENCE}=await at('lib/dashboard-review/pillar-c/audience-rules.ts');
const {NextRequest}=await import('next/server.js');
const portfolioRoute=await at('app/api/pillar-c/portfolio/route.ts');

const sha=b=>createHash('sha256').update(b).digest('hex');
const refuse=(fn,reason)=>assert.throws(fn,e=>e instanceof Error&&e.message===`PILLAR_C_INGREDIENTS_${reason}`,reason);
const object=(entries={'914000001':'SOSTANZA SINTETICA UNO','914000002':'SOSTANZA SINTETICA DUE + SOSTANZA SINTETICA TRE','999999999':'SOSTANZA ESTRANEA'})=>({schema:'pillar-c-ingredients-v1',build:'ing-v1',source:'Elenchi sintetici',entries});
function fixtureOf(o=object()){
  const bytes=Buffer.from(JSON.stringify(o)),name=`principi-${sha(bytes)}.json`;
  return {bytes,pins:{build:'ing-v1',root:'v9',scoped:{unit:'aggregato',name,sha256:sha(bytes),bytes:bytes.length},reviewer:{bucket:'pillar-c-review',object:`ing1/${sha(bytes)}.json`,sha256:sha(bytes),bytes:bytes.length}},path:`v9/aggregato/${name}`};
}
const quiet=async fn=>{const w=console.warn;console.warn=()=>{};try{return await fn();}finally{console.warn=w;}};

// ================================================================ the labels
test('closed schema: four keys, nine-digit AICs, printable screened labels; a combination stays one label',()=>{
  const m=parseCIngredients(object());
  assert.equal(m.get('914000002'),'SOSTANZA SINTETICA DUE + SOSTANZA SINTETICA TRE');assert.equal(m.size,3);
  const bad=(o,reason)=>refuse(()=>parseCIngredients(o),reason);
  bad({...object(),extra:1},'KEYS');bad({...object(),schema:'x'},'HEADER');bad({...object(),entries:[]},'ENTRIES');bad(object({}),'EMPTY');
  bad(object({'91400000':'X'}),'AIC');bad(object({'E-unknown':'X'}),'AIC');
  bad(object({'914000001':''}),'LABEL');bad(object({'914000001':'x'.repeat(2001)}),'LABEL');bad(object({'914000001':'A\nB'}),'LABEL');bad(object({'914000001':'<b>A</b>'}),'LABEL');bad(object({'914000001':3}),'LABEL');
  bad(object({'914000001':'ACQUA DI PESCARA'}),'SCREEN');bad(object({'914000001':'LOTTO 130204'}),'SCREEN');
});

test('only the products of the view served: product changes, single-candidate and shared products; nothing else',()=>{
  const labels=parseCIngredients(object());
  const view={productChanges:[{key:'914000001'},{key:'E-unknown'}],dossier:{products:[{key:'914000001'}],sharedProducts:[{key:'914000002'}]}};
  assert.deepEqual(cIngredientsFor(view,labels),{'914000001':'SOSTANZA SINTETICA UNO','914000002':'SOSTANZA SINTETICA DUE + SOSTANZA SINTETICA TRE'});
  assert.deepEqual(cPortfolioWithIngredients(view,{state:'unavailable'}).ingredients,null,'unreadable: null, the view intact');
  assert.deepEqual(cPortfolioWithIngredients(view,{state:'ready',labels}).productChanges,view.productChanges);
  assert.equal(cIngredientOf(undefined,'914000001'),undefined);assert.equal(cIngredientOf(null,'914000001'),null);
  assert.equal(cIngredientOf({'914000001':'A'},'914000009'),C_INGREDIENT_COPY.absent);assert.equal(cIngredientOf({'914000001':'A'},'914000001'),'A');
  assert.equal(cIngredientOf({},'constructor'),C_INGREDIENT_COPY.absent,'no inherited property is a label');
});

// ================================================================ the loaders
test('reviewer loader: gated, pinned by size and hash, fails closed',async()=>{
  const fx=fixtureOf();as({pins:{root:'v1',bucket:'pillar-c-scoped'},client:()=>null});globalThis.__pcs.ing=fx.pins;
  let reads=0;const remote=async()=>{reads++;return {state:'ready',bytes:new Uint8Array(fx.bytes)};};
  assert.deepEqual(await loadCIngredientsReviewer(true,false,remote),{state:'forbidden'});assert.deepEqual(await loadCIngredientsReviewer(false,true,remote),{state:'forbidden'});assert.equal(reads,0);
  const ok=await loadCIngredientsReviewer(true,true,remote);assert.equal(ok.state,'ready');assert.equal(ok.labels.get('914000001'),'SOSTANZA SINTETICA UNO');
  const tampered=Buffer.from(fx.bytes);tampered[30]^=1;
  assert.deepEqual(await loadCIngredientsReviewer(true,true,async()=>({state:'ready',bytes:new Uint8Array(tampered)})),{state:'unavailable'});
  assert.deepEqual(await loadCIngredientsReviewer(true,true,async()=>({state:'invalid'})),{state:'unavailable'});
  assert.deepEqual(await loadCIngredientsReviewer(true,true,async()=>({state:'not_configured'})),{state:'not_configured'});
});

test('scoped loader: the aggregate folder under the audience’s own session; refused or absent is «unavailable»',async()=>{
  const fx=fixtureOf();as({pins:{root:'v1',bucket:'pillar-c-scoped'},client:()=>null});globalThis.__pcs.ing=fx.pins;
  const files={files:new Map([[fx.path,fx.bytes]])};
  const AZ={kind:'azienda',orgCode:'204',orgName:'Azienda sintetica Quattro',unit:'asl-4',units:['asl-4','aggregato']};
  const s=fakeSessionClient(files,{visible:['asl-4','aggregato']});
  const r=await loadCIngredientsScoped(AZ,s.client);
  assert.equal(r.state,'ready');assert.deepEqual(s.calls.downloads.map(d=>[d.bucket,d.path,d.params.cache]),[['pillar-c-scoped',fx.path,'no-store']]);
  assert.deepEqual(await quiet(()=>loadCIngredientsScoped(AZ,fakeSessionClient(files,{visible:['asl-4']}).client)),{state:'unavailable'},'the aggregate folder refused');
  assert.deepEqual(await quiet(()=>loadCIngredientsScoped(AZ,fakeSessionClient({files:new Map()},{visible:['asl-4','aggregato']}).client)),{state:'unavailable'},'absent');
  globalThis.__pcs.ing={...fx.pins,scoped:{...fx.pins.scoped,sha256:'0'.repeat(64)}};
  assert.deepEqual(await quiet(()=>loadCIngredientsScoped(AZ,fakeSessionClient(files,{visible:['asl-4','aggregato']}).client)),{state:'unavailable'},'another hash');
});

test('the real scoped portfolio route serves the labels of the view’s own products, under the member’s session',async()=>{
  const fixture=scopedFixture(),fx=fixtureOf();
  const session=fakeSessionClient({...fixture,files:new Map([...fixture.files,[fx.path,fx.bytes]])},{units:['asl-4','aggregato'],visible:['asl-4','aggregato']});
  as({org:ORGS['asl-4'],viewer:viewer(false),client:()=>session.client,pins:fixture.pins});globalThis.__pcs.ing=fx.pins;
  const before=process.env.VERCEL_ENV;process.env.VERCEL_ENV='production';
  try{
    const r=await portfolioRoute.GET(new NextRequest('https://vis.test/api/pillar-c/portfolio?period=FY2025&channel=Tutti&portfolio=AA&org=asl-4'));
    assert.equal(r.status,200);const body=await r.json();
    const keys=new Set([...body.productChanges.map(p=>p.key),...body.dossier.products.map(p=>p.key),...body.dossier.sharedProducts.map(p=>p.key)]);
    assert.ok(keys.has('914000001'));assert.deepEqual(Object.keys(body.ingredients),[...keys].filter(k=>k in object().entries).sort());
    assert.equal(body.ingredients['999999999'],undefined,'never a label of a product outside the view');
    assert.ok(session.calls.downloads.some(d=>d.path===fx.path),'read under the member’s own session');
  }finally{if(before===undefined)delete process.env.VERCEL_ENV;else process.env.VERCEL_ENV=before;}
});

// ================================================================ the dossier
const row=(key,c,year,state='S2',candidates=['AA'])=>({anno:year,mese:1,asl:'AQ',canale:'CO',prodotto_key:key,atc:'TEST',c,attribution_status:state,candidate_portfolios:candidates});
const viewOf=()=>{const packet=buildCPortfolioPacket([row('900000001','8',2024),row('900000001','10.005',2025),row('900000002','2',2025,'S3',['AA','BB']),row('E-unknown','1',2025)],[{id:'AA',label:'Area sintetica A',kind:'area_terapeutica'},{id:'BB',label:'Area sintetica B',kind:'area_terapeutica'}],new Map([['900000001','Prodotto sintetico A'],['900000002','Prodotto sintetico B']]),'1'.repeat(64),'2'.repeat(64),'fictional');return cPortfolioView(packet,'FY2025','AQ','CO','AA','3'.repeat(64));};
const dossier=view=>renderToStaticMarkup(React.createElement(PillarCAudienceProvider,{audience:C_REVIEWER_CLIENT_AUDIENCE},React.createElement(CPortfolioDossierView,{view})));
const headers=h=>{const t=h.slice(h.indexOf('aria-label="Tutti i contributi prodotto del portafoglio"'));return [...t.slice(0,t.indexOf('</thead>')).matchAll(/<th scope="col"[^>]*>([^<]*)<\/th>/g)].map(m=>m[1]);};

test('the dossier: a «Principio attivo» column and the shared detail when joined; «non disponibile» per product; an honest state when unreadable; no column when not joined',()=>{
  const v=viewOf();
  const joined=dossier({...v,ingredients:{'900000001':'SOSTANZA SINTETICA UNO','900000002':'SOSTANZA SINTETICA DUE'}});
  assert.deepEqual(headers(joined),['Prodotto','Principio attivo','Anno 2024','Anno 2025','Variazione','Presenza nei dati selezionati']);
  assert.match(joined,/<span class="line-clamp-3" title="SOSTANZA SINTETICA UNO">SOSTANZA SINTETICA UNO<\/span>/);
  assert.match(joined,/Principio attivo: SOSTANZA SINTETICA DUE<\/span><span[^>]*>ATC TEST · aree candidate: Area sintetica A, Area sintetica B/,'the shared detail: ingredient, ATC, named areas');
  assert.match(joined,/Cerca prodotto, principio attivo, AIC o ATC/);assert.match(joined,/data-c-ingredients="ready">Principio attivo dagli elenchi ufficiali AIFA/);
  const partial=dossier({...v,ingredients:{}});assert.match(partial,/<span class="line-clamp-3" title="non disponibile">non disponibile<\/span>/,'a product without a label');
  const unreadable=dossier({...v,ingredients:null});
  assert.match(unreadable,/data-c-ingredients="unavailable">Il principio attivo non è disponibile in questo momento: nessun nome viene ricavato dal marchio o dall’ATC\.<\/p>/);
  const plain=dossier(v);assert.deepEqual(headers(plain),['Prodotto','Anno 2024','Anno 2025','Variazione','Presenza nei dati selezionati']);assert.doesNotMatch(plain,/data-c-ingredients|Principio attivo/);
  // The search reads the ingredient too (state inside the dossier: pinned in the source).
  assert.ok(readFileSync(`${root}components/dashboard-review/pillar-c/portfolio-dossier.tsx`,'utf8').includes('`${r.key} ${r.label} ${r.atc} ${ing(r.key)??""}`'));
});

const PRIVATE=fileURLToPath(new URL('../../outputs/pillar-c/feedback-joint-2-20261027/claude-implementation/ingredients-delivery/',import.meta.url));
test('the private ingredient object passes the real parser and matches the pins in the repository (pass/fail only)',{skip:existsSync(`${PRIVATE}PINS_INGREDIENTS.json`)?false:'the private build is not available locally'},()=>{
  const pins=JSON.parse(readFileSync(`${PRIVATE}PINS_INGREDIENTS.json`,'utf8')),src=readFileSync(`${root}lib/dashboard-review/pillar-c/ingredients-storage.ts`,'utf8');
  for(const s of [pins.scoped.name,String(pins.scoped.bytes),pins.reviewer.object])assert.ok(src.includes(s),s.slice(0,24));
  const b=readFileSync(`${PRIVATE}objects/v9/aggregato/${pins.scoped.name}`);
  assert.equal(b.length,pins.scoped.bytes);assert.equal(sha(b),pins.scoped.sha256);assert.deepEqual(b,readFileSync(`${PRIVATE}objects/${pins.reviewer.object}`));
  assert.equal(parseCIngredients(JSON.parse(b)).size,5880);
});

test('copy and source rules of the ingredient modules',()=>{
  const read=p=>readFileSync(`${root}${p}`,'utf8');
  const copy=read('lib/dashboard-review/pillar-c/ingredients.ts');
  assert.doesNotMatch(copy,/import "server-only"|fetch\(|process\.env/);assert.doesNotMatch(copy,/verificat|\bdemo\b|dimostra/i);
  for(const f of ['lib/dashboard-review/pillar-c/ingredients-loader.ts','lib/dashboard-review/pillar-c/ingredients-storage.ts'])assert.match(read(f),/^import "server-only";/,f);
});
