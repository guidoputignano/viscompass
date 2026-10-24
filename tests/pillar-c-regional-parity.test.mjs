// Regional analytical parity (owner clarification of 23 Oct 2026): the Regione reads the reviewer's region-wide objects
// under its own session from pillar-c-scoped/<root>/regione/. Here: the price/quantity/mix object (loader, parser and
// exact parity with the reviewer's reading), the pins that tie the regional objects to the reviewer's, and the regional
// path builder. Synthetic data only: every value is invented.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {IDENTITY_STUBS,registerPillarCStubs,as} from './helpers/pillar-c-scoped-stubs.mjs';
import {fakeSessionClient} from './fixtures/pillar-c-scoped.mjs';

registerPillarCStubs({...IDENTITY_STUBS,
  'lib/dashboard-review/pillar-c/regional-storage.ts':`export const C_REGIONAL_STORAGE=new Proxy({},{get:(_,k)=>globalThis.__pcs.regional[k]});export const C_REGIONAL_MAX_BYTES=1000000;`,
});
const {loadCRegionalPvm}=await import('../lib/dashboard-review/pillar-c/regional-loader.ts');
const {cPortfolioPvm,parseCRegionalPvm}=await import('../lib/dashboard-review/pillar-c/portfolio-pvm.ts');
const {buildCPortfolioPacket,cPortfolioView}=await import('../lib/dashboard-review/pillar-c/portfolio.ts');
const {C_WORKBOOK_HASH}=await import('../lib/dashboard-review/pillar-c/workbook.ts');
const {cScopedRegionalPath,cScopedObjectPath,C_SCOPED_REGIONAL_FOLDER}=await import('../lib/dashboard-review/pillar-c/scoped-transport.ts');

const sha256=b=>createHash('sha256').update(b).digest('hex');
const SOURCE='ff084e85af09c38df52445019af479397ea8313df79c736c4098c60f7edb8eac';
const CLASSIFICATION='e2b3c5900036eec54fc01134d32d0f19bd9341db790916ced99b5152f9ad50aa';
const COSTI='c'.repeat(64);
const n=raw=>[String(raw),164];
const ALL=['aggregato','asl-1','asl-2','asl-3','asl-4'];
const REGIONE={kind:'regione',orgCode:'130',units:ALL};
const AZIENDA={kind:'azienda',orgCode:'203',orgName:'Azienda sintetica Tre',unit:'asl-3',units:['asl-3','aggregato']};

/** The reviewer's costi section (one synthetic ML-4-PORT-REAL output), the regional object built from it as the private
 * build does (the output verbatim), and the two portfolio views: the reviewer's «Regione», the Regione's «aggregato». */
function fixture(){
  const vocabulary=[{id:'AA',label:'Portafoglio sintetico A',kind:'area_terapeutica'}];
  const rows=[2024,2025].map(year=>({anno:year,mese:1,asl:'AQ',canale:'CO',prodotto_key:'900000001',atc:'TEST',c:year===2024?'100':'120',attribution_status:'S2',candidate_portfolios:['AA']}));
  const packet=buildCPortfolioPacket(rows,vocabulary,new Map(),SOURCE,CLASSIFICATION,'v0.1-2026-10-12');
  const reviewerView=cPortfolioView(packet,'FY2025','Regione','Tutti','AA','3'.repeat(64));
  const regionalView=structuredClone(reviewerView);regionalView.scope.org='aggregato';
  const table={sheet:'12A_ML4_Price_Vol_Mix',range:'A209:L234',startColumn:1,
    columns:['Portafoglio','Nome','Esito','Copertura t0','Copertura t1','Δ ammesso (€)','Quantità · Shapley (€)','Mix · Shapley (€)','Mix · LMDI (€)','Costo unitario · Shapley (€)','Livello','Stato di verifica'],
    headerRow:209,rows:[['AA',vocabulary[0].label,'parziale (50–80 %)',n('0.6'),n('0.7'),n('4'),n('6'),n('1'),n('0.8'),n('-3'),'Solo descrittivo','V2_IN_ATTESA']],sourceRows:[210],notes:[],numericColumns:[3,4,5,6,7,8,9]};
  const output={id:'ML-4-PORT-REAL',title:'Invented test only',section:'costi',tier:'Solo descrittivo',qualifier:'mappatura in bozza',grain:'portafoglio',ranges:['12A_ML4_Price_Vol_Mix!A209:L234'],availability:'snapshot',reason:null,sourceState:'WAIT-W',tables:[table]};
  const section={schema:'pillar-c-workbook-section-v1',workbookSha256:C_WORKBOOK_HASH,section:'costi',formats:{164:'#,##0.00 "€"'},outputs:[{...structuredClone(output),id:'ML-4-COV'},output]};
  const regional={schema:'pillar-c-regional-pvm-v1',workbookSha256:C_WORKBOOK_HASH,costiSha256:COSTI,formats:{164:'#,##0.00 "€"'},output};
  return {section,regional,reviewerView,regionalView};
}
function install(object){
  const body=Buffer.from(JSON.stringify(object)+'\n'),sha=sha256(body),name=`pvm-${sha}.json`;
  globalThis.__pcs.regional={root:'v9',pvm:{name,sha256:sha,bytes:body.length},costiSha256:COSTI};
  return {files:new Map([[`v9/regione/${name}`,body]]),name};
}
const quiet=async fn=>{const o=console.warn;console.warn=()=>{};try{return await fn();}finally{console.warn=o;}};

test('the Regione reads its price/quantity/mix object under its own session, and reads the reviewer’s numbers',async()=>{
  as({pins:{root:'v1',bucket:'pillar-c-scoped'},client:()=>null});
  const f=fixture(),fx=install(f.regional);
  const {client,calls}=fakeSessionClient(fx,{visible:[...ALL,'regione']});
  const r=await loadCRegionalPvm(REGIONE,client);
  assert.equal(r.state,'ready');
  assert.deepEqual(calls.downloads.map(d=>[d.bucket,d.path,d.params.cache]),[['pillar-c-scoped',`v9/regione/${fx.name}`,'no-store']]);
  // Exact parity: the same reading as the reviewer's fetched section, on the same portfolio, period and channel.
  const reviewer=cPortfolioPvm(f.section,f.reviewerView),regional=cPortfolioPvm(r.section,f.regionalView,'aggregato');
  assert.equal(reviewer.status,'ready');assert.deepEqual(regional,reviewer);
  // The aggregate key is the audience's: neither reading applies to the other's key.
  assert.deepEqual(cPortfolioPvm(r.section,f.reviewerView,'aggregato'),{status:'unsupported',reason:'scope'});
  assert.deepEqual(cPortfolioPvm(r.section,f.regionalView),{status:'unsupported',reason:'scope'});
  for(const org of ['asl-1','asl-4']){const v=structuredClone(f.regionalView);v.scope.org=org;assert.deepEqual(cPortfolioPvm(r.section,v,'aggregato'),{status:'unsupported',reason:'scope'},org);}
});

test('an Azienda never reads it; a refusal, other bytes or a changed object is «unavailable», never a value',async()=>{
  as({pins:{root:'v1',bucket:'pillar-c-scoped'},client:()=>null});
  const f=fixture(),fx=install(f.regional);
  const az=fakeSessionClient(fx,{visible:['asl-3','aggregato','regione']});
  assert.deepEqual(await loadCRegionalPvm(AZIENDA,az.client),{state:'forbidden'});assert.equal(az.calls.downloads.length,0);
  // Storage refuses the folder (an Azienda, a revoked member, the migration not applied).
  assert.deepEqual(await quiet(()=>loadCRegionalPvm(REGIONE,fakeSessionClient(fx,{visible:ALL}).client)),{state:'unavailable'});
  // Other bytes under the pinned name.
  const tampered=new Map(fx.files);const [path,body]=[...tampered][0];const b=Buffer.from(body);b[30]^=1;tampered.set(path,b);
  assert.deepEqual(await quiet(()=>loadCRegionalPvm(REGIONE,fakeSessionClient({files:tampered},{visible:[...ALL,'regione']}).client)),{state:'unavailable'});
  // Objects that are well pinned but wrong in content: each fails the parser or the screen.
  const mutants=[
    ['another schema',o=>{o.schema='pillar-c-regional-pvm-v2';}],['another workbook',o=>{o.workbookSha256='a'.repeat(64);}],
    ['another costi section',o=>{o.costiSha256='d'.repeat(64);}],['an extra key',o=>{o.lineage=[];}],
    ['another output',o=>{o.output.id='ML-4-PORT-SYN';}],['another section',o=>{o.output.section='spesa';}],
    ['a place name',o=>{o.output.tables[0].rows[0][1]='Portafoglio di Pescara';}],['a province key',o=>{o.output.title='Uscita TE';}],
    ['an NSIS code',o=>{o.output.tables[0].rows[0][10]='130203';}],['a broken table',o=>{o.output.tables[0].sourceRows=[];}],
    ['a cell format missing',o=>{o.formats={};}],['no formats',o=>{delete o.formats;}],
  ];
  for(const [label,mutate] of mutants){
    const m=fixture().regional;mutate(m);const mx=install(m);
    assert.deepEqual(await quiet(()=>loadCRegionalPvm(REGIONE,fakeSessionClient(mx,{visible:[...ALL,'regione']}).client)),{state:'unavailable'},label);
  }
  assert.throws(()=>parseCRegionalPvm(f.regional,'not-a-hash'),/PILLAR_C_REGIONAL_PVM/);
});

test('the regional path: <root>/regione/<pinned name>, never a unit, never another root or name',()=>{
  as({pins:{root:'v1',bucket:'pillar-c-scoped'},client:()=>null});
  const sha='e'.repeat(64),name=`ext1-${sha}.json`;
  assert.equal(C_SCOPED_REGIONAL_FOLDER,'regione');
  assert.equal(cScopedRegionalPath(name,sha,'v9'),`v9/regione/${name}`);
  for(const [n_,s,root] of [[name,'f'.repeat(64),'v9'],[name,sha,'v0'],[name,sha,'v9/asl-1'],[`../asl-1/${name}`,sha,'v9'],[`sub/${name}`,sha,'v9'],[name.toUpperCase(),sha,'v9'],[`ext1-${sha}.json?x`,sha,'v9']])
    assert.equal(cScopedRegionalPath(n_,s,root),null,`${n_} ${root}`);
  assert.equal(cScopedObjectPath('regione',name,sha,'v9'),null,'the unit path builder refuses the folder');
});

test('the pins: the regional extension object is the reviewer object, byte for byte; every regional pin is a policy path',()=>{
  const read=f=>readFileSync(new URL(`../${f}`,import.meta.url),'utf8');
  const regional=read('lib/dashboard-review/pillar-c/regional-storage.ts'),extension=read('lib/dashboard-review/pillar-c/extension-storage.ts');
  const pin=(src,key)=>{const m=new RegExp(`${key}: \\{ name: "([^"]+)", sha256: "([a-f0-9]{64})", bytes: ([0-9]+) \\}`).exec(src);return m&&{name:m[1],sha256:m[2],bytes:Number(m[3])};};
  const ext=pin(regional,'extension'),pvm=pin(regional,'pvm');
  const reviewer={sha256:/object: "ext1\/([a-f0-9]{64})\.json"/.exec(extension)[1],bytes:Number(/reviewer: \{[^}]*bytes: ([0-9]+)/.exec(extension)[1])};
  assert.deepEqual({sha256:ext.sha256,bytes:ext.bytes},reviewer,'the same bytes the reviewer reads');
  assert.equal(ext.name,`ext1-${ext.sha256}.json`);assert.equal(pvm.name,`pvm-${pvm.sha256}.json`);
  assert.equal(/root: "(v[1-9][0-9]{0,2})"/.exec(regional)[1],'v9');
  for(const p of [ext,pvm])assert.match(`v9/regione/${p.name}`,/^v[1-9][0-9]{0,2}\/(asl-[1-4]|aggregato|regione)\/[A-Za-z0-9]+(-[A-Za-z0-9]+)*-[0-9a-f]{64}[.]json$/);
  assert.ok(ext.bytes<=1_000_000&&pvm.bytes<=1_000_000,'under the read cap');
  assert.match(regional,/^import "server-only";/,'pins stay on the server');
});

// ---------------------------------------------------------------- modelled budgets and provenance (owner decision of 24 Oct 2026)
const {loadCRegionalReview}=await import('../lib/dashboard-review/pillar-c/regional-loader.ts');
const {parseCRegionalReview}=await import('../lib/dashboard-review/pillar-c/scoped-review.ts');
const H=n=>String(n).repeat(64).slice(0,64);
/** A synthetic regional review object: invented amounts, the shape the private build writes. */
function regionalReview(){
  const row=(unit,i,area,level='Disciplina',period='FY2025',channel='CO')=>({id:`${unit}-m-${String(i).padStart(4,'0')}`,period,org:unit,channel,level,area,basis:'synthetic',budget:`${100+i}.00`,actual:`${90+i}.5`,alternative:`${95+i}.25`});
  return {schema:'pillar-c-regional-review-v1',workbookVersion:'R5',workbookSha256:C_WORKBOOK_HASH,
    evidence:{financial:H('a'),budgetCount:H('b'),financialR5Review:H('c'),forecast:H('d')},sections:['spend','change','budget','counts','forecast'],
    budgets:[row('asl-1',1,'08'),row('asl-1',2,'09'),row('asl-2',1,'08'),row('asl-3',1,'12','Dipartimento','JM2026','DD'),row('asl-4',1,'08')]};
}
function installReview(object){
  const body=Buffer.from(JSON.stringify(object)+'\n'),sha=sha256(body),name=`revisione-${sha}.json`;
  globalThis.__pcs.regional={root:'v9',review:{name,sha256:sha,bytes:body.length}};
  return {files:new Map([[`v9/regione/${name}`,body]]),name};
}

test('the regional review object: closed, modelled rows of the four ASLs only, provenance as the reviewer\u2019s panels read it',()=>{
  const ok=parseCRegionalReview(regionalReview(),C_WORKBOOK_HASH);
  assert.equal(ok.budgets.length,5);assert.ok(ok.budgets.every(r=>r.basis==='synthetic'));
  assert.deepEqual(ok.provenance,{workbookVersion:'R5',workbookSha256:C_WORKBOOK_HASH,evidence:regionalReview().evidence,sections:['spend','change','budget','counts','forecast']});
  const bad=[
    ['a published act',o=>{o.budgets[0].basis='published';}],['another unit\u2019s id',o=>{o.budgets[0].id='asl-2-m-0009';}],
    ['an aggregate row',o=>{o.budgets[0].org='aggregato';o.budgets[0].id='aggregato-m-0001';}],['a province key',o=>{o.budgets[0].org='TE';}],
    ['an unknown key',o=>{o.lineage=[];}],['a row key too many',o=>{o.budgets[0].note='x';}],['another workbook',o=>{o.workbookSha256=H('e');}],
    ['an unknown receipt',o=>{o.evidence.reviewer=H('f');}],['a receipt missing',o=>{delete o.evidence.budgetCount;}],['a receipt not a hash',o=>{o.evidence.financial='x';}],
    ['an unknown section',o=>{o.sections.push('workbook');}],['a section twice',o=>{o.sections.push('spend');}],['no row',o=>{o.budgets=[];}],
    ['two rows for one area',o=>{o.budgets[1].area='08';}],['an area that is not one',o=>{o.budgets[0].area='Pescara';}],['an unpaired allocation',o=>{o.budgets[0].actual=null;}],
    ['a version with a newline',o=>{o.workbookVersion='R5\nx';}],
  ];
  for(const [label,mutate] of bad){const o=regionalReview();mutate(o);assert.throws(()=>parseCRegionalReview(o,C_WORKBOOK_HASH),/PILLAR_C_SCOPED_/,label);}
});

test('the Regione reads its regional review object under its own session; an Azienda never; any defect is «unavailable»',async()=>{
  as({pins:{root:'v1',bucket:'pillar-c-scoped'},client:()=>null});
  const fx=installReview(regionalReview());
  const s=fakeSessionClient(fx,{visible:[...ALL,'regione']});
  const r=await loadCRegionalReview(REGIONE,s.client);
  assert.equal(r.state,'ready');assert.equal(r.review.budgets.length,5);
  assert.deepEqual(s.calls.downloads.map(d=>[d.bucket,d.path,d.params.cache]),[['pillar-c-scoped',`v9/regione/${fx.name}`,'no-store']]);
  const az=fakeSessionClient(fx,{visible:['asl-3','aggregato','regione']});
  assert.deepEqual(await loadCRegionalReview(AZIENDA,az.client),{state:'forbidden'});assert.equal(az.calls.downloads.length,0);
  assert.deepEqual(await quiet(()=>loadCRegionalReview(REGIONE,fakeSessionClient(fx,{visible:ALL}).client)),{state:'unavailable'},'folder refused');
  const tampered=new Map(fx.files);const [p,b]=[...tampered][0];const t=Buffer.from(b);t[40]^=1;tampered.set(p,t);
  assert.deepEqual(await quiet(()=>loadCRegionalReview(REGIONE,fakeSessionClient({files:tampered},{visible:[...ALL,'regione']}).client)),{state:'unavailable'},'other bytes');
  const placed=regionalReview();placed.workbookVersion='R5 Pescara';const px=installReview(placed);
  assert.deepEqual(await quiet(()=>loadCRegionalReview(REGIONE,fakeSessionClient(px,{visible:[...ALL,'regione']}).client)),{state:'unavailable'},'a place name');
});
