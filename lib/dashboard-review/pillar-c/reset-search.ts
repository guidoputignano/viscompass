/** The page-level «Azzera» of Pillar C, shared by the reviewer and the organisation-scoped workspaces.
 * Kept apart from insights.ts, which is reviewer-only (it carries the workbook vocabulary and the reviewer labels),
 * so that the scoped workspace's bundle does not reach it. Re-exported by insights.ts for the reviewer path. */
import { cReviewSearch } from "@/lib/dashboard-review/pillar-c/review";
import { C_PLANNING_PARAMS } from "@/lib/dashboard-review/pillar-c/planning";

export function cInsightResetSearch(search:string):string {
  const params=new URLSearchParams(cReviewSearch(search,{},true));
  params.delete('c_budget_org');params.delete('c_budget_channel');
  params.delete('c_attr_org');params.delete('c_attr_channel');params.delete('c_attr_period');
  for(const key of ['c_port_org','c_port_channel','c_port_period','c_port_id']) params.delete(key);
  for(const key of C_PLANNING_PARAMS) params.delete(key);
  for(const key of [...params.keys()])if(key.startsWith('cw_'))params.delete(key);
  return params.size?`?${params}`:'';
}
