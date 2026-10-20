// Test infrastructure for Pillar C organisation-scoped delivery (recommendation 5).
// Replaces the session-reading modules (and, per test file, any other module) with stubs driven by
// globalThis.__pcs, so the REAL route handlers, page and scoped modules run under a synthetic identity.
// Matching is on the resolved file URL, so alias and relative imports are both caught. Optionally
// compiles .tsx with sucrase (as tests/pillar-c-attribution-render.test.mjs does).
import {register} from 'node:module';
import {fileURLToPath,pathToFileURL} from 'node:url';

const root=fileURLToPath(new URL('../..',import.meta.url));

/** Default stubs: identity from globalThis.__pcs, a session client from __pcs.client(), a service role that must never be built. */
export const IDENTITY_STUBS={
  'lib/auth/get-current-org.ts':`export const getCurrentOrg=async()=>{globalThis.__pcs.identityReads++;return globalThis.__pcs.org;};`,
  'lib/auth/viewer.ts':`export const getViewerIdentity=async()=>globalThis.__pcs.viewer;`,
  'lib/auth/admin.ts':`export const getAdminEmail=async()=>globalThis.__pcs.admin;export const isAdminEmail=(e)=>Boolean(e)&&e===globalThis.__pcs.admin;`,
  'lib/auth/reviewer-list.ts':`export const isReviewerEmail=(e)=>Boolean(e)&&e===globalThis.__pcs.viewer?.email&&globalThis.__pcs.viewer?.isReviewer===true;export const reviewerEmails=()=>[];export const hasConfiguredReviewers=()=>true;`,
  'lib/supabase/server.ts':`export async function createClient(){globalThis.__pcs.sessionClients++;return globalThis.__pcs.client();}`,
  'lib/supabase/service-role.ts':`export function createServiceRoleClient(){globalThis.__pcs.serviceRole++;throw new Error('service role must not be reached');}export const hasServiceRoleConfig=()=>true;`,
  /** The pins of the synthetic bucket the test built (a Proxy, so each test may install its own). */
  'lib/dashboard-review/pillar-c/scoped-storage.ts':`export const C_SCOPED_STORAGE=new Proxy({},{get:(_,k)=>globalThis.__pcs.pins[k]});export const C_SCOPED_LIMITS={index:65536,review:1000000,attribution:1000000,portfolio:5000000};`,
};

export function registerPillarCStubs(stubs,{tsx=false}={}){
  const hook=`
const STUBS=${JSON.stringify(stubs)};
let sucrase=null,pkg=null;
export function initialize(data){ pkg=data.pkg; if(data&&data.tsx){ sucrase=data.pkg; } }
export async function resolve(specifier,context,next){
  let out;
  const bare={'next/server':'next/server.js','next/navigation':'next/navigation.js','next/headers':'next/headers.js'}[specifier]??specifier;
  // Bare next/* and react imports resolve from the checkout, whatever the importing file's location.
  const ctx=/^(next|react|react-dom)(?:[/]|$)/.test(specifier)&&pkg?{...context,parentURL:pkg}:context;
  try{out=await next(bare,ctx);}
  catch(error){
    if(!specifier.startsWith('.'))throw error;
    out=null;
    for(const ext of ['.ts','.tsx']){try{out=await next(specifier+ext,context);break;}catch{}}
    if(!out)throw error;
  }
  const url=out.url.replace(/\\\\/g,'/');
  for(const [tail,source] of Object.entries(STUBS)){
    if(url.endsWith('/'+tail))return {url:'data:text/javascript,'+encodeURIComponent(source),shortCircuit:true};
  }
  return out;
}
export async function load(url,context,next){
  if(sucrase&&url.startsWith('file:')&&url.endsWith('.tsx')){
    const {readFileSync}=await import('node:fs');const {fileURLToPath}=await import('node:url');const {createRequire}=await import('node:module');
    const file=fileURLToPath(url),s=createRequire(sucrase)('sucrase');
    return {format:'module',source:s.transform(readFileSync(file,'utf8'),{transforms:['typescript','jsx'],jsxRuntime:'automatic',production:true,filePath:file}).code,shortCircuit:true};
  }
  return next(url,context);
}`;
  register('data:text/javascript,'+encodeURIComponent(hook),import.meta.url,{data:{tsx,pkg:pathToFileURL(`${root}package.json`).href}});
}

/** A fresh synthetic identity. */
export function as({org=null,viewer=null,admin=null,client,pins}){
  globalThis.__pcs={org,viewer,admin,client,pins,identityReads:0,sessionClients:0,serviceRole:0,reads:[]};
  return globalThis.__pcs;
}
export const ORGS={
  // Invented names. Real organisation names never appear in tests of this delivery.
  'asl-1':{org_code:'201',org_name:'Azienda sintetica Uno',org_type:'asl',region_code:'130'},
  'asl-2':{org_code:'202',org_name:'Azienda sintetica Due',org_type:'asl',region_code:'130'},
  'asl-3':{org_code:'203',org_name:'Azienda sintetica Tre',org_type:'asl',region_code:'130'},
  'asl-4':{org_code:'204',org_name:'Azienda sintetica Quattro',org_type:'asl',region_code:'130'},
  regione:{org_code:'130',org_name:'Regione sintetica',org_type:'regione',region_code:'130'},
  otherRegionAsl:{org_code:'301',org_name:'Azienda sintetica di altra Regione',org_type:'asl',region_code:'140'},
};
export const viewer=(isReviewer=false,email=isReviewer?'reviewer@example.org':'member@example.org')=>({email,name:'Persona sintetica',nameIsEmail:false,isReviewer});
