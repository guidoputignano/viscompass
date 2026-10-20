// Pillar C organisation-scoped delivery: transport and loaders against a synthetic bucket and a fake
// session client that answers like Storage under RLS. Synthetic data only.
import test from 'node:test';
import assert from 'node:assert/strict';
import {IDENTITY_STUBS,registerPillarCStubs,as} from './helpers/pillar-c-scoped-stubs.mjs';
import {scopedFixture,fakeSessionClient,SCOPED_UNITS,SENTINEL,sha256} from './fixtures/pillar-c-scoped.mjs';

registerPillarCStubs(IDENTITY_STUBS);
const {loadCScopedReview,loadCScopedAttrView,loadCScopedPortfolioView}=await import('../lib/dashboard-review/pillar-c/scoped-loader.ts');
const {readCScopedObject,cScopedObjectPath,C_SCOPED_POLICY_NAME}=await import('../lib/dashboard-review/pillar-c/scoped-transport.ts');

const AZIENDA={kind:'azienda',orgCode:'202',orgName:'Azienda sintetica Due',unit:'asl-2',units:['asl-2','aggregato']};
const REGIONE={kind:'regione',orgCode:'130',units:['aggregato','asl-1','asl-2','asl-3','asl-4']};
const base=scopedFixture();
function session(fixture,options){as({pins:fixture.pins,client:()=>null});return fakeSessionClient(fixture,options);}
function captureWarnings(){const lines=[],original=console.warn;console.warn=(...a)=>lines.push(a.join(' '));return {lines,restore:()=>{console.warn=original;}};}

test('azienda review: exactly its own unit and the aggregate, read under the session with no-store, no other unit leaks',async()=>{
  const {client,calls}=session(base,{visible:AZIENDA.units});
  const r=await loadCScopedReview(AZIENDA,client);
  assert.equal(r.state,'ready');
  assert.deepEqual(r.packet.orgs,['asl-2','aggregato']);
  assert.equal(r.packet.monthlyMode,'explicit');
  for(const key of ['monthly','baseline','bridges','budgets','counts'])for(const row of r.packet[key])assert.ok(['asl-2','aggregato'].includes(row.org),key);
  const json=JSON.stringify(r.packet);
  for(const unit of SCOPED_UNITS)assert.equal(json.includes(SENTINEL[unit]),AZIENDA.units.includes(unit),`sentinel of ${unit}`);
  assert.deepEqual(r.packet.budgets,[],'only asl-4 carries a published act in the fixture');
  assert.equal(calls.downloads.length,4,'two indexes, two review files');
  for(const d of calls.downloads){
    assert.equal(d.bucket,'pillar-c-scoped');assert.match(d.path,C_SCOPED_POLICY_NAME);
    assert.ok(['asl-2','aggregato'].includes(d.path.split('/')[1]));
    assert.equal(d.params.cache,'no-store');assert.ok(d.params.signal instanceof AbortSignal);
  }
  assert.equal(globalThis.__pcs.serviceRole,0);
});

test('no cache: two identical requests make two full sets of reads; a denied read is not retried',async()=>{
  const {client,calls}=session(base,{visible:AZIENDA.units});
  await loadCScopedReview(AZIENDA,client);await loadCScopedReview(AZIENDA,client);
  assert.equal(calls.downloads.length,8);
  const denied=session(base,{visible:['asl-2']});const w=captureWarnings();
  try{
    const r=await loadCScopedReview(AZIENDA,denied.client);
    assert.deepEqual(r,{state:'unavailable',code:'PCS-ABSENT',unit:'aggregato'});
    assert.equal(denied.calls.downloads.filter(d=>d.path.startsWith('v1/aggregato/')).length,1,'refused once, never retried');
    assert.deepEqual(w.lines,['[pillar-c-scoped] PCS-ABSENT unit=aggregato'],'only the code and the unit are logged');
  }finally{w.restore();}
});

test('regione review: all five units, and the aggregate must equal the sum of the four Aziende',async()=>{
  const {client}=session(base,{visible:SCOPED_UNITS});
  const r=await loadCScopedReview(REGIONE,client);
  assert.equal(r.state,'ready');assert.deepEqual(r.packet.orgs,REGIONE.units);
  assert.equal(r.packet.budgets.length,2);assert.ok(r.packet.budgets.every(b=>b.org==='asl-4'&&b.basis==='published'));
  assert.doesNotMatch(JSON.stringify(r.packet),/"(AQ|CH|PE|TE|Regione)"/);
  // A consistent but wrong aggregate (re-hashed, re-pinned) passes its own file's checks and fails the cross-file sum.
  const tampered=scopedFixture({file:(unit,f)=>{if(unit!=='aggregato')return;const m=f.monthly[0];m.net=String(Number(m.net)+1);m.positive=String(Number(m.positive)+1);for(const b of f.baseline)if(b.period==='FY2024'&&(b.channel==='Tutti'||b.channel===m.channel)){b.net=String(Number(b.net)+1);b.positive=String(Number(b.positive)+1);}for(const g of f.bridges)if(g.comparison==='K1'&&g.component==='B-C'&&(g.channel==='Tutti'||g.channel===m.channel))g.value=String(Number(g.value)-1);}});
  const w=captureWarnings();
  try{
    const t=session(tampered,{visible:SCOPED_UNITS});
    assert.deepEqual(await loadCScopedReview(REGIONE,t.client),{state:'unavailable',code:'PCS-PARSE',unit:'aggregato'});
    const own=session(tampered,{visible:AZIENDA.units});
    assert.equal((await loadCScopedReview(AZIENDA,own.client)).state,'ready','an Azienda cannot cross-check the aggregate: it reads only one Azienda');
  }finally{w.restore();}
});

test('transport failures are unavailable, never denied: 5xx and network give PCS-TRANSPORT, a wrong hash or size PCS-INTEGRITY',async()=>{
  const w=captureWarnings();
  try{
    for(const fail of ['5xx','throw']){const {client}=session(base,{visible:AZIENDA.units,fail});assert.deepEqual(await loadCScopedReview(AZIENDA,client),{state:'unavailable',code:'PCS-TRANSPORT',unit:'asl-2'});}
    const swapped=scopedFixture({bytes:(path,bytes)=>path.includes('/review-')&&path.startsWith('v1/aggregato/')?Buffer.from(bytes.toString().replace('"review_only"','"review_onlx"')):bytes});
    assert.deepEqual(await loadCScopedReview(AZIENDA,session(swapped,{visible:AZIENDA.units}).client),{state:'unavailable',code:'PCS-INTEGRITY',unit:'aggregato'});
    const longer=scopedFixture({bytes:(path,bytes)=>path.includes('/review-')&&path.startsWith('v1/asl-2/')?Buffer.concat([bytes,Buffer.from(' ')]):bytes});
    assert.deepEqual(await loadCScopedReview(AZIENDA,session(longer,{visible:AZIENDA.units}).client),{state:'unavailable',code:'PCS-INTEGRITY',unit:'asl-2'});
  }finally{w.restore();}
});

test('the object path is built only from the pinned root, a unit and a pinned name whose hash is the expected one',async()=>{
  as({pins:base.pins,client:()=>null});
  const sha='a'.repeat(64);
  assert.equal(cScopedObjectPath('asl-2',`review-${sha}.json`,sha),`v1/asl-2/review-${sha}.json`);
  for(const [unit,name] of [['asl-5',`review-${sha}.json`],['Regione',`review-${sha}.json`],['asl-2',`review-${'b'.repeat(64)}.json`],['asl-2',`../asl-1/review-${sha}.json`],['asl-2',`sub/review-${sha}.json`],['asl-2',`review-${sha}.JSON`],['asl-2',`review--${sha}.json`],['asl-2',`review-${sha}.json?x=1`]])
    assert.equal(cScopedObjectPath(unit,name,sha),null,`${unit} ${name}`);
  const {client,calls}=session(base,{visible:SCOPED_UNITS});
  assert.deepEqual(await readCScopedObject(client,'asl-2',`../asl-1/review-${sha}.json`,{sha256:sha,maxBytes:100}),{state:'invalid'});
  assert.equal(calls.downloads.length,0,'an invalid path is never requested');
});

test('attribution: own key and aggregate are served; any other key is denied before any read',async()=>{
  const {client,calls}=session(base,{visible:AZIENDA.units});
  for(const key of AZIENDA.units){
    const r=await loadCScopedAttrView(AZIENDA,client,'FY2025',key,'Tutti');
    assert.equal(r.state,'ready');
    assert.equal(r.view.scope.org,key);assert.equal(r.view.comparison.org,key);assert.equal(r.view.comparison.period,'FY2024');
    assert.equal(r.view.sourceSnapshot,base.pins.index[key]);
    assert.deepEqual(Object.keys(r.view),['schema','sourceSha256','classificationSha256','mappingVersion','sourceSnapshot','portfolios','scope','comparison']);
  }
  assert.equal(calls.downloads.length,6,'one index and two shards per request');
  const before=calls.downloads.length;
  for(const key of ['asl-1','asl-3','asl-4','Regione','AQ','CH','PE','TE','ASL-2','asl-2 ',' asl-2','asl-2\u0000','asl-2,aggregato','',null,undefined])
    assert.deepEqual(await loadCScopedAttrView(AZIENDA,client,'FY2025',key,'Tutti'),{state:'denied'},String(key));
  assert.deepEqual(await loadCScopedAttrView(AZIENDA,client,'FY2026','asl-2','Tutti'),{state:'invalid'});
  assert.deepEqual(await loadCScopedAttrView(AZIENDA,client,'FY2025','asl-2','ALL'),{state:'invalid'});
  assert.equal(calls.downloads.length,before,'a refused key or argument never reaches Storage');
  const regione=session(base,{visible:SCOPED_UNITS});
  for(const key of REGIONE.units)assert.equal((await loadCScopedAttrView(REGIONE,regione.client,'JM2026',key,'CO')).view.scope.org,key);
});

test('portfolio: same scope rules, an unknown portfolio id is unavailable, and product descriptors keep their tokens',async()=>{
  const {client}=session(base,{visible:AZIENDA.units});
  const r=await loadCScopedPortfolioView(AZIENDA,client,'FY2025','asl-2','Tutti','AA');
  assert.equal(r.state,'ready');assert.equal(r.view.scope.org,'asl-2');assert.equal(r.view.comparison.scope.org,'asl-2');assert.equal(r.view.sourceSnapshot,base.pins.index['asl-2']);
  assert.ok(JSON.stringify(r.view).includes('RISPERIDONE TE*20CPR sintetico'),'a manufacturer-style token inside a product label is a descriptor, not an identifier');
  assert.deepEqual(await loadCScopedPortfolioView(AZIENDA,client,'FY2025','asl-1','Tutti','AA'),{state:'denied'});
  assert.deepEqual(await loadCScopedPortfolioView(AZIENDA,client,'FY2025','asl-2','Tutti','aa'),{state:'invalid'});
  const w=captureWarnings();
  try{assert.deepEqual(await loadCScopedPortfolioView(AZIENDA,client,'FY2025','asl-2','Tutti','ZZ'),{state:'unavailable',code:'PCS-MISMATCH',unit:'asl-2'});}finally{w.restore();}
});

test('a shard that is not the scope its index names, or another unit’s shard, is refused even when its hash is pinned',async()=>{
  const w=captureWarnings();
  try{
    const relabelled=scopedFixture({shard:(unit,kind,period,channel,s)=>{if(unit==='asl-2'&&kind==='attr'&&period==='FY2025'&&channel==='Tutti')s.period='FY2024';}});
    assert.deepEqual(await loadCScopedAttrView(AZIENDA,session(relabelled,{visible:AZIENDA.units}).client,'FY2025','asl-2','Tutti'),{state:'unavailable',code:'PCS-MISMATCH',unit:'asl-2'});
    const foreign=scopedFixture({shard:(unit,kind,period,channel,s)=>{if(unit==='asl-2'&&kind==='port'&&period==='FY2025'&&channel==='Tutti')s.org='asl-1';}});
    assert.deepEqual(await loadCScopedPortfolioView(AZIENDA,session(foreign,{visible:AZIENDA.units}).client,'FY2025','asl-2','Tutti','AA'),{state:'unavailable',code:'PCS-MISMATCH',unit:'asl-2'});
  }finally{w.restore();}
});

test('the guard refuses a pinned shard whose identifier carries a province key or a place name',async()=>{
  const w=captureWarnings();
  try{
    for(const mutate of [s=>{s.products[0].key='TE 912000001';},s=>{s.products[0].label='Prodotto sintetico Pescara';},s=>{s.products[0].key='x 130204';}]){
      const bad=scopedFixture({shard:(unit,kind,period,channel,s)=>{if(unit==='asl-2'&&kind==='attr'&&period==='FY2025'&&channel==='Tutti')mutate(s);}});
      assert.deepEqual(await loadCScopedAttrView(AZIENDA,session(bad,{visible:AZIENDA.units}).client,'FY2025','asl-2','Tutti'),{state:'unavailable',code:'PCS-GUARD',unit:'asl-2'});
    }
    assert.ok(w.lines.every(l=>l==='[pillar-c-scoped] PCS-GUARD unit=asl-2'));
  }finally{w.restore();}
});

test('a review file with a modelled budget, a lineage block or another unit’s row is refused',async()=>{
  const w=captureWarnings();
  try{
    for(const mutate of [f=>{f.budgets=[{id:'asl-4-b-0009',period:'FY2025',org:'asl-4',channel:'CO',level:'Disciplina',area:'08',basis:'synthetic',budget:'1',actual:'1',alternative:'1'}];},f=>{f.lineage=[];},f=>{f.counts[0].org='asl-1';},f=>{f.workbookSha256='a'.repeat(64);}]){
      const bad=scopedFixture({file:(unit,f)=>{if(unit==='asl-4')mutate(f);}});
      const r=await loadCScopedReview({kind:'azienda',orgCode:'204',orgName:'Azienda sintetica Quattro',unit:'asl-4',units:['asl-4','aggregato']},session(bad,{visible:['asl-4','aggregato']}).client);
      assert.deepEqual(r,{state:'unavailable',code:'PCS-PARSE',unit:'asl-4'});
    }
  }finally{w.restore();}
});

test('the integrity check reads the hash of the bytes received, not a claimed one',async()=>{
  as({pins:base.pins,client:()=>null});
  const path=[...base.files.keys()].find(p=>p.startsWith('v1/asl-2/review-')),name=path.split('/')[2],sha=name.slice(7,71);
  assert.equal(sha256(base.files.get(path)),sha);
  const {client}=session(base,{visible:['asl-2']});
  const ok=await readCScopedObject(client,'asl-2',name,{sha256:sha,maxBytes:1_000_000});
  assert.equal(ok.state,'ready');assert.equal(sha256(ok.bytes),sha);
  assert.deepEqual(await readCScopedObject(client,'asl-2',name,{sha256:sha,maxBytes:10}),{state:'invalid'},'over the cap');
  assert.deepEqual(await readCScopedObject(client,'asl-2',name,{sha256:sha,maxBytes:1_000_000,bytes:3}),{state:'invalid'},'size differs from the pinned reference');
  assert.deepEqual(await readCScopedObject(client,'asl-1',name.replace('review','index'),{sha256:sha,maxBytes:1_000_000}),{state:'absent'},'RLS refusal and a missing object look the same');
});
