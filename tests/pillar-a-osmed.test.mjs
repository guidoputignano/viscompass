import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=p=>JSON.parse(fs.readFileSync(new URL(p,import.meta.url),'utf8'));
const data=read('../data/public-compiled/pillar-a-osmed.json');

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

// The territorial position published on /pillar-a. These assertions exist because
// the criterion is that the page ranks TERRITORIES and never implies a hospital
// or Azienda ranking; the shape of the ranking is therefore part of the contract.
const {territorialPosition}=await import('../lib/analytics/pillar-a-osmed-rank.ts');

test('the PNCAR position ranks the 21 territories and excludes Italy',()=>{
  const abruzzo=territorialPosition(data.rows,'130','2022','2024',data.reductionStrictlyGreaterThan);
  assert.equal(abruzzo.peers,21,'Italy must not be ranked against the territories');
  assert.ok(abruzzo.levelRank>=1&&abruzzo.levelRank<=21);
  assert.ok(abruzzo.changeRank>=1&&abruzzo.changeRank<=21);
  assert.ok(abruzzo.meetingThreshold>=0&&abruzzo.meetingThreshold<=21);
  // Italy itself has no territorial position.
  assert.equal(territorialPosition(data.rows,'000','2022','2024',.05),null);
  // An unknown territory is absent, not rank 0.
  assert.equal(territorialPosition(data.rows,'999','2022','2024',.05),null);
});

test('every territory receives a distinct rank on each axis',()=>{
  const codes=data.rows.filter(r=>r.region!=='000').map(r=>r.region);
  const levels=new Set(),changes=new Set();
  for(const code of codes){
    const p=territorialPosition(data.rows,code,'2022','2024',.05);
    assert.ok(p,`${code} should have a position`);
    assert.equal(p.peers,21);
    levels.add(p.levelRank);changes.add(p.changeRank);
  }
  assert.equal(levels.size,21,'level ranks must be a permutation of 1..21');
  assert.equal(changes.size,21,'change ranks must be a permutation of 1..21');
  assert.equal(Math.min(...levels),1);
  assert.equal(Math.max(...levels),21);
});

test('rank 1 is the lowest intensity and the largest reduction',()=>{
  const codes=data.rows.filter(r=>r.region!=='000').map(r=>r.region);
  const best=codes.find(c=>territorialPosition(data.rows,c,'2022','2024',.05).levelRank===1);
  const lowest=codes.reduce((a,b)=>data.rows.find(r=>r.region===a).rates['2024']<=data.rows.find(r=>r.region===b).rates['2024']?a:b);
  assert.equal(best,lowest);

  const fastest=codes.find(c=>territorialPosition(data.rows,c,'2022','2024',.05).changeRank===1);
  const ratio=c=>{const r=data.rows.find(x=>x.region===c);return r.rates['2024']/r.rates['2022'];};
  assert.equal(fastest,codes.reduce((a,b)=>ratio(a)<=ratio(b)?a:b));
});

test('the count meeting the threshold matches a direct recount',()=>{
  const p=territorialPosition(data.rows,'130','2022','2024',data.reductionStrictlyGreaterThan);
  const recount=data.rows.filter(r=>r.region!=='000'&&r.rates['2024']<r.rates['2022']*(1-data.reductionStrictlyGreaterThan)).length;
  assert.equal(p.meetingThreshold,recount);
});
