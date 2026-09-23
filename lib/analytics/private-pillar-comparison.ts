import {privatePillarAnalysis,type PrivateFact} from './private-pillar-a.ts';

// Descriptive fixed-DDD benchmark. Reference includes the selected organization.
// Within-class average costs include product mix; these are not invoice prices.
export function privateComparisons(facts:PrivateFact[]) {
 const reference=privatePillarAnalysis(facts);
 const orgs=[...new Set(facts.map(r=>r.org_code))].sort();
 if(orgs.length<2)return [];
 return orgs.flatMap(org=>privatePillarAnalysis(facts.filter(r=>r.org_code===org)).map(actual=>{
  const ref=reference.find(r=>r.year===actual.year)!;
  if(!actual.ddd||!ref.ddd)return {org,year:actual.year,available:false as const};
  let baseline=0,price=0,mix=0,interaction=0;
  for(const cat of actual.categories){
   const rc=ref.categories.find(r=>r.category===cat.category)!;
   // Do not manufacture a price for a zero-volume category.
   if(cat.ddd<=0||rc.ddd<=0)return {org,year:actual.year,available:false as const};
   const q=cat.ddd,p=cat.cf/q,qr=actual.ddd*rc.ddd/ref.ddd,pr=rc.cf/rc.ddd;
   baseline+=qr*pr;price+=qr*(p-pr);mix+=(q-qr)*pr;interaction+=(q-qr)*(p-pr);
  }
  const difference=actual.cf-baseline;
  if(Math.abs(price+mix+interaction-difference)>.01)throw Error('Reference decomposition fails reconciliation');
  return {org,year:actual.year,available:true as const,baseline,actual:actual.cf,price,mix,interaction,difference,
   intensityDeviation:actual.dddPer100Activity!/ref.dddPer100Activity!-1,
   costDeviation:ref.costPerDdd!>0?actual.costPerDdd!/ref.costPerDdd!-1:null};
 }));
}
