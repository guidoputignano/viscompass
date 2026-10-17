import test from 'node:test';
import assert from 'node:assert/strict';
import {readCanonicalById} from '../lib/dashboard-review/canonical-pages.ts';
import {formatSignedPercent} from '../lib/dashboard-review/format.ts';

test('percentage changes show a signed number, shares remain a separate formatter',()=>{
  assert.match(formatSignedPercent(0.15),/^\+15/);
  assert.match(formatSignedPercent(-0.15),/^-15/);
  assert.doesNotMatch(formatSignedPercent(0),/[+-]/);
  assert.doesNotMatch(formatSignedPercent(-0.00001),/[+-]/);
});

test('key ranges retain sparse, scoped IDs and tolerate a smaller API cap without OFFSET',async()=>{
  const rows=[2,5,9,5000,5001,9000,20000,20001,30000,100000].map(id=>({id}));
  let active=0,max=0,calls=0;
  const got=await readCanonicalById(async edge=>({data:[edge==='first'?rows[0]:rows.at(-1)],count:rows.length,error:null}),async(after,through,size)=>{
    calls++;active++;max=Math.max(active,max);await new Promise(resolve=>setTimeout(resolve,1));active--;
    return {data:rows.filter(r=>r.id>after&&r.id<=through).slice(0,Math.min(size,2)),error:null};
  },4,3);
  assert.deepEqual(got,rows);assert.ok(calls>=5);assert.ok(max<=3);assert.equal(max,3);
});
test('key-range reader rejects count drift, boundary errors, disorder, duplicates and oversize',async()=>{
  const edge=async where=>({data:[{id:where==='first'?1:9}],count:3,error:null});
  await assert.rejects(readCanonicalById(edge,async()=>({data:[],error:null}),2,2),/PAGING_CHANGED/);
  for(const ids of [[2,1],[1,1],[10],[1,2,3]]){
    await assert.rejects(readCanonicalById(edge,async()=>({data:ids.map(id=>({id})),error:null}),2,1),/PAGING_CHANGED|OVERSIZED/);
  }
  await assert.rejects(readCanonicalById(async()=>({data:[{id:'1'}],count:1,error:null}),async()=>({data:[],error:null})),/BOUNDARY_INVALID/);
  await assert.rejects(readCanonicalById(async()=>({data:[],count:null,error:null}),async()=>({data:[],error:null})),/COUNT_UNAVAILABLE/);
  await assert.rejects(readCanonicalById(edge,async()=>({data:null,error:{message:'network fixture'}})),/network fixture/);
  await assert.rejects(readCanonicalById(edge,async()=>({data:[],error:null}),0),/CONFIGURATION/);
  assert.deepEqual(await readCanonicalById(async()=>({data:[],count:0,error:null}),async()=>{throw Error('must not read rows');}),[]);
});

test('the lane count is 16 by default; an override is clamped to 4-16 and reported',async()=>{
  const {factLanes,DEFAULT_FACT_LANES}=await import('../lib/dashboard-review/canonical-pages.ts');
  assert.equal(DEFAULT_FACT_LANES,16);
  const run=v=>{const warnings=[];const lanes=factLanes(v,m=>warnings.push(JSON.parse(m)));return {lanes,warnings};};
  for(const v of [undefined,'','  '])assert.deepEqual(run(v),{lanes:16,warnings:[]},String(v));
  for(const v of ['4','8','12','16',' 8 '])assert.deepEqual(run(v),{lanes:Number(v),warnings:[]},v);
  // A throttle below the floor gets the floor, never the maximum.
  for(const [v,want] of [['2',4],['3',4],['0',4],['-8',4],['17',16],['32',16],['6.5',6]]){
    const r=run(v);assert.equal(r.lanes,want,v);assert.equal(r.warnings.length,1,v);
    assert.deepEqual(r.warnings[0],{event:'dashboard_fact_lanes_adjusted',value:v,lanes:want});
  }
  assert.deepEqual(run('6.0'),{lanes:6,warnings:[]},'6.0 is six');
  for(const v of ['abc','8 lanes','1e1','Infinity','0x10']){const r=run(v);assert.equal(r.lanes,16,v);assert.equal(r.warnings.length,1,v);}
});

test('the compact transport rebuilds every field, in order, nulls included',async()=>{
  const {CANONICAL_COMPACT_COLUMNS,CANONICAL_DASHBOARD_COLUMNS,decodeCompactFacts}=await import('../lib/dashboard-review/canonical-pages.ts');
  const fields=CANONICAL_DASHBOARD_COLUMNS.split(',');
  const pairs=CANONICAL_COMPACT_COLUMNS.split(',').map(p=>p.split(':'));
  // Every field but the release id is sent once, under a distinct short alias.
  assert.deepEqual(pairs.map(([,f])=>f),fields.filter(f=>f!=='source_version_id'));
  assert.equal(new Set(pairs.map(([w])=>w)).size,pairs.length);
  for(const [w] of pairs)assert.match(w,/^[a-z]{1,2}$/);
  const wire=Object.fromEntries(pairs.map(([w,f])=>[f,w]));
  const full=Object.fromEntries(fields.map(f=>[f,null]));
  Object.assign(full,{id:7,source_version_id:'rel-1',year:2025,month:3,asl_code:'130201',total_cost_eur:12.5,
    comparable_eligible:false,biosimilar_flag:false,quantity_packs:0,comparable_quantity:'4000',created_at:'2026-10-01T00:00:00+00:00'});
  // Stripped: nulls absent; false, 0 and strings kept.
  const stripped=Object.fromEntries(Object.entries(full).filter(([f,v])=>f!=='source_version_id'&&v!==null).map(([f,v])=>[wire[f],v]));
  const [row]=decodeCompactFacts([stripped],'rel-1');
  assert.deepStrictEqual(row,full);
  assert.deepEqual(Object.keys(row),fields,'same key order as the full-name read');
  // An unstripped page decodes the same.
  const unstripped=Object.fromEntries(Object.entries(full).filter(([f])=>f!=='source_version_id').map(([f,v])=>[wire[f],v]));
  assert.deepStrictEqual(decodeCompactFacts([unstripped],'rel-1')[0],full);
  assert.deepEqual(decodeCompactFacts([],'rel-1'),[]);
  for(const bad of [null,{},'[]',[null],[[1]],[{zz:1}],[{...stripped,id_:1}]])assert.throws(()=>decodeCompactFacts(bad,'rel-1'),/CANONICAL_COMPACT_INVALID/,JSON.stringify(bad));
});
