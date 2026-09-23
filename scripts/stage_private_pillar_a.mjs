// Run the independent source audit first. Only ignored local SQL contains values.
import fs from 'node:fs';
import crypto from 'node:crypto';
import {privatePillarAnalysis,PRIVATE_RELEASE} from '../lib/analytics/private-pillar-a.ts';
const dir='private-staging/closure';
const manifest=JSON.parse(fs.readFileSync(`${dir}/source-manifest.json`,'utf8'));
for(const source of manifest){
 const bytes=fs.readFileSync(`data/raw/pillar-a-drive-20260922/${source.file}`);
 if(crypto.createHash('sha256').update(bytes).digest('hex')!==source.sha256)throw Error('Source hash mismatch');
}
const hash=crypto.createHash('sha256').update(JSON.stringify(manifest)).digest('hex');
const indicators=JSON.parse(fs.readFileSync(`${dir}/indicators.json`,'utf8'));
const facts=indicators.filter(r=>r.org!=='130').map(r=>({release_id:PRIVATE_RELEASE,org_code:r.org,year:r.year,aware_category:r.aware,cf:r.CF,cmr:r.CMR,ddd:r.DDD,activity:r.activity,activity_variant:'A3/T1',source_hash:hash}));
if(facts.length!==48||new Set(facts.map(r=>r.org_code)).size!==4)throw Error('Wrong scope');
privatePillarAnalysis(facts);
const products=JSON.parse(fs.readFileSync(`${dir}/product-analysis.json`,'utf8'));
if(products.length!==1316)throw Error('Unexpected source detail count');
for(const fact of facts){
 const subset=products.filter(r=>r.org===fact.org_code&&r.year===fact.year&&(fact.aware_category==='T'||r.aware===fact.aware_category));
 for(const [field,source] of [['cf','CF'],['cmr','CMR'],['ddd','DDD']]){
  const value=subset.reduce((s,r)=>s+(source==='DDD'?r.QMR*r.DDD_AIC:r[source]),0);
  if(Math.abs(value-fact[field])>.01)throw Error('Product-detail reconciliation failed');
 }
 const expected=indicators.find(r=>r.org===fact.org_code&&r.year===fact.year&&r.aware===fact.aware_category);
 if(Math.abs(fact.ddd/fact.activity*100-expected.dddPer100Activity)>1e-8)throw Error('Activity indicator mismatch');
}
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
fs.writeFileSync(`${dir}/private-v2-import.sql`,sql);
fs.writeFileSync(`${dir}/private-v2-facts.json`,JSON.stringify(facts,null,2));
console.log(JSON.stringify({rows:facts.length,sourceHash:hash,release:PRIVATE_RELEASE}));
