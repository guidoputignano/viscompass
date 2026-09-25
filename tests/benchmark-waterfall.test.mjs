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

test('a whole comparison row is accepted: the guard checks the five numbers, not the object',()=>{
 // The regression. components/private-pillar-charts.tsx passes the comparison
 // row straight through, and that row carries org (a string) and available (a
 // boolean) alongside the figures. Object.values() saw those, Number.isFinite
 // rejected them, and every real call threw 'Non-finite waterfall'. It escaped
 // notice because privateComparisons returns [] for a single organization, so
 // the waterfall only runs once a viewer can see more than one Azienda.
 const row={org:'201',year:2025,available:true,
   baseline:1_412_345.67,actual:1_508_900.12,price:64_200.11,mix:21_354.34,interaction:11_000.00,
   difference:96_554.45,intensityDeviation:0.0731,costDeviation:null};
 // Make the five figures reconcile exactly, as privateComparisons guarantees.
 row.actual=row.baseline+row.price+row.mix+row.interaction;
 const rows=benchmarkWaterfall(row);
 assert.equal(rows.length,5);
 assert.deepEqual(rows.map(r=>r.name),['Riferimento','Costo medio','Mix','Interazione','Osservato']);
 assert.equal(rows.at(-1).signed,row.actual);
});

test('a non-finite figure still throws, even surrounded by valid extra keys',()=>{
 // The guard must not be loosened into uselessness by the fix above.
 for(const bad of ['baseline','price','mix','interaction','actual']){
  const row={org:'201',available:true,baseline:100,price:-150,mix:70,interaction:10,actual:30};
  row[bad]=NaN;
  assert.throws(()=>benchmarkWaterfall(row),/Non-finite waterfall/,`${bad}=NaN must throw`);
  row[bad]=Infinity;
  assert.throws(()=>benchmarkWaterfall(row),/Non-finite waterfall/,`${bad}=Infinity must throw`);
 }
});
