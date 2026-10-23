// Pillar C organisation-scoped delivery: the page's server branches under synthetic identities. The client
// components are recorders, so the exact props each audience receives are asserted; the reviewer branch is
// pinned byte-identical (markup, props and loader calls) to the page before recommendation 5.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {IDENTITY_STUBS,registerPillarCStubs,as,ORGS,viewer} from './helpers/pillar-c-scoped-stubs.mjs';
import {PAGE_STUBS,reviewerPageMatrix,reviewerPageCases} from './helpers/pillar-c-page-matrix.mjs';
import {scopedFixture,fakeSessionClient,SCOPED_UNITS,SENTINEL} from './fixtures/pillar-c-scoped.mjs';
import {cReviewV2Fixture} from './fixtures/pillar-c-review.mjs';

registerPillarCStubs({...IDENTITY_STUBS,...PAGE_STUBS},{tsx:true});
const {renderToStaticMarkup}=createRequire(new URL('../package.json',import.meta.url))('react-dom/server');
const {default:PillarCPage}=await import('../app/dashboard-review/pillar-c/page.tsx');
const {parseCReviewPacket}=await import('../lib/dashboard-review/pillar-c/review.ts');

const fixture=scopedFixture();
const FORECAST={state:'ready',data:{forecast:{fixture:'public regional forecast'}}};
async function withProduction(fn){const before=process.env.VERCEL_ENV;process.env.VERCEL_ENV='production';try{return await fn();}finally{if(before===undefined)delete process.env.VERCEL_ENV;else process.env.VERCEL_ENV=before;}}
function member(orgKey,{units,visible=units,forecast=FORECAST,rpcError=null}={}){
  const session=fakeSessionClient(fixture,{units,visible,rpcError});
  const state=Object.assign(as({org:ORGS[orgKey],viewer:viewer(false),client:()=>session.client,pins:fixture.pins}),{rendered:[],forecast,review:{state:'ready',packet:{reviewerOnly:true}},workbook:{state:'ready',index:{reviewerOnly:true}}});
  return {state,calls:session.calls};
}
const render=async()=>renderToStaticMarkup(await PillarCPage());
const quiet=async fn=>{const o=console.warn;console.warn=()=>{};try{return await fn();}finally{console.warn=o;}};

test('reviewer and no-membership branches are byte-identical to the page before recommendation 5',async()=>{
  // Baseline: the same cases rendered from app/dashboard-review/pillar-c/page.tsx at 30e9e57.
  const packet=parseCReviewPacket(cReviewV2Fixture());
  const json=await withProduction(()=>reviewerPageMatrix(PillarCPage,renderToStaticMarkup,reviewerPageCases({as,ORGS,viewer,packet})));
  assert.equal(createHash('sha256').update(json).digest('hex'),'28295723d11c97580a0403e8157a0c62ff7b49c9d74e88946ca8c7924bb2654e');
  // And explicitly: the reviewer gets the packet and the workbook index exactly as loaded, with (true, true).
  const state=reviewerPageCases({as,ORGS,viewer,packet})[3][1]();state.rendered=[];
  await withProduction(render);
  assert.deepEqual(state.reads,[['review',true,true],['workbook-index',true,true]]);
  assert.equal(state.rendered.length,1);assert.equal(state.rendered[0][0],'PillarCAnalyticalWorkspace');
  assert.equal(state.rendered[0][1].packet,state.review.packet,'the same object, not a copy');assert.equal(state.rendered[0][1].workbook,state.workbook.index);
  assert.deepEqual(Object.keys(state.rendered[0][1]),['packet','workbook']);
  // Interface step: the reviewer branch passes the reviewer audience explicitly (the audience is mandatory), and only it.
  const {C_REVIEWER_CLIENT_AUDIENCE}=await import('../lib/dashboard-review/pillar-c/audience-rules.ts');
  assert.deepEqual(state.audiences,[C_REVIEWER_CLIENT_AUDIENCE]);assert.equal(state.audiences[0].kind,'reviewer');
  // Extension (points 15-16): read through the reviewer gate with the same arguments; an unavailable extension is passed as null.
  assert.deepEqual(state.extReads,[['extension-reviewer',true,true]]);assert.deepEqual(state.extensions,[null]);
  assert.deepEqual(state.extensionUnavailable,[true],'an extension that could not be read is «not available», never «not counted»');
  const ready={state:'ready',view:{units:[],drivers:null,baskets:null,fileFBasket:null}};
  const again=reviewerPageCases({as,ORGS,viewer,packet})[3][1]();again.rendered=[];again.extension=ready;
  await withProduction(render);assert.equal(again.extensions[0],ready.view,'the loaded view, not a copy');
});

test('an approved member who is not enabled keeps the public forecast, with the not-active line, and no private read',async()=>{
  for(const [setup,label] of [[()=>member('asl-4',{units:[]}),'no unit'],[()=>member('regione',{units:['aggregato']}),'units mismatch']]){
    const {state,calls}=setup();
    const html=await quiet(()=>withProduction(render));
    assert.match(html,/data-pillar-c-scope="forecast_only"/,label);assert.match(html,/Le analisi di dettaglio di Pillar C per la tua organizzazione non sono ancora attive\./);
    assert.deepEqual(state.rendered,[['PillarCRegionalForecastWorkspace',{forecast:FORECAST.data.forecast}]]);
    assert.deepEqual(state.reads,[['forecast',true]],'never the reviewer packet or workbook');
    assert.equal(calls.downloads.length,0);assert.equal(calls.rpc.length,1);assert.equal(state.serviceRole,0);
  }
  // Outside production the units function is not even called.
  const {state,calls}=member('asl-4',{units:['aggregato','asl-4']});
  const html=await render();
  assert.match(html,/data-pillar-c-scope="forecast_only"/);assert.equal(calls.rpc.length,0);assert.equal(calls.downloads.length,0);
  assert.deepEqual(state.reads,[['forecast',true]]);
  const unavailable=member('asl-4',{units:[],forecast:{state:'invalid'}});
  assert.match(await withProduction(render),/La previsione non è disponibile in questo momento\. Nessun valore viene sostituito\./);
  assert.deepEqual(unavailable.state.rendered,[]);
});

test('forecast-only members read one honest line per reason: unavailable is never «not active», unmapped promises nothing (UI-1)',async()=>{
  const {C_FORECAST_ONLY_NOTES:N}=await import('../lib/dashboard-review/pillar-c/audience-rules.ts');
  const line=html=>html.match(/<p role="note"[^>]*>([^<]*)<\/p>/)?.[1];
  const check=async(setup,expected,label,{production=true,rpc}={})=>{
    const {state,calls}=setup();
    const html=await quiet(()=>production?withProduction(render):render());
    assert.match(html,/data-pillar-c-scope="forecast_only"/,label);
    assert.equal(line(html),expected,label);
    assert.equal((html.match(/role="note"/g)??[]).length,1,`${label}: one line`);
    assert.deepEqual(state.rendered,[['PillarCRegionalForecastWorkspace',{forecast:FORECAST.data.forecast}]],label);
    assert.deepEqual(state.reads,[['forecast',true]],`${label}: never the reviewer packet or workbook`);
    assert.equal(calls.downloads.length,0,label);assert.equal(state.serviceRole,0,label);
    if(rpc!==undefined)assert.equal(calls.rpc.length,rpc,`${label}: units calls`);
    return html;
  };
  // units_unavailable: an ENABLED member whose units call fails (missing function, timeout, any PostgREST error).
  for(const rpcError of ['PGRST202','57014','PGRST000']){
    const html=await check(()=>member('asl-4',{units:['aggregato','asl-4'],rpcError}),N.unavailable,`units call ${rpcError}`,{rpc:1});
    assert.doesNotMatch(html,/attiv/,'an outage is never presented as «not active»');
    assert.equal(line(html),'Le analisi di dettaglio non sono disponibili in questo momento.',`units call ${rpcError}: the exact line`);
    assert.doesNotMatch(line(html),/riprov|più tardi/i,'the cause may be permanent: no promise that retrying helps (F-COPY-1)');
  }
  // A malformed answer is unavailable too, never an entitlement.
  await check(()=>member('regione',{units:'aggregato'}),N.unavailable,'malformed units',{rpc:1});
  // not_enabled and units_mismatch: an organisation the decisions cover, not (coherently) switched on.
  await check(()=>member('asl-1',{units:[]}),N.notEnabled,'not enabled',{rpc:1});
  await check(()=>member('regione',{units:['aggregato','asl-1']}),N.notEnabled,'units mismatch',{rpc:1});
  // unmapped (another region) and not_production: no promise of an activation, and no units call at all.
  for(const [setup,label,production] of [[()=>member('otherRegionAsl',{units:['aggregato','asl-4']}),'another region',true],[()=>member('asl-4',{units:['aggregato','asl-4']}),'outside production',false]]){
    const html=await check(setup,N.notCovered,label,{production,rpc:0});
    assert.doesNotMatch(html,/ancora/,`${label}: no «yet»`);
  }
});

test('an enabled Azienda receives its own unit and the aggregate, its client audience and the public forecast, nothing else',async()=>{
  const {state,calls}=member('asl-3',{units:['aggregato','asl-3']});
  await withProduction(render);
  assert.equal(state.rendered.length,1);
  const [name,props]=state.rendered[0];
  assert.equal(name,'PillarCScopedWorkspace');assert.deepEqual(Object.keys(props),['audience','packet','forecast']);
  assert.equal(props.forecast,FORECAST.data.forecast);
  assert.deepEqual(props.audience.orgs,[{key:'asl-3',label:'Azienda sintetica Tre'},{key:'aggregato',label:'Aggregato delle quattro Aziende'}]);
  assert.equal(props.audience.kind,'azienda');assert.equal(props.audience.exportLabel,'Riservato a Azienda sintetica Tre · dati della propria Azienda e aggregato delle quattro Aziende');
  assert.deepEqual(props.packet.orgs,['asl-3','aggregato']);assert.equal(props.packet.monthlyMode,'explicit');
  const json=JSON.stringify(props);
  for(const unit of SCOPED_UNITS)assert.equal(json.includes(SENTINEL[unit]),['asl-3','aggregato'].includes(unit),unit);
  assert.doesNotMatch(json,/"(asl-1|asl-2|asl-4|Regione|AQ|CH|PE|TE)"|"lineage":\[|"evidence":\{|workbookSha256|"synthetic"/);
  assert.deepEqual(state.reads,[['forecast',true]],'never the reviewer packet or workbook');assert.equal(state.serviceRole,0);
  assert.ok(calls.downloads.every(d=>/^v1\/(asl-3|aggregato)\//.test(d.path)&&d.params.cache==='no-store'));
  // Extension: the audience's own units, labelled by its client audience, under the same session; never the reviewer read.
  assert.deepEqual(state.extReads,[['extension-scoped',['asl-3','aggregato'],['Azienda sintetica Tre','Aggregato delle quattro Aziende']]]);
  assert.deepEqual(state.extensions,[null]);assert.deepEqual(state.extensionUnavailable,[true],'unreadable, so «not available»');
});

test('an enabled Regione receives the aggregate and ASL 1–4 under opaque keys, with no province key anywhere',async()=>{
  const {state}=member('regione',{units:SCOPED_UNITS});
  await withProduction(render);
  const [name,props]=state.rendered[0];
  assert.equal(name,'PillarCScopedWorkspace');
  assert.deepEqual(props.packet.orgs,['aggregato','asl-1','asl-2','asl-3','asl-4']);
  assert.deepEqual(props.audience.orgs.map(o=>o.label),['Aggregato regionale','ASL 1','ASL 2','ASL 3','ASL 4']);
  assert.ok(props.packet.budgets.length>0&&props.packet.budgets.every(b=>b.basis==='published'));
  assert.doesNotMatch(JSON.stringify(props),/(^|[^A-Za-z])(AQ|CH|PE|TE)([^A-Za-z]|$)|"Regione"|"lineage":\[|"evidence":\{|workbookSha256/);
  assert.deepEqual(state.reads,[['forecast',true]]);
});

test('an entitled unit that cannot be read shows the honest unavailable line and the public forecast, never another view',async()=>{
  const {state}=member('asl-4',{units:['aggregato','asl-4'],visible:['asl-4']});
  const html=await quiet(()=>withProduction(render));
  assert.match(html,/data-pillar-c-scope="scoped-azienda-unavailable"/);
  assert.match(html,/Le analisi di Pillar C per la tua organizzazione non sono disponibili in questo momento\. Nessun valore viene sostituito\./);
  assert.deepEqual(state.rendered,[['PillarCRegionalForecastWorkspace',{forecast:FORECAST.data.forecast}]]);
  assert.deepEqual(state.reads,[['forecast',true]]);
});
