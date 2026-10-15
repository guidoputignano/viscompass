import test from 'node:test';
import assert from 'node:assert/strict';
import {PILLAR_C_SECTIONS,pillarCSectionAtViewport} from '../lib/dashboard-review/pillar-c/section-navigation.ts';

test('Pillar C section navigation keeps the five existing anchors, adds the regional forecast before Evidenza, and keeps Evidenza last',()=>{
  assert.deepEqual(PILLAR_C_SECTIONS.map(s=>s.id),['spesa','cambiamento','pianificazione','numerosita','previsione','evidenza']);
  assert.equal(new Set(PILLAR_C_SECTIONS.map(s=>s.id)).size,6);
  assert.deepEqual(PILLAR_C_SECTIONS.map(s=>s.number),['01','02','03','04','05','06']);
  assert.equal(PILLAR_C_SECTIONS.at(-1).id,'evidenza');
  for(const s of PILLAR_C_SECTIONS) {assert.ok(s.label.length>0);assert.ok(s.description.length>0);}
});

test('current section follows the reading line rather than the largest chart',()=>{
  const positions=PILLAR_C_SECTIONS.map((s,i)=>({id:s.id,top:i*900-1000}));
  assert.equal(pillarCSectionAtViewport(positions,180),'cambiamento');
  assert.equal(pillarCSectionAtViewport(positions,800),'pianificazione');
  assert.equal(pillarCSectionAtViewport(positions.map(p=>({...p,top:p.top-2000})),180),'numerosita');
});

test('short final sections, missing elements and invalid geometry do not break selection',()=>{
  assert.equal(pillarCSectionAtViewport([{id:'spesa',top:-5000},{id:'evidenza',top:350}],180,true),'evidenza');
  assert.equal(pillarCSectionAtViewport([{id:'spesa',top:500}],180),'spesa');
  assert.equal(pillarCSectionAtViewport([],180),'spesa');
  assert.equal(pillarCSectionAtViewport([{id:'spesa',top:-100},{id:'evidenza',top:NaN}],180),'spesa');
  assert.equal(pillarCSectionAtViewport([{id:'pianificazione',top:-1}],180,true),'pianificazione');
});
