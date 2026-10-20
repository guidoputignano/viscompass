// REC5-SEC-03: the client-supplied object path of a hospital upload is accepted only inside the caller's own
// organisation folder of the 'uploads' bucket, because the server later reads it with the service role
// (lib/uploads/process-upload.ts). Covers the pure rule (lib/uploads/storage-path.ts), the URL each accepted path
// becomes, and the server action recordUpload (lib/dashboard-review/actions.ts) with its session, organisation and
// processing stubbed. Synthetic organisations and file names only.
import test from 'node:test';
import assert from 'node:assert/strict';
import {register} from 'node:module';
import {isUploadStoragePath,cUploadStoragePath,C_UPLOAD_PATH_MAX} from '../lib/uploads/storage-path.ts';

const STUBS={
  'next/cache':`export function revalidatePath(p){globalThis.__up.revalidated.push(p);}`,
  'lib/supabase/server.ts':`export async function createClient(){return {
    auth:{getClaims:async()=>({data:globalThis.__up.claims,error:null})},
    from(table){return {insert(row){globalThis.__up.inserts.push([table,row]);return {select(){return {single:async()=>({data:{id:41},error:null})};}};}};},
  };}`,
  'lib/auth/get-current-org.ts':`export const getCurrentOrg=async()=>globalThis.__up.org;`,
  'lib/uploads/process-upload.ts':`export async function processUpload(id){globalThis.__up.processed.push(id);}`,
};
register('data:text/javascript,'+encodeURIComponent(`
const STUBS=${JSON.stringify(STUBS)};
const data=s=>({url:'data:text/javascript,'+encodeURIComponent(s),shortCircuit:true});
export async function resolve(specifier,context,next){
  if(specifier==='next/cache')return data(STUBS['next/cache']);
  const out=await next(specifier,context);
  const url=out.url.split(String.fromCharCode(92)).join('/');
  for(const [tail,source] of Object.entries(STUBS))if(url.endsWith('/'+tail))return data(source);
  return out;
}`),import.meta.url);
const {recordUpload}=await import('../lib/dashboard-review/actions.ts');

const HEX='a'.repeat(64);
const VALID=[
  '201/1729000000000-DIR_OSP_TRA_003AS_SellInSellOut_nuova_estrazione_2025.xlsx',
  '201/1729000000000-Spesa 2025 (v2).xlsx',
  "201/1729000000000-a!b*c'd&e$f=g@h;i:j+k,l?m-n_o.csv",
  '201/file.xlsx',
  '201/1729000000000-.xlsx',
  '201/1729000000000-report.v1.final.csv',
];
const TRAVERSAL=[
  `../pillar-c-scoped/v1/asl-1/index-${HEX}.json`, `201/../pillar-c-scoped/v1/asl-1/index-${HEX}.json`,
  '201/../../pillar-c-review/r5/review.json', '201/..', '201/.', '201/./x.xlsx', '201/.hidden.xlsx', '201/a..b.xlsx', '201/1-..',
  '201/%2e%2e/pillar-c-scoped/x.json', '201/%2E%2E/x.json', '201/.%2e/x.json', '201/%2e./x.json', '201/a%2fb.xlsx', '201/a%5cb.xlsx', '201/50%25.xlsx',
  '201\\..\\pillar-c-scoped\\x.json', '201/..\\pillar-c-scoped\\x.json', '201/a\\b.xlsx',
  '201/.\t./x.json', '201/.\n./x.json', '201/x\r.xlsx', '201/x\u0000.xlsx', '201/x\u007f.xlsx',
];
const REFUSED=[
  ...TRAVERSAL,
  '/201/x.xlsx', '201//x.xlsx', '201/sub/x.xlsx', '201/x.xlsx/', '201', '201/', ' 201/x.xlsx', '201/ x.xlsx', '201/-x.xlsx', '201/_x.xlsx',
  '202/1729000000000-x.xlsx', '2010/1729000000000-x.xlsx', '20/1729000000000-x.xlsx', '130/1729000000000-x.xlsx',
  '201/1729000000000-è.xlsx', '201/1729000000000-x#1.xlsx', '201/1729000000000-x y.xlsx', '201/1729000000000-x~y.xlsx', '201/1729000000000-[x].xlsx',
  `201/${'a'.repeat(C_UPLOAD_PATH_MAX - 3)}`,
];

test('the upload paths the upload shell writes are accepted, unchanged',()=>{
  for(const path of VALID)assert.equal(isUploadStoragePath(path,'201'),true,path);
  assert.equal(isUploadStoragePath('130/1729000000000-regione.csv','130'),true,'a Regione folder');
  const longest=`201/${'a'.repeat(C_UPLOAD_PATH_MAX - 4)}`;
  assert.equal(longest.length,C_UPLOAD_PATH_MAX);assert.equal(isUploadStoragePath(longest,'201'),true,'the 1024-character limit is inclusive');
});

test('traversal, encoded traversal, backslashes, other folders and other organisations are refused',()=>{
  for(const path of REFUSED)assert.equal(isUploadStoragePath(path,'201'),false,JSON.stringify(path));
  for(const value of [null,undefined,42,{},['201/x.xlsx'],new String('201/x.xlsx')])assert.equal(isUploadStoragePath(value,'201'),false,String(value));
  for(const org of ['', '../201', '201/', '20 1', null, undefined, 201, 'x'.repeat(33)])assert.equal(isUploadStoragePath('201/x.xlsx',org),false,`org ${JSON.stringify(org)}`);
});

test('every refused traversal would have left the folder; every accepted path resolves inside it',()=>{
  // What storage-js does with the path: `${bucket}/${path}` appended to the object endpoint, unencoded.
  const resolved=path=>new URL(`https://project.example/storage/v1/object/uploads/${path}`).pathname;
  const inside=(path,org)=>{const p=resolved(path),prefix=`/storage/v1/object/uploads/${org}/`;return p.startsWith(prefix)&&p.length>prefix.length&&!p.slice(prefix.length).includes('/');};
  // The examples are real: these reach another bucket once the URL is parsed.
  for(const path of [`../pillar-c-scoped/v1/asl-1/index-${HEX}.json`,'201/../../pillar-c-scoped/x.json','201/%2e%2e/%2E%2e/pillar-c-scoped/x.json','201/..\\..\\pillar-c-scoped\\x.json','201/.\t./.\n./pillar-c-scoped/x.json']){
    assert.ok(resolved(path).startsWith('/storage/v1/object/pillar-c-scoped/'),`${JSON.stringify(path)} reaches another bucket`);
    assert.equal(isUploadStoragePath(path,'201'),false,JSON.stringify(path));
  }
  for(const path of TRAVERSAL)assert.equal(isUploadStoragePath(path,'201'),false,JSON.stringify(path));
  for(const path of VALID)assert.ok(inside(path,'201'),path);
  // A deterministic sweep over hostile alphabets: whatever is accepted stays a single object of the own folder.
  let seed=20261020;const rand=n=>{seed=(seed*1103515245+12345)%2147483648;return seed%n;};
  const alphabet=['a','Z','0','9','.','..','/','\\','%','2e','2E','2f','5c','?','#',' ','\t','\n','-','_','~','è','(',')',';',':','+',',','=','@','$','&','*','!',"'"];
  let accepted=0;
  for(let i=0;i<20000;i++){
    const segment=Array.from({length:1+rand(10)},()=>alphabet[rand(alphabet.length)]).join('');
    for(const path of [`201/${segment}`,`201/1729000000000-${segment}`]){
      if(!isUploadStoragePath(path,'201'))continue;
      accepted++;
      assert.ok(inside(path,'201'),JSON.stringify(path));
      assert.ok(!path.includes('..')&&!path.includes('\\')&&!path.includes('%'),JSON.stringify(path));
    }
  }
  assert.ok(accepted>1000,'the sweep is not vacuous');
});

// ------------------------------------------------------------- the server action
const session=(org,{claims={claims:{sub:'00000000-0000-4000-8000-000000000001'}}}={})=>{globalThis.__up={org,claims,inserts:[],processed:[],revalidated:[]};return globalThis.__up;};
const ORG={org_code:'201',org_name:'Azienda sintetica',org_type:'asl',region_code:'130'};
const input=storagePath=>({storagePath,fileName:'estrazione.xlsx',periodCoveredStart:null,periodCoveredEnd:null});

test('recordUpload records and processes a path of the caller’s own folder exactly as given',async()=>{
  for(const path of VALID){
    const up=session(ORG);
    assert.deepEqual(await recordUpload(input(path)),{ok:true});
    assert.equal(up.inserts.length,1);assert.equal(up.inserts[0][0],'uploads');
    assert.equal(up.inserts[0][1].storage_path,path,'the path is stored unchanged');
    assert.equal(up.inserts[0][1].org_code,'201');
    assert.deepEqual(up.processed,[41]);assert.deepEqual(up.revalidated,['/dashboard-review/dati']);
  }
});

test('recordUpload refuses any other path before writing a row or reading a file with the service role',async()=>{
  for(const path of [...REFUSED,null,undefined,42]){
    const up=session(ORG);
    await assert.rejects(()=>recordUpload(input(path)),/^Error: Il percorso del file caricato non è valido\.$/,JSON.stringify(path));
    assert.equal(up.inserts.length,0,JSON.stringify(path));assert.equal(up.processed.length,0);assert.equal(up.revalidated.length,0);
  }
  // Another organisation's folder is refused even for a well-formed name.
  const up=session({...ORG,org_code:'202'});
  await assert.rejects(()=>recordUpload(input('201/1729000000000-x.xlsx')),/non è valido/);
  assert.equal(up.inserts.length,0);
  // The session checks come first, unchanged.
  session(null);await assert.rejects(()=>recordUpload(input('201/x.xlsx')),/Nessuna organizzazione approvata/);
  session(ORG,{claims:null});await assert.rejects(()=>recordUpload(input('201/x.xlsx')),/Devi essere autenticato/);
});

test('the upload shell writes a path the recorded-path rule always accepts, keeping safe names unchanged',()=>{
  const T=1729000000000,C=String.fromCharCode,BSL=C(92),TAB=C(9),NL=C(10),NUL=C(0);
  for(const name of ['DIR_OSP_TRA_003AS_SellInSellOut_nuova_estrazione_2025.xlsx','Spesa 2025 (v2).xlsx',"a!b*c'd&e$f=g@h;i:j+k,l?m-n_o.csv"])
    assert.equal(cUploadStoragePath('201',name,T),`201/${T}-${name}`,name);
  const hostile=['Spesa..2025.xlsx','report#1.xlsx','Città è più.xlsx','../../pillar-c-scoped/x.json','a/b/c.xlsx',`a${BSL}b.xlsx`,'50%.xlsx','%2e%2e.xlsx',`x${TAB}y${NL}z.xlsx`,'...','','~[x]{y}.csv','emoji 😀.xlsx','.hidden',`a${NUL}b.xlsx`,'x'.repeat(5000)];
  for(const name of hostile){const path=cUploadStoragePath('201',name,T);assert.equal(isUploadStoragePath(path,'201'),true,JSON.stringify(name).slice(0,60));assert.ok(path.length<=C_UPLOAD_PATH_MAX);}
  assert.equal(cUploadStoragePath('201','Spesa..2025.xlsx',T),`201/${T}-Spesa.2025.xlsx`);
  assert.equal(cUploadStoragePath('201','report#1.xlsx',T),`201/${T}-report_1.xlsx`);
  assert.equal(cUploadStoragePath('201','',T),`201/${T}-file`);
  // A deterministic sweep: whatever the browser hands over, the recorded path is accepted.
  let seed=20261020;const rand=n=>{seed=(seed*1103515245+12345)%2147483648;return seed%n;};
  const alphabet=['a','Z','0','.','..','/',BSL,'%','#',C(232),'~',' ',TAB,'-','_','(',C(0xd83d,0xde00)];
  for(let i=0;i<5000;i++){const name=Array.from({length:rand(12)},()=>alphabet[rand(alphabet.length)]).join('');assert.equal(isUploadStoragePath(cUploadStoragePath('204',name,T),'204'),true,JSON.stringify(name));}
});
