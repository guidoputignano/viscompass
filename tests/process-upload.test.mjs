import test from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import {processUploadWith} from '../lib/uploads/process-upload.ts';

// Drives the orchestration against a fake Supabase client. The pure
// reconciliation is covered in reconcile.test.mjs and the parser in
// gold-file.test.mjs; what is tested here is the wiring between them, which is
// where a file can end up marked reconciled without having been.

const GROUP='DISTRIBUZIONE DIRETTA+ DISTRIBUZIONE PER CONTO+CONSUMI OSPEDALIERI';
const LABELS={4:'Codice Azienda Sanitaria',8:'Codice AIC',10:'Mesi disponibili',
  19:'Quantita (a)',20:'Prezzo (b)',21:'Costo SellOut (c)'};

async function workbook({group=GROUP,rows=[[100,100],[200,200]]}={}){
  const wb=new ExcelJS.Workbook();
  const ws=wb.addWorksheet('DIR_OSP_TRA_003AS');
  for(const c of [19,20,21]) ws.getRow(1).getCell(c).value=group;
  for(const [c,v] of Object.entries(LABELS)) ws.getRow(2).getCell(Number(c)).value=v;
  ws.getRow(2).getCell(34).value='ultima';
  rows.forEach(([qty,cost],i)=>{
    const r=ws.getRow(3+i);
    r.getCell(1).value=2025; r.getCell(2).value='130'; r.getCell(4).value='130201';
    r.getCell(7).value='PRODOTTO'; r.getCell(8).value=`02221103${i}`;
    r.getCell(10).value='202501\n202502'; r.getCell(12).value='ACME';
    r.getCell(19).value=qty; r.getCell(21).value=cost;
  });
  return wb.xlsx.writeBuffer();
}

/** Minimal stand-in for the service-role client: records every write. */
function makeDb({upload,org,canonical,download}={}){
  const updates=[],queries=[],downloads=[];
  const settle=(q)=>{
    if(q.op==='update'){updates.push({table:q.table,patch:q.payload,filters:q.filters});return {data:null,error:null};}
    queries.push({table:q.table,filters:q.filters});
    if(q.table==='uploads') return upload??{data:null,error:{message:'no row'}};
    if(q.table==='organizations') return org??{data:null,error:null};
    if(q.table==='canonical_fact') return canonical??{data:[],error:null};
    throw new Error(`unexpected table ${q.table}`);
  };
  return {
    updates,queries,downloads,
    from(table){
      const q={table,op:null,payload:null,filters:[]};
      const api={
        select(){q.op='select';return api;},
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

const okUpload={data:{id:7,org_code:'201',storage_path:'201/file.xlsx'},error:null};
const okOrg={data:{region_code:'130'},error:null};
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
  assert.match(summary(db).message,/PER CONTO/,'the refusal names the missing flow');
  assert.equal(final(db).status,'uploaded');
  assert.equal(final(db).reconciled_at,undefined,'a refused file never stamps a time');
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

test('a matching canonical total reconciles and stamps the time',async()=>{
  const buf=await workbook();                       // accepted total = 300
  const db=makeDb({upload:okUpload,org:okOrg,
    canonical:{data:[{total_cost_eur:300}],error:null},download:()=>blob(buf)});
  await processUploadWith(db,7);
  const s=summary(db);
  assert.equal(s.outcome,'reconciled');
  assert.equal(final(db).status,'reconciled');
  assert.ok(final(db).reconciled_at,'a genuine reconciliation stamps a time');
  assert.equal(s.canonical.available,true);
  assert.equal(s.amounts.accepted,300);
});

test('a mismatching canonical total is a discrepancy and stamps nothing',async()=>{
  const buf=await workbook();
  const db=makeDb({upload:okUpload,org:okOrg,
    canonical:{data:[{total_cost_eur:999999}],error:null},download:()=>blob(buf)});
  await processUploadWith(db,7);
  assert.equal(summary(db).outcome,'discrepancy_found');
  assert.equal(final(db).status,'discrepancy_found');
  assert.equal(final(db).reconciled_at,null,'a discrepancy is not a reconciliation');
});

test('both asl key forms are queried, because which one is right is unverified',async()=>{
  const buf=await workbook();
  const db=makeDb({upload:okUpload,org:okOrg,download:()=>blob(buf)});
  await processUploadWith(db,7);
  const q=db.queries.find(q=>q.table==='canonical_fact');
  const keys=q.filters.find(([c])=>c==='asl_code')[1];
  assert.deepEqual(keys,['201','130201']);
  const years=q.filters.find(([c])=>c==='year')[1];
  assert.deepEqual(years,[2025],'years come from the file, not a hardcoded window');
});

test('an organization with no region falls back to the bare org code',async()=>{
  const buf=await workbook();
  const db=makeDb({upload:okUpload,org:{data:null,error:null},download:()=>blob(buf)});
  await processUploadWith(db,7);
  const q=db.queries.find(q=>q.table==='canonical_fact');
  assert.deepEqual(q.filters.find(([c])=>c==='asl_code')[1],['201'],'never an undefined-prefixed key');
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
