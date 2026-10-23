import {NextResponse} from "next/server";
import {createServiceRoleClient} from "@/lib/supabase/service-role";
import {cEvidenceActor,cEvidenceSource,C_EVIDENCE_HEADERS,C_EVIDENCE_UUID} from "@/lib/dashboard-review/pillar-c/evidence-server";
import {cEvidenceFindingsUnavailable,cEvidenceIsCurrent,cEvidenceKind} from "@/lib/dashboard-review/pillar-c/evidence-priority";

export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){
  const json=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:C_EVIDENCE_HEADERS});
  if(!await cEvidenceActor())return json({error:'forbidden'},403);
  const {id}=await params;if(!C_EVIDENCE_UUID.test(id))return json({error:'invalid'},400);
  try{
    // Every existing case stays readable, including one from an earlier data version; `current` says whether it can still change.
    const service=createServiceRoleClient(),[source,found]=await Promise.all([cEvidenceSource(),service.from('c_evidence_cases').select('*').eq('id',id).maybeSingle()]);
    if(found.error)throw Error('storage');
    if(!found.data)return json({error:'not_found'},404);
    const [events,attachments]=await Promise.all([service.from('c_evidence_events').select('*').eq('case_id',id).order('revision',{ascending:false}).limit(200),service.from('c_evidence_attachments').select('id,case_id,file_name,media_type,byte_size,sha256,created_at').eq('case_id',id).order('created_at')]);
    if(events.error||attachments.error)throw Error('unavailable');
    // findingsUnavailable: read only because the pinned findings object cannot be read right now, not because it was superseded.
    const findingsUnavailable=cEvidenceFindingsUnavailable({source_snapshot:found.data.source_snapshot,kind:cEvidenceKind(found.data.source)},source);
    return json({case:found.data,events:(events.data??[]).reverse(),attachments:attachments.data??[],current:cEvidenceIsCurrent(found.data,source),findingsUnavailable});
  }catch{return json({error:'unavailable'},503);}
}
