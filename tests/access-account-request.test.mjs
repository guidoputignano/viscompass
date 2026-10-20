import test from 'node:test';
import assert from 'node:assert/strict';
import {register} from 'node:module';

// Execute the real server action against isolated session/database/mail doubles.
// No production credentials, network requests or memberships are used.
register('data:text/javascript,'+encodeURIComponent(`
const modules={
  '@/lib/supabase/server':'export async function createClient(){return globalThis.__accessAccountTest.client}',
  '@/lib/email/vis-email':'export async function sendAccessRequestReceivedEmail(){globalThis.__accessAccountTest.emails++;return {sent:true}}',
  'next/cache':'export function revalidatePath(){}'
};
export async function resolve(s,c,n){if(s in modules)return {url:'data:text/javascript,'+encodeURIComponent(modules[s]),shortCircuit:true};return n(s,c);}
`));
const {requestOrganizationAccess}=await import('../app/access/actions.ts');
function setup(organization={org_name:'Test organization',org_type:'asl',region_code:'R1'}){
  const state={emails:0,rpcs:[],sessionReads:0,directoryReads:0};
  state.client={
    auth:{async getClaims(){state.sessionReads++;return {data:{claims:{sub:'test-user',email:'test@example.invalid'}},error:null}}},
    from(name){assert.equal(name,'organizations');state.directoryReads++;return {select(fields){assert.equal(fields,'org_name, org_type, region_code');return {eq(key,value){assert.equal(key,'org_code');assert.equal(value,'TEST-ORG');return {async maybeSingle(){return {data:organization,error:null}}}}}}}},
    async rpc(name,args){state.rpcs.push({name,args});return {data:null,error:null}},
  };
  globalThis.__accessAccountTest=state;
  return state;
}
const input={orgCode:'TEST-ORG',requestedRole:'Pharmacy manager',message:'Test request',requestedAccountType:'organization',requestedRegionCode:'R1'};

test('matching account intent submits only a pending-membership request; no role or approval claim is written',async()=>{
  const state=setup();const result=await requestOrganizationAccess(input);
  assert.equal(result.ok,true);
  assert.deepEqual(state.rpcs,[{name:'request_organization_membership',args:{p_org_code:'TEST-ORG',p_requested_role:'Pharmacy manager',p_request_message:'Test request'}}]);
  assert.equal(state.emails,1);
  assert.doesNotMatch(JSON.stringify(state.rpcs),/approved|regione|requested_account_type/);
});

test('forged type, foreign region and absent organizations are refused before the membership RPC',async()=>{
  for(const [org,request] of [
    [{org_name:'Test',org_type:'asl',region_code:'R1'},{...input,requestedAccountType:'regione'}],
    [{org_name:'Test',org_type:'asl',region_code:'R2'},input],
    [{org_name:'Test',org_type:'regione',region_code:'R1'},input],
    [null,input],
  ]){const state=setup(org);const result=await requestOrganizationAccess(request);assert.equal(result.ok,false);assert.deepEqual(state.rpcs,[]);assert.equal(state.emails,0);}
});

test('unknown or privileged account intents fail before database access',async()=>{
  for(const kind of ['admin','reviewer','all','REGIONE','',null,{},['regione']]){
    const state=setup();const result=await requestOrganizationAccess({...input,requestedAccountType:kind});
    assert.equal(result.ok,false);assert.equal(state.sessionReads,0);assert.equal(state.directoryReads,0);assert.deepEqual(state.rpcs,[]);
  }
});

test('regional intent uses the directory type and preserves the same approval workflow',async()=>{
  const state=setup({org_name:'Test regional administration',org_type:'regione',region_code:'R1'});
  const result=await requestOrganizationAccess({...input,requestedAccountType:'regione',requestedRegionCode:undefined});
  assert.equal(result.ok,true);assert.equal(state.rpcs[0].name,'request_organization_membership');
  assert.deepEqual(Object.keys(state.rpcs[0].args).sort(),['p_org_code','p_request_message','p_requested_role']);
});

test('older clients without an account preference still use the existing verified organization request',async()=>{
  const state=setup();const legacy={...input};
  delete legacy.requestedAccountType;delete legacy.requestedRegionCode;
  assert.equal((await requestOrganizationAccess(legacy)).ok,true);assert.equal(state.rpcs.length,1);
});
