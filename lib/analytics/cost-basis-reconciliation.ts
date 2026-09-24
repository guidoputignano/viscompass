// Compare reported figures; equality does not establish semantic equivalence.
export function reconcileCostBases(
  workbook: {year:number; cf:number; cmr:number; ddd:number}[],
  summary: {year:number; costEur:number; dddCount:number}[],
) {
  return workbook.map(row => {
    const other = summary.find(s => s.year === row.year);
    const valid = other && [row.cf,row.cmr,row.ddd,other.costEur,other.dddCount].every(Number.isFinite);
    return {...row, summaryCost: valid ? other.costEur : null,
      cmrDelta: valid ? other.costEur-row.cmr : null,
      dddDelta: valid ? other.dddCount-row.ddd : null,
      matches: valid ? Math.abs(other.costEur-row.cmr)<=0.01 && Math.abs(other.dddCount-row.ddd)<=0.01 : null};
  });
}
