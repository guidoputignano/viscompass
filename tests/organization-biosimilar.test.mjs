import test from 'node:test';
import assert from 'node:assert/strict';
import {organizationBiosimilarRows,organizationHeadroomByMolecule} from '../lib/dashboard-review/organization-biosimilar.ts';
import {buildBiosimilarRows,headroomTotal} from '../lib/dashboard-review/biosimilar.ts';

// Invented amounts, organization labels and stratum. No workbook figures.
const options={classifyArea:()=>({label:'Test area',status:'review_required'})};
const fact=(asl_code,bio,month,spend,quantity)=>({asl_code,active_substance:'TEST-S',year:2025,month,total_cost_eur:spend,
  biosimilar_flag:bio,originator_flag:!bio,quantity_packs:null,total_content_mg:null,cost_per_mg:null,cost_per_ddd:null,
  perimeter_status:bio?'biosimilar':'reference_medicine',comparable_eligible:true,comparable_quantity:quantity,
  comparable_unit:'MG',comparable_stratum_id:'TEST-STRATUM'});
test('one Azienda cannot supply the other Azienda’s missing comparison side',()=>{
  const rows=[fact('TEST-A',false,1,100,10),fact('TEST-B',true,1,20,10)];
  assert.ok(headroomTotal(buildBiosimilarRows(rows,2025,options)).total>0,'pooled fixture must expose the mistake');
  const isolated=organizationBiosimilarRows(rows,2025,options);
  assert.equal(headroomTotal(isolated.map(x=>x.row)).total,null);
  assert.equal(organizationHeadroomByMolecule(isolated).has('TEST-S'),false);
});
test('organization price comparisons are added, never replaced by pooled prices',()=>{
  const rows=[fact('TEST-A',false,1,100,10),fact('TEST-A',true,1,50,100),fact('TEST-B',false,1,300,10),fact('TEST-B',true,1,20,1)];
  const isolated=organizationBiosimilarRows(rows,2025,options);
  assert.equal(headroomTotal(isolated.map(x=>x.row)).total,195);
  assert.equal(organizationHeadroomByMolecule(isolated).get('TEST-S'),195);
  assert.notEqual(headroomTotal(buildBiosimilarRows(rows,2025,options)).total,195);
});
test('each Azienda keeps its historical opening; unattributed records do not invent one',()=>{
  const rows=[fact('TEST-A',false,1,100,10),fact('TEST-A',false,5,100,10),fact('TEST-A',true,5,50,10),fact('TEST-B',true,1,20,10),fact(null,true,1,1,100)];
  const isolated=organizationBiosimilarRows(rows,2025,options);
  const a=isolated.find(x=>x.organizationCode==='TEST-A').row;
  assert.equal(a.substitutable_originator_spend_eur,100);
  assert.equal(a.substitution_headroom_eur,50);
  assert.equal(isolated.some(x=>x.organizationCode===null),false);
});
