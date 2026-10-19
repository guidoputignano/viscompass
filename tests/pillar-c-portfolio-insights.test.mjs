import test from 'node:test';
import assert from 'node:assert/strict';
import {buildCPortfolioPacket,cPortfolioView} from '../lib/dashboard-review/pillar-c/portfolio.ts';
import {cPortfolioDrivers,cPortfolioDirection,cPortfolioPlanning} from '../lib/dashboard-review/pillar-c/portfolio-insights.ts';
import {cWorkbookDecimal} from '../lib/dashboard-review/pillar-c/workbook.ts';
const row=(key,c,year,state='S2',candidates=['AA'])=>({anno:year,mese:1,asl:'AQ',canale:'CO',prodotto_key:key,atc:'TEST',c,attribution_status:state,candidate_portfolios:candidates});
export function fictionalPortfolioView(period='FY2025',id='AA'){
 const vocab=[{id:'AA',label:'Area sintetica A',kind:'area_terapeutica'},{id:'BB',label:'Area sintetica B',kind:'area_terapeutica'}];
 const p=buildCPortfolioPacket([row('900000001','100',2024),row('900000001','120',2025),row('900000002','30',2024),row('900000003','8',2025),row('900000004','50',2025,'S3',['AA','BB']),row('900000004','-5',2025,'S3',['AA','BB'])],vocab,new Map([['900000001','Prodotto sintetico A']]),'1'.repeat(64),'2'.repeat(64),'fictional');
 return cPortfolioView(p,period,'AQ','CO',id,'3'.repeat(64));
}
test('portfolio interpretation preserves chronological change and exact contribution reconciliation',()=>{
 const view=fictionalPortfolioView(),d=cPortfolioDrivers(view);
 assert.equal(view.change,'-2');assert.deepEqual(d.components.map(c=>c.value),['20','8','-30']);
 assert.equal(d.largestIncrease.key,'900000001');assert.equal(d.largestDecrease.key,'900000002');
 assert.equal(cPortfolioDirection(view).earlier.fixed.net,'130');
 const absent=fictionalPortfolioView('FY2025','BB');assert.equal(absent.change,null);assert.deepEqual(cPortfolioDrivers(absent).components.map(c=>c.value),[null,null,null]);
 const earlierSelected=fictionalPortfolioView('FY2024');assert.deepEqual(cPortfolioDrivers(earlierSelected),d);
});
test('planning assumptions retain exact decimal precision and never allocate shared exposure',()=>{
 const v=fictionalPortfolioView(),zero=cPortfolioPlanning(v,0),up=cPortfolioPlanning(v,1000);
 assert.deepEqual(zero,{mode:'user-assumption',basisPoints:0,fixed:'128',change:'0',lower:'123',upper:'178'});
 assert.deepEqual(up,{mode:'user-assumption',basisPoints:1000,fixed:'140.8',change:'12.8',lower:'135.8',upper:'190.8'});
 const before=JSON.stringify(v);cPortfolioPlanning(v,-2000);assert.equal(JSON.stringify(v),before);
 for(const b of [NaN,0.5,10001,-5001])assert.throws(()=>cPortfolioPlanning(v,b));
 assert.equal(cPortfolioPlanning(fictionalPortfolioView('FY2025','BB'),0),null,'candidate-only exposure does not invent a fixed baseline');
 const tiny=fictionalPortfolioView();tiny.dossier.fixed.net='0.100000000000000000001';
 assert.equal(cPortfolioPlanning(tiny,1).fixed,'0.1000100000000000000010001');
 assert.equal(cWorkbookDecimal(cPortfolioPlanning(v,1000).fixed,2),'140,80');
});
