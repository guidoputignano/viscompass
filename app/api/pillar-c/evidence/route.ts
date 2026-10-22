import {NextRequest,NextResponse} from "next/server";
import {createServiceRoleClient} from "@/lib/supabase/service-role";
import {cEvidenceActor,cEvidenceOwners,cEvidenceSource,cEvidenceSourceRecord,cEvidenceFindingRecord,cEvidenceGroup,cEvidenceSameOrigin,cEvidenceJson,C_EVIDENCE_HEADERS,C_EVIDENCE_UUID} from "@/lib/dashboard-review/pillar-c/evidence-server";
import {cEvidenceIsCurrent,cEvidenceQueue,cEvidenceRpcError,C_EVIDENCE_ARCHIVE_LIMIT} from "@/lib/dashboard-review/pillar-c/evidence-priority";

const reply=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:C_EVIDENCE_HEADERS});
const failed=(error:Parameters<typeof cEvidenceRpcError>[0])=>{const e=cEvidenceRpcError(error);return reply({error:e.code},e.status);};
export async function GET(){
  if(!await cEvidenceActor())return reply({error:'forbidden'},403);
  try{
    const service=createServiceRoleClient(),[source,owners]=await Promise.all([cEvidenceSource(),cEvidenceOwners()]);
    // Cases from an earlier data version stay readable as `archived`; they are never carried into the current queue.
    // The current versions: the attribution priority and, when its object is available, the point 18 findings.
    const current=[source.sourceSnapshot,...(source.findingSnapshot?[source.findingSnapshot]:[])];
    const [cases,older]=await Promise.all([service.from('c_evidence_cases').select('*').in('source_snapshot',current).order('created_at'),
      service.from('c_evidence_cases').select('id,product_key,source,state,decision,updated_at,source_snapshot',{count:'exact'}).not('source_snapshot','in',`(${current.join(',')})`).order('updated_at',{ascending:false}).order('id').limit(C_EVIDENCE_ARCHIVE_LIMIT)]);
    if(cases.error||older.error||typeof older.count!=='number'||!Number.isSafeInteger(older.count))throw Error('storage');
    const queue=cEvidenceQueue(cases.data??[],older.data??[],older.count,source.sourceSnapshot,source.groups,r=>cEvidenceIsCurrent(r,source));
    const findings=source.findingSnapshot?{snapshot:source.findingSnapshot,version:source.findingVersion,rows:source.findingRows}:null;
    return reply({schema:'pillar-c-evidence-workspace-v1',sourceSnapshot:source.sourceSnapshot,priority:{...source.priority,rows:source.priority.rows.map(r=>({...r,group:cEvidenceGroup(r)}))},portfolios:source.portfolios,owners,cases:queue.cases,archived:queue.archived,archivedCount:queue.archivedCount,findings});
  }catch{return reply({error:'unavailable'},503);}
}
export async function POST(request:NextRequest){
  const actor=await cEvidenceActor();if(!actor||!cEvidenceSameOrigin(request))return reply({error:'forbidden'},403);
  if(Number(request.headers.get('content-length')??0)>4096)return reply({error:'invalid'},400);
  const body=await cEvidenceJson(request,4096).catch(()=>null);
  if(!body||Object.keys(body).length!==1||typeof body.group!=='string'||!/^[a-f0-9]{64}$/.test(body.group))return reply({error:'invalid'},400);
  try{
    const source=await cEvidenceSource(),finding=cEvidenceFindingRecord(source,body.group);
    if(finding){const saved=await createServiceRoleClient().rpc('c_evidence_create_finding',{p_actor:actor.id,p_source:finding});return saved.error?failed(saved.error):reply({case:saved.data});}
    const record=cEvidenceSourceRecord(source,body.group);
    if(!record)return reply({error:'not_found'},404);
    const saved=await createServiceRoleClient().rpc('c_evidence_create',{p_actor:actor.id,p_source:record});
    return saved.error?failed(saved.error):reply({case:saved.data});
  }catch{return reply({error:'unavailable'},503);}
}
export async function PATCH(request:NextRequest){
  const actor=await cEvidenceActor();if(!actor||!cEvidenceSameOrigin(request))return reply({error:'forbidden'},403);
  if(Number(request.headers.get('content-length')??0)>12000)return reply({error:'invalid'},400);
  const body=await cEvidenceJson(request,12000).catch(()=>null);
  if(!body||Object.keys(body).sort().join('|')!=='action|caseId|payload|revision'||!C_EVIDENCE_UUID.test(body.caseId)||!Number.isSafeInteger(body.revision)||body.revision<1||!['assign','review','record_decision','followup','close','reopen'].includes(body.action)||!body.payload||Array.isArray(body.payload)||typeof body.payload!=='object')return reply({error:'invalid'},400);
  try{
    const service=createServiceRoleClient(),[source,current]=await Promise.all([cEvidenceSource(),service.from('c_evidence_cases').select('source_group,source_snapshot,owner_id,follow_up_owner_id').eq('id',body.caseId).maybeSingle()]);
    if(current.error)throw Error('storage');
    if(!current.data)return reply({error:'not_found'},404);
    // Read-only once its data version or queue row is gone; the detail and documents stay available through GET.
    if(!cEvidenceIsCurrent(current.data,source))return reply({error:'archived'},409);
    if(['assign','followup'].includes(body.action)){
      const owners=await cEvidenceOwners();if(typeof body.payload.owner_id!=='string'||!owners.some(o=>o.id===body.payload.owner_id))return reply({error:'owner'},422);
    }
    if(['review','record_decision','close'].includes(body.action)){
      const owners=await cEvidenceOwners(),id=body.action==='close'?current.data.follow_up_owner_id:current.data.owner_id;
      if(!owners.some(o=>o.id===id))return reply({error:'owner'},422);
    }
    const saved=await service.rpc('c_evidence_mutate',{p_actor:actor.id,p_case:body.caseId,p_expected:body.revision,p_action:body.action,p_payload:body.payload});
    return saved.error?failed(saved.error):reply({case:saved.data});
  }catch{return reply({error:'unavailable'},503);}
}
