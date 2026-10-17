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

/* Compact transport. A cold read of the whole release was 271 MB of JSON
 * (261,153 rows, 16 Oct 2026), most of it the 42 key names repeated on every
 * row and the nulls of columns the release leaves empty. Each field is asked
 * for under a one- or two-letter alias with nulls stripped (109 MB), and
 * `source_version_id`, which always equals the read's own filter value, is
 * not transferred (102 MB). The decoder rebuilds every row with ALL fields, in
 * the order above, an absent value as null: the rows equal the full-name
 * reads, so nothing downstream can tell the transports apart. */
const FIELD_ORDER=Object.keys(fields) as Array<keyof CanonicalFact>;
const wireName=(i:number)=>{const a='abcdefghijklmnopqrstuvwxyz';return i<26?a[i]:a[Math.floor(i/26)-1]+a[i%26];};
const WIRE=FIELD_ORDER.map((field,i)=>({field,wire:wireName(i)}));
const SENT=WIRE.filter(w=>w.field!=='source_version_id');
const FIELD_BY_WIRE=new Map(SENT.map(w=>[w.wire,w.field]));
export const CANONICAL_COMPACT_COLUMNS=SENT.map(w=>`${w.wire}:${w.field}`).join(',');
/** Rows of a compact page, complete; throws on anything that is not one. */
export function decodeCompactFacts(raw:unknown,releaseId:string):CanonicalFact[]{
  if(!Array.isArray(raw))throw new Error('CANONICAL_COMPACT_INVALID');
  return raw.map(item=>{
    if(item===null||typeof item!=='object'||Array.isArray(item))throw new Error('CANONICAL_COMPACT_INVALID');
    const wire=item as Record<string,unknown>;
    for(const key of Object.keys(wire))if(!FIELD_BY_WIRE.has(key))throw new Error('CANONICAL_COMPACT_INVALID');
    const row:Record<string,unknown>={};
    for(const {field,wire:name} of WIRE)row[field]=field==='source_version_id'?releaseId:(Object.hasOwn(wire,name)?wire[name]:null);
    return row as unknown as CanonicalFact;
  });
}

/** Concurrent id ranges for one release read. 8 by default. Measured live on
 * 17 Oct 2026 (Supabase gateway logs and pg_stat_statements): a cold read is
 * ~264 page requests and the shared-compute instance that runs both Postgres
 * and PostgREST is CPU-bound, so 16 lanes did not raise throughput (still
 * ~14 pages/s, ~19 s) but doubled every page's time (gateway origin time 370
 * -> 690 ms) and queued other users' requests behind the read.
 * DASHBOARD_FACT_LANES overrides it: a number is clamped to 4-16 (fewer than 4
 * lanes cannot finish a cold read inside the 45 s deadline; 16 is the
 * reader's own limit), anything unreadable keeps the default, and every value
 * changed or rejected is reported through `warn`. Never throws: it runs on
 * every load. */
export const DEFAULT_FACT_LANES=8,MIN_FACT_LANES=4,MAX_FACT_LANES=16;
export function factLanes(value:string|undefined,warn:(message:string)=>void=()=>{}):number{
  const raw=value?.trim();
  if(!raw)return DEFAULT_FACT_LANES;
  const n=/^-?\d+(\.\d+)?$/.test(raw)?Number(raw):NaN;
  const lanes=Number.isFinite(n)?Math.min(MAX_FACT_LANES,Math.max(MIN_FACT_LANES,Math.trunc(n))):DEFAULT_FACT_LANES;
  if(lanes!==n)warn(JSON.stringify({event:"dashboard_fact_lanes_adjusted",value:raw.slice(0,16),lanes}));
  return lanes;
}

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
