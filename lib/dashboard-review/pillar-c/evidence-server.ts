import "server-only";
import {createHash} from "node:crypto";
import {getCurrentOrg} from "@/lib/auth/get-current-org";
import {getViewerIdentity} from "@/lib/auth/viewer";
import {getAdminEmail,isAdminEmail} from "@/lib/auth/admin";
import {isReviewerEmail} from "@/lib/auth/reviewer-list";
import {createClient} from "@/lib/supabase/server";
import {createServiceRoleClient} from "@/lib/supabase/service-role";
import {loadCAttrView} from "./attribution-loader";
import {C_ATTR_STORAGE} from "./attribution-storage";
import {cEvidenceGroupKey,cEvidencePriority,type CEvidenceOwner} from "./evidence-priority";
import {loadCExtensionReviewer} from "./extension-loader";
import {C_EXTENSION_STORAGE} from "./extension-storage";

export const C_EVIDENCE_HEADERS={"Cache-Control":"private, no-store, max-age=0",Vary:"Cookie","X-Content-Type-Options":"nosniff"};
export const C_EVIDENCE_UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
/** No shared privilege cache. A removed reviewer loses this API on the next request. */
export async function cEvidenceActor(){
  const [org,viewer,admin]=await Promise.all([getCurrentOrg(),getViewerIdentity(),getAdminEmail()]);
  if(!org||!(viewer?.isReviewer||admin))return null;
  const user=await(await createClient()).auth.getUser();
  const live=user.data.user;
  return user.error||!live||!live.email_confirmed_at||!(isReviewerEmail(live.email)||isAdminEmail(live.email))||(live.banned_until&&new Date(live.banned_until).valueOf()>Date.now())?null:{id:live.id,org};
}
export function cEvidenceSameOrigin(request:Request){const origin=request.headers.get('origin');return origin!==null&&origin===new URL(request.url).origin;}
export async function cEvidenceJson(request:Request,limit:number){
  if(!request.headers.get('content-type')?.startsWith('application/json')||!request.body)throw Error('invalid');
  const reader=request.body.getReader(),chunks:Uint8Array[]=[];let length=0;
  for(;;){const {value,done}=await reader.read();if(done)break;length+=value.length;if(length>limit){await reader.cancel();throw Error('invalid');}chunks.push(value);}
  const all=new Uint8Array(length);let pos=0;for(const c of chunks){all.set(c,pos);pos+=c.length;}
  return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(all));
}
export async function cEvidenceOwners(){
  const service=createServiceRoleClient(),allowed:CEvidenceOwner[]=[];
  for(let page=1;page<=10;page++){
    const {data,error}=await service.auth.admin.listUsers({page,perPage:1000});if(error)throw Error("owners");
    const candidates=data.users.filter(u=>u.email_confirmed_at&&(isReviewerEmail(u.email)||isAdminEmail(u.email))&&(!u.banned_until||new Date(u.banned_until).valueOf()<=Date.now()));
    if(candidates.length){
      const memberships=await service.from('user_organizations').select('user_id').in('user_id',candidates.map(u=>u.id)).eq('status','approved');if(memberships.error)throw Error('owners');
      const approved=new Set((memberships.data??[]).map(m=>m.user_id));
      for(const u of candidates)if(approved.has(u.id))allowed.push({id:u.id,label:typeof u.user_metadata?.full_name==='string'&&u.user_metadata.full_name.trim()?u.user_metadata.full_name.trim():u.email!});
    }
    if(data.users.length<1000)return allowed.sort((a,b)=>a.label.localeCompare(b.label));
  }
  throw Error('owners_limit');
}
export async function cEvidenceSource(){
  // Point 18 findings come from the hash-verified reviewer extension object; without it the product queue is unchanged.
  const [loaded,extension]=await Promise.all([loadCAttrView(true,true,'FY2025','Regione','Tutti'),loadCExtensionReviewer(true,true)]);if(loaded.state!=='ready')throw Error('source');
  const findings=extension.state==='ready'?extension.view.findings:null;
  const findingRows=findings?findings.rows.map(f=>({...f,group:cEvidenceFindingGroup(findings.version,f.id)})):[];
  const priority=cEvidencePriority(loaded.view.scope,loaded.view.portfolios);
  // Provenance is read from the hash-verified index that produced this queue, never from a copied constant.
  return {priority,groups:new Set(priority.rows.map(cEvidenceGroup)),portfolios:loaded.view.portfolios,sourceSnapshot:C_ATTR_STORAGE.index,sourceSha256:loaded.view.sourceSha256,classificationSha256:loaded.view.classificationSha256,mappingVersion:loaded.view.mappingVersion,
    findingSnapshot:findings?C_EXTENSION_STORAGE.reviewer.sha256:null,findingVersion:findings?.version??null,findingRows,findingGroups:new Set(findingRows.map(r=>r.group))};
}
export function cEvidenceGroup(row:{key:string;atc:string;state:string;candidates:string[]}) {return createHash('sha256').update(cEvidenceGroupKey(row)).digest('hex');}
/** Identity of one finding: its version and id. Text changes in a new version start a new case, never edit an old one. */
export function cEvidenceFindingGroup(version:string,id:string){return createHash('sha256').update(`finding|${version}|${id}`).digest('hex');}
/** The frozen source of a finding case, or null when the group is not a finding of the current version. */
export function cEvidenceFindingRecord(source:Awaited<ReturnType<typeof cEvidenceSource>>,group:string){
  const row=source.findingRows.find(r=>r.group===group);if(!row||!source.findingSnapshot||!source.findingVersion)return null;
  return {source_snapshot:source.findingSnapshot,source_group:group,finding_version:source.findingVersion,product_key:row.id,product_label:row.title,scope:row.scope,origin:row.source,source_state:'F'};
}
/** Null when the group is not in the current queue (for example a page opened before a data version change). */
export function cEvidenceSourceRecord(source:Awaited<ReturnType<typeof cEvidenceSource>>,group:string){
  const row=source.priority.rows.find(r=>cEvidenceGroup(r)===group);if(!row)return null;
  return {source_snapshot:source.sourceSnapshot,source_sha256:source.sourceSha256,classification_sha256:source.classificationSha256,mapping_version:source.mappingVersion,period:'FY2025',org:'Regione',channel:'Tutti',source_group:group,product_key:row.key,product_label:row.label,source_state:row.state};
}
