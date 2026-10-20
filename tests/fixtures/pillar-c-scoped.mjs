// Synthetic Pillar C organisation-scoped bucket (recommendation 5): invented amounts, product keys and names
// only. No workbook, ledger or organisation figure, no province key and no mapping of one to a unit.
// Every object is built like the private builder's output (build rec5-scoped-v1): one folder per unit,
// neutral names `<kind>-<sha256>.json`, one closed index per unit pinning everything else by hash.
import {createHash} from 'node:crypto';
import {buildCAttrPacket,C_ATTR_ORGS} from '../../lib/dashboard-review/pillar-c/attribution.ts';
import {buildCPortfolioPacket} from '../../lib/dashboard-review/pillar-c/portfolio.ts';

export const SCOPED_UNITS=['asl-1','asl-2','asl-3','asl-4','aggregato'];
export const ASL_UNITS=SCOPED_UNITS.slice(0,4);
export const PERIODS=['FY2024','FY2025','JM2025','JM2026'];
export const CHANNELS=['Tutti','CO','DD','DPC'];
export const SOURCE={review:'1a'.repeat(32),attribution:'2b'.repeat(32),portfolio:'3c'.repeat(32)};
/** One invented sentinel per unit (a count-scenario spend). A payload carrying another unit's sentinel has leaked it. */
export const SENTINEL={'asl-1':'1111.000111','asl-2':'2222.000222','asl-3':'3333.000333','asl-4':'4444.000444','aggregato':'5555.000555'};
/** Invented, deliberately token-like descriptors: a manufacturer-style suffix and an ATC-style code. */
export const TOKEN_LABEL='RISPERIDONE TE*20CPR sintetico', TOKEN_ATC='N05CH01';
export const PORTFOLIOS=[{id:'AA',label:'Area sintetica A',kind:'area_terapeutica'},{id:'BB',label:'Area sintetica B',kind:'area_terapeutica'}];
export const sha256=(bytes)=>createHash('sha256').update(bytes).digest('hex');
const LOCAL=['CO','DD','DPC'];

function unitMonthly(unit){
  const n=ASL_UNITS.indexOf(unit)+1,out=[];
  for(const year of [2024,2025,2026])for(let month=1;month<=(year===2026?5:12);month++)for(const [ci,channel] of LOCAL.entries()){
    const net=channel==='CO'&&month===2?-n:n*100+month+ci*10+(year-2024)*1000;
    out.push({year,month,org:unit,channel,rows:1,net:String(net),positive:String(Math.max(net,0)),negative:String(Math.min(net,0))});
  }
  return out;
}
/** The aggregate's explicit monthly rows: the exact sum of the four units per (year, month, channel). */
function aggregateMonthly(){
  const cells=new Map();
  for(const unit of ASL_UNITS)for(const r of unitMonthly(unit)){
    const key=`${r.year}|${r.month}|${r.channel}`,c=cells.get(key)??{year:r.year,month:r.month,org:'aggregato',channel:r.channel,rows:0,net:0,positive:0,negative:0};
    c.rows+=r.rows;c.net+=Number(r.net);c.positive+=Number(r.positive);c.negative+=Number(r.negative);cells.set(key,c);
  }
  return [...cells.values()].map(c=>({...c,net:String(c.net),positive:String(c.positive),negative:String(c.negative)}));
}
function baselineOf(unit,monthly){
  const out=[];
  for(const period of PERIODS)for(const channel of [...LOCAL,'Tutti']){
    const rows=monthly.filter(r=>r.year===Number(period.slice(2))&&(channel==='Tutti'||r.channel===channel)&&(!period.startsWith('JM')||r.month<=5));
    out.push({period,org:unit,channel,rows:rows.reduce((s,r)=>s+r.rows,0),...Object.fromEntries(['net','positive','negative'].map(f=>[f,String(rows.reduce((s,r)=>s+Number(r[f]),0))]))});
  }
  return out;
}
function bridgesOf(unit,baseline){
  const out=[];
  for(const comparison of ['K1','K2'])for(const channel of [...LOCAL,'Tutti']){
    const [p0,p1]=comparison==='K1'?['FY2024','FY2025']:['JM2025','JM2026'];
    const find=p=>baseline.find(r=>r.period===p&&r.channel===channel);
    const delta=Number(find(p1).net)-Number(find(p0).net);
    for(const component of ['B-C','B-E','B-X','B-N'])out.push({comparison,org:unit,channel,component,value:component==='B-C'?String(delta):'0',cells:component==='B-C'?12:0});
  }
  return out;
}
export function scopedReviewFile(unit){
  const monthly=unit==='aggregato'?aggregateMonthly():unitMonthly(unit),baseline=baselineOf(unit,monthly);
  return {schema:'pillar-c-review-scoped-v1',state:'review_only',unit,monthlyBasis:unit==='aggregato'?'derived_exact_sum_of_asl_units':'source_rows',monthly,baseline,bridges:bridgesOf(unit,baseline),
    budgets:unit==='asl-4'?[
      {id:'asl-4-b-0001',period:'FY2024',org:'asl-4',channel:'CO',level:'Dipartimento',area:'4000',basis:'published',budget:'90',actual:'0',alternative:'5'},
      {id:'asl-4-b-0002',period:'FY2024',org:'asl-4',channel:'DD',level:'Dipartimento',area:'2000',basis:'published',budget:'50',actual:null,alternative:null},
    ]:[],
    counts:[
      {period:'FY2025',org:unit,portfolio:'ONC',spend:SENTINEL[unit],persons:'10',perPerson:'1',lowCountCost:'1.3333333333',highCountCost:'0.8',state:'CALCOLATO'},
      {period:'FY2025',org:unit,portfolio:'VAC',spend:'40',persons:null,perPerson:null,lowCountCost:null,highCountCost:null,state:'NON_DISPONIBILE'},
    ]};
}

// Shards: the aggregate scopes of a builder packet made only of this unit's invented rows, re-keyed to the unit,
// as the private builder re-keys the reviewer shards. The reviewer org the rows carry is irrelevant here.
function unitRows(unit){
  const k=SCOPED_UNITS.indexOf(unit)+1,org=C_ATTR_ORGS[1],out=[];
  const r=(key,c,state,candidates,year,month,channel,atc='TEST')=>({anno:year,mese:month,asl:org,canale:channel,prodotto_key:key,atc:state==='S5'?'':atc,c,attribution_status:state,candidate_portfolios:candidates});
  for(const [year,month] of [[2024,1],[2024,7],[2025,1],[2025,7],[2026,1]])for(const channel of LOCAL){
    out.push(r(`91${k}000001`,`${k}${k}.5`,'S2',['AA'],year,month,channel),r(`91${k}000002`,'7','S3',['AA','BB'],year,month,channel),r(`91${k}000003`,'2','S4',[],year,month,channel),r('E-unknown','1','S5',[],year,month,channel),r(`91${k}000004`,'3','S2',['BB'],year,month,channel));
    if(unit==='asl-2')out.push(r('912000009','3','S3',['AA','BB'],year,month,channel,TOKEN_ATC),r('912000010','4','S2',['AA'],year,month,channel,TOKEN_ATC));
  }
  return out;
}
const labelsOf=rows=>new Map(rows.map(r=>[r.prodotto_key,['912000009','912000010'].includes(r.prodotto_key)?TOKEN_LABEL:`Prodotto sintetico ${r.prodotto_key}`]));
function shards(unit){
  const rows=unitRows(unit),labels=labelsOf(rows);
  const attr=buildCAttrPacket(rows,PORTFOLIOS,labels,'4d'.repeat(32),'5e'.repeat(32),'v-test-sintetica');
  const port=buildCPortfolioPacket(rows,PORTFOLIOS,labels,'4d'.repeat(32),'5e'.repeat(32),'v-test-sintetica');
  const pick=(packet,period,channel)=>{const s=packet.scopes.find(x=>x.period===period&&x.org==='Regione'&&x.channel===channel);if(!s)throw Error(`fixture scope ${period} ${channel}`);return {...s,org:unit};};
  return {attr:Object.fromEntries(PERIODS.flatMap(p=>CHANNELS.map(c=>[`${p}|${c}`,pick(attr,p,c)]))),port:Object.fromEntries(PERIODS.flatMap(p=>CHANNELS.map(c=>[`${p}|${c}`,pick(port,p,c)]))),meta:{sourceSha256:attr.sourceSha256,classificationSha256:attr.classificationSha256,mappingVersion:attr.mappingVersion,precision:attr.precision,portfolios:attr.portfolios}};
}

/**
 * The whole bucket: Map(path -> bytes) plus the pins the app would carry (C_SCOPED_STORAGE shape).
 * Hooks mutate an object BEFORE it is hashed, so a tampered bucket stays internally consistent and only
 * the closed parsers, the scope checks or the guard can catch it:
 *   file(unit, reviewFile) · shard(unit, kind, period, channel, shard) · index(unit, index) · bytes(path, bytes)
 */
export function scopedFixture(hooks={}){
  const files=new Map(),index={},reviews={};
  const put=(unit,name,obj)=>{let bytes=Buffer.from(JSON.stringify(obj));const s=sha256(bytes),file=`${name}-${s}.json`,path=`v1/${unit}/${file}`;bytes=hooks.bytes?.(path,bytes)??bytes;files.set(path,bytes);return {name:file,sha256:s,bytes:Buffer.from(JSON.stringify(obj)).length};};
  for(const unit of SCOPED_UNITS){
    const file=scopedReviewFile(unit);hooks.file?.(unit,file);reviews[unit]=file;
    const review=put(unit,'review',file),{attr,port,meta}=shards(unit),scopes={attr:{},port:{}};
    for(const kind of ['attr','port'])for(const period of PERIODS)for(const channel of CHANNELS){
      const shard=(kind==='attr'?attr:port)[`${period}|${channel}`];hooks.shard?.(unit,kind,period,channel,shard);
      scopes[kind][`${period}|${unit}|${channel}`]=put(unit,`${kind}-${period}-${channel}`,shard);
    }
    const idx={schema:'pillar-c-scoped-index-v1',build:'rec5-scoped-v1',root:'v1',unit,source:{...SOURCE},review,
      attribution:{...meta,scopes:scopes.attr},
      portfolio:{precision:meta.precision,sourceSha256:meta.sourceSha256,classificationSha256:meta.classificationSha256,mappingVersion:meta.mappingVersion,portfolios:meta.portfolios,scopes:scopes.port}};
    hooks.index?.(unit,idx);
    index[unit]=put(unit,'index',idx).sha256;
  }
  return {files,reviews,pins:{bucket:'pillar-c-scoped',root:'v1',build:'rec5-scoped-v1',source:{...SOURCE},index}};
}

/**
 * A session client as Storage would answer it: `visible` is the set of units the session's RLS admits.
 * Any other path, bucket or missing object answers like Storage does for both cases: 400, «Object not found».
 * `fail`: '5xx' or 'throw' for transport failures. `units` is what rpc('pillar_c_scoped_units') returns.
 */
export function fakeSessionClient(fixture,{visible=[],fail=null,units=[],rpcError=null,user=null}={}){
  const calls={downloads:[],rpc:[]};
  const notFound={data:null,error:Object.assign(new Error('Object not found'),{status:400,statusCode:'404'})};
  const client={
    rpc:async(name,args)=>{calls.rpc.push([name,args]);return rpcError?{data:null,error:{code:rpcError,message:'synthetic'}}:{data:units,error:null};},
    auth:{getUser:async()=>({data:{user},error:null}),getClaims:async()=>({data:null,error:null})},
    storage:{from(bucket){return {download(path,options,params){
      calls.downloads.push({bucket,path,options,params});
      if(fail==='throw')return Promise.reject(new Error('network'));
      if(fail==='5xx')return Promise.resolve({data:null,error:Object.assign(new Error('upstream'),{status:503,statusCode:'503'})});
      const unit=String(path).split('/')[1];
      if(bucket!=='pillar-c-scoped'||!visible.includes(unit)||!fixture.files.has(path))return Promise.resolve(notFound);
      return Promise.resolve({data:new Blob([fixture.files.get(path)],{type:'application/json'}),error:null});
    }};}},
  };
  return {client,calls};
}
