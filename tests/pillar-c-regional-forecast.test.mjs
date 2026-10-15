import test from 'node:test';
import assert from 'node:assert/strict';
import {projectCRegionalForecast,loadCRegionalForecast} from '../lib/dashboard-review/pillar-c/regional-forecast-loader.ts';
import {loadCReviewPacket} from '../lib/dashboard-review/pillar-c/review-loader.ts';
import {cReviewV2Fixture} from './fixtures/pillar-c-review.mjs';
import {readFileSync} from 'node:fs';

test('withdrawn illustrative alternative cannot be reached from the production route or workspace',()=>{
  for(const file of ['../app/dashboard-review/pillar-c/page.tsx','../components/dashboard-review/pillar-c/analytical-workspace.tsx']){
    const source=readFileSync(new URL(file,import.meta.url),'utf8');
    assert.doesNotMatch(source,/vista=interfaccia|vista === "interfaccia"|<PillarCWorkspace|Apri la vista alternativa/);
  }
});

test('signed-in regional projection contains only public-source forecast, no private row or lineage',()=>{
  const p=cReviewV2Fixture();
  for(const field of ['monthly','baseline','bridges','budgets','counts','lineage','evidence'])p[field]=[{privateSentinel:'PRIVATE_ORGANIZATION_VALUE'}];
  const data=projectCRegionalForecast(p);
  assert.deepEqual(Object.keys(data),['forecast']);
  assert.deepEqual(data.forecast,p.forecast);
  assert.equal(JSON.stringify(data).includes('PRIVATE_ORGANIZATION_VALUE'),false);
  for(const field of ['monthly','baseline','bridges','budgets','counts','lineage','evidence'])assert.equal(field in data,false);
});

test('projection rejects hitchhiking private facts within forecast and requires public regional scope',()=>{
  for(const mutate of [p=>{p.forecast.privateBudgets=[]},p=>{p.forecast.scope='own_azienda'},p=>{p.forecast.region='other'},p=>{p.forecast.monthly[0].org='private'}]){
    const p=cReviewV2Fixture();mutate(p);assert.throws(()=>projectCRegionalForecast(p),/PILLAR_C_PACKET/);
  }
});

test('unapproved accounts cannot cause even a forecast storage read',async()=>{
  let reads=0;
  assert.deepEqual(await loadCRegionalForecast(false,async()=>{reads++;throw new Error('must not read')}),{state:'forbidden'});
  assert.equal(reads,0);
});

test('ordinary approved account does not gain private reviewer data',async()=>{
  let reads=0;
  const privateResult=await loadCReviewPacket(true,false,{},async()=>{reads++;throw new Error('must not read')});
  assert.deepEqual(privateResult,{state:'forbidden'});assert.equal(reads,0);
});

test('forecast loader refuses an untrusted remote pin or changed artifact',async()=>{
  const bytes=new TextEncoder().encode(JSON.stringify(cReviewV2Fixture()));
  assert.deepEqual(await loadCRegionalForecast(true,async()=>({state:'ready',bytes,sha:'0'.repeat(64)})),{state:'invalid'});
  assert.deepEqual(await loadCRegionalForecast(true,async()=>({state:'ready',bytes,sha:'fd09373fafeb5ef2c9acd1788504bac2c911c7d33a828b956e584f4b820d93df'})),{state:'invalid'});
});

test('unavailable storage and parser failures never become generated forecasts',async()=>{
  assert.deepEqual(await loadCRegionalForecast(true,async()=>({state:'not_configured'})),{state:'not_configured'});
  assert.deepEqual(await loadCRegionalForecast(true,async()=>{throw new Error('secret path')}),{state:'invalid'});
  assert.throws(()=>projectCRegionalForecast({...cReviewV2Fixture(),forecast:undefined}),/PILLAR_C/);
});
