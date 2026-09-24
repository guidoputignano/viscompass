import test from 'node:test';
import assert from 'node:assert/strict';
import {isReviewerEmail,reviewerEmails,hasConfiguredReviewers} from '../lib/auth/reviewer-list.ts';

// This allow-list decides who may see every Azienda by real name. It is the
// whole of the authorization for that, so the tests are about what it REFUSES
// at least as much as what it admits.
//
// The addresses here are fictional on purpose. The real list lives only in the
// environment (REVIEWER_EMAILS) because this repository is public, and a test
// fixture is still a published file.

const ONE='reviewer.one@example.org';
const TWO='reviewer.two@example.org';

const withEnv=(value,fn)=>{
  const had=Object.prototype.hasOwnProperty.call(process.env,'REVIEWER_EMAILS');
  const previous=process.env.REVIEWER_EMAILS;
  if(value===undefined) delete process.env.REVIEWER_EMAILS; else process.env.REVIEWER_EMAILS=value;
  try{ fn(); } finally {
    if(had) process.env.REVIEWER_EMAILS=previous; else delete process.env.REVIEWER_EMAILS;
  }
};

test('with nothing configured there are no reviewers at all',()=>{
  // The fail-closed default. An unset variable must leave every account scoped
  // to its own Azienda, which is the behaviour that existed before the
  // exception and the only safe thing to do with no configuration.
  withEnv(undefined,()=>{
    assert.equal(hasConfiguredReviewers(),false);
    assert.equal(isReviewerEmail(ONE),false);
    assert.equal(reviewerEmails().size,0);
  });
});

test('a configured address is a reviewer; nobody else is',()=>{
  withEnv(`${ONE},${TWO}`,()=>{
    assert.equal(hasConfiguredReviewers(),true);
    assert.equal(isReviewerEmail(ONE),true);
    assert.equal(isReviewerEmail(TWO),true);
    assert.equal(isReviewerEmail('someone.else@example.org'),false,
      'sharing the domain grants nothing');
  });
});

test('matching is exact: no prefix, suffix or substring may pass',()=>{
  withEnv(ONE,()=>{
    // Each of these contains a configured address as a substring.
    assert.equal(isReviewerEmail(`${ONE}.attacker.com`),false);
    assert.equal(isReviewerEmail(`attacker+${ONE}`),false);
    assert.equal(isReviewerEmail(`x${ONE}`),false);
    assert.equal(isReviewerEmail(`${ONE}x`),false);
    assert.equal(isReviewerEmail(`"${ONE}"@evil.com`),false);
  });
});

test('case and surrounding whitespace do not change the decision',()=>{
  withEnv(' Reviewer.One@Example.ORG ',()=>{
    assert.equal(isReviewerEmail(ONE),true,'the configured value is normalised');
    assert.equal(isReviewerEmail('REVIEWER.ONE@EXAMPLE.ORG'),true);
    assert.equal(isReviewerEmail(`  ${ONE}  `),true,'and so is the candidate');
  });
});

test('it fails closed on anything that is not an email string',()=>{
  withEnv(ONE,()=>{
    for(const bad of [null,undefined,'','   ',0,1,true,{},[],[ONE]]){
      assert.equal(isReviewerEmail(bad),false,`${JSON.stringify(bad)} must not be a reviewer`);
    }
  });
});

test('a malformed variable withholds the exception rather than widening it',()=>{
  for(const value of ['','   ',',,,',' , , ']){
    withEnv(value,()=>{
      assert.equal(hasConfiguredReviewers(),false,`${JSON.stringify(value)} must configure nobody`);
      assert.equal(isReviewerEmail(ONE),false);
      assert.equal(reviewerEmails().has(''),false,'empty entries are dropped, not admitted');
    });
  }
});

test('the list is read per call, so a change needs no restart',()=>{
  withEnv(ONE,()=>assert.equal(isReviewerEmail(ONE),true));
  withEnv(TWO,()=>{
    assert.equal(isReviewerEmail(ONE),false,'removed from the variable, removed from the list');
    assert.equal(isReviewerEmail(TWO),true);
  });
});

test('the reviewer list is not the admin list',()=>{
  // ADMIN_EMAILS grants the access Control Center. It must not grant
  // cross-Azienda visibility of consumption data.
  const previous=process.env.ADMIN_EMAILS;
  process.env.ADMIN_EMAILS='intruder@example.org';
  try{
    withEnv(ONE,()=>assert.equal(isReviewerEmail('intruder@example.org'),false));
  } finally {
    if(previous===undefined) delete process.env.ADMIN_EMAILS; else process.env.ADMIN_EMAILS=previous;
  }
});
