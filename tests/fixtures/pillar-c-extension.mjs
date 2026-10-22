// Synthetic Pillar C extension packets (January DPC and File F shapes). Invented numbers only: no figure of any
// real Azienda, no real organisation name.
import {createHash} from 'node:crypto';

export const EXT_UNITS=['asl-1','asl-2','asl-3','asl-4','aggregato'];
const cell=(id,label,count,total)=>({id,label,count,share:Math.round(count/total*1000)/1000});
const dist=(total,parts)=>({status:'released',total,cells:parts.map(([id,label,count])=>cell(id,label,count,total))});

export function extUnit(unit,n=1000){
  const aggregate=unit==='aggregato';
  const q=aggregate?null:{q1:1,median:2,q3:3};
  return {schema:'pillar-c-extension-unit-v1',unit,period:'2026-01',channel:'DPC',january:{
    recipients:n,recipientsAreSum:aggregate,
    age:dist(n,[['0-64','0-64',n-600],['65-74','65-74',300],['75-84','75-84',200],['85+','85+',100]]),
    sex:{female:0.52,male:0.48,unknownLeftOut:false},
    cost:{quartiles:aggregate?null:{q1:40,median:80,q3:120},bins:dist(n,[['low','0–<50 €',n-400],['mid','50–<100 €',300],['high','≥100 €',100]]),top10:aggregate?null:0.4,top20:aggregate?null:0.55,gini:aggregate?null:0.48},
    use:{packs:{quartiles:q,bins:dist(n,[['one','1–<2',n-200],['two','2+',200]])},prescriptions:{quartiles:q,bins:dist(n,[['one','1',n-100],['more','2+',100]])},distinctAICs:{quartiles:q,bins:dist(n,[['one','1',n-50],['more','2+',50]])}},
    ingredients:dist(n,[['one','1',n-60],['two','2',50],['three_plus','3+',10]]),
    portfolioStatus:[cell('single_portfolio_proxy','Un solo portafoglio candidato',600,n),cell('shared','Più portafogli candidati',500,n)],
    singleCandidateReach:[cell('cardio_blood','Cardiovascolare',100,n),cell('oncology','Oncologia',0,n)],
    attribution:{single:0.5,narrowed:0.06,indicative:0.05,notInformative:0.39,agreementLines:aggregate?null:0.998,sharedRecipientsNarrowed:aggregate?null:0.15},
    services:{serviceShare:0.12,servicePerPack:8.1,under10Packs:aggregate?null:0.11,under10Service:aggregate?null:0.63,pharmacies:aggregate?null:120,pharmacyTop10:aggregate?null:0.25,
      intervalQ1:aggregate?null:1,intervalMedian:aggregate?null:2,intervalQ3:aggregate?null:4,within7:aggregate?null:0.9,sameDay:aggregate?null:0.12},
  },fileF:unit==='asl-3'?extFileF():null};
}

export function extFileF(){
  const n=5000,months=Array.from({length:12},(_,i)=>`2025-${String(i+1).padStart(2,'0')}`);
  return {year:2025,identifiers:n,identifiersByMonth:months.map(month=>({month,count:2000})),
    age:dist(n,[['0-64','0-64',2000],['65+','65+',3000]]),sex:{female:0.51,male:0.49,unknownLeftOut:true},
    concentration:{q1:50,median:300,q3:800,top10:0.7,top1:0.3,gini:0.8,top10WithoutMode09:0.69,top1WithoutMode09:0.29},
    contacts:dist(n,[['1','1',2000],['2+','2 o più',3000]]),monthsActive:dist(n,[['1','1',2500],['2+','2 o più',2500]]),medianContacts:3,medianMonths:3,
    portfolioShares:{single:0.7,shared:0.29,unmapped:0.01},singleCandidateReach:[{id:'oncology',label:'Oncologia',share:0.05}],
    months:months.map((month,i)=>({month,amount:i===11?1500:1000,mode09:i===11?600:0,withoutMode09:i===11?900:1000})),
    modes:[{id:'03',label:'Diretta a pazienti cronici (03)',rowsShare:0.3,amountShare:0.6},{id:'altre',label:'Altre modalità',rowsShare:0.7,amountShare:0.4}],
    basket:[{quarter:'Q1',index:100.2,coverage:0.9}],basketProducts:50};
}

export function extReviewer(){
  return {schema:'pillar-c-extension-reviewer-v1',units:['aggregato','asl-1','asl-2','asl-3','asl-4'].map(u=>extUnit(u,u==='aggregato'?4000:1000)),
    drivers:{supportProducts:100,referencePer1000:5000,units:['asl-1','asl-2','asl-3','asl-4'].map((unit,i)=>({unit,per1000:5000+i,difference:i,reach:10*i,intensity:-10*i,mix:i,acquisition:0,service:0,reachPer1000:50,packsPerRecipient:1.5,coverage:0.97}))},
    baskets:{products:40,units:['asl-1','asl-2','asl-3','asl-4'].map(unit=>({unit,acquisition:100,service:100,combined:100}))}};
}

export const sha256=b=>createHash('sha256').update(b).digest('hex');
/** Serialised objects, their bucket paths and the pins a test installs in place of extension-storage.ts. */
export function extFixture(){
  const files=new Map(),scoped={};
  for(const u of EXT_UNITS){const body=Buffer.from(JSON.stringify(extUnit(u,u==='aggregato'?4000:1000)));const sha=sha256(body);const name=`estensione-${sha}.json`;files.set(`v1/${u}/${name}`,body);scoped[u]={name,sha256:sha,bytes:body.length};}
  const reviewerBytes=Buffer.from(JSON.stringify(extReviewer()));
  return {files,reviewerBytes,pins:{build:'ext-test',scoped,reviewer:{bucket:'pillar-c-review',object:`ext1/${sha256(reviewerBytes)}.json`,sha256:sha256(reviewerBytes),bytes:reviewerBytes.length}}};
}
