export type WorkbookFact = {
  org_code: string; year: number; aware_category: string;
  cost_eur: number | null; ddd_count: number | null; unit_code: string | null;
  source_note?: string | null;
};
// Rounded values explicitly supplied in National Reference, not a new OSMED certification.
export const suppliedReferences: Record<number, {prices:number[]; weights:number[]}> = {
  2023: {prices:[2.39,3.53,42.82],weights:[30.08,46.18,8.01]},
  2024: {prices:[2.48,3.4,54],weights:[30.23,46.43,6.76]},
};
const sum=(xs:(number|null)[])=>xs.length && xs.every(x=>x!==null && Number.isFinite(x)) ? xs.reduce<number>((s,x)=>s+x!,0):null;
export function workbookAnalysis(rows:WorkbookFact[]) {
  const facts=rows.filter(r=>r.unit_code===null);
  const keys=facts.map(r=>`${r.org_code}/${r.year}/${r.aware_category}`);
  if(new Set(keys).size!==keys.length)throw Error('Duplicate workbook facts');
  const orgs=[...new Set(facts.map(r=>r.org_code))];
  return [...new Set(facts.map(r=>r.year))].sort().map(year=>{
    const current=facts.filter(r=>r.year===year);
    const categories=['T','A','W','R'].map(c=>{
      const selected=current.filter(r=>r.aware_category===c);
      return {category:c,cost:selected.length===orgs.length?sum(selected.map(r=>r.cost_eur)):null,ddd:selected.length===orgs.length?sum(selected.map(r=>r.ddd_count)):null};
    });
    const total=categories[0];
    const prior=facts.filter(r=>r.year===year-1&&r.aware_category==='T');
    const priorCost=prior.length===orgs.length?sum(prior.map(r=>r.cost_eur)):null;
    const priorDdd=prior.length===orgs.length?sum(prior.map(r=>r.ddd_count)):null;
    const ratio=(a:number|null,b:number|null)=>a!==null&&b!==null&&b>0?a/b:null;
    const reference=suppliedReferences[year];
    let decomposition:{actual:number;reference:number;excess:number;price:number;mix:number;interaction:number;residual:number}|null=null;
    const classes=categories.slice(1);
    if(reference&&total.ddd!==null&&total.ddd>0&&classes.every(r=>r.cost!==null&&r.ddd!==null&&r.ddd>0)){
      const weights=reference.weights.reduce((a,b)=>a+b,0);
      let actual=0,base=0,price=0,mix=0,interaction=0;
      classes.forEach((r,i)=>{
        const qa=r.ddd!,pa=r.cost!/qa,qr=reference.weights[i]/weights*total.ddd!,pr=reference.prices[i];
        actual+=r.cost!;base+=qr*pr;price+=qr*(pa-pr);mix+=(qa-qr)*pr;interaction+=(qa-qr)*(pa-pr);
      });
      decomposition={actual,reference:base,excess:actual-base,price,mix,interaction,residual:price+mix+interaction-(actual-base)};
      if(Math.abs(decomposition.residual)>0.01)throw Error('Decomposition identity failed');
    }
    const classCost=sum(classes.map(r=>r.cost)),classDdd=sum(classes.map(r=>r.ddd));
    return {year,cost:total.cost,ddd:total.ddd,costPerDdd:ratio(total.cost,total.ddd),
      costYoy:ratio(total.cost,priorCost)===null?null:ratio(total.cost,priorCost)!-1,
      dddYoy:ratio(total.ddd,priorDdd)===null?null:ratio(total.ddd,priorDdd)!-1,
      costGap:total.cost!==null&&classCost!==null?total.cost-classCost:null,
      dddGap:total.ddd!==null&&classDdd!==null?total.ddd-classDdd:null,
      categories:classes.map(r=>({...r,spendShare:ratio(r.cost,total.cost),dddShare:ratio(r.ddd,total.ddd)})),decomposition};
  });
}
