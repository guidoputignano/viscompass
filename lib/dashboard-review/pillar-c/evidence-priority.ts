import { cAttrAtoms, cAttrDecimal, cAttrPriority, cAttrSum, type CAttrPortfolio, type CAttrScope } from "./attribution.ts";

/** The initial queue is a fixed source perimeter, not a filter-dependent resolution promise. */
export function cEvidencePriority(scope:CAttrScope, portfolios:CAttrPortfolio[]) {
  if(scope.period!=="FY2025"||scope.org!=="Regione"||scope.channel!=="Tutti")throw Error("C_EVIDENCE_REFERENCE_SCOPE");
  const ranked=cAttrPriority(scope,"therapeutic","",portfolios),rows=ranked.rows.slice(0,ranked.n80??0);
  if(ranked.n80===null||ranked.n80<1||rows.length!==ranked.n80)throw Error("C_EVIDENCE_EMPTY_REFERENCE");
  const selectedAbs=cAttrSum(rows.map(r=>r.abs));
  if(cAttrAtoms(selectedAbs)*BigInt(5)<cAttrAtoms(ranked.total)*BigInt(4))throw Error("C_EVIDENCE_COVERAGE");
  if(rows.length>1&&cAttrAtoms(cAttrSum(rows.slice(0,-1).map(r=>r.abs)))*BigInt(5)>=cAttrAtoms(ranked.total)*BigInt(4))throw Error("C_EVIDENCE_NOT_MINIMAL");
  return {period:scope.period,org:scope.org,channel:scope.channel,pool:"shared-and-insufficient" as const,
    count:rows.length,poolCount:ranked.count,poolAbs:ranked.total,selectedAbs,
    remainingAbs:cAttrDecimal(cAttrAtoms(ranked.total)-cAttrAtoms(selectedAbs)),
    coverage:Number(selectedAbs)/Number(ranked.total),rows};
}
/** Identity of one queue row: product key, ATC, status and candidate set in any order. Label and amounts are excluded on purpose.
 * The server stores sha256(this string) as source_group; changing it detaches every existing case from its row. */
export function cEvidenceGroupKey(row:{key:string;atc:string;state:string;candidates:string[]}) {return JSON.stringify([row.key,row.atc,row.state,[...row.candidates].sort()]);}

export const C_EVIDENCE_STATES = ["unassigned","assigned","in_review","decision_recorded","follow_up","closed"] as const;
export const C_EVIDENCE_DECISIONS = ["remains_uncertain","evidence_sufficient","needs_local_allocation","identifier_corrected"] as const;
export const C_EVIDENCE_BUCKET = "pillar-c-evidence";
/** Vercel rejects a function request body above 4.5 MB before the route runs, so the file plus the multipart allowance stays below it. */
export const C_EVIDENCE_MAX_FILE = 4*1024*1024;
export const C_EVIDENCE_MAX_BODY = C_EVIDENCE_MAX_FILE+65536;
export const C_EVIDENCE_STATE_LABELS:Record<string,string>={unassigned:"Da assegnare",assigned:"Assegnata",in_review:"In verifica",decision_recorded:"Decisione registrata",follow_up:"Seguito pianificato",closed:"Verifica chiusa"};
export const C_EVIDENCE_DECISION_LABELS:Record<string,string>={remains_uncertain:"Attribuzione ancora incerta",evidence_sufficient:"Evidenza ritenuta sufficiente per la verifica",needs_local_allocation:"Serve una ripartizione locale",identifier_corrected:"Identificativo chiarito"};
export type CEvidenceOwner = {id:string;label:string};
export type CEvidenceCase = {id:string;source:Record<string,string>;source_group:string;product_key:string;state:typeof C_EVIDENCE_STATES[number];revision:number;cycle_start_revision:number;decision_revision:number|null;follow_up_revision:number|null;owner_id:string|null;responsible_org_code:string|null;assigned_role:string|null;due_date:string|null;decision:string|null;decision_note:string|null;follow_up_owner_id:string|null;follow_up_due_date:string|null;follow_up_note:string|null;follow_up_outcome:string|null;created_at:string;updated_at:string;closed_at:string|null};
export type CEvidenceAttachment = {id:string;case_id:string;file_name:string;media_type:string;byte_size:number;sha256:string;created_at:string};
export type CEvidenceEvent = {id:string|number;case_id:string;action:string;actor_id:string;created_at:string;revision:number;detail:Record<string,unknown>};
export function cEvidenceFollowupInitial(c:CEvidenceCase){
  const fresh=c.follow_up_revision===null||(c.decision_revision!==null&&c.follow_up_revision<c.decision_revision);
  return {owner:fresh?c.owner_id??'':c.follow_up_owner_id??'',date:fresh?'':c.follow_up_due_date??'',note:fresh?'':c.follow_up_note??'',outcome:fresh?'':c.follow_up_outcome??''};
}
export function cEvidenceFollowupSaved(c:CEvidenceCase,draft:{owner:string;date:string;note:string}){
  return c.state==='follow_up'&&draft.owner===(c.follow_up_owner_id??'')&&draft.date===(c.follow_up_due_date??'')&&draft.note.trim()===(c.follow_up_note??'').trim();
}

/** Small organizational evidence files only. Never render uploaded bytes inline. */
export function cEvidenceFile(bytes:Uint8Array,name:string,type:string) {
  if(bytes.length>C_EVIDENCE_MAX_FILE)throw Error("file_too_large");
  if(bytes.length<1||typeof name!=="string"||name.length>160||/[\u0000-\u001f\\/]/.test(name))throw Error("file");
  const extension=name.split('.').pop()?.toLowerCase();
  if(extension==="pdf"){
    if(type!=="application/pdf"||new TextDecoder().decode(bytes.slice(0,5))!=="%PDF-")throw Error("file");
    const text=new TextDecoder('latin1').decode(bytes);
    if(/\/JavaScript\b|\/JS\b|\/Launch\b|\/EmbeddedFile\b|\/OpenAction\b/i.test(text))throw Error("active_file");
    return {name,type:"application/pdf"};
  }
  if(!["txt","csv"].includes(extension??"")||!["text/plain","text/csv","application/vnd.ms-excel",""].includes(type)||bytes.includes(0))throw Error("file");
  let text:string;try{text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);}catch{throw Error("file");}
  if(/<\s*(?:html|script|svg)|^\s*(?:MZ|PK\u0003)/i.test(text))throw Error("file");
  return {name,type:extension==="csv"?"text/csv":"text/plain"};
}

export type CEvidenceApiError = "invalid"|"file"|"file_too_large"|"forbidden"|"actor"|"not_found"|"conflict"|"archived"|"owner"|"validation"|"unavailable";
type CEvidenceDbError = {code?:string|null;message?:string|null}|null|undefined;
/** One mapping for every evidence RPC failure. A transport, gateway or unknown failure is never presented as a user mistake. */
export function cEvidenceRpcError(error:CEvidenceDbError):{status:number;code:CEvidenceApiError}{
  const code=error?.code??'';
  if(code==='40001')return {status:409,code:'conflict'};
  // 42501 is the actor's membership check. The owner check shares the code; its message names the owner.
  if(code==='42501')return /\bowner\b/i.test(error?.message??'')?{status:422,code:'owner'}:{status:403,code:'actor'};
  if(code==='22023'||code==='P0002')return {status:422,code:'validation'};
  return {status:503,code:'unavailable'};
}
/** True only when PostgreSQL answered with a SQLSTATE, so the RPC ran and its transaction rolled back.
 * An empty code (fetch failure, status 0), a PostgREST PGRST code or a connection/server class may still commit. */
export function cEvidenceRpcRolledBack(error:CEvidenceDbError){const code=error?.code??'';return /^[0-9A-Z]{5}$/.test(code)&&!/^(?:08|53|57|58|XX)/.test(code);}

/** A case is in the working queue only on the current snapshot AND while its group is still in that snapshot's queue. */
export function cEvidenceCurrent(row:{source_snapshot:string;source_group:string},snapshot:string,groups:ReadonlySet<string>){return row.source_snapshot===snapshot&&groups.has(row.source_group);}
export type CEvidenceArchived = {id:string;product_key:string;product_label:string;state:string;decision:string|null;updated_at:string;source_snapshot:string};
type CEvidenceArchiveSource = {id:string;product_key:string;source?:unknown;state:string;decision?:string|null;updated_at:string;source_snapshot:string};
export const C_EVIDENCE_ARCHIVE_LIMIT = 200;
export function cEvidenceArchivedRow(row:CEvidenceArchiveSource):CEvidenceArchived{
  const label=row.source&&typeof row.source==='object'?(row.source as Record<string,unknown>).product_label:null;
  return {id:row.id,product_key:row.product_key,product_label:typeof label==='string'&&label?label:row.product_key,state:row.state,decision:row.decision??null,updated_at:row.updated_at,source_snapshot:row.source_snapshot};
}
/** Earlier reviews stay readable but are never carried into the current queue. `older` holds only other snapshots, newest update first. */
export function cEvidenceQueue<T extends CEvidenceArchiveSource&{source_group:string}>(same:T[],older:CEvidenceArchiveSource[],olderCount:number,snapshot:string,groups:ReadonlySet<string>){
  const cases=same.filter(r=>cEvidenceCurrent(r,snapshot,groups)),stale=same.filter(r=>!cEvidenceCurrent(r,snapshot,groups));
  const time=(v:string)=>{const t=Date.parse(v);return Number.isFinite(t)?t:0;};
  const archived=[...stale,...older].map(cEvidenceArchivedRow).sort((a,b)=>time(b.updated_at)-time(a.updated_at)||(a.updated_at<b.updated_at?1:a.updated_at>b.updated_at?-1:0)||(a.id<b.id?-1:a.id>b.id?1:0)).slice(0,C_EVIDENCE_ARCHIVE_LIMIT);
  return {cases,archived,archivedCount:olderCount+stale.length};
}
