import test from 'node:test';
import assert from 'node:assert/strict';
import {privatePillarAnalysis,PRIVATE_RELEASE} from '../lib/analytics/private-pillar-a.ts';
const fixture=()=>['x','y'].flatMap(org_code=>[2023,2024,2025].flatMap(year=>['A','W','R','T'].map(aware_category=>({release_id:PRIVATE_RELEASE,org_code,year,aware_category,cf:aware_category==='T'?300:100,cmr:aware_category==='T'?270:90,ddd:aware_category==='T'?30:10,activity:org_code==='x'?100:200,activity_variant:'A3/T1',source_hash:'a'.repeat(64)}))));
test('private aggregation does not quadruple activity or average rates',()=>{
 const rows=privatePillarAnalysis(fixture());
 assert.equal(rows[0].cf,600);assert.equal(rows[0].activity,300);assert.equal(rows[0].dddPer100Activity,20);
 assert.equal(rows[1].bridge.volume+rows[1].bridge.average,0);
 assert.equal(rows[0].categories.reduce((s,r)=>s+r.cf,0),rows[0].cf);
});
test('private pipeline rejects partial, duplicate, invalid and mixed-source records',()=>{
 const rows=fixture();assert.throws(()=>privatePillarAnalysis(rows.slice(1)));
 assert.throws(()=>privatePillarAnalysis([...rows,rows[0]]));
 for(const patch of [{cf:NaN},{ddd:null},{activity:0},{activity_variant:'A2'},{source_hash:'b'.repeat(64)},{cf:12}])assert.throws(()=>privatePillarAnalysis([{...rows[0],...patch},...rows.slice(1)]));
 assert.deepEqual(privatePillarAnalysis([]),[]);
});
