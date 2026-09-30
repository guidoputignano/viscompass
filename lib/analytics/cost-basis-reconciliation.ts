// Only this fingerprinted legacy import is known to round each ASL to whole
// euros/DDD. Integer-valued figures alone are NOT evidence of rounding.
const ROUNDED_IMPORT = 'ab8e41220cb063695fab87598baf56c5fc7487de2c19d26329204de8b385ed2c';
export function reportedRoundingBounds(rows:{cost_eur:number|null;ddd_count:number|null;source_note:string|null}[]) {
  const known = rows.length > 0 && rows.every(r => r.source_note?.includes(`VIS_WORKBOOK_V1: SHA256=${ROUNDED_IMPORT}`)
    && r.source_note.includes('supplied rounded costs and DDD') && Number.isInteger(r.cost_eur) && Number.isInteger(r.ddd_count));
  return known ? {costRoundingBound:rows.length * .5,dddRoundingBound:rows.length * .5} : {};
}
export type ReportedSummary = {year:number;costEur:number;dddCount:number;costRoundingBound?:number;dddRoundingBound?:number};
// Compare reported figures; equality does not establish semantic equivalence.
export function reconcileCostBases(
  workbook: {year:number; cf:number; cmr:number; ddd:number}[],
  summary: ReportedSummary[],
) {
  return workbook.map(row => {
    const other = summary.find(s => s.year === row.year);
    const valid = other && [row.cf,row.cmr,row.ddd,other.costEur,other.dddCount].every(Number.isFinite);
    const exact = valid ? Math.abs(other.costEur-row.cmr)<=0.01 && Math.abs(other.dddCount-row.ddd)<=0.01 : null;
    const bound = (v:number|undefined) => v !== undefined && Number.isFinite(v) && v >= 0 ? v : 0;
    const roundingCompatible = valid && !exact && (bound(other.costRoundingBound)>0 || bound(other.dddRoundingBound)>0)
      && Math.abs(other.costEur-row.cmr)<=bound(other.costRoundingBound)+0.01
      && Math.abs(other.dddCount-row.ddd)<=bound(other.dddRoundingBound)+0.01;
    return {...row, summaryCost: valid ? other.costEur : null,
      cmrDelta: valid ? other.costEur-row.cmr : null,
      dddDelta: valid ? other.dddCount-row.ddd : null,
      // Preserve strict matching; compatibility with rounding is a distinct status.
      matches: exact,
      status: !valid ? 'not_comparable' : exact ? 'matched' : roundingCompatible ? 'reported_rounding' : 'discrepancy'};
  });
}

// The overview and workbook can have different authorized organization scopes
// (notably a reviewer whose overview is one ASL but whose workbook covers all
// four). Compare only identical organization/year sets; otherwise a perfectly
// valid scope difference becomes a false financial discrepancy.
export function reconcileCostBasesByScope(
  privateTotals: {org_code:string;year:number;aware_category:string;cf:number;cmr:number;ddd:number}[],
  summary: ReportedSummary[],
  summaryOrgCodesByYear: Record<number,string[]> | undefined,
) {
  const compared: ReturnType<typeof reconcileCostBases> = [];
  const skippedYears: number[] = [];
  for (const reported of summary) {
    const codes = summaryOrgCodesByYear?.[reported.year];
    const wanted = new Set(codes);
    const matched = privateTotals.filter(r => r.year === reported.year && r.aware_category === 'T' && wanted.has(r.org_code));
    if (!codes?.length || wanted.size !== codes.length || matched.length !== wanted.size ||
        new Set(matched.map(r => r.org_code)).size !== wanted.size) {
      skippedYears.push(reported.year);
      continue;
    }
    const sum = (field:'cf'|'cmr'|'ddd') => matched.reduce((total,row) => total + row[field],0);
    compared.push(...reconcileCostBases([{year:reported.year,cf:sum('cf'),cmr:sum('cmr'),ddd:sum('ddd')}],[reported]));
  }
  return {compared,skippedYears};
}
