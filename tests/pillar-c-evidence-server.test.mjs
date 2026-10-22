import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {existsSync,readFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {buildCAttrPacket,cAttrAtoms,cAttrPriority,cAttrScope,cAttrSum} from '../lib/dashboard-review/pillar-c/attribution.ts';
import {C_ATTR_STORAGE} from '../lib/dashboard-review/pillar-c/attribution-storage.ts';
import {loadCAttrView} from '../lib/dashboard-review/pillar-c/attribution-loader.ts';
import {cEvidenceIsCurrent,cEvidenceArchivedRow,cEvidenceCurrent,cEvidenceFile,cEvidenceFollowupSaved,cEvidenceGroupKey,cEvidencePriority,cEvidenceQueue,cEvidenceRpcError,cEvidenceRpcRolledBack,C_EVIDENCE_ARCHIVE_LIMIT,C_EVIDENCE_BUCKET,C_EVIDENCE_MAX_BODY,C_EVIDENCE_MAX_FILE} from '../lib/dashboard-review/pillar-c/evidence-priority.ts';

// Synthetic aggregates only: invented product keys and amounts, no workbook or ledger figures.
const portfolios=[{id:'AA',label:'Area sintetica A',kind:'area_terapeutica'},{id:'BB',label:'Area sintetica B',kind:'area_terapeutica'},{id:'CC',label:'Area sintetica C',kind:'area_terapeutica'}];
const row=(key,c,state,candidates,{year=2025,month=7,org='AQ',channel='CO',atc=state==='S5'?'':'TEST'}={})=>({anno:year,mese:month,asl:org,canale:channel,prodotto_key:key,atc,c,attribution_status:state,candidate_portfolios:candidates});
const packet=(rows,labels=new Map())=>buildCAttrPacket(rows,portfolios,labels,'1'.repeat(64),'2'.repeat(64),'test-only');
const sha=text=>createHash('sha256').update(text).digest('hex');
const group=r=>sha(cEvidenceGroupKey(r));
const read=p=>readFileSync(new URL(`../${p}`,import.meta.url),'utf8');
const handlers=src=>Object.fromEntries(src.split(/^export async function /m).slice(1).map(s=>[s.slice(0,s.indexOf('(')),s]));
/** Ties at the 80 % cut-off, a product split three ways, a negative row, and rows that must stay out of the pool. */
function tieFixture(labels){
  return packet([
    row('900000001','50','S3',['AA','BB']),row('900000001','-10','S3',['AA','BB'],{org:'CH',channel:'DD'}),
    row('900000002','30','S3',['BB','AA'],{org:'PE',channel:'DPC'}),
    row('900000003','20','S3',['AA','BB'],{org:'TE'}),row('900000003','20','S3',['CC','AA'],{channel:'DD'}),row('900000003','20','S4',[],{org:'CH'}),
    row('900000004','20','S4',[]),
    row('900000005','0','S3',['AA','BB']),row('900000006','500','S2',['AA']),row('E-unknown','900','S5',[]),
    row('900000008','10','S3',['BB','CC']),
    row('900000001','5','S3',['AA','BB'],{year:2024}),row('900000010','3','S2',['BB'],{month:1}),
  ],labels);
}

test('the queue is exactly the panel n80 rows, in panel order, including a tie at the 80 % cut-off',()=>{
  const p=tieFixture(),scope=cAttrScope(p,'FY2025','Regione','Tutti'),ev=cEvidencePriority(scope,p.portfolios),panel=cAttrPriority(scope,'therapeutic','',p.portfolios);
  assert.equal(panel.n80,5);assert.equal(ev.count,5);
  assert.deepEqual(ev.rows,panel.rows.slice(0,panel.n80));
  assert.deepEqual(ev.rows.map(r=>`${r.key}|${r.state}|${r.candidates.join('+')}`),['900000001|S3|AA+BB','900000002|S3|AA+BB','900000003|S3|AA+BB','900000003|S3|AA+CC','900000003|S4|']);
  assert.equal(panel.rows[5].key,'900000004');assert.equal(panel.rows[5].abs,ev.rows[4].abs,'the first excluded row ties the last selected one');
  assert.deepEqual([ev.poolAbs,ev.selectedAbs,ev.remainingAbs,ev.poolCount],['180','150','30',7]);
  assert.equal(cAttrAtoms(ev.selectedAbs)*BigInt(5)>=cAttrAtoms(ev.poolAbs)*BigInt(4),true);
  assert.equal(cAttrAtoms(cAttrSum(ev.rows.slice(0,-1).map(r=>r.abs)))*BigInt(5)<cAttrAtoms(ev.poolAbs)*BigInt(4),true,'one row fewer would not reach 80 %');
  assert.deepEqual([ev.rows[0].abs,ev.rows[0].net,ev.rows[0].negative],['60','40','-10'],'ranking uses absolute exposure, negatives included');
  assert.equal(ev.rows.some(r=>['900000005','900000006','E-unknown'].includes(r.key)),false);
  assert.deepEqual([ev.period,ev.org,ev.channel,ev.pool],['FY2025','Regione','Tutti','shared-and-insufficient']);
});
test('a cut-off landing exactly on 80 % stops there',()=>{
  const p=packet([row('910000001','50','S3',['AA','BB']),row('910000002','30','S4',[]),row('910000003','20','S3',['AA','CC'])]);
  const ev=cEvidencePriority(cAttrScope(p,'FY2025','Regione','Tutti'),p.portfolios);
  assert.deepEqual(ev.rows.map(r=>r.key),['910000001','910000002']);assert.equal(ev.coverage,0.8);assert.equal(ev.remainingAbs,'20');
});
test('only the fixed reference scope can seed the queue, and an empty pool is refused',()=>{
  const p=tieFixture();
  for(const [period,org,channel] of [['FY2024','Regione','Tutti'],['JM2025','Regione','Tutti'],['FY2025','AQ','Tutti'],['FY2025','Regione','CO'],['FY2025','AQ','CO']]){
    const scope=cAttrScope(p,period,org,channel);assert.ok(scope,`${period} ${org} ${channel} exists in the fixture`);
    assert.throws(()=>cEvidencePriority(scope,p.portfolios),{message:'C_EVIDENCE_REFERENCE_SCOPE'});
  }
  for(const rows of [[row('920000001','4','S2',['AA'])],[row('920000002','0','S3',['AA','BB'])]]){
    const q=packet(rows);assert.throws(()=>cEvidencePriority(cAttrScope(q,'FY2025','Regione','Tutti'),q.portfolios),{message:'C_EVIDENCE_EMPTY_REFERENCE'});
  }
});
test('group identity is unique per queue row, ignores label and candidate order, and is pinned',()=>{
  const p=tieFixture(),scope=cAttrScope(p,'FY2025','Regione','Tutti'),groups=scope.products.map(group);
  assert.equal(new Set(groups).size,groups.length,'every product row of the scope has its own group');
  const ev=cEvidencePriority(scope,p.portfolios),selected=ev.rows.map(group);
  assert.equal(new Set(selected).size,5);assert.equal(new Set(ev.rows.filter(r=>r.key==='900000003').map(group)).size,3,'a split product keeps one group per split');
  const relabelled=tieFixture(new Map([['900000001','Etichetta rivista']]));
  assert.deepEqual(cEvidencePriority(cAttrScope(relabelled,'FY2025','Regione','Tutti'),relabelled.portfolios).rows.map(group),selected,'a relabel never detaches a case');
  const base={key:'900000002',atc:'TEST',state:'S3',candidates:['BB','AA']},candidates=[...base.candidates];
  assert.equal(cEvidenceGroupKey(base),cEvidenceGroupKey({...base,candidates:['AA','BB'],label:'Altro nome',abs:'1'}));
  assert.deepEqual(base.candidates,candidates,'the caller array is not sorted in place');
  for(const change of [{key:'900000009'},{atc:'TESTX'},{state:'S4'},{candidates:['AA','CC']}])assert.notEqual(cEvidenceGroupKey({...base,...change}),cEvidenceGroupKey(base));
  // Pinned: a formula change would orphan every stored case, so it must be a deliberate edit of this test.
  assert.equal(sha(cEvidenceGroupKey(base)),'9798ce15019e0a417989f78a89661c6dbf9c46048066791aef1e63005af528e2');
  assert.match(read('lib/dashboard-review/pillar-c/evidence-server.ts'),/export function cEvidenceGroup\(row:[^)]*\) \{return createHash\('sha256'\)\.update\(cEvidenceGroupKey\(row\)\)\.digest\('hex'\);\}/);
});

const ROOT=path.resolve(process.env.PILLAR_C_ATTRIBUTION_ROOT||fileURLToPath(new URL('../../outputs/pillar-c/attribution-dashboard-20261018/',import.meta.url)));
const INDEX=path.join(ROOT,'index.json');
const pinned=existsSync(INDEX)&&sha(readFileSync(INDEX))===C_ATTR_STORAGE.index;
test('on the pinned private index the fingerprints match and the queue equals the panel n80 rows',{skip:pinned?false:'the pinned private attribution index is not available locally'},async()=>{
  const index=JSON.parse(readFileSync(INDEX,'utf8'));
  const loaded=await loadCAttrView(true,true,'FY2025','Regione','Tutti',{root:ROOT});assert.equal(loaded.state,'ready');
  assert.equal(loaded.view.sourceSha256,index.sourceSha256);assert.equal(loaded.view.classificationSha256,index.classificationSha256);
  const {scope,portfolios}=loaded.view,ev=cEvidencePriority(scope,portfolios),panel=cAttrPriority(scope,'therapeutic','',portfolios);
  assert.deepEqual(ev.rows,panel.rows.slice(0,panel.n80));
  const groups=scope.products.map(group);assert.equal(new Set(groups).size,groups.length);
});
test('the frozen record takes its provenance from the loaded, hash-verified index',()=>{
  // The real-data test above proves the view carries the index's own fingerprints.
  const server=read('lib/dashboard-review/pillar-c/evidence-server.ts'),loader=read('lib/dashboard-review/pillar-c/attribution-loader.ts');
  assert.doesNotMatch(server,/[a-f0-9]{64}/);
  assert.match(server,/source_sha256:source\.sourceSha256,classification_sha256:source\.classificationSha256/);
  assert.match(server,/sourceSha256:loaded\.view\.sourceSha256,classificationSha256:loaded\.view\.classificationSha256/);
  assert.match(loader,/sourceSha256:packet\.sourceSha256,classificationSha256:packet\.classificationSha256/);
});

test('RPC failures map to one API contract and never blame the user for an outage',()=>{
  const cases=[
    [{code:'40001',message:'Evidence case changed; reload before saving'},409,'conflict'],
    [{code:'42501',message:'Approved actor required'},403,'actor'],
    [{code:'42501',message:'Approved owner required'},422,'owner'],
    [{code:'22023',message:'Invalid follow up'},422,'validation'],
    [{code:'P0002',message:'Evidence case not found'},422,'validation'],
    [{code:'',message:'TypeError: fetch failed'},503,'unavailable'],
    [{code:'PGRST202',message:'Could not find the function'},503,'unavailable'],
    [{code:'57014',message:'canceling statement due to statement timeout'},503,'unavailable'],
    [{code:'08006'},503,'unavailable'],[{},503,'unavailable'],[null,503,'unavailable'],[undefined,503,'unavailable'],
  ];
  for(const [error,status,code] of cases)assert.deepEqual(cEvidenceRpcError(error),{status,code},JSON.stringify(error));
});
test('an uploaded object is removed only after a definite rollback',()=>{
  for(const code of ['22023','40001','42501','P0002','40P01','23505'])assert.equal(cEvidenceRpcRolledBack({code}),true,code);
  // fetch failure (status 0), PostgREST/gateway codes and connection or server classes: the commit may still land.
  for(const error of [{code:''},{code:'PGRST000'},{code:'PGRST003'},{code:'08006'},{code:'53300'},{code:'57P01'},{code:'58030'},{code:'XX000'},{code:'4000'},{code:'abcde'},{},null,undefined])assert.equal(cEvidenceRpcRolledBack(error),false,JSON.stringify(error));
  const files=read('app/api/pillar-c/evidence/[id]/attachment/route.ts');
  assert.equal((files.match(/\.remove\(/g)||[]).length,1);
  assert.match(files,/if\(cEvidenceRpcRolledBack\(saved\.error\)\)await context\.service\.storage\.from\(C_EVIDENCE_BUCKET\)\.remove\(\[path\]\)/);
});
test('attachment limits stay under the platform body limit and a size failure is distinguishable',()=>{
  assert.equal(C_EVIDENCE_MAX_FILE,4194304);assert.equal(C_EVIDENCE_BUCKET,'pillar-c-evidence');
  assert.ok(C_EVIDENCE_MAX_BODY>C_EVIDENCE_MAX_FILE&&C_EVIDENCE_MAX_BODY<4_500_000,'file plus multipart allowance stays below 4.5 MB');
  const text=n=>new Uint8Array(n).fill(0x61);
  assert.deepEqual(cEvidenceFile(text(C_EVIDENCE_MAX_FILE),'riepilogo.txt','text/plain'),{name:'riepilogo.txt',type:'text/plain'});
  assert.throws(()=>cEvidenceFile(text(C_EVIDENCE_MAX_FILE+1),'riepilogo.txt','text/plain'),{message:'file_too_large'});
  assert.throws(()=>cEvidenceFile(new Uint8Array(0),'vuoto.txt','text/plain'),{message:'file'});
  assert.throws(()=>cEvidenceFile(text(10),'nota.exe','text/plain'),{message:'file'});
  const files=handlers(read('app/api/pillar-c/evidence/[id]/attachment/route.ts')).POST;
  assert.match(files,/content-length'\)\?\?0\)>C_EVIDENCE_MAX_BODY\)return json\(\{error:'file_too_large'\},413\)/);
  assert.match(files,/if\(length>C_EVIDENCE_MAX_BODY\)\{await reader\.cancel\(\);return json\(\{error:'file_too_large'\},413\);\}/);
});
test('the database accepts exactly the server file limit',()=>{
  const sql=read('supabase/migrations/20261019120000_pillar_c_evidence_workflow.sql');
  assert.doesNotMatch(sql,/5242880/);
  assert.match(sql,new RegExp(`byte_size integer not null check \\(byte_size between 1 and ${C_EVIDENCE_MAX_FILE}\\)`));
  assert.match(sql,new RegExp(`'${C_EVIDENCE_BUCKET}'[\\s\\S]{0,200}${C_EVIDENCE_MAX_FILE}`),'the bucket carries the same file_size_limit');
});
test('a saved follow-up is recognised on trimmed values on both sides',()=>{
  const owner='00000000-0000-4000-8000-000000000002',c={state:'follow_up',follow_up_owner_id:owner,follow_up_due_date:'2026-11-30',follow_up_note:'Verificare la ripartizione'};
  const draft={owner,date:'2026-11-30',note:'\n  Verificare la ripartizione \r\n'};
  assert.equal(cEvidenceFollowupSaved(c,draft),true);
  assert.equal(cEvidenceFollowupSaved({...c,follow_up_note:'\nVerificare la ripartizione\n'},{...draft,note:'Verificare la ripartizione'}),true);
  for(const change of [{owner:'00000000-0000-4000-8000-000000000003'},{date:'2026-12-01'},{note:'Altro seguito'},{owner:` ${owner}`}])assert.equal(cEvidenceFollowupSaved(c,{...draft,...change}),false,JSON.stringify(change));
  assert.equal(cEvidenceFollowupSaved({...c,state:'decision_recorded'},draft),false);
  assert.equal(cEvidenceFollowupSaved({...c,follow_up_owner_id:null,follow_up_due_date:null,follow_up_note:null},{owner:'',date:'',note:' '}),true,'null-safe on the stored side');
});

const SNAP='a'.repeat(64),OLD='b'.repeat(64),G1='1'.repeat(64),G2='2'.repeat(64),GONE='9'.repeat(64);
const stored=(id,snapshot,source_group,updated_at,extra={})=>({id,source_snapshot:snapshot,source_group,product_key:`K-${id}`,source:{product_label:`Prodotto ${id}`},state:'assigned',decision:null,updated_at,owner_id:'x',decision_note:'nota interna',...extra});
test('cases from an earlier data version stay listed read-only and never join the current queue',()=>{
  const same=[stored('c1',SNAP,G1,'2026-10-19T10:00:00.000001+00:00'),stored('c2',SNAP,GONE,'2026-10-19T12:00:00+00:00',{state:'closed',decision:'remains_uncertain'}),stored('c3',SNAP,G2,'2026-10-19T09:00:00+00:00')];
  const older=[stored('o1',OLD,G1,'2026-10-19T11:00:00+00:00'),stored('o2',OLD,G2,'2026-10-18T11:00:00+00:00')];
  const q=cEvidenceQueue(same,older,7,SNAP,new Set([G1,G2]));
  assert.deepEqual(q.cases.map(r=>r.id),['c1','c3'],'same product on an earlier version does not replace or merge the current case');
  assert.deepEqual(q.archived.map(r=>r.id),['c2','o1','o2'],'newest update first; a row dropped from the current queue is archived too');
  assert.equal(q.archivedCount,8,'true total: all earlier-version cases plus the dropped current one');
  assert.deepEqual(q.archived[0],{id:'c2',product_key:'K-c2',product_label:'Prodotto c2',state:'closed',decision:'remains_uncertain',updated_at:'2026-10-19T12:00:00+00:00',source_snapshot:SNAP});
  assert.equal(cEvidenceArchivedRow({...older[0],source:null}).product_label,'K-o1');
  const many=Array.from({length:250},(_,i)=>stored(`m${String(i).padStart(3,'0')}`,OLD,G1,new Date(Date.UTC(2026,0,1,0,i)).toISOString()));
  const big=cEvidenceQueue([],many,250,SNAP,new Set([G1]));
  assert.equal(C_EVIDENCE_ARCHIVE_LIMIT,200);assert.equal(big.archived.length,200);assert.equal(big.archivedCount,250);assert.equal(big.archived[0].id,'m249');
  assert.equal(cEvidenceCurrent({source_snapshot:SNAP,source_group:G1},SNAP,new Set([G1])),true);
  assert.equal(cEvidenceCurrent({source_snapshot:OLD,source_group:G1},SNAP,new Set([G1])),false);
  assert.equal(cEvidenceCurrent({source_snapshot:SNAP,source_group:GONE},SNAP,new Set([G1])),false);
});
test('every evidence route stays gated and private, and archived cases are readable but never writable',()=>{
  const sources=['app/api/pillar-c/evidence/route.ts','app/api/pillar-c/evidence/[id]/route.ts','app/api/pillar-c/evidence/[id]/attachment/route.ts'].map(read);
  const [list,detail,files]=sources.map(handlers);
  for(const h of [list.GET,list.POST,list.PATCH,detail.GET,files.GET,files.POST])assert.match(h,/await cEvidenceActor\(\)/);
  for(const h of [list.POST,list.PATCH,files.POST])assert.match(h,/if\(!actor\|\|!cEvidenceSameOrigin\(request\)\)return \w+\(\{error:'forbidden'\},403\)/);
  // Point 18: the current set is the attribution queue plus the findings of the current extension version.
  for(const h of [list.PATCH,files.POST])assert.match(h,/if\(!cEvidenceIsCurrent\(\w+\.\w+,source\)\)return \w+\(\{error:'archived'\},409\)/);
  for(const h of [detail.GET,files.GET])assert.doesNotMatch(h,/source_snapshot|archived/,'reads work for any existing case');
  assert.match(detail.GET,/current:cEvidenceIsCurrent\(found\.data,source\)/);
  assert.match(list.GET,/schema:'pillar-c-evidence-workspace-v1'/);assert.match(list.GET,/archived:queue\.archived,archivedCount:queue\.archivedCount/);
  assert.match(list.GET,/const current=\[source\.sourceSnapshot,\.\.\.\(source\.findingSnapshot\?\[source\.findingSnapshot\]:\[\]\)\];/);
  assert.match(list.GET,/\.in\('source_snapshot',current\)\.order\('created_at'\)/);
  assert.match(list.GET,/\.not\('source_snapshot','in',`\(\$\{current\.join\(','\)\}\)`\)\.order\('updated_at',\{ascending:false\}\)\.order\('id'\)\.limit\(C_EVIDENCE_ARCHIVE_LIMIT\)/);
  assert.match(list.GET,/cEvidenceQueue\(cases\.data\?\?\[\],older\.data\?\?\[\],older\.count,source\.sourceSnapshot,source\.groups,r=>cEvidenceIsCurrent\(r,source\)\)/);
  // A finding group is created only by its own SQL function, from the server's own record of the current version.
  assert.match(list.POST,/finding=cEvidenceFindingRecord\(source,body\.group\);\r?\n\s*if\(finding\)\{const saved=await createServiceRoleClient\(\)\.rpc\('c_evidence_create_finding',\{p_actor:actor\.id,p_source:finding\}\)/);
  for(const h of [list.POST,list.PATCH,files.POST])assert.match(h,/return reply\(\{case:saved\.data\}\)|return json\(\{case:saved\.data\}\)|\?failed\(saved\.error\):reply\(\{case:saved\.data\}\)/);
  for(const src of sources){
    assert.doesNotMatch(src,/saved\.error\.code/,'RPC errors go through cEvidenceRpcError');
    assert.doesNotMatch(src,/\bdemo\b/i);
    assert.equal((src.match(/NextResponse\.json\(/g)||[]).length,(src.match(/NextResponse\.json\(body,\{status,headers:C_EVIDENCE_HEADERS\}\)/g)||[]).length,'every JSON reply carries the private headers');
  }
  assert.match(read('lib/dashboard-review/pillar-c/evidence-server.ts'),/"Cache-Control":"private, no-store, max-age=0"/);
});

test('point 18: finding cases are current only on the current extension version, and never mix with the product queue',()=>{
  const F='9'.repeat(64),GF='8'.repeat(64),set={sourceSnapshot:SNAP,groups:new Set([G1]),findingSnapshot:F,findingGroups:new Set([GF])};
  assert.equal(cEvidenceIsCurrent({source_snapshot:SNAP,source_group:G1},set),true);
  assert.equal(cEvidenceIsCurrent({source_snapshot:F,source_group:GF},set),true);
  assert.equal(cEvidenceIsCurrent({source_snapshot:F,source_group:G1},set),false,'a product group under the finding snapshot');
  assert.equal(cEvidenceIsCurrent({source_snapshot:SNAP,source_group:GF},set),false,'a finding group under the product snapshot');
  assert.equal(cEvidenceIsCurrent({source_snapshot:F,source_group:GF},{...set,findingSnapshot:null}),false,'without the extension object a finding case is read only');
  const q=cEvidenceQueue([stored('p',SNAP,G1,'2026-10-22T10:00:00+00:00'),stored('f',F,GF,'2026-10-22T11:00:00+00:00'),stored('x',F,'7'.repeat(64),'2026-10-22T12:00:00+00:00')],[],0,SNAP,set.groups,r=>cEvidenceIsCurrent(r,set));
  assert.deepEqual(q.cases.map(r=>r.id),['p','f']);assert.deepEqual(q.archived.map(r=>r.id),['x']);
  const server=read('lib/dashboard-review/pillar-c/evidence-server.ts');
  assert.match(server,/createHash\('sha256'\)\.update\(`finding\|\$\{version\}\|\$\{id\}`\)/);
  assert.match(server,/findingSnapshot:findings\?C_EXTENSION_STORAGE\.reviewer\.sha256:null/);
  assert.match(server,/source_state:'F'/);
});
