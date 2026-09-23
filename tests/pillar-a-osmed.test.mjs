import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=p=>JSON.parse(fs.readFileSync(new URL(p,import.meta.url),'utf8'));
const data=read('../public/data/pillar-a-osmed.json');

test('OSMED series preserves the 2024 edition and every reported territory',()=>{
  assert.equal(data.edition,2024);
  assert.equal(data.rows.length,22);
  assert.equal(new Set(data.rows.map(r=>r.region)).size,22);
  for(const row of data.rows){
    assert.deepEqual(Object.keys(row.rates),Array.from({length:9},(_,i)=>String(2016+i)));
    assert.ok(Object.values(row.rates).every(n=>Number.isFinite(n)&&n>0));
    assert.equal(row.rates['2025'],undefined);
  }
  const italy=data.rows.find(r=>r.region==='000');
  assert.equal(italy.rates['2023'],85.4); // Revised, not the 84.0 in the 2023 edition.
  assert.equal(italy.rates['2024'],83.5);
  assert.equal(data.baseline,2022);
  assert.equal(data.targetYear,2025);
  assert.equal(data.reductionStrictlyGreaterThan,.05);
});

test('local perimeter is distinct from public coverage and preserves ambiguous mapping',()=>{
  const scope=read('../lib/analytics/pillar-a-local-perimeter.json');
  assert.equal(scope.codes.length,78);
  assert.equal(new Set(scope.codes.map(r=>r.atc5)).size,78);
  assert.ok(scope.codes.every(r=>/^J01[A-Z]{2}\d{2}$/.test(r.atc5)));
  assert.equal(scope.codes.filter(r=>r.sourceAware==='WR').length,2);
});
