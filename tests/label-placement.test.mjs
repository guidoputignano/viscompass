import test from 'node:test';
import assert from 'node:assert/strict';
import {placeLabels,labelBox,LABEL_OFFSETS} from '../lib/charts/label-placement.ts';

// The defect this replaced: every point was labelled at one fixed offset, so
// clustered points printed their years on top of each other and read "20242024".

const noneOverlap=(placed)=>{
  const boxes=placed.map(labelBox);
  for(let i=0;i<boxes.length;i++) for(let j=i+1;j<boxes.length;j++){
    const a=boxes[i],b=boxes[j];
    if(a.x0<b.x1&&a.x1>b.x0&&a.y0<b.y1&&a.y1>b.y0)
      return `"${placed[i].text}" overlaps "${placed[j].text}"`;
  }
  return null;
};

test('labels at the same point never overlap',()=>{
  // The worst case: four trajectories converging on exactly one coordinate.
  const items=['2023','2024','2025','2026'].map(text=>({text,cx:350,cy:235}));
  const placed=placeLabels(items);
  assert.equal(noneOverlap(placed),null);
  assert.ok(placed.length>1,'more than one should still find room around a point');
});

test('a tight cluster is resolved, and never by stacking',()=>{
  // Mirrors the live plot: several Aziende within a few pixels of the origin.
  const items=[];
  for(let i=0;i<10;i++) items.push({text:String(2020+i),cx:350+(i%3)*4,cy:235+(i%4)*3});
  const placed=placeLabels(items);
  assert.equal(noneOverlap(placed),null);
  assert.ok(placed.length>=4,`expected several to fit, got ${placed.length}`);
});

test('a label with no room is dropped, not drawn on top of another',()=>{
  // More labels than there are candidate offsets at one point: the surplus must
  // disappear rather than overlap. Every value is still in the table below.
  const items=Array.from({length:LABEL_OFFSETS.length+6},(_,i)=>({text:String(2000+i),cx:350,cy:235}));
  const placed=placeLabels(items);
  assert.equal(noneOverlap(placed),null);
  assert.ok(placed.length<items.length,'surplus labels must be dropped');
  assert.ok(placed.length<=LABEL_OFFSETS.length,'cannot place more than there are offsets at one point');
});

test('well-separated labels all survive, at the preferred offset',()=>{
  const items=[{text:'2023',cx:120,cy:120},{text:'2024',cx:300,cy:220},{text:'2025',cx:500,cy:340}];
  const placed=placeLabels(items);
  assert.equal(placed.length,3);
  assert.equal(noneOverlap(placed),null);
  const [dx,dy]=LABEL_OFFSETS[0];
  assert.deepEqual(placed.map(l=>[l.lx,l.ly]),items.map(i=>[i.cx+dx,i.cy+dy]),
    'nothing is in the way, so each takes the first candidate');
});

test('placement is deterministic, which is what keeps SSR and the browser identical',()=>{
  // Any randomness or text measurement here would render differently on the
  // server and in the browser, which is a hydration mismatch.
  const items=Array.from({length:12},(_,i)=>({text:String(2014+i),cx:350+(i%5)*6,cy:235+(i%3)*5}));
  const once=JSON.stringify(placeLabels(items));
  for(let i=0;i<5;i++) assert.equal(JSON.stringify(placeLabels(items)),once);
});

test('earlier items win, so caller order decides what gets labelled',()=>{
  const first=placeLabels([{text:'AAAA',cx:350,cy:235},{text:'BBBB',cx:350,cy:235}]);
  assert.equal(first[0].text,'AAAA');
  const [dx,dy]=LABEL_OFFSETS[0];
  assert.deepEqual([first[0].lx,first[0].ly],[350+dx,235+dy],'the first item gets the preferred offset');
});

test('an empty input places nothing',()=>{
  assert.deepEqual(placeLabels([]),[]);
});
