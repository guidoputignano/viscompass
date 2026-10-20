import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  ACCOUNT_TYPE_OPTIONS,
  parseRequestedAccountType,
  accountRegions,
  accountOrganizations,
} from '../lib/access/account-onboarding.ts';

const directory = Object.freeze([
  { org_code: 'region-130', org_name: 'Regione Uno', org_type: 'regione', region_code: '130' },
  { org_code: 'region-020', org_name: 'Regione Due', org_type: 'regione', region_code: '020' },
  { org_code: '201', org_name: 'Azienda Beta', org_type: 'asl', region_code: '130' },
  { org_code: '202', org_name: 'Azienda Alfa', org_type: 'asl', region_code: '130' },
  { org_code: '203', org_name: 'Azienda Altrove', org_type: 'asl', region_code: '020' },
  { org_code: '204', org_name: 'Azienda Senza Regione', org_type: 'asl', region_code: null },
  { org_code: '205', org_name: 'Azienda Senza Nome Regionale', org_type: 'asl', region_code: '010' },
  { org_code: '0', org_name: 'Azienda Zero', org_type: 'asl', region_code: '0' },
  { org_code: '206', org_name: 'Azienda Regione Vuota', org_type: 'asl', region_code: '' },
].map((organization) => Object.freeze(organization)));

test('only explicit Regione and organizational preferences are accepted', () => {
  assert.equal(parseRequestedAccountType('regione'), 'regione');
  assert.equal(parseRequestedAccountType('organization'), 'organization');
  for (const input of [undefined, null, '', 'asl', 'national', 'reviewer', 'Regione', 'regione ', ' organization', 0, '0', true, [], {}, { value: 'regione' }]) {
    assert.equal(parseRequestedAccountType(input), null, `reject ${JSON.stringify(input)}`);
  }
  assert.deepEqual(ACCOUNT_TYPE_OPTIONS.map(({ value, label }) => ({ value, label })), [
    { value: 'regione', label: 'Regione' },
    { value: 'organization', label: 'Azienda sanitaria' },
  ]);
});

test('region choices derive only from the configured directory and retain text codes', () => {
  const regions = accountRegions(directory);
  assert.equal(regions.length, 4);
  assert.deepEqual(regions.find(({ code }) => code === '130'), { code: '130', label: 'Regione Uno' });
  assert.deepEqual(regions.find(({ code }) => code === '020'), { code: '020', label: 'Regione Due' });
  assert.deepEqual(regions.find(({ code }) => code === '010'), { code: '010', label: '010' });
  assert.deepEqual(regions.find(({ code }) => code === '0'), { code: '0', label: '0' });
  assert.deepEqual(accountRegions([]), []);
  assert.equal(regions.some(({ code }) => code === '' || code === null), false);
});

test('duplicate configured region entries produce a deterministic label without mutating input', () => {
  const duplicates = Object.freeze([
    Object.freeze({ org_code: 'r-z', org_type: 'regione', org_name: 'Regione Zeta', region_code: '130' }),
    Object.freeze({ org_code: 'r-empty', org_type: 'regione', org_name: ' ', region_code: '130' }),
    Object.freeze({ org_code: 'r-a', org_type: 'regione', org_name: 'Regione Alfa', region_code: '130' }),
  ]);
  const before = JSON.stringify(duplicates);
  assert.deepEqual(accountRegions(duplicates), [{ code: '130', label: 'Regione Alfa' }]);
  assert.equal(JSON.stringify(duplicates), before);
});

test('regional requests offer only configured regional organizations', () => {
  assert.deepEqual(accountOrganizations(directory, 'regione', '').map(({ org_code }) => org_code), ['region-020', 'region-130']);
  assert.deepEqual(accountOrganizations(directory, 'regione', '130').map(({ org_code }) => org_code), ['region-020', 'region-130']);
});

test('organizational requests need an exact region and cannot include regional tenants', () => {
  assert.deepEqual(accountOrganizations(directory, 'organization', '130').map(({ org_code }) => org_code), ['202', '201']);
  assert.deepEqual(accountOrganizations(directory, 'organization', '020').map(({ org_code }) => org_code), ['203']);
  assert.deepEqual(accountOrganizations(directory, 'organization', '20'), []);
  assert.deepEqual(accountOrganizations(directory, 'organization', '0').map(({ org_code }) => org_code), ['0']);
  for (const region of ['', null, undefined, 0, 'unknown']) {
    assert.deepEqual(accountOrganizations(directory, 'organization', region), []);
  }
  for (const type of ['', undefined, null, 'asl', 'reviewer']) {
    assert.deepEqual(accountOrganizations(directory, type, '130'), []);
  }
});

test('directory filtering and sorting leave the configured organization records intact', () => {
  const before = JSON.stringify(directory);
  accountRegions(directory);
  accountOrganizations(directory, 'organization', '130');
  accountOrganizations(directory, 'regione', '');
  assert.equal(JSON.stringify(directory), before);
});

test('signup records a preference only and approved organization resolution does not trust it', () => {
  const registration = readFileSync(new URL('../app/auth/sign-up/actions.ts', import.meta.url), 'utf8');
  const form = readFileSync(new URL('../components/sign-up-form.tsx', import.meta.url), 'utf8');
  const authorization = readFileSync(new URL('../lib/auth/get-current-org.ts', import.meta.url), 'utf8');
  assert.match(registration, /requestedAccountType\?: unknown/);
  assert.match(registration, /input\.requestedAccountType !== undefined && requestedAccountType === null/);
  assert.ok(registration.indexOf('input.requestedAccountType !== undefined') < registration.indexOf('await createClient()'));
  assert.match(registration, /requested_account_type: requestedAccountType/);
  assert.doesNotMatch(registration, /\.from\(["'](?:user_organizations|organizations)["']\)|request_organization_membership|org_type:|region_code:|status:\s*["']approved/);
  assert.match(registration, /emailRedirectTo: `\$\{siteOrigin\(\)\}\/auth\/confirm\?next=\/access`/);
  assert.match(form, /type="radio"[\s\S]*?name="requested-account-type"[\s\S]*?required/);
  assert.match(form, /useState<RequestedAccountType \| "">\(""\)/);
  assert.match(authorization, /\.eq\("status", "approved"\)/);
  assert.doesNotMatch(authorization, /requested_account_type|user_metadata/);
});
