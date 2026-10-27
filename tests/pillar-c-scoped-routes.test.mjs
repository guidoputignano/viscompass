// Pillar C organisation-scoped delivery: the REAL route handlers under synthetic identities. Scoped
// audiences are served by the real audience, loader, transport and guard against a synthetic bucket whose
// fake Storage answers like RLS; reviewer loaders are stubs, and reviewer responses are pinned
// byte-identical to the handlers before recommendation 5.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {IDENTITY_STUBS,registerPillarCStubs,as,ORGS,viewer} from './helpers/pillar-c-scoped-stubs.mjs';
import {REVIEWER_LOADER_STUBS,reviewerRouteMatrix} from './helpers/pillar-c-reviewer-route-matrix.mjs';
import {scopedFixture,fakeSessionClient,SCOPED_UNITS,SENTINEL} from './fixtures/pillar-c-scoped.mjs';

registerPillarCStubs({...IDENTITY_STUBS,...REVIEWER_LOADER_STUBS});
const {NextRequest}=await import('next/server.js');
const attribution=await import('../app/api/pillar-c/attribution/route.ts');
const portfolio=await import('../app/api/pillar-c/portfolio/route.ts');
const workbook=await import('../app/api/pillar-c/workbook/route.ts');
const evidence=await import('../app/api/pillar-c/evidence/route.ts');
const evidenceCase=await import('../app/api/pillar-c/evidence/[id]/route.ts');
const evidenceFile=await import('../app/api/pillar-c/evidence/[id]/attachment/route.ts');

const ORIGIN='https://vis.test',UUID='6f1c2a3b-4d5e-4f60-8a71-92b3c4d5e6f7';
const fixture=scopedFixture();
const AUDIENCE_UNITS={'asl-1':['asl-1','aggregato'],'asl-2':['asl-2','aggregato'],'asl-3':['asl-3','aggregato'],'asl-4':['asl-4','aggregato'],regione:SCOPED_UNITS};
/** A member: `units` is what the database function answers; Storage admits exactly `visible` (RLS). */
function member(orgKey,{units=AUDIENCE_UNITS[orgKey],visible=units,fail=null}={}){
  const session=fakeSessionClient(fixture,{units,visible,fail});
  const state=as({org:ORGS[orgKey],viewer:viewer(false),client:()=>session.client,pins:fixture.pins});
  return {state,calls:session.calls};
}
const get=path=>new NextRequest(`${ORIGIN}${path}`);
const HEADERS=r=>{assert.equal(r.headers.get('cache-control'),'private, no-store, max-age=0');assert.equal(r.headers.get('vary'),'Cookie');assert.equal(r.headers.get('x-content-type-options'),'nosniff');};
const quiet=async fn=>{const o=console.warn;console.warn=()=>{};try{return await fn();}finally{console.warn=o;}};
async function withProduction(fn){const before=process.env.VERCEL_ENV;process.env.VERCEL_ENV='production';try{return await fn();}finally{if(before===undefined)delete process.env.VERCEL_ENV;else process.env.VERCEL_ENV=before;}}
const ATTR=(org,q='period=FY2025&channel=Tutti')=>`/api/pillar-c/attribution?${q}&org=${org}`;
const PORT=(org,q='period=FY2025&channel=Tutti&portfolio=AA')=>`/api/pillar-c/portfolio?${q}&org=${org}`;
const allRoutes=()=>[
  ...['FY2025','JM2026'].flatMap(p=>['Regione','AQ','TE','asl-1','asl-4','aggregato'].map(o=>()=>attribution.GET(get(`/api/pillar-c/attribution?period=${p}&org=${o}&channel=Tutti`)))),
  ()=>portfolio.GET(get(PORT('asl-4'))),()=>portfolio.GET(get(PORT('TE'))),
  ...['spesa','costi','evidenza','bogus','../index'].map(s=>()=>workbook.GET(get(`/api/pillar-c/workbook?section=${encodeURIComponent(s)}`))),
  ()=>evidence.GET(),
  ()=>evidenceCase.GET(get(`/api/pillar-c/evidence/${UUID}`),{params:Promise.resolve({id:UUID})}),
  ()=>evidenceFile.GET(get(`/api/pillar-c/evidence/${UUID}/attachment?attachment=${UUID}`),{params:Promise.resolve({id:UUID})}),
  ()=>evidence.POST(new NextRequest(`${ORIGIN}/api/pillar-c/evidence`,{method:'POST',headers:{origin:ORIGIN,'content-type':'application/json'},body:JSON.stringify({group:'0'.repeat(64)})})),
  ()=>evidence.PATCH(new NextRequest(`${ORIGIN}/api/pillar-c/evidence`,{method:'PATCH',headers:{origin:ORIGIN,'content-type':'application/json'},body:JSON.stringify({action:'reopen',caseId:UUID,payload:{},revision:1})})),
];

test('reviewer responses are byte-identical to the handlers before recommendation 5',async()=>{
  // Baseline: the same matrix run on app/api/pillar-c/{attribution,portfolio,workbook}/route.ts at 30e9e57.
  const client=()=>({rpc:async()=>({data:[],error:null}),auth:{getUser:async()=>({data:{user:null},error:null})},storage:{from(){throw Error('no storage');}}});
  const identities=[
    ['reviewer',()=>as({org:ORGS['asl-4'],viewer:viewer(true),client})],
    ['admin',()=>as({org:ORGS.regione,viewer:viewer(false,'admin@example.org'),admin:'admin@example.org',client})],
    ['anonymous',()=>as({org:null,viewer:null,client})],
    ['reviewerWithoutMembership',()=>as({org:null,viewer:viewer(true),client})],
    ['memberNotEnabled',()=>as({org:ORGS['asl-4'],viewer:viewer(false),client})],
  ];
  const json=await withProduction(()=>reviewerRouteMatrix({attribution,portfolio,workbook},NextRequest,identities));
  // Re-recorded on 27 Oct 2026 (G2-23): the portfolio route joins the active ingredients of the view's own products. Here
  // they cannot be read, so each of the 56 reviewer portfolio views gains exactly ,"ingredients":null; without that field
  // the matrix hashes to the earlier pin 3dd2727e… byte for byte.
  assert.equal(createHash('sha256').update(json).digest('hex'),'67c5e752b5ed93c646f67fd945082671e2f6736116ca9a46e309ac01d33dcbaf');
});

test('without an entitled audience every Pillar C route answers 403 forbidden before any read',async()=>{
  const cases=[
    ['anonymous',()=>as({org:null,viewer:null,client:()=>fakeSessionClient(fixture,{units:SCOPED_UNITS,visible:SCOPED_UNITS}).client,pins:fixture.pins})],
    ['not enabled (no unit)',()=>member('asl-4',{units:[],visible:[]}).state],
    ['enabled in the database, not production',()=>member('asl-4').state],
    ['other region',()=>{const s=fakeSessionClient(fixture,{units:['aggregato','asl-4'],visible:['aggregato','asl-4']});return as({org:ORGS.otherRegionAsl,viewer:viewer(false),client:()=>s.client,pins:fixture.pins});}],
    ['units mismatch',()=>member('asl-4',{units:['aggregato','asl-1']}).state],
  ];
  for(const [name,set] of cases){
    const run=async()=>{
      for(const call of allRoutes()){
        const state=set();const r=await quiet(call);
        assert.equal(r.status,403,name);assert.deepEqual(await r.json(),{error:'forbidden'},name);HEADERS(r);
        assert.deepEqual(state.reads,[],`${name}: no reviewer loader`);assert.equal(state.serviceRole,0,`${name}: no service role`);
      }
    };
    if(name.includes('not production'))await run();else await withProduction(run);
  }
});

test('an enabled Azienda: its own key and the aggregate are served under its session, nothing else',async()=>{
  await withProduction(async()=>{
    for(const key of ['asl-4','aggregato']){
      for(const [path,kind] of [[ATTR(key),'attribution'],[PORT(key),'portfolio'],[ATTR(key,'period=JM2026&channel=CO'),'attribution']]){
        const {state,calls}=member('asl-4');
        const r=await (kind==='attribution'?attribution:portfolio).GET(get(path));
        assert.equal(r.status,200,path);HEADERS(r);assert.match(r.headers.get('server-timing'),/^pcs;dur=\d+(\.\d)?$/);
        const body=await r.json();
        assert.equal(body.scope.org,key);assert.equal((kind==='portfolio'?body.comparison.scope:body.comparison).org,key);
        assert.equal(body.sourceSnapshot,fixture.pins.index[key]);
        // G2-23: a portfolio also reads the ingredient labels once, from the aggregate folder the Azienda holds.
        const labels=calls.downloads.filter(d=>d.path.startsWith('v9/aggregato/principi-'));
        assert.equal(labels.length,kind==='portfolio'?1:0,'one read of the ingredient labels, for a portfolio only');
        assert.ok(calls.downloads.every(d=>d.bucket==='pillar-c-scoped'&&d.params.cache==='no-store'&&(labels.includes(d)||d.path.startsWith(`v1/${key}/`))));
        assert.equal(calls.downloads.length,kind==='portfolio'?4:3);assert.deepEqual(calls.rpc,[['pillar_c_scoped_units',undefined]]);
        if(kind==='portfolio')assert.equal(body.ingredients,null,'labels not in this bucket: null, never guessed');
        assert.deepEqual(state.reads,[],'never a reviewer loader');assert.equal(state.serviceRole,0,'never the service role');
        for(const other of SCOPED_UNITS.filter(u=>u!==key))assert.equal(JSON.stringify(body).includes(`"org":"${other}"`),false);
      }
    }
  });
});

test('tampered organisation keys are 403 forbidden_scope and malformed queries 400 invalid_scope, with zero Storage reads',async()=>{
  await withProduction(async()=>{
    const forbidden=['asl-1','asl-2','asl-3','AQ','CH','PE','TE','Regione','regione','REGIONE','ASL-4','Asl-4','asl4','asl-04','asl-0','asl-5','%20asl-4','asl-4%20','asl-4%00','asl-4%0A','asl-4,aggregato','asl-4%7Caggregato','..%2Fasl-1','aggregato%2F..%2Fasl-1','AGGREGATO',''];
    for(const org of forbidden)for(const path of [ATTR(org),PORT(org)]){
      const {calls}=member('asl-4');const r=await (path.includes('portfolio')?portfolio:attribution).GET(get(path));
      assert.equal(r.status,403,path);assert.deepEqual(await r.json(),{error:'forbidden_scope'});HEADERS(r);assert.equal(calls.downloads.length,0,path);
    }
    const invalid=['period=FY2025&channel=Tutti','period=FY2025&channel=Tutti&org=asl-4&org=asl-4','period=FY2025&channel=Tutti&org=asl-4&org=asl-1','period=FY2025&period=FY2024&channel=Tutti&org=asl-4',
      'period=FY2025&channel=Tutti&channel=CO&org=asl-4','channel=Tutti&org=asl-4','period=FY2025&org=asl-4','period=FY2023&channel=Tutti&org=asl-4','period=FY2025&channel=ALL&org=asl-4','period=fy2025&channel=Tutti&org=asl-4'];
    for(const q of invalid){
      const {calls}=member('asl-4');const r=await attribution.GET(get(`/api/pillar-c/attribution?${q}`));
      assert.equal(r.status,400,q);assert.deepEqual(await r.json(),{error:'invalid_scope'});HEADERS(r);assert.equal(calls.downloads.length,0);
    }
    for(const p of ['','&portfolio=aa','&portfolio=ABCDEFGHIJKLM','&portfolio=AA&portfolio=BB','&portfolio=A']){
      const {calls}=member('asl-4');const r=await portfolio.GET(get(`/api/pillar-c/portfolio?period=FY2025&channel=Tutti&org=asl-4${p}`));
      assert.equal(r.status,400,p);assert.deepEqual(await r.json(),{error:'invalid_scope'});assert.equal(calls.downloads.length,0);
    }
  });
});

test('an enabled Regione: the aggregate and ASL 1–4 are served; province keys and the reviewer key are refused',async()=>{
  await withProduction(async()=>{
    for(const key of SCOPED_UNITS){
      const {calls}=member('regione');const r=await attribution.GET(get(ATTR(key,'period=JM2025&channel=DD')));
      assert.equal(r.status,200,key);const text=await r.text();
      assert.equal(JSON.parse(text).scope.org,key);assert.doesNotMatch(text,/"(AQ|CH|PE|TE|Regione)"/);
      assert.ok(calls.downloads.every(d=>d.path.startsWith(`v1/${key}/`)));
    }
    for(const key of ['AQ','CH','PE','TE','Regione','ASL-1','asl1','asl-1,asl-2']){
      const {calls}=member('regione');const r=await portfolio.GET(get(PORT(key)));
      assert.equal(r.status,403,key);assert.deepEqual(await r.json(),{error:'forbidden_scope'});assert.equal(calls.downloads.length,0);
    }
  });
});

test('an entitled unit Storage refuses or lacks is 503 unavailable, never shown as not entitled',async()=>{
  await withProduction(async()=>{
    for(const [options,label] of [[{visible:['asl-4']},'RLS refuses the aggregate'],[{fail:'5xx'},'transport'],[{fail:'throw'},'network']]){
      const {calls}=member('asl-4',options);
      const r=await quiet(()=>attribution.GET(get(ATTR('aggregato'))));
      assert.equal(r.status,503,label);assert.deepEqual(await r.json(),{error:'unavailable'});HEADERS(r);assert.match(r.headers.get('server-timing'),/^pcs;dur=/);
      assert.ok(calls.downloads.length>=1);
    }
  });
});

test('the scoped audiences never reach the workbook, the evidence queue or a reviewer loader',async()=>{
  await withProduction(async()=>{
    for(const key of ['asl-2','regione']){
      for(const call of allRoutes().slice(-10)){
        const {state,calls}=member(key);const r=await quiet(call);
        assert.equal(r.status,403);assert.deepEqual(await r.json(),{error:'forbidden'});
        assert.deepEqual(state.reads,[]);assert.equal(state.serviceRole,0);assert.equal(calls.downloads.length,0);
      }
    }
  });
});

test('one user’s entitled bytes are never served to another: every request reads again under its own session',async()=>{
  await withProduction(async()=>{
    const a=member('asl-2');const first=await attribution.GET(get(ATTR('asl-2')));assert.equal(first.status,200);assert.equal(a.calls.downloads.length,3);
    const b=member('asl-3');const second=await attribution.GET(get(ATTR('asl-2')));
    assert.equal(second.status,403);assert.equal(b.calls.downloads.length,0,'a peer key is refused before Storage, and nothing was cached to serve');
    const c=member('asl-2',{visible:[]});const third=await quiet(()=>attribution.GET(get(ATTR('asl-2'))));
    assert.equal(third.status,503,'the same user after a revoke: Storage now refuses, and no earlier read is reused');
    assert.ok(c.calls.downloads.length>=1);
    assert.equal(JSON.stringify(await first.json()).includes(SENTINEL['asl-2']),false,'the attribution view carries no review-file sentinel');
  });
});
