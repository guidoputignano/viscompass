/** Stage verified workbook snapshots in the existing PRIVATE review bucket.
 * No bucket/policy/role/gate/ledger mutations. Default is verification only.
 * Run with the application's alias loader; --upload explicitly creates missing
 * immutable, hash-addressed objects. Existing objects must match byte-for-byte.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {parseArgs} from 'node:util';
import nextEnv from '@next/env';
import {C_WORKBOOK_STORAGE} from '../lib/dashboard-review/pillar-c/workbook-storage.ts';
import {parseCWorkbookIndex,parseCWorkbookSection} from '../lib/dashboard-review/pillar-c/workbook.ts';

const {values}=parseArgs({options:{dir:{type:'string'},upload:{type:'boolean',default:false}}});
if(!values.dir)throw new Error('--dir must identify the verified private artifact directory');
const dir=await fs.realpath(path.resolve(values.dir)),checkout=await fs.realpath(process.cwd());
const relative=path.relative(checkout,dir);
if(!relative.startsWith(`..${path.sep}`)&&!path.isAbsolute(relative))throw new Error('Private artifacts cannot live in the public checkout');
const sha=b=>createHash('sha256').update(b).digest('hex');
const indexBytes=await fs.readFile(path.join(dir,'index.json'));
if(sha(indexBytes)!==C_WORKBOOK_STORAGE.index)throw new Error('Index differs from the reviewed application pin');
const index=parseCWorkbookIndex(JSON.parse(indexBytes.toString('utf8')));
const parity=JSON.parse(await fs.readFile(path.join(dir,'VERIFICATION.json'),'utf8'));
const appParity=JSON.parse(await fs.readFile(path.join(dir,'APPLICATION_PARITY.json'),'utf8'));
if(parity.status!=='PASS'||parity.index_sha256!==C_WORKBOOK_STORAGE.index||parity.workbook_sha256!==index.workbookSha256||appParity.state!=='PASS'||appParity.workbook!==index.workbookSha256||appParity.outputs!==index.outputs.length)throw new Error('Independent parity receipts do not qualify this release');
const files=[{name:'index',hash:C_WORKBOOK_STORAGE.index,bytes:indexBytes}];
for(const [name,pin] of Object.entries(index.sections)){
  const bytes=await fs.readFile(path.join(dir,`${name}.json`));
  if(bytes.length!==pin.bytes||sha(bytes)!==pin.sha256)throw new Error(`Section integrity mismatch: ${name}`);
  parseCWorkbookSection(JSON.parse(bytes.toString('utf8')),name,index);
  files.push({name,hash:pin.sha256,bytes});
}
nextEnv.loadEnvConfig(process.cwd(),false, {info(){},error(){}});
const origin=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY,anon=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY??process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if(!origin||!key||!anon)throw new Error('Required configured production credentials are missing');
if(new URL(origin).hostname!=='yxumhjfsoqfckaeydgxt.supabase.co')throw new Error('Unexpected storage project');
const headers={apikey:key,Authorization:`Bearer ${key}`};
const request=(route,options={})=>fetch(`${origin}/storage/v1/${route}`,{...options,headers:{...headers,...options.headers},signal:AbortSignal.timeout(30_000)});
const bucketResponse=await request(`bucket/${C_WORKBOOK_STORAGE.bucket}`);
if(!bucketResponse.ok)throw new Error(`Cannot inspect private bucket (${bucketResponse.status})`);
const bucket=await bucketResponse.json();
if(bucket.public!==false||bucket.id!==C_WORKBOOK_STORAGE.bucket)throw new Error('Stop: destination bucket is not explicitly private');
const receipt={state:'PASS',timeUtc:new Date().toISOString(),upload:values.upload,bucket:C_WORKBOOK_STORAGE.bucket,prefix:C_WORKBOOK_STORAGE.prefix,index:C_WORKBOOK_STORAGE.index,workbook:index.workbookSha256,objects:[]};
for(const file of files){
  const object=`${C_WORKBOOK_STORAGE.prefix}/${file.name}-${file.hash}.json`,route=`object/authenticated/${C_WORKBOOK_STORAGE.bucket}/${object}`;
  let response=await request(route),created=false;
  if(!response.ok){
    if(!values.upload)throw new Error(`Object not staged: ${file.name} (${response.status})`);
    if(![400,404].includes(response.status))throw new Error(`Unexpected object read failure: ${file.name} (${response.status})`);
    const uploaded=await request(`object/${C_WORKBOOK_STORAGE.bucket}/${object}`,{method:'POST',headers:{'Content-Type':'application/json','x-upsert':'false'},body:file.bytes});
    if(!uploaded.ok)throw new Error(`Immutable upload failed: ${file.name} (${uploaded.status}); no existing object was overwritten`);
    created=true;response=await request(route);
  }
  if(!response.ok||sha(new Uint8Array(await response.arrayBuffer()))!==file.hash)throw new Error(`Stored object differs: ${file.name}`);
  // Check both public-object and authenticated-object paths with anonymous key.
  const denials=[];
  for(const endpoint of ['public','authenticated']){
    const denied=await fetch(`${origin}/storage/v1/object/${endpoint}/${C_WORKBOOK_STORAGE.bucket}/${object}`,{headers:{apikey:anon,Authorization:`Bearer ${anon}`},signal:AbortSignal.timeout(15_000)});
    if(denied.ok)throw new Error(`Stop: anonymous read unexpectedly succeeded for ${file.name}`);
    denials.push(denied.status);
    await denied.body?.cancel();
  }
  receipt.objects.push({name:file.name,sha256:file.hash,bytes:file.bytes.length,created,anonymousStatuses:denials});
  console.log(`${file.name}: integrity PASS; anonymous denied`);
}
await fs.writeFile(path.join(dir,'STORAGE_RECEIPT.json'),JSON.stringify(receipt,null,2));
console.log(JSON.stringify({state:'PASS',objects:files.length,sections:Object.keys(index.sections).length,private:true}));
