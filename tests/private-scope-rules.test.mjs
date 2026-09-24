import test from 'node:test';
import assert from 'node:assert/strict';
import {decidePrivateScope} from '../lib/analytics/private-scope-rules.ts';

// This decides which Aziende's figures a viewer sees and whether they see them
// by name. The tests are mostly about what it REFUSES to widen.

const ASL={org_code:'201',org_name:"ASL AVEZZANO-SULMONA-L'AQUILA",org_type:'asl'};
const REGIONE={org_code:'130',org_name:'REGIONE ABRUZZO',org_type:'regione'};
const MEMBERS=[
  {org_code:'201',org_name:"ASL AVEZZANO-SULMONA-L'AQUILA"},
  {org_code:'202',org_name:'ASL LANCIANO-VASTO-CHIETI'},
  {org_code:'203',org_name:'ASL PESCARA'},
  {org_code:'204',org_name:'ASL TERAMO'},
];
const base={isReviewer:false,releaseOrgs:null,org:ASL,regionMembers:null};

test('an ordinary ASL viewer sees only its own Azienda, pseudonymising the rest',()=>{
  const d=decidePrivateScope(base);
  assert.deepEqual(d.orgCodes,['201']);
  assert.equal(d.showRealNames,false);
  assert.equal(d.allOrganizations,false);
  assert.equal(d.regional,false);
  assert.equal(d.reviewerScopeUnavailable,false,'not a reviewer, so nothing was downgraded');
});

test('a reviewer with a usable release listing sees every Azienda by name',()=>{
  const d=decidePrivateScope({...base,isReviewer:true,releaseOrgs:MEMBERS});
  assert.deepEqual(d.orgCodes,['201','202','203','204']);
  assert.equal(d.showRealNames,true);
  assert.equal(d.allOrganizations,true);
  assert.equal(d.regional,true);
  assert.equal(d.reviewerScopeUnavailable,false);
});

test('a reviewer needs no membership of their own',()=>{
  const d=decidePrivateScope({isReviewer:true,releaseOrgs:MEMBERS,org:null,regionMembers:null});
  assert.equal(d.allOrganizations,true);
  assert.equal(d.viewerCode,null);
  assert.deepEqual(d.orgCodes,['201','202','203','204']);
});

test('an EMPTY release listing is a failed widening, never a cohort of zero',()=>{
  // The dangerous shape: if [] were treated as success the page would report
  // "tutte le Aziende del rilascio" over nothing at all.
  const d=decidePrivateScope({...base,isReviewer:true,releaseOrgs:[]});
  assert.equal(d.allOrganizations,false);
  assert.equal(d.reviewerScopeUnavailable,true);
  assert.deepEqual(d.orgCodes,['201'],'falls back to their own membership');
});

test('a reviewer whose widening failed is flagged, and still sees real names',()=>{
  // No service-role key, or the listing errored. They must not be shown one
  // Azienda as though it were the whole release.
  const d=decidePrivateScope({...base,isReviewer:true,releaseOrgs:null});
  assert.equal(d.allOrganizations,false);
  assert.equal(d.reviewerScopeUnavailable,true);
  assert.equal(d.showRealNames,true,'who they are did not change, only what they could read');
  assert.deepEqual(d.orgCodes,['201']);
});

test('a reviewer with no membership and no widening sees nothing, not an empty page',()=>{
  assert.equal(decidePrivateScope({isReviewer:true,releaseOrgs:null,org:null,regionMembers:null}),null);
  assert.equal(decidePrivateScope({isReviewer:true,releaseOrgs:[],org:null,regionMembers:null}),null);
});

test('a regione viewer reads its own region, under RLS, still pseudonymously',()=>{
  const d=decidePrivateScope({isReviewer:false,releaseOrgs:null,org:REGIONE,regionMembers:MEMBERS});
  assert.deepEqual(d.orgCodes,['201','202','203','204']);
  assert.equal(d.regional,true);
  assert.equal(d.showRealNames,false,'being the Region does not lift the anonymization rule');
  assert.equal(d.allOrganizations,false,'the scope is the region, not the release');
});

test('a regione viewer with no member ASLs sees nothing',()=>{
  for(const members of [null,[]]){
    assert.equal(
      decidePrivateScope({isReviewer:false,releaseOrgs:null,org:REGIONE,regionMembers:members}),
      null);
  }
});

test('a non-reviewer can never be widened, whatever is passed alongside',()=>{
  // releaseOrgs should be null for a non-reviewer; if a future caller passes it
  // anyway, it must not grant anything.
  const d=decidePrivateScope({...base,isReviewer:false,releaseOrgs:MEMBERS});
  assert.equal(d.allOrganizations,false);
  assert.equal(d.showRealNames,false);
  assert.deepEqual(d.orgCodes,['201'],'their own membership, not the release');
});

test('a single-Azienda release is not presented as a comparison',()=>{
  const d=decidePrivateScope({...base,isReviewer:true,releaseOrgs:[MEMBERS[0]]});
  assert.equal(d.allOrganizations,true);
  assert.equal(d.regional,false,'one Azienda is not a peer comparison');
});

test('an organization in the release but missing from the registry keeps its code',()=>{
  const d=decidePrivateScope({...base,isReviewer:true,
    releaseOrgs:[...MEMBERS,{org_code:'205',org_name:null}]});
  assert.deepEqual(d.orgCodes,['201','202','203','204','205']);
  assert.equal(d.orgs.at(-1).org_name,null,'surfaced unnamed rather than dropped');
});
