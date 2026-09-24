import test from 'node:test';
import assert from 'node:assert/strict';
import {validateVenMapping,resolveVen,venCoverage,abcVenMatrix,VEN_CRITERIA} from '../lib/analytics/ven.ts';

const base={mapping_version:'2026-09-24.1',supplied_by:'Commissione terapeutica',supplied_at:'2026-09-24',
 approved_by:'Direzione sanitaria',approved_at:'2026-09-24',valid_from:'2026-01-01',valid_to:null,status:'approved'};
const row=(scope_key,ven_class,over={})=>({...base,scope_key,ven_class,...over});

test('the criteria are the quoted source definitions, not a paraphrase',()=>{
  assert.match(VEN_CRITERIA.V.definition,/potentially lifesaving/);
  assert.match(VEN_CRITERIA.E.definition,/less severe but nevertheless significant/);
  assert.match(VEN_CRITERIA.N.definition,/minor or self-limited illnesses/);
});

test('a well-formed mapping validates',()=>{
  const v=validateVenMapping([row('J01DH02','V'),row('J01MA02','E')],['J01DH02','J01MA02']);
  assert.deepEqual(v.errors,[]);
  assert.equal(v.ok,true);
});

test('malformed rows are rejected rather than dropped',()=>{
  const v=validateVenMapping([
    row('J01DH02','X'),                            // not a VEN class
    row('nope','V'),                               // neither AIC nor ATC5
    row('J01MA02','E',{valid_to:'2025-01-01'}),    // ends before it starts
    row('J01XX08','V',{supplied_by:'  '}),         // unattributed
  ]);
  assert.equal(v.ok,false);
  assert.match(v.errors.join(' '),/is not V, E or N/);
  assert.match(v.errors.join(' '),/neither a 9-digit AIC nor an ATC5/);
  assert.match(v.errors.join(' '),/valid_to must be after valid_from/);
  assert.match(v.errors.join(' '),/supplied_by is required/);
});

test('a product classified twice differently is a conflict, not last-write-wins',()=>{
  const v=validateVenMapping([row('J01DH02','V'),row('J01DH02','N')]);
  assert.equal(v.ok,false);
  assert.match(v.errors.join(' '),/conflicting classes V and N/);
  // The same class twice is merely noisy.
  const dup=validateVenMapping([row('J01DH02','V'),row('J01DH02','V')]);
  assert.equal(dup.ok,true);
  assert.match(dup.warnings.join(' '),/duplicated with the same class/);
});

test('approval is constrained by value, so a submitter cannot approve themselves',()=>{
  const selfApproved=validateVenMapping([row('J01DH02','V',{approved_by:'Commissione terapeutica'})]);
  assert.equal(selfApproved.ok,false);
  assert.match(selfApproved.errors.join(' '),/approved_by and supplied_by are the same person/);

  const pendingWithApproval=validateVenMapping([row('J01DH02','V',{status:'pending'})]);
  assert.equal(pendingWithApproval.ok,false);
  assert.match(pendingWithApproval.errors.join(' '),/pending row must not carry approval metadata/);

  const approvedWithout=validateVenMapping([row('J01DH02','V',{approved_by:null,approved_at:null})]);
  assert.equal(approvedWithout.ok,false);
  assert.match(approvedWithout.errors.join(' '),/needs approved_by and an ISO approved_at/);
});

test('a 9-digit AIC keeps its leading zeros',()=>{
  assert.equal(validateVenMapping([row('022211039','V')]).ok,true);
  // Eight digits is a different product, not a coercible one.
  assert.equal(validateVenMapping([row('22211039','V')]).ok,false);
});

test('every unmapped state is distinguishable, and none defaults to non-essential',()=>{
  const rows=[row('J01DH02','V'),row('J01MA02','E',{valid_to:'2026-06-01'}),
    row('J01XX08','V'),row('J01XX08','N',{supplied_at:'2026-09-25'})];
  assert.deepEqual(resolveVen('J01DH02',rows,'2026-09-24'),{ven:'V',status:'approved_mapping_match'});
  assert.deepEqual(resolveVen('J01CA04',rows,'2026-09-24'),{ven:null,status:'not_in_approved_mapping'});
  assert.deepEqual(resolveVen('J01MA02',rows,'2026-09-24'),{ven:null,status:'approved_mapping_expired'});
  assert.deepEqual(resolveVen('J01XX08',rows,'2026-09-24'),{ven:null,status:'ambiguous_in_approved_mapping'});
  assert.deepEqual(resolveVen('J01DH02',[],'2026-09-24'),{ven:null,status:'no_approved_mapping'});
  // A pending row is not an approved one.
  assert.deepEqual(resolveVen('J01DH02',[row('J01DH02','V',{status:'pending',approved_by:null,approved_at:null})],'2026-09-24'),
    {ven:null,status:'no_approved_mapping'});
});

test('validity periods are honoured on both edges',()=>{
  const rows=[row('J01DH02','V',{valid_from:'2026-01-01',valid_to:'2026-07-01'})];
  assert.equal(resolveVen('J01DH02',rows,'2025-12-31').status,'approved_mapping_expired');
  assert.equal(resolveVen('J01DH02',rows,'2026-01-01').ven,'V');
  assert.equal(resolveVen('J01DH02',rows,'2026-06-30').ven,'V');
  assert.equal(resolveVen('J01DH02',rows,'2026-07-01').status,'approved_mapping_expired');
});

test('coverage counts what is classified and names what is not',()=>{
  const perimeter=['J01DH02','J01MA02','J01CA04','J01XX08'];
  const c=venCoverage(perimeter,[row('J01DH02','V'),row('J01MA02','E')],'2026-09-24');
  assert.equal(c.total,4);
  assert.equal(c.classified,2);
  assert.equal(c.coverage,0.5);
  assert.deepEqual(c.unclassified,['J01CA04','J01XX08']);
  assert.equal(c.byStatus.not_in_approved_mapping,2);
  // With no approved mapping at all, nothing is quietly assumed.
  const none=venCoverage(perimeter,[],'2026-09-24');
  assert.equal(none.classified,0);
  assert.equal(none.byStatus.no_approved_mapping,4);
});

test('the matrix refuses to draw on partial coverage, and shows what it excluded',()=>{
  const items=[
    {band:'A',scopeKey:'J01DH02',value:1000},
    {band:'A',scopeKey:'J01MA02',value:500},
    {band:'B',scopeKey:'J01CA04',value:100},
  ];
  const partial=abcVenMatrix(items,[row('J01DH02','V')],'2026-09-24');
  assert.equal(partial.available,false);
  assert.match(partial.reason,/33%/);
  assert.equal(partial.excluded.length,2);
  // The excluded spend stays visible rather than shrinking the totals silently.
  assert.equal(partial.excluded.reduce((s,e)=>s+e.value,0),600);

  const full=abcVenMatrix(items,[row('J01DH02','V'),row('J01MA02','E'),row('J01CA04','N')],'2026-09-24');
  assert.equal(full.available,true);
  assert.equal(full.cells.AV.value,1000);
  assert.equal(full.cells.AE.value,500);
  assert.equal(full.cells.BN.value,100);
  assert.equal(full.cells.AN.count,0);
  assert.deepEqual(full.excluded,[]);
});

test('a lower threshold can be chosen deliberately, and still reports exclusions',()=>{
  const items=[{band:'A',scopeKey:'J01DH02',value:900},{band:'C',scopeKey:'J01CA04',value:10}];
  const m=abcVenMatrix(items,[row('J01DH02','V')],'2026-09-24',0.5);
  assert.equal(m.available,true);
  assert.equal(m.cells.AV.value,900);
  assert.equal(m.excluded.length,1);
  assert.equal(m.excluded[0].status,'not_in_approved_mapping');
});
