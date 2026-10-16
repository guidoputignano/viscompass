import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {cBudgetFilters,cBudgetSearch,cInsightResetSearch,cDecisionAnswer,cInsightCellText,cInsightText,cInsightVisibleColumns,C_INSIGHT_TITLES} from '../lib/dashboard-review/pillar-c/insights.ts';
import {DEFAULT_C_REVIEW,cReviewFilters,parseCReviewPacket,selectCReview} from '../lib/dashboard-review/pillar-c/review.ts';
import {cReviewFixture} from './fixtures/pillar-c-review.mjs';

test('budget opens on actual published data, including a real zero, independently of spend',()=>{
  const p=parseCReviewPacket(cReviewFixture());
  for(const search of ['', 'c_org=PE&c_channel=DD']) {
    const f=cBudgetFilters(p,new URLSearchParams(search));
    assert.equal(f.org,'TE');assert.equal(f.channel,'CO');assert.equal(f.budgetPeriod,'FY2024');
    assert.equal(selectCReview(p,f).budgets.length,1);
    assert.equal(selectCReview(p,f).budgets[0].actual,'0');
  }
  const none={...p,budgets:[]};
  assert.equal(selectCReview(none,cBudgetFilters(none,new URLSearchParams())).budgets.length,0);
});
test('budget scope round-trips, global controls preserve it, reset restores populated default',()=>{
  const p=parseCReviewPacket(cReviewFixture());
  const url=cBudgetSearch(p,'?c_org=CH&c_channel=DD&unrelated=keep',{org:'AQ',channel:'CO',budget:'synthetic',budgetPeriod:'FY2025',level:'Disciplina'});
  const params=new URLSearchParams(url),local=cBudgetFilters(p,params);
  assert.equal(local.org,'AQ');assert.equal(local.channel,'CO');assert.equal(local.budget,'synthetic');
  assert.equal(cReviewFilters(params).org,'CH');assert.equal(cReviewFilters(params).channel,'DD');
  assert.equal(selectCReview(p,local).budgets[0].id,'TEST-SYNTHETIC');
  const reset=new URLSearchParams(cInsightResetSearch(url));
  assert.equal(reset.get('unrelated'),'keep');assert.equal(reset.has('c_budget_org'),false);
  assert.equal(cBudgetFilters(p,reset).org,'TE');
  assert.equal(cBudgetFilters(p,new URLSearchParams('c_budget_org=forged&c_budget_channel=XYZ')).org,'Regione');
});
test('decision answer is scoped and exact, does not turn absent people or spend into zero',()=>{
  const p=parseCReviewPacket(cReviewFixture());
  const f={...DEFAULT_C_REVIEW,org:'AQ',channel:'CO'},answer=cDecisionAnswer(p,f);
  const left=p.baseline.find(r=>r.period==='FY2024'&&r.org==='AQ'&&r.channel==='CO');
  const right=p.baseline.find(r=>r.period==='FY2025'&&r.org==='AQ'&&r.channel==='CO');
  assert.equal(Number(answer.change),Number(right.net)-Number(left.net));assert.equal(answer.peopleObserved,false);
  assert.equal(cDecisionAnswer({...p,baseline:[],bridges:[]},f).change,null);
  assert.equal(cDecisionAnswer({...p,baseline:[],bridges:[]},f).continuing,null);
});
test('presentation removes workbook codes and formulas without removing business totals',()=>{
  assert.equal(cInsightText('I = S1 ∪ S2'),'Spesa attribuibile alle aree');
  for(const s of ['Misura O-11-02','M v0.1 vs R0 vs V0 (file laterale)','ML-4b (unità imputate)'])
    assert.doesNotMatch(cInsightText(s),/O-\d|M v0|\bR0\b|\bV0\b|file laterale|ML-4/);
  for(const s of ['=SUM(A1:A4)','SUMIFS(A:A,B:B,"X")','$A$12 ∈ range']) assert.equal(cInsightCellText(s),'Dettaglio metodologico');
  const table={columns:['Σ budget sintetico (€)','Materialità (formula)','Residuo Σ|C| (€)','Ledger su F_Fatti (€, formula)','Nome']};
  assert.deepEqual(cInsightVisibleColumns(table),[0,1,4]);
  assert.equal(cInsightText('Σ budget sintetico (€)'),'Totale budget sintetico (€)');
  assert.ok(Object.values(C_INSIGHT_TITLES).length>=84);
});
test('workspace mounts decision sections, not the old workbook explorer',()=>{
  const source=readFileSync(new URL('../components/dashboard-review/pillar-c/analytical-workspace.tsx',import.meta.url),'utf8');
  assert.doesNotMatch(source,/PillarCWorkbook|workbook-explorer|Esplora il workbook|Explore the workbook/);
  assert.match(source,/Più persone trattate o prodotti più costosi/);
  assert.match(source,/PillarCInsightsProvider/);
  assert.doesNotMatch(source,/>[^<]*(?:Spesa S2|ML-[123])[^<]*</);
});
