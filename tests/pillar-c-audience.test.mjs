// Pillar C organisation-scoped delivery: who gets which audience. Pure decision matrix, the reviewed unit
// mapping, the production guard and the units function call. Synthetic identities and names only.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {IDENTITY_STUBS,registerPillarCStubs,as,ORGS,viewer} from './helpers/pillar-c-scoped-stubs.mjs';

registerPillarCStubs(IDENTITY_STUBS);
const rules=await import('../lib/dashboard-review/pillar-c/audience-rules.ts');
const {resolvePillarCAudience,resolvePillarCMemberAudience,pillarCScopedProduction}=await import('../lib/dashboard-review/pillar-c/audience.ts');
const {orgDisplayName,REVIEWED_PSEUDONYM_CODES}=await import('../lib/analytics/org-pseudonym.ts');
const units=await import('../lib/dashboard-review/pillar-c/scoped-units.ts');
const {C_ORGS}=await import('../lib/dashboard-review/pillar-c/review.ts');
// Reviewer-only since review finding UI-4: the province labels are no longer in review.ts.
const {C_ORG_LABELS}=await import('../lib/dashboard-review/pillar-c/reviewer-labels.ts');
const {C_PLANNING_LABELS}=await import('../lib/dashboard-review/pillar-c/planning.ts');
const {decidePillarCAudience,toClientAudience,cScopedUnitOfCode,C_REVIEWER_CLIENT_AUDIENCE}=rules;

const ALL=['aggregato','asl-1','asl-2','asl-3','asl-4'];
const decide=(org,{reviewer=false,admin=false,production=true,units:u}={})=>decidePillarCAudience({org,reviewer,admin,production,units:u});
const only=reason=>({kind:'forecast_only',reason});

test('the units follow the reviewed pseudonym order 201 -> ASL 1 ... 204 -> ASL 4, in code, in the migration and in the labels',()=>{
  assert.deepEqual(REVIEWED_PSEUDONYM_CODES,['201','202','203','204']);
  for(const [i,code] of REVIEWED_PSEUDONYM_CODES.entries()){
    assert.equal(cScopedUnitOfCode(code),`asl-${i+1}`);assert.equal(units.C_SCOPED_UNIT_OF_CODE[code],`asl-${i+1}`);
    assert.equal(orgDisplayName(code,null),`ASL ${i+1}`);
  }
  const migration=readFileSync(new URL('../supabase/migrations/20261020120000_pillar_c_scoped_storage.sql',import.meta.url),'utf8');
  assert.match(migration,/when '201' then 'asl-1' when '202' then 'asl-2'\s+when '203' then 'asl-3' when '204' then 'asl-4'/);
  for(const code of ['130','205','2041','20','','130204'])assert.equal(cScopedUnitOfCode(code),null,code);
  assert.deepEqual([...units.C_SCOPED_UNITS],ALL.slice(1).concat('aggregato'));
});

test('no approved membership is null whatever the role; a reviewer or administrator with one keeps the reviewer path without a units call',()=>{
  for(const flags of [{},{reviewer:true},{admin:true},{production:false}])assert.equal(decide(null,{...flags,units:ALL}),null);
  for(const org of Object.values(ORGS)){
    assert.deepEqual(decide(org,{reviewer:true,units:[]}),{kind:'reviewer'});
    assert.deepEqual(decide(org,{admin:true,production:false}),{kind:'reviewer'});
  }
  assert.deepEqual(rules.pillarCAudienceGate({org:ORGS['asl-4'],reviewer:true,admin:false,production:true}),{decided:{kind:'reviewer'}});
});

test('an enabled Azienda gets exactly its own unit and the aggregate, under its real name',()=>{
  for(const [i,unit] of ['asl-1','asl-2','asl-3','asl-4'].entries()){
    const org=ORGS[unit];
    for(const answer of [['aggregato',unit],[unit,'aggregato']])
      assert.deepEqual(decide(org,{units:answer}),{kind:'azienda',orgCode:org.org_code,orgName:org.org_name,unit,units:[unit,'aggregato']});
    assert.equal(decide({...org,org_name:'  '},{units:['aggregato',unit]}).orgName,org.org_code,'a blank name falls back to the code, never to a pseudonym');
    assert.equal(decide(org,{units:['aggregato',unit]}).unit,`asl-${i+1}`);
  }
});

test('an enabled Regione gets the aggregate and ASL 1–4, in fixed order',()=>{
  assert.deepEqual(decide(ORGS.regione,{units:ALL}),{kind:'regione',orgCode:'130',units:ALL});
  assert.deepEqual(decide(ORGS.regione,{units:[...ALL].reverse()}).units,ALL);
});

test('the database answer must be exactly the entitlement: anything else falls back to the forecast',()=>{
  const az=ORGS['asl-2'];
  assert.deepEqual(decide(az,{units:[]}),only('not_enabled'));
  for(const answer of [['asl-2'],['aggregato'],['aggregato','asl-1'],['aggregato','asl-2','asl-1'],ALL])assert.deepEqual(decide(az,{units:answer}),only('units_mismatch'),JSON.stringify(answer));
  for(const answer of [null,undefined,'asl-2',{},[1],['asl-2','asl-2'],['aggregato','asl-2','asl-2'],['ASL-2','aggregato'],['asl-2','Regione'],[...ALL,'asl-5']])assert.deepEqual(decide(az,{units:answer}),only('units_unavailable'),JSON.stringify(answer));
  for(const answer of [['aggregato'],['aggregato','asl-1','asl-2','asl-3'],['aggregato','asl-4']])assert.deepEqual(decide(ORGS.regione,{units:answer}),only('units_mismatch'));
});

test('every membership and rollout state, as the session and the database present it',()=>{
  // getCurrentOrg() returns only an approved membership; the units function answers per migration 20261020120000.
  const states=[
    ['signed out',null,undefined,null],
    ['pending, rejected or revoked membership (no approved row)',null,undefined,null],
    ['approved, organisation not switched on',ORGS['asl-4'],[],only('not_enabled')],
    ['approved, allow-list mode, user not listed',ORGS['asl-4'],[],only('not_enabled')],
    ['approved, two approved memberships (the function requires exactly one)',ORGS['asl-4'],[],only('not_enabled')],
    ['approved, allow-listed',ORGS['asl-4'],['aggregato','asl-4'],{kind:'azienda',orgCode:'204',orgName:'Azienda sintetica Quattro',unit:'asl-4',units:['asl-4','aggregato']}],
    ['approved, organisation in mode all',ORGS['asl-1'],['aggregato','asl-1'],{kind:'azienda',orgCode:'201',orgName:'Azienda sintetica Uno',unit:'asl-1',units:['asl-1','aggregato']}],
    ['Regione allow-listed',ORGS.regione,ALL,{kind:'regione',orgCode:'130',units:ALL}],
    ['Regione member not listed',ORGS.regione,[],only('not_enabled')],
    ['rollout row deleted (kill switch) since the last request',ORGS['asl-4'],[],only('not_enabled')],
    ['migration not applied (function missing)',ORGS['asl-4'],null,only('units_unavailable')],
    ['reviewer whose own organisation is switched on',ORGS['asl-4'],['aggregato','asl-4'],{kind:'reviewer'}],
  ];
  for(const [name,org,answer,expected] of states)assert.deepEqual(decide(org,{units:answer,reviewer:name.startsWith('reviewer')}),expected,name);
});

test('outside production, and outside the five organisations, every non-reviewer is forecast-only',()=>{
  for(const org of [ORGS['asl-4'],ORGS.regione])assert.deepEqual(decide(org,{production:false,units:ALL}),only('not_production'));
  const unmapped=[ORGS.otherRegionAsl,{...ORGS['asl-4'],region_code:'140'},{...ORGS['asl-4'],region_code:null},{...ORGS['asl-4'],org_code:'205'},{...ORGS['asl-4'],org_code:'130204'},
    {...ORGS['asl-4'],org_type:'regione'},{...ORGS.regione,org_code:'131'},{...ORGS.regione,region_code:'140'},{...ORGS.regione,org_type:'asl'},{...ORGS['asl-1'],org_type:'altro'}];
  for(const org of unmapped)assert.deepEqual(decide(org,{units:ALL}),only('unmapped'),JSON.stringify(org));
});

test('client audiences carry only strings for their own keys; the reviewer audience is today’s constants',()=>{
  assert.deepEqual(C_REVIEWER_CLIENT_AUDIENCE.orgs,C_ORGS.map(key=>({key,label:C_ORG_LABELS[key]})));
  assert.equal(C_REVIEWER_CLIENT_AUDIENCE.exportLabel,C_PLANNING_LABELS.section.confidentiality);
  assert.deepEqual(toClientAudience({kind:'reviewer'}),C_REVIEWER_CLIENT_AUDIENCE);
  const az=toClientAudience(decide(ORGS['asl-3'],{units:['aggregato','asl-3']}));
  assert.deepEqual(az,{schema:'pillar-c-client-audience-v1',kind:'azienda',monthlyMode:'explicit',aggregateKey:'aggregato',
    orgs:[{key:'asl-3',label:'Azienda sintetica Tre'},{key:'aggregato',label:'Aggregato delle quattro Aziende'}],defaultOrg:'asl-3',budgetOrgs:[{key:'asl-3',label:'Azienda sintetica Tre'}],
    capabilities:{workbook:false,insights:false,evidence:false,pvm:false,lineage:false,syntheticBudgets:false},
    scopeLine:'Azienda sintetica Tre e aggregato delle quattro Aziende · analisi in revisione',exportLabel:'Riservato a Azienda sintetica Tre · dati della propria Azienda e aggregato delle quattro Aziende'});
  const re=toClientAudience(decide(ORGS.regione,{units:ALL}));
  assert.deepEqual(re.orgs,[{key:'aggregato',label:'Aggregato regionale'},{key:'asl-1',label:'ASL 1'},{key:'asl-2',label:'ASL 2'},{key:'asl-3',label:'ASL 3'},{key:'asl-4',label:'ASL 4'}]);
  assert.deepEqual(re.budgetOrgs.map(o=>o.key),['asl-1','asl-2','asl-3','asl-4']);
  assert.equal(re.exportLabel,'Riservato alla Regione · dati delle quattro Aziende (ASL 1–4) e aggregato regionale');
  for(const c of [az,re])assert.doesNotMatch(JSON.stringify(c),/(^|[^A-Za-z])(AQ|CH|PE|TE)([^A-Za-z]|$)|"Regione"/);
  // Regional analytical parity (owner clarification of 23 Oct 2026; owner decision of 24 Oct 2026 for the modelled budgets
  // and the lineage): the Regione has the price/quantity/mix decomposition, the modelled budgets and the lineage; an
  // Azienda nothing; neither the shared evidence queue nor the workbook route.
  assert.equal(Object.values(az.capabilities).some(Boolean),false);
  assert.deepEqual(re.capabilities,{workbook:false,insights:false,evidence:false,pvm:true,lineage:true,syntheticBudgets:true});
});

const rpcClient=(answer,{error=null,throws=false}={})=>{const calls=[];return {calls,client:{rpc:async(name,args)=>{calls.push([name,args]);if(throws)throw new Error('network');return error?{data:null,error}:{data:answer,error:null};}}};};
function withEnv(value,fn){const before=process.env.VERCEL_ENV;if(value===undefined)delete process.env.VERCEL_ENV;else process.env.VERCEL_ENV=value;return Promise.resolve(fn()).finally(()=>{if(before===undefined)delete process.env.VERCEL_ENV;else process.env.VERCEL_ENV=before;});}
const quiet=async fn=>{const o=console.warn,lines=[];console.warn=(...a)=>lines.push(a.join(' '));try{return {value:await fn(),lines};}finally{console.warn=o;}};

test('only VERCEL_ENV=production serves scoped data; elsewhere the units function is never called',async()=>{
  for(const env of [undefined,'preview','development','Production','production ','']){
    await withEnv(env,async()=>{
      const r=rpcClient(['aggregato','asl-4']);as({org:ORGS['asl-4'],viewer:viewer(false),client:()=>r.client});
      assert.equal(pillarCScopedProduction(),false);
      assert.deepEqual(await resolvePillarCAudience(),only('not_production'));assert.equal(r.calls.length,0);
    });
  }
});

test('in production the units come from the session’s own rpc call, with no argument; failures fall back to the forecast',async()=>{
  await withEnv('production',async()=>{
    const r=rpcClient(['aggregato','asl-4']),s=as({org:ORGS['asl-4'],viewer:viewer(false),client:()=>r.client});
    assert.deepEqual(await resolvePillarCAudience(),{kind:'azienda',orgCode:'204',orgName:'Azienda sintetica Quattro',unit:'asl-4',units:['asl-4','aggregato']});
    assert.deepEqual(r.calls,[['pillar_c_scoped_units',undefined]]);assert.equal(s.serviceRole,0);
    assert.deepEqual(await resolvePillarCMemberAudience(ORGS['asl-4']),{kind:'azienda',orgCode:'204',orgName:'Azienda sintetica Quattro',unit:'asl-4',units:['asl-4','aggregato']});
    assert.equal(r.calls.length,2,'no memo across calls outside a React render');
    for(const [client,expected,log] of [[rpcClient(null,{error:{code:'PGRST202',message:'missing'}}),only('units_unavailable'),'[pillar-c-scoped] PCS-UNITS'],[rpcClient(null,{throws:true}),only('units_unavailable'),'[pillar-c-scoped] PCS-UNITS'],[rpcClient(['aggregato','asl-1']),only('units_mismatch'),'[pillar-c-scoped] PCS-UNITS'],[rpcClient([]),only('not_enabled'),null]]){
      as({org:ORGS['asl-4'],viewer:viewer(false),client:()=>client.client});
      const {value,lines}=await quiet(()=>resolvePillarCAudience());
      assert.deepEqual(value,expected);assert.deepEqual(lines,log?[log]:[]);
    }
    const reviewer=rpcClient(ALL);as({org:ORGS['asl-1'],viewer:viewer(true),client:()=>reviewer.client});
    assert.deepEqual(await resolvePillarCAudience(),{kind:'reviewer'});assert.equal(reviewer.calls.length,0,'a reviewer never calls the units function');
    const admin=rpcClient(ALL);as({org:ORGS.regione,viewer:viewer(false,'admin@example.org'),admin:'admin@example.org',client:()=>admin.client});
    assert.deepEqual(await resolvePillarCAudience(),{kind:'reviewer'});assert.equal(admin.calls.length,0);
    const none=rpcClient(ALL);as({org:null,viewer:viewer(false),client:()=>none.client});
    assert.equal(await resolvePillarCAudience(),null);assert.equal(none.calls.length,0);
    const other=rpcClient(ALL);as({org:ORGS.otherRegionAsl,viewer:viewer(false),client:()=>other.client});
    assert.deepEqual(await resolvePillarCAudience(),only('unmapped'));assert.equal(other.calls.length,0,'an organisation outside the five never calls the units function');
  });
});

test('forecast-only line by reason: an outage is never «not active», and nothing promises an activation no decision covers (UI-1)',()=>{
  const {cForecastOnlyNote,C_FORECAST_ONLY_NOTES:N}=rules;
  const reasons=['not_production','unmapped','not_enabled','units_mismatch','units_unavailable'];
  assert.deepEqual(Object.fromEntries(reasons.map(r=>[r,cForecastOnlyNote(r)])),{
    not_production:N.notCovered,unmapped:N.notCovered,not_enabled:N.notEnabled,units_mismatch:N.notEnabled,units_unavailable:N.unavailable,
  });
  assert.equal(N.notEnabled,'Le analisi di dettaglio di Pillar C per la tua organizzazione non sono ancora attive.','the line LIVE_CHECKLIST reads as «not enabled»');
  assert.equal(N.unavailable,'Le analisi di dettaglio non sono disponibili in questo momento.');
  assert.doesNotMatch(N.unavailable,/attiv/i,'an unavailable units call never reads as «not active»');
  // The cause may be permanent (a deployment ahead of the migration, a member never enabled): no promise that a
  // retry helps (review finding F-COPY-1).
  assert.doesNotMatch(N.unavailable,/riprov|più tardi|tra poco|a breve|ancora|presto|prossim|in arrivo|verranno|saranno/i,'no promise that retrying helps');
  assert.doesNotMatch(N.notCovered,/ancora|presto|prossim|in arrivo|verranno|saranno/i,'no promise of an activation');
  assert.equal(new Set(Object.values(N)).size,3,'three distinct lines');
  for(const line of Object.values(N))assert.doesNotMatch(line,/\bdemo\b|dimostra|verificat|\b20\d\d\b/i,line);
});
