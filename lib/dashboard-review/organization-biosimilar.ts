import {buildBiosimilarRows, type BuildOptions} from '@/lib/dashboard-review/biosimilar';
import type {BiosimilarComparisonRow,CanonicalFact} from './types';

export type OrganizationComparison={organizationCode:string;row:BiosimilarComparisonRow};
/** Widening a reviewer scope must not pool local opening dates or procurement
 * prices across Aziende. Each comparison keeps its full own history; only its
 * already-computed organizational result may enter a cohort total. */
export function organizationBiosimilarRows(facts:CanonicalFact[],year:number|null,options:BuildOptions):OrganizationComparison[] {
  const groups=new Map<string,CanonicalFact[]>();
  for(const fact of facts){
    // An unattributed row remains in overall spend, not an invented local comparison.
    if(!fact.asl_code)continue;
    const group=groups.get(fact.asl_code)??[];group.push(fact);groups.set(fact.asl_code,group);
  }
  return [...groups].flatMap(([organizationCode,group])=>buildBiosimilarRows(group,year,options).map(row=>({organizationCode,row})));
}
export function organizationHeadroomByMolecule(rows:OrganizationComparison[]):Map<string,number> {
  const totals=new Map<string,number>();
  for(const {row} of rows){
    if(row.evidence_status==='unresolved')continue;
    totals.set(row.active_substance,(totals.get(row.active_substance)??0)+row.substitution_headroom_eur);
  }
  return totals;
}
