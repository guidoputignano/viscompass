import test from 'node:test';
import assert from 'node:assert/strict';
import {PILLAR_C_SECTIONS,pillarCSectionAtViewport} from '../lib/dashboard-review/pillar-c/section-navigation.ts';

test('Pillar C section navigation lists the six sections of the page in order, numerals 1–6, Priorità ed evidenza last (1.2c)',()=>{
  assert.deepEqual(PILLAR_C_SECTIONS.map(s=>s.id),['quadro','destinatari','portafogli-attribuzione','fattori','budget-scenari','priorita-evidenza']);
  assert.equal(new Set(PILLAR_C_SECTIONS.map(s=>s.id)).size,6);
  assert.deepEqual(PILLAR_C_SECTIONS.map(s=>s.number),['1','2','3','4','5','6']);
  assert.equal(PILLAR_C_SECTIONS.at(-1).id,'priorita-evidenza');
  for(const s of PILLAR_C_SECTIONS) {assert.ok(s.label.length>0);assert.ok(s.question.length>0);}
});

test('current section follows the reading line rather than the largest chart',()=>{
  const positions=PILLAR_C_SECTIONS.map((s,i)=>({id:s.id,top:i*900-1000}));
  assert.equal(pillarCSectionAtViewport(positions,180),'destinatari');
  assert.equal(pillarCSectionAtViewport(positions,800),'portafogli-attribuzione');
  assert.equal(pillarCSectionAtViewport(positions.map(p=>({...p,top:p.top-2000})),180),'fattori');
});

test('short final sections, missing elements and invalid geometry do not break selection; the fallback is quadro',()=>{
  assert.equal(pillarCSectionAtViewport([{id:'quadro',top:-5000},{id:'priorita-evidenza',top:350}],180,true),'priorita-evidenza');
  assert.equal(pillarCSectionAtViewport([{id:'quadro',top:500}],180),'quadro');
  assert.equal(pillarCSectionAtViewport([],180),'quadro');
  assert.equal(pillarCSectionAtViewport([{id:'quadro',top:-100},{id:'priorita-evidenza',top:NaN}],180),'quadro');
  assert.equal(pillarCSectionAtViewport([{id:'budget-scenari',top:-1}],180,true),'budget-scenari');
  // A page that renders section 5 only: below the reading line the function answers quadro, which the bar never marks
  // there (PillarCSectionBar clamps to the sections the page renders; tests/pillar-c-six-sections-nav).
  assert.equal(pillarCSectionAtViewport([{id:'budget-scenari',top:400}],180),'quadro');
});
