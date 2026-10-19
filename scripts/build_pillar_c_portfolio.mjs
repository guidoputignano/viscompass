/** Private portfolio aggregates, exact at source precision. Never write artifacts inside the public checkout. */
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {parseArgs} from 'node:util';
import {buildCPortfolioPacket,parseCPortfolioPacket} from '../lib/dashboard-review/pillar-c/portfolio.ts';

const {values}=parseArgs({options:{root:{type:'string'},out:{type:'string'}}});
if(!values.root||!values.out)throw Error('--root and --out required');
const root=await fs.realpath(values.root),checkout=await fs.realpath(process.cwd()),out=path.resolve(values.out);
for(const candidate of [root,out]){const rel=path.relative(checkout,candidate);if(!rel.startsWith(`..${path.sep}`)&&!path.isAbsolute(rel))throw Error('Private inputs/outputs must stay outside public checkout');}
const sha=b=>createHash('sha256').update(b).digest('hex');
const source=await fs.readFile(path.join(root,'../pillar-b/derived/canonical_monthly_facts.jsonl'));
const classification=await fs.readFile(path.join(root,'freeze-20261012-c1/derived/c1_fact_rows.jsonl'));
const rules=JSON.parse(await fs.readFile(path.join(root,'manifest/c1_portfolio_rules_v0.1.json'),'utf8'));
const identitiesBytes=await fs.readFile(path.join(root,'manifest/c1_atc_products_v0.json'));
if(sha(source)!==rules.inputs.ledger_sha256||sha(classification)!=='e2b3c5900036eec54fc01134d32d0f19bd9341db790916ced99b5152f9ad50aa'||sha(identitiesBytes)!==rules.inputs.atc_products.sha256)throw Error('Pinned input changed');
const originals=new Map(source.toString('utf8').trim().split(/\r?\n/).map(l=>{const r=JSON.parse(l);return[r.src_row,r];}));
const facts=classification.toString('utf8').trim().split(/\r?\n/).map(l=>{const r=JSON.parse(l),s=originals.get(r.src_row);if(!s||['anno','mese','asl','canale','prodotto_key','key_class','c'].some(k=>String(r[k])!==String(s[k])))throw Error('Source identity changed');originals.delete(r.src_row);return r;});
if(originals.size||facts.length!==261153)throw Error('Source row coverage');
const identities=JSON.parse(identitiesBytes),labels=new Map();
for(const [atc,products] of Object.entries(identities.by_deepest_code))for(const p of products){const label=p.descrizione||p.nome_farmaco||p.key;labels.set(`${p.key}|${atc}`,label);}
const packet=buildCPortfolioPacket(facts,rules.portfolios.map(p=>({id:p.id,label:p.nome,kind:p.tipo})),labels,sha(source),sha(classification),rules.version);
parseCPortfolioPacket(packet);await fs.mkdir(out,{recursive:true});
const content=JSON.stringify(packet);await fs.writeFile(path.join(out,'portfolio.json'),content);
const {scopes,...metadata}=packet,index={...metadata,schema:'pillar-c-portfolio-index-v1',scopes:{}};
let maxScopeBytes=0;
for(const scope of scopes){const name=`${scope.period}-${scope.org}-${scope.channel}`,bytes=JSON.stringify(scope),length=Buffer.byteLength(bytes);if(length>5_000_000)throw Error('Scope exceeds transport limit');maxScopeBytes=Math.max(maxScopeBytes,length);index.scopes[`${scope.period}|${scope.org}|${scope.channel}`]={name,sha256:sha(bytes),bytes:length};await fs.writeFile(path.join(out,`${name}.json`),bytes);}
const indexBytes=JSON.stringify(index);await fs.writeFile(path.join(out,'index.json'),indexBytes);
const receipt={state:'BUILT_NOT_INDEPENDENTLY_VERIFIED',sha256:sha(content),bytes:Buffer.byteLength(content),indexSha256:sha(indexBytes),sourceRows:facts.length,scopes:scopes.length,portfolios:packet.portfolios.length,maxScopeBytes,sourceSha256:sha(source),classificationSha256:sha(classification),identitySha256:sha(identitiesBytes)};
await fs.writeFile(path.join(out,'BUILD.json'),JSON.stringify(receipt,null,2));console.log(JSON.stringify(receipt));
