import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {workbookAnalysis} from '../lib/analytics/private-workbook.ts';
const row=(year,category,cost,ddd)=>({org_code:'fixture',year,aware_category:category,cost_eur:cost,ddd_count:ddd,unit_code:null});
test('missing and zero values are not interchangeable; no invented 2025 reference',()=>{
  const result=workbookAnalysis([row(2025,'T',0,0),row(2025,'A',null,null)])[0];
  assert.equal(result.cost,0);assert.equal(result.costPerDdd,null);assert.equal(result.categories[0].cost,null);assert.equal(result.decomposition,null);
});
test('duplicate keys fail, and missing prior years do not become year-on-year changes',()=>{
  assert.throws(()=>workbookAnalysis([row(2023,'T',1,1),row(2023,'T',1,1)]));
  assert.equal(workbookAnalysis([row(2023,'T',1,1),row(2025,'T',2,2)])[1].costYoy,null);
});
test('same-org scope and decomposition identity',()=>{
  const rows=[row(2024,'T',100,60),row(2024,'A',20,20),row(2024,'W',30,30),row(2024,'R',50,10)];
  const d=workbookAnalysis(rows)[0].decomposition;assert.ok(d);assert.ok(Math.abs(d.residual)<1e-8);
});
const path=new URL('../private-staging/workbook-regression.json',import.meta.url);
test('actual TypeScript calculations match private workbook cached results',{skip:!fs.existsSync(path)},()=>{
 const {facts,expected}=JSON.parse(fs.readFileSync(path,'utf8'));
 for(const org of ['201','202','203','204'])for(const r of workbookAnalysis(facts.filter(x=>x.org_code===org))){
   const e=expected[`${org}/${r.year}`];if(!e){assert.equal(r.decomposition,null);continue;}
   for(const k of Object.keys(e))assert.ok(Math.abs(r.decomposition[k]-e[k])<0.00001,`${org}/${r.year}/${k}`);
 }
});
