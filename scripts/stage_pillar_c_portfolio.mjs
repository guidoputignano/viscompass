/** Immutable private aggregate upload; never edits ledger, roles, gates, policies or existing objects. */
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {parseArgs} from 'node:util';
import nextEnv from '@next/env';
import {C_PORTFOLIO_STORAGE} from '../lib/dashboard-review/pillar-c/portfolio-storage.ts';
import {parseCPortfolioPacket} from '../lib/dashboard-review/pillar-c/portfolio.ts';

const {values}=parseArgs({args:process.argv.slice(2),options:{dir:{type:'string'},upload:{type:'boolean',default:false}}});
if(!values.dir)throw Error('--dir required');
const dir=await fs.realpath(values.dir),checkout=await fs.realpath(process.cwd()),relative=path.relative(checkout,dir);
if(!relative.startsWith(`..${path.sep}`)&&!path.isAbsolute(relative))throw Error('Private artifacts must stay outside checkout');
const sha=b=>createHash('sha256').update(b).digest('hex');
const indexBytes=await fs.readFile(path.join(dir,'index.json')),index=JSON.parse(indexBytes);
if(sha(indexBytes)!==C_PORTFOLIO_STORAGE.index)throw Error('Index pin mismatch');
const verified=JSON.parse(await fs.readFile(path.join(dir,'VERIFICATION.json'),'utf8'));
const packetBytes=await fs.readFile(path.join(dir,'portfolio.json'));
if(verified.state!=='PASS'||verified.indexSha256!==C_PORTFOLIO_STORAGE.index||verified.packetSha256!==sha(packetBytes)||verified.originalWorkbookCostLiteralsChecked!==verified.sourceRows||verified.scopes!==80)throw Error('Independent source-literal verification required');
parseCPortfolioPacket(JSON.parse(packetBytes));
const files=[{name:'index',sha256:C_PORTFOLIO_STORAGE.index,bytes:indexBytes}];
for(const ref of Object.values(index.scopes)){
  if(!/^(?:FY202[45]|JM202[56])-(?:Regione|AQ|CH|PE|TE)-(?:Tutti|CO|DD|DPC)$/.test(ref.name))throw Error('Invalid scope name');
  const bytes=await fs.readFile(path.join(dir,`${ref.name}.json`));
  if(bytes.length!==ref.bytes||sha(bytes)!==ref.sha256||bytes.length>5_000_000)throw Error('Shard differs');
  files.push({name:ref.name,sha256:ref.sha256,bytes});
}
nextEnv.loadEnvConfig(process.cwd(),false,{info(){},error(){}});
const origin=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY,anon=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY??process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if(!origin||!key||!anon||new URL(origin).hostname!=='yxumhjfsoqfckaeydgxt.supabase.co')throw Error('Production storage not configured for expected project');
// Respect storage throttling; immutable uploads are safe to resume, never upsert.
let nextRequest=0;
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function boundedFetch(url,options){
  for(let attempt=0;attempt<6;attempt++){
    const due=Math.max(Date.now(),nextRequest);nextRequest=due+400;await pause(Math.max(0,due-Date.now()));
    const response=await fetch(url,{...options,signal:AbortSignal.timeout(30_000)});
    if(![429,502,503,504].includes(response.status)||attempt===5)return response;
    const retry=Number(response.headers.get('retry-after'));
    await response.body?.cancel();await pause(Math.min(45_000,Math.max(2_000*2**attempt,Number.isFinite(retry)?retry*1000:0)));
  }
}
const request=(route,options={})=>boundedFetch(`${origin}/storage/v1/${route}`,{...options,headers:{apikey:key,Authorization:`Bearer ${key}`,...options.headers}});
const bucketResponse=await request(`bucket/${C_PORTFOLIO_STORAGE.bucket}`);
if(!bucketResponse.ok||(await bucketResponse.json()).public!==false)throw Error('Destination must be an existing private bucket');
const receipt={state:'PASS',timeUtc:new Date().toISOString(),upload:values.upload,indexSha256:C_PORTFOLIO_STORAGE.index,objects:[]};
let cursor=0;
async function worker(){
  while(cursor<files.length){
    const file=files[cursor++],object=`${C_PORTFOLIO_STORAGE.prefix}/${file.name}-${file.sha256}.json`;
    let response=await request(`object/authenticated/${C_PORTFOLIO_STORAGE.bucket}/${object}`),created=false;
    if(!response.ok){
      if(!values.upload||![400,404].includes(response.status))throw Error(`Object unavailable: ${file.name} (${response.status})`);
      await response.body?.cancel();
      const uploaded=await request(`object/${C_PORTFOLIO_STORAGE.bucket}/${object}`,{method:'POST',headers:{'Content-Type':'application/json','x-upsert':'false'},body:file.bytes});
      if(!uploaded.ok)throw Error(`Immutable upload refused: ${file.name} (${uploaded.status})`);
      await uploaded.body?.cancel();created=true;response=await request(`object/authenticated/${C_PORTFOLIO_STORAGE.bucket}/${object}`);
    }
    if(!response.ok||sha(new Uint8Array(await response.arrayBuffer()))!==file.sha256)throw Error(`Stored hash mismatch: ${file.name}`);
    const denied=[];
    for(const endpoint of ['public','authenticated']){
      const check=await boundedFetch(`${origin}/storage/v1/object/${endpoint}/${C_PORTFOLIO_STORAGE.bucket}/${object}`,{headers:{apikey:anon,Authorization:`Bearer ${anon}`}});
      if(check.ok)throw Error(`STOP: anonymous access to ${file.name}`);
      denied.push(check.status);await check.body?.cancel();
    }
    receipt.objects.push({name:file.name,sha256:file.sha256,created,anonymousStatuses:denied});
    if(receipt.objects.length%10===0)console.log(`Verified ${receipt.objects.length}/${files.length} private objects`);
  }
}
await Promise.all([worker(),worker()]);
await fs.writeFile(path.join(dir,'STORAGE_RECEIPT.json'),JSON.stringify(receipt,null,2));
console.log(JSON.stringify({state:'PASS',objects:receipt.objects.length,private:true}));
