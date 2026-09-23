import test from 'node:test';
import assert from 'node:assert/strict';
import {benchmarkWaterfall} from '../lib/analytics/benchmark-waterfall.ts';
test('waterfall preserves negative intermediate totals and signed contributions',()=>{
 const rows=benchmarkWaterfall({baseline:100,price:-150,mix:70,interaction:10,actual:30});
 assert.deepEqual(rows.map(r=>r.range),[[0,100],[-50,100],[-50,20],[20,30],[0,30]]);
 assert.deepEqual(rows.map(r=>r.signed),[100,-150,70,10,30]);
});
test('waterfall rejects non-finite and unreconciled results',()=>{
 assert.throws(()=>benchmarkWaterfall({baseline:1,price:0,mix:0,interaction:0,actual:2}));
 assert.throws(()=>benchmarkWaterfall({baseline:NaN,price:0,mix:0,interaction:0,actual:2}));
});
