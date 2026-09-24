export const PRIVATE_RELEASE = 'closure-20260923';
export type PrivateFact = {
  release_id: string; org_code: string; year: number; aware_category: string;
  cf: number; cmr: number; ddd: number; activity: number;
  activity_variant: string; source_hash: string;
};
const categories = ['A', 'W', 'R', 'T'];
export function privatePillarAnalysis(facts: PrivateFact[]) {
  if (!facts.length) return [];
  const keys = new Set<string>();
  for (const r of facts) {
    const key = `${r.org_code}/${r.year}/${r.aware_category}`;
    if (keys.has(key)) throw Error('Duplicate private fact');
    keys.add(key);
    if (r.release_id !== PRIVATE_RELEASE || r.activity_variant !== 'A3/T1' ||
        !/^[a-f0-9]{64}$/.test(r.source_hash) || !categories.includes(r.aware_category) ||
        !Number.isInteger(r.year) || r.year < 2000 || r.year > 2100 ||
        [r.cf, r.cmr, r.ddd, r.activity].some(v => typeof v !== 'number' || !Number.isFinite(v) || v < 0) || r.activity === 0)
      throw Error('Invalid private source record');
  }
  if (new Set(facts.map(r => r.source_hash)).size !== 1) throw Error('Mixed source versions');
  const orgs = [...new Set(facts.map(r => r.org_code))];
  // Years come from the data. This was the literal [2023, 2024, 2025] in three
  // places, including the per-row validator above, so a 2022 baseline row --
  // the PNCAR reference year -- would have thrown "Invalid private source
  // record" rather than loading. The validator now bounds the year to a sane
  // range and lets the data declare which years it actually carries.
  const years = [...new Set(facts.map(r => r.year))].sort((a, b) => a - b);
  for (const org of orgs) for (const year of years) {
    const subset = facts.filter(r => r.org_code === org && r.year === year);
    if (subset.length !== 4) throw Error('Incomplete organization/year');
    const total = subset.find(r => r.aware_category === 'T')!;
    if (subset.some(r => r.activity !== total.activity)) throw Error('Inconsistent activity denominator');
    for (const field of ['cf', 'cmr', 'ddd'] as const) {
      const sum = subset.filter(r => r.aware_category !== 'T').reduce((s,r) => s + r[field],0);
      if (Math.abs(sum-total[field]) > .01) throw Error('Category totals do not reconcile');
    }
  }
  const ratio = (a:number,b:number) => b > 0 ? a/b : null;
  const result = years.map(year => {
    const rows = facts.filter(r => r.year === year);
    const totals = rows.filter(r => r.aware_category === 'T');
    const sum = (field:'cf'|'cmr'|'ddd'|'activity') => totals.reduce((s,r) => s+r[field],0);
    const cf=sum('cf'),cmr=sum('cmr'),ddd=sum('ddd'),activity=sum('activity');
    return {year,cf,cmr,ddd,activity,costPerDdd:ratio(cf,ddd),dddPer100Activity:ratio(ddd*100,activity),
      categories: categories.slice(0,3).map(category=>{
        const selected=rows.filter(r=>r.aware_category===category);
        const cost=selected.reduce((s,r)=>s+r.cf,0),quantity=selected.reduce((s,r)=>s+r.ddd,0);
        return {category,cf:cost,ddd:quantity,spendShare:ratio(cost,cf),dddShare:ratio(quantity,ddd)};
      })};
  });
  return result.map((r,i)=>{
    const prior=result[i-1];
    const bridge=prior&&prior.ddd>0&&r.ddd>0?{
      volume:(r.ddd-prior.ddd)*(r.cf/r.ddd+prior.cf/prior.ddd)/2,
      average:(r.cf/r.ddd-prior.cf/prior.ddd)*(r.ddd+prior.ddd)/2,
    }:null;
    if(bridge&&Math.abs(bridge.volume+bridge.average-(r.cf-prior.cf))>.01)throw Error('Bridge does not reconcile');
    return {...r,costYoy:prior&&prior.cf>0?r.cf/prior.cf-1:null,dddYoy:prior&&prior.ddd>0?r.ddd/prior.ddd-1:null,bridge};
  });
}
