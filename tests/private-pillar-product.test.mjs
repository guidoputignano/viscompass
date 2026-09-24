import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {productAbc,atc5Series,assertProductFacts,reconcileProductsToAggregate} from '../lib/analytics/private-pillar-product.ts';

const root=fileURLToPath(new URL('..',import.meta.url));
const load=(p)=>{const f=path.join(root,p);return fs.existsSync(f)?JSON.parse(fs.readFileSync(f,'utf8')):null;};
// Private derivatives are git-ignored, so the data-driven checks skip on a clean
// clone rather than failing. The pure-logic checks below always run.
const raw=load('private-staging/closure/product-analysis.json');
const indicators=load('private-staging/closure/indicators.json');
const HASH='a'.repeat(64);
const toFact=(r)=>({release_id:'closure-20260923',org_code:r.org,year:r.year,aic:r.aic,atc5:r.atc5,
  aware_category:r.aware,product_name:r.name,qmr:r.QMR,ddd_aic:r.DDD_AIC,cf:r.CF,cn:r.CN,cmr:r.CMR,ddd:r.DDD,source_hash:HASH});
const facts=raw?raw.map(toFact):null;
const skip=facts?false:'private-staging/closure/product-analysis.json not present';

const fact=(over={})=>({release_id:'r',org_code:'201',year:2025,aic:'022211039',atc5:'J01AA02',
  aware_category:'A',product_name:'X',qmr:10,ddd_aic:2,cf:100,cn:100,cmr:110,ddd:20,source_hash:HASH,...over});

test('a 9-digit AIC is required, because every real key starts with a zero',()=>{
  assert.doesNotThrow(()=>assertProductFacts([fact()]));
  assert.throws(()=>assertProductFacts([fact({aic:'22211039'})]),/9 digits/);
  assert.throws(()=>assertProductFacts([fact({aic:22211039})]),/9 digits/);
});

test('rows that cannot be trusted are rejected, not banded',()=>{
  assert.throws(()=>assertProductFacts([fact({cf:0})]),/finite positive/);
  assert.throws(()=>assertProductFacts([fact({cf:NaN})]),/finite positive/);
  assert.throws(()=>assertProductFacts([fact({cf:-1})]),/finite positive/);
  assert.throws(()=>assertProductFacts([fact({atc5:'nope'})]),/malformed ATC5/);
  assert.throws(()=>assertProductFacts([fact({aware_category:'T'})]),/not an AWaRe class/);
  // DDD is derived; a row where it is not qmr x ddd_aic is corrupt.
  assert.throws(()=>assertProductFacts([fact({ddd:21})]),/ddd is not qmr/);
  assert.throws(()=>assertProductFacts([fact(),fact()]),/duplicate/);
});

test('an absent molecule-year is null, never zero',()=>{
  const f=[fact({year:2023,aic:'000000001',atc5:'J01AA02'}),
           fact({year:2025,aic:'000000001',atc5:'J01AA02'}),
           fact({year:2023,aic:'000000002',atc5:'J01CA04'}),
           fact({year:2024,aic:'000000002',atc5:'J01CA04'}),
           fact({year:2025,aic:'000000002',atc5:'J01CA04'})];
  const series=atc5Series(f);
  const gap=series.find(s=>s.atc5==='J01AA02');
  assert.deepEqual(gap.years,[2023,2024,2025]);
  assert.equal(gap.points[1],null,'2024 has no rows: it is absent, not zero');
  assert.equal(gap.partial,true);
  const full=series.find(s=>s.atc5==='J01CA04');
  assert.equal(full.partial,false);
  assert.equal(full.points.every(p=>p!==null),true);
});

test('an organization present in the aggregate but absent from products is reported',()=>{
  const agg=[{org_code:'201',year:2025,aware_category:'T',cf:100,cmr:110,ddd:20},
             {org_code:'130',year:2025,aware_category:'T',cf:999,cmr:999,ddd:99}];
  const r=reconcileProductsToAggregate([fact()],agg);
  assert.equal(r.ok,false);
  assert.match(r.problems.join(' '),/130\/2025: aggregate present but no product rows/);
  assert.equal(r.checked,1);
});

test('banding is per organization-year, so it cannot depend on who is looking',()=>{
  // The same product in the same org-year must band identically whether or not
  // another organization's rows are visible to the caller.
  const own=[fact({aic:'000000001',cf:900}),fact({aic:'000000002',cf:100})];
  const withPeer=[...own,fact({org_code:'202',aic:'000000003',cf:5000})];
  const a=productAbc(own).find(r=>r.aic==='000000001');
  const b=productAbc(withPeer).find(r=>r.org_code==='201'&&r.aic==='000000001');
  assert.equal(a.band,b.band);
  assert.equal(a.share,b.share);
  assert.equal(a.rank,b.rank);
});

test('the real dataset bands exactly as the source file already recorded',{skip},()=>{
  const banded=productAbc(facts);
  assert.equal(banded.length,1316);
  let checked=0,discriminating=0;
  for(const row of banded){
    const src=raw.find(r=>r.org===row.org_code&&r.year===row.year&&r.aic===row.aic);
    assert.equal(row.band,src.abc,`${row.org_code}/${row.year}/${row.aic}`);
    // The stored cumulativeShare is the INCLUSIVE one; banding uses the preceding.
    assert.ok(Math.abs(row.cumulativeShare-src.cumulativeShare)<1e-9);
    assert.ok(Math.abs(row.share-src.spendShare)<1e-12);
    // Count rows where the two conventions would actually disagree: without
    // these the agreement above would prove nothing.
    const inclusiveBand=row.cumulativeShare<=0.8?'A':row.cumulativeShare<=0.95?'B':'C';
    if(inclusiveBand!==row.band)discriminating++;
    checked++;
  }
  assert.equal(checked,1316);
  assert.ok(discriminating>=12,`only ${discriminating} rows discriminate between the two rules`);
});

test('the real dataset rolls up to 555 molecule series and marks the partial ones',{skip},()=>{
  const series=atc5Series(facts);
  const points=series.reduce((s,x)=>s+x.points.filter(Boolean).length,0);
  assert.equal(points,555,'distinct (org, year, atc5) observations');
  assert.equal(series.length,205,'distinct (org, atc5) series');
  assert.ok(series.some(s=>s.partial),'some molecules are absent from a year');
  // Fosfomicina proves ATC5 does not determine AWaRe, so no series carries one.
  const fosfo=facts.filter(f=>f.atc5==='J01XX01');
  assert.equal(new Set(fosfo.map(f=>f.aware_category)).size,2);
  assert.equal(Object.hasOwn(series[0],'aware_category'),false);
});

test('the real product rows reconcile to the aggregate exactly',{skip},()=>{
  const agg=indicators.filter(r=>r.org!=='130').map(r=>({org_code:r.org,year:r.year,
    aware_category:r.aware,cf:r.CF,cmr:r.CMR,ddd:r.DDD}));
  const r=reconcileProductsToAggregate(facts,agg,0.01);
  assert.deepEqual(r.problems,[]);
  assert.equal(r.ok,true);
  assert.equal(r.checked,12,'4 organizations x 3 years');
});
