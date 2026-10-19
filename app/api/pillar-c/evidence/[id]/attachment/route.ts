import {createHash,randomUUID} from "node:crypto";
import {NextResponse} from "next/server";
import {createServiceRoleClient} from "@/lib/supabase/service-role";
import {cEvidenceActor,cEvidenceSource,cEvidenceSameOrigin,C_EVIDENCE_HEADERS,C_EVIDENCE_UUID} from "@/lib/dashboard-review/pillar-c/evidence-server";
import {C_EVIDENCE_BUCKET,C_EVIDENCE_MAX_BODY,cEvidenceCurrent,cEvidenceFile,cEvidenceRpcError,cEvidenceRpcRolledBack} from "@/lib/dashboard-review/pillar-c/evidence-priority";

const json=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:C_EVIDENCE_HEADERS});
/** Any existing case, current or from an earlier data version. Writes add the current-queue check themselves. */
async function load(id:string){
  const service=createServiceRoleClient(),c=await service.from('c_evidence_cases').select('*').eq('id',id).maybeSingle();
  if(c.error)throw Error('storage');
  return c.data?{service,case:c.data}:null;
}
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
  const actor=await cEvidenceActor();if(!actor||!cEvidenceSameOrigin(request))return json({error:'forbidden'},403);
  const {id}=await params;if(!C_EVIDENCE_UUID.test(id))return json({error:'invalid'},400);
  if(Number(request.headers.get('content-length')??0)>C_EVIDENCE_MAX_BODY)return json({error:'file_too_large'},413);
  try{
    const [source,context]=await Promise.all([cEvidenceSource(),load(id)]);if(!context)return json({error:'not_found'},404);
    if(!cEvidenceCurrent(context.case,source.sourceSnapshot,source.groups))return json({error:'archived'},409);
    if(context.case.state==='closed')return json({error:'validation'},422);
    let form:FormData;
    try{
      if(!request.body)return json({error:'invalid'},400);
      const reader=request.body.getReader(),chunks:Uint8Array[]=[];let length=0;
      for(;;){const {value,done}=await reader.read();if(done)break;length+=value.length;if(length>C_EVIDENCE_MAX_BODY){await reader.cancel();return json({error:'file_too_large'},413);}chunks.push(value);}
      const body=new Uint8Array(length);let offset=0;for(const c of chunks){body.set(c,offset);offset+=c.length;}
      form=await new Response(body,{headers:{'Content-Type':request.headers.get('content-type')??''}}).formData();
    }catch{return json({error:'invalid'},400);}
    const file=form.get('file'),revision=Number(form.get('revision'));
    if([...form.keys()].sort().join('|')!=='aggregateOnly|file|revision'||form.get('aggregateOnly')!=='true'||!Number.isSafeInteger(revision)||revision<1)return json({error:'invalid'},400);
    if(!(file instanceof File))return json({error:'file'},400);
    const bytes=new Uint8Array(await file.arrayBuffer());
    let metadata:ReturnType<typeof cEvidenceFile>;
    try{metadata=cEvidenceFile(bytes,file.name,file.type);}catch(e){return (e as Error).message==='file_too_large'?json({error:'file_too_large'},413):json({error:'file'},400);}
    const attachment=randomUUID(),path=`${id}/${attachment}`,sha256=createHash('sha256').update(bytes).digest('hex');
    const uploaded=await context.service.storage.from(C_EVIDENCE_BUCKET).upload(path,bytes,{contentType:metadata.type,upsert:false});if(uploaded.error)return json({error:'unavailable'},503);
    const saved=await context.service.rpc('c_evidence_mutate',{p_actor:actor.id,p_case:id,p_expected:revision,p_action:'attach',p_payload:{attachment_id:attachment,file_name:metadata.name,storage_path:path,media_type:metadata.type,byte_size:bytes.length,sha256}});
    if(saved.error){
      // Remove the object only after a definite rollback. A transport or unknown failure may still commit the row:
      // an object without a row is harmless, a registered attachment whose file was deleted is not.
      if(cEvidenceRpcRolledBack(saved.error))await context.service.storage.from(C_EVIDENCE_BUCKET).remove([path]).catch(()=>null);
      const e=cEvidenceRpcError(saved.error);return json({error:e.code},e.status);
    }
    return json({case:saved.data});
  }catch{return json({error:'unavailable'},503);}
}
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){
  if(!await cEvidenceActor())return json({error:'forbidden'},403);
  const {id}=await params,attachment=new URL(request.url).searchParams.get('attachment');
  if(!C_EVIDENCE_UUID.test(id)||!attachment||!C_EVIDENCE_UUID.test(attachment))return json({error:'invalid'},400);
  try{
    const context=await load(id);if(!context)return json({error:'not_found'},404);
    const meta=await context.service.from('c_evidence_attachments').select('*').eq('id',attachment).eq('case_id',id).maybeSingle();
    if(meta.error)throw Error('storage');
    if(!meta.data)return json({error:'not_found'},404);
    const file=await context.service.storage.from(C_EVIDENCE_BUCKET).download(meta.data.storage_path);if(file.error||!file.data)throw Error('file');
    const bytes=new Uint8Array(await file.data.arrayBuffer());
    if(bytes.length!==meta.data.byte_size||createHash('sha256').update(bytes).digest('hex')!==meta.data.sha256)throw Error('hash');
    return new Response(bytes,{headers:{...C_EVIDENCE_HEADERS,'Content-Type':meta.data.media_type,'Content-Disposition':`attachment; filename*=UTF-8''${encodeURIComponent(meta.data.file_name)}`,'Content-Security-Policy':"default-src 'none'; sandbox"}});
  }catch{return json({error:'unavailable'},503);}
}
