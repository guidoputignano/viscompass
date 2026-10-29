// Run the independent source audit first. Only ignored local SQL contains values.
//
// Run from the Pillar A release worktree (it holds data/raw and private-staging):
//   node <repo>/scripts/stage_private_pillar_a.mjs [--ddd-corrections <file>]
// Writes private-staging/<release>/ for the release in lib/analytics/private-pillar-a.ts.
// With --ddd-corrections, the listed packs' DDD per pack is replaced first
// (lib/analytics/private-pillar-ddd-corrections.ts) and the aggregates' DDD re-summed;
// the source hash then covers the corrections too, so the release says what it holds.
import fs from 'node:fs';
import crypto from 'node:crypto';
import {privatePillarAnalysis,PRIVATE_RELEASE} from '../lib/analytics/private-pillar-a.ts';
import {assertProductFacts} from '../lib/analytics/private-pillar-product.ts';
import {applyDddCorrections} from '../lib/analytics/private-pillar-ddd-corrections.ts';
const dir='private-staging/closure';
const flag=process.argv.indexOf('--ddd-corrections');
const correctionsFile=flag>=0?process.argv[flag+1]:null;
if(flag>=0&&!correctionsFile)throw Error('--ddd-corrections needs a file');
const dddCorrections=correctionsFile?JSON.parse(fs.readFileSync(correctionsFile,'utf8')).corrections:[];
const manifest=JSON.parse(fs.readFileSync(`${dir}/source-manifest.json`,'utf8'));
for(const source of manifest){
 const bytes=fs.readFileSync(`data/raw/pillar-a-drive-20260922/${source.file}`);
 if(crypto.createHash('sha256').update(bytes).digest('hex')!==source.sha256)throw Error('Source hash mismatch');
}
// Without corrections the hash is the one closure-20260923 was loaded with.
const hash=crypto.createHash('sha256').update(JSON.stringify(dddCorrections.length?{manifest,dddCorrections}:manifest)).digest('hex');
const indicators=JSON.parse(fs.readFileSync(`${dir}/indicators.json`,'utf8'));
const facts=indicators.filter(r=>r.org!=='130').map(r=>({release_id:PRIVATE_RELEASE,org_code:r.org,year:r.year,aware_category:r.aware,cf:r.CF,cmr:r.CMR,ddd:r.DDD,activity:r.activity,activity_variant:'A3/T1',source_hash:hash}));
if(facts.length!==48||new Set(facts.map(r=>r.org_code)).size!==4)throw Error('Wrong scope');
const source=JSON.parse(fs.readFileSync(`${dir}/product-analysis.json`,'utf8'));
if(source.length!==1316)throw Error('Unexpected source detail count');
const inCell=(fact,r)=>r.org===fact.org_code&&r.year===fact.year&&(fact.aware_category==='T'||r.aware===fact.aware_category);
// 1. The source reconciles as supplied: products sum to every aggregate cell, and the activity indicator holds.
for(const fact of facts){
 const subset=source.filter(r=>inCell(fact,r));
 for(const [field,key] of [['cf','CF'],['cmr','CMR'],['ddd','DDD']]){
  const value=subset.reduce((s,r)=>s+(key==='DDD'?r.QMR*r.DDD_AIC:r[key]),0);
  if(Math.abs(value-fact[field])>.01)throw Error('Product-detail reconciliation failed');
 }
 const expected=indicators.find(r=>r.org===fact.org_code&&r.year===fact.year&&r.aware===fact.aware_category);
 if(Math.abs(fact.ddd/fact.activity*100-expected.dddPer100Activity)>1e-8)throw Error('Activity indicator mismatch');
}
// 2. Corrections, then every aggregate's DDD moves by exactly its products' change.
const {products,rowsChanged}=applyDddCorrections(source,dddCorrections);
const dddChange={};
for(const fact of facts){
 const before=fact.ddd;
 fact.ddd+=products.reduce((s,r,i)=>inCell(fact,r)?s+r.QMR*(r.DDD_AIC-source[i].DDD_AIC):s,0);
 if(fact.ddd!==before)dddChange[`${fact.org_code}-${fact.year}-${fact.aware_category}`]=Number((100*(fact.ddd/before-1)).toFixed(4));
}
privatePillarAnalysis(facts);
const productFacts=products.map(r=>({release_id:PRIVATE_RELEASE,org_code:r.org,year:r.year,aic:r.aic,atc5:r.atc5,aware_category:r.aware,product_name:r.name,qmr:r.QMR,ddd_aic:r.DDD_AIC,cf:r.CF,cn:r.CN,cmr:r.CMR,ddd:r.QMR*r.DDD_AIC,source_hash:hash}));
assertProductFacts(productFacts);
if(productFacts.some(r=>!facts.some(f=>f.org_code===r.org_code&&f.year===r.year&&f.aware_category===r.aware_category)))throw Error('Product outside aggregate scope');
// 3. The release as staged reconciles the same way: A+W+R = T, and products sum to every cell.
for(const fact of facts){
 const subset=productFacts.filter(r=>r.org_code===fact.org_code&&r.year===fact.year&&(fact.aware_category==='T'||r.aware_category===fact.aware_category));
 for(const field of ['cf','cmr','ddd']){
  if(Math.abs(subset.reduce((s,r)=>s+r[field],0)-fact[field])>.01)throw Error('Staged product-detail reconciliation failed');
 }
 if(fact.aware_category==='T'){
  const parts=facts.filter(f=>f.org_code===fact.org_code&&f.year===fact.year&&f.aware_category!=='T');
  for(const field of ['cf','cmr','ddd'])if(Math.abs(parts.reduce((s,f)=>s+f[field],0)-fact[field])>.01)throw Error('A+W+R differs from T');
 }
}
const out=`private-staging/${PRIVATE_RELEASE}`;
fs.mkdirSync(out,{recursive:true});
const quote=v=>typeof v==='number'?String(v):`'${v.replaceAll("'","''")}'`;
const columns=Object.keys(facts[0]);
const sql=`begin;
do $$ begin
 if exists(select 1 from public.pillar_a_private_fact where release_id='${PRIVATE_RELEASE}') then raise exception 'Release already exists: no overwrite'; end if;
 if (select count(*) from public.organizations where org_code in ('201','202','203','204') and org_type='asl' and region_code='130')<>4 then raise exception 'Organization mapping mismatch'; end if;
end $$;
insert into public.pillar_a_private_fact (${columns.join(',')}) values
${facts.map(r=>'('+columns.map(k=>quote(r[k])).join(',')+')').join(',\n')};
commit;
select count(*) as rows from public.pillar_a_private_fact where release_id='${PRIVATE_RELEASE}';`;
fs.writeFileSync(`${out}/private-v2-import.sql`,sql);
fs.writeFileSync(`${out}/private-v2-facts.json`,JSON.stringify(facts,null,2));
// Reproducible product import: never depend on an agent's temporary generator.
// Values remain in ignored staging; this script itself contains no private data.
const productColumns=Object.keys(productFacts[0]);
const productSql=`begin;
do $$ begin
 if exists(select 1 from public.pillar_a_private_product_fact where release_id='${PRIVATE_RELEASE}') then raise exception 'Product release already exists: no overwrite'; end if;
 if (select count(*) from public.pillar_a_private_fact where release_id='${PRIVATE_RELEASE}')<>48 then raise exception 'Aggregate release must be loaded first'; end if;
end $$;
insert into public.pillar_a_private_product_fact (${productColumns.join(',')}) values
${productFacts.map(r=>'('+productColumns.map(k=>quote(r[k])).join(',')+')').join(',\n')};
commit;
select count(*) as rows from public.pillar_a_private_product_fact where release_id='${PRIVATE_RELEASE}';`;
fs.writeFileSync(`${out}/private-product-import.sql`,productSql);
fs.writeFileSync(`${out}/private-product-facts.json`,JSON.stringify(productFacts,null,2));
const report={release:PRIVATE_RELEASE,sourceHash:hash,rows:facts.length,productRows:productFacts.length,correctionsFile,dddCorrections:dddCorrections.length,rowsChanged,dddChangePctByCell:dddChange};
fs.writeFileSync(`${out}/staging-report.json`,JSON.stringify(report,null,2));
console.log(JSON.stringify({...report,rowsChanged:Object.values(rowsChanged)}));
