import test from 'node:test';
import assert from 'node:assert/strict';
import {buildCPortfolioPacket,cPortfolioView} from '../lib/dashboard-review/pillar-c/portfolio.ts';
import {cPortfolioPvm,C_PORTFOLIO_PVM_SUM_TOLERANCE} from '../lib/dashboard-review/pillar-c/portfolio-pvm.ts';
import {C_WORKBOOK_HASH} from '../lib/dashboard-review/pillar-c/workbook.ts';

// Invented financial values; fingerprints only identify the expected source contract.
const SOURCE='ff084e85af09c38df52445019af479397ea8313df79c736c4098c60f7edb8eac';
const CLASSIFICATION='e2b3c5900036eec54fc01134d32d0f19bd9341db790916ced99b5152f9ad50aa';
const n=raw=>[String(raw),164];
function fixture(period='FY2025',org='Regione',channel='Tutti'){
  const vocabulary=[{id:'AA',label:'Portafoglio sintetico A',kind:'area_terapeutica'}];
  const rows=[2024,2025].map(year=>({anno:year,mese:1,asl:'AQ',canale:'CO',prodotto_key:'900000001',atc:'TEST',c:year===2024?'100':'120',attribution_status:'S2',candidate_portfolios:['AA']}));
  const packet=buildCPortfolioPacket(rows,vocabulary,new Map(),SOURCE,CLASSIFICATION,'v0.1-2026-10-12');
  const view=cPortfolioView(packet,period,org,channel,'AA','3'.repeat(64));
  const table={sheet:'12A_ML4_Price_Vol_Mix',range:'A209:L234',startColumn:1,
    columns:['Portafoglio','Nome','Esito','Copertura t0','Copertura t1','Δ ammesso (€)','Quantità · Shapley (€)','Mix · Shapley (€)','Mix · LMDI (€)','Costo unitario · Shapley (€)','Livello','Stato di verifica'],
    headerRow:209,rows:[['AA',vocabulary[0].label,'parziale (50–80 %)',n('0.6'),n('0.7'),n('4'),n('6'),n('1'),n('0.8'),n('-3'),'Solo descrittivo','V2_IN_ATTESA']],sourceRows:[210],notes:[],numericColumns:[3,4,5,6,7,8,9]};
  const section={schema:'pillar-c-workbook-section-v1',workbookSha256:C_WORKBOOK_HASH,section:'costi',formats:{164:'#,##0.00 "€"'},
    outputs:[{id:'ML-4-PORT-REAL',title:'Invented test only',section:'costi',tier:'Solo descrittivo',qualifier:'mappatura in bozza',grain:'portafoglio',ranges:['12A_ML4_Price_Vol_Mix!A209:L234'],availability:'snapshot',reason:null,sourceState:'WAIT-W',tables:[table]}]};
  return {view,section,table,row:table.rows[0]};
}

test('portfolio PVM is a chronological, real-route admitted subset, independent of selected annual endpoint',()=>{
  const f=fixture(),result=cPortfolioPvm(f.section,f.view);
  assert.equal(result.status,'ready');assert.equal(result.support,'partial');
  assert.deepEqual(result.effects,{quantity:'6',mix:'1',unitCost:'-3'});
  assert.equal(result.admittedChange,'4');assert.equal(f.view.change,'20');
  assert.deepEqual(result.coverage,{earlier:'0.6',later:'0.7',denominator:'absolute-continuing-spend'});
  assert.equal(result.grain,'AIC × Azienda × canale');assert.equal(result.mappingStatus,'draft');
  assert.equal(result.verification,'V2_IN_ATTESA');assert.equal(result.unitBasis,'estimated-ledger-aifa-convention');
  assert.equal(result.sourceRow,210);assert.equal(result.workbookSha256,C_WORKBOOK_HASH);
  const earlier=fixture('FY2024');assert.deepEqual(cPortfolioPvm(earlier.section,earlier.view),result);
  assert.equal(Object.hasOwn(result.effects,'mixLmdi'),false,'a sensitivity is never a fourth additive effect');
});

test('organization, channel and matched-month selectors cannot reuse the regional annual portfolio snapshot',()=>{
  for(const [period,org,channel] of [['FY2025','AQ','Tutti'],['FY2025','Regione','CO'],['FY2025','Regione','DD'],['FY2025','Regione','DPC'],['JM2025','Regione','Tutti'],['JM2026','Regione','Tutti']]){
    const f=fixture(period,org,channel);assert.deepEqual(cPortfolioPvm(f.section,f.view),{status:'unsupported',reason:'scope'});
  }
});

test('support is checked in both periods; suppressed results stay absent and true coverage zero survives',()=>{
  for(const [a,b] of [['0','0'],['0.7','0.49'],['0.49999999999999999','0.9']]){
    const f=fixture();f.row[3]=n(a);f.row[4]=n(b);f.row[2]='non ammesso (supporto < 50 %, PC-08 §11.1)';
    for(const i of [6,7,8,9])f.row[i]='—';
    const result=cPortfolioPvm(f.section,f.view);assert.equal(result.status,'insufficient');
    assert.equal(result.coverage.earlier,a);assert.equal(result.coverage.later,b);assert.equal(result.effects,null);assert.equal(result.admittedChange,null);
    f.row[6]=n('0');assert.equal(cPortfolioPvm(f.section,f.view).status,'unavailable','restoring any effect even zero fails the suppression guard');
  }
  const boundary=fixture();boundary.row[3]=n('0.5');assert.equal(cPortfolioPvm(boundary.section,boundary.view).support,'partial');
});

test('the 80 percent gate remains a subset and never upgrades frozen verification labels',()=>{
  const f=fixture();f.row[3]=n('0.8');f.row[4]=n('0.9');f.row[2]='ammesso (≥ 80 %)';f.row[10]='Ledger privato — V2 in attesa';
  const result=cPortfolioPvm(f.section,f.view);assert.equal(result.status,'ready');assert.equal(result.support,'sufficient-subset');assert.equal(result.verification,'V2_IN_ATTESA');
  for(const a of ['0.79999999999999999','0.7']){f.row[3]=n(a);assert.equal(cPortfolioPvm(f.section,f.view).status,'unavailable','an optimistic row label cannot replace its support');}
});

test('missing, duplicated, synthetic, changed source and changed column shapes fail closed',()=>{
  const changes=[f=>f.section.workbookSha256='f'.repeat(64),f=>f.view.sourceSha256='1'.repeat(64),f=>f.view.classificationSha256='2'.repeat(64),f=>f.view.mappingVersion='revised',
    f=>f.view.changePeriods.from='JM2025',f=>f.section.section='spesa',f=>f.section.outputs=[],f=>f.section.outputs.push(structuredClone(f.section.outputs[0])),
    f=>f.section.outputs[0].id='ML-4-PORT-SYN',f=>f.section.outputs[0].tier='Sintetico',f=>f.section.outputs[0].availability='withheld',
    f=>f.table.sheet='Example',f=>f.table.range='A241:M266',f=>f.table.columns[8]='Quantità · LMDI (€)',f=>f.table.sourceRows[0]=0,
    f=>f.table.rows.push(structuredClone(f.row)),f=>f.row[0]='BB',f=>f.row[1]='Altered label',f=>f.row[11]='VERIFIED',f=>f.row[10]='Verificato',
    f=>f.row[3]=n('1.01'),f=>f.row[4]=n('-0.01'),f=>f.row[3]='n.a.',f=>f.row[4]=n('NaN'),f=>f.row[5]=n('Infinity'),f=>f.row[6]=null,f=>f.row[7]='6',f=>f.row[8]=null,
    f=>f.row[2]='scenario con unità imputate (copertura 80 %)'];
  for(const change of changes){const f=fixture();change(f);assert.equal(cPortfolioPvm(f.section,f.view).status,'unavailable',String(change));}
});

test('raw cache residual and individual-cent rounding remain distinct; no effect is forced to balance',()=>{
  assert.equal(C_PORTFOLIO_PVM_SUM_TOLERANCE,'0.000001');
  const f=fixture();f.row[5]=n('0.01');f.row[6]=n('0.005');f.row[7]=n('0.005');f.row[8]=n('0');f.row[9]=n('0');
  let result=cPortfolioPvm(f.section,f.view);assert.equal(result.status,'ready');assert.deepEqual(result.rounding,{rawResidual:'0',displayResidual:'0.01'});
  assert.deepEqual(result.effects,{quantity:'0.005',mix:'0.005',unitCost:'0'});
  f.row[9]=n('-0.0000000001');result=cPortfolioPvm(f.section,f.view);assert.equal(result.status,'ready');assert.equal(result.rounding.rawResidual,'-0.0000000001');
  f.row[9]=n('0.000002');assert.equal(cPortfolioPvm(f.section,f.view).status,'unavailable');
  f.row[5]=n('-0.01');f.row[6]=n('-0.005');f.row[7]=n('-0.005');f.row[9]=n('0');
  result=cPortfolioPvm(f.section,f.view);assert.equal(result.rounding.displayResidual,'-0.01');
});

test('an observed zero admitted change and zero mix remain valid and inputs are never mutated',()=>{
  const f=fixture();f.row[5]=n('0');f.row[6]=n('3');f.row[7]=n('0');f.row[9]=n('-3');
  const before=JSON.stringify(f),result=cPortfolioPvm(f.section,f.view);
  assert.equal(result.status,'ready');assert.equal(result.admittedChange,'0');assert.equal(result.effects.mix,'0');assert.equal(JSON.stringify(f),before);
});
