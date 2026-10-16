import test from 'node:test';
import assert from 'node:assert/strict';
import {isArchivedUpload} from '../lib/uploads/archive.ts';
test('only an explicit dated maintenance archive removes a row from the operational registry',()=>{
  const a={version:1,reason:'test_upload',archived_at:'2026-10-16T10:00:00Z'};
  assert.equal(isArchivedUpload({reconciliation_summary:{maintenance_archive:a}}),true);
  for(const summary of [null,{}, {status:'reconciled'}, {maintenance_archive:{...a,reason:'other'}},{maintenance_archive:{...a,archived_at:'invalid'}},{maintenance_archive:[]}])
    assert.equal(isArchivedUpload({reconciliation_summary:summary}),false);
});
