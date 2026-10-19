import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

test('Control Center omits implementation footer notes while preserving its admin gate',()=>{
  const page=readFileSync(new URL('../app/admin/control-center/page.tsx',import.meta.url),'utf8');
  const component=readFileSync(new URL('../components/admin/access-control-center.tsx',import.meta.url),'utf8');
  assert.doesNotMatch(page,/Revisori di piattaforma configurati|reviewerConfigReport|Gli indirizzi non sono mostrati/);
  assert.doesNotMatch(component,/Tutte le decisioni sono limitate|registrate con identità e timestamp/);
  assert.match(page,/const adminEmail = await getAdminEmail\(\)/);
  assert.match(page,/if \(!adminEmail\) return <Restricted \/>/);
  assert.match(page,/<AccessControlCenter adminEmail=\{adminEmail\} data=\{data\} \/>/);
});
