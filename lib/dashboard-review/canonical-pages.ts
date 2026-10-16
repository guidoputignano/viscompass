import type {CanonicalFact} from './types';

// Explicit typed projection: do not download raw import/provenance payloads for
// every dashboard row. Adding a field to the fact contract requires reviewing
// this list at compile time, rather than silently dropping a new metric input.
const fields={id:true,source_record_id:true,source_version_id:true,year:true,month:true,
  region_code:true,region_name:true,asl_code:true,channel:true,aic:true,
  atc1:true,atc2:true,atc3:true,atc4:true,atc5:true,product_description_raw:true,
  brand_name:true,active_substance:true,quantity_packs:true,total_cost_eur:true,
  acquistato_cost_eur:true,erogato_cost_eur:true,cost_basis:true,biosimilar_flag:true,
  originator_flag:true,units_per_pack:true,strength_value_mg:true,volume_per_unit_ml:true,
  ddd_value_mg:true,unit_cost_eur:true,total_content_mg:true,ddds_per_pack:true,
  cost_per_mg:true,cost_per_ddd:true,mapping_confidence:true,quality_status:true,created_at:true,
  perimeter_status:true,comparable_eligible:true,comparable_quantity:true,comparable_unit:true,
  comparable_stratum_id:true,
} satisfies Record<keyof CanonicalFact,true>;
export const CANONICAL_DASHBOARD_COLUMNS=Object.keys(fields).join(',');

type Page = {data: CanonicalFact[] | null; error: {message:string} | null; count?:number|null};
type Edge = {data: {id:number}[] | null; error:{message:string}|null; count?:number|null};

/** Eight disjoint primary-key ranges; no OFFSET over wide dispensing rows.
 * The exact scoped count, strict increasing IDs and final bounds detect partial
 * or drifting reads. A small server cap is handled by reading until empty,
 * rather than mistaking a short page for the end of the range. */
export async function readCanonicalById(
  readEdge:(edge:'first'|'last')=>PromiseLike<Edge>,
  readRange:(after:number,through:number,size:number)=>PromiseLike<Page>,
  size=1000,concurrency=8,
):Promise<CanonicalFact[]> {
  if(!Number.isSafeInteger(size)||size<1||!Number.isSafeInteger(concurrency)||concurrency<1||concurrency>16)throw new Error('CANONICAL_READER_CONFIGURATION');
  const [first,last]=await Promise.all([readEdge('first'),readEdge('last')]);
  if(first.error||last.error)throw new Error(`canonical_fact boundary query failed: ${first.error?.message??last.error?.message}`);
  const count=first.count;
  if(count==null||!Number.isSafeInteger(count)||count<0)throw new Error('CANONICAL_COUNT_UNAVAILABLE');
  if(count===0){if(first.data?.length||last.data?.length)throw new Error('CANONICAL_PAGING_CHANGED');return [];}
  const low=first.data?.[0]?.id,high=last.data?.[0]?.id;
  if(first.data?.length!==1||last.data?.length!==1||typeof low!=='number'||typeof high!=='number'||!Number.isSafeInteger(low)||!Number.isSafeInteger(high)||low<=Number.MIN_SAFE_INTEGER||high<low||!Number.isSafeInteger(high-low+1))throw new Error('CANONICAL_BOUNDARY_INVALID');
  const width=Math.ceil((high-low+1)/concurrency);
  const bounds=Array.from({length:concurrency},(_,i)=>({from:low+i*width,to:Math.min(high,low+(i+1)*width-1)})).filter(b=>b.from<=b.to);
  const pages=await Promise.all(bounds.map(async({from,to})=>{
    let after=from-1;const rows:CanonicalFact[]=[];
    while(after<to){
      const page=await readRange(after,to,size);
      if(page.error)throw new Error(`canonical_fact query failed: ${page.error.message}`);
      const batch=page.data??[];
      if(batch.length>size)throw new Error('CANONICAL_PAGE_OVERSIZED');
      if(!batch.length)break;
      for(const fact of batch){
        if(!Number.isSafeInteger(fact.id)||fact.id<=after||fact.id>to)throw new Error('CANONICAL_PAGING_CHANGED');
        after=fact.id;rows.push(fact);
      }
    }
    return rows;
  }));
  const facts=pages.flat();
  if(facts.length!==count||facts[0]?.id!==low||facts.at(-1)?.id!==high||new Set(facts.map(f=>f.id)).size!==count)throw new Error('CANONICAL_PAGING_CHANGED');
  return facts;
}
