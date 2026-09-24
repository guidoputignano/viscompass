import test from 'node:test';
import assert from 'node:assert/strict';
import {readReconciliationSummary,uploadDisposition} from '../lib/uploads/summary-view.ts';
import {reconcileRows,summariseReconciliation} from '../lib/uploads/reconcile.ts';

test('an absent or unreadable summary is never a pass',()=>{
  for(const raw of [null,undefined,{}]){
    const v=readReconciliationSummary(raw);
    // {} is an object, so it parses — but with no outcome it must not claim one.
    assert.notEqual(v.kind==='report'&&v.outcome,'reconciled');
  }
  assert.equal(readReconciliationSummary(null).kind,'none');
  assert.equal(readReconciliationSummary(undefined).kind,'none');
});

test('a recorded failure reads as a failure, not as a quiet upload',()=>{
  const v=readReconciliationSummary({ok:false,message:'Il file non è leggibile.',at:'2026-09-24T09:00:00.000Z'});
  assert.equal(v.kind,'failed');
  assert.equal(v.tone,'danger');
  assert.equal(v.message,'Il file non è leggibile.');
});

test('an outcome this release does not know is flagged, never treated as reconciled',()=>{
  const v=readReconciliationSummary({ok:true,outcome:'partially_reconciled_v2'});
  assert.equal(v.kind,'report');
  assert.equal(v.outcome,null,'an unknown string is not coerced into a known status');
  assert.equal(v.tone,'warning');
  assert.notEqual(v.label,'Riconciliato');
});

test('each known outcome carries a tone that matches what it means',()=>{
  const tone=o=>readReconciliationSummary({ok:true,outcome:o}).tone;
  assert.equal(tone('reconciled'),'positive');
  assert.equal(tone('discrepancy_found'),'danger');
  assert.equal(tone('incomplete_data'),'warning');
  assert.equal(tone('nothing_to_reconcile'),'warning');
  // Neutral, not positive: nothing was compared, so nothing passed.
  assert.equal(tone('canonical_comparison_unavailable'),'neutral');
});

test('a canonical comparison is a pass only when it says so explicitly',()=>{
  const read=c=>readReconciliationSummary({ok:true,outcome:'reconciled',canonical:c}).canonical;
  assert.equal(read({available:false,reason:'canonical_fact è vuota.'}).available,false);
  // Truthy but not `true`, and a missing flag: neither is a comparison.
  assert.equal(read({available:'yes',expected:10,difference:0}).available,false);
  assert.equal(read({expected:10,difference:0}).available,false);
  // Claims availability but the figures are unreadable: still not a comparison.
  assert.equal(read({available:true,expected:'10',difference:0}).available,false);
  const ok=read({available:true,expected:100,difference:0,withinTolerance:true});
  assert.deepEqual(ok,{available:true,expected:100,difference:0,withinTolerance:true});
  // withinTolerance absent must not read as tolerated.
  assert.equal(read({available:true,expected:100,difference:5}).withinTolerance,false);
});

test('a non-finite amount is absent, never rendered as a zero',()=>{
  // jsonb cannot hold NaN, but a null or a string can arrive from an older row,
  // and an understated total is worse than a blank one.
  const v=readReconciliationSummary({ok:true,outcome:'reconciled',amounts:{accepted:null,quarantined:0,awaitingRegion:0}});
  assert.equal(v.amounts,null);
  assert.deepEqual(
    readReconciliationSummary({ok:true,outcome:'reconciled',amounts:{accepted:1,quarantined:2,awaitingRegion:3}}).amounts,
    {accepted:1,quarantined:2,awaitingRegion:3},
  );
});

test('quarantine folds to one line per reason, largest amount first',()=>{
  const v=readReconciliationSummary({ok:true,outcome:'incomplete_data',quarantine:[
    {sourceRow:3,code:'nd_asl_unresolved',reason:'ASL ND',cost:10,awaitingRegion:false},
    {sourceRow:4,code:'nd_asl_unresolved',reason:'ASL ND',cost:15,awaitingRegion:true},
    {sourceRow:5,code:'negative_adjustment',reason:'Nota di credito',cost:-5,awaitingRegion:false},
    {sourceRow:6,code:'duplicate_source_key',reason:'Chiave duplicata',cost:100,awaitingRegion:false},
  ]});
  assert.deepEqual(v.quarantine.map(g=>g.code),
    ['duplicate_source_key','nd_asl_unresolved','negative_adjustment']);
  const nd=v.quarantine.find(g=>g.code==='nd_asl_unresolved');
  assert.equal(nd.rows,2);
  assert.equal(nd.cost,25);
  assert.equal(nd.awaitingRegion,true,'one row awaiting the Region makes the group awaiting');
});

test('the stored shape round-trips from the reconciler that wrote it',()=>{
  const report=reconcileRows([
    {sourceRow:3,aslCode:'130201',aic:'022211039',quantity:10,cost:100,months:12},
    {sourceRow:4,aslCode:'ND',aic:'022211040',quantity:5,cost:50,months:12},
    {sourceRow:5,aslCode:'130201',aic:'022211041',quantity:-1,cost:-20,months:12},
  ],{canonical:null});

  // Exactly what lib/uploads/process-upload.ts writes to the jsonb column.
  const stored=JSON.parse(JSON.stringify({
    ok:true,
    message:summariseReconciliation(report),
    outcome:report.status,
    rows:report.rows,
    amounts:report.amounts,
    canonical:report.canonical,
    declared:report.declared,
    notes:report.notes,
    source:{sheetName:'DIR_OSP_TRA_003AS',basisHeader:'DISTRIBUZIONE DIRETTA+ DISTRIBUZIONE PER CONTO+CONSUMI OSPEDALIERI'},
    quarantine:report.quarantine,
    at:'2026-09-24T10:00:00.000Z',
  }));

  const v=readReconciliationSummary(stored);
  assert.equal(v.kind,'report');
  assert.equal(v.outcome,report.status,'the reconciler status survives the column');
  assert.deepEqual(v.rows,report.rows);
  assert.deepEqual(v.amounts,report.amounts);
  assert.deepEqual(v.canonical,report.canonical);
  assert.equal(v.message,summariseReconciliation(report));
  assert.equal(v.basis,'DISTRIBUZIONE DIRETTA+ DISTRIBUZIONE PER CONTO+CONSUMI OSPEDALIERI');
  assert.equal(v.at,'2026-09-24T10:00:00.000Z');
  // No quarantined row is lost on the way to the screen.
  assert.equal(v.quarantine.reduce((s,g)=>s+g.rows,0),report.rows.quarantined);
  assert.deepEqual(
    new Set(v.quarantine.map(g=>g.code)),
    new Set(report.quarantine.map(q=>q.code)),
  );
});

// Counting. These pin the page-level classification that the adversarial review
// found was silently excluding never-examined uploads.

test('a stored file that was never examined counts as unreconciled, not as fine',()=>{
  // reconciliation_summary NULL. processUpload is awaited inline by recordUpload
  // with no retry or queue behind it, so this is never "pending" — it is a file
  // nobody looked at, and it used to count as zero.
  assert.equal(uploadDisposition(readReconciliationSummary(null),'uploaded'),'not_examined');
  // Stranded mid-parse: the row was marked processing and nothing ever cleared it.
  assert.equal(uploadDisposition(readReconciliationSummary(null),'processing'),'not_examined');
});

test('a column claiming reconciled without a summary is not trusted',()=>{
  // There is no evidence behind it. Treating it as a pass is the exact failure
  // this codebase forbids; under-reporting is the safe direction.
  assert.equal(uploadDisposition(readReconciliationSummary(null),'reconciled'),'not_examined');
});

test('a discrepancy is never under-reported, even with an unreadable summary',()=>{
  assert.equal(uploadDisposition(readReconciliationSummary(null),'discrepancy_found'),'discrepancy');
  assert.equal(
    uploadDisposition(readReconciliationSummary({ok:true,outcome:'discrepancy_found'}),'uploaded'),
    'discrepancy');
});

test('only a genuine reconciliation counts as reconciled',()=>{
  const d=(o)=>uploadDisposition(readReconciliationSummary(o),'uploaded');
  assert.equal(d({ok:true,outcome:'reconciled'}),'reconciled');
  // Everything else that was actually examined is not_reconciled.
  assert.equal(d({ok:true,outcome:'canonical_comparison_unavailable'}),'not_reconciled');
  assert.equal(d({ok:true,outcome:'incomplete_data'}),'not_reconciled');
  assert.equal(d({ok:true,outcome:'nothing_to_reconcile'}),'not_reconciled');
  assert.equal(d({ok:true,outcome:'something_new_in_v3'}),'not_reconciled','unknown is never a pass');
  assert.equal(d({ok:false,message:'storage non leggibile'}),'not_reconciled');
});
