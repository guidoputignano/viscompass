/** Exact aggregation of the existing draft classification. Artifacts stay OUTSIDE this public repo. */
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {parseArgs} from 'node:util';
import {buildCAttrPacket,parseCAttrPacket} from '../lib/dashboard-review/pillar-c/attribution.ts';

const {values}=parseArgs({options:{root:{type:'string'},out:{type:'string'}}});
if(!values.root||!values.out)throw Error('--root and --out required');
const root=await fs.realpath(values.root),checkout=await fs.realpath(process.cwd());
const out=path.resolve(values.out);
for(const candidate of [root,out]){
  const rel=path.relative(checkout,candidate);
  if(!rel.startsWith(`..${path.sep}`)&&!path.isAbsolute(rel))throw Error('Private inputs/outputs must stay outside public checkout');
}
const sha=b=>createHash('sha256').update(b).digest('hex');
const source=await fs.readFile(path.join(root,'../pillar-b/derived/canonical_monthly_facts.jsonl'));
const classification=await fs.readFile(path.join(root,'freeze-20261012-c1/derived/c1_fact_rows.jsonl'));
const rules=JSON.parse(await fs.readFile(path.join(root,'manifest/c1_portfolio_rules_v0.1.json'),'utf8'));
if(sha(source)!==rules.inputs.ledger_sha256||sha(classification)!=='e2b3c5900036eec54fc01134d32d0f19bd9341db790916ced99b5152f9ad50aa')throw Error('Pinned input changed');
const originals=new Map(source.toString('utf8').trim().split(/\r?\n/).map(l=>{const r=JSON.parse(l);return[r.src_row,r];}));
const facts=classification.toString('utf8').trim().split(/\r?\n/).map(l=>{
  const r=JSON.parse(l),s=originals.get(r.src_row);
  if(!s||['anno','mese','asl','canale','prodotto_key','key_class','c'].some(k=>String(r[k])!==String(s[k])))throw Error('Source identity changed');
  originals.delete(r.src_row);return r;
});
if(originals.size)throw Error('Source rows not covered');
const cat=JSON.parse(await fs.readFile(path.join(root,'dashboard-complete-20261016/attribuzione.json'),'utf8'));
const productTable=cat.outputs.find(o=>o.id==='PC-06/04').tables[0];
const labels=new Map(productTable.rows.filter(r=>typeof r[0]==='string').map(r=>[r[0],r[2]||r[0]]));
const packet=buildCAttrPacket(facts,rules.portfolios.map(p=>({id:p.id,label:p.nome,kind:p.tipo})),labels,sha(source),sha(classification),rules.version);
parseCAttrPacket(packet);
await fs.mkdir(out,{recursive:true});
const bytes=JSON.stringify(packet);
await fs.writeFile(path.join(out,'attribution.json'),bytes);
const {scopes,...metadata}=packet;
const index={...metadata,schema:'pillar-c-attribution-index-v1',scopes:{}};
for(const scope of scopes){
  const name=`${scope.period}-${scope.org}-${scope.channel}`,content=JSON.stringify(scope),hash=sha(content);
  index.scopes[`${scope.period}|${scope.org}|${scope.channel}`]={name,sha256:hash,bytes:Buffer.byteLength(content)};
  await fs.writeFile(path.join(out,`${name}.json`),content);
}
const indexBytes=JSON.stringify(index);
await fs.writeFile(path.join(out,'index.json'),indexBytes);
await fs.writeFile(path.join(out,'BUILD.json'),JSON.stringify({state:'BUILT_NOT_INDEPENDENTLY_VERIFIED',sha256:sha(bytes),bytes:Buffer.byteLength(bytes),sourceRows:facts.length,scopes:packet.scopes.length,sourceSha256:sha(source),classificationSha256:sha(classification)},null,2));
console.log(JSON.stringify({state:'BUILT',bytes:Buffer.byteLength(bytes),sha256:sha(bytes),indexSha256:sha(indexBytes),scopes:packet.scopes.length}));
