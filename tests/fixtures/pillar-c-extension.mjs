// Synthetic Pillar C extension packets (January DPC and File F shapes). Invented numbers only: no figure of any
// real Azienda, no real organisation name. Every count is proportional to n, so the aggregate (n=4000) is exactly
// the sum of four ASLs (n=1000 each).
import {createHash} from 'node:crypto';

export const EXT_UNITS=['asl-1','asl-2','asl-3','asl-4','aggregato'];
const cell=(id,label,count,total)=>({id,label,count,share:Math.round(count/total*1000)/1000});
const dist=(total,parts)=>({status:'released',total,cells:parts.map(([id,label,count])=>cell(id,label,count,total))});

export function extUnit(unit,n=1000){
  const aggregate=unit==='aggregato';
  const q=aggregate?null:{q1:1,median:2,q3:3};
  return {schema:'pillar-c-extension-unit-v2',unit,period:'2026-01',channel:'DPC',january:{
    recipients:n,recipientsAreSum:aggregate,
    age:dist(n,[['0-64','0-64',n*0.4],['65-74','65-74',n*0.3],['75-84','75-84',n*0.2],['85+','85+',n*0.1]]),
    sex:{female:0.52,male:0.48,unknownLeftOut:false},
    cost:{quartiles:aggregate?null:{q1:40,median:80,q3:120},bins:dist(n,[['low','0–<50 €',n*0.6],['mid','50–<100 €',n*0.3],['high','≥100 €',n*0.1]]),top10:aggregate?null:0.4,top20:aggregate?null:0.53,gini:aggregate?null:0.48,
      lorenz:aggregate?null:[0,0.02,0.05,0.09,0.14,0.2,0.27,0.36,0.47,0.6,1]},
    // Distinct quartiles per measure, so a panel reading the wrong field cannot pass (review of 9545a68).
    use:{packs:{quartiles:q,bins:dist(n,[['one','1–<2',n*0.8],['two','2+',n*0.2]])},prescriptions:{quartiles:aggregate?null:{q1:0.9,median:1,q3:2},bins:dist(n,[['one','1',n*0.9],['more','2+',n*0.1]])},distinctAICs:{quartiles:aggregate?null:{q1:1.2,median:1.5,q3:2.5},bins:dist(n,[['one','1',n*0.95],['more','2+',n*0.05]])}},
    ingredients:dist(n,[['one','1',n*0.94],['two','2',n*0.05],['three_plus','3+',n*0.01]]),
    portfolioStatus:[cell('single_portfolio_proxy','Un solo portafoglio candidato',n*0.6,n),cell('shared','Più portafogli candidati',n*0.5,n)],
    singleCandidateReach:[cell('cardio_blood','Cardiovascolare',n*0.1,n),cell('oncology','Oncologia',0,n)],
    attribution:{single:0.5,narrowed:0.06,indicative:0.05,notInformative:0.39,agreementLines:aggregate?null:0.998,sharedRecipientsNarrowed:aggregate?null:0.15},
    services:{serviceShare:0.12,servicePerPack:8.1,under10Packs:aggregate?null:0.11,under10Service:aggregate?null:0.63,pharmacies:aggregate?null:120,pharmacyTop10:aggregate?null:0.25,
      intervalQ1:aggregate?null:1,intervalMedian:aggregate?null:2,intervalQ3:aggregate?null:4,within7:aggregate?null:0.9,sameDay:aggregate?null:0.12,
      pharmacyFeeQ1:aggregate?null:6.5,pharmacyFeeMedian:aggregate?null:7.25,pharmacyFeeQ3:aggregate?null:8.75},
  },unitCosts:aggregate?null:{products:extUnitCosts()},fileF:unit==='asl-3'?extFileF():null,notes:{fileFMode09:unit==='asl-3'?'Nota sintetica sulla modalità 09.':null}};
}

export function extFileF(){
  const n=5000,months=Array.from({length:12},(_,i)=>`2025-${String(i+1).padStart(2,'0')}`);
  return {year:2025,identifiers:n,identifiersByMonth:months.map(month=>({month,count:2000})),
    age:dist(n,[['0-64','0-64',2000],['65+','65+',3000]]),ageUnknownPooled:false,sex:{female:0.51,male:0.49,unknownLeftOut:true},
    concentration:{q1:50,median:300,q3:800,top10:0.7,top1:0.3,gini:0.8,top10WithoutMode09:0.69,top1WithoutMode09:0.29},
    contacts:dist(n,[['1','1',2000],['2+','2 o più',3000]]),monthsActive:dist(n,[['1','1',2500],['2+','2 o più',2500]]),medianContacts:3,medianMonths:3,
    portfolioShares:{single:0.7,shared:0.29,unmapped:0.01},singleCandidateReach:[{id:'oncology',label:'Oncologia',share:0.05}],
    months:months.map((month,i)=>({month,amount:i===11?1500:1000,mode09:i===11?600:0,withoutMode09:i===11?900:1000})),
    modes:[{id:'03',label:'Diretta a pazienti cronici (03)',rowsShare:0.3,amountShare:0.6},{id:'altre',label:'Altre modalità',rowsShare:0.7,amountShare:0.4}],
    bridges:extBridges(months.map((month,i)=>({month,amount:i===11?1500:1000,mode09:i===11?600:0})))};
}

/** Bridges between calendar-adjacent months of a series, in four invented components that add up to each change. */
export function extBridges(series){
  const out=[];
  for(let i=1;i<series.length;i++){
    const a=series[i-1],b=series[i];
    if(Number(b.month.slice(5))!==Number(a.month.slice(5))+1)continue;
    const change=b.amount-a.amount;
    out.push({from:a.month,to:b.month,opening:a.amount,closing:b.amount,change,continuingIncrease:120,continuingDecrease:-100,entries:change+30,exits:-50,
      mode09Change:(b.mode09??0)-(a.mode09??0),withoutMode09:change-((b.mode09??0)-(a.mode09??0)),products:200,top10Share:0.4});
  }
  return out;
}

/** Invented per-pack components on three invented products. */
export function extUnitCosts(){
  return [{aic:'000000017',name:'PRODOTTO SINTETICO A',pack:'10 COMPRESSE',atc:'A10BA02',acquisition:5.1,service:2.4,combined:7.5},
    {aic:'000000029',name:'PRODOTTO SINTETICO B',pack:'1 PENNA 3 ML',atc:'A10AE04',acquisition:31.2,service:8.25,combined:39.45},
    {aic:'000000031',name:'PRODOTTO SINTETICO C',pack:'28 CAPSULE',atc:'L04AX05',acquisition:0.4,service:6.1,combined:6.5}];
}

export function extReviewer(){
  return {schema:'pillar-c-extension-reviewer-v3',units:['aggregato','asl-1','asl-2','asl-3','asl-4'].map(u=>extUnit(u,u==='aggregato'?4000:1000)),
    drivers:{supportProducts:100,referencePer1000:5000,units:['asl-1','asl-2','asl-3','asl-4'].map((unit,i)=>({unit,per1000:5000+i,difference:i,reach:10*i,intensity:-10*i,mix:i,acquisition:0,service:0,reachPer1000:50,packsPerRecipient:1.5,coverage:0.97}))},
    baskets:{products:40,units:['asl-1','asl-2','asl-3','asl-4'].map(unit=>({unit,acquisition:100,service:100,combined:100}))},
    fileFBasket:{unit:'asl-3',products:50,quarters:[{quarter:'Q1',index:100.2,coverage:0.9},{quarter:'Q2',index:99.8,coverage:0.88}]},
    findings:{version:'ext-v1',rows:[{id:'F01',title:'Rilievo sintetico',scope:'Ambito sintetico',source:'Punto sintetico',detail:'Dettaglio sintetico.',action:'Azione sintetica.'},{id:'F02',title:'Secondo rilievo',scope:'Ambito',source:'Punto',detail:'Dettaglio.',action:'Azione.'}]}};
}

export const sha256=b=>createHash('sha256').update(b).digest('hex');
/** Serialised objects, their bucket paths and the pins a test installs in place of extension-storage.ts. */
export function extFixture(){
  const files=new Map(),scoped={};
  for(const u of EXT_UNITS){const body=Buffer.from(JSON.stringify(extUnit(u,u==='aggregato'?4000:1000)));const sha=sha256(body);const name=`estensione-${sha}.json`;files.set(`v9/${u}/${name}`,body);scoped[u]={name,sha256:sha,bytes:body.length};}
  const reviewerBytes=Buffer.from(JSON.stringify(extReviewer()));
  return {files,reviewerBytes,pins:{build:'ext-test',root:'v9',scoped,reviewer:{bucket:'pillar-c-review',object:`ext1/${sha256(reviewerBytes)}.json`,sha256:sha256(reviewerBytes),bytes:reviewerBytes.length}}};
}
