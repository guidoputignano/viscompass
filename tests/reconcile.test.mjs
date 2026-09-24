import test from 'node:test';
import assert from 'node:assert/strict';
import {reconcileRows,normaliseAic,summariseReconciliation} from '../lib/uploads/reconcile.ts';

let n=0;
const row=(over={})=>({sourceRow:++n,aslCode:'130201',aic:'022211039',manufacturer:'ACME',
  quantity:10,cost:100,months:12,...over});

test('an AIC is zero-padded or left unresolved, never trimmed into range',()=>{
  assert.equal(normaliseAic('22211039'),'022211039');
  assert.equal(normaliseAic('022211039'),'022211039');
  assert.equal(normaliseAic(' 22211039 '),'022211039');
  // Stripping letters out of an ATC code would yield a real-looking wrong key.
  assert.equal(normaliseAic('C08CA05'),null);
  assert.equal(normaliseAic('0222110391'),null,'ten digits is not an AIC');
  assert.equal(normaliseAic(''),null);
  assert.equal(normaliseAic(null),null);
});

test('zero quantity makes the unit price undefined, not zero',()=>{
  const r=reconcileRows([row({quantity:0,cost:0}),row({aic:'044931018',quantity:null,cost:null})]);
  assert.equal(r.rows.accepted,2);
  assert.equal(r.notes.join(' ').includes('undefined, not zero'),true);
  // Both routes to an absent price behave identically: blank and #DIV/0 alike.
  assert.match(r.notes.join(' '),/2 accepted row\(s\) have no unit price/);
});

test('a partial month count is normal, not a defect',()=>{
  const r=reconcileRows([row({months:3}),row({aic:'044931018',months:12})]);
  assert.equal(r.rows.accepted,2);
  assert.equal(r.rows.quarantined,0);
  assert.match(r.notes.join(' '),/fewer than twelve months, which is normal/);
});

test('open Region questions are quarantined with their amounts, not decided',()=>{
  const r=reconcileRows([
    row({aslCode:'ND',cost:1047956}),
    row({aslCode:'130106',cost:1809}),
    row({cost:500}),
  ]);
  assert.equal(r.rows.accepted,1);
  assert.equal(r.rows.quarantined,2);
  assert.equal(r.amounts.accepted,500);
  assert.equal(r.amounts.quarantined,1049765);
  assert.equal(r.amounts.awaitingRegion,1049765,'both are open questions for the Region');
  assert.deepEqual(r.quarantine.map(q=>q.code).sort(),['nd_asl_unresolved','orphan_asl_code_130106']);
  assert.equal(r.quarantine.every(q=>q.awaitingRegion),true);
  // The held amount is stated, so a clean-looking total cannot hide it.
  assert.match(summariseReconciliation(r),/1049765\.00, escluse dal totale/);
});

test('both copies of a duplicated key are held, not one',()=>{
  const r=reconcileRows([row({cost:10}),row({cost:20}),row({aic:'044931018',cost:30})]);
  assert.equal(r.rows.quarantined,2);
  assert.equal(r.amounts.quarantined,30);
  assert.equal(r.quarantine.every(q=>q.code==='duplicate_source_key'),true);
  assert.equal(r.rows.accepted,1);
});

test('negatives and malformed keys are separated by whether the Region owes an answer',()=>{
  const r=reconcileRows([row({quantity:-5,cost:-50}),row({aic:'C08CA05',cost:70})]);
  assert.equal(r.rows.quarantined,2);
  const byCode=Object.fromEntries(r.quarantine.map(q=>[q.code,q.awaitingRegion]));
  assert.equal(byCode.negative_adjustment,true,'the negative-adjustment rule is undefined');
  assert.equal(byCode.aic_not_nine_digits,false,'a malformed key is settled, not a Region question');
});

test('an empty canonical table is never reported as a pass',()=>{
  const rows=[row({cost:100})];
  const empty=reconcileRows(rows,{canonical:{rowCount:0,costEur:0}});
  assert.equal(empty.canonical.available,false);
  assert.match(empty.canonical.reason,/an empty comparison is not a pass/);
  assert.notEqual(empty.status,'reconciled');
  assert.equal(empty.status,'canonical_comparison_unavailable');

  const unreadable=reconcileRows(rows,{canonical:null});
  assert.equal(unreadable.canonical.available,false);
  assert.equal(unreadable.status,'canonical_comparison_unavailable');
});

test('a real canonical comparison decides the outcome',()=>{
  const rows=[row({cost:100}),row({aic:'044931018',cost:200})];
  const ok=reconcileRows(rows,{canonical:{rowCount:2,costEur:300}});
  assert.equal(ok.canonical.available,true);
  assert.equal(ok.status,'reconciled');
  assert.equal(ok.canonical.difference,0);

  const off=reconcileRows(rows,{canonical:{rowCount:2,costEur:250}});
  assert.equal(off.status,'discrepancy_found');
  assert.equal(off.canonical.difference,50);
  assert.match(summariseReconciliation(off),/Differenza rispetto ai dati canonici: EUR 50\.00/);
});

test('the declared total decides only when canonical is unavailable',()=>{
  const rows=[row({cost:100})];
  const matches=reconcileRows(rows,{declaredTotalCost:100});
  assert.equal(matches.status,'reconciled');
  assert.equal(matches.declared.withinTolerance,true);

  const differs=reconcileRows(rows,{declaredTotalCost:120});
  assert.equal(differs.status,'discrepancy_found');
  assert.equal(differs.declared.difference,-20);

  // Canonical wins when it is genuinely available.
  const both=reconcileRows(rows,{declaredTotalCost:120,canonical:{rowCount:1,costEur:100}});
  assert.equal(both.status,'reconciled');
});

test('quarantined amounts never enter the reconciled total',()=>{
  const rows=[row({cost:100}),row({aslCode:'ND',cost:9999})];
  const r=reconcileRows(rows,{canonical:{rowCount:1,costEur:100}});
  assert.equal(r.amounts.accepted,100);
  assert.equal(r.status,'reconciled');
  // Reconciled, yet 9,999 is held: the summary has to say so.
  assert.match(summariseReconciliation(r),/9999\.00/);
});

test('a file with nothing usable does not report success',()=>{
  const r=reconcileRows([row({aslCode:'ND'})],{canonical:{rowCount:5,costEur:100}});
  assert.equal(r.status,'nothing_to_reconcile');
  assert.equal(r.rows.accepted,0);
});

test('reconciliation is idempotent for the same input',()=>{
  const rows=[row({cost:100}),row({aslCode:'ND',cost:50})];
  const a=reconcileRows(rows,{canonical:{rowCount:1,costEur:100}});
  const b=reconcileRows(rows,{canonical:{rowCount:1,costEur:100}});
  assert.deepEqual(a,b);
});

test('reconcileUpload never throws: the upload row is already inserted when it runs',async()=>{
  // lib/dashboard-review/actions.ts inserts the row and then calls this. Throwing
  // here would show the user a failure for an upload that actually succeeded.
  const {reconcileUpload}=await import('../lib/uploads/reconcile.ts');
  await assert.doesNotReject(()=>reconcileUpload(1));
  // And it must not claim success either: it writes nothing at all.
  assert.equal(await reconcileUpload(1),undefined);
});
