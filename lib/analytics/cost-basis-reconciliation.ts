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
