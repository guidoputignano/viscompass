import test from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import {processUploadWith} from '../lib/uploads/process-upload.ts';
import {HOSPITAL_HEADER_ROWS,HOSPITAL_MONTH_TOKENS} from '../lib/uploads/hospital-file.ts';

// Drives the orchestration against a fake Supabase client. The pure
// reconciliation is covered in reconcile.test.mjs and the parser in
// gold-file.test.mjs; what is tested here is the wiring between them, which is
// where a file can end up marked reconciled without having been.

const GROUP='DISTRIBUZIONE DIRETTA+ DISTRIBUZIONE PER CONTO+CONSUMI OSPEDALIERI';

async function workbook({group=GROUP,rows=[[100,100],[200,200]],year=2025,region='130',months=HOSPITAL_MONTH_TOKENS.slice(0,2).join('\n')}={}){
  const wb=new ExcelJS.Workbook();
  const ws=wb.addWorksheet('DIR_OSP_TRA_003AS');
  for(let i=0;i<2;i++)for(let j=0;j<34;j++)ws.getRow(i+1).getCell(j+1).value=HOSPITAL_HEADER_ROWS[i][j];
  for(const c of [19,20,21]) ws.getRow(1).getCell(c).value=group;
  rows.forEach(([qty,cost,asl='130201'],i)=>{
    const r=ws.getRow(3+i);
    r.getCell(1).value=year; r.getCell(2).value=region; r.getCell(3).value='REGIONE SINTETICA'; r.getCell(4).value=asl;
    r.getCell(5).value='AZIENDA SINTETICA';r.getCell(6).value=2039+i;r.getCell(9).value=months;r.getCell(11).value=8627;
    r.getCell(7).value='PRODOTTO'; r.getCell(8).value=`02221103${i}`;
    r.getCell(10).value=months; r.getCell(12).value='ACME';
    for(const c of [13,22])r.getCell(c).value=qty;
    for(const c of [14,25,26])r.getCell(c).value=cost;
    for(const c of [15,16,17,18,29,30,31,32,33,34])r.getCell(c).value=0;
    for(const c of [20,23,24])r.getCell(c).value=qty?cost/qty:null;
    for(const c of [27,28])r.getCell(c).value='X';
    r.getCell(19).value=qty; r.getCell(21).value=cost;
  });
  return wb.xlsx.writeBuffer();
}

/** Minimal stand-in for the service-role client: records every write. */
function makeDb({upload,org,canonical,download,writeError}={}){
  const updates=[],queries=[],downloads=[];
  const settle=(q)=>{
    if(q.op==='update'){updates.push({table:q.table,patch:q.payload,filters:q.filters});return {data:null,error:writeError?.(q.payload)??null};}
    queries.push({table:q.table,filters:q.filters,columns:q.columns});
    const project=(reply)=>reply.data?{...reply,data:Object.fromEntries(q.columns.split(',').map(c=>[c.trim(),reply.data[c.trim()]]))}:reply;
    if(q.table==='uploads') return project(upload??{data:null,error:{message:'no row'}});
    if(q.table==='organizations') return project(org??{data:null,error:null});
    if(q.table==='canonical_fact') return canonical??{data:[],error:null};
    throw new Error(`unexpected table ${q.table}`);
  };
  return {
    updates,queries,downloads,
    from(table){
      const q={table,op:null,payload:null,filters:[]};
      const api={
        select(columns){q.op='select';q.columns=columns;return api;},
        update(p){q.op='update';q.payload=p;return api;},
        eq(c,v){q.filters.push([c,v]);return api;},
        in(c,v){q.filters.push([c,v]);return api;},
        single(){return Promise.resolve(settle(q));},
        then(res,rej){return Promise.resolve().then(()=>settle(q)).then(res,rej);},
      };
      return api;
    },
    storage:{from:(bucket)=>({download:async(path)=>{downloads.push({bucket,path});
      return download?download(path):{data:null,error:{message:'not configured'}};}})},
  };
}

const okUpload={data:{id:7,org_code:'201',storage_path:'201/file.xlsx',file_name:'file.xlsx',period_covered_start:'2025-01-01',period_covered_end:'2025-12-31'},error:null};
const okOrg={data:{region_code:'130',org_type:'asl'},error:null};
const blob=(buf)=>({data:{arrayBuffer:async()=>buf},error:null});
/** The last write is the outcome; the first is always the processing marker. */
const final=(db)=>db.updates.at(-1).patch;
const summary=(db)=>final(db).reconciliation_summary;

test('the row is marked processing before any file is read',async()=>{
  const buf=await workbook();
  const db=makeDb({upload:okUpload,org:okOrg,download:()=>blob(buf)});
  await processUploadWith(db,7);
  assert.equal(db.updates[0].patch.status,'processing');
  assert.deepEqual(db.updates[0].filters,[['id',7]],'scoped to this upload only');
});

test('a storage failure is recorded on the row, never thrown',async()=>{
  const db=makeDb({upload:okUpload,org:okOrg,download:()=>({data:null,error:{message:'Object not found'}})});
  await assert.doesNotReject(()=>processUploadWith(db,7));
  assert.equal(summary(db).ok,false);
  assert.match(summary(db).message,/storage/i);
  assert.match(summary(db).message,/Object not found/);
  assert.equal(final(db).status,'uploaded','a failure is not a reconciliation');
});

test('a file on the wrong basis is refused and the reason is kept',async()=>{
  const buf=await workbook({group:'DISTRIBUZIONE DIRETTA+CONSUMI OSPEDALIERI'});
  const db=makeDb({upload:okUpload,org:okOrg,download:()=>blob(buf)});
  await processUploadWith(db,7);
  assert.equal(summary(db).ok,false);
  assert.match(summary(db).message,/tracciato/,'the incompatible header is refused before a comparison');
  assert.equal(final(db).status,'uploaded');
  assert.equal(final(db).reconciled_at,null,'a refused file clears any earlier reconciliation time');
});

test('an empty canonical table is never recorded as reconciled',async()=>{
  const buf=await workbook();
  const db=makeDb({upload:okUpload,org:okOrg,canonical:{data:[],error:null},download:()=>blob(buf)});
  await processUploadWith(db,7);
  const s=summary(db);
  assert.equal(s.ok,true);
  assert.equal(s.outcome,'canonical_comparison_unavailable');
  assert.equal(final(db).status,'uploaded','the column must not imply a reconciliation');
  assert.equal(final(db).reconciled_at,null);
  assert.equal(s.canonical.available,false);
});

test('a canonical read error is unavailable, not an agreement with zero',async()=>{
  const buf=await workbook();
  const db=makeDb({upload:okUpload,org:okOrg,
    canonical:{data:null,error:{message:'permission denied'}},download:()=>blob(buf)});
  await processUploadWith(db,7);
  assert.notEqual(summary(db).outcome,'reconciled');
  assert.equal(summary(db).canonical.available,false);
  assert.equal(final(db).reconciled_at,null);
});

test('a coincidentally matching canonical amount never certifies a file without a versioned comparison contract',async()=>{
  const buf=await workbook();                       // accepted total = 300
  const db=makeDb({upload:okUpload,org:okOrg,
    canonical:{data:[{total_cost_eur:300}],error:null},download:()=>blob(buf)});
  await processUploadWith(db,7);
  const s=summary(db);
  assert.equal(s.outcome,'canonical_comparison_unavailable');
  assert.equal(final(db).status,'uploaded');
  assert.equal(final(db).reconciled_at,null);
  assert.equal(s.canonical.available,false);
  assert.equal(s.amounts.accepted,300);
});

test('a mismatching amount on an unregistered comparison basis is not used either',async()=>{
  const buf=await workbook();
  const db=makeDb({upload:okUpload,org:okOrg,
    canonical:{data:[{total_cost_eur:999999}],error:null},download:()=>blob(buf)});
  await processUploadWith(db,7);
  assert.equal(summary(db).outcome,'canonical_comparison_unavailable');
  assert.equal(final(db).status,'uploaded');
  assert.equal(final(db).reconciled_at,null,'a discrepancy is not a reconciliation');
});

test('no truncated, cross-release or incompatible canonical read is issued',async()=>{
  const buf=await workbook();
  const db=makeDb({upload:okUpload,org:okOrg,download:()=>blob(buf)});
  await processUploadWith(db,7);
  assert.ok(!db.queries.some(q=>q.table==='canonical_fact'));
  assert.match(summary(db).canonical.reason,/versione attiva.*base di costo/);
});

test('an unknown organization scope is refused before downloading any source',async()=>{
  const buf=await workbook();
  const db=makeDb({upload:okUpload,org:{data:null,error:null},download:()=>blob(buf)});
  await processUploadWith(db,7);
  assert.equal(summary(db).ok,false);
  assert.equal(db.downloads.length,0);
  assert.match(summary(db).message,/perimetro/);
});

test('a missing upload row changes nothing at all',async()=>{
  const db=makeDb({upload:{data:null,error:{message:'no rows'}}});
  await assert.doesNotReject(()=>processUploadWith(db,7));
  assert.equal(db.updates.length,0,'not even a processing marker');
  assert.equal(db.downloads.length,0);
});

test('the summary carries the provenance needed to audit the figures',async()=>{
  const buf=await workbook();
  const db=makeDb({upload:okUpload,org:okOrg,download:()=>blob(buf)});
  await processUploadWith(db,7);
  const s=summary(db);
  assert.equal(s.source.basisHeader,GROUP.toUpperCase());
  assert.equal(s.source.sheetName,'DIR_OSP_TRA_003AS');
  assert.deepEqual(s.source.years,[2025]);
  assert.ok(Array.isArray(s.quarantine),'quarantine detail travels with the result');
  assert.ok(s.at,'and the time it was produced');
});

test('an unexpected error is recorded rather than surfaced as a failed upload',async()=>{
  const buf=await workbook();
  const db=makeDb({upload:okUpload,org:okOrg,download:()=>blob(buf)});
  const from=db.from.bind(db);
  db.from=(t)=>{ if(t==='organizations') throw new Error('connection reset'); return from(t); };
  await assert.doesNotReject(()=>processUploadWith(db,7));
  assert.equal(summary(db).ok,false);
  assert.match(summary(db).message,/connection reset/);
});

test('a database that cannot even record the failure still does not throw',async()=>{
  // The upload itself succeeded before this ran; throwing would report it failed.
  const db=makeDb({upload:okUpload});
  db.from=()=>{ throw new Error('database is down'); };
  await assert.doesNotReject(()=>processUploadWith(db,7));
});

// Gaps the adversarial review named: nothing asserted that every write is
// scoped to the one row, and two of the five outcomes never reached
// toColumnStatus in any test.

test('every write is scoped to this upload row and no other',async()=>{
  const buf=await workbook();
  const db=makeDb({upload:okUpload,org:okOrg,download:()=>blob(buf)});
  await processUploadWith(db,7);
  assert.ok(db.updates.length>=2,'processing marker plus outcome');
  for(const u of db.updates){
    assert.equal(u.table,'uploads');
    assert.deepEqual(u.filters,[['id',7]],'an unscoped update would rewrite every upload');
  }
});

test('a failure write is scoped too',async()=>{
  const db=makeDb({upload:okUpload,org:okOrg,download:()=>({data:null,error:{message:'gone'}})});
  await processUploadWith(db,7);
  for(const u of db.updates) assert.deepEqual(u.filters,[['id',7]]);
});

test('nothing_to_reconcile is stored as uploaded, never as reconciled',async()=>{
  // Every row quarantined, so there is nothing to reconcile. The column has no
  // value for this outcome and must not borrow 'reconciled'.
  const buf=await workbook({rows:[[100,100,'ND'],[200,200,'ND']]});
  const db=makeDb({upload:{data:{...okUpload.data,org_code:'130',storage_path:'130/file.xlsx'},error:null},org:{data:{org_type:'regione',region_code:'130'},error:null},download:()=>blob(buf)});
  await processUploadWith(db,7);
  assert.equal(summary(db).outcome,'nothing_to_reconcile');
  assert.equal(final(db).status,'uploaded');
  assert.equal(final(db).reconciled_at,null);
  assert.equal(summary(db).amounts.accepted,0);
});

// REC5-SEC-03: storage_path is client-supplied and this client is the service role, which bypasses Storage RLS.
// A path outside the row's own organisation folder of 'uploads' is never downloaded, and every refusal reads the
// same, so the row cannot be used to learn whether an object exists anywhere else.
test('a path outside the row’s own organisation folder is refused without any read',async()=>{
  const sha='b'.repeat(64);
  for(const storage_path of [`../pillar-c-scoped/v1/asl-1/index-${sha}.json`,`201/../../pillar-c-scoped/v1/asl-1/index-${sha}.json`,
    '201/%2e%2e/%2e%2e/pillar-c-review/r5/review.json','201\\..\\..\\pillar-c-evidence\\x.pdf','201/.\t./.\t./x.json','/201/file.xlsx',
    '202/1729000000000-peer.xlsx','2010/file.xlsx','201/sub/file.xlsx','201/a..b.xlsx','201/','',null,42]){
    const buf=await workbook();
    const db=makeDb({upload:{data:{...okUpload.data,storage_path},error:null},org:okOrg,download:()=>blob(buf)});
    await assert.doesNotReject(()=>processUploadWith(db,7));
    assert.equal(db.downloads.length,0,`${JSON.stringify(storage_path)}: never downloaded`);
    assert.equal(db.updates.length,1,'only the refusal is written, not even a processing marker');
    assert.deepEqual(db.updates[0].filters,[['id',7]]);
    assert.equal(final(db).status,'uploaded');
    assert.deepEqual(Object.keys(summary(db)).sort(),['at','message','ok']);
    assert.equal(summary(db).ok,false);
    assert.equal(summary(db).message,'Il percorso del file non è valido: il file non viene letto.');
    assert.ok(!db.queries.some(q=>q.table==='canonical_fact'||q.table==='organizations'),'nothing else is read');
  }
  // The row's own organisation decides the folder: the same path is refused for another organisation's row.
  const db=makeDb({upload:{data:{id:7,org_code:'202',storage_path:'201/file.xlsx'},error:null},org:okOrg,download:()=>blob(new ArrayBuffer(0))});
  await processUploadWith(db,7);
  assert.equal(db.downloads.length,0);
});

test('a path of the row’s own folder is read exactly as stored, from the uploads bucket',async()=>{
  for(const storage_path of ['201/file.xlsx','201/1729000000000-DIR_OSP_TRA_003AS_SellInSellOut_nuova_estrazione_2025.xlsx','201/1729000000000-Spesa 2025 (v2).xlsx']){
    const buf=await workbook();
    const db=makeDb({upload:{data:{...okUpload.data,storage_path},error:null},org:okOrg,download:()=>blob(buf)});
    await processUploadWith(db,7);
    assert.deepEqual(db.downloads,[{bucket:'uploads',path:storage_path}]);
    assert.equal(db.updates[0].patch.status,'processing');
    assert.equal(summary(db).ok,true);
  }
});

test('a missing required cost is refused, never certified by a matching partial total',async()=>{
  // An accepted row with no cost: the total is real but partial, and a partial
  // total must not be certified.
  const buf=await workbook({rows:[[100,100],[200,null]]});
  const db=makeDb({upload:okUpload,org:okOrg,
    canonical:{data:[{total_cost_eur:100}],error:null},download:()=>blob(buf)});
  await processUploadWith(db,7);
  assert.equal(summary(db).ok,false,'the file validator rejects the missing required cost');
  assert.equal(final(db).status,'uploaded');
  assert.equal(final(db).reconciled_at,null);
});

test('PR25-03: a mixed-Azienda extraction cannot be reconciled against the uploader',async()=>{
  const buf=await workbook({rows:[[100,100,'130201'],[200,200,'130202']]});
  const db=makeDb({upload:okUpload,org:okOrg,canonical:{data:[{total_cost_eur:300}],error:null},download:()=>blob(buf)});
  await processUploadWith(db,7);
  assert.equal(summary(db).ok,false);
  assert.match(summary(db).message,/perimetro autorizzato/);
  assert.equal(final(db).status,'uploaded');assert.equal(final(db).reconciled_at,null);
  assert.ok(!db.queries.some(q=>q.table==='canonical_fact'));
});

test('PR25-03: a 2025 source cannot be recorded as covering 2024',async()=>{
  const workbookBuffer=await workbook();
  const db=makeDb({upload:{data:{...okUpload.data,period_covered_start:'2024-01-01',period_covered_end:'2024-12-31'},error:null},org:okOrg,
    canonical:{data:[{total_cost_eur:300}],error:null},download:()=>blob(workbookBuffer)});
  await processUploadWith(db,7);
  assert.equal(summary(db).ok,false);assert.match(summary(db).message,/periodo dichiarato/);
  assert.equal(final(db).reconciled_at,null);
});

test('a different region and a malformed monthly token are each refused',async()=>{
  for(const options of [{region:'140'},{months:'202501'},{year:2025.5}]){
    const buf=await workbook(options);const db=makeDb({upload:okUpload,org:okOrg,download:()=>blob(buf)});
    await processUploadWith(db,7);assert.equal(summary(db).ok,false,JSON.stringify(options));
  }
});

test('CSV is retained for manual review without reading it as an XLSX',async()=>{
  const db=makeDb({upload:{data:{...okUpload.data,file_name:'source.csv',storage_path:'201/source.csv'},error:null},org:okOrg});
  await processUploadWith(db,7);
  assert.equal(summary(db).ok,false);assert.match(summary(db).message,/revisione manuale/);
  assert.equal(db.downloads.length,0);
});

test('an interrupted processing attempt can be rerun without duplicating data or retaining a false reconciliation time',async()=>{
  const buf=await workbook();let interrupted=true;
  const db=makeDb({upload:okUpload,org:okOrg,download:()=>{if(interrupted)throw new Error('read interrupted');return blob(buf);}});
  await processUploadWith(db,7);assert.equal(summary(db).ok,false);assert.equal(final(db).reconciled_at,null);
  interrupted=false;
  await processUploadWith(db,7);const first=summary(db);
  await processUploadWith(db,7);const second=summary(db);
  assert.equal(second.sourceSha256,first.sourceSha256);assert.deepEqual(second.amounts,first.amounts);
  assert.equal(second.processingVersion,'gold-upload-validation-v2');assert.equal(final(db).reconciled_at,null);
  assert.ok(db.updates.every(u=>u.table==='uploads'&&u.filters.length===1&&u.filters[0][1]===7));
});

test('a processing-marker write failure stops before downloading or comparing',async()=>{
  const db=makeDb({upload:okUpload,org:okOrg,writeError:()=>({message:'write unavailable'})});
  await assert.doesNotReject(()=>processUploadWith(db,7));
  assert.equal(db.downloads.length,0);assert.equal(db.updates.length,1);
  assert.equal(final(db).reconciled_at,null);assert.equal(summary(db).ok,false);
});

test('an oversized file is refused before reading its body',async()=>{
  const db=makeDb({upload:okUpload,org:okOrg,download:()=>({data:{size:26*1024*1024,arrayBuffer:()=>{throw new Error('body must not be read');}},error:null})});
  await processUploadWith(db,7);
  assert.equal(summary(db).ok,false);assert.match(summary(db).message,/limite/);assert.equal(final(db).reconciled_at,null);
});
