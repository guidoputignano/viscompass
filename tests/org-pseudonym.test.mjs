import test from 'node:test';
import assert from 'node:assert/strict';
import {orgDisplayName,orgDisplayMap,REVIEWED_PSEUDONYM_CODES} from '../lib/analytics/org-pseudonym.ts';

const ASLS=[
  {org_code:'201',org_name:"ASL AVEZZANO-SULMONA-L'AQUILA"},
  {org_code:'202',org_name:'ASL LANCIANO-VASTO-CHIETI'},
  {org_code:'203',org_name:'ASL PESCARA'},
  {org_code:'204',org_name:'ASL TERAMO'},
];

test('a viewer sees its own organization by its real name',()=>{
  assert.equal(orgDisplayName('201','201',"ASL AVEZZANO-SULMONA-L'AQUILA"),"ASL AVEZZANO-SULMONA-L'AQUILA");
});

test('every other organization is pseudonymous, even when the real name is passed',()=>{
  // The real name being available must not be enough to render it.
  assert.equal(orgDisplayName('202','201','ASL LANCIANO-VASTO-CHIETI'),'ASL 2');
  assert.equal(orgDisplayName('203','201','ASL PESCARA'),'ASL 3');
});

test('a regione viewer names none of the ASLs: none of them is its own org',()=>{
  const map=orgDisplayMap(ASLS,'130');
  assert.deepEqual(map,{'201':'ASL 1','202':'ASL 2','203':'ASL 3','204':'ASL 4'});
  // The decisive property: no real Azienda name survives into the payload.
  const rendered=Object.values(map).join(' ');
  for(const a of ASLS) assert.equal(rendered.includes(a.org_name),false,`${a.org_name} leaked`);
});

test('an ASL viewer sees itself named and its peers pseudonymous',()=>{
  const map=orgDisplayMap(ASLS,'203');
  assert.equal(map['203'],'ASL PESCARA');
  assert.deepEqual([map['201'],map['202'],map['204']],['ASL 1','ASL 2','ASL 4']);
});

test('an unmapped organization falls back to its code, never to an invented label',()=>{
  // A new cohort needs a reviewed mapping. Silently assigning "ASL 5" would
  // look authoritative while being a guess, and reusing an existing pseudonym
  // would label the wrong Azienda.
  assert.equal(orgDisplayName('999','201','ASL NUOVA'),'999');
  const map=orgDisplayMap([{org_code:'999',org_name:'ASL NUOVA'}],'201');
  assert.equal(map['999'],'999');
  assert.equal(Object.values(map).includes('ASL NUOVA'),false);
});

test('a viewer with no organization sees everything pseudonymously',()=>{
  assert.equal(orgDisplayName('201',null,"ASL AVEZZANO-SULMONA-L'AQUILA"),'ASL 1');
  assert.equal(orgDisplayName('201',undefined,"ASL AVEZZANO-SULMONA-L'AQUILA"),'ASL 1');
});

test('an own organization with a blank name falls back to its code, not to empty',()=>{
  assert.equal(orgDisplayName('201','201',''),'201');
  assert.equal(orgDisplayName('201','201','   '),'201');
  assert.equal(orgDisplayName('201','201',null),'201');
});

test('the reviewed mapping is exactly the four Abruzzo codes',()=>{
  assert.deepEqual([...REVIEWED_PSEUDONYM_CODES].sort(),['201','202','203','204']);
});
