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
