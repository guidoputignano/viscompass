import test from 'node:test';
import assert from 'node:assert/strict';
import {uploadPeriodError,uploadValidationScope} from '../lib/uploads/processing-contract.ts';

const report=(coverageStart='2025-01-01',coverageEnd='2025-02-28')=>({summary:{coverageStart,coverageEnd}});
test('upload scope derives exact source codes only from configured organization metadata',()=>{
  assert.deepEqual(uploadValidationScope('201',{org_type:'asl',region_code:'130'}),{orgType:'asl',orgCode:'130201',regionCode:'130'});
  assert.deepEqual(uploadValidationScope('130',{org_type:'regione',region_code:'130'}),{orgType:'regione',orgCode:'130',regionCode:'130'});
  for(const [key,org] of [ ['201',null],['201',{org_type:'asl',region_code:null}],['201',{org_type:'regione',region_code:'130'}],
    ['201',{org_type:'other',region_code:'130'}],[' 201',{org_type:'asl',region_code:'130'}],['201',{org_type:'asl',region_code:'13'}]]) {
    assert.equal(uploadValidationScope(key,org),null);
  }
});
test('optional declared dates are checked independently, including real calendar validity',()=>{
  assert.equal(uploadPeriodError(report(),null,null),null);
  assert.equal(uploadPeriodError(report(),'2025-01-01','2025-12-31'),null);
  assert.equal(uploadPeriodError(report(),'2025-01-01',null),null);
  assert.equal(uploadPeriodError(report(),null,'2025-02-28'),null);
  for(const [start,end] of [['2025-02-29',null],['2025-13-01',null],['',null],[null,'2025-02-30'],['2025-03-01','2025-01-01'],
    ['2025-01-02',null],[null,'2025-02-27'],['2024-01-01','2024-12-31']])assert.equal(typeof uploadPeriodError(report(),start,end),'string');
});
test('missing monthly coverage is a review requirement, never an inferred year or zero',()=>{
  assert.match(uploadPeriodError(report(null,null),null,null),/copertura mensile verificabile/);
  assert.equal(uploadPeriodError(report('2024-02-01','2024-02-29'),'2024-02-01','2024-02-29'),null);
});
