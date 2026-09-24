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

// The authorized exception: a platform reviewer sees every Azienda by name.
// These pin that it is OPT-IN and cannot be reached by accident.

test('a reviewer sees every organization by its real name',()=>{
  const map=orgDisplayMap(ASLS,'201',{unrestricted:true});
  assert.deepEqual(map,{
    '201':"ASL AVEZZANO-SULMONA-L'AQUILA",
    '202':'ASL LANCIANO-VASTO-CHIETI',
    '203':'ASL PESCARA',
    '204':'ASL TERAMO',
  });
  // Including one that is not the viewer's own, which is the whole point.
  assert.equal(orgDisplayName('204','201','ASL TERAMO',{unrestricted:true}),'ASL TERAMO');
  // And with no organization of their own at all.
  assert.equal(orgDisplayName('203',null,'ASL PESCARA',{unrestricted:true}),'ASL PESCARA');
});

test('the exception is opt-in: anything falsy keeps the anonymised rule',()=>{
  // A caller that forgets the option, passes an empty object, or passes a
  // falsy flag must get pseudonyms — never real names by default.
  for(const options of [undefined,{},{unrestricted:false},{unrestricted:undefined}]){
    const map=orgDisplayMap(ASLS,'201',options);
    assert.equal(map['202'],'ASL 2',`options=${JSON.stringify(options)} must not disclose`);
    assert.equal(map['203'],'ASL 3');
    assert.equal(map['204'],'ASL 4');
    assert.equal(map['201'],"ASL AVEZZANO-SULMONA-L'AQUILA",'own org stays named');
  }
});

test('a reviewer sees an unnamed organization as its code, never as a pseudonym',()=>{
  // Telling a reviewer that an unnamed org is "ASL 2" would be worse than
  // telling them nothing: it asserts an identity nobody reviewed.
  assert.equal(orgDisplayName('202','201',null,{unrestricted:true}),'202');
  assert.equal(orgDisplayName('202','201','   ',{unrestricted:true}),'202');
  assert.equal(orgDisplayName('999','201',null,{unrestricted:true}),'999');
});

test('no real Azienda name survives for a non-reviewer, whatever is passed in',()=>{
  // The property the whole module exists for, restated against the new option.
  const rendered=JSON.stringify(orgDisplayMap(ASLS,'201'));
  for(const name of ['LANCIANO','PESCARA','TERAMO']){
    assert.equal(rendered.includes(name),false,`${name} must not reach a non-reviewer`);
  }
});
